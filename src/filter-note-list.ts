// SPDX-License-Identifier: MIT
import { Keymap, Notice, setIcon, type App } from 'obsidian';
import { natural } from './index';

interface NoteRow { path: string; name: string; folder: string }
let nextListId = 0;
const batchSize = 200;

export function noteRows(paths: ReadonlySet<string>): NoteRow[] {
  return [...paths].map(path => {
    const slash = path.lastIndexOf('/');
    return { path, name: path.slice(slash + 1).replace(/\.md$/i, ''), folder: slash < 0 ? '' : path.slice(0, slash) };
  }).sort((a, b) => natural(a.name, b.name) || a.path.localeCompare(b.path));
}

/** Read-only disclosure for the current filter. It never participates in tree selection. */
export class FilterNoteList {
  readonly toggle: HTMLButtonElement;
  private count: HTMLElement;
  private icon: HTMLElement;
  private paths: ReadonlySet<string> = new Set();
  private open = false;
  private limit = batchSize;

  constructor(private app: App, bar: HTMLElement, private panel: HTMLElement,
    private clear: HTMLButtonElement, private hoverParent: unknown, private source: string) {
    panel.id = `pv-filter-notes-${++nextListId}`;
    panel.hidden = true;
    this.toggle = bar.createEl('button', { cls: 'pv-filter-toggle' });
    this.toggle.type = 'button';
    bar.insertBefore(this.toggle, clear);
    this.toggle.setAttribute('aria-controls', panel.id);
    this.count = this.toggle.createSpan();
    this.icon = this.toggle.createSpan({ cls: 'pv-icon' });
    this.icon.setAttribute('aria-hidden', 'true');
    this.toggle.addEventListener('click', () => {
      this.open = !this.open;
      this.render();
    });
    this.toggle.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' && this.paths.size) {
        event.preventDefault(); event.stopPropagation();
        this.open = true; this.render(); this.buttons()[0]?.focus();
      } else if (event.key === 'Escape' && this.open) this.collapse(event);
    });
    panel.addEventListener('keydown', event => {
      if (event.key === 'Escape') this.collapse(event);
    });
  }

  reset(): void { this.open = false; this.limit = batchSize; this.panel.scrollTop = 0; }

  update(paths: ReadonlySet<string> | null, preserveOpenWhenEmpty = false): void {
    if (!paths?.size && !preserveOpenWhenEmpty) this.reset();
    this.paths = paths ?? new Set();
    this.render();
  }

  private buttons(): HTMLButtonElement[] { return Array.from(this.panel.querySelectorAll<HTMLButtonElement>('.pv-filter-note')); }

  private collapse(event: KeyboardEvent): void {
    event.preventDefault(); event.stopPropagation();
    this.open = false; this.render(); this.toggle.focus({ preventScroll: true });
  }

  private openNote(path: string, event: MouseEvent | KeyboardEvent): void {
    const file = this.app.vault.getFileByPath(path);
    if (!file) return;
    void this.app.workspace.getLeaf(Keymap.isModEvent(event)).openFile(file)
      .catch(() => new Notice('Could not open this note. It may have been moved or deleted.'));
  }

  private render(): void {
    const active = this.panel.ownerDocument.activeElement as HTMLElement | null;
    const hadFocus = !!active && this.panel.contains(active);
    const oldButtons = this.buttons();
    const oldIndex = oldButtons.findIndex(button => button === active);
    const activePath = active?.dataset.path;
    const moreFocused = active?.classList.contains('pv-filter-note-more-button');
    const scroll = this.panel.scrollTop;
    const n = this.paths.size;
    this.count.textContent = `${n} ${n === 1 ? 'note' : 'notes'}`;
    this.toggle.disabled = n === 0;
    this.toggle.setAttribute('aria-expanded', String(this.open && n > 0));
    this.toggle.setAttribute('aria-label', `${this.open ? 'Hide' : 'Show'} ${n} filtered ${n === 1 ? 'note' : 'notes'}`);
    this.toggle.title = this.open ? 'Hide matching notes' : 'Show matching notes';
    setIcon(this.icon, this.open ? 'chevron-up' : 'chevron-down');
    this.panel.hidden = !this.open || !n;
    this.panel.parentElement?.classList.toggle('pv-filter-notes-open', !this.panel.hidden);
    this.panel.replaceChildren();
    if (this.panel.hidden) {
      if (hadFocus || (active === this.toggle && !n)) (n ? this.toggle : this.clear).focus({ preventScroll: true });
      return;
    }
    // Sorting and DOM creation are skipped entirely while collapsed.
    const rows = noteRows(this.paths).slice(0, this.limit);
    const ul = this.panel.createEl('ul', { cls: 'pv-filter-note-list' });
    ul.setAttribute('aria-label', 'Notes matching the value filter');
    for (const row of rows) {
      const li = ul.createEl('li');
      const button = li.createEl('button', { cls: 'pv-filter-note' });
      button.type = 'button'; button.dataset.path = row.path; button.title = row.path;
      button.setAttribute('aria-label', `Open ${row.name}${row.folder ? ` in ${row.folder}` : ''}`);
      const icon = button.createSpan({ cls: 'pv-icon' }); icon.setAttribute('aria-hidden', 'true'); setIcon(icon, 'file-text');
      button.createSpan({ cls: 'pv-filter-note-name', text: row.name });
      if (row.folder) button.createSpan({ cls: 'pv-filter-note-folder', text: row.folder });
      button.addEventListener('click', event => this.openNote(row.path, event));
      button.addEventListener('auxclick', event => { if (event.button === 1) { event.preventDefault(); this.openNote(row.path, event); } });
      button.addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); this.openNote(row.path, event); return; }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const buttons = this.buttons(), index = buttons.indexOf(button);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : index + (event.key === 'ArrowDown' ? 1 : -1);
        buttons[Math.max(0, Math.min(buttons.length - 1, next))]?.focus();
      });
      button.addEventListener('pointerenter', event => {
        if (event.pointerType !== 'mouse' || button.ownerDocument.body.classList.contains('is-mobile')) return;
        this.app.workspace.trigger('hover-link', { event, source: this.source, hoverParent: this.hoverParent, targetEl: button, linktext: row.path, sourcePath: '' });
      });
    }
    if (n > rows.length) {
      const footer = this.panel.createDiv({ cls: 'pv-filter-note-more' });
      footer.createSpan({ text: `Showing ${rows.length} of ${n} notes` });
      const more = footer.createEl('button', { cls: 'pv-filter-note-more-button', text: `Show ${Math.min(batchSize, n - rows.length)} more` });
      more.type = 'button';
      more.addEventListener('click', () => {
        const firstNew = rows.length;
        this.limit += batchSize; this.render(); this.buttons()[firstNew]?.focus();
      });
    }
    this.panel.scrollTop = scroll;
    if (hadFocus) {
      const buttons = this.buttons();
      const target = buttons.find(button => button.dataset.path === activePath)
        ?? (moreFocused ? this.panel.querySelector<HTMLButtonElement>('.pv-filter-note-more-button') : null)
        ?? buttons[moreFocused ? buttons.length - 1 : Math.max(0, Math.min(oldIndex, buttons.length - 1))];
      target?.focus({ preventScroll: true });
    }
  }
}
