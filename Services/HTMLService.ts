export class HTMLService {

    public clearElement(element: HTMLElement) {
        element.empty();
    }

    public setHTMLContent(container: HTMLElement, htmlString: string) {
        this.clearElement(container);
        const fragment = this.parseHTMLString(htmlString);
        container.appendChild(fragment);
    }

    public parseHTMLString(htmlString: string): DocumentFragment {
        const parser = new DOMParser();
        const fragment = createFragment();
        const doc = parser.parseFromString(htmlString, "text/html");

        // Transfer all nodes from the parsed body to the fragment
        while (doc.body.firstChild) {
            fragment.appendChild(doc.body.firstChild);
        }

        return fragment;
    }

    // Creates a temporary container, parses HTML, and returns the container.
    // Useful for parsing HTML when you need to traverse the resulting DOM structure.
    public parseHTMLToContainer(htmlString: string): HTMLDivElement {
        const container = createDiv();
        const fragment = this.parseHTMLString(htmlString);
        container.appendChild(fragment);
        return container;
    }

}