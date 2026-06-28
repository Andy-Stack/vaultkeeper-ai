declare module '*.css' {
    const content: string;
    export default content;
}

declare module '*.svg' {
    const content: string;
    export default content;
}

declare module '*.png' {
    const content: string;
    export default content;
}

// mammoth ships type declarations for its default entry but not for the browser
// build we import (mammoth/mammoth.browser.js) for mobile safety. The browser build
// exposes the same public API, so we re-use mammoth's own types.
declare module 'mammoth/mammoth.browser.js' {
    import mammoth from 'mammoth';
    export = mammoth;
}
