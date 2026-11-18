// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => ({
  Modal: class {},
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
  const app = { vault: { getAbstractFileByPath: () => new TFile() }, workspace: { getLeaf: () => ({ openFile }) } };
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
it('clears search when collapsing all and preserves scoped selection', () => {
  plugin.prefs.scope = ['status'];
  click('Toggle search');
  const input = document.querySelector('input')!; input.value = 'Done'; input.dispatchEvent(new Event('input'));
  click('Collapse all properties'); expect(input.value).toBe('');
  expect(document.querySelectorAll('.pv-values')).toHaveLength(0); expect(plugin.prefs.scope).toEqual(['status']);
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

function chooseView(value: string) {
  const select = document.querySelector('[aria-label="Property view"]') as HTMLSelectElement;
  select.value = value; select.dispatchEvent(new Event('change'));
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
  expect(dropdown.selectedOptions[0].textContent).toBe('All properties (2)');
  plugin.prefs.profiles = [{ id: 'writing', name: 'Writing', keys: ['status', 'future'] }];
  chooseView('all');
  chooseView('profile:writing');
  expect(dropdown.selectedOptions[0].textContent).toBe('Writing (1)');
  plugin.index.update('Future.md', { future: 'yes' }); view.render();
  expect(dropdown.selectedOptions[0].textContent).toBe('Writing (2)');
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
  (Menu as any).items.find((item: any) => item.title === 'Filter by this value').run();
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
  expect((Menu as any).items.some((item: any) => item.title === 'Filter by this value')).toBe(false);
  plugin.index.update('Empty.md', { status: null }); view.render(); click('Expand status');
  const button = document.querySelector('[aria-label="Show notes with status: (empty) (1)"]') as HTMLElement;
  button.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true }));
  (Menu as any).items.find((item: any) => item.title === 'Filter by this value').run();
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
    expect((Menu as any).items.some((item: any) => item.title === 'Filter by this value')).toBe(true);
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

it('shows the full filter note list independently of tree search and resets disclosure on clear', () => {
  click('Expand status'); filterValue('Show notes with status: Done (1)');
  click('Show 1 filtered note');
  expect(document.querySelectorAll('.pv-filter-note')).toHaveLength(1);
  expect(document.querySelector('.pv-filter-note')!.textContent).toContain('One');
  click('Toggle search'); const input=document.querySelector('.pv-filter') as HTMLInputElement;
  input.value='no match'; input.dispatchEvent(new Event('input'));
  expect(document.querySelectorAll('.pv-filter-note')).toHaveLength(1);
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
