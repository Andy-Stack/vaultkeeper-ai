import { FileType } from "./FileType";
import { MimeType } from "./MimeType";

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

    // Document formats
    [FileType.DOCX]: MimeType.APPLICATION_DOCX,
    [FileType.PPTX]: MimeType.APPLICATION_PPTX,
    [FileType.XLSX]: MimeType.APPLICATION_XLSX,
    [FileType.ODT]: MimeType.APPLICATION_ODT,
    [FileType.ODP]: MimeType.APPLICATION_ODP,
    [FileType.ODS]: MimeType.APPLICATION_ODS,

    // Logs
    [FileType.LOG]: MimeType.TEXT_PLAIN,

    [FileType.UNKNOWN]: MimeType.UNKNOWN
};

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

    // Office document formats
    [MimeType.APPLICATION_DOCX]: [FileType.DOCX],
    [MimeType.APPLICATION_PPTX]: [FileType.PPTX],
    [MimeType.APPLICATION_XLSX]: [FileType.XLSX],
    [MimeType.APPLICATION_ODT]: [FileType.ODT],
    [MimeType.APPLICATION_ODP]: [FileType.ODP],
    [MimeType.APPLICATION_ODS]: [FileType.ODS],

    [MimeType.UNKNOWN]: [FileType.UNKNOWN]
};
