// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => ({
  AbstractInputSuggest: class {close(){}}, TFolder: class {},
  Modal: class {},
  FuzzySuggestModal: class { static last:any; constructor(){(this.constructor as any).last=this;} setPlaceholder(){} open(){(globalThis as any).folderSuggester=this;} },
  ItemView: class { contentEl = document.createElement('div'); app: unknown; constructor(leaf: any) { this.app = leaf.app; } },
  Menu: class {
    static items: any[] = [];
    constructor() { (this.constructor as any).items = []; }
    addItem(callback: any) {
      const item: any = { setTitle(title: string) { this.title = title; return this; }, setIcon() { return this; }, setChecked() { return this; }, onClick(run: any) { this.run = run; return this; } };
      callback(item); (this.constructor as any).items.push(item); return this;
    }
    showAtMouseEvent() {}
    showAtPosition() {}
  },
  Plugin: class {}, PluginSettingTab: class {}, Setting: class {},
  TFile: class {},
  Notice: class { static messages: string[] = []; constructor(message: string) { (this.constructor as any).messages.push(message); } },
  normalizePath: (path: string) => path.replaceAll('\\', '/'),
  setIcon: (element: HTMLElement, icon: string) => element.dataset.icon = icon
}));
import { PropertiesView } from '../src/main';
import { PropertyIndex } from '../src/index';
import { TFile, Menu, Notice } from 'obsidian';
let plugin: any;
let view: PropertiesView;
let openFile: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  document.body.replaceChildren();
  (Notice as any).messages = [];
  const index = new PropertyIndex();
  index.update('Projects/One.md', { status: 'Done', tags: ['work', 'personal'] });
  index.update('Two.md', { status: 'Pending' });
  plugin = {
    index,
    prefs: { counts: true, sort: 'name', hidden: '', expanded: [], pinned: [], scope: null, profiles: [], activeProfile: null },
    typeResolver: {
      typeFor: (property: { id: string }) => property.id === 'tags' ? 'tags' : 'text',
      iconFor: (property: { id: string }) => property.id === 'tags' ? 'tags' : 'text'
    },
    refresh: vi.fn(), rebuild: vi.fn(), save: vi.fn()
  };
  openFile = vi.fn().mockResolvedValue(undefined);
  const app = { vault: { getAbstractFileByPath: () => new TFile(), getFolderByPath: (path:string) => ['Projects','Books','Books/Sub','Other'].includes(path)?{path}:null, getAllFolders: () => ['/', 'Projects', 'Books', 'Books/Sub', 'Other', 'Templates', 'Templates/Sub'].map(path=>({path})) }, workspace: { getLeaf: () => ({ openFile }) } };
  view = new PropertiesView({ app } as any, plugin);
  document.body.appendChild(view.contentEl);
  await view.onOpen();
});
afterEach(async () => { await view.onClose(); document.body.classList.remove('is-mobile'); });
const click = (label: string) => (document.querySelector(`[aria-label="${label}"]`) as HTMLElement).click();
it('uses a single property tree and expands notes inline', () => {
  expect(document.querySelector('.pv-results')).toBeNull();
  click('Expand status'); click('Show notes with status: Done (1)');
  expect(document.querySelector('.pv-values .pv-notes .pv-file')!.textContent).toContain('One');
  (document.querySelector('.pv-file') as HTMLElement).click(); expect(openFile).toHaveBeenCalledOnce();
});
it('shows a type icon before each property label but not value rows', () => {
  const tags = document.querySelector('[aria-label="Toggle tags (1)"]') as HTMLElement;
  const icon = tags.querySelector('.pv-type-icon') as HTMLElement;
  expect(tags.firstElementChild).toBe(icon);
  expect(icon.dataset.icon).toBe('tags');
  expect(icon.title).toBe('Type: tags');
  expect(icon.getAttribute('aria-hidden')).toBe('true');
  const status = document.querySelector('[aria-label="Toggle status (2)"]') as HTMLElement;
  expect((status.querySelector('.pv-type-icon') as HTMLElement).dataset.icon).toBe('text');
  click('Expand status');
  expect(document.querySelectorAll('.pv-value-group .pv-type-icon')).toHaveLength(0);
});
it('scopes the browser to selected properties, including none and all', () => {
  click('Choose properties to show'); click('Clear property selection');
  expect(document.querySelector('.pv-tree')!.textContent).toContain('Choose properties');
  click('Include status'); expect(plugin.prefs.scope).toEqual(['status']);
  expect(document.querySelector('.pv-tree')!.textContent).not.toContain('tags');
  click('Show all properties'); expect(plugin.prefs.scope).toBeNull();
  expect(document.querySelector('.pv-tree')!.textContent).toContain('tags');
});
it('filters notes by path and automatically reveals the matching branch', () => {
  click('Toggle search'); click('Search in: Search everything');
  (Menu as any).items.find((item: any) => item.title === 'Note names / paths').run();
  const input = document.querySelector('input')!; input.value = 'Projects/'; input.dispatchEvent(new Event('input'));
  expect(document.querySelector('.pv-tree')!.textContent).toContain('One');
  expect(document.querySelector('.pv-tree')!.textContent).not.toContain('Pending');
  expect(document.querySelectorAll('.pv-file').length).toBeGreaterThan(0);
});
it('updates the expanded note branch after edits/deletion', () => {
  click('Expand status'); click('Show notes with status: Pending (1)');
  plugin.index.remove('Two.md'); view.render();
  expect(document.querySelector('.pv-tree')!.textContent).not.toContain('Pending');
  expect(document.querySelectorAll('.pv-file')).toHaveLength(0);
});
it('keeps refresh, pinning, hiding, and keyboard menus usable', () => {
  click('Refresh property index'); expect(plugin.rebuild).toHaveBeenCalledOnce();
  const button = document.querySelector('[aria-label="Toggle tags (1)"]') as HTMLElement;
  button.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true }));
  (Menu as any).items.find((item: any) => item.title === 'Pin property').run();
  expect(document.querySelector('.pv-node')!.textContent).toContain('tags');
  (document.querySelector('.pv-node') as HTMLElement).dispatchEvent(new MouseEvent('contextmenu'));
  (Menu as any).items.find((item: any) => item.title === 'Hide property').run();
  expect(document.querySelector('.pv-tree')!.textContent).not.toContain('tags');
});
it('opens native Search from a row menu', async () => {
  const setQuery = vi.fn(); const leaf = { view: { setQuery } };
  (view as any).app.workspace = { getLeavesOfType: () => [leaf], revealLeaf: vi.fn() };
  (document.querySelector('[aria-label="Toggle status (2)"]') as HTMLElement).dispatchEvent(new MouseEvent('contextmenu'));
  (Menu as any).items.find((item: any) => item.title === 'Open in Search').run();
  await Promise.resolve(); expect(setQuery).toHaveBeenCalledWith('["status"]');
});
it('removes a new leaf and explains when Search is unavailable', async () => {
  const detach = vi.fn();
  const leaf = { view: {}, setViewState: vi.fn().mockRejectedValue(new Error('missing view')), detach };
  (view as any).app.workspace = { getLeavesOfType: () => [], getLeftLeaf: () => leaf, revealLeaf: vi.fn() };
  (document.querySelector('[aria-label="Toggle status (2)"]') as HTMLElement).dispatchEvent(new MouseEvent('contextmenu'));
  (Menu as any).items.find((item: any) => item.title === 'Open in Search').run();
  await vi.waitFor(() => expect(detach).toHaveBeenCalledOnce());
  expect((Notice as any).messages).toContain('Enable the Search core plugin to use Open in Search.');
});
it.each([
  ['Search everything', 'Done'], ['Property names', 'status'],
  ['Values', 'Done'], ['Note names / paths', 'Projects/']
])('preserves YAML search and saved view on collapse/expand: %s', (mode, query) => {
  plugin.prefs.scope=['status'];plugin.prefs.activeProfile='saved';
  plugin.prefs.profiles=[{id:'saved',name:'Saved',keys:['status']}];
  plugin.prefs.expanded=['status','tags'];view.render();
  checkSearchCollapse(mode,query);
  expect(plugin.prefs.scope).toEqual(['status']);expect(plugin.prefs.activeProfile).toBe('saved');
  expect(plugin.prefs.expanded).toEqual(['status','tags']);
});
it.each([
  ['Search everything', 'AJ'], ['Property names', 'author'],
  ['Values', 'AJ'], ['Note names / paths', 'Inline']
])('preserves inline search and saved view on collapse/expand: %s', (mode, query) => {
  enableInlineView();click('Choose properties to show');click('Clear property selection');click('Include author');
  nameProfile('Authors');click('Save selection as new profile');
  const saved=structuredClone(plugin.prefs.inlineViews);
  checkSearchCollapse(mode,query);
  expect(plugin.prefs.inlineViews).toEqual(saved);
});
function checkSearchCollapse(mode: string, query: string) {
  click('Toggle search');click('Search in: Search everything');
  (Menu as any).items.find((item:any)=>item.title===mode).run();
  const input=document.querySelector<HTMLInputElement>('[aria-label="Filter properties and values"]')!;
  input.value=query;input.dispatchEvent(new Event('input'));
  const before=document.querySelector('.pv-tree')!.textContent;
  expect(document.querySelectorAll('.pv-values')).toHaveLength(1);
  click('Collapse all properties');
  expect(input.value).toBe(query);expect(document.querySelectorAll('.pv-values')).toHaveLength(0);
  expect(document.querySelectorAll('.pv-property-row')).toHaveLength(1);
  view.render();expect(document.querySelectorAll('.pv-values')).toHaveLength(0);
  click('Expand all properties');
  if (mode !== 'Note names / paths') expect(document.querySelector('.pv-tree')!.textContent).toBe(before);
  else { expect(document.querySelectorAll('.pv-values')).toHaveLength(1); expect(document.querySelectorAll('.pv-file')).toHaveLength(0); }
  click('Collapse all properties');input.value=query.slice(0,-1);input.dispatchEvent(new Event('input'));
  expect(document.querySelectorAll('.pv-values')).toHaveLength(1);
}
it('keeps value filters and hidden branch expansion when collapsing', () => {
  plugin.prefs.expanded=['status','tags'];plugin.prefs.scope=['status'];view.render();
  click('Collapse all properties');expect(plugin.prefs.expanded).toEqual(['tags']);
  chooseView('all');click('Expand status');filterValue('Show notes with status: Done (1)');
  click('Toggle search');const input=document.querySelector<HTMLInputElement>('[aria-label="Filter properties and values"]')!;
  input.value='work';input.dispatchEvent(new Event('input'));
  const label=document.querySelector('.pv-filter-label')!.textContent;
  click('Collapse all properties');expect(input.value).toBe('work');
  click('Expand all properties');expect(document.querySelector('.pv-filter-label')!.textContent).toBe(label);
  expect(document.querySelector('.pv-summary')!.textContent).toContain('Filtered (1 note)');
});
it('renders property text without interpreting HTML', () => {
  plugin.index.update('x.md', { '<img src=x>': '<script>bad</script>' }); view.render();
  expect(document.querySelector('img')).toBeNull();
  expect(document.querySelector('.pv-tree')!.textContent).toContain('<img');
});

