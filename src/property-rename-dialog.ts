// SPDX-License-Identifier: MIT
import { Modal, Notice, type App } from 'obsidian';
import type { PropertyRenamePreview } from './value-editor';

interface Options {
  property: string;
  preview: (target: string) => PropertyRenamePreview;
  apply: (preview: PropertyRenamePreview) => Promise<void>;
}

export class PropertyRenameModal extends Modal {
  private displayed?: PropertyRenamePreview;
  private busy = false;

  constructor(app: App, private readonly options: Options) { super(app); }

  onOpen(): void {
    this.titleEl.textContent = 'Rename property';
    const content = this.contentEl;
    content.classList.add('pv-edit-modal');
    content.createEl('p', { text: `Rename ${this.options.property} across the vault, including notes hidden by filters.` });
    const label = content.createEl('label', { cls: 'pv-edit-field' });
    label.createSpan({ text: 'New property name' });
    const input = label.createEl('input', { cls: 'pv-edit-input' });
    input.type = 'text'; input.value = this.options.property;
    input.setAttribute('aria-label', 'New property name');
    content.createEl('p', { cls: 'pv-edit-hint', text: 'Values and their stored types are preserved. Existing destination keys and ambiguous source keys are skipped. Check the destination property type in Obsidian; its type configuration is not renamed. YAML formatting may change.' });
    content.createEl('p', { cls: 'pv-edit-hint', text: 'Undo last property edit restores the last batch until reload; a successful batch replaces previous undo. Saved views and display preferences include the new name and retain the old name for skipped notes and undo.' });
    const previewEl = content.createDiv({ cls: 'pv-edit-preview' });
    previewEl.setAttribute('aria-live', 'polite');
    const actions = content.createDiv({ cls: 'pv-edit-actions' });
    const cancel = actions.createEl('button', { text: 'Cancel' });
    cancel.type = 'button'; cancel.addEventListener('click', () => this.close());
    const apply = actions.createEl('button', { text: 'Rename', cls: 'mod-cta' });
    apply.type = 'button';
    const render = () => {
      this.displayed = this.options.preview(input.value);
      const plan = this.displayed;
      previewEl.replaceChildren();
      apply.textContent = `Rename in ${plan.total} notes`;
      apply.disabled = this.busy || !!plan.error || plan.total === 0;
      if (plan.error) { previewEl.createEl('p', { text: plan.error }); return; }
      previewEl.createEl('p', { text: `${plan.total} notes will change; ${plan.conflicts.length} notes will be skipped.` });
      for (const change of plan.changes) {
        const row = previewEl.createDiv({ cls: 'pv-edit-change' });
        row.createSpan({ cls: 'pv-edit-path', text: change.path });
        row.createSpan({ cls: 'pv-edit-values', text: `${change.key} → ${change.targetKey ?? plan.target}: ${change.before}` });
      }
      if (plan.conflicts.length) previewEl.createEl('h3', { text: 'Skipped notes' });
      for (const conflict of plan.conflicts) previewEl.createEl('p', { cls: 'pv-edit-change', text: `${conflict.path}: ${conflict.message}` });
    };
    input.addEventListener('input', render);
    apply.addEventListener('click', () => {
      if (this.busy || apply.disabled || !this.displayed) return;
      this.busy = true; input.disabled = true; apply.disabled = true; cancel.disabled = true;
      apply.textContent = 'Renaming…';
      void this.options.apply(this.displayed).then(() => this.close()).catch(() => {
        this.busy = false; input.disabled = false; cancel.disabled = false; render();
        new Notice('Could not rename properties.');
      });
    });
    render();
    input.focus(); input.select();
  }

  onClose(): void { this.contentEl.replaceChildren(); }
}
