// SPDX-License-Identifier: MIT
import { Modal, Notice, type App } from 'obsidian';
import { fitModalViewport } from './modal-layout';
import type { NoteValuePreview } from './value-editor';

interface Options {
  property: string;
  count: number;
  values: readonly string[];
  preview: (replacement: string | null) => NoteValuePreview;
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
    const label = fields.createEl('label', { cls: 'pv-edit-field' });
    label.createSpan({ text: 'Destination value' });
    const select = label.createEl('select');
    select.setAttribute('aria-label', 'Destination value');
    select.createEl('option', { text: 'Choose a value…' }).value = '';
    for (const [index, value] of this.options.values.entries()) select.createEl('option', { text: value }).value = `value:${index}`;
    select.createEl('option', { text: 'Add new value…' }).value = 'custom';
    select.createEl('option', { text: 'Set empty (keep property)' }).value = 'empty';
    const custom = fields.createEl('label', { cls: 'pv-edit-field' });
    custom.hidden = true;
    custom.createSpan({ text: 'New value' });
    const input = custom.createEl('input', { type: 'text', cls: 'pv-edit-input' });
    input.setAttribute('aria-label', 'New value');
    fields.createEl('p', { cls: 'pv-edit-hint', text: 'Only the selected notes change. Text properties with text or empty values are supported. Set empty keeps the property key. Undo last property edit restores successful changes until reload or another successful edit. YAML formatting may change.' });
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
      custom.hidden = select.value !== 'custom';
      let replacement: string | null;
      if (select.value === 'empty') replacement = null;
      else if (select.value === 'custom') {
        replacement = input.value.trim();
        if (!replacement || replacement.includes('\0')) {
          previewEl.createEl('p', { text: 'Enter text or choose Set empty.' }); return;
        }
      } else if (select.value.startsWith('value:')) replacement = this.options.values[Number(select.value.slice(6))];
      else return;
      const preview = this.options.preview(replacement);
      this.displayed = preview;
      apply.disabled = this.busy || preview.total === 0;
      apply.textContent = `Apply to ${preview.total} note${preview.total === 1 ? '' : 's'}`;
      previewEl.createEl('p', { text: `${preview.total} will change; ${preview.unchanged} already match; ${preview.conflicts.length} will be skipped.` });
      for (const change of preview.changes) {
        const row = previewEl.createDiv({ cls: 'pv-edit-change' });
        row.createSpan({ cls: 'pv-edit-path', text: change.path });
        row.createSpan({ cls: 'pv-edit-values', text: `${change.before} → ${change.after === 'null' ? '(empty)' : change.after}` });
      }
      for (const conflict of preview.conflicts) previewEl.createEl('p', { cls: 'pv-edit-change', text: `${conflict.path}: ${conflict.message}` });
    };
    select.addEventListener('change', render);
    input.addEventListener('input', render);
    apply.addEventListener('click', () => {
      if (this.busy || apply.disabled || !this.displayed) return;
      this.busy = true;
      select.disabled = input.disabled = cancel.disabled = apply.disabled = true;
      apply.textContent = 'Updating…';
      input.blur();
      void this.options.apply(this.displayed).then(() => this.close()).catch(() => {
        this.busy = false;
        select.disabled = input.disabled = cancel.disabled = false;
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
