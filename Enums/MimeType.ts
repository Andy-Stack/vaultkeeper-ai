import { FileType } from "./FileType";

export enum MimeType {
    // Text
    TEXT_PLAIN = "text/plain",
    TEXT_MARKDOWN = "text/markdown",
    TEXT_MD = "text/md",
    TEXT_HTML = "text/html",
    TEXT_CSS = "text/css",
    TEXT_CSV = "text/csv",
    TEXT_TSV = "text/tab-separated-values",
    TEXT_JAVASCRIPT = "text/javascript",
    TEXT_TYPESCRIPT = "text/typescript",
    TEXT_JSX = "text/jsx",
    TEXT_TSX = "text/tsx",
    TEXT_SASS = "text/x-sass",
    TEXT_SCSS = "text/x-scss",
    TEXT_VUE = "text/x-vue",
    TEXT_SVELTE = "text/x-svelte",
    TEXT_PYTHON = "text/x-python",
    TEXT_RUBY = "text/x-ruby",
    TEXT_PHP = "text/x-php",
    TEXT_JAVA = "text/x-java",
    TEXT_JAVA_SOURCE = "text/x-java-source",
    TEXT_C = "text/x-c",
    TEXT_CSRC = "text/x-csrc",
    TEXT_CHDR = "text/x-chdr",
    TEXT_CPP = "text/x-c++",
    TEXT_CPPSRC = "text/x-c++src",
    TEXT_CPPHDR = "text/x-c++hdr",
    TEXT_CSHARP = "text/x-csharp",
    TEXT_GO = "text/x-go",
    TEXT_RUST = "text/x-rust",
    TEXT_SWIFT = "text/x-swift",
    TEXT_KOTLIN = "text/x-kotlin",
    TEXT_SCALA = "text/x-scala",
    TEXT_R = "text/x-r",
    TEXT_JULIA = "text/x-julia",
    TEXT_LUA = "text/x-lua",
    TEXT_PERL = "text/x-perl",
    TEXT_DART = "text/x-dart",
    TEXT_SHELL = "text/x-shellscript",
    TEXT_SH = "text/x-sh",
    TEXT_BATCH = "text/x-batch",
    TEXT_POWERSHELL = "text/x-powershell",
    TEXT_SQL = "text/x-sql",
    TEXT_GRAPHQL = "text/x-graphql",
    TEXT_XML = "text/xml",
    TEXT_YAML = "text/x-yaml",

    // Application
    APPLICATION_JSON = "application/json",
    APPLICATION_XML = "application/xml",
    APPLICATION_PDF = "application/pdf",
    APPLICATION_RTF = "application/rtf",
    APPLICATION_YAML = "application/x-yaml",
    APPLICATION_TOML = "application/toml",
    APPLICATION_TEX = "application/x-tex",
    APPLICATION_LATEX = "application/x-latex",
    APPLICATION_MAKEFILE = "text/x-makefile",
    APPLICATION_GRADLE = "text/x-gradle",
    APPLICATION_DOCKERFILE = "text/x-dockerfile",
    APPLICATION_PYTHON_CODE = "application/x-python-code",
    APPLICATION_JAVASCRIPT = "application/x-javascript",
    APPLICATION_TYPESCRIPT = "application/x-typescript",
    APPLICATION_SH = "application/x-sh",

    // Markup formats
    TEXT_RST = "text/x-rst",
    TEXT_ASCIIDOC = "text/x-asciidoc",
    TEXT_ORG = "text/x-org",
    TEXT_TEXTILE = "text/x-textile",

    // Images
    IMAGE_AVIF = "image/avif",
    IMAGE_BMP = "image/bmp",
    IMAGE_GIF = "image/gif",
    IMAGE_JPEG = "image/jpeg",
    IMAGE_PNG = "image/png",
    IMAGE_SVG = "image/svg+xml",
    IMAGE_WEBP = "image/webp",

    // Audio
    AUDIO_FLAC = "audio/flac",
    AUDIO_MP4 = "audio/mp4",
    AUDIO_MPEG = "audio/mpeg",
    AUDIO_OGG = "audio/ogg",
    AUDIO_WAV = "audio/wav",
    AUDIO_WEBM = "audio/webm",

    // Video
    VIDEO_3GPP = "video/3gpp",
    VIDEO_MATROSKA = "video/x-matroska",
    VIDEO_QUICKTIME = "video/quicktime",
    VIDEO_MP4 = "video/mp4",
    VIDEO_OGG = "video/ogg",
    VIDEO_WEBM = "video/webm",