it('renders the layout fixture when requested', async () => {
  if (!process.env.PV_PREVIEW) return;
  const { writeFileSync, readFileSync } = await import('node:fs');
  plugin.index.update('Projects/Launch plan.md', { status: 'In progress', due: '2026-11-20', topics: ['Design', 'Product'], effort: 8, published: false });
  plugin.index.update('Projects/Research.md', { status: 'In progress', due: '2026-11-18', topics: ['Research'], effort: 3, published: true });
  plugin.prefs.expanded = ['status', 'topics']; view.render();
  click('Show notes with status: In progress (2)');
  if (process.env.PV_FOLDERS) {
    setFolders(['Projects', 'A long unavailable folder/With nested sections']);
    click('Choose properties to show'); nameProfile('Project notes');
  }
  // Standalone host fixture for CSS QA; actual Obsidian supplies Lucide SVG icons.
  for (const icon of document.querySelectorAll<HTMLElement>('[data-icon]')) {
    icon.textContent = ({ 'chevron-down': '⌄', 'chevron-right': '›', 'calendar': '▦', 'calendar-clock': '◷', 'list': '☷', 'tags': '⌗', 'search': '⌕', 'text': 'T', 'hash': '#', 'check-square': '☑', 'file-text': '▤', 'refresh-cw': '↻', 'list-tree': '☷', 'fold-vertical': '↥' } as Record<string, string>)[icon.dataset.icon!] ?? '◇';
  }
  writeFileSync(process.env.PV_PREVIEW, `<!doctype html><html><head><meta charset="utf-8"><style>
  :root{--text-normal:#dadbe3;--text-muted:#9396a8;--text-faint:#707488;--text-accent:#b4a1ff;--interactive-accent:#9b85ee;--background-primary:#202128;--background-secondary:#292b34;--background-modifier-border:#363843;--background-modifier-hover:#2e303b;--background-modifier-active-hover:#343044;--font-ui-small:13px}*{box-sizing:border-box}html,body{height:100%}body{margin:0;background:#202128;font-family:system-ui}button,input,select{font:inherit;color:inherit}button,select{border:1px solid #363843;border-radius:5px;background:#292b34;padding:4px 8px}input{color:#dadbe3}button{cursor:pointer}.pv-view{height:100vh;width:100%;max-width:480px;border-right:1px solid #363843}
  ${readFileSync('styles.css', 'utf8')}</style></head><body>${view.contentEl.outerHTML}</body></html>`);
});

it('puts value expanders first and renders compact inline note names and folders', () => {
  click('Expand status');
  const toggle = document.querySelector('[aria-label="Expand notes for status: Done"]') as HTMLElement;
  expect(toggle.parentElement!.firstElementChild).toBe(toggle);
  toggle.click();
  expect(document.querySelector('.pv-end-chevron')).toBeNull();
  expect(document.querySelector('.pv-note-name')!.textContent).toBe('One');
  expect(document.querySelector('.pv-note-path')!.textContent).toBe('Projects');
  click('Collapse notes for status: Done');
  expect(document.querySelector('.pv-notes')).toBeNull();
});

it('uses one expand/collapse toggle that follows the current scoped expansion', () => {
  const toggle = document.querySelector('[aria-label="Expand all properties"]') as HTMLButtonElement;
  expect(document.querySelector('[aria-label="Collapse all properties"]')).toBeNull();
  toggle.click();
  expect(toggle.getAttribute('aria-label')).toBe('Collapse all properties');
  expect(toggle.getAttribute('aria-pressed')).toBe('true');
  expect(document.querySelectorAll('.pv-values')).toHaveLength(2);
  toggle.click();
  expect(toggle.getAttribute('aria-label')).toBe('Expand all properties');
  expect(document.querySelectorAll('.pv-values')).toHaveLength(0);
  plugin.prefs.scope = ['status']; view.render(); toggle.click();
  expect(plugin.prefs.expanded).toEqual(['status']);
  expect(toggle.getAttribute('aria-label')).toBe('Collapse all properties');
  click('Collapse status');
  expect(toggle.getAttribute('aria-label')).toBe('Expand all properties');
});

it('searches property choices without changing selection or the tree query', () => {
  click('Choose properties to show'); click('Clear property selection');
  const input = document.querySelector('[aria-label="Search properties to select"]') as HTMLInputElement;
  input.value = 'sta'; input.dispatchEvent(new Event('input'));
  expect(document.querySelector('[aria-label="Include tags"]')).toBeNull();
  click('Include status'); expect(plugin.prefs.scope).toEqual(['status']);
  expect((document.querySelector('[aria-label="Filter properties and values"]') as HTMLInputElement).value).toBe('');
  input.value = ''; input.dispatchEvent(new Event('input'));
  expect((document.querySelector('[aria-label="Include status"]') as HTMLInputElement).checked).toBe(true);
  expect((document.querySelector('[aria-label="Include tags"]') as HTMLInputElement).checked).toBe(false);
});
it('updates an open property picker without replacing its search field', () => {
  click('Choose properties to show');
  const input = document.querySelector('[aria-label="Search properties to select"]') as HTMLInputElement;
  input.value = 'due'; input.dispatchEvent(new Event('input')); input.focus();
  expect(document.querySelector('.pv-scope-choices')!.textContent).toContain('No matching');
  plugin.index.update('New.md', { due: 'tomorrow' }); view.render();
  expect(document.querySelector('[aria-label="Search properties to select"]')).toBe(input);
  expect(document.activeElement).toBe(input);
  expect(document.querySelector('[aria-label="Include due"]')).not.toBeNull();
});

function availableViews(): string[] {
  click('Property view');
  const values = [...document.querySelectorAll<HTMLElement>('.pv-view-option')].map(option => option.dataset.value!);
  click('Property view');
  return values;
}
function chooseView(value: string) {
  click('Property view');
  const option = [...document.querySelectorAll<HTMLButtonElement>('.pv-view-option')].find(option => option.dataset.value === value);
  expect(option, `View ${value} should exist`).toBeDefined();
  option!.click();
}
function nameProfile(name: string) {
  (document.querySelector('[aria-label="Profile name"]') as HTMLInputElement).value = name;
}
it('creates and switches named selections without overwriting saved profiles', () => {
  click('Choose properties to show'); click('Clear property selection'); click('Include status');
  nameProfile('Writing'); click('Save selection as new profile');
  const writing = plugin.prefs.profiles[0];
  expect(writing.keys).toEqual(['status']); expect(plugin.prefs.activeProfile).toBe(writing.id);
  click('Include tags');
  expect(writing.keys).toEqual(['status']);
  expect(document.querySelector('[aria-label="Property view"]')!.textContent).toContain('Writing (modified)');
  click('Include status');
  nameProfile('Publishing'); click('Save selection as new profile');
  const publishing = plugin.prefs.profiles[1];
  chooseView(`profile:${writing.id}`);
  expect(document.querySelector('.pv-tree')!.textContent).not.toContain('tags');
  expect(plugin.prefs.scope).toEqual(['status']);
  chooseView(`profile:${publishing.id}`);
  expect(document.querySelector('.pv-tree')!.textContent).toContain('tags');
  expect(plugin.save).toHaveBeenCalled();
});
it('updates, renames and deletes a profile without touching notes', () => {
  plugin.index.update('Three.md', { priority: 'High' }); view.render();
  click('Choose properties to show'); click('Clear property selection'); click('Include status');
  nameProfile('Writing'); click('Save selection as new profile');
  click('Include tags'); click('Update active profile selection');
  expect(plugin.prefs.profiles[0].keys).toEqual(['status', 'tags']);
  nameProfile('Editing'); click('Rename active profile');
  expect(plugin.prefs.profiles[0].name).toBe('Editing');
  click('Delete active profile');
  expect(plugin.prefs.profiles).toEqual([]); expect(plugin.prefs.activeProfile).toBeNull();
  expect(plugin.prefs.scope).toEqual(['status', 'tags']);
  expect(plugin.index.properties.size).toBe(3);
});
it('rejects empty/duplicate names and preserves currently absent property keys', () => {
  click('Choose properties to show'); click('Clear property selection'); click('Include status'); nameProfile(' '); click('Save selection as new profile');
  expect(plugin.prefs.profiles).toEqual([]);
  plugin.prefs.scope = ['future_property']; view.render();
  nameProfile('Writing'); click('Save selection as new profile');
  nameProfile(' writing '); click('Save selection as new profile');
  expect(plugin.prefs.profiles).toHaveLength(1);
  expect(plugin.prefs.profiles[0].keys).toEqual(['future_property']);
  expect(document.querySelector('[aria-label="Include future_property"]')).not.toBeNull();
  plugin.index.update('Future.md', { future_property: 'yes' }); view.render();
  expect(document.querySelector('.pv-tree')!.textContent).toContain('future_property');
});

it('keeps the default header to action/profile rows and toggles search without hidden filtering', () => {
  const header = document.querySelector('.pv-search-header') as HTMLElement;
  expect(header.hidden).toBe(true);
  expect(document.querySelector('.pv-controls')).toBeNull();
  expect(document.querySelectorAll('.pv-nav-actions button')).toHaveLength(4);
  const picker = document.querySelector('[aria-label="Choose properties to show"]')!;
  expect(picker.parentElement).toBe(document.querySelector('[aria-label="Property view"]')!.parentElement);
  click('Toggle search'); expect(header.hidden).toBe(false);
  const input = document.querySelector('[aria-label="Filter properties and values"]') as HTMLInputElement;
  input.value = 'Pending'; input.dispatchEvent(new Event('input'));
  expect(document.querySelector('.pv-tree')!.textContent).not.toContain('tags');
  click('Toggle search'); expect(header.hidden).toBe(true); expect(input.value).toBe('');
  expect(document.querySelector('.pv-tree')!.textContent).toContain('tags');
  click('Toggle search'); input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(header.hidden).toBe(true);
});
it('displays available property counts alongside profile labels and updates them live', () => {
  const dropdown = document.querySelector('[aria-label="Property view"]') as HTMLSelectElement;
  expect(dropdown.textContent).toBe('All properties (2)');
  plugin.prefs.profiles = [{ id: 'writing', name: 'Writing', keys: ['status', 'future'] }];
  chooseView('all');
  chooseView('profile:writing');
  expect(dropdown.textContent).toBe('Writing (1)');
  plugin.index.update('Future.md', { future: 'yes' }); view.render();
  expect(dropdown.textContent).toBe('Writing (2)');
});

