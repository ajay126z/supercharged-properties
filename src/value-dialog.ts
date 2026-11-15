// SPDX-License-Identifier: MIT
// Supercharged Properties: confirmation dialog for bulk value edits.

import { Modal, Notice, type App } from 'obsidian';
import type { ValueEditMode, ValueEditRequest } from './value-operations';
import type { ValueEditPreview } from './value-editor';

export interface ValueDialogOptions {
  readonly request: ValueEditRequest;
  readonly siblings: string[];
  readonly preview: (request: ValueEditRequest) => ValueEditPreview;
  readonly apply: (preview: ValueEditPreview) => Promise<unknown>;
}

export class ValueEditModal extends Modal {
  private request: ValueEditRequest;
  private input: HTMLInputElement | undefined;
  private select: HTMLSelectElement | undefined;
  private previewEl!: HTMLElement;
  private applyButton!: HTMLButtonElement;
  private timer: number | undefined;
  private busy = false;
  private displayed: ValueEditPreview | undefined;

  constructor(app: App, private readonly options: ValueDialogOptions) {
    super(app);
    this.request = { ...options.request };
  }

  onOpen(): void {
    this.titleEl.textContent = titleFor(this.request.mode);
    this.contentEl.classList.add('pv-edit-modal');
    el(this.contentEl, 'p', 'pv-edit-meta', `${this.request.property}: ${this.request.value}`);
    if (this.request.mode === 'rename') {
      this.field('New value', this.request.value, value => {
        this.request = { ...this.request, replacement: value };
      });
    } else if (this.request.mode === 'merge') {
      const label = el(this.contentEl, 'label', 'pv-edit-field');
      el(label, 'span', 'pv-edit-field-label', 'Merge into');
      this.select = el(label, 'select', 'pv-edit-select');
      this.select.setAttribute('aria-label', 'Merge into value');
      for (const sibling of this.options.siblings) {
        const option = el(this.select, 'option', '', sibling);
        option.value = sibling;
      }
      this.select.value = this.request.replacement ?? this.options.siblings[0] ?? '';
      this.request = { ...this.request, replacement: this.select.value };
      this.select.addEventListener('change', () => {
        this.request = { ...this.request, replacement: this.select!.value };
        this.updatePreview();
      });
    } else if (this.request.mode === 'wikilink') {
      el(this.contentEl, 'p', 'pv-edit-hint', `Every matching note will use ${`[[${this.request.value}]]`}.`);
    } else {
      this.field('Delimiter', this.request.delimiter ?? ',', value => {
        this.request = { ...this.request, delimiter: value };
      }, 'Split the current text into a list. Each trimmed part becomes an item.');
    }
    el(this.contentEl, 'p', 'pv-edit-hint', 'Edits affect matching values in included folders across the vault, including notes hidden by search filters. Excluded folders are skipped. Undo is available for the last batch until the plugin reloads. Applying another batch replaces that undo. YAML formatting may change.');
    this.previewEl = el(this.contentEl, 'div', 'pv-edit-preview');
    this.previewEl.setAttribute('aria-live', 'polite');
    const actions = el(this.contentEl, 'div', 'pv-edit-actions');
    const cancel = el(actions, 'button', '', 'Cancel');
    cancel.type = 'button';
    cancel.addEventListener('click', () => this.close());
    this.applyButton = el(actions, 'button', 'mod-cta', 'Apply');
    this.applyButton.type = 'button';
    this.applyButton.addEventListener('click', () => { void this.submit(); });
    this.updatePreview();
  }

  onClose(): void {
    window.clearTimeout(this.timer);
    this.contentEl.replaceChildren();
  }

  private field(labelText: string, value: string, update: (value: string) => void, hint?: string): void {
    const label = el(this.contentEl, 'label', 'pv-edit-field');
    el(label, 'span', 'pv-edit-field-label', labelText);
    this.input = el(label, 'input', 'pv-edit-input');
    this.input.type = 'text';
    this.input.value = value;
    this.input.setAttribute('aria-label', labelText);
    this.input.addEventListener('input', () => {
      update(this.input!.value);
      this.schedulePreview();
    });
    if (hint) el(this.contentEl, 'p', 'pv-edit-hint', hint);
  }

  private schedulePreview(): void {
    this.applyButton.disabled = true;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.updatePreview(), 120);
  }

  private valid(): boolean {
    if (this.request.mode === 'rename' || this.request.mode === 'merge') return !!this.request.replacement?.trim();
    if (this.request.mode === 'split') return !!this.request.delimiter;
    return true;
  }

  private updatePreview(): void {
    this.previewEl.replaceChildren();
    if (!this.valid()) {
      this.applyButton.disabled = true;
      el(this.previewEl, 'p', 'pv-edit-hint', 'Enter a value to continue.');
      return;
    }
    const preview = this.options.preview(this.request);
    this.displayed = preview;
    this.applyButton.textContent = `Apply to ${preview.total} notes`;
    this.applyButton.disabled = this.busy || preview.total === 0;
    el(this.previewEl, 'p', 'pv-edit-count', preview.total
      ? `${preview.total} note${preview.total === 1 ? '' : 's'} will change.`
      : 'No notes will change.');
    for (const change of preview.changes) {
      const row = el(this.previewEl, 'div', 'pv-edit-change');
      el(row, 'span', 'pv-edit-path', change.path);
      el(row, 'span', 'pv-edit-values', `${change.before} → ${change.after}`);
    }

  }

  private async submit(): Promise<void> {
    if (this.busy || this.applyButton.disabled || !this.displayed) return;
    this.busy = true;
    if (this.input) this.input.disabled = true;
    if (this.select) this.select.disabled = true;
    this.applyButton.disabled = true;
    this.applyButton.textContent = 'Updating…';
    try {
      await this.options.apply(this.displayed);
      this.close();
    } catch {
      this.busy = false;
      if (this.input) this.input.disabled = false;
      if (this.select) this.select.disabled = false;
      this.applyButton.textContent = 'Apply';
      this.updatePreview();
      new Notice('Could not update property values.');
    }
  }
}

function titleFor(mode: ValueEditMode): string {
  switch (mode) {
    case 'rename': return 'Rename value';
    case 'merge': return 'Merge value';
    case 'wikilink': return 'Convert to wikilink';
    case 'split': return 'Split into list';
  }
}

function el<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  return parent.createEl(tag, { cls, text });
}
