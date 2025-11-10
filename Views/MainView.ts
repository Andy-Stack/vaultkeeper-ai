import { ItemView, WorkspaceLeaf } from 'obsidian';
import { mount, unmount } from 'svelte';
import ChatWindow from 'Components/ChatWindow.svelte';
import TopBar from 'Components/TopBar.svelte';
import type { StatusBarService } from 'Services/StatusBarService';
import { Resolve } from 'Services/DependencyService';
import { Services } from 'Services/Services';

export const VIEW_TYPE_MAIN = 'vaultkeeper-ai-main-view';

interface ChatWindowComponent {
  focusInput: () => void;
  resetChatArea: () => void;
}

export class MainView extends ItemView {

  private statusBarService: StatusBarService = Resolve<StatusBarService>(Services.StatusBarService);

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  topBar: ReturnType<typeof TopBar> | undefined;
  input: ChatWindowComponent | undefined;

  getViewType() {
    return VIEW_TYPE_MAIN;
  }

  getDisplayText() {
    return "Vaultkeeper AI";
  }

  getIcon(): string {
    return 'sparkles';
  }

  // ItemView requires onOpen to return Promise<void>, but mount operations are synchronous
  // eslint-disable-next-line @typescript-eslint/require-await
  async onOpen() {
    const container = this.contentEl;
    container.empty();

    // Mount TopBar with reference to ChatWindow's focus function
    this.topBar = mount(TopBar, {
      target: container,
      props: {
        leaf: this.leaf,
        onNewConversation: () => {
          this.input?.resetChatArea();
          this.input?.focusInput();
        }
      }
    });

    // Mount ChatWindow first
    this.input = mount(ChatWindow, {
      target: container,
      props: {}
    }) as ChatWindowComponent;
  }

  async onClose() {
    if (this.topBar) {
      await unmount(this.topBar);
    }
    if (this.input) {
      await unmount(this.input);
    }
    this.statusBarService.removeStatusBarMessage();
  }
}