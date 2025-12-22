import { MimeType } from "./MimeType";

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
    
    // Logs
    LOG = "log",
    
    UNKNOWN = "unknown"
}

export function toFileType(fileType: string): FileType {
    if (isKnownFileType(fileType)) {
        return fileType;
    }
    return FileType.UNKNOWN;
}

export function isKnownFileType(value: string): value is FileType {
    return Object.values(FileType).includes(value as FileType) && value !== FileType.UNKNOWN.toString();
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

export const MimeTypeToFileTypes: Record<MimeType, FileType[]> = {
    // Text
    [MimeType.TEXT_PLAIN]: [FileType.BASE, FileType.TXT, FileType.TEXT, FileType.INI, FileType.CFG, FileType.CONF, FileType.ENV, FileType.PROPERTIES, FileType.LOG, FileType.GITIGNORE, FileType.GITATTRIBUTES, FileType.EDITORCONFIG, FileType.PRETTIERRC, FileType.ESLINTRC, FileType.BABELRC, FileType.NPMRC, FileType.YARNRC, FileType.DIFF, FileType.PATCH],
    [MimeType.TEXT_MARKDOWN]: [FileType.MD],
    [MimeType.TEXT_MD]: [FileType.MD],
    [MimeType.TEXT_HTML]: [FileType.HTML],
    [MimeType.TEXT_CSS]: [FileType.CSS],
    [MimeType.TEXT_CSV]: [FileType.CSV],
    [MimeType.TEXT_TSV]: [FileType.TSV],
    [MimeType.TEXT_JAVASCRIPT]: [FileType.JS, FileType.MJS, FileType.CJS],
    [MimeType.TEXT_TYPESCRIPT]: [FileType.TS],
    [MimeType.TEXT_JSX]: [FileType.JSX],
    [MimeType.TEXT_TSX]: [FileType.TSX],
    [MimeType.TEXT_SASS]: [FileType.SASS],
    [MimeType.TEXT_SCSS]: [FileType.SCSS],
    [MimeType.TEXT_VUE]: [FileType.VUE],
    [MimeType.TEXT_SVELTE]: [FileType.SVELTE],
    [MimeType.TEXT_PYTHON]: [FileType.PY],
    [MimeType.TEXT_RUBY]: [FileType.RB],
    [MimeType.TEXT_PHP]: [FileType.PHP],
    [MimeType.TEXT_JAVA]: [FileType.JAVA],
    [MimeType.TEXT_JAVA_SOURCE]: [FileType.JAVA],
    [MimeType.TEXT_C]: [FileType.C, FileType.H],
    [MimeType.TEXT_CSRC]: [FileType.C],
    [MimeType.TEXT_CHDR]: [FileType.H],
    [MimeType.TEXT_CPP]: [FileType.CPP, FileType.CC, FileType.CXX, FileType.HPP, FileType.HXX],
    [MimeType.TEXT_CPPSRC]: [FileType.CPP, FileType.CC, FileType.CXX],
    [MimeType.TEXT_CPPHDR]: [FileType.HPP, FileType.HXX],
    [MimeType.TEXT_CSHARP]: [FileType.CS],
    [MimeType.TEXT_GO]: [FileType.GO],
    [MimeType.TEXT_RUST]: [FileType.RS],
    [MimeType.TEXT_SWIFT]: [FileType.SWIFT],
    [MimeType.TEXT_KOTLIN]: [FileType.KT, FileType.KTS],
    [MimeType.TEXT_SCALA]: [FileType.SCALA],
    [MimeType.TEXT_R]: [FileType.R, FileType.R_UPPER],
    [MimeType.TEXT_JULIA]: [FileType.JL],
    [MimeType.TEXT_LUA]: [FileType.LUA],
    [MimeType.TEXT_PERL]: [FileType.PL, FileType.PM],
    [MimeType.TEXT_DART]: [FileType.DART],
    [MimeType.TEXT_SHELL]: [FileType.SH, FileType.BASH, FileType.ZSH, FileType.FISH],
    [MimeType.TEXT_SH]: [FileType.SH, FileType.BASH, FileType.ZSH, FileType.FISH],
    [MimeType.TEXT_BATCH]: [FileType.BAT, FileType.CMD],
    [MimeType.TEXT_POWERSHELL]: [FileType.PS1],
    [MimeType.TEXT_SQL]: [FileType.SQL],
    [MimeType.TEXT_GRAPHQL]: [FileType.GRAPHQL, FileType.GQL],
    [MimeType.TEXT_XML]: [FileType.XML],
    [MimeType.TEXT_YAML]: [FileType.YAML, FileType.YML],

    // Application
    [MimeType.APPLICATION_JSON]: [FileType.CANVAS, FileType.JSON],
    [MimeType.APPLICATION_XML]: [FileType.XML],
    [MimeType.APPLICATION_PDF]: [FileType.PDF],
    [MimeType.APPLICATION_RTF]: [FileType.RTF],
    [MimeType.APPLICATION_YAML]: [FileType.YAML, FileType.YML],
    [MimeType.APPLICATION_TOML]: [FileType.TOML],
    [MimeType.APPLICATION_TEX]: [FileType.TEX],
    [MimeType.APPLICATION_LATEX]: [FileType.LATEX],
    [MimeType.APPLICATION_MAKEFILE]: [FileType.MAKEFILE, FileType.MK],
    [MimeType.APPLICATION_GRADLE]: [FileType.GRADLE],
    [MimeType.APPLICATION_DOCKERFILE]: [FileType.DOCKERFILE],
    [MimeType.APPLICATION_PYTHON_CODE]: [FileType.PY],
    [MimeType.APPLICATION_JAVASCRIPT]: [FileType.JS, FileType.MJS, FileType.CJS],
    [MimeType.APPLICATION_TYPESCRIPT]: [FileType.TS],
    [MimeType.APPLICATION_SH]: [FileType.SH, FileType.BASH, FileType.ZSH, FileType.FISH],

    // Markup formats
    [MimeType.TEXT_RST]: [FileType.RST],
    [MimeType.TEXT_ASCIIDOC]: [FileType.ADOC, FileType.ASCIIDOC],
    [MimeType.TEXT_ORG]: [FileType.ORG],
    [MimeType.TEXT_TEXTILE]: [FileType.TEXTILE],

    // Images
    [MimeType.IMAGE_AVIF]: [FileType.AVIF],
    [MimeType.IMAGE_BMP]: [FileType.BMP],
    [MimeType.IMAGE_GIF]: [FileType.GIF],
    [MimeType.IMAGE_JPEG]: [FileType.JPEG, FileType.JPG],
    [MimeType.IMAGE_PNG]: [FileType.PNG],
    [MimeType.IMAGE_SVG]: [FileType.SVG],
    [MimeType.IMAGE_WEBP]: [FileType.WEBP],

    // Audio
    [MimeType.AUDIO_FLAC]: [FileType.FLAC],
    [MimeType.AUDIO_MP4]: [FileType.M4A],
    [MimeType.AUDIO_MPEG]: [FileType.MP3],
    [MimeType.AUDIO_OGG]: [FileType.OGG],
    [MimeType.AUDIO_WAV]: [FileType.WAV],
    [MimeType.AUDIO_WEBM]: [FileType.WEBM_AUDIO],

    // Video
    [MimeType.VIDEO_3GPP]: [FileType.THREE_GP],
    [MimeType.VIDEO_MATROSKA]: [FileType.MKV],
    [MimeType.VIDEO_QUICKTIME]: [FileType.MOV],
    [MimeType.VIDEO_MP4]: [FileType.MP4],
    [MimeType.VIDEO_OGG]: [FileType.OGV],
    [MimeType.VIDEO_WEBM]: [FileType.WEBM, FileType.WEBM_VIDEO],

    [MimeType.UNKNOWN]: [FileType.UNKNOWN]
};