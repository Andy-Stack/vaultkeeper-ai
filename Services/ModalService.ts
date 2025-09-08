import { Modal } from "obsidian";
import { Resolve } from "./DependencyService";

interface IModalService {
    showModal(modal: symbol): void;
}

export class ModalService implements IModalService {

    showModal(modal: symbol): void {
        let modalInstance: Modal = Resolve(modal);
        modalInstance.open();
    }
}