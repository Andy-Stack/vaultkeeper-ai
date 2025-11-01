import { basename, extname } from "path";
import { setTooltip } from "obsidian";
import type { HTMLService } from "Services/HTMLService";
import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";

export enum SearchTrigger {
    Tag = "#",
    File = "@",
    Folder = "/"
}

export namespace SearchTrigger {
    
    const values: string[] = [
        SearchTrigger.Tag,
        SearchTrigger.File,
        SearchTrigger.Folder
    ];

    export function isSearchTrigger(input: string): boolean {
        return values.includes(input);
    }

    export function isSearchTriggerElement(node: Node): boolean {
        return node.nodeType === Node.ELEMENT_NODE &&
               (node as HTMLElement).tagName === 'SPAN' &&
               (node as HTMLElement).classList?.contains('search-trigger');
    }

    export function fromInput(input: string): SearchTrigger {
        switch(input) {
            case SearchTrigger.Tag:
                return SearchTrigger.Tag;
            case SearchTrigger.File:
                return SearchTrigger.File;
            case SearchTrigger.Folder:
                return SearchTrigger.Folder;
            default:
                throw new Error(`Unknown search trigger: ${input}`);
        }
    }

    export function toNode(trigger: SearchTrigger, content: string): Node {
        let text: string;

        switch (trigger) {
            case SearchTrigger.Tag:
                text = content;
                break;
            case SearchTrigger.File:
                text = basename(content, extname(content));
                break;
            case SearchTrigger.Folder:
                text = basename(content) + "/";
                break;
        }

        const node = createEl("span", {
            text: text,
            cls: "search-trigger",
            attr: {
                contenteditable: false
            }
        });

        node.dataset.trigger = trigger;
        node.dataset.content = content;

        setTooltip(node, content, { placement: "top" });

        return node;
    }

    export function triggerToText(input: string): string {
        const htmlService: HTMLService = Resolve<HTMLService>(Services.HTMLService);

        const temp = htmlService.parseHTMLToContainer(input);
        let result = "";

        temp.childNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            result += node.textContent || "";
          } else if (SearchTrigger.isSearchTriggerElement(node)) {
            const element = node as HTMLElement;
            const trigger = element.dataset.trigger;
            const content = element.dataset.content;

            if (trigger && content) {
              switch (trigger) {
                case SearchTrigger.Tag:
                  result += `tag:"${content}"`;
                  break;
                case SearchTrigger.File:
                  result += `file:"${content}"`;
                  break;
                case SearchTrigger.Folder:
                  result += `folder:"${content}"`;
                  break;
              }
            }
          }
        });

        return result;
      }
}