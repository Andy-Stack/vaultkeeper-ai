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

  public getViewType() {
    return VIEW_TYPE_MAIN;
  }

  public getDisplayText() {
    return "Vaultkeeper AI";
  }

  public getIcon(): string {
    return 'sparkles';
  }

  protected override onOpen(): Promise<void> {
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

    return Promise.resolve(); 
  }

  public override async onClose(): Promise<void> {
    if (this.topBar) {
      await unmount(this.topBar);
    }
    if (this.input) {
      await unmount(this.input);
    }
    this.statusBarService.removeStatusBarMessage();
  }
}