it('opens the four-option sort menu and applies and saves the chosen order', () => {
  const button = document.querySelector('[aria-label="Sort properties"]') as HTMLElement;
  expect(button.dataset.icon).toBe('arrow-up-narrow-wide');
  button.click();
  expect((Menu as any).items.map((item: any) => item.title)).toEqual([
    'Property name (A to Z)', 'Property name (Z to A)', 'Frequency (high to low)', 'Frequency (low to high)'
  ]);
  (Menu as any).items[1].run();
  expect(plugin.prefs.sort).toBe('name-desc');
  expect(document.querySelector('.pv-property-row .pv-label')!.textContent).toBe('tags');
  button.click(); (Menu as any).items[2].run();
  expect(document.querySelector('.pv-property-row .pv-label')!.textContent).toBe('status');
  expect(plugin.save).toHaveBeenCalled();
});
it('writes only generated text on explicit Copy actions and never reads the clipboard', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  const readText = vi.fn();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText, readText } });
  view.render();
  expect(writeText).not.toHaveBeenCalled();
  const row = document.querySelector('[aria-label="Toggle status (2)"]')!;
  row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
  expect(writeText).not.toHaveBeenCalled();
  (Menu as any).items.find((item: any) => item.title === 'Copy search query').run();
  await Promise.resolve();
  expect(writeText).toHaveBeenLastCalledWith('["status"]');
  (Menu as any).items.find((item: any) => item.title === 'Copy matching note links').run();
  await Promise.resolve();
  expect(writeText).toHaveBeenLastCalledWith('[[Projects/One]]\n[[Two]]');
  expect(readText).not.toHaveBeenCalled();
  Reflect.deleteProperty(navigator, 'clipboard');
});
it('offers property-name renaming from the property row keyboard menu', () => {
  plugin.renameProperty = vi.fn();
  const row = document.querySelector('[aria-label="Toggle status (2)"]')!;
  row.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true }));
  (Menu as any).items.find((item: any) => item.title === 'Rename property…').run();
  expect(plugin.renameProperty).toHaveBeenCalledWith(plugin.index.properties.get('status'));
});
it('offers property deletion from the property row keyboard menu', () => {
  plugin.deleteProperty = vi.fn();
  const row = document.querySelector('[aria-label="Toggle status (2)"]')!;
  row.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true }));
  (Menu as any).items.find((item: any) => item.title === 'Delete property…').run();
  expect(plugin.deleteProperty).toHaveBeenCalledWith(plugin.index.properties.get('status'));
});
it('offers value deletion from the value row keyboard menu', () => {
  plugin.editValue = vi.fn();
  click('Expand status');
  const row = document.querySelector('[aria-label="Show notes with status: Done (1)"]')!;
  row.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true }));
  (Menu as any).items.find((item: any) => item.title === 'Delete value…').run();
  const status = plugin.index.properties.get('status');
  const done = [...status.values.values()].find((value: { label: string }) => value.label === 'Done');
  expect(plugin.editValue).toHaveBeenCalledWith(status, done, 'delete');
});
it('does not offer value deletion for empty rows', () => {
  plugin.index.update('Empty.md', { blank: null }); view.render();
  click('Expand blank');
  const row = Array.from(document.querySelectorAll('[aria-label]')).find(element => element.getAttribute('aria-label')?.startsWith('Show notes with blank:'))!;
  row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
  expect((Menu as any).items.some((item: any) => item.title === 'Delete value…')).toBe(false);
});
it.each(['text', 'multitext', 'list', 'number', 'checkbox', 'date', 'datetime', 'tags', 'aliases', 'cssclasses'])('offers Split into list only for configured text properties (%s)', (type) => {
  plugin.typeResolver.typeFor = () => type;
  click('Expand status');
  document.querySelector('[aria-label="Show notes with status: Done (1)"]')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
  const titles = (Menu as any).items.map((item: any) => item.title);
  expect(titles.includes('Split into list…')).toBe(type === 'text');
  expect(titles).toContain('Rename value…');
});
it.each(['tags', 'aliases', 'cssclasses'])('never offers split for built-in %s even with a text override', (key) => {
  plugin.index.update('Special.md', { [key]: 'one, two' });
  plugin.typeResolver.typeFor = () => 'text'; view.render();
  click(`Expand ${key}`);
  document.querySelector(`[aria-label="Show notes with ${key}: one, two (1)"]`)!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
  expect((Menu as any).items.some((item: any) => item.title === 'Split into list…')).toBe(false);
});
it.each([12, true, null])('does not offer split for non-text values stored under a text property (%s)', (value) => {
  plugin.index.update('Special.md', { example: value });
  plugin.typeResolver.typeFor = () => 'text'; view.render(); click('Expand example');
  const row = Array.from(document.querySelectorAll('[aria-label]')).find(el => el.getAttribute('aria-label')?.startsWith('Show notes with example:'))!;
  row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
  expect((Menu as any).items.some((item: any) => item.title === 'Split into list…')).toBe(false);
});

it('does not summon the mobile keyboard when opening the property picker', () => {
  document.body.classList.add('is-mobile');
  click('Choose properties to show');
  expect(document.activeElement).not.toBe(document.querySelector('[aria-label="Search properties to select"]'));
});
it('saves a new view with Enter and dismisses the mobile name keyboard after success', () => {
  document.body.classList.add('is-mobile'); click('Choose properties to show');
  click('Clear property selection'); click('Include status');
  const input = document.querySelector('[aria-label="Profile name"]') as HTMLInputElement;
  input.value = 'Mobile view'; input.focus();
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  expect(plugin.prefs.profiles[0].name).toBe('Mobile view');
  expect(input.value).toBe(''); expect(document.activeElement).not.toBe(input);
});
it('does not save on IME composition or dismiss invalid name input', () => {
  document.body.classList.add('is-mobile'); click('Choose properties to show');
  click('Clear property selection'); click('Include status');
  const input = document.querySelector('[aria-label="Profile name"]') as HTMLInputElement;
  input.value = '名前'; input.focus();
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }));
  expect(plugin.prefs.profiles).toHaveLength(0);
  input.value = ' '; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(plugin.prefs.profiles).toHaveLength(0); expect(document.activeElement).toBe(input);
});

it.each(['mobile', 'desktop'])('preserves the same draft input across All/None and rejected saves on %s', (platform) => {
  if (platform === 'mobile') document.body.classList.add('is-mobile');
  click('Choose properties to show'); nameProfile('My project');
  const input = document.querySelector('[aria-label="Profile name"]') as HTMLInputElement;
  click('Clear property selection');
  expect(document.querySelector('[aria-label="Profile name"]')).toBe(input);
  expect(input.value).toBe('My project');
  click('Save selection as new profile');
  expect((Notice as any).messages.at(-1)).toBe('Please select at least one property.');
  expect(plugin.prefs.profiles).toHaveLength(0); expect(input.value).toBe('My project');
  click('Show all properties');
  expect(document.querySelector('[aria-label="Profile name"]')).toBe(input);
  expect(input.value).toBe('My project');
  click('Save selection as new profile');
  expect((Notice as any).messages.at(-1)).toBe('All properties View already exists.');
  expect(plugin.prefs.profiles).toHaveLength(0); expect(input.value).toBe('My project');
  click('Clear property selection'); click('Include status'); click('Save selection as new profile');
  expect(plugin.prefs.profiles[0]).toMatchObject({ name: 'My project', keys: ['status'] });
  expect(input.value).toBe('');
});
it('switches All to the protected default without deleting the previously active saved view', () => {
  click('Choose properties to show'); click('Clear property selection'); click('Include status');
  nameProfile('Writing'); click('Save selection as new profile');
  const saved = structuredClone(plugin.prefs.profiles);
  click('Show all properties');
  expect(plugin.prefs.activeProfile).toBeNull();
  expect((document.querySelector('[aria-label="Property view"]') as HTMLSelectElement).value).toBe('all');
  for (const label of ['Delete active profile','Rename active profile','Update active profile selection']) {
    expect((document.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement).disabled).toBe(true);
    click(label);
  }
  expect(plugin.prefs.profiles).toEqual(saved);
});
it('rejects selecting every property manually and reserves the default view name', () => {
  click('Choose properties to show'); click('Clear property selection'); click('Include status'); click('Include tags');
  nameProfile('Everything'); click('Save selection as new profile');
  expect((Notice as any).messages.at(-1)).toBe('All properties View already exists.');
  click('Include tags'); nameProfile(' All Properties '); click('Save selection as new profile');
  expect((Notice as any).messages.at(-1)).toBe('All properties View already exists.');
  expect(plugin.prefs.profiles).toHaveLength(0);
});
it('rejects empty and all-property updates without changing an existing saved selection', () => {
  click('Choose properties to show'); click('Clear property selection'); click('Include status');
  nameProfile('Writing'); click('Save selection as new profile');
  click('Clear property selection'); click('Update active profile selection');
  expect((Notice as any).messages.at(-1)).toBe('Please select at least one property.');
  expect(plugin.prefs.profiles[0].keys).toEqual(['status']);
  click('Include status'); click('Include tags'); click('Update active profile selection');
  expect((Notice as any).messages.at(-1)).toBe('All properties View already exists.');
  expect(plugin.prefs.profiles[0].keys).toEqual(['status']);
});
it('uses the same selection validation for Done/Enter', () => {
  click('Choose properties to show'); nameProfile('Draft');
  const input = document.querySelector('[aria-label="Profile name"]') as HTMLInputElement;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect((Notice as any).messages.at(-1)).toBe('All properties View already exists.');
  click('Clear property selection');
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect((Notice as any).messages.at(-1)).toBe('Please select at least one property.');
  expect(input.value).toBe('Draft'); expect(plugin.prefs.profiles).toHaveLength(0);
});

function noteMenu(path: string) {
  const row = document.querySelector(`button.pv-file[aria-label="${path}"]`) as HTMLElement;
  row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  return (Menu as any).items;
}
it('changes one note in its parent property and selects notes across that property only', () => {
  document.body.classList.add('is-mobile');
  plugin.changeNoteValue = vi.fn();
  click('Expand status'); click('Show notes with status: Done (1)'); click('Show notes with status: Pending (1)');
  noteMenu('Projects/One.md').find((item: any) => item.title === 'Change status…').run();
  expect(plugin.changeNoteValue).toHaveBeenLastCalledWith(plugin.index.properties.get('status'), ['Projects/One.md'], expect.any(Function));
  noteMenu('Projects/One.md').find((item: any) => item.title === 'Select notes…').run();
  const second = document.querySelector('[aria-label="Select Two.md for status"]') as HTMLInputElement;
  second.click();
  click('Change status for selected notes');
  expect(plugin.changeNoteValue).toHaveBeenLastCalledWith(plugin.index.properties.get('status'), ['Projects/One.md', 'Two.md'], expect.any(Function));
  expect(openFile).not.toHaveBeenCalled();
  expect(document.querySelector('.pv-note-selection')!.textContent).toContain('2 selected');
  click('Cancel note selection'); expect((document.querySelector('.pv-note-selection') as HTMLElement).hidden).toBe(true);
});
it('clears selected notes on filter changes and removes deleted paths on refresh', () => {
  click('Expand status'); click('Show notes with status: Done (1)');
  noteMenu('Projects/One.md').find((item: any) => item.title === 'Select notes…').run();
  plugin.index.remove('Projects/One.md'); view.render();
  expect(document.querySelector('.pv-note-selection')!.textContent).toContain('0 selected');
  expect((document.querySelector('[aria-label="Change status for selected notes"]') as HTMLButtonElement).disabled).toBe(true);
  click('Toggle search');
  const search = document.querySelector('[aria-label="Filter properties and values"]') as HTMLInputElement;
  search.value = 'Pending'; search.dispatchEvent(new Event('input'));
  expect((document.querySelector('.pv-note-selection') as HTMLElement).hidden).toBe(true);
});
it('does not expose note changes for unsupported property types', () => {
  click('Expand tags'); click('Show notes with tags: work (1)');
  expect(document.querySelector('button.pv-file')!.hasAttribute('aria-haspopup')).toBe(false);
});
it('uses long press on mobile without opening the note', () => {
  vi.useFakeTimers(); document.body.classList.add('is-mobile');
  click('Expand status'); click('Show notes with status: Done (1)');
  const note = document.querySelector('button.pv-file')!;
  note.dispatchEvent(Object.assign(new Event('pointerdown'), { pointerType: 'touch', pointerId: 1, clientX: 10, clientY: 20 }));
  vi.advanceTimersByTime(500);
  note.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect((Menu as any).items.map((item: any) => item.title)).toEqual(['Change status…', 'Select notes…']);
  expect(openFile).not.toHaveBeenCalled(); vi.useRealTimers();
});
it('uses only an unselected note for its context action and replaces selection when switching properties', () => {
  document.body.classList.add('is-mobile');
  plugin.changeNoteValue = vi.fn();
  plugin.index.update('Third.md', { author: 'Ada' }); view.render();
  click('Expand status'); click('Show notes with status: Done (1)'); click('Show notes with status: Pending (1)');
  noteMenu('Projects/One.md').find((item: any) => item.title === 'Select notes…').run();
  noteMenu('Two.md').find((item: any) => item.title === 'Change status…').run();
  expect(plugin.changeNoteValue).toHaveBeenLastCalledWith(plugin.index.properties.get('status'), ['Two.md'], expect.any(Function));
  click('Expand author'); click('Show notes with author: Ada (1)');
  noteMenu('Third.md').find((item: any) => item.title === 'Select notes…').run();
  expect(document.querySelectorAll('.pv-note-checkbox')).toHaveLength(1);
  click('Change author for selected notes');
  expect(plugin.changeNoteValue).toHaveBeenLastCalledWith(plugin.index.properties.get('author'), ['Third.md'], expect.any(Function));
});
it('clears note selection after changing the visible property scope', () => {
  click('Expand status'); click('Show notes with status: Done (1)');
  noteMenu('Projects/One.md').find((item: any) => item.title === 'Select notes…').run();
  click('Choose properties to show'); click('Clear property selection');
  expect((document.querySelector('.pv-note-selection') as HTMLElement).hidden).toBe(true);
});

