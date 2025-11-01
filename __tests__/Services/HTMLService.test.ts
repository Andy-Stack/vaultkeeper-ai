import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HTMLService } from '../../Services/HTMLService';

describe('HTMLService', () => {
    let service: HTMLService;

    beforeEach(() => {
        service = new HTMLService();
    });

    describe('clearElement', () => {
        it('should call empty() on the element', () => {
            const mockElement = {
                empty: vi.fn()
            } as unknown as HTMLElement;

            service.clearElement(mockElement);

            expect(mockElement.empty).toHaveBeenCalledOnce();
        });

        it('should handle multiple calls to the same element', () => {
            const mockElement = {
                empty: vi.fn()
            } as unknown as HTMLElement;

            service.clearElement(mockElement);
            service.clearElement(mockElement);

            expect(mockElement.empty).toHaveBeenCalledTimes(2);
        });
    });

    describe('parseHTMLString', () => {
        it('should parse a simple HTML string into a DocumentFragment', () => {
            const htmlString = '<div>Hello World</div>';
            const fragment = service.parseHTMLString(htmlString);

            expect(fragment).toBeInstanceOf(DocumentFragment);
            expect(fragment.childNodes.length).toBe(1);
            expect(fragment.firstChild).toBeInstanceOf(HTMLDivElement);
            expect((fragment.firstChild as HTMLElement).textContent).toBe('Hello World');
        });

        it('should parse multiple sibling elements', () => {
            const htmlString = '<div>First</div><span>Second</span><p>Third</p>';
            const fragment = service.parseHTMLString(htmlString);

            expect(fragment.childNodes.length).toBe(3);
            expect(fragment.childNodes[0].nodeName).toBe('DIV');
            expect(fragment.childNodes[1].nodeName).toBe('SPAN');
            expect(fragment.childNodes[2].nodeName).toBe('P');
        });

        it('should parse nested HTML structures', () => {
            const htmlString = '<div><span>Nested</span><p>Content</p></div>';
            const fragment = service.parseHTMLString(htmlString);

            expect(fragment.childNodes.length).toBe(1);
            const divElement = fragment.firstChild as HTMLElement;
            expect(divElement.nodeName).toBe('DIV');
            expect(divElement.childNodes.length).toBe(2);
            expect(divElement.childNodes[0].nodeName).toBe('SPAN');
            expect(divElement.childNodes[1].nodeName).toBe('P');
        });

        it('should parse HTML with attributes', () => {
            const htmlString = '<div class="test-class" id="test-id" data-value="123">Content</div>';
            const fragment = service.parseHTMLString(htmlString);

            const divElement = fragment.firstChild as HTMLElement;
            expect(divElement.getAttribute('class')).toBe('test-class');
            expect(divElement.getAttribute('id')).toBe('test-id');
            expect(divElement.getAttribute('data-value')).toBe('123');
        });

        it('should handle empty string', () => {
            const fragment = service.parseHTMLString('');

            expect(fragment).toBeInstanceOf(DocumentFragment);
            expect(fragment.childNodes.length).toBe(0);
        });

        it('should handle text content without HTML tags', () => {
            const htmlString = 'Plain text content';
            const fragment = service.parseHTMLString(htmlString);

            expect(fragment.childNodes.length).toBe(1);
            expect(fragment.firstChild?.nodeType).toBe(Node.TEXT_NODE);
            expect(fragment.textContent).toBe('Plain text content');
        });

        it('should handle mixed text and HTML elements', () => {
            const htmlString = 'Text before<span>Element</span>Text after';
            const fragment = service.parseHTMLString(htmlString);

            expect(fragment.childNodes.length).toBe(3);
            expect(fragment.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
            expect(fragment.childNodes[1].nodeType).toBe(Node.ELEMENT_NODE);
            expect(fragment.childNodes[2].nodeType).toBe(Node.TEXT_NODE);
        });

        it('should handle special characters in HTML', () => {
            const htmlString = '<div>&lt;script&gt;alert("test")&lt;/script&gt;</div>';
            const fragment = service.parseHTMLString(htmlString);

            const divElement = fragment.firstChild as HTMLElement;
            expect(divElement.textContent).toBe('<script>alert("test")</script>');
        });

        it('should parse complex HTML structures', () => {
            const htmlString = `
                <article>
                    <header>
                        <h1>Title</h1>
                        <p class="subtitle">Subtitle</p>
                    </header>
                    <section>
                        <p>Paragraph 1</p>
                        <p>Paragraph 2</p>
                    </section>
                </article>
            `;
            const fragment = service.parseHTMLString(htmlString);

            expect(fragment.childNodes.length).toBeGreaterThan(0);
            const article = Array.from(fragment.childNodes).find(
                node => node.nodeName === 'ARTICLE'
            ) as HTMLElement;
            expect(article).toBeDefined();
            expect(article.querySelector('h1')?.textContent?.trim()).toBe('Title');
            expect(article.querySelector('.subtitle')?.textContent?.trim()).toBe('Subtitle');
        });
    });

    describe('setHTMLContent', () => {
        it('should clear the container and set new HTML content', () => {
            const container = document.createElement('div');
            container.innerHTML = '<span>Old Content</span>';
            const htmlString = '<div>New Content</div>';

            service.setHTMLContent(container, htmlString);

            expect(container.childNodes.length).toBe(1);
            expect(container.firstChild?.nodeName).toBe('DIV');
            expect((container.firstChild as HTMLElement).textContent).toBe('New Content');
        });

        it('should handle setting empty content', () => {
            const container = document.createElement('div');
            container.innerHTML = '<span>Old Content</span>';

            service.setHTMLContent(container, '');

            expect(container.childNodes.length).toBe(0);
            expect(container.innerHTML).toBe('');
        });

        it('should set multiple elements', () => {
            const container = document.createElement('div');
            const htmlString = '<p>First</p><p>Second</p><p>Third</p>';

            service.setHTMLContent(container, htmlString);

            expect(container.childNodes.length).toBe(3);
            expect(container.querySelectorAll('p').length).toBe(3);
        });

        it('should preserve attributes when setting content', () => {
            const container = document.createElement('div');
            const htmlString = '<button class="btn" data-action="submit">Click me</button>';

            service.setHTMLContent(container, htmlString);

            const button = container.querySelector('button');
            expect(button?.getAttribute('class')).toBe('btn');
            expect(button?.getAttribute('data-action')).toBe('submit');
            expect(button?.textContent).toBe('Click me');
        });

        it('should handle nested structures', () => {
            const container = document.createElement('div');
            const htmlString = '<ul><li>Item 1</li><li>Item 2</li></ul>';

            service.setHTMLContent(container, htmlString);

            expect(container.querySelector('ul')).toBeDefined();
            expect(container.querySelectorAll('li').length).toBe(2);
        });

        it('should completely replace existing content', () => {
            const container = document.createElement('div');
            container.innerHTML = '<div><span>A</span><span>B</span><span>C</span></div>';

            service.setHTMLContent(container, '<p>New</p>');

            expect(container.childNodes.length).toBe(1);
            expect(container.querySelector('span')).toBeNull();
            expect(container.querySelector('p')).toBeDefined();
        });
    });

    describe('parseHTMLToContainer', () => {
        it('should return an HTMLDivElement', () => {
            const htmlString = '<span>Content</span>';
            const container = service.parseHTMLToContainer(htmlString);

            expect(container).toBeInstanceOf(HTMLDivElement);
            expect(container.nodeName).toBe('DIV');
        });

        it('should contain parsed HTML as children', () => {
            const htmlString = '<p>Paragraph</p>';
            const container = service.parseHTMLToContainer(htmlString);

            expect(container.childNodes.length).toBe(1);
            expect(container.firstChild?.nodeName).toBe('P');
            expect((container.firstChild as HTMLElement).textContent).toBe('Paragraph');
        });

        it('should handle multiple child elements', () => {
            const htmlString = '<div>First</div><div>Second</div>';
            const container = service.parseHTMLToContainer(htmlString);

            expect(container.childNodes.length).toBe(2);
            expect(container.querySelectorAll('div').length).toBe(2);
        });

        it('should allow traversal of parsed content', () => {
            const htmlString = '<div class="parent"><span class="child">Text</span></div>';
            const container = service.parseHTMLToContainer(htmlString);

            const parent = container.querySelector('.parent');
            const child = container.querySelector('.child');

            expect(parent).toBeDefined();
            expect(child).toBeDefined();
            expect(child?.textContent).toBe('Text');
        });

        it('should handle empty string', () => {
            const container = service.parseHTMLToContainer('');

            expect(container).toBeInstanceOf(HTMLDivElement);
            expect(container.childNodes.length).toBe(0);
        });

        it('should handle text content', () => {
            const htmlString = 'Plain text';
            const container = service.parseHTMLToContainer(htmlString);

            expect(container.textContent).toBe('Plain text');
            expect(container.childNodes.length).toBe(1);
            expect(container.firstChild?.nodeType).toBe(Node.TEXT_NODE);
        });

        it('should allow querying with dataset attributes', () => {
            const htmlString = '<span class="search-trigger" data-trigger="#" data-content="tag">Tag</span>';
            const container = service.parseHTMLToContainer(htmlString);

            const element = container.querySelector('.search-trigger') as HTMLElement;
            expect(element).toBeDefined();
            expect(element.dataset.trigger).toBe('#');
            expect(element.dataset.content).toBe('tag');
        });

        it('should handle complex nested structures', () => {
            const htmlString = `
                <div class="outer">
                    <div class="inner">
                        <span data-value="123">Content</span>
                    </div>
                </div>
            `;
            const container = service.parseHTMLToContainer(htmlString);

            const outer = container.querySelector('.outer');
            const inner = container.querySelector('.inner');
            const span = container.querySelector('span');

            expect(outer).toBeDefined();
            expect(inner).toBeDefined();
            expect(span).toBeDefined();
            expect((span as HTMLElement).dataset.value).toBe('123');
        });

        it('should be detached from the document', () => {
            const htmlString = '<div>Content</div>';
            const container = service.parseHTMLToContainer(htmlString);

            // The container should not be part of the document
            expect(container.parentNode).toBeNull();
            expect(document.contains(container)).toBe(false);
        });
    });
});
