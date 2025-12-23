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
