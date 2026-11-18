// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => ({
  Keymap: { isModEvent: (e: MouseEvent) => e.ctrlKey || e.metaKey || e.button === 1 ? (e.altKey ? 'split' : 'tab') : false },
  Notice: class {}, setIcon: (el: HTMLElement, name: string) => el.dataset.icon = name
}));
import { FilterNoteList, noteRows } from '../src/filter-note-list';
let list: FilterNoteList, panel: HTMLElement, bar: HTMLElement, clear: HTMLButtonElement, app: any, openFile: any;
beforeEach(() => {
  document.body.replaceChildren(); document.body.classList.remove('is-mobile');
  bar = document.body.createDiv(); panel = document.body.createDiv(); clear = bar.createEl('button');
  openFile = vi.fn().mockResolvedValue(undefined);
  app = { vault: { getFileByPath: vi.fn(path => ({ path })) }, workspace: { getLeaf: vi.fn(() => ({ openFile })), trigger: vi.fn() } };
  list = new FilterNoteList(app, bar, panel, clear, {}, 'supercharged-properties');
});
const paths = () => new Set(['Work/Note 10.md', 'Home/Note 2.md', 'Work/Note 2.md']);
const rows = () => [...panel.querySelectorAll<HTMLButtonElement>('.pv-filter-note')];
it('starts collapsed, sorts names numerically and distinguishes folders with safe text', () => {
  list.update(paths()); expect(panel.hidden).toBe(true); expect(rows()).toHaveLength(0);
  expect(list.toggle.textContent).toContain('3 notes'); list.toggle.click();
  expect(rows().map(r => r.dataset.path)).toEqual(['Home/Note 2.md', 'Work/Note 2.md', 'Work/Note 10.md']);
  expect(rows()[0].getAttribute('aria-label')).toBe('Open Note 2 in Home');
  expect(list.toggle.getAttribute('aria-expanded')).toBe('true');
  list.update(new Set(['<img src=x onerror=alert(1)>.md']));
  expect(rows()[0].textContent).toContain('<img'); expect(panel.querySelector('img')).toBeNull();
});
it('parses root paths and preserves other extensions', () => {
  expect(noteRows(new Set(['Root.md', 'Folder/File.txt']))).toEqual([{path:'Folder/File.txt',name:'File.txt',folder:'Folder'}, {path:'Root.md',name:'Root',folder:''}]);
});
it('loads notes in batches of 200 without losing access to later notes', () => {
  list.update(new Set(Array.from({length:450}, (_,i) => `Note ${i}.md`))); list.toggle.click();
  expect(rows()).toHaveLength(200); expect(panel.textContent).toContain('Showing 200 of 450 notes');
  (panel.querySelector('.pv-filter-note-more-button') as HTMLElement).click();
  expect(rows()).toHaveLength(400); expect(document.activeElement).toBe(rows()[200]);
  (panel.querySelector('.pv-filter-note-more-button') as HTMLElement).click(); expect(rows()).toHaveLength(450);
  expect(panel.querySelector('.pv-filter-note-more-button')).toBeNull();
});
it('opens existing files using native modifiers and does nothing for stale paths', () => {
  list.update(paths()); list.toggle.click(); rows()[0].click();
  expect(app.workspace.getLeaf).toHaveBeenLastCalledWith(false);
  rows()[0].dispatchEvent(new MouseEvent('click', {metaKey:true})); expect(app.workspace.getLeaf).toHaveBeenLastCalledWith('tab');
  rows()[0].dispatchEvent(new MouseEvent('click', {ctrlKey:true, altKey:true})); expect(app.workspace.getLeaf).toHaveBeenLastCalledWith('split');
  expect(openFile).toHaveBeenCalledTimes(3);
  app.vault.getFileByPath.mockReturnValue(null); rows()[0].click(); expect(openFile).toHaveBeenCalledTimes(3);
});
it('preserves focus and scroll through updates and focuses the nearest row on removal', () => {
  list.update(paths()); list.toggle.click(); rows()[1].focus(); panel.scrollTop=30;
  list.update(paths()); expect(document.activeElement).toBe(rows()[1]); expect(panel.scrollTop).toBe(30);
  list.update(new Set(['Home/Note 2.md','Work/Note 10.md'])); expect(document.activeElement).toBe(rows()[1]);
  list.update(new Set()); expect(panel.hidden).toBe(true); expect(list.toggle.disabled).toBe(true); expect(document.activeElement).toBe(clear);
  list.update(paths()); expect(panel.hidden).toBe(true);
});
it('supports arrows, Home/End and Escape without affecting tree selection', () => {
  list.update(paths()); list.toggle.click();
  list.toggle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})); expect(document.activeElement).toBe(rows()[0]);
  rows()[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})); expect(document.activeElement).toBe(rows()[1]);
  rows()[1].dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true})); expect(document.activeElement).toBe(rows()[2]);
  rows()[2].dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); expect(panel.hidden).toBe(true); expect(document.activeElement).toBe(list.toggle);
});
it('resets when the filter is replaced and assigns unique panel ids', () => {
  list.update(paths()); list.toggle.click(); list.reset(); list.update(paths()); expect(panel.hidden).toBe(true);
  const otherPanel=document.body.createDiv(); const other=new FilterNoteList(app,bar,otherPanel,clear,{},'supercharged-properties');
  expect(list.toggle.getAttribute('aria-controls')).toBe(panel.id); expect(otherPanel.id).not.toBe(panel.id);
});
it('emits hover preview only for mouse input outside mobile', () => {
  list.update(paths()); list.toggle.click();
  rows()[0].dispatchEvent(Object.assign(new Event('pointerenter'),{pointerType:'touch'})); expect(app.workspace.trigger).not.toHaveBeenCalled();
  rows()[0].dispatchEvent(Object.assign(new Event('pointerenter'),{pointerType:'mouse'}));
  expect(app.workspace.trigger).toHaveBeenCalledWith('hover-link',expect.objectContaining({linktext:'Home/Note 2.md',source:'supercharged-properties'}));
  document.body.classList.add('is-mobile');rows()[0].dispatchEvent(Object.assign(new Event('pointerenter'),{pointerType:'mouse'}));expect(app.workspace.trigger).toHaveBeenCalledTimes(1);
});

it('opens from Enter with modifiers and keeps the list expanded', () => {
  list.update(paths()); list.toggle.click();
  rows()[0].dispatchEvent(new KeyboardEvent('keydown', {key:'Enter',ctrlKey:true,bubbles:true}));
  expect(app.workspace.getLeaf).toHaveBeenCalledWith('tab'); expect(openFile).toHaveBeenCalledOnce();
  expect(panel.hidden).toBe(false);
});
