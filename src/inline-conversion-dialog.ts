// SPDX-License-Identifier: MIT
import { Modal, Notice, type App } from 'obsidian';
import { fitModalViewport } from './modal-layout';
import type { ConversionOptions, ConversionPlan } from './inline-conversion';
interface Options { property: string; paths: string[]; preview: (options: ConversionOptions, paths: string[]) => Promise<ConversionPlan>; apply: (plan: ConversionPlan) => Promise<void> }
export class InlineConversionModal extends Modal {
  private dispose?: () => void;
  private revision = 0;
  constructor(app: App, private options: Options) { super(app); }
  onOpen(): void {
    this.titleEl.textContent = 'Convert to YAML property';
    this.containerEl.classList.add('pv-note-modal-container'); this.modalEl.classList.add('pv-note-value-modal');
    this.contentEl.classList.add('pv-edit-modal', 'pv-note-edit'); this.dispose = fitModalViewport(this.containerEl);
    const scroll = this.contentEl.createDiv({cls: 'pv-note-edit-scroll'});
    scroll.createEl('p', {text: `Convert all occurrences of ${this.options.property} in the selected notes. Value filters, note/path search, and excluded folders limit this list.`});
    scroll.createEl('p', {text: 'Repeated fields become a list. Preview before confirming. Undo last property edit restores this batch until reload or another property edit. YAML formatting may change.'});
    const options: ConversionOptions = {property: this.options.property, move: true, detect: false, conflict: 'skip'};
    const inputs: Array<HTMLInputElement | HTMLSelectElement> = [];
    const select = (name: string, choices: Array<[string, string]>, update: (value: string) => void) => {
      const label = scroll.createEl('label', {cls: 'pv-edit-field'}); label.createSpan({text: name});
      const input = label.createEl('select'); input.setAttribute('aria-label', name); inputs.push(input);
      for (const [value, text] of choices) input.createEl('option', {value, text});
      input.addEventListener('change', () => { update(input.value); invalidate(); });
    };
    select('Source text', [['move','Move — remove inline fields'],['keep','Keep — copy only']], value => { options.move = value === 'move'; });
    select('Existing YAML property', [['skip','Skip'],['merge','Merge into list'],['overwrite','Overwrite']], value => { options.conflict = value as ConversionOptions['conflict']; });
    const label = scroll.createEl('label', {cls: 'pv-scope-choice'}), detection = label.createEl('input'); detection.type = 'checkbox'; inputs.push(detection);
    label.createSpan({text: 'Detect numbers, checkboxes, and dates'}); detection.setAttribute('aria-label', 'Detect numbers, checkboxes, and dates');
    detection.addEventListener('change', () => { options.detect = detection.checked; invalidate(); });
    scroll.createEl('p', {text: 'Default: literal text, including links and leading zeros. Detection converts numeric text and true/false; ISO dates remain date-compatible text. Property display types are managed by Obsidian.'});
    const selected = new Set(this.options.paths);
    const notes = scroll.createEl('details'); notes.createEl('summary', {text: `${selected.size} eligible notes — choose notes`});
    let shown = 0;
    const more = notes.createEl('button', {text: 'Show more notes'});
    const showNotes = () => {
      for (const path of this.options.paths.slice(shown, shown + 50)) {
        const row = notes.createEl('label', {cls: 'pv-scope-choice'}), input = row.createEl('input'); input.type = 'checkbox'; input.checked = selected.has(path); inputs.push(input); row.createSpan({text: path});
        input.addEventListener('change', () => { if (input.checked) selected.add(path); else selected.delete(path); invalidate(); });
        notes.insertBefore(row, more);
      }
      shown += 50; more.hidden = shown >= this.options.paths.length;
    };
    more.addEventListener('click', showNotes); showNotes();
    const preview = scroll.createDiv({cls: 'pv-edit-preview'}); preview.setAttribute('aria-live', 'polite');
    const actions = this.contentEl.createDiv({cls: 'pv-edit-actions'});
    const cancel = actions.createEl('button', {text: 'Cancel'}); cancel.addEventListener('click', () => this.close());
    const inspect = actions.createEl('button', {text: 'Preview changes'}), apply = actions.createEl('button', {text: 'Confirm conversion', cls: 'mod-cta'}); apply.disabled = true;
    let plan: ConversionPlan | undefined;
    const invalidate = () => { this.revision++; plan = undefined; apply.disabled = true; preview.replaceChildren(); };
    inspect.addEventListener('click', () => {
      const revision = ++this.revision; apply.disabled = true; inspect.disabled = true; preview.textContent = 'Reading notes…';
      void this.options.preview({...options}, [...selected]).then(result => {
        if (revision !== this.revision) return;
        plan = result; preview.replaceChildren();
        preview.createEl('p', {text: `${result.changes.length} notes will change; ${result.skipped.length} skipped. Showing up to 50 notes; excerpts are limited to 4,000 characters.`});
        for (const change of result.changes.slice(0, 50)) {
          const row = preview.createDiv({cls: 'pv-edit-change'}); row.createEl('strong', {text: change.path});
          row.createEl('pre', {text: `YAML ${change.key}\nBefore: ${change.existed ? JSON.stringify(change.original) : '(missing)'}\nAfter: ${JSON.stringify(change.replacement)}`.slice(0, 4000)});
          row.createEl('pre', {text: result.options.move ? `Removed from body:\n${change.removed.join("\n").slice(0, 4000)}\nBody after:\n${change.afterBody.slice(0, 4000)}` : 'Inline fields kept.'});
        }
        for (const skip of result.skipped.slice(0, 50)) preview.createEl('p', {text: `${skip.path}: ${skip.reason}`});
        apply.disabled = !result.changes.length;
      }).catch(() => { if (revision === this.revision) preview.textContent = 'Could not preview conversion.'; }).finally(() => { inspect.disabled = false; });
    });
    apply.addEventListener('click', () => {
      if (!plan || apply.disabled) return;
      apply.disabled = true; inspect.disabled = true; cancel.disabled = true; more.disabled = true; inputs.forEach(input => { input.disabled = true; });
      void this.options.apply(plan).then(() => this.close()).catch(error => {
        new Notice(error instanceof Error ? error.message : 'Conversion failed.'); invalidate(); inspect.disabled = false; cancel.disabled = false; more.disabled = false; inputs.forEach(input => { input.disabled = false; });
      });
    });
  }
  onClose(): void { this.revision++; this.dispose?.(); this.contentEl.replaceChildren(); }
}
