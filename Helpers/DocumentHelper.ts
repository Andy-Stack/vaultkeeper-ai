import { loadPdfJs } from 'obsidian';
import { unzipSync, strFromU8 } from 'fflate';
import mammoth from 'mammoth/mammoth.browser.js';
import type { IPageText } from '../Types/SearchTypes';
import { Exception } from './Exception';

// Uses Obsidian's own bundled PDF.js via loadPdfJs() rather than shipping our own
export async function readPDF(arrayBuffer: ArrayBuffer): Promise<IPageText[]> {
    try {
        const pdfjs = await loadPdfJs();
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

        const pageTexts: IPageText[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const text = content.items
                .map((item: { str?: string }) => item.str ?? '')
                .join(' ');
            pageTexts.push({ text, pageNumber: i });
            page.cleanup?.();
        }
        await pdf.destroy?.();

        return pageTexts;
    } catch (error) {
        /** PDF.js error types (from underlying pdfjs-dist library):
         * - InvalidPDFException: Invalid or corrupted PDF structure
         * - PasswordException: PDF requires a password
         * - FormatError: PDF format error
         * - UnexpectedResponseException: Unexpected server response
         * - AbortException: Operation was aborted
         * - UnknownErrorException: Unknown error occurred **/

        if (error instanceof Error && error.name === 'PasswordException') {
            return [{ text: "PDF is password protected!", pageNumber: 1 }] as IPageText[];
        }
        return [{ text: `Failed to read PDF: ${Exception.messageFrom(error)}`, pageNumber: 1 }] as IPageText[];
    }
}

// Handles document formats: DOCX, PPTX, XLSX, ODT, ODP, ODS.
//
// DOCX goes through mammoth (battle-tested: tables, lists, footnotes). The remaining
// formats are ZIP-of-XML containers we read with fflate + the platform DOMParser, so
// no heavy parser is bundled. We only extract plain text (no OCR, no images) — the LLM
// can read files directly and use its own vision engine when it needs to.
export async function readDocument(arrayBuffer: ArrayBuffer, extension: string): Promise<IPageText[]> {
    try {
        let text: string;
        switch (extension.toLowerCase()) {
            case 'docx':
                text = (await mammoth.extractRawText({ arrayBuffer })).value;
                break;
            case 'xlsx':
                text = extractXlsx(arrayBuffer);
                break;
            case 'pptx':
                text = extractPptx(arrayBuffer);
                break;
            case 'odt':
            case 'odp':
            case 'ods':
                text = extractOdf(arrayBuffer);
                break;
            default:
                throw Exception.new(`Unsupported document type: .${extension}`);
        }

        // These formats expose no page structure, so we return a single page
        return [{ text, pageNumber: 1 }] as IPageText[];
    } catch (error) {
        return [{ text: `Failed to read document: ${Exception.messageFrom(error)}`, pageNumber: 1 }] as IPageText[];
    }
}

// --- Shared helpers for the ZIP-of-XML formats (xlsx / pptx / odf) ---

// Throws on legacy OLE2 binaries (.xls/.ppt/.doc) — they aren't ZIPs. Callers wrap
// this so the failure surfaces as a clean "failed to read" message.
function unzip(arrayBuffer: ArrayBuffer): Record<string, Uint8Array> {
    return unzipSync(new Uint8Array(arrayBuffer));
}

function parseXml(bytes: Uint8Array): Document {
    return new DOMParser().parseFromString(strFromU8(bytes), 'application/xml');
}

/** Numeric sort key from a path like "ppt/slides/slide12.xml" -> 12. */
function ordinal(path: string): number {
    const match = path.match(/(\d+)\.xml$/);
    return match ? Number(match[1]) : 0;
}

// --- XLSX: values live as indices into a shared-strings table ---
function extractXlsx(arrayBuffer: ArrayBuffer): string {
    const files = unzip(arrayBuffer);

    // Resolve the shared-strings table (cells of type "s" point into this).
    let shared: string[] = [];
    if (files['xl/sharedStrings.xml']) {
        const dom = parseXml(files['xl/sharedStrings.xml']);
        shared = Array.from(dom.getElementsByTagName('si')).map((si) =>
            Array.from(si.getElementsByTagName('t'))
                .map((t) => t.textContent ?? '')
                .join('')
        );
    }

    const sheets = Object.keys(files)
        .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
        .sort((a, b) => ordinal(a) - ordinal(b));

    const rows: string[] = [];
    for (const name of sheets) {
        const dom = parseXml(files[name]);
        for (const row of Array.from(dom.getElementsByTagName('row'))) {
            const cells = Array.from(row.getElementsByTagName('c')).map((cell) => {
                const type = cell.getAttribute('t');
                if (type === 'inlineStr') {
                    // Text stored directly in the cell: <c t="inlineStr"><is><t>…</t></is></c>
                    return Array.from(cell.getElementsByTagName('t'))
                        .map((t) => t.textContent ?? '')
                        .join('');
                }
                const value = cell.getElementsByTagName('v')[0];
                if (!value) return '';
                return type === 's'
                    ? shared[Number(value.textContent)] ?? ''
                    : value.textContent ?? '';
            });
            rows.push(cells.join('\t'));
        }
    }
    return rows.join('\n');
}

// --- PPTX: one XML per slide; sort numerically so output is in slide order ---
function extractPptx(arrayBuffer: ArrayBuffer): string {
    const files = unzip(arrayBuffer);

    const slides = Object.keys(files)
        .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort((a, b) => ordinal(a) - ordinal(b));

    return slides
        .map((name) => {
            const dom = parseXml(files[name]);
            return Array.from(dom.getElementsByTagName('a:t'))
                .map((t) => t.textContent ?? '')
                .join(' ');
        })
        .join('\n\n');
}

// --- ODF (odt / ods / odp): everything lives in a single content.xml ---
function extractOdf(arrayBuffer: ArrayBuffer): string {
    const files = unzip(arrayBuffer);
    if (!files['content.xml']) return '';

    const dom = parseXml(files['content.xml']);

    // Single document-order pass over paragraphs (text:p) and headings (text:h).
    // getElementsByTagName("*") preserves order, keeping body text, spreadsheet cells,
    // and slide text in the sequence they appear.
    const out: string[] = [];
    const all = dom.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
        const tag = all[i].tagName; // prefixed, e.g. "text:p"
        if (tag === 'text:p' || tag === 'text:h') {
            out.push(all[i].textContent ?? '');
        }
    }
    return out.join('\n');
}
