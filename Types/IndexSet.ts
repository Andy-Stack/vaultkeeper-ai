export class IndexSet<KeyType, ElementType> {
  
  private keys: KeyType[] = [];
  private elements: ElementType[] = [];
  private indexes: Map<KeyType, number> = new Map();

  public get allElements(): readonly ElementType[] {
    return this.elements;
  }

  public get count(): number {
    return this.elements.length;
  }

  public get(key: KeyType): ElementType | undefined {
    const index = this.indexes.get(key);
    return index === undefined ? undefined : this.elements[index];
  }

  public getAt(index: number): ElementType | undefined {
    return this.elements[index];
  }

  public contains(key: KeyType): boolean {
    return this.indexes.has(key);
  }

  public set(key: KeyType, value: ElementType): void {
    const index = this.indexes.get(key);

    if (index !== undefined) {
      this.elements[index] = value;
      return;
    }

    this.indexes.set(key, this.elements.length);
    this.elements.push(value);
    this.keys.push(key);
  }

  public delete(key: KeyType): void {
    const index = this.indexes.get(key);

    if (index === undefined) {
      return;
    }

    const lastIndex = this.elements.length - 1;

    if (index !== lastIndex) {
      const lastKey = this.keys[lastIndex];
      this.elements[index] = this.elements[lastIndex];
      this.keys[index] = lastKey;
      this.indexes.set(lastKey, index);
    }

    this.keys.pop();
    this.elements.pop();
    this.indexes.delete(key);
  }

  public rename(oldKey: KeyType, newKey: KeyType): void {
    const index = this.indexes.get(oldKey);
    
    if (index === undefined || oldKey === newKey || this.indexes.has(newKey)) {
      return;
    }

    this.indexes.delete(oldKey);
    this.indexes.set(newKey, index);
    this.keys[index] = newKey;
  }

  public clear(): void {
    this.keys.length = 0;
    this.elements.length = 0;
    this.indexes.clear();
  }

}