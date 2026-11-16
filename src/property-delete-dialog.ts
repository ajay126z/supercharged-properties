// SPDX-License-Identifier: MIT
import { Modal, Notice, type App } from 'obsidian';
import type { PropertyDeletePreview } from './value-editor';

interface Options {
  property: string;
  preview: () => PropertyDeletePreview;
  apply: (preview: PropertyDeletePreview) => Promise<void>;
}

export class PropertyDeleteModal extends Modal {
  private displayed?: PropertyDeletePreview;
  private busy = false;

  constructor(app: App, private readonly options: Options) { super(app); }

  onOpen(): void {
    this.titleEl.textContent = 'Delete property';
    const content = this.contentEl;
    content.classList.add('pv-edit-modal');
    content.createEl('p', { text: `Delete ${this.options.property} from every eligible note in included folders across the vault, including notes hidden by search filters. Excluded folders are skipped.` });
    content.createEl('p', { cls: 'pv-edit-hint', text: 'The property key and its values are removed from matching notes. Notes with ambiguous keys or unavailable metadata are skipped. Undo last property edit restores the last batch until reload.' });
    const previewEl = content.createDiv({ cls: 'pv-edit-preview' });
    previewEl.setAttribute('aria-live', 'polite');
    const actions = content.createDiv({ cls: 'pv-edit-actions' });
    const cancel = actions.createEl('button', { text: 'Cancel' });
    cancel.type = 'button';
    cancel.addEventListener('click', () => this.close());
    const apply = actions.createEl('button', { text: 'Delete', cls: 'mod-warning' });
    apply.type = 'button';
    const render = () => {
      this.displayed = this.options.preview();
      const plan = this.displayed;
      previewEl.replaceChildren();
      apply.textContent = `Delete from ${plan.total} notes`;
      apply.disabled = this.busy || plan.total === 0;
      previewEl.createEl('p', { text: `${plan.total} note${plan.total === 1 ? '' : 's'} will lose this property; ${plan.conflicts.length} will be skipped.` });
      for (const change of plan.changes) {
        const row = previewEl.createDiv({ cls: 'pv-edit-change' });
        row.createSpan({ cls: 'pv-edit-path', text: change.path });
        row.createSpan({ cls: 'pv-edit-values', text: `${change.key}: ${change.before} → removed` });
      }
      if (plan.conflicts.length) previewEl.createEl('h3', { text: 'Skipped notes' });
      for (const conflict of plan.conflicts) previewEl.createEl('p', { cls: 'pv-edit-change', text: `${conflict.path}: ${conflict.message}` });
    };
    apply.addEventListener('click', () => {
      if (this.busy || apply.disabled || !this.displayed) return;
      this.busy = true;
      cancel.disabled = true;
      apply.disabled = true;
      apply.textContent = 'Deleting…';
      void this.options.apply(this.displayed).then(() => this.close()).catch(() => {
        this.busy = false;
        cancel.disabled = false;
        new Notice('Could not delete properties.');
        render();
      });
    });
    render();
    cancel.focus();
  }

  onClose(): void { this.contentEl.replaceChildren(); }
}
