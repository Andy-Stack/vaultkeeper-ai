import { ItemView, WorkspaceLeaf } from 'obsidian';

import Input from '../Components/Input.svelte';
import { mount, unmount } from 'svelte';

export const VIEW_TYPE_MAIN = 'main-view';

export class MainView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  input: ReturnType<typeof Input> | undefined;

  getViewType() {
    return VIEW_TYPE_MAIN;
  }

  getDisplayText() {
    return 'Main View';
  }

  async onOpen() {
    const container = this.contentEl;
    container.empty();
    
    this.input = mount(Input, {
      target: container,
      props: {
        input: "",
      }
    });
  }

  async onClose() {
    if (this.input) {
      unmount(this.input);
    }
  }
}