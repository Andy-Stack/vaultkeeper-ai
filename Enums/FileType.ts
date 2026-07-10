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
    // Plain text
    TXT = "txt",
    TEXT = "text",
    
    // Data formats
    JSON = "json",
    XML = "xml",
    CSV = "csv",
    TSV = "tsv",
    YAML = "yaml",
    YML = "yml",
    TOML = "toml",
    
    // Web languages
    HTML = "html",
    CSS = "css",
    SASS = "sass",
    SCSS = "scss",
    
    // JavaScript/TypeScript ecosystem
    JS = "js",
    MJS = "mjs",
    CJS = "cjs",
    TS = "ts",
    JSX = "jsx",
    TSX = "tsx",
    VUE = "vue",
    SVELTE = "svelte",
    ASTRO = "astro",
    
    // Shell/Scripting
    SH = "sh",
    BASH = "bash",
    ZSH = "zsh",
    FISH = "fish",
    BAT = "bat",
    CMD = "cmd",
    PS1 = "ps1",
    
    // Programming languages
    PY = "py",
    RB = "rb",
    PHP = "php",
    JAVA = "java",
    C = "c",
    CPP = "cpp",
    CC = "cc",
    CXX = "cxx",
    H = "h",
    HPP = "hpp",
    HXX = "hxx",
    CS = "cs",
    GO = "go",
    RS = "rs",
    SWIFT = "swift",
    KT = "kt",
    KTS = "kts",
    SCALA = "scala",
    M = "m",
    R = "r",
    R_UPPER = "R",
    JL = "jl",
    LUA = "lua",
    PL = "pl",
    PM = "pm",
    DART = "dart",
    
    // Markup & Documentation
    TEX = "tex",
    LATEX = "latex",
    RST = "rst",
    ADOC = "adoc",
    ASCIIDOC = "asciidoc",
    ORG = "org",
    TEXTILE = "textile",
    RTF = "rtf",
    
    // Configuration files
    INI = "ini",
    CFG = "cfg",
    CONF = "conf",
    ENV = "env",
    PROPERTIES = "properties",
    GITIGNORE = "gitignore",
    GITATTRIBUTES = "gitattributes",
    EDITORCONFIG = "editorconfig",
    PRETTIERRC = "prettierrc",
    ESLINTRC = "eslintrc",
    BABELRC = "babelrc",
    NPMRC = "npmrc",
    YARNRC = "yarnrc",
    DOCKERFILE = "dockerfile",
    
    // Query languages
    SQL = "sql",
    GRAPHQL = "graphql",
    GQL = "gql",
    
    // Build & Development
    MAKEFILE = "makefile",
    MK = "mk",
    GRADLE = "gradle",
    DIFF = "diff",
    PATCH = "patch",
    
    // Document formats
    DOCX = "docx",
    PPTX = "pptx",
    XLSX = "xlsx",
    ODT = "odt",
    ODP = "odp",
    ODS = "ods",

    // Logs
    LOG = "log",
    
    UNKNOWN = "unknown"
}

export function toFileType(fileType: string): FileType {
    const normalized = fileType.startsWith('.') ? fileType.slice(1) : fileType;
    if (isKnownFileType(normalized)) {
        return normalized;
    }
    return FileType.UNKNOWN;
}

export function isKnownFileType(value: string): value is FileType {
    return Object.values(FileType).includes(value as FileType) && value !== FileType.UNKNOWN.toString();
}

export function isFileType(value: unknown, fileType: FileType): value is FileType {
    return value === fileType.toString();
}

export function isBinaryFile(extension: string) {
    return isKnownFileType(extension) && !isTextFile(extension) && !isDocumentFile(extension);
}

export function isDocumentFile(extension: string) {
    return isFileType(extension, FileType.DOCX)
        || isFileType(extension, FileType.PPTX)
        || isFileType(extension, FileType.XLSX)
        || isFileType(extension, FileType.ODT)
        || isFileType(extension, FileType.ODP)
        || isFileType(extension, FileType.ODS);
}