    UNKNOWN = "unknown"
}

export function toMimeType(mimeType: string): MimeType {
    if (isKnownMimeType(mimeType)) {
        return mimeType;
    }
    return MimeType.UNKNOWN;
}

export function isKnownMimeType(value: string): value is MimeType {
    return Object.values(MimeType).includes(value as MimeType) && value !== MimeType.UNKNOWN.toString();
}

export const FileTypeToMimeType: Record<FileType, MimeType> = {
    // ----- Types officially supported by Obsidian -----
    [FileType.MD]: MimeType.TEXT_MARKDOWN,
    [FileType.BASE]: MimeType.TEXT_PLAIN,
    [FileType.CANVAS]: MimeType.APPLICATION_JSON,

    // images
    [FileType.AVIF]: MimeType.IMAGE_AVIF,
    [FileType.BMP]: MimeType.IMAGE_BMP,
    [FileType.GIF]: MimeType.IMAGE_GIF,
    [FileType.JPEG]: MimeType.IMAGE_JPEG,
    [FileType.JPG]: MimeType.IMAGE_JPEG,
    [FileType.PNG]: MimeType.IMAGE_PNG,
    [FileType.SVG]: MimeType.IMAGE_SVG,
    [FileType.WEBP]: MimeType.IMAGE_WEBP,

    // Note: WEBM is used for both audio and video, defaulting to video
    [FileType.WEBM]: MimeType.VIDEO_WEBM,

    // audio
    [FileType.FLAC]: MimeType.AUDIO_FLAC,
    [FileType.M4A]: MimeType.AUDIO_MP4,
    [FileType.MP3]: MimeType.AUDIO_MPEG,
    [FileType.OGG]: MimeType.AUDIO_OGG,
    [FileType.WAV]: MimeType.AUDIO_WAV,
    [FileType.THREE_GP]: MimeType.VIDEO_3GPP,

    // video
    [FileType.MKV]: MimeType.VIDEO_MATROSKA,
    [FileType.MOV]: MimeType.VIDEO_QUICKTIME,
    [FileType.MP4]: MimeType.VIDEO_MP4,
    [FileType.OGV]: MimeType.VIDEO_OGG,

    // pdf
    [FileType.PDF]: MimeType.APPLICATION_PDF,

    // ----- Types not officially supported by Obsidian -----
    // Plain text
    [FileType.TXT]: MimeType.TEXT_PLAIN,
    [FileType.TEXT]: MimeType.TEXT_PLAIN,

    // Data formats
    [FileType.JSON]: MimeType.APPLICATION_JSON,
    [FileType.XML]: MimeType.APPLICATION_XML,
    [FileType.CSV]: MimeType.TEXT_CSV,
    [FileType.TSV]: MimeType.TEXT_TSV,
    [FileType.YAML]: MimeType.APPLICATION_YAML,
    [FileType.YML]: MimeType.APPLICATION_YAML,
    [FileType.TOML]: MimeType.APPLICATION_TOML,

    // Web languages
    [FileType.HTML]: MimeType.TEXT_HTML,
    [FileType.CSS]: MimeType.TEXT_CSS,
    [FileType.SASS]: MimeType.TEXT_SASS,
    [FileType.SCSS]: MimeType.TEXT_SCSS,

    // JavaScript/TypeScript ecosystem
    [FileType.JS]: MimeType.TEXT_JAVASCRIPT,
    [FileType.MJS]: MimeType.TEXT_JAVASCRIPT,
    [FileType.CJS]: MimeType.TEXT_JAVASCRIPT,
    [FileType.TS]: MimeType.TEXT_TYPESCRIPT,
    [FileType.JSX]: MimeType.TEXT_JSX,
    [FileType.TSX]: MimeType.TEXT_TSX,
    [FileType.VUE]: MimeType.TEXT_VUE,
    [FileType.SVELTE]: MimeType.TEXT_SVELTE,
    [FileType.ASTRO]: MimeType.TEXT_PLAIN,

    // Shell/Scripting
    [FileType.SH]: MimeType.TEXT_SHELL,
    [FileType.BASH]: MimeType.TEXT_SHELL,
    [FileType.ZSH]: MimeType.TEXT_SHELL,
    [FileType.FISH]: MimeType.TEXT_SHELL,
    [FileType.BAT]: MimeType.TEXT_BATCH,
    [FileType.CMD]: MimeType.TEXT_BATCH,
    [FileType.PS1]: MimeType.TEXT_POWERSHELL,

    // Programming languages
    [FileType.PY]: MimeType.TEXT_PYTHON,
    [FileType.RB]: MimeType.TEXT_RUBY,
    [FileType.PHP]: MimeType.TEXT_PHP,
    [FileType.JAVA]: MimeType.TEXT_JAVA,
    [FileType.C]: MimeType.TEXT_C,
    [FileType.CPP]: MimeType.TEXT_CPP,
    [FileType.CC]: MimeType.TEXT_CPP,
    [FileType.CXX]: MimeType.TEXT_CPP,
    [FileType.H]: MimeType.TEXT_C,
    [FileType.HPP]: MimeType.TEXT_CPP,
    [FileType.HXX]: MimeType.TEXT_CPP,
    [FileType.CS]: MimeType.TEXT_CSHARP,
    [FileType.GO]: MimeType.TEXT_GO,
    [FileType.RS]: MimeType.TEXT_RUST,
    [FileType.SWIFT]: MimeType.TEXT_SWIFT,
    [FileType.KT]: MimeType.TEXT_KOTLIN,
    [FileType.KTS]: MimeType.TEXT_KOTLIN,
    [FileType.SCALA]: MimeType.TEXT_SCALA,
    [FileType.M]: MimeType.TEXT_PLAIN,
    [FileType.R]: MimeType.TEXT_R,
    [FileType.R_UPPER]: MimeType.TEXT_R,
    [FileType.JL]: MimeType.TEXT_JULIA,
    [FileType.LUA]: MimeType.TEXT_LUA,
    [FileType.PL]: MimeType.TEXT_PERL,
    [FileType.PM]: MimeType.TEXT_PERL,
    [FileType.DART]: MimeType.TEXT_DART,

    // Markup & Documentation
    [FileType.TEX]: MimeType.APPLICATION_TEX,
    [FileType.LATEX]: MimeType.APPLICATION_LATEX,
    [FileType.RST]: MimeType.TEXT_RST,
    [FileType.ADOC]: MimeType.TEXT_ASCIIDOC,
    [FileType.ASCIIDOC]: MimeType.TEXT_ASCIIDOC,
    [FileType.ORG]: MimeType.TEXT_ORG,
    [FileType.TEXTILE]: MimeType.TEXT_TEXTILE,
    [FileType.RTF]: MimeType.APPLICATION_RTF,

    // Configuration files
    [FileType.INI]: MimeType.TEXT_PLAIN,
    [FileType.CFG]: MimeType.TEXT_PLAIN,
    [FileType.CONF]: MimeType.TEXT_PLAIN,
    [FileType.ENV]: MimeType.TEXT_PLAIN,
    [FileType.PROPERTIES]: MimeType.TEXT_PLAIN,
    [FileType.GITIGNORE]: MimeType.TEXT_PLAIN,
    [FileType.GITATTRIBUTES]: MimeType.TEXT_PLAIN,
    [FileType.EDITORCONFIG]: MimeType.TEXT_PLAIN,
    [FileType.PRETTIERRC]: MimeType.TEXT_PLAIN,
    [FileType.ESLINTRC]: MimeType.TEXT_PLAIN,
    [FileType.BABELRC]: MimeType.TEXT_PLAIN,
    [FileType.NPMRC]: MimeType.TEXT_PLAIN,
    [FileType.YARNRC]: MimeType.TEXT_PLAIN,
    [FileType.DOCKERFILE]: MimeType.APPLICATION_DOCKERFILE,

    // Query languages
    [FileType.SQL]: MimeType.TEXT_SQL,
    [FileType.GRAPHQL]: MimeType.TEXT_GRAPHQL,
    [FileType.GQL]: MimeType.TEXT_GRAPHQL,

    // Build & Development
    [FileType.MAKEFILE]: MimeType.APPLICATION_MAKEFILE,
    [FileType.MK]: MimeType.APPLICATION_MAKEFILE,
    [FileType.GRADLE]: MimeType.APPLICATION_GRADLE,
    [FileType.DIFF]: MimeType.TEXT_PLAIN,
    [FileType.PATCH]: MimeType.TEXT_PLAIN,

    // Logs
    [FileType.LOG]: MimeType.TEXT_PLAIN,

    [FileType.UNKNOWN]: MimeType.UNKNOWN
};
