import { extractText, getDocumentProxy } from 'unpdf';
import type { IPageText } from './SearchTypes';
import { Exception } from './Exception';

export async function readPDF(arrayBuffer: ArrayBuffer): Promise<IPageText[]> {
    try {
        const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
        const pages = (await extractText(pdf, { mergePages: false })).text;

        const pageTexts: IPageText[] = pages.map((pageText, index) => ({
            text: pageText,
            pageNumber: index + 1
        }));

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