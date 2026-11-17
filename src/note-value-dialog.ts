// SPDX-License-Identifier: MIT
import { Modal, Notice, type App } from 'obsidian';
import { fitModalViewport } from './modal-layout';
import type { NoteValuePreview } from './value-editor';
import { createNoteValueInput } from './note-value-input';
import type { ListItem, NoteEditType, NoteValueEdit } from './note-value-operations';

interface Options {
  property: string;
  count: number;
  type: NoteEditType;
  values: readonly ListItem[];
  preview: (edit: NoteValueEdit) => NoteValuePreview;
  apply: (preview: NoteValuePreview) => Promise<void>;
}

export class NoteValueModal extends Modal {
  private disposeViewport?: () => void;
  private displayed?: NoteValuePreview;
  private busy = false;

  constructor(app: App, private readonly options: Options) { super(app); }

  onOpen(): void {
    this.titleEl.textContent = `Change ${this.options.property}`;
    const content = this.contentEl;
    content.classList.add('pv-edit-modal', 'pv-note-edit');
    this.containerEl.classList.add('pv-note-modal-container');
    this.modalEl.classList.add('pv-note-value-modal');
    const disposeViewport = fitModalViewport(this.containerEl);
    const fields = content.createDiv({ cls: 'pv-note-edit-scroll' });
    const win = content.ownerDocument.defaultView!;
    let revealFrame: number | undefined;
    const revealFocusedField = () => {
      if (revealFrame !== undefined) win.cancelAnimationFrame(revealFrame);
      revealFrame = win.requestAnimationFrame(() => {
        revealFrame = undefined;
        const active = content.ownerDocument.activeElement;
        if (!active || !fields.contains(active)) return;
        const field = active.getBoundingClientRect(), area = fields.getBoundingClientRect();
        if (field.bottom > area.bottom) fields.scrollTop += field.bottom - area.bottom;
        else if (field.top < area.top) fields.scrollTop -= area.top - field.top;
      });
    };
    win.visualViewport?.addEventListener('resize', revealFocusedField);
    win.visualViewport?.addEventListener('scroll', revealFocusedField);
    win.addEventListener('resize', revealFocusedField);
    fields.addEventListener('focusin', revealFocusedField);
    this.disposeViewport = () => {
      disposeViewport();
      if (revealFrame !== undefined) win.cancelAnimationFrame(revealFrame);
      win.visualViewport?.removeEventListener('resize', revealFocusedField);
      win.visualViewport?.removeEventListener('scroll', revealFocusedField);
      win.removeEventListener('resize', revealFocusedField);
      fields.removeEventListener('focusin', revealFocusedField);
    };
    fields.createEl('p', { text: `Property: ${this.options.property} · ${this.options.count} selected note${this.options.count === 1 ? '' : 's'}` });
    const editor = createNoteValueInput(fields, this.options, () => render());
    fields.createEl('p', { cls: 'pv-edit-hint', text: 'Only the selected notes change. Incompatible stored values are skipped. Undo last property edit restores successful changes until reload or another successful edit. YAML formatting may change.' });
    const previewEl = fields.createDiv({ cls: 'pv-edit-preview' });
    previewEl.setAttribute('aria-live', 'polite');
    const actions = content.createDiv({ cls: 'pv-edit-actions' });
    const cancel = actions.createEl('button', { text: 'Cancel' });
    cancel.type = 'button';
    cancel.addEventListener('click', () => this.close());
    const apply = actions.createEl('button', { text: 'Apply', cls: 'mod-cta' });
    apply.type = 'button';
    const render = () => {
      previewEl.replaceChildren();
      this.displayed = undefined;
      apply.disabled = true;
      apply.textContent = 'Apply';
      apply.classList.remove('mod-warning');
      const result = editor.read();
      if (result.error) { previewEl.createEl('p', { text: result.error }); return; }
      if (!result.edit) return;
      const preview = this.options.preview(result.edit);
      this.displayed = preview;
      apply.disabled = this.busy || preview.total === 0;
      const removingProperty = result.edit.mode === 'delete';
      apply.classList.toggle('mod-warning', removingProperty);
      apply.textContent = `${removingProperty ? 'Remove property from' : 'Apply to'} ${preview.total} note${preview.total === 1 ? '' : 's'}`;
      if (removingProperty) previewEl.createEl('p', { cls: 'pv-edit-hint', text: `The entire ${this.options.property} property and all its values will be removed from the selected notes. Other properties and the note body are preserved.` });
      previewEl.createEl('p', { text: `${preview.total} ${removingProperty ? 'will lose this property' : 'will change'}; ${preview.unchanged} already match; ${preview.conflicts.length} will be skipped.` });
      for (const change of preview.changes) {
        const row = previewEl.createDiv({ cls: 'pv-edit-change' });
        row.createSpan({ cls: 'pv-edit-path', text: change.path });
        row.createSpan({ cls: 'pv-edit-values', text: `${change.before} → ${change.after === 'null' ? '(empty)' : change.after}` });
      }
      for (const conflict of preview.conflicts) previewEl.createEl('p', { cls: 'pv-edit-change', text: `${conflict.path}: ${conflict.message}` });
    };
    apply.addEventListener('click', () => {
      if (this.busy || apply.disabled || !this.displayed) return;
      this.busy = true;
      editor.setDisabled(true);
      cancel.disabled = apply.disabled = true;
      apply.textContent = this.displayed.changes.some(change => change.remove) ? 'Removing…' : 'Updating…';
      editor.blur();
      void this.options.apply(this.displayed).then(() => this.close()).catch(() => {
        this.busy = false;
        editor.setDisabled(false);
        cancel.disabled = false;
        render();
        new Notice('Could not change property values. Review the preview before retrying.');
      });
    });
    render();
  }

  onClose(): void {
    this.disposeViewport?.();
    this.disposeViewport = undefined;
    this.contentEl.replaceChildren();
  }
}