function rangeNotes() {
  plugin.index = new PropertyIndex();
  for (const [path, status] of [['A.md', 'active'], ['B.md', 'active'], ['C.md', 'active'], ['D.md', 'done'], ['E.md', 'done']]) plugin.index.update(path, { status });
  view.render();
  click('Expand status'); click('Show notes with status: active (3)'); click('Show notes with status: done (2)');
}
function shiftNote(path: string) {
  document.querySelector(`button.pv-file[aria-label="${path}"]`)!.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true, cancelable: true }));
}
function checkedNotes() {
  return [...document.querySelectorAll<HTMLElement>('.pv-file.is-selected')].map(note => `Select ${note.dataset.notePath} for ${JSON.parse(note.dataset.pvFocus!)[1]}`);
}
it('Shift-click selects a visible range across value groups and adds to the selection in either direction', () => {
  rangeNotes(); click('B.md'); expect(openFile).toHaveBeenCalledOnce();
  shiftNote('D.md');
  expect(checkedNotes()).toEqual(['Select B.md for status', 'Select C.md for status', 'Select D.md for status']);
  shiftNote('C.md'); expect(checkedNotes()).toEqual(['Select B.md for status', 'Select C.md for status', 'Select D.md for status']);
  shiftNote('A.md'); expect(checkedNotes()).toEqual(['Select A.md for status', 'Select B.md for status', 'Select C.md for status', 'Select D.md for status']);
  expect(openFile).toHaveBeenCalledOnce();
});
it('Shift-click starts selection without an anchor and Cancel clears the anchor', () => {
  rangeNotes(); shiftNote('C.md'); expect(checkedNotes()).toEqual(['Select C.md for status']);
  shiftNote('E.md'); expect(checkedNotes()).toHaveLength(3);
  click('Cancel note selection'); shiftNote('A.md');
  expect(checkedNotes()).toEqual(['Select A.md for status']); expect(openFile).not.toHaveBeenCalled();
});
it.each([false, true])('supports Shift-click and ordinary checkbox selection on touch=%s', touch => {
  if (touch) document.body.classList.add('is-mobile');
  rangeNotes(); noteMenu('B.md').find((item: any) => item.title === 'Select notes…').run();
  document.querySelector('[aria-label="Select D.md for status"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true, cancelable: true }));
  expect(checkedNotes()).toEqual(['Select B.md for status', 'Select C.md for status', 'Select D.md for status']);
  (document.querySelector('[aria-label="Select A.md for status"]') as HTMLInputElement).click();
  shiftNote('C.md'); expect(checkedNotes()).toEqual(['Select A.md for status', 'Select B.md for status', 'Select C.md for status', 'Select D.md for status']);
  expect(openFile).not.toHaveBeenCalled();
});
it('does not extend a range into another property or a collapsed branch', () => {
  rangeNotes(); click('B.md'); click('Collapse notes for status: active');
  shiftNote('E.md'); expect(checkedNotes()).toEqual(['Select E.md for status']);
  plugin.index.update('F.md', { author: 'Ada' }); plugin.index.update('G.md', { author: 'Ada' }); view.render();
  click('Expand author'); click('Show notes with author: Ada (2)');
  shiftNote('F.md'); expect(checkedNotes()).toEqual(['Select F.md for author']);
  shiftNote('G.md'); expect(checkedNotes()).toEqual(['Select F.md for author', 'Select G.md for author']);
});
it('drops the range anchor when search changes', () => {
  rangeNotes(); click('B.md'); click('Toggle search');
  const search = document.querySelector('[aria-label="Filter properties and values"]') as HTMLInputElement;
  search.value = 'E.md'; search.dispatchEvent(new Event('input'));
  shiftNote('E.md'); expect(checkedNotes()).toEqual(['Select E.md for status']);
});

function modifiedNote(path: string, modifiers: MouseEventInit) {
  document.querySelector(`button.pv-file[aria-label="${path}"]`)!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...modifiers }));
}
it('Alt/Option-click keeps desktop checkboxes synchronized with highlighted notes without opening them', () => {
  rangeNotes(); modifiedNote('B.md', { altKey: true }); modifiedNote('E.md', { altKey: true });
  expect(checkedNotes()).toEqual(['Select B.md for status', 'Select E.md for status']);
  expect(document.querySelectorAll('.pv-note-checkbox')).toHaveLength(5);
  expect(document.querySelectorAll('.pv-note-checkbox:checked')).toHaveLength(2);
  modifiedNote('B.md', { altKey: true });
  expect(checkedNotes()).toEqual(['Select E.md for status']);
  expect(openFile).not.toHaveBeenCalled();
});
it('preserves separate Alt-selected notes when adding a Shift range', () => {
  rangeNotes(); modifiedNote('A.md', { altKey: true }); modifiedNote('D.md', { altKey: true });
  shiftNote('E.md'); expect(checkedNotes()).toEqual(['Select A.md for status', 'Select D.md for status', 'Select E.md for status']);
  shiftNote('C.md'); expect(checkedNotes()).toEqual(['Select A.md for status', 'Select C.md for status', 'Select D.md for status', 'Select E.md for status']);
});
it.each([{}, { ctrlKey: true }, { metaKey: true }, { ctrlKey: true, shiftKey: true }])('normal and new-tab clicks open a note and clear the multi-selection: %j', modifiers => {
  rangeNotes(); modifiedNote('A.md', { altKey: true }); modifiedNote('D.md', { altKey: true });
  modifiedNote('D.md', modifiers);
  expect(openFile).toHaveBeenCalledOnce(); expect(checkedNotes()).toEqual([]);
  expect((document.querySelector('.pv-note-selection') as HTMLElement).hidden).toBe(true);
});
it('supports Shift-arrow selection, preserves it on reverse movement, and clears it with Escape', () => {
  rangeNotes();
  const key = (path: string, name: string, shiftKey = false) => document.querySelector(`button.pv-file[aria-label="${path}"]`)!.dispatchEvent(new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true, cancelable: true }));
  key('B.md', 'ArrowDown', true);
  expect(checkedNotes()).toEqual(['Select B.md for status', 'Select C.md for status']);
  expect(document.activeElement?.getAttribute('aria-label')).toBe('C.md');
  key('C.md', 'ArrowUp', true); expect(checkedNotes()).toEqual(['Select B.md for status', 'Select C.md for status']);
  key('B.md', 'Escape'); expect(checkedNotes()).toEqual([]); expect(openFile).not.toHaveBeenCalled();
});
it('keeps plain mobile taps toggling notes in the long-press selection flow', () => {
  document.body.classList.add('is-mobile'); rangeNotes();
  noteMenu('B.md').find((item: any) => item.title === 'Select notes…').run();
  click('D.md'); expect(checkedNotes()).toEqual(['Select B.md for status', 'Select D.md for status']);
  click('B.md'); expect(checkedNotes()).toEqual(['Select D.md for status']);
  expect(openFile).not.toHaveBeenCalled(); expect(document.querySelectorAll('.pv-note-checkbox')).toHaveLength(5);
});
it.each(['number', 'checkbox', 'date', 'datetime', 'multitext'])('exposes note editing and selection for %s properties', type => {
  plugin.typeResolver.typeFor = () => type; plugin.changeNoteValue = vi.fn(); view.render();
  click('Expand status'); click('Show notes with status: Done (1)');
  noteMenu('Projects/One.md').find((item: any) => item.title === 'Change status…').run();
  expect(plugin.changeNoteValue).toHaveBeenLastCalledWith(plugin.index.properties.get('status'), ['Projects/One.md'], expect.any(Function));
  noteMenu('Projects/One.md').find((item: any) => item.title === 'Select notes…').run();
  expect(document.querySelector('.pv-note-checkbox')).not.toBeNull();
});

function filterValue(label: string) {
  const button = document.querySelector(`[aria-label="${label}"]`) as HTMLElement;
  button.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
  (Menu as any).items.find((item: any) => item.title === 'Filter by Value').run();
}
it('filters counts, picker and links, preserves profiles, and clears with focus restoration', async () => {
  plugin.index.update('Two.md', { status: 'Pending', tags: ['work'] });
  plugin.prefs.scope = ['status', 'tags'];
  plugin.prefs.profiles = [{ id: 'test', name: 'Test', keys: ['status', 'tags'] }];
  plugin.prefs.activeProfile = 'test';
  view.render(); click('Expand status'); filterValue('Show notes with status: Done (1)');
  expect(document.querySelector('.pv-filter-bar')!.textContent).toContain('status = Done');
  expect(document.querySelector('.pv-summary')!.textContent).toBe('1 properties · Filtered (1 note)');
  expect(document.querySelector('[aria-label="Toggle status (1)"]')).toBeNull();
  expect(document.querySelector('[aria-label="Toggle tags (1)"]')).not.toBeNull();
  expect(document.querySelector('.pv-profile-select')!.textContent).not.toContain('(modified)');
  click('Choose properties to show'); expect(document.querySelector('[aria-label="Include status"]')).toBeNull();
  click('Expand tags');
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  document.querySelector('[aria-label="Show notes with tags: work (1)"]')!.dispatchEvent(new MouseEvent('contextmenu'));
  (Menu as any).items.find((item: any) => item.title === 'Copy matching note links').run();
  expect(writeText).toHaveBeenCalledWith('[[Projects/One]]');
  click('Clear property filter');
  expect((document.querySelector('.pv-filter-bar') as HTMLElement).hidden).toBe(true);
  expect(document.querySelector('[aria-label="Toggle tags (2)"]')).not.toBeNull();
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Choose properties to show');
});
it('keeps a missing filter clearable and distinguishes no other visible properties', () => {
  click('Expand status'); filterValue('Show notes with status: Done (1)');
  plugin.prefs.hidden = 'tags'; view.render();
  expect(document.querySelector('.pv-empty')!.textContent).toContain('No matching properties');
  plugin.index.remove('Projects/One.md'); view.render();
  expect(document.querySelector('.pv-empty')!.textContent).toBe('No notes match this filter.');
  expect(document.querySelector('.pv-filter-bar')!.textContent).toContain('0 notes');
});
it('replaces rather than intersects filters and searches only the subset', () => {
  plugin.index.update('Two.md', { status: 'Pending', tags: ['work'] }); view.render();
  click('Expand status'); filterValue('Show notes with status: Done (1)');
  click('Toggle search'); const input = document.querySelector('.pv-filter') as HTMLInputElement;
  input.value = 'Two.md'; input.dispatchEvent(new Event('input'));
  expect(document.querySelector('.pv-empty')).not.toBeNull();
  input.value = ''; input.dispatchEvent(new Event('input'));
  click('Expand tags'); filterValue('Show notes with tags: work (1)');
  expect(document.querySelector('.pv-filter-bar')!.textContent).toContain('tags = work');
  expect(document.querySelector('[aria-label="Toggle status (2)"]')).not.toBeNull();
});
it('offers keyboard filtering on empty values but not property rows, independently per view', async () => {
  document.querySelector('[aria-label="Toggle status (2)"]')!.dispatchEvent(new MouseEvent('contextmenu'));
  expect((Menu as any).items.some((item: any) => item.title === 'Filter by Value')).toBe(false);
  plugin.index.update('Empty.md', { status: null }); view.render(); click('Expand status');
  const button = document.querySelector('[aria-label="Show notes with status: (empty) (1)"]') as HTMLElement;
  button.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true }));
  (Menu as any).items.find((item: any) => item.title === 'Filter by Value').run();
  expect(document.querySelector('.pv-filter-bar')!.textContent).toContain('(empty)');
  const other = new PropertiesView({ app: view.app } as any, plugin); await other.onOpen();
  expect((other.contentEl.querySelector('.pv-filter-bar') as HTMLElement).hidden).toBe(true);
  await other.onClose();
});
it('opens the value filter menu on long-press without expanding notes', () => {
  vi.useFakeTimers();
  try {
    click('Expand status');
    const row = document.querySelector('[aria-label="Show notes with status: Done (1)"]') as HTMLElement;
    row.dispatchEvent(Object.assign(new Event('pointerdown'), { pointerType: 'touch', pointerId: 1, clientX: 10, clientY: 20 }));
    vi.advanceTimersByTime(500);
    expect((Menu as any).items.some((item: any) => item.title === 'Filter by Value')).toBe(true);
    row.dispatchEvent(new Event('pointerup')); row.click();
    expect(document.querySelector('.pv-notes')).toBeNull();
  } finally { vi.useRealTimers(); }
});
it('prunes selected notes that leave the live filter and clears selection when filtering changes', () => {
  plugin.index.update('Two.md', { status: 'Done', topic: 'work' });
  plugin.index.update('Projects/One.md', { status: 'Done', topic: 'work' });
  view.render(); click('Expand status'); filterValue('Show notes with status: Done (2)');
  click('Expand topic'); click('Show notes with topic: work (2)');
  const note = document.querySelector('.pv-file') as HTMLElement;
  note.dispatchEvent(new MouseEvent('contextmenu'));
  (Menu as any).items.find((item: any) => item.title === 'Select notes…').run();
  plugin.index.update('Projects/One.md', { status: 'Pending', topic: 'work' }); view.render();
  expect(document.querySelector('.pv-note-selection')!.textContent).toContain('0 selected');
  click('Clear property filter');
  expect((document.querySelector('.pv-note-selection') as HTMLElement).hidden).toBe(true);
});


