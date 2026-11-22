// SPDX-License-Identifier: MIT
import { Modal, Menu, Notice, setIcon, type App } from 'obsidian';
import { fold, natural } from './index';
import { fitModalViewport } from './modal-layout';
import { validateRows, parseValue, type AddRow, type ExistsMode, type BulkSettings, type NoteResult } from './bulk-properties';
import { typeLabels, typeIcons, type PropertyChoice } from './property-catalog';
import { BulkNameSuggest, BulkValueSuggest } from './bulk-property-suggest';
import type { BulkScope } from './bulk-scope';
import type { BulkPlan } from './bulk-properties-service';
import type { ValueUndoResult } from './value-editor';
interface Options {
    mode: 'add' | 'remove';
    settings: BulkSettings;
    scope: (recursive: boolean) => BulkScope;
    catalog: (paths: string[]) => PropertyChoice[];
    values: (key: string, paths: string[]) => string[];
    preview: (paths: string[], request: {
        rows: AddRow[];
        exists: ExistsMode;
        delimiter: string;
    } | {
        keys: string[];
    }) => BulkPlan;
    apply: (plan: BulkPlan, progress: (done: number, total: number) => void) => Promise<NoteResult[]>;
    undo: () => Promise<ValueUndoResult>;
    canUndo: () => boolean;
}
function displayValue(value: unknown): string {
    try { return JSON.stringify(value) ?? '(unset)'; } catch { return '(recursive YAML value)'; }
}
let rowId = 0;
const blank = (): AddRow => ({ id: `bulk-${++rowId}`, key: '', type: 'text', value: '' });
export class BulkPropertiesModal extends Modal {
    private screen: 'add' | 'remove' | 'pick' | 'preview' | 'done';
    private rows: AddRow[] = [blank()];
    private selected = new Set<string>();
    private picked = new Set<string>();
    private recursive: boolean;
    private exists: ExistsMode;
    private filter = '';
    private pickFilter = '';
    private bulkScope!: BulkScope;
    private choices: PropertyChoice[] = [];
    private plan?: BulkPlan;
    private body!: HTMLElement;
    private footer!: HTMLElement;
    private primary?: HTMLButtonElement;
    private suggesters: Array<{
        close: () => void;
    }> = [];
    private dispose?: () => void;
    private busy = false;
    private closed = false;
    private origin: HTMLElement | null = null;
    private results: NoteResult[] = [];
    constructor(app: App, private options: Options) { super(app); this.screen = options.mode; this.recursive = options.settings.bulkIncludeSubfolders; this.exists = options.settings.bulkExistsMode; }
    onOpen(): void {
        this.origin = this.contentEl.ownerDocument.activeElement as HTMLElement | null;
        this.contentEl.classList.add('pv-note-edit', 'pv-edit-modal', 'pv-bulk-editor');
        this.modalEl.classList.add('pv-note-value-modal');
        this.containerEl.classList.add('pv-note-modal-container');
        this.body = this.contentEl.createDiv({ cls: 'pv-note-edit-scroll' });
        this.footer = this.contentEl.createDiv({ cls: 'pv-edit-actions' });
        const stop = fitModalViewport(this.containerEl), win = this.contentEl.ownerDocument.defaultView!;
        let frame: number | undefined;
        const reveal = () => { if (frame !== undefined)
            win.cancelAnimationFrame(frame); frame = win.requestAnimationFrame(() => { const active = this.contentEl.ownerDocument.activeElement; if (!active || !this.body.contains(active))
            return; const field = active.getBoundingClientRect(), area = this.body.getBoundingClientRect(); if (field.bottom > area.bottom)
            this.body.scrollTop += field.bottom - area.bottom;
        else if (field.top < area.top)
            this.body.scrollTop -= area.top - field.top; }); };
        this.body.addEventListener('focusin', reveal);
        win.visualViewport?.addEventListener('resize', reveal);
        win.visualViewport?.addEventListener('scroll', reveal);
        this.dispose = () => { stop(); if (frame !== undefined)
            win.cancelAnimationFrame(frame); this.body.removeEventListener('focusin', reveal); win.visualViewport?.removeEventListener('resize', reveal); win.visualViewport?.removeEventListener('scroll', reveal); };
        this.contentEl.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            this.primary?.click();
        } });
        this.refreshScope();
        this.render();
    }
    private refreshScope(): void { this.bulkScope = this.options.scope(this.recursive); this.choices = this.options.catalog(this.bulkScope.paths); }
    private button(parent: HTMLElement, text: string, run: () => void, primary = false): HTMLButtonElement {
        const button = parent.createEl('button', { text, attr: { type: 'button' } });
        if (primary) {
            button.classList.add('mod-cta');
            this.primary = button;
        }
        button.addEventListener('click', () => { if (!this.busy)
            run(); });
        return button;
    }
    private render(): void {
        if (this.closed)
            return;
        this.suggesters.forEach(s => s.close());
        this.suggesters = [];
        this.body.replaceChildren();
        this.footer.replaceChildren();
        this.primary = undefined;
        this.titleEl.textContent = this.screen === 'pick' ? 'Choose from existing properties' : this.screen === 'preview' ? 'Review changes' : this.screen === 'done' ? 'Changes complete' : this.screen === 'add' ? 'Add properties' : 'Remove properties';
        if (this.screen === 'add' || this.screen === 'remove')
            this.header();
        if (this.screen === 'add')
            this.addView();
        else if (this.screen === 'pick')
            this.pickView();
        else if (this.screen === 'remove')
            this.removeView();
        else if (this.screen === 'preview')
            this.previewView();
        else
            this.doneView();
        this.body.scrollTop = 0;
        this.body.querySelector<HTMLInputElement>('input:not([type=checkbox])')?.focus();
    }
    private header(): void {
        const scope = this.body.createDiv({ cls: 'pv-bulk-scope' });
        setIcon(scope.createSpan(), this.bulkScope.kind === 'tree' ? 'filter' : 'folder');
        scope.createSpan({ text: this.bulkScope.label });
        scope.createEl('strong', { text: `${this.bulkScope.paths.length} ${this.bulkScope.paths.length === 1 ? 'note' : 'notes'}` });
        if (this.bulkScope.includeSubfolders !== undefined) {
            const label = this.body.createEl('label', { cls: 'pv-scope-choice' }), toggle = label.createEl('input');
            toggle.type = 'checkbox';
            toggle.checked = this.recursive;
            toggle.setAttribute('aria-label', 'Include subfolders');
            label.createSpan({ text: 'Include subfolders' });
            toggle.addEventListener('change', () => { this.recursive = toggle.checked; this.refreshScope(); const present = new Set(this.choices.filter(c => c.inScope).map(c => fold(c.key))); this.selected = new Set([...this.selected].filter(key => present.has(key))); this.render(); });
        }
        if (this.bulkScope.kind === 'tree')
            this.body.createEl('p', { cls: 'pv-edit-hint', text: `The notes behind this ${this.bulkScope.treeProperty ? 'property' : 'value'}, with active filters applied.` });
        if (this.bulkScope.skippedExcluded)
            this.body.createEl('p', { cls: 'pv-edit-hint', text: `${this.bulkScope.skippedExcluded} notes in excluded folders are skipped.` });
        if (this.bulkScope.skippedNonMarkdown)
            this.body.createEl('p', { cls: 'pv-edit-hint', text: `${this.bulkScope.skippedNonMarkdown} non-Markdown files are skipped.` });
        if (!this.bulkScope.paths.length)
            this.body.createEl('p', { text: 'No notes to change.' });
    }
    private choice(key: string): PropertyChoice | undefined { return this.choices.find(c => fold(c.key) === fold(key)); }
    private addView(): void {
        const rowsEl = this.body.createDiv();
        const addButtons: HTMLButtonElement[] = [];
        const updateCap = () => addButtons.forEach(button => { button.disabled = this.rows.length >= 20; button.title = button.disabled ? 'You can add up to 20 properties at once.' : ''; });
        const rowViews = new Map<string, {
            name: HTMLInputElement;
            value: HTMLInputElement | HTMLSelectElement;
            error: HTMLElement;
        }>();
        const append = (row: AddRow) => {
            const wrapper = rowsEl.createDiv(), grid = wrapper.createDiv({ cls: 'pv-bulk-row' }), info = wrapper.createDiv({ cls: 'pv-bulk-info' }), error = wrapper.createDiv({ cls: 'pv-bulk-error' });
            error.id = `${row.id}-error`;
            error.setAttribute('role', 'alert');
            const type = this.button(grid, '', () => { const menu = new Menu(); for (const [key, label] of Object.entries(typeLabels))
                menu.addItem(item => item.setTitle(label).setIcon(typeIcons[key as AddRow['type']]).setChecked(row.type === key).onClick(() => { row.type = key as AddRow['type']; row.value = row.type === 'checkbox' ? 'true' : ''; renderValue(); updateInfo(); value.focus(); })); const rect = type.getBoundingClientRect(); menu.showAtPosition({ x: rect.left, y: rect.bottom }); });
            const name = grid.createEl('input');
            name.value = row.key;
            name.placeholder = 'Property name';
            name.setAttribute('aria-label', 'Property name');
            name.setAttribute('aria-describedby', error.id);
            const valueCell = grid.createDiv();
            let value: HTMLInputElement | HTMLSelectElement;
            let valueSuggester: BulkValueSuggest | undefined;
            const remove = this.button(grid, '×', () => { this.rows = this.rows.filter(item => item !== row); if (!this.rows.length)
                this.rows = [blank()]; this.render(); });
            remove.setAttribute('aria-label', 'Remove property row');
            const updateInfo = () => { const choice = this.choice(row.key); info.replaceChildren(); info.hidden = !row.key.trim(); if (!row.key.trim())
                return; if (!choice) {
                setIcon(info.createSpan(), 'plus');
                info.createSpan({ text: 'New property' });
            }
            else {
                info.createSpan({ text: `Already on ${choice.inScope} of ${this.bulkScope.paths.length} notes` });
                if (choice.type !== row.type)
                    info.createSpan({ cls: 'pv-warn', text: ` · Used as ${typeLabels[choice.type]} in ${choice.inScope} notes` });
                if (choice.mixed)
                    info.createSpan({ text: ' · Mixed types' });
            } };
            const renderValue = () => {
                valueSuggester?.close();
                valueCell.replaceChildren();
                setIcon(type, typeIcons[row.type]);
                type.setAttribute('aria-label', `Property type: ${typeLabels[row.type]}`);
                type.setAttribute('aria-haspopup', 'menu');
                type.title = typeLabels[row.type];
                if (row.type === 'checkbox') {
                    const select = valueCell.createEl('select');
                    for (const [key, label] of [['true', 'Checked'], ['false', 'Unchecked']])
                        select.createEl('option', { text: label }).value = key;
                    value = select;
                }
                else {
                    const input = valueCell.createEl('input');
                    input.type = row.type === 'list' ? 'text' : row.type === 'datetime' ? 'datetime-local' : row.type;
                    if (row.type === 'number')
                        input.step = 'any';
                    if (row.type === 'datetime')
                        input.step = '0.001';
                    if (row.type === 'date' || row.type === 'datetime')
                        input.min = row.type === 'date' ? '0001-01-01' : '0001-01-01T00:00';
                    input.placeholder = row.type === 'list' ? `a${this.options.settings.bulkListDelimiter} b${this.options.settings.bulkListDelimiter} c` : 'Value';
                    value = input;
                }
                value.value = row.value;
                value.setAttribute('aria-label', 'Value');
                value.setAttribute('aria-describedby', error.id);
                const changed = () => { row.value = value.value; error.textContent = ''; };
                value.addEventListener('input', changed);
                value.addEventListener('change', changed);
                if (row.type === 'text' || row.type === 'list') {
                    valueSuggester = new BulkValueSuggest(this.app, value as HTMLInputElement, () => this.choice(row.key) ? this.options.values(row.key, this.bulkScope.paths) : [], () => row.type === 'list' ? this.options.settings.bulkListDelimiter : undefined, changed);
                    this.suggesters.push(valueSuggester);
                }
                value.addEventListener('keydown', rawEvent => { const event = rawEvent as KeyboardEvent; if (event.defaultPrevented || valueSuggester?.opened)
                    return; if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && this.rows.at(-1) === row && !validateRows([row], this.options.settings.bulkListDelimiter).size && this.rows.length < 20) {
                    event.preventDefault();
                    const next = blank();
                    this.rows.push(next);
                    append(next);
                    updateCap();
                    rowViews.get(next.id)?.name.focus();
                } });
                rowViews.set(row.id, { name, value, error });
            };
            name.addEventListener('input', () => { row.key = name.value; error.textContent = ''; updateInfo(); });
            name.addEventListener('change', () => { const choice = this.choice(name.value); if (choice) {
                row.key = choice.key;
                name.value = choice.key;
            } updateInfo(); });
            const suggester = new BulkNameSuggest(this.app, name, () => this.choices, () => new Set(this.rows.filter(r => r !== row).map(r => fold(r.key))), choice => { row.key = choice.key; row.type = choice.type; row.value = row.type === 'checkbox' ? 'true' : ''; name.value = row.key; renderValue(); updateInfo(); value.focus(); });
            this.suggesters.push(suggester);
            renderValue();
            updateInfo();
        };
        for (const row of this.rows)
            append(row);
        const buttons = this.body.createDiv({ cls: 'pv-bulk-add-buttons' });
        addButtons.push(this.button(buttons, 'Add property', () => { const row = blank(); this.rows.push(row); append(row); updateCap(); rowViews.get(row.id)?.name.focus(); }));
        addButtons.push(this.button(buttons, 'Choose from existing', () => { this.picked.clear(); this.screen = 'pick'; this.render(); }));
        updateCap();
        this.body.createEl('p', { text: 'If a note already has the property' });
        const conflict = this.body.createDiv({ cls: 'pv-bulk-conflict', attr: { role: 'group', 'aria-label': 'If a note already has the property' } });
        for (const [key, text] of [['skip', 'Skip'], ['merge', 'Merge into list'], ['overwrite', 'Overwrite']] as const) {
            const button = this.button(conflict, text, () => { this.exists = key; for (const item of Array.from(conflict.querySelectorAll('button')))
                item.setAttribute('aria-pressed', String(item === button)); });
            button.setAttribute('aria-pressed', String(this.exists === key));
        }
        this.body.createEl('p', { cls: 'pv-edit-hint', text: 'Merge into list combines text and list values into one list. Other types are overwritten.' });
        this.button(this.footer, 'Cancel', () => this.close());
        const primary = this.button(this.footer, 'Preview changes', () => {
            const errors = validateRows(this.rows, this.options.settings.bulkListDelimiter);
            for (const row of this.rows) {
                const view = rowViews.get(row.id)!;
                view.error.textContent = errors.get(row.id) ?? '';
                view.name.removeAttribute('aria-invalid');
                view.value.removeAttribute('aria-invalid');
            }
            if (errors.size) {
                const row = this.rows.find(r => errors.has(r.id))!, view = rowViews.get(row.id)!;
                const parsed = parseValue(row.type, row.value, this.options.settings.bulkListDelimiter);
                const field = !row.key.trim() || errors.get(row.id) === 'Already listed above' || errors.get(row.id)?.includes('not supported') || parsed.ok ? view.name : view.value;
                field.setAttribute('aria-invalid', 'true');
                field.focus();
                return;
            }
            const rows = this.rows.map(row => ({ ...row, key: this.choice(row.key)?.key ?? row.key.trim() }));
            this.plan = this.options.preview(this.bulkScope.paths, { rows, exists: this.exists, delimiter: this.options.settings.bulkListDelimiter });
            this.screen = 'preview';
            this.render();
        }, true);
        primary.disabled = !this.bulkScope.paths.length;
    }
    private filterInput(value: string, changed: (value: string) => void): HTMLInputElement { const input = this.body.createEl('input', { cls: 'pv-bulk-filter' }); input.type = 'search'; input.placeholder = 'Filter properties'; input.setAttribute('aria-label', 'Filter properties'); input.value = value; input.addEventListener('input', () => changed(input.value)); return input; }
    private pickView(): void {
        this.filterInput(this.pickFilter, value => { this.pickFilter = value; renderList(); });
        this.body.createEl('p', { text: this.bulkScope.kind === 'tree' ? 'Properties used in this view' : 'Properties used in this vault' });
        const list = this.body.createDiv({ cls: 'pv-bulk-choice-list' }), message = this.body.createDiv({ cls: 'pv-bulk-error' });
        const count = this.footer.createSpan();
        this.button(this.footer, 'Cancel', () => { this.screen = 'add'; this.render(); });
        const confirm = this.button(this.footer, 'Add 0 properties', () => {
            this.rows = this.rows.filter(row => row.key.trim() || row.value.trim());
            const added = this.choices.filter(c => this.picked.has(fold(c.key)));
            for (const choice of added)
                this.rows.push({ ...blank(), key: choice.key, type: choice.type, value: choice.type === 'checkbox' ? 'true' : '' });
            this.screen = 'add';
            this.render();
            const position = this.rows.length - added.length;
            this.body.querySelectorAll<HTMLElement>('[aria-label="Value"]')[position]?.focus();
        }, true);
        const update = () => { count.textContent = `${this.picked.size} selected`; confirm.textContent = `Add ${this.picked.size} ${this.picked.size === 1 ? 'property' : 'properties'}`; confirm.disabled = !this.picked.size; };
        const renderList = () => {
            list.replaceChildren();
            const used = new Set(this.rows.map(r => fold(r.key))), occupied = this.rows.filter(row => row.key.trim() || row.value.trim()).length;
            for (const choice of this.choices.filter(c => fold(c.key).includes(fold(this.pickFilter)))) {
                const key = fold(choice.key), added = used.has(key), label = list.createEl('label', { cls: 'pv-bulk-choice' }), check = label.createEl('input');
                check.type = 'checkbox';
                check.checked = added || this.picked.has(key);
                check.disabled = added || !!choice.disabledReason;
                check.setAttribute('aria-label', `Choose ${choice.key}`);
                label.createEl('strong', { text: choice.key });
                setIcon(label.createSpan(), typeIcons[choice.type]);
                label.createEl('small', { text: choice.disabledReason ?? (added ? 'Added' : `${choice.inScope} of ${this.bulkScope.paths.length}`) });
                check.addEventListener('change', () => { if (check.checked && occupied + this.picked.size >= 20) {
                    check.checked = false;
                    message.textContent = 'You can add up to 20 properties at once.';
                    return;
                } if (check.checked)
                    this.picked.add(key);
                else
                    this.picked.delete(key); message.textContent = ''; update(); });
            }
            update();
        };
        renderList();
    }
    private removeView(): void {
        this.filterInput(this.filter, value => { this.filter = value; renderList(); });
        const selectAll = this.button(this.body, 'Select all', () => { for (const c of visible())
            if (!c.disabledReason)
                this.selected.add(fold(c.key)); renderList(); });
        this.body.createEl('p', { text: 'Properties found in these notes' });
        const list = this.body.createDiv({ cls: 'pv-bulk-choice-list' }), error = this.body.createDiv({ cls: 'pv-bulk-error' });
        const count = this.footer.createSpan();
        this.button(this.footer, 'Cancel', () => this.close());
        const primary = this.button(this.footer, 'Preview changes', () => { if (!this.selected.size) {
            error.textContent = 'Select at least one property';
            list.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus();
            return;
        } this.plan = this.options.preview(this.bulkScope.paths, { keys: this.choices.filter(c => this.selected.has(fold(c.key))).map(c => c.key) }); this.screen = 'preview'; this.render(); }, true);
        primary.disabled = !this.bulkScope.paths.length;
        const visible = () => this.choices.filter(c => c.inScope && fold(c.key).includes(fold(this.filter))).sort((a, b) => b.inScope - a.inScope || natural(a.key, b.key));
        const renderList = () => { list.replaceChildren(); selectAll.textContent = this.filter ? 'Select shown' : 'Select all'; for (const c of visible()) {
            const label = list.createEl('label', { cls: 'pv-bulk-choice' }), check = label.createEl('input');
            check.type = 'checkbox';
            check.checked = this.selected.has(fold(c.key));
            check.disabled = !!c.disabledReason;
            check.setAttribute('aria-label', `Remove ${c.key}`);
            label.createEl('strong', { text: c.key });
            setIcon(label.createSpan(), typeIcons[c.type]);
            label.createEl('small', { text: c.disabledReason ?? `${c.inScope} of ${this.bulkScope.paths.length}` });
            check.addEventListener('change', () => { if (check.checked)
                this.selected.add(fold(c.key));
            else
                this.selected.delete(fold(c.key)); count.textContent = `${this.selected.size} selected`; error.textContent = ''; });
        } if (!visible().length)
            list.createEl('p', { text: 'No properties match' }); count.textContent = `${this.selected.size} selected`; };
        renderList();
    }
    private previewView(): void {
        const plan = this.plan!, changed = plan.notes.filter(n => n.changes.length);
        const summary = this.body.createDiv({ cls: 'pv-bulk-summary' });
        for (const key of plan.keys) {
            const changes = plan.notes.flatMap(n => n.changes).filter(c => fold(c.key) === fold(key));
            const skipped = plan.notes.flatMap(n => n.skipped).filter(s => fold(s.key) === fold(key));
            const count = (action: string) => changes.filter(c => c.action === action).length;
            let text = plan.mode === 'remove' ? (changes.length ? `Remove ${key} from ${changes.length} notes` : `No notes have ${key}, nothing to remove`) : `Add ${key} to ${count('add')} notes`;
            if (count('merge'))
                text += `, merge into ${count('merge')} that already have it`;
            if (count('overwrite'))
                text += `, overwrite ${count('overwrite')} that already have it`;
            const converted = changes.filter(c => c.action === 'merge' && typeof c.before === 'string').length;
            if (converted)
                text += `, ${converted} become lists`;
            const already = skipped.filter(s => s.reason === 'already-has').length, ambiguous = skipped.filter(s => s.reason === 'ambiguous-key').length;
            if (already)
                text += `, skip ${already} that already have it`;
            if (ambiguous)
                text += `, skip ${ambiguous} with duplicate keys`;
            summary.createEl('p', { text });
        }
        if (changed.length > 200)
            this.body.createEl('p', { text: `This changes ${changed.length} notes. You can undo the last batch until the plugin reloads.` });
        const list = this.body.createDiv();
        let shown = 0;
        const remaining = this.body.createEl('p', { cls: 'pv-edit-hint' });
        const more = this.button(this.body, 'Show more', () => show());
        const show = () => { for (const note of changed.slice(shown, shown + 20)) {
            const entry = list.createDiv({ cls: 'pv-edit-change' }), slash = note.path.lastIndexOf('/');
            entry.createEl('strong', { text: note.path.slice(slash + 1).replace(/\.md$/i, '') });
            entry.createEl('small', { text: slash < 0 ? '' : note.path.slice(0, slash) });
            for (const c of note.changes) {
                if (c.existed)
                    entry.createDiv({ cls: 'pv-bulk-diff-remove', text: c.action === 'remove' ? `− ${c.key}` : `− ${c.key}: ${displayValue(c.before)}` });
                if (c.action !== 'remove')
                    entry.createDiv({ cls: 'pv-bulk-diff-add', text: `+ ${c.key}: ${displayValue(c.after)}` });
            }
        } shown = Math.min(shown + 20, changed.length); more.hidden = shown >= changed.length; remaining.textContent = shown < changed.length ? `and ${changed.length - shown} more notes` : ''; };
        show();
        const issues = plan.notes.filter(n => n.error || n.skipped.some(s => s.reason !== 'already-has'));
        if (issues.length) {
            const details = this.body.createEl('details');
            details.createEl('summary', { text: `${issues.length} notes with issues` });
            for (const n of issues.slice(0, 100))
                details.createEl('p', { text: `${n.path}: ${n.error ?? n.skipped.map(s => `${s.key}: ${s.reason}`).join('; ')}` });
            if (issues.length > 100)
                details.createEl('p', { text: 'Showing the first 100 notes with issues.' });
        }
        this.button(this.footer, 'Back', () => { this.screen = this.options.mode; this.render(); });
        this.button(this.footer, changed.length ? `${plan.mode === 'add' ? 'Add to' : 'Remove from'} ${changed.length} ${changed.length === 1 ? 'note' : 'notes'}` : 'Nothing to change', () => { void this.apply(); }, true).disabled = !changed.length;
    }
    private async apply(): Promise<void> {
        this.busy = true;
        this.suggesters.forEach(s => s.close());
        this.footer.querySelectorAll('button').forEach(b => { b.disabled = true; });
        try {
            this.results = await this.options.apply(this.plan!, (done, total) => { if (total > 50 && this.primary)
                this.primary.textContent = `Updating ${done} of ${total}…`; });
            this.screen = 'done';
        }
        catch (error) {
            new Notice(error instanceof Error ? error.message : String(error));
        }
        finally {
            this.busy = false;
            this.render();
        }
    }
    private doneView(): void {
        const updated = this.results.filter(n => n.changes.length).length;
        this.body.createEl('p', { cls: 'pv-bulk-success', text: `Updated ${updated} notes` });
        this.body.createEl('p', { cls: 'pv-edit-hint', text: this.options.canUndo() ? 'One undo step is available until the plugin reloads. YAML comments and quoting may change.' : 'No changes were written by this batch.' });
        const issues = this.results.filter(n => n.error || n.skipped.length);
        if (issues.length) {
            const details = this.body.createEl('details');
            details.createEl('summary', { text: `Skipped or failed: ${issues.length} notes` });
            const list = details.createDiv();
            let shown = 0;
            const more = this.button(details, 'Show more', () => show());
            const show = () => { for (const n of issues.slice(shown, shown + 10))
                list.createEl('p', { text: `${n.path}: ${n.error ?? n.skipped.map(s => `${s.key}: ${s.reason}`).join('; ')}` }); shown += 10; more.hidden = shown >= issues.length; };
            show();
        }
        const message = this.body.createEl('p', { attr: { 'aria-live': 'polite' } });
        const undo = this.button(this.footer, 'Undo', () => { this.busy = true; undo.disabled = true; void this.options.undo().then(result => { message.textContent = `Restored ${result.restored} notes; skipped ${result.skipped}; ${result.failures.length} failed.`; }).catch(error => { message.textContent = String(error); }).finally(() => { this.busy = false; undo.disabled = !this.options.canUndo(); }); });
        undo.disabled = !this.options.canUndo();
        this.button(this.footer, 'Close', () => this.close(), true);
    }
    onClose(): void { this.closed = true; this.dispose?.(); this.suggesters.forEach(s => s.close()); this.contentEl.replaceChildren(); if (this.origin?.isConnected)
        this.origin.focus(); }
}
