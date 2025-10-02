import { ItemView, WorkspaceLeaf } from 'obsidian';
import { mount, unmount } from 'svelte';
import ChatWindow from 'Components/ChatWindow.svelte';
import TopBar from 'Components/TopBar.svelte';

export const VIEW_TYPE_MAIN = 'main-view';

export class MainView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  topBar: ReturnType<typeof TopBar> | undefined;
  input: ReturnType<typeof ChatWindow> | undefined;

  getViewType() {
    return VIEW_TYPE_MAIN;
  }

  getDisplayText() {
    return 'Main View';
  }

  async onOpen() {
    const container = this.contentEl;
    container.empty();

    // Mount TopBar
    this.topBar = mount(TopBar, {
      target: container,
      props: {
        leaf: this.leaf
      }
    });

    // Mount ChatWindow
    this.input = mount(ChatWindow, {
      target: container,
      props: {}
    });
  }

  async onClose() {
    if (this.topBar) {
      unmount(this.topBar);
    }
    if (this.input) {
      unmount(this.input);
    }
  }
}