it('shows one filtered note, separately from its two remaining properties', () => {
  plugin.index = new PropertyIndex();
  const fm = { author: 'AJ', rating: 4, topic: 'design' };
  plugin.index.update('Note-A.md', fm);
  plugin.index.update('Note-A.md', fm);
  view.render(); click('Expand author');
  expect(document.querySelector('[aria-label="Show notes with author: AJ (1)"]')).not.toBeNull();
  filterValue('Show notes with author: AJ (1)');
  expect(document.querySelector('.pv-filter-label')!.textContent).toBe('Filtered by author = AJ');
  expect(document.querySelector('.pv-summary')!.textContent).toBe('2 properties · Filtered (1 note)');
  expect(document.querySelector('[aria-label="Toggle rating (1)"]')).not.toBeNull();
  expect(document.querySelector('[aria-label="Toggle topic (1)"]')).not.toBeNull();
  plugin.index.remove('Note-A.md'); plugin.index.update('Renamed.md', fm); view.render();
  expect(document.querySelector('.pv-filter-label')!.textContent).toBe('Filtered by author = AJ');
  expect(document.querySelector('.pv-summary')!.textContent).toBe('2 properties · Filtered (1 note)');
  // A genuinely different matching path counts once, even if its author is a list.
  plugin.index.update('Note-B.md', { ...fm, author: ['AJ', 'AJ'] }); view.render();
  expect(document.querySelector('.pv-filter-toggle')!.textContent).toBe('2 notes');
});

it('narrows the filter note list with tree search and resets disclosure on clear', () => {
  click('Expand status'); filterValue('Show notes with status: Done (1)');
  click('Show 1 filtered note');
  expect(document.querySelectorAll('.pv-filter-note')).toHaveLength(1);
  expect(document.querySelector('.pv-filter-note')!.textContent).toContain('One');
  click('Toggle search'); const input=document.querySelector('.pv-filter') as HTMLInputElement;
  input.value='no match'; input.dispatchEvent(new Event('input'));
  expect(document.querySelectorAll('.pv-filter-note')).toHaveLength(0);
  expect(document.querySelector('.pv-empty')).not.toBeNull();
  click('Clear property filter'); expect((document.querySelector('.pv-filter-notes') as HTMLElement).hidden).toBe(true);
  input.value='';input.dispatchEvent(new Event('input'));
  filterValue('Show notes with status: Done (1)');
  expect(document.querySelector('.pv-filter-toggle')!.getAttribute('aria-expanded')).toBe('false');
});
it('collapses the note list when replacing the filter and keeps counts visible with row counts off', () => {
  click('Expand status'); filterValue('Show notes with status: Done (1)'); click('Show 1 filtered note');
  plugin.prefs.counts=false;view.render();
  expect(document.querySelector('.pv-filter-toggle')!.textContent).toBe('1 note');
  click('Expand tags');filterValue('Show notes with tags: work (1)');
  expect((document.querySelector('.pv-filter-notes') as HTMLElement).hidden).toBe(true);
});

it.each(['all', 'custom', 'filtered'])('opens a note on a mobile tap in the %s view after touch pointerleave', mode => {
  document.body.classList.add('is-mobile');
  if (mode === 'custom') {
    plugin.prefs.scope=['status'];plugin.prefs.profiles=[{id:'tasks',name:'Tasks',keys:['status']}];plugin.prefs.activeProfile='tasks';
  }
  view.render();
  if (mode === 'filtered') {
    click('Expand tags');filterValue('Show notes with tags: work (1)');
  }
  click('Expand status');click('Show notes with status: Done (1)');
  const note=document.querySelector<HTMLButtonElement>('.pv-file')!;
  for(const type of ['pointerdown','pointerup','pointerleave']) {
    note.dispatchEvent(Object.assign(new Event(type),{pointerType:'touch',pointerId:1,isPrimary:true,clientX:10,clientY:20}));
  }
  note.click();expect(openFile).toHaveBeenCalledOnce();
});

it.each([false, true])('waits for a deferred Search view before setting the query (existing=%s)', async existing => {
  const setQuery = vi.fn(), detach = vi.fn();
  const leaf = { view: {} as { setQuery?: typeof setQuery }, setViewState: vi.fn().mockResolvedValue(undefined), detach };
  let loaded!: () => void;
  const ready = new Promise<void>(resolve => { loaded = resolve; });
  const revealLeaf = vi.fn(async () => { await ready; leaf.view = { setQuery }; });
  (view as any).app.workspace = { getLeavesOfType: () => existing ? [leaf] : [], getLeftLeaf: () => leaf, revealLeaf };
  const property = plugin.index.properties.get('status');
  const value = [...property.values.values()].find((node: any) => node.label === 'Done');
  const pending = (view as any).search(property, value);
  await vi.waitFor(() => expect(revealLeaf).toHaveBeenCalledWith(leaf));
  expect(setQuery).not.toHaveBeenCalled(); expect(detach).not.toHaveBeenCalled();
  expect((Notice as any).messages).not.toContain('Enable the Search core plugin to use Open in Search.');
  loaded(); await pending;
  expect(setQuery).toHaveBeenCalledWith('["status":"Done"]');
  expect(detach).not.toHaveBeenCalled();
});
it('does not detach an existing Search leaf when its loaded view is unavailable', async () => {
  const leaf = { view: {}, detach: vi.fn() };
  (view as any).app.workspace = { getLeavesOfType: () => [leaf], revealLeaf: vi.fn().mockResolvedValue(undefined) };
  const property = plugin.index.properties.get('status');
  await (view as any).search(property, property);
  expect(leaf.detach).not.toHaveBeenCalled();
  expect((Notice as any).messages).toContain('Enable the Search core plugin to use Open in Search.');
});

function enableInlineView() {
  plugin.prefs.showInlineProperties=true;
  const index=new PropertyIndex();index.update('Inline.md',{status:['inline only'],author:['AJ'],rating:['4']});
  plugin.inline={index,pending:0,failures:new Set()};view.render();
  chooseView('inline');
}
it('offers separate inline search and edit actions without YAML note editing', () => {
  expect(availableViews()).not.toContain('inline');enableInlineView();
  expect(document.querySelector('.pv-summary')!.textContent).toContain('Inline properties');
  expect(document.querySelector('[aria-label="Choose properties to show"]')!.hasAttribute('disabled')).toBe(false);
  click('Expand status');expect(document.querySelector('.pv-tree')!.textContent).toContain('inline only');expect(document.querySelector('.pv-tree')!.textContent).not.toContain('Done');
  document.querySelector('[aria-label="Toggle status (1)"]')!.dispatchEvent(new MouseEvent('contextmenu'));
  expect((Menu as any).items.map((i:any)=>i.title)).toEqual(['Open in Search','Copy search query','Copy matching note links','Rename property…','Delete property…','Pin property','Hide property','Convert to YAML property…','Replace selected values…']);
  document.querySelector('[aria-label="Show notes with status: inline only (1)"]')!.dispatchEvent(new MouseEvent('contextmenu'));
  expect((Menu as any).items.map((i:any)=>i.title)).toEqual(['Open in Search','Copy search query','Copy matching note links','Convert to YAML property…','Rename value…','Filter by Value']);
  view.render(); click('Show notes with status: inline only (1)');
  const note=document.querySelector<HTMLButtonElement>('.pv-file')!;expect(note.hasAttribute('aria-haspopup')).toBe(false);note.click();expect(openFile).toHaveBeenCalledOnce();
});
it('preserves YAML saved views and expansion, keeps inline filters separate, and falls back to All on disable', () => {
  plugin.prefs.scope=['status'];plugin.prefs.profiles=[{id:'custom',name:'Custom',keys:['status']}];plugin.prefs.activeProfile='custom';plugin.prefs.expanded=['status'];
  const original=structuredClone(plugin.prefs);enableInlineView();
  expect(plugin.prefs.scope).toEqual(original.scope);expect(plugin.prefs.activeProfile).toBe('custom');
  click('Expand status');filterValue('Show notes with status: inline only (1)');expect(document.querySelector('.pv-summary')!.textContent).toContain('2 properties');
  expect(plugin.prefs.expanded).toEqual(['status']);
  chooseView('profile:custom');
  expect(document.querySelector('.pv-tree')!.textContent).toContain('Done');expect((document.querySelector('.pv-filter-bar') as HTMLElement).hidden).toBe(true);
  chooseView('inline');plugin.prefs.showInlineProperties=false;view.render();
  expect(document.querySelector<HTMLButtonElement>('.pv-profile-select')!.value).toBe('all');expect(availableViews()).not.toContain('inline');expect(plugin.prefs.profiles).toEqual(original.profiles);
});
it('shows inline indexing and read-failure status instead of silently presenting missing results', () => {
 enableInlineView();plugin.inline.index=new PropertyIndex();plugin.inline.pending=2;view.render();expect(document.querySelector('.pv-empty')!.textContent).toBe('Reading inline properties…');
 plugin.inline.pending=0;plugin.inline.failures.add('bad.md');view.render();expect(document.querySelector('.pv-summary')!.textContent).toContain('1 note could not be read');
});


