import { Exception } from "Helpers/Exception";

export enum FileType {

    // ----- Types officially supported by Obsidian -----

    MD = "md",
    BASE = "base",
    CANVAS = "canvas",

    // images
    AVIF = "avif",
    BMP = "bmp",
    GIF = "gif",
    JPEG = "jpeg",
    JPG = "jpg",
    PNG = "png",
    SVG = "svg",
    WEBP = "webp",

    WEBM = "webm",

    // audio
    FLAC = "flac",
    M4A = "m4a",
    MP3 = "mp3",
    OGG = "ogg",
    WAV = "wav",
    WEBM_AUDIO = WEBM,
    THREE_GP = "3gp",

    // video
    MKV = "mkv",
    MOV = "mov",
    MP4 = "mp4",
    OGV = "ogv",
    WEBM_VIDEO = WEBM,

    // pdf
    PDF = "pdf",

    // ----- Types not officially supported by Obsidian -----

    TXT = "txt",
    JSON = "json",
    XML = "xml",
    HTML = "html",
    CSV = "csv",
    YAML = "yaml",
    YML = "yml",
    CSS = "css",
    JS = "js",
    TS = "ts",
    JSX = "jsx",
    TSX = "tsx",
    SASS = "sass",
    SCSS = "scss",
    TEX = "tex",
    INI = "ini",
    CFG = "cfg",
    CONF = "conf",
    LOG = "log",
    TOML = "toml",
    RTF = "rtf",
}

export function getImageMimeType(extension: string): string {
    switch (extension.toLowerCase()) {
        case FileType.AVIF as string:
            return "image/avif";
        case FileType.BMP as string:
            return "image/bmp";
        case FileType.GIF as string:
            return "image/gif";
        case FileType.JPEG as string:
        case FileType.JPG as string:
            return "image/jpeg";
        case FileType.PNG as string:
            return "image/png";
        case FileType.SVG as string:
            return "image/svg+xml";
        case FileType.WEBP as string:
            return "image/webp";
        default:
            Exception.throw(`Image type not supported: ${extension}`);
    }
}

export function isKnownFileType(value: string): value is FileType {
    return Object.values(FileType).includes(value as FileType);
}

export function isFileType(value: string, fileType: FileType) {
    return value === fileType.toString();
}

export function isBinaryFile(extension: string) {
    return isKnownFileType(extension) && !isTextFile(extension);
}

export function isTextFile(extension: string) {
    return isFileType(extension, FileType.MD)
        || isFileType(extension, FileType.BASE)
        || isFileType(extension, FileType.CANVAS)
        || isFileType(extension, FileType.TXT)
        || isFileType(extension, FileType.JSON)
        || isFileType(extension, FileType.XML)
        || isFileType(extension, FileType.HTML)
        || isFileType(extension, FileType.CSV)
        || isFileType(extension, FileType.YAML)
        || isFileType(extension, FileType.YML)
        || isFileType(extension, FileType.CSS)
        || isFileType(extension, FileType.JS)
        || isFileType(extension, FileType.TS)
        || isFileType(extension, FileType.JSX)
        || isFileType(extension, FileType.TSX)
        || isFileType(extension, FileType.SASS)
        || isFileType(extension, FileType.SCSS)
        || isFileType(extension, FileType.TEX)
        || isFileType(extension, FileType.INI)
        || isFileType(extension, FileType.CFG)
        || isFileType(extension, FileType.CONF)
        || isFileType(extension, FileType.LOG)
        || isFileType(extension, FileType.TOML)
        || isFileType(extension, FileType.RTF);
}