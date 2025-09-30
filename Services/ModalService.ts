import { Modal } from "obsidian";
import { Resolve } from "./DependencyService";

export class ModalService {

    showModal(modal: symbol): void {
        let modalInstance: Modal = Resolve(modal);
        modalInstance.open();
    }

}