it('creates, updates, renames and deletes inline views independently of YAML views', () => {
  plugin.prefs.scope=['status']; plugin.prefs.activeProfile='yaml';
  plugin.prefs.profiles=[{id:'yaml',name:'Reading',keys:['status']}];
  const yaml=structuredClone({scope:plugin.prefs.scope,activeProfile:plugin.prefs.activeProfile,profiles:plugin.prefs.profiles});
  enableInlineView(); click('Choose properties to show'); click('Clear property selection'); click('Include author');
  nameProfile('Reading'); click('Save selection as new profile');
  const state=plugin.prefs.inlineViews, profile=state.profiles[0];
  expect(profile.keys).toEqual(['author']);
  expect(document.querySelector('.pv-profile-select')!.textContent).toContain('Inline: Reading (1)');
  expect(document.querySelectorAll('.pv-property-row')).toHaveLength(1);
  click('Include rating'); expect(profile.keys).toEqual(['author']);
  expect(document.querySelector('.pv-profile-select')!.textContent).toContain('Inline: Reading (modified)');
  click('Update active profile selection'); expect(profile.keys).toEqual(['author','rating']);
  nameProfile('Research'); click('Rename active profile'); expect(profile.name).toBe('Research');
  chooseView('profile:yaml'); expect(document.querySelector('.pv-tree')!.textContent).toContain('status');
  chooseView(`inline:profile:${profile.id}`);
  expect(document.querySelectorAll('.pv-property-row')).toHaveLength(2);
  click('Choose properties to show'); click('Delete active profile');
  expect(state.profiles).toEqual([]); expect(state.scope).toEqual(['author','rating']);
  expect(state.activeProfile).toBeNull();
  expect({scope:plugin.prefs.scope,activeProfile:plugin.prefs.activeProfile,profiles:plugin.prefs.profiles}).toEqual(yaml);
});
it.each([false,true])('protects the built-in inline view and preserves typed names for All/None (mobile=%s)', mobile => {
  if(mobile) document.body.classList.add('is-mobile');
  enableInlineView();click('Choose properties to show');nameProfile('Reading');
  click('Show all properties');click('Save selection as new profile');
  expect((Notice as any).messages.at(-1)).toBe('Inline Properties View already exists.');
  expect((document.querySelector('[aria-label="Profile name"]') as HTMLInputElement).value).toBe('Reading');
  expect((document.querySelector('[aria-label="Delete active profile"]') as HTMLButtonElement).disabled).toBe(true);
  click('Clear property selection');click('Save selection as new profile');
  expect((Notice as any).messages.at(-1)).toBe('Please select at least one property.');
  click('Include author');nameProfile('Inline Properties');click('Save selection as new profile');
  expect(plugin.prefs.inlineViews.profiles).toEqual([]);
  nameProfile('Reading');click('Save selection as new profile');
  nameProfile(' reading ');click('Save selection as new profile');expect(plugin.prefs.inlineViews.profiles).toHaveLength(1);
});
it('supports search and value filters inside an inline saved view without changing saved keys', () => {
  enableInlineView();plugin.inline.index.update('Other.md',{author:['Other'],rating:['5'],status:['inline only']});
  click('Choose properties to show');click('Clear property selection');click('Include author');click('Include rating');
  nameProfile('Reading');click('Save selection as new profile');
  const profile=plugin.prefs.inlineViews.profiles[0];
  click('Toggle search');const input=document.querySelector<HTMLInputElement>('[aria-label="Filter properties and values"]')!;
  input.value='AJ';input.dispatchEvent(new Event('input'));
  expect(document.querySelectorAll('.pv-property-row')).toHaveLength(1);
  filterValue('Show notes with author: AJ (1)');
  input.value='';input.dispatchEvent(new Event('input'));
  expect(document.querySelectorAll('.pv-property-row')).toHaveLength(1);
  expect(document.querySelector('.pv-tree')!.textContent).toContain('rating');
  expect(document.querySelector('.pv-summary')!.textContent).toContain('Filtered (1 note)');
  expect(profile.keys).toEqual(['author','rating']);
  expect(document.querySelector('.pv-profile-select')!.textContent).not.toContain('modified');
  click('Clear property filter');expect(document.querySelectorAll('.pv-property-row')).toHaveLength(2);
});
it('retains inline saved views and missing keys across disabling and re-enabling', () => {
  enableInlineView();click('Choose properties to show');click('Clear property selection');click('Include author');
  nameProfile('Reading');click('Save selection as new profile');
  const profile=plugin.prefs.inlineViews.profiles[0];profile.keys.push('future');
  chooseView(`inline:profile:${profile.id}`);
  expect(document.querySelector('[aria-label="Include future"]')).not.toBeNull();
  plugin.prefs.showInlineProperties=false;view.render();
  expect(availableViews()).not.toContain(`inline:profile:${profile.id}`);
  expect(plugin.prefs.inlineViews.profiles[0]).toEqual(profile);
  plugin.prefs.showInlineProperties=true;view.render();chooseView(`inline:profile:${profile.id}`);
  plugin.inline.index.update('New.md',{future:'yes'});view.render();
  expect(document.querySelector('.pv-tree')!.textContent).toContain('future');
});


it.each([false,true])('allows independent search expansion including note branches (inline=%s)', inline => {
  if(inline) enableInlineView();
  click('Toggle search');click('Search in: Search everything');
  (Menu as any).items.find((item:any)=>item.title==='Note names / paths').run();
  const input=document.querySelector<HTMLInputElement>('[aria-label="Filter properties and values"]')!;
  input.value=inline?'Inline':'Projects/';input.dispatchEvent(new Event('input'));
  const count=document.querySelectorAll('.pv-property-row').length;
  const property=inline?'author':'status', value=inline?'AJ':'Done';
  const toggle=document.querySelector<HTMLButtonElement>(`[aria-label="Collapse ${property}"]`)!;
  expect(toggle.disabled).toBe(false);toggle.click();
  expect(document.querySelectorAll('.pv-values')).toHaveLength(count-1);
  view.render();expect(document.querySelectorAll('.pv-values')).toHaveLength(count-1);
  click(`Expand ${property}`);expect(document.querySelectorAll('.pv-values')).toHaveLength(count);
  click(`Collapse notes for ${property}: ${value}`);
  expect(document.querySelector(`[aria-label="Expand notes for ${property}: ${value}"]`)).not.toBeNull();
  click(`Expand notes for ${property}: ${value}`);
  expect(document.querySelector(`[aria-label="Collapse notes for ${property}: ${value}"]`)).not.toBeNull();
  click('Collapse all properties');click(`Expand ${property}`);
  expect(document.querySelectorAll('.pv-values')).toHaveLength(1);
  click('Expand all properties');expect(document.querySelectorAll('.pv-values')).toHaveLength(count);
  expect(input.value).toBe(inline?'Inline':'Projects/');
});
it.each([false,true])('allows individual arrows within Value filters, with and without search (inline=%s)', inline => {
  if(inline) enableInlineView();
  click('Expand status');filterValue(`Show notes with status: ${inline?'inline only':'Done'} (1)`);
  const property=inline?'author':'tags';
  click(`Expand ${property}`);click(`Collapse ${property}`);click(`Expand ${property}`);
  click('Toggle search');const input=document.querySelector<HTMLInputElement>('[aria-label="Filter properties and values"]')!;
  input.value=property;input.dispatchEvent(new Event('input'));
  click('Collapse all properties');click(`Expand ${property}`);
  expect(document.querySelectorAll('.pv-values')).toHaveLength(1);
  click(`Collapse ${property}`);expect(document.querySelectorAll('.pv-values')).toHaveLength(0);
  expect(input.value).toBe(property);
  expect(document.querySelector('.pv-summary')!.textContent).toContain('Filtered (1 note)');
});


it.each([false,true])('updates Value filter note lists with search in either action order (inline=%s)', inline => {
  if(inline) enableInlineView();
  const index=inline?plugin.inline.index:plugin.index;
  index.update('Projects/Alpha.md',{status:'active',author:'AJ',topic:'design'});
  index.update('Archive/Beta.md',{status:'active',author:'Lee',topic:'writing'});
  view.render();
  const search = (query: string) => {
    const input=document.querySelector<HTMLInputElement>('[aria-label="Filter properties and values"]')!;
    input.value=query;input.dispatchEvent(new Event('input'));
  };
  const noteNames = () => [...document.querySelectorAll('.pv-filter-note')].map(note=>note.textContent);
  click('Expand status');filterValue('Show notes with status: active (2)');click('Show 2 filtered notes');
  expect(noteNames()).toHaveLength(2);
  click('Toggle search');search('Projects/');
  expect(noteNames()).toHaveLength(1);expect(noteNames()[0]).toContain('Alpha');
  expect(document.querySelector('.pv-summary')!.textContent).toContain('Filtered (1 note)');
  click('Collapse all properties');expect(noteNames()).toHaveLength(1);
  search('Archive/');expect(noteNames()[0]).toContain('Beta');
  search('not-found');expect(noteNames()).toHaveLength(0);
  search('');expect(noteNames()).toHaveLength(2);
  click('Clear property filter');search('Projects/');
  filterValue('Show notes with status: active (1)');click('Show 1 filtered note');
  expect(noteNames()).toHaveLength(1);expect(noteNames()[0]).toContain('Alpha');
  index.update('Projects/Gamma.md',{status:'active',author:'AJ',topic:'design'});view.render();
  expect(noteNames()).toHaveLength(2);
  index.remove('Projects/Alpha.md');view.render();expect(noteNames()).toHaveLength(1);
});
it('uses property/value/note search modes for distinct matching filter notes without narrowing edit scope', () => {
  plugin.index.update('Projects/Alpha.md',{status:'active',author:'AJ',topic:'design'});
  plugin.index.update('Archive/Beta.md',{status:'active',author:'Lee',rating:4});view.render();
  click('Expand status');filterValue('Show notes with status: active (2)');click('Show 2 filtered notes');click('Toggle search');
  const input=document.querySelector<HTMLInputElement>('[aria-label="Filter properties and values"]')!;
  let previous='Search everything';
  for(const [mode,query,name] of [['Property names','topic','Alpha'],['Values','Lee','Beta'],['Note names / paths','Archive/','Beta'],['Search everything','AJ','Alpha']]) {
    click(`Search in: ${previous}`);(Menu as any).items.find((item:any)=>item.title===mode).run();previous=mode;
    input.value=query;input.dispatchEvent(new Event('input'));
    const notes=[...document.querySelectorAll('.pv-filter-note')];expect(notes).toHaveLength(1);expect(notes[0].textContent).toContain(name);
    expect((view as any).filterPaths().size).toBe(2);
  }
});


it.each([false,true])('counts distinct search-matching notes per property and value (inline=%s)', inline => {
  if(inline) enableInlineView();
  const index=inline?plugin.inline.index:plugin.index;
  index.update('Projects/Count A.md',{category:['design','design systems'],status:'counted'});
  index.update('Archive/Count B.md',{category:['design','writing'],status:'counted'});
  index.update('Archive/Count C.md',{category:['writing'],status:'counted'});view.render();
  click('Toggle search');
  const input=document.querySelector<HTMLInputElement>('[aria-label="Filter properties and values"]')!;
  let previous='Search everything';
  for(const [mode,query,propertyCount,value,valueCount] of [
    ['Values','design',2,'design',2],
    ['Search everything','design',2,'design systems',1],
    ['Note names / paths','Projects/Count',1,'design',1],
    ['Search everything','Projects/Count',1,'design',1],
    ['Property names','category',3,'writing',2]
  ] as const) {
    click(`Search in: ${previous}`);(Menu as any).items.find((item:any)=>item.title===mode).run();previous=mode;
    input.value=query;input.dispatchEvent(new Event('input'));
    expect(document.querySelector(`[aria-label="Toggle category (${propertyCount})"] .pv-count`)!.textContent).toBe(String(propertyCount));
    expect(document.querySelector(`[aria-label="Show notes with category: ${value} (${valueCount})"] .pv-count`)!.textContent).toBe(String(valueCount));
    click('Collapse all properties');expect(document.querySelector(`[aria-label="Toggle category (${propertyCount})"]`)).not.toBeNull();
  }
  input.value='';input.dispatchEvent(new Event('input'));click('Expand category');
  expect(document.querySelector('[aria-label="Toggle category (3)"]')).not.toBeNull();
  filterValue('Show notes with category: design (2)');
  click(`Search in: ${previous}`);(Menu as any).items.find((item:any)=>item.title==='Note names / paths').run();
  input.value='Projects/Count';input.dispatchEvent(new Event('input'));
  expect(document.querySelector('[aria-label="Toggle status (1)"]')).not.toBeNull();
  expect(document.querySelector('[aria-label="Show notes with status: counted (1)"]')).not.toBeNull();
  expect(index.properties.get('category').paths.size).toBe(3);
  expect((view as any).filterPaths().size).toBe(2);
});


it.each([
  [false,false,'Note names / paths'], [true,false,'Note names / paths'],
  [false,true,'Search everything'], [true,true,'Search everything']
])('expands progressively after collapsing a note search (inline=%s, filtered=%s, mode=%s)', (inline, filtered, mode) => {
  if(inline) enableInlineView();
  if(filtered) {click('Expand status');filterValue(`Show notes with status: ${inline?'inline only':'Done'} (1)`);}
  click('Toggle search');click('Search in: Search everything');
  (Menu as any).items.find((item:any)=>item.title===mode).run();
  const input=document.querySelector<HTMLInputElement>('[aria-label="Filter properties and values"]')!;
  input.value=inline?'Inline':'Projects/';input.dispatchEvent(new Event('input'));
  const property=inline?'author':filtered?'tags':'status';
  const value=inline?'AJ':filtered?'work':'Done';
  expect(document.querySelectorAll('.pv-file').length).toBeGreaterThan(0);
  // An explicitly opened branch must also be reset by Collapse all.
  click(`Collapse notes for ${property}: ${value}`);click(`Expand notes for ${property}: ${value}`);
  click('Collapse all properties');click(`Expand ${property}`);
  expect(document.querySelectorAll('.pv-values')).toHaveLength(1);
  expect(document.querySelectorAll('.pv-file')).toHaveLength(0);
  view.render();expect(document.querySelectorAll('.pv-file')).toHaveLength(0);
  click(`Expand notes for ${property}: ${value}`);
  expect(document.querySelectorAll('.pv-file')).toHaveLength(1);
  if (document.querySelector('[aria-label="Expand all properties"]')) click('Expand all properties');
  click('Collapse all properties');click('Expand all properties');
  expect(document.querySelectorAll('.pv-file')).toHaveLength(0);
  input.value=inline?'Inline.md':'Projects/One';input.dispatchEvent(new Event('input'));
  expect(document.querySelectorAll('.pv-file').length).toBeGreaterThan(0);
});

