export class FileTagMapping {
    private mapping: Map<string, string[]> = new Map();
  
    public set(key: string, value: string[]) {
      this.mapping.set(key, value);
    }
  
    public updateMapping(key: string, newTags: string[]): string[] {
      const oldTags = this.mapping.get(key) ?? [];
      const newTagsSet = new Set(newTags);
      const removedTags = oldTags.filter(tag => !newTagsSet.has(tag));
      this.mapping.set(key, newTags);
      return removedTags.filter(tag => !this.anyFileHasTag(tag));
    }
  
    public deleteFromMapping(key: string): string[] {
      const tags = this.mapping.get(key) ?? [];
      this.mapping.delete(key);
      return tags.filter(tag => !this.anyFileHasTag(tag));
    }
  
    public renameKey(oldKey: string, newKey: string) {
      const tags = this.mapping.get(oldKey);
      if (tags) {
        this.mapping.delete(oldKey);
        this.mapping.set(newKey, tags);
      }
    }
  
    private anyFileHasTag(tag: string): boolean {
      return Array.from(this.mapping.values()).some(tags => tags.includes(tag));
    }
  }