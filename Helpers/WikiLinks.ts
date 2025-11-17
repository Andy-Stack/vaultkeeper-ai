import { TFile } from "obsidian";

export class WikiLinks {

  public links: string[] = [];

  public addWikiLink(file: TFile) {
    if (file.extension === "md") {
      this.links.push(this.asWikiLink(file));
    }
  }

  public removeWikiLink(file: TFile | string) {
    if (file instanceof TFile) {
      if (file.extension === "md") {
        this.removeFromLinks(this.asWikiLink(file));
      }
    } else {
      if (file.endsWith(".md")) {
        this.removeFromLinks(this.asWikiLink(file));
      }
    }
  }

  private asWikiLink(file: TFile | string) {
    if (file instanceof TFile) {
      return file.path.replace(/\.md$/, "");
    }
    return file.replace(/\.md$/, "");
  }

  private removeFromLinks(wikiLink: string) {
    const index = this.links.indexOf(wikiLink);
    if (index !== -1) {
      this.links.splice(index, 1);
    }
  }

}