it('disables and restores browser tooltips while preserving accessible controls', () => {
  const picker=document.querySelector<HTMLButtonElement>('[aria-label="Property view"]')!;
  expect(picker.title).toContain('All properties');
  plugin.prefs.showTooltips=false;view.render();
  expect(document.querySelectorAll('.pv-view [title]')).toHaveLength(0);
  expect(picker.getAttribute('aria-label')).toBe('Property view');
  expect(picker.getAttribute('data-tooltip-classes')).toContain('pv-tooltip-disabled');
  click('Choose properties to show');
  expect(document.querySelectorAll('.pv-scope-panel [title]')).toHaveLength(0);
  click('Expand status');filterValue('Show notes with status: Done (1)');click('Show 1 filtered note');
  expect(document.querySelector('.pv-filter-note')!.hasAttribute('title')).toBe(false);
  expect(document.querySelector('.pv-filter-note')!.getAttribute('aria-label')).toContain('One');
  click('Property view');
  expect(document.querySelector('.pv-view-menu')!.getAttribute('data-tooltip-classes')).toContain('pv-tooltip-disabled');
  click('Property view');
  plugin.prefs.showTooltips=true;view.render();
  expect(picker.title).toContain('All properties');
  expect(picker.hasAttribute('data-tooltip-classes')).toBe(false);
  expect(document.querySelector('.pv-filter-note')!.getAttribute('title')).toBe('Projects/One.md');
});

it('inherits All properties pins but isolates pin/unpin overrides in saved views', () => {
  plugin.prefs.profiles=[{id:'books',name:'Books',keys:['status','tags']},{id:'work',name:'Work',keys:['status','tags']}];view.render();
  const pin = (property: string, action: string) => {
    const row=[...document.querySelectorAll<HTMLElement>('.pv-property-row .pv-node')].find(row=>row.querySelector('.pv-label')!.textContent===property)!;
    row.dispatchEvent(new MouseEvent('contextmenu'));
    (Menu as any).items.find((item:any)=>item.title===action).run();
  };
  const pinned = () => [...document.querySelectorAll('.pv-property-row .pv-node')].filter(row=>row.querySelector('.pv-pin')).map(row=>row.querySelector('.pv-label')!.textContent);
  pin('tags','Pin property');expect(plugin.prefs.pinned).toEqual(['tags']);
  chooseView('profile:books');expect(pinned()).toEqual(['tags']);
  pin('status','Pin property');pin('tags','Unpin property');expect(pinned()).toEqual(['status']);
  expect(plugin.prefs.pinned).toEqual(['tags']);
  chooseView('profile:work');expect(pinned()).toEqual(['tags']);
  chooseView('all');expect(pinned()).toEqual(['tags']);
  pin('status','Pin property');chooseView('profile:work');expect(pinned()).toEqual(['status','tags']);
  chooseView('profile:books');expect(pinned()).toEqual(['status']);
  click('Choose properties to show');nameProfile('Reading');click('Rename active profile');
  expect(pinned()).toEqual(['status']);
  expect(plugin.prefs.profiles[0].pinOverrides).toEqual({status:true,tags:false});
});
it('keeps custom-selection pins local and carries them into a new saved view', () => {
  click('Choose properties to show');click('Clear property selection');click('Include status');
  document.querySelector('[aria-label="Toggle status (2)"]')!.dispatchEvent(new MouseEvent('contextmenu'));
  (Menu as any).items.find((item:any)=>item.title==='Pin property').run();
  expect(plugin.prefs.pinned).toEqual([]);expect(plugin.prefs.customPinOverrides).toEqual({status:true});
  nameProfile('Tasks');click('Save selection as new profile');expect(plugin.prefs.profiles[0].pinOverrides).toEqual({status:true});
  chooseView('all');expect(document.querySelector('.pv-pin')).toBeNull();
});

it('routes inline edits and search to inline handlers and keeps pins/hiding separate', async () => {
  plugin.editInline=vi.fn();enableInlineView();
  const property=plugin.inline.index.properties.get('author');
  expect((view as any).queryFor(property,property)).toBe('line:("author" "::")');
  const menu=()=>document.querySelector('[aria-label="Toggle author (1)"]')!.dispatchEvent(new MouseEvent('contextmenu'));
  menu();(Menu as any).items.find((item:any)=>item.title==='Rename property…').run();expect(plugin.editInline).toHaveBeenCalledWith(property,'rename-property');
  menu();(Menu as any).items.find((item:any)=>item.title==='Pin property').run();expect(plugin.prefs.inlineViews.pinned).toEqual(['author']);expect(plugin.prefs.pinned).toEqual([]);
  menu();(Menu as any).items.find((item:any)=>item.title==='Hide property').run();expect(plugin.prefs.inlineViews.hidden).toContain('author');expect(plugin.prefs.hidden).toBe('');
  expect(document.querySelector('[aria-label="Toggle author (1)"]')).toBeNull();
});

it('scopes inline conversion to Value and folder filters while tree search stays display-only', () => {
  enableInlineView();plugin.convertInline=vi.fn();
  plugin.inline.index.update('Books/A.md',{author:['AJ'],status:['active']});
  plugin.inline.index.update('Books/B.md',{author:['AJ'],status:['closed']});
  plugin.inline.index.update('Other/C.md',{author:['AJ'],status:['active']});
  (view as any).filter={property:'status',value:JSON.stringify(['string','active']),propertyLabel:'status',label:'active'};
  // Inline text IDs use the same typed identity as the index.
  const status=plugin.inline.index.properties.get('status')!;
  (view as any).filter.value=[...status.values.values()].find((v:any)=>v.label==='active')!.id;
  (view as any).setFolders(['Books']);
  (view as any).searchScope='note';(view as any).query='unmatched';view.render();
  const property=(view as any).activeIndex().properties.get('author');
  (view as any).showMenu(new MouseEvent('contextmenu'),property,property);
  (Menu as any).items.find((item:any)=>item.title==='Convert to YAML property…').run();
  expect(plugin.convertInline).toHaveBeenCalledWith(property,['Books/A.md']);
});

function setFolders(folders:string[]) { (view as any).setFolders(folders); }
it('filters the tree and counts and provides removable folder chips and Clear',()=>{
 setFolders(['Projects']);expect(document.querySelector('[aria-label="Toggle status (1)"]')).not.toBeNull();
 expect(document.querySelector('.pv-summary')!.textContent).toBe('2 properties · Filtered (1 note)');
 click('Expand status');expect(document.querySelector('.pv-tree')!.textContent).not.toContain('Pending');
 click('Choose properties to show');expect(document.querySelector('.pv-folder-row')!.textContent).toContain('Projects');
 nameProfile('Keep this name');click('Clear folder filter');expect(plugin.prefs.folders).toEqual([]);expect(document.querySelector<HTMLInputElement>('[aria-label="Profile name"]')!.value).toBe('Keep this name');
 expect(document.querySelector('[aria-label="Toggle status (2)"]')).not.toBeNull();expect(document.querySelector('.pv-folder-bar')).toBeNull();
});
it('uses the fuzzy folder chooser, absorbs descendants and preserves the view-name input',()=>{
 plugin.prefs.excludedFolders='Templates';click('Choose properties to show');nameProfile('Books');click('Add folder filter');
 let modal=(globalThis as any).folderSuggester;expect(modal.getItems()).toEqual(['Books','Books/Sub','Other','Projects']);modal.onChooseItem('Books/Sub');
 click('Add folder filter');modal=(globalThis as any).folderSuggester;expect(modal.getItems()).toContain('Books');expect(modal.getItems()).not.toContain('Books/Sub');modal.onChooseItem('Books');expect(plugin.prefs.folders).toEqual(['Books']);
 expect(document.querySelector<HTMLInputElement>('[aria-label="Profile name"]')!.value).toBe('Books');
});
it('allows all-properties folder views and compares saved folders without using scoped keys',()=>{
 plugin.index.update('Other/A.md',{onlyOutside:'value'});setFolders(['Projects']);click('Choose properties to show');nameProfile('Project notes');click('Save selection as new profile');
 const profile=plugin.prefs.profiles[0];expect(profile.folders).toEqual(['Projects']);expect(profile.keys).toContain('onlyoutside');expect(document.querySelector('.pv-profile-select')!.textContent).not.toContain('modified');
 setFolders(['Projects','Other']);expect(document.querySelector('.pv-profile-select')!.textContent).toContain('modified');click('Update active profile selection');expect(profile.folders).toEqual(['Other','Projects']);
 setFolders(['Projects','Other']);expect(document.querySelector('.pv-profile-select')!.textContent).not.toContain('modified');
 chooseView('all');expect(plugin.prefs.folders).toEqual([]);chooseView(`profile:${profile.id}`);expect(plugin.prefs.folders).toEqual(['Other','Projects']);
});
it('clears folders when applying legacy or built-in views and retains them when deleting a saved view',()=>{
 plugin.prefs.profiles=[{id:'old',name:'Old',keys:['status']}];setFolders(['Projects']);chooseView('profile:old');expect(plugin.prefs.folders).toEqual([]);
 setFolders(['Projects']);click('Choose properties to show');click('Delete active profile');expect(plugin.prefs.folders).toEqual(['Projects']);expect(plugin.prefs.activeProfile).toBeNull();
 chooseView('all');expect(plugin.prefs.folders).toEqual([]);
});
it('intersects folder and Value filters, with independent clear actions',()=>{
 plugin.index.update('Other/Done.md',{status:'Done',tags:'other'});setFolders(['Projects']);click('Expand status');filterValue('Show notes with status: Done (1)');
 expect((view as any).filterPaths()).toEqual(new Set(['Projects/One.md']));expect(document.querySelector('.pv-summary')!.textContent).toContain('Filtered (1 note)');
 click('Choose properties to show');click('Clear folder filter');expect((view as any).filterPaths()).toEqual(new Set(['Projects/One.md','Other/Done.md']));
 setFolders(['Projects']);click('Clear property filter');expect(plugin.prefs.folders).toEqual(['Projects']);expect((view as any).activeIndex().properties.has('status')).toBe(true);
});
it('keeps stale or excluded folder chips and shows the empty-scope message',()=>{
 setFolders(['Missing']);click('Choose properties to show');expect(document.querySelector('.pv-folder-chip.is-unavailable')!.textContent).toContain('Missing');expect(document.querySelector('.pv-empty')!.textContent).toBe('No notes in the selected folders.');
 setFolders(['Projects']);plugin.prefs.excludedFolders='Projects';view.render();expect(plugin.prefs.folders).toEqual(['Projects']);expect(document.querySelector('.pv-folder-chip.is-unavailable')).not.toBeNull();expect(document.querySelector('.pv-empty')!.textContent).toBe('No notes in the selected folders.');
});
it('keeps YAML and Inline folder selections and saved views independent',()=>{
 setFolders(['Projects']);enableInlineView();plugin.inline.index.update('Books/A.md',{author:'AJ'});setFolders(['Books']);click('Choose properties to show');nameProfile('Books');click('Save selection as new profile');
 const profile=plugin.prefs.inlineViews.profiles[0];expect(profile.folders).toEqual(['Books']);expect(plugin.prefs.folders).toEqual(['Projects']);
 chooseView('all');expect(plugin.prefs.folders).toEqual([]);expect(plugin.prefs.inlineViews.folders).toEqual(['Books']);
 chooseView(`inline:profile:${profile.id}`);expect((view as any).filterPaths()).toEqual(new Set(['Books/A.md']));chooseView('inline');expect(plugin.prefs.inlineViews.folders).toEqual([]);
});
it('passes folder-scoped nodes to copy and edit menus while leaving native Search vault-wide',async()=>{
 setFolders(['Projects']);plugin.renameProperty=vi.fn();plugin.deleteProperty=vi.fn();plugin.editValue=vi.fn();const copy=vi.spyOn(view as any,'copy').mockResolvedValue(undefined);
 const property=(view as any).activeIndex().properties.get('status');(view as any).showMenu(new MouseEvent('contextmenu'),property,property);
 (Menu as any).items.find((i:any)=>i.title==='Copy matching note links').run();expect(copy).toHaveBeenCalledWith('[[Projects/One]]');
 (Menu as any).items.find((i:any)=>i.title==='Rename property…').run();expect([...plugin.renameProperty.mock.calls[0][0].paths]).toEqual(['Projects/One.md']);
 (Menu as any).items.find((i:any)=>i.title==='Delete property…').run();expect([...plugin.deleteProperty.mock.calls[0][0].paths]).toEqual(['Projects/One.md']);
 const value=[...property.values.values()][0];(view as any).showMenu(new MouseEvent('contextmenu'),property,value);(Menu as any).items.find((i:any)=>i.title==='Rename value…').run();expect([...plugin.editValue.mock.calls[0][1].paths]).toEqual(['Projects/One.md']);
 expect((view as any).queryFor(property,value)).not.toContain('Projects');
 (view as any).query='unmatched';(view as any).searchScope='note';view.render();expect([...((view as any).activeIndex().properties.get('status').paths)]).toEqual(['Projects/One.md']);
});

it('keeps pins local to an all-properties folder selection and resets folder scope on inline fallback',()=>{
 setFolders(['Projects']);const property=(view as any).activeIndex().properties.get('status');(view as any).showMenu(new MouseEvent('contextmenu'),property,property);(Menu as any).items.find((i:any)=>i.title==='Pin property').run();expect(plugin.prefs.pinned).toEqual([]);expect(plugin.prefs.customPinOverrides).toEqual({status:true});
 enableInlineView();plugin.prefs.showInlineProperties=false;view.render();expect(plugin.prefs.folders).toEqual([]);
});


it.each([false,true])('keeps folder paths inside the closed picker for inline=%s',inline=>{
 if(inline){enableInlineView();plugin.inline.index.update('Projects/Inline.md',{status:'active'});}
 setFolders(['Projects']);expect(document.querySelector('.pv-folder-bar')).toBeNull();expect(document.querySelector('.pv-folder-chip')).toBeNull();
 expect(document.querySelector('.pv-summary')!.textContent).toContain('Filtered');
 click('Choose properties to show');expect(document.querySelector('.pv-folder-row')!.textContent).toContain('Projects');expect(document.querySelector('[aria-label="Clear folder filter"]')).not.toBeNull();
 click('Choose properties to show');expect((document.querySelector('.pv-scope-panel') as HTMLElement).hidden).toBe(true);expect((view as any).filterPaths().size).toBeGreaterThan(0);
});

it('sorts linked values by resolved basename and expanded notes by filename in both directions',()=>{
 plugin.index=new PropertyIndex();
 plugin.index.update('Z/2026-W9.md',{weekly:'[[Journal/2026-W21|This week]]'});
 plugin.index.update('A/2026-W21.md',{weekly:'[[Journal/2026-W21|This week]]'});
 plugin.index.update('B/2026-W9.md',{weekly:'[[Journal/2026-W21|This week]]'});
 plugin.index.update('Other.md',{weekly:'[[shortcut]]'});
 (view.app as any).metadataCache={getFirstLinkpathDest:(target:string)=>target==='shortcut'?{basename:'2026-W2'}:null};
 plugin.prefs.expanded=['weekly'];
 for(const value of plugin.index.properties.get('weekly').values.values()) (view as any).expandedValues.add(JSON.stringify(['weekly',value.id]));
 view.render();
 expect([...view.contentEl.querySelectorAll('.pv-value-group .pv-label')].map(el=>el.textContent)).toEqual(['[[shortcut]]','[[Journal/2026-W21|This week]]']);
 const paths=()=>[...view.contentEl.querySelectorAll<HTMLElement>('.pv-file')].map(el=>el.dataset.notePath);
 expect(paths()).toEqual(['Other.md','B/2026-W9.md','Z/2026-W9.md','A/2026-W21.md']);
 plugin.prefs.sort='name-desc';view.render();
 expect(paths()).toEqual(['A/2026-W21.md','Z/2026-W9.md','B/2026-W9.md','Other.md']);
});
it('opens bulk dialogs with only the derived YAML node paths and omits both actions in Inline',()=>{
 plugin.openBulkProperties=vi.fn();plugin.includesPath=()=>true;
 const files=new Map(['Projects/One.md','Two.md'].map(path=>[path,Object.assign(new TFile(),{path,extension:'md'})]));(view.app as any).vault.getAbstractFileByPath=(path:string)=>files.get(path);
 setFolders(['Projects']);const property=(view as any).activeIndex().properties.get('status');(view as any).showMenu(new MouseEvent('contextmenu'),property,property);
 (Menu as any).items.find((i:any)=>i.title==='Add properties to these notes…').run();expect(plugin.openBulkProperties.mock.calls[0][1](true).paths).toEqual(['Projects/One.md']);
 const value=[...property.values.values()][0];(view as any).showMenu(new MouseEvent('contextmenu'),property,value);(Menu as any).items.find((i:any)=>i.title==='Remove properties from these notes…').run();expect(plugin.openBulkProperties.mock.calls[1][1](true).paths).toEqual(['Projects/One.md']);
 (view as any).inlineView=true;(view as any).showMenu(new MouseEvent('contextmenu'),property,value);expect((Menu as any).items.some((i:any)=>i.title.startsWith('Add properties')||i.title.startsWith('Remove properties'))).toBe(false);
});

it('limits both property removal options to all 16 path-search matches out of 1045, including collapsed results',()=>{
 plugin.index=new PropertyIndex();const files=new Map<string,TFile>();
 for(let i=0;i<1045;i++){const path=`Calendar/${i<16?'Compass':'Other'}/Note ${i}.md`;plugin.index.update(path,{OMG:'Yes'});files.set(path,Object.assign(new TFile(),{path,extension:'md'}));}
 plugin.deleteProperty=vi.fn();plugin.openBulkProperties=vi.fn();plugin.includesPath=()=>true;
 (view.app as any).vault.getAbstractFileByPath=(path:string)=>files.get(path);
 const property=plugin.index.properties.get('omg'),value=[...property.values.values()][0];const expected=[...files.keys()].filter(path=>path.includes('/Compass/')).sort();
 (view as any).query='calendar/compass';(view as any).searchScope='note';view.render();expect(view.contentEl.querySelector('[aria-label="Toggle OMG (16)"]')).not.toBeNull();
 for(const node of [property,value]){
  (view as any).showMenu(new MouseEvent('contextmenu'),property,node);const items=(Menu as any).items;
  if(node===property){items.find((i:any)=>i.title==='Delete property…').run();expect([...plugin.deleteProperty.mock.calls.at(-1)[0].paths].sort()).toEqual(expected);}
  items.find((i:any)=>i.title==='Remove properties from these notes…').run();expect(plugin.openBulkProperties.mock.calls.at(-1)[1](true).paths).toEqual(expected);
 }
 (view as any).searchExpanded=false;view.render();(view as any).showMenu(new MouseEvent('contextmenu'),property,property);(Menu as any).items.find((i:any)=>i.title==='Delete property…').run();expect(plugin.deleteProperty.mock.calls.at(-1)[0].paths.size).toBe(16);
 expect(property.paths.size).toBe(1045);expect(value.paths.size).toBe(1045);
 (view as any).query='';view.render();(view as any).showMenu(new MouseEvent('contextmenu'),property,property);(Menu as any).items.find((i:any)=>i.title==='Delete property…').run();expect(plugin.deleteProperty.mock.calls.at(-1)[0].paths.size).toBe(1045);
});
it('uses row search semantics for removal scopes across property, value, and everything search',()=>{
 const property=plugin.index.properties.get('status');
 (view as any).query='done';(view as any).searchScope='value';expect([...(view as any).searchMatchingPaths(property,property)]).toEqual(['Projects/One.md']);
 (view as any).query='status';(view as any).searchScope='key';expect((view as any).searchMatchingPaths(property,property).size).toBe(2);
 (view as any).query='projects/';(view as any).searchScope='any';expect([...(view as any).searchMatchingPaths(property,property)]).toEqual(['Projects/One.md']);
 (view as any).query='missing';expect((view as any).searchMatchingPaths(property,property).size).toBe(0);
});

import {ValueEditor} from '../src/value-editor';
import {BulkPropertiesService} from '../src/bulk-properties-service';
it.each(['delete','remove'] as const)('writes and undoes only 16 searched notes through the %s property action',async(action)=>{
 plugin.index=new PropertyIndex();const files=new Map<string,TFile>(),disk=new Map<string,string>();
 for(let i=0;i<1045;i++){const path=`Calendar/${i<16?'Compass':'Other'}/Note ${i}.md`;plugin.index.update(path,{OMG:'Yes',other:'keep'});files.set(path,Object.assign(new TFile(),{path,extension:'md'}));disk.set(path,'---\n'+JSON.stringify({OMG:'Yes',other:'keep'})+'\n---\nBody\n');}
 const original=new Map(disk),read=(path:string)=>JSON.parse(disk.get(path)!.split('\n')[1]);
 const process=vi.fn(async(path:string,update:any)=>{const fm=read(path);update(fm);disk.set(path,'---\n'+JSON.stringify(fm)+'\n---\nBody\n');});
 const app:any=view.app;app.vault.getAbstractFileByPath=(path:string)=>files.get(path);app.metadataCache={getFileCache:(file:TFile)=>({frontmatter:read(file.path)})};app.fileManager={processFrontMatter:(file:TFile,update:any)=>process(file.path,update)};
 const editor=new ValueEditor(app);plugin.includesPath=()=>true;plugin.deleteProperty=vi.fn();plugin.openBulkProperties=vi.fn();
 (view as any).query='calendar/compass';(view as any).searchScope='note';const property=(view as any).activeIndex().properties.get('omg');
 (view as any).showMenu(new MouseEvent('contextmenu'),property,property);
 if(action==='delete'){
  (Menu as any).items.find((i:any)=>i.title==='Delete property…').run();const scoped=plugin.deleteProperty.mock.calls[0][0];const plan=editor.previewPropertyDelete(scoped.label,scoped.paths);expect(plan.total).toBe(16);expect((await editor.apply(plan)).updated).toBe(16);
 }else{
  (Menu as any).items.find((i:any)=>i.title==='Remove properties from these notes…').run();const scope=plugin.openBulkProperties.mock.calls[0][1](true);const service=new BulkPropertiesService({eligible:path=>files.has(path),frontmatter:read,configuredType:()=>undefined,process},editor);const plan=service.preview(scope.paths,{keys:['OMG']});expect(plan.notes.filter(n=>n.changes.length)).toHaveLength(16);await service.apply(plan);
 }
 expect(process).toHaveBeenCalledTimes(16);for(const [path,text]of disk)if(path.includes('/Compass/'))expect(read(path)).toEqual({other:'keep'});else expect(text).toBe(original.get(path));
 expect((await editor.undo()).restored).toBe(16);for(const [path,text]of disk){expect(read(path)).toEqual({OMG:'Yes',other:'keep'});if(!path.includes('/Compass/'))expect(text).toBe(original.get(path));}expect(process).toHaveBeenCalledTimes(32);
});