export function isTextFile(extension: string) {
    return isFileType(extension, FileType.MD)
        || isFileType(extension, FileType.BASE)
        || isFileType(extension, FileType.CANVAS)
        || isFileType(extension, FileType.TXT)
        || isFileType(extension, FileType.TEXT)
        || isFileType(extension, FileType.JSON)
        || isFileType(extension, FileType.XML)
        || isFileType(extension, FileType.CSV)
        || isFileType(extension, FileType.TSV)
        || isFileType(extension, FileType.YAML)
        || isFileType(extension, FileType.YML)
        || isFileType(extension, FileType.TOML)
        || isFileType(extension, FileType.HTML)
        || isFileType(extension, FileType.CSS)
        || isFileType(extension, FileType.SASS)
        || isFileType(extension, FileType.SCSS)
        || isFileType(extension, FileType.JS)
        || isFileType(extension, FileType.MJS)
        || isFileType(extension, FileType.CJS)
        || isFileType(extension, FileType.TS)
        || isFileType(extension, FileType.JSX)
        || isFileType(extension, FileType.TSX)
        || isFileType(extension, FileType.VUE)
        || isFileType(extension, FileType.SVELTE)
        || isFileType(extension, FileType.ASTRO)
        || isFileType(extension, FileType.SH)
        || isFileType(extension, FileType.BASH)
        || isFileType(extension, FileType.ZSH)
        || isFileType(extension, FileType.FISH)
        || isFileType(extension, FileType.BAT)
        || isFileType(extension, FileType.CMD)
        || isFileType(extension, FileType.PS1)
        || isFileType(extension, FileType.PY)
        || isFileType(extension, FileType.RB)
        || isFileType(extension, FileType.PHP)
        || isFileType(extension, FileType.JAVA)
        || isFileType(extension, FileType.C)
        || isFileType(extension, FileType.CPP)
        || isFileType(extension, FileType.CC)
        || isFileType(extension, FileType.CXX)
        || isFileType(extension, FileType.H)
        || isFileType(extension, FileType.HPP)
        || isFileType(extension, FileType.HXX)
        || isFileType(extension, FileType.CS)
        || isFileType(extension, FileType.GO)
        || isFileType(extension, FileType.RS)
        || isFileType(extension, FileType.SWIFT)
        || isFileType(extension, FileType.KT)
        || isFileType(extension, FileType.KTS)
        || isFileType(extension, FileType.SCALA)
        || isFileType(extension, FileType.M)
        || isFileType(extension, FileType.R)
        || isFileType(extension, FileType.R_UPPER)
        || isFileType(extension, FileType.JL)
        || isFileType(extension, FileType.LUA)
        || isFileType(extension, FileType.PL)
        || isFileType(extension, FileType.PM)
        || isFileType(extension, FileType.DART)
        || isFileType(extension, FileType.TEX)
        || isFileType(extension, FileType.LATEX)
        || isFileType(extension, FileType.RST)
        || isFileType(extension, FileType.ADOC)
        || isFileType(extension, FileType.ASCIIDOC)
        || isFileType(extension, FileType.ORG)
        || isFileType(extension, FileType.TEXTILE)
        || isFileType(extension, FileType.RTF)
        || isFileType(extension, FileType.INI)
        || isFileType(extension, FileType.CFG)
        || isFileType(extension, FileType.CONF)
        || isFileType(extension, FileType.ENV)
        || isFileType(extension, FileType.PROPERTIES)
        || isFileType(extension, FileType.GITIGNORE)
        || isFileType(extension, FileType.GITATTRIBUTES)
        || isFileType(extension, FileType.EDITORCONFIG)
        || isFileType(extension, FileType.PRETTIERRC)
        || isFileType(extension, FileType.ESLINTRC)
        || isFileType(extension, FileType.BABELRC)
        || isFileType(extension, FileType.NPMRC)
        || isFileType(extension, FileType.YARNRC)
        || isFileType(extension, FileType.DOCKERFILE)
        || isFileType(extension, FileType.SQL)
        || isFileType(extension, FileType.GRAPHQL)
        || isFileType(extension, FileType.GQL)
        || isFileType(extension, FileType.MAKEFILE)
        || isFileType(extension, FileType.MK)
        || isFileType(extension, FileType.GRADLE)
        || isFileType(extension, FileType.DIFF)
        || isFileType(extension, FileType.PATCH)
        || isFileType(extension, FileType.LOG);
}

export function isImageFile(extension: string) {
    return isFileType(extension, FileType.AVIF)
        || isFileType(extension, FileType.BMP)
        || isFileType(extension, FileType.GIF)
        || isFileType(extension, FileType.JPEG)
        || isFileType(extension, FileType.JPG)
        || isFileType(extension, FileType.PNG)
        || isFileType(extension, FileType.SVG)
        || isFileType(extension, FileType.WEBP);
}

export function isAudioFile(extension: string) {
    return isFileType(extension, FileType.FLAC)
        || isFileType(extension, FileType.M4A)
        || isFileType(extension, FileType.MP3)
        || isFileType(extension, FileType.OGG)
        || isFileType(extension, FileType.WAV)
        || isFileType(extension, FileType.WEBM_AUDIO)
        || isFileType(extension, FileType.THREE_GP);
}

export function isVideoFile(extension: string) {
    return isFileType(extension, FileType.MKV)
        || isFileType(extension, FileType.MOV)
        || isFileType(extension, FileType.MP4)
        || isFileType(extension, FileType.OGV)
        || isFileType(extension, FileType.WEBM_VIDEO);
}