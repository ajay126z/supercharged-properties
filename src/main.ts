import { ItemView, Menu, Notice, Plugin, PluginSettingTab, Setting, TFile, WorkspaceLeaf, setIcon } from 'obsidian';
import { fold, natural, PropertyIndex, PropertyNode, ValueNode } from './index';

import { fitVisibleViewport, usesTouchLayout } from './mobile-layout';
import { excludedFolders, isFolderExcluded } from './folder-exclusions';
import { SortOrder, sortOptions, sortOrder, sortNodes } from './sorting';
import { propertyQuery } from './search';
import { loadProfiles, sameKeys, PropertyProfile } from './profiles';
import { PropertyTypeResolver, supportsTextSplit } from './property-types';
import { ValueEditor, type ValueEditPreview, type ValueEditResult } from './value-editor';
import { PropertyRenameModal } from './property-rename-dialog';
import { includeRenamedProperty } from './property-rename';
import { ValueEditModal } from './value-dialog';
import { isWikilink, type ValueEditMode, type ValueEditRequest } from './value-operations';
import type { PropertyValueKind } from './frontmatter-values';

const VIEW = 'supercharged-properties';
interface Preferences { counts: boolean; sort: SortOrder; hidden: string; excludedFolders: string; expanded: string[]; pinned: string[]; scope: string[] | null; profiles: PropertyProfile[]; activeProfile: string | null }
const defaults: Preferences = { counts: true, sort: 'name', hidden: '', excludedFolders: '', expanded: [], pinned: [], scope: null, profiles: [], activeProfile: null };

export default class SuperchargedPropertiesPlugin extends Plugin {
  index = new PropertyIndex();
  prefs: Preferences = { ...defaults };
  typeResolver!: PropertyTypeResolver;
  valueEditor!: ValueEditor;
  private timer: number | undefined;
  private rebuildTimer: number | undefined;
  private saveQueue: Promise<void> = Promise.resolve();

  async onload(): Promise<void> {
    const loaded: unknown = await this.loadData();
    const saved = loaded && typeof loaded === 'object' && !Array.isArray(loaded) ? loaded as Record<string, unknown> : {};
    const profiles = loadProfiles(saved?.profiles);
    this.prefs = {
      profiles,
      activeProfile: typeof saved.activeProfile === 'string' && profiles.some(profile => profile.id === saved.activeProfile) ? saved.activeProfile : null,
      scope: Array.isArray(saved?.scope) ? saved.scope.filter((v: unknown) => typeof v === 'string') : null,
      pinned: Array.isArray(saved?.pinned) ? saved.pinned.filter((v: unknown) => typeof v === 'string') : [],
      counts: typeof saved?.counts === 'boolean' ? saved.counts : true,
      sort: sortOrder(saved?.sort),
      excludedFolders: typeof saved.excludedFolders === 'string' ? saved.excludedFolders : '',
      hidden: typeof saved?.hidden === 'string' ? saved.hidden : '',
      expanded: Array.isArray(saved?.expanded) ? saved.expanded.filter((v: unknown) => typeof v === 'string') : []
    };
    this.typeResolver = new PropertyTypeResolver(this.app);
    await this.typeResolver.load();
    this.valueEditor = new ValueEditor(this.app, path => this.includesPath(path));
    this.registerView(VIEW, leaf => new PropertiesView(leaf, this));
    this.addRibbonIcon('list-tree', 'Open Supercharged Properties', () => { void this.open(); });
    this.addCommand({ id: 'open', name: 'Open sidebar', callback: () => { void this.open(); } });
    this.addCommand({ id: 'open-tab', name: 'Open in tab', callback: () => { void this.openTab(); } });
    this.addCommand({ id: 'rebuild', name: 'Refresh property index', callback: () => this.rebuild() });
    this.addCommand({
      id: 'undo-value-edit',
      name: 'Undo last property edit',
      checkCallback: checking => {
        if (!this.valueEditor.canUndo()) return false;
        if (!checking) void this.undoValueEdit();
        return true;
      }
    });
    this.addSettingTab(new PreferencesTab(this));
    this.registerEvent(this.app.metadataCache.on('changed', (file, _data, cache) => {
      this.updateIndexedNote(file.path, cache.frontmatter);
      this.refresh();
    }));
    this.registerEvent(this.app.metadataCache.on('resolved', () => this.scheduleRebuild()));
    this.registerEvent(this.app.vault.on('create', file => {
      if (file instanceof TFile && file.extension === 'md' && this.includesPath(file.path)) {
        // Metadata may not be available yet; the cache changed event completes indexing.
        const cache = this.app.metadataCache.getFileCache(file);
        if (cache) { this.updateIndexedNote(file.path, cache.frontmatter); this.refresh(); }
      }
    }));
    this.registerEvent(this.app.vault.on('delete', file => {
      if (file instanceof TFile) { this.index.remove(file.path); this.refresh(); }
      else this.scheduleRebuild();
    }));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      if (file instanceof TFile) {
        this.index.remove(oldPath);
        if (file.extension === 'md' && this.includesPath(file.path)) this.updateIndexedNote(file.path, this.app.metadataCache.getFileCache(file)?.frontmatter);
        this.refresh();
      } else this.scheduleRebuild();
    }));
    this.register(() => { window.clearTimeout(this.timer); window.clearTimeout(this.rebuildTimer); });
    this.app.workspace.onLayoutReady(() => this.rebuild());
  }

  includesPath(path: string): boolean {
    return !isFolderExcluded(path, excludedFolders(this.prefs.excludedFolders));
  }

  private updateIndexedNote(path: string, frontmatter?: Record<string, unknown>): void {
    if (this.includesPath(path)) this.index.update(path, frontmatter);
    else this.index.remove(path);
  }

  async setExcludedFolders(value: string): Promise<void> {
    this.prefs.excludedFolders = value;
    this.rebuild();
    await this.save();
  }

  private scheduleRebuild(): void {
    window.clearTimeout(this.rebuildTimer);
    this.rebuildTimer = window.setTimeout(() => this.rebuild(), 150);
  }

  rebuild(): void {
    window.clearTimeout(this.rebuildTimer);
    this.index = new PropertyIndex();
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (this.includesPath(file.path)) this.updateIndexedNote(file.path, this.app.metadataCache.getFileCache(file)?.frontmatter);
    }
    void this.reloadTypes();
  }

  async reloadTypes(): Promise<void> {
    await this.typeResolver.load();
    this.refresh();
  }

  refresh(): void {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) {
        if (leaf.view instanceof PropertiesView) leaf.view.render();
      }
    }, 100);
  }

  save(): Promise<void> {
    // Snapshot each update and serialize writes so rapid UI actions cannot overwrite newer settings.
    const snapshot: unknown = JSON.parse(JSON.stringify(this.prefs));
    this.saveQueue = this.saveQueue.then(() => this.saveData(snapshot)).catch(() => {
      new Notice('Could not save Supercharged Properties settings. Check vault permissions and available storage.');
    });
    this.refresh();
    return this.saveQueue;
  }

  async applyValueEdit(preview: ValueEditPreview): Promise<void> {
    const result: ValueEditResult = await this.valueEditor.apply(preview);
    new Notice(`Updated ${result.updated} notes; skipped ${result.unchanged} changed notes; ${result.failures.length} failed. Undo last property edit is available in the command palette.`, 10000);
    for (const failure of result.failures) new Notice(`${failure.path}: ${failure.message}`, 10000);
    this.rebuild();
  }

  async undoValueEdit(): Promise<void> {
    const result = await this.valueEditor.undo();
    new Notice(`Restored ${result.restored} notes; skipped ${result.skipped} later edits; ${result.failures.length} failed.`, 10000);
    for (const failure of result.failures) new Notice(`${failure.path}: ${failure.message}`, 10000);
    this.rebuild();
  }

  renameProperty(property: PropertyNode): void {
    new PropertyRenameModal(this.app, {
      property: property.label,
      preview: target => this.valueEditor.previewPropertyRename(property.id, target, this.index.properties.get(property.id)?.paths ?? []),
      apply: async preview => {
        const result = await this.valueEditor.apply(preview);
        if (result.updated) {
          includeRenamedProperty(this.prefs, preview.source, preview.target);
          await this.save();
        }
        new Notice(`Renamed in ${result.updated} notes; skipped ${preview.conflicts.length + result.unchanged}; ${result.failures.length} failed. Use Undo last property edit to restore the last batch.`, 10000);
        for (const failure of result.failures) new Notice(`${failure.path}: ${failure.message}`, 10000);
        this.rebuild();
      }
    }).open();
  }

  editValue(property: PropertyNode, node: ValueNode, mode: ValueEditMode): void {
    const [kind] = JSON.parse(node.id) as [PropertyValueKind, string];
    if (mode === 'split' && (kind !== 'string' || !supportsTextSplit(property, this.typeResolver))) return;
    const request: ValueEditRequest = { property: property.id, kind, value: node.label, mode, replacement: node.label };
    const siblings = [...property.values.values()].filter(value => value !== node && (JSON.parse(value.id) as string[])[0] === kind).map(value => value.label);
    new ValueEditModal(this.app, {
      request: mode === 'merge' ? { ...request, replacement: siblings[0] } : request,
      siblings,
      preview: edit => edit.mode === 'split' && !supportsTextSplit(property, this.typeResolver)
        ? { total: 0, changes: [] } : this.valueEditor.preview(edit, node.paths),
      apply: preview => {
        if (mode === 'split' && !supportsTextSplit(property, this.typeResolver)) {
          new Notice('Split into list is only available for text properties.');
          return Promise.resolve();
        }
        return this.applyValueEdit(preview);
      }
    }).open();
  }

  async openTab(): Promise<void> {
    const leaf = this.app.workspace.getLeaf('tab');
    await leaf.setViewState({ type: VIEW, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  async open(): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(VIEW)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
  }
}

function el<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  return parent.createEl(tag, { cls, text });
}

export class PropertiesView extends ItemView {
  private disposeViewport: (() => void) | undefined;
  private query = '';
  private searchScope = 'any';
  private searchHeader!: HTMLElement;
  private searchToggle!: HTMLButtonElement;
  private searchScopeButton!: HTMLButtonElement;
  private body!: HTMLElement;
  private summary!: HTMLElement;
  private scopeButton!: HTMLButtonElement;
  private scopePanel!: HTMLElement;
  private scopeChoices!: HTMLElement;
  private profileSelect!: HTMLSelectElement;
  private profileName!: HTMLInputElement;
  private profileUpdate!: HTMLButtonElement;
  private profileRename!: HTMLButtonElement;
  private profileDelete!: HTMLButtonElement;
  private scopeQuery = '';
  private sortButton!: HTMLButtonElement;
  private expandToggle!: HTMLButtonElement;
  private visibleKeys: string[] = [];
  private allExpanded = false;
  private expandedValues = new Set<string>();
  private limits = new Map<string, number>();
  private input!: HTMLInputElement;

  constructor(leaf: WorkspaceLeaf, private plugin: SuperchargedPropertiesPlugin) { super(leaf); }
  getViewType(): string { return VIEW; }
  getDisplayText(): string { return 'Supercharged Properties'; }
  getIcon(): string { return 'list-tree'; }

  async onOpen(): Promise<void> {
    this.contentEl.replaceChildren();
    this.contentEl.classList.add('pv-view');
    this.disposeViewport?.();
    this.disposeViewport = fitVisibleViewport(this.contentEl);
    const toolbar = el(this.contentEl, 'div', 'pv-toolbar');
    this.searchHeader = el(toolbar, 'div', 'pv-search-header');
    this.searchHeader.hidden = true;
    const search = el(this.searchHeader, 'div', 'pv-search');
    setIcon(el(search, 'span', 'pv-icon'), 'search');
    this.input = el(search, 'input', 'pv-filter');
    this.input.type = 'search'; this.input.placeholder = 'Find properties, values, notes…';
    this.input.setAttribute('aria-label', 'Filter properties and values');
    this.input.addEventListener('input', () => { this.query = fold(this.input.value); this.render(); });
    this.searchScopeButton = this.iconButton(this.searchHeader, 'Search in: Search everything', 'sliders-horizontal', () => this.openSearchScopeMenu());
    this.searchScopeButton.setAttribute('aria-haspopup', 'menu');
    this.input.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); this.toggleSearch(false); }
    });
    const profileRow = el(toolbar, 'div', 'pv-profile-row');
    this.scopeButton = this.iconButton(profileRow, 'Choose properties to show', 'panels-top-left', () => {
      this.scopePanel.hidden = !this.scopePanel.hidden;
      this.scopeButton.setAttribute('aria-expanded', String(!this.scopePanel.hidden));
      if (!this.scopePanel.hidden) {
        this.renderScope();
        if (!usesTouchLayout(this.contentEl)) this.scopePanel.querySelector('input')?.focus();
      }
    });
    this.scopeButton.setAttribute('aria-expanded', 'false');
    this.profileSelect = el(profileRow, 'select', 'pv-profile-select');
    this.profileSelect.setAttribute('aria-label', 'Property view');
    this.profileSelect.addEventListener('change', () => {
      const value = this.profileSelect.value;
      if (value === 'all') { this.plugin.prefs.scope = null; this.plugin.prefs.activeProfile = null; }
      else if (value !== 'custom') {
        const profile = this.plugin.prefs.profiles.find(item => `profile:${item.id}` === value);
        if (profile) { this.plugin.prefs.scope = [...profile.keys]; this.plugin.prefs.activeProfile = profile.id; }
      } else this.plugin.prefs.activeProfile = null;
      this.query = ''; this.input.value = ''; this.expandedValues.clear();
      void this.plugin.save(); this.plugin.refresh(); this.render();
    });
    const actions = el(toolbar, 'div', 'pv-actions pv-nav-actions');
    toolbar.prepend(actions);
    this.sortButton = this.iconButton(actions, 'Sort properties', 'arrow-up-narrow-wide', () => this.openSortMenu());
    this.sortButton.setAttribute('aria-haspopup', 'menu');
    this.iconButton(actions, 'Refresh property index', 'refresh-cw', () => this.plugin.rebuild());
    this.expandToggle = this.iconButton(actions, 'Expand all properties', 'list-tree', () => {
      if (this.allExpanded) {
        this.query = ''; this.input.value = ''; this.expandedValues.clear();
        this.plugin.prefs.expanded = [];
      } else {
        this.plugin.prefs.expanded = [...new Set([...this.plugin.prefs.expanded, ...this.visibleKeys])];
      }
      void this.plugin.save(); this.render();
    });
    this.searchToggle = this.iconButton(actions, 'Toggle search', 'search', () => this.toggleSearch(this.searchHeader.hidden));
    this.searchToggle.setAttribute('aria-expanded', 'false');
    this.scopePanel = el(toolbar, 'div', 'pv-scope-panel'); this.scopePanel.hidden = true;
    this.summary = el(this.contentEl, 'div', 'pv-summary'); this.summary.setAttribute('aria-live', 'polite');
    this.body = el(this.contentEl, 'div', 'pv-tree');
    this.body.setAttribute('aria-label', 'Properties, values and notes');
    this.contentEl.appendChild(this.summary);
    this.render();
  }

  async onClose(): Promise<void> {
    this.disposeViewport?.();
    this.disposeViewport = undefined;
  }

  private toggleSearch(show: boolean): void {
    this.searchHeader.hidden = !show;
    this.searchToggle.setAttribute('aria-expanded', String(show));
    this.searchToggle.setAttribute('aria-pressed', String(show));
    if (show) this.input.focus();
    else {
      // Hidden search must not silently filter the tree.
      this.query = ''; this.input.value = ''; this.render(); this.searchToggle.focus();
    }
  }
  private openSearchScopeMenu(): void {
    const menu = new Menu();
    for (const [value, label] of [['any', 'Search everything'], ['key', 'Property names'], ['value', 'Values'], ['note', 'Note names / paths']]) {
      menu.addItem(item => item.setTitle(label).setChecked(this.searchScope === value).onClick(() => {
        this.searchScope = value;
        this.searchScopeButton.title = `Search in: ${label}`;
        this.searchScopeButton.setAttribute('aria-label', `Search in: ${label}`);
        this.searchScopeButton.setAttribute('data-filtered', String(value !== 'any'));
        this.render(); this.input.focus();
      }));
    }
    const rect = this.searchScopeButton.getBoundingClientRect();
    menu.showAtPosition({ x: rect.left, y: rect.bottom });
  }
  private button(parent: HTMLElement, label: string, title: string, run: () => void): HTMLButtonElement {
    const button = el(parent, 'button', '', label); button.type = 'button'; button.title = title;
    button.setAttribute('aria-label', title); button.addEventListener('click', run); return button;
  }
  private iconButton(parent: HTMLElement, title: string, icon: string, run: () => void): HTMLButtonElement {
    const button = this.button(parent, '', title, run); button.className = 'pv-icon-button'; setIcon(button, icon); return button;
  }
  private openSortMenu(): void {
    const menu = new Menu();
    for (const [value, label] of Object.entries(sortOptions)) {
      menu.addItem(item => item.setTitle(label).setChecked(this.plugin.prefs.sort === value).onClick(() => {
        this.plugin.prefs.sort = sortOrder(value);
        void this.plugin.save(); this.plugin.refresh(); this.render();
      }));
    }
    const rect = this.sortButton.getBoundingClientRect();
    menu.showAtPosition({ x: rect.left, y: rect.bottom });
  }
  private sorted<T extends ValueNode>(nodes: Iterable<T>): T[] {
    return sortNodes(nodes, this.plugin.prefs.sort);
  }
  private toggleProperty(key: string): void {
    const keys = new Set(this.plugin.prefs.expanded);
    if (keys.has(key)) keys.delete(key); else keys.add(key);
    this.plugin.prefs.expanded = [...keys]; void this.plugin.save(); this.render();
  }
  private renderScope(): void {
    this.scopePanel.replaceChildren();
    const actions = el(this.scopePanel, 'div', 'pv-actions');
    this.button(actions, 'All', 'Show all properties', () => { this.plugin.prefs.scope = null; this.plugin.prefs.activeProfile = null; void this.plugin.save(); this.render(); });
    this.button(actions, 'None', 'Clear property selection', () => { this.plugin.prefs.scope = []; void this.plugin.save(); this.render(); });
    const search = el(this.scopePanel, 'div', 'pv-search pv-picker-search');
    setIcon(el(search, 'span', 'pv-icon'), 'search');
    const input = el(search, 'input', 'pv-filter'); input.type = 'search';
    input.placeholder = 'Find a property…'; input.value = this.scopeQuery;
    input.setAttribute('aria-label', 'Search properties to select');
    input.addEventListener('input', () => { this.scopeQuery = input.value; this.renderScopeChoices(); });
    this.scopeChoices = el(this.scopePanel, 'div', 'pv-scope-choices');
    this.renderScopeChoices();
    el(this.scopePanel, 'p', 'pv-hint', 'Search filters this list only. All / None apply to every property.');
    const manager = el(this.scopePanel, 'div', 'pv-profile-manager');
    el(manager, 'div', 'pv-hint', 'Save this selection as a view');
    this.profileName = el(manager, 'input', 'pv-profile-name'); this.profileName.type = 'text';
    this.profileName.placeholder = 'View name, e.g. Writing'; this.profileName.maxLength = 80;
    this.profileName.setAttribute('aria-label', 'Profile name');
    this.profileName.enterKeyHint = 'done';
    this.profileName.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault();
        this.manageProfile('new');
      }
    });
    const buttons = el(manager, 'div', 'pv-profile-actions');
    this.button(buttons, 'Save new', 'Save selection as new profile', () => this.manageProfile('new'));
    this.profileUpdate = this.button(buttons, 'Update', 'Update active profile selection', () => this.manageProfile('update'));
    this.profileRename = this.button(buttons, 'Rename', 'Rename active profile', () => this.manageProfile('rename'));
    this.profileDelete = this.button(buttons, 'Delete', 'Delete active profile', () => this.manageProfile('delete'));
    this.syncProfiles();
  }
  private syncProfiles(): void {
    const profiles = this.plugin.prefs.profiles;
    const active = profiles.find(profile => profile.id === this.plugin.prefs.activeProfile);
    this.profileSelect.replaceChildren();
    const hidden = new Set(this.plugin.prefs.hidden.split('\n').map(fold).filter(Boolean));
    const count = (keys: Iterable<string>) => new Set([...keys].filter(key => this.plugin.index.properties.has(key) && !hidden.has(key))).size;
    el(this.profileSelect, 'option', '', `All properties (${count(this.plugin.index.properties.keys())})`).value = 'all';
    if (this.plugin.prefs.scope !== null && !active) el(this.profileSelect, 'option', '', `Custom selection (${count(this.plugin.prefs.scope)})`).value = 'custom';
    for (const profile of profiles) {
      const modified = profile === active && !sameKeys(profile.keys, this.plugin.prefs.scope ?? [...this.plugin.index.properties.keys()]);
      el(this.profileSelect, 'option', '', profile.name + (modified ? ' (modified)' : '') + ` (${count(profile === active ? this.plugin.prefs.scope ?? this.plugin.index.properties.keys() : profile.keys)})`).value = `profile:${profile.id}`;
    }
    this.profileSelect.value = active ? `profile:${active.id}` : this.plugin.prefs.scope === null ? 'all' : 'custom';
    if (this.profileUpdate) {
      this.profileUpdate.disabled = !active;
      this.profileRename.disabled = !active;
      this.profileDelete.disabled = !active;
    }
  }
  private manageProfile(action: 'new' | 'update' | 'rename' | 'delete'): void {
    const prefs = this.plugin.prefs;
    const active = prefs.profiles.find(profile => profile.id === prefs.activeProfile);
    const name = this.profileName.value.trim();
    const keys = [...(prefs.scope ?? this.plugin.index.properties.keys())];
    if (action === 'new' || action === 'update') {
      if (!keys.length) { new Notice('Please select at least one property.'); return; }
      if (prefs.scope === null || sameKeys(keys, [...this.plugin.index.properties.keys()])) {
        new Notice('All properties View already exists.'); return;
      }
    }
    if (action === 'new' || action === 'rename') {
      if (!name) { new Notice('Enter a name for this view.'); this.profileName.focus(); return; }
      if (fold(name) === 'all properties') { new Notice('All properties View already exists.'); return; }
      if (prefs.profiles.some(profile => fold(profile.name) === fold(name) && (action === 'new' || profile !== active))) {
        new Notice('A view with that name already exists.'); return;
      }
    }
    if (action === 'new') {
      const id = this.contentEl.ownerDocument.defaultView!.crypto.randomUUID();
      prefs.profiles.push({ id, name, keys }); prefs.activeProfile = id; prefs.scope = [...keys];
    } else if (!active) return;
    else if (action === 'update') { active.keys = keys; prefs.scope = [...keys]; }
    else if (action === 'rename') active.name = name;
    else { prefs.profiles = prefs.profiles.filter(profile => profile !== active); prefs.activeProfile = null; }
    this.profileName.value = '';
    if (usesTouchLayout(this.contentEl) && this.contentEl.ownerDocument.activeElement === this.profileName) {
      this.profileName.blur();
      this.scopeButton.focus({ preventScroll: true });
    }
    void this.plugin.save(); this.plugin.refresh(); this.render();
  }
  private renderScopeChoices(): void {
    if (!this.scopeChoices) return;
    const scroll = this.scopeChoices.scrollTop;
    this.scopeChoices.replaceChildren();
    const choices = new Map([...this.plugin.index.properties.values()].map(property => [property.id, property]));
    for (const key of this.plugin.prefs.scope ?? []) {
      if (!choices.has(key)) choices.set(key, { id: key, label: key, paths: new Set(), values: new Map() });
    }
    const properties = this.sorted(choices.values()).filter(property => fold(property.label).includes(fold(this.scopeQuery)));
    for (const property of properties) {
      const label = el(this.scopeChoices, 'label', 'pv-scope-choice');
      const checkbox = el(label, 'input'); checkbox.type = 'checkbox';
      checkbox.checked = this.plugin.prefs.scope === null || this.plugin.prefs.scope.includes(property.id);
      checkbox.dataset.pvFocus = JSON.stringify(['scope', property.id]);
      checkbox.setAttribute('aria-label', `Include ${property.label}`);
      el(label, 'span', '', property.label);
      checkbox.addEventListener('change', () => {
        const scope = new Set(this.plugin.prefs.scope ?? this.plugin.index.properties.keys());
        if (checkbox.checked) scope.add(property.id); else scope.delete(property.id);
        this.plugin.prefs.scope = [...scope]; void this.plugin.save(); this.render();
      });
    }
    if (!properties.length) el(this.scopeChoices, 'p', 'pv-hint', 'No matching properties.');
    this.scopeChoices.scrollTop = scroll;
  }
  private matches(text: string, scope: string): boolean {
    return (this.searchScope === 'any' || this.searchScope === scope) && fold(text).includes(this.query);
  }
  render(): void {
    if (!this.body) return;
    this.syncProfiles();
    const focusId = (this.contentEl.ownerDocument.activeElement as HTMLElement | null)?.dataset.pvFocus;
    const scroll = this.body.scrollTop; this.body.replaceChildren();
    if (!this.scopePanel.hidden) this.renderScopeChoices();
    const hidden = new Set(this.plugin.prefs.hidden.split('\n').map(fold).filter(Boolean));
    const pinned = new Set(this.plugin.prefs.pinned);
    const scope = this.plugin.prefs.scope;
    const properties = this.sorted(this.plugin.index.properties.values()).filter(p => !hidden.has(p.id) && (scope === null || scope.includes(p.id)))
      .sort((a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id)));
    this.sortButton.title = `Sort: ${sortOptions[this.plugin.prefs.sort]}`;
    let visible = 0;
    this.visibleKeys = [];
    for (const property of properties) {
      const keyMatches = !this.query || this.matches(property.label, 'key');
      const noteMatches = (node: ValueNode) => [...node.paths].some(path => this.matches(path, 'note'));
      const values = this.sorted(property.values.values()).filter(v => keyMatches || this.matches(v.label, 'value') || noteMatches(v));
      if (!keyMatches && !values.length && !noteMatches(property)) continue;
      visible++;
      this.visibleKeys.push(property.id);
      const group = el(this.body, 'div', 'pv-group');
      const row = el(group, 'div', 'pv-row pv-property-row');
      const expanded = !!this.query || this.plugin.prefs.expanded.includes(property.id);
      const toggle = this.iconButton(row, `${expanded ? 'Collapse' : 'Expand'} ${property.label}`, expanded ? 'chevron-down' : 'chevron-right', () => this.toggleProperty(property.id));
      toggle.className = 'pv-toggle'; toggle.disabled = !!this.query;
      toggle.dataset.pvFocus = JSON.stringify(['toggle', property.id]); toggle.setAttribute('aria-expanded', String(expanded));
      const button = this.nodeButton(row, property, property, () => this.toggleProperty(property.id));
      button.setAttribute('aria-expanded', String(expanded));
      if (!expanded) continue;
      const children = el(group, 'div', 'pv-values');
      const limit = this.limits.get(property.id) ?? 100;
      for (const value of values.slice(0, limit)) {
        const valueGroup = el(children, 'div', 'pv-value-group');
        const id = JSON.stringify([property.id, value.id]);
        const showNotes = this.expandedValues.has(id) || (!!this.query && !keyMatches && !this.matches(value.label, 'value') && noteMatches(value));
        const valueRow = el(valueGroup, 'div', 'pv-row');
        const toggleValue = () => {
          if (showNotes) this.expandedValues.delete(id); else this.expandedValues.add(id); this.render();
        };
        const valueToggle = this.iconButton(valueRow, `${showNotes ? 'Collapse' : 'Expand'} notes for ${property.label}: ${value.label}`, showNotes ? 'chevron-down' : 'chevron-right', toggleValue);
        valueToggle.className = 'pv-toggle';
        valueToggle.dataset.pvFocus = JSON.stringify(['value-toggle', property.id, value.id]);
        valueToggle.setAttribute('aria-expanded', String(showNotes));
        // Search-expanded branches stay open until the filter is cleared.
        valueToggle.disabled = !!this.query && !keyMatches && !this.matches(value.label, 'value') && noteMatches(value);
        const valueButton = this.nodeButton(valueRow, property, value, toggleValue);
        valueButton.setAttribute('aria-expanded', String(showNotes));
        if (showNotes) this.renderNotes(valueGroup, value, id, keyMatches || this.matches(value.label, 'value'));
      }
      if (values.length > limit) this.button(children, `Show more (${values.length - limit})`, 'Show more values', () => { this.limits.set(property.id, limit + 100); this.render(); });
      // Properties with unsupported object values still expose their notes.
      const assigned = new Set([...property.values.values()].flatMap(value => [...value.paths]));
      const otherPaths = new Set([...property.paths].filter(path => !assigned.has(path)));
      if (otherPaths.size) this.renderNotes(children, { ...property, paths: otherPaths }, property.id, keyMatches);
    }
    this.allExpanded = this.visibleKeys.length > 0 && (!!this.query || this.visibleKeys.every(key => this.plugin.prefs.expanded.includes(key)));
    const toggleLabel = this.allExpanded ? 'Collapse all properties' : 'Expand all properties';
    this.expandToggle.title = toggleLabel;
    this.expandToggle.setAttribute('aria-label', toggleLabel);
    this.expandToggle.setAttribute('aria-pressed', String(this.allExpanded));
    this.expandToggle.disabled = this.visibleKeys.length === 0;
    setIcon(this.expandToggle, this.allExpanded ? 'fold-vertical' : 'list-tree');
    this.summary.textContent = `${visible} properties · ${scope === null ? 'Entire vault' : 'Custom selection'}`;
    if (!visible) el(this.body, 'div', 'pv-empty', scope?.length === 0 ? 'Choose properties above to start exploring.' : 'No matching properties. Adjust your search or selection.');
    this.body.scrollTop = scroll;
    if (focusId) Array.from(this.contentEl.querySelectorAll<HTMLElement>('[data-pv-focus]')).find(e => e.dataset.pvFocus === focusId)?.focus({ preventScroll: true });
  }
  private nodeButton(row: HTMLElement, property: PropertyNode, node: ValueNode, run: () => void): HTMLButtonElement {
    const isKey = node === property;
    const button = this.button(row, '', `${isKey ? 'Toggle' : 'Show notes with'} ${property.label}${isKey ? '' : ': ' + node.label} (${node.paths.size})`, run);
    button.className = 'pv-node'; button.dataset.pvFocus = JSON.stringify([property.id, isKey ? null : node.id]);
    button.addEventListener('contextmenu', event => { event.preventDefault(); this.showMenu(event, property, node); });
    button.addEventListener('keydown', event => {
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault(); const rect = button.getBoundingClientRect();
        this.showMenu(new MouseEvent('contextmenu', { clientX: rect.left, clientY: rect.bottom }), property, node);
      }
    });
    if (isKey) {
      const type = this.plugin.typeResolver.typeFor(property);
      const icon = el(button, 'span', 'pv-icon pv-type-icon');
      icon.title = `Type: ${type}`;
      icon.setAttribute('aria-hidden', 'true');
      setIcon(icon, this.plugin.typeResolver.iconFor(property));
    }
    el(button, 'span', 'pv-label', node.label);
    if (isKey && this.plugin.prefs.pinned.includes(property.id)) setIcon(el(button, 'span', 'pv-pin'), 'pin');
    if (!isKey) { const kind = (JSON.parse(node.id) as string[])[0]; if (kind !== 'string') el(button, 'span', 'pv-kind', kind); }
    if (this.plugin.prefs.counts) el(button, 'span', 'pv-count', String(node.paths.size));
    return button;
  }
  private renderNotes(parent: HTMLElement, node: ValueNode, id: string, ancestorMatches: boolean): void {
    const notes = el(parent, 'div', 'pv-notes');
    const paths = [...node.paths].sort(natural).filter(path => !this.query || ancestorMatches || this.matches(path, 'note'));
    const limitKey = `notes:${id}`; const limit = this.limits.get(limitKey) ?? 100;
    for (const path of paths.slice(0, limit)) {
      const button = this.button(notes, '', path, () => {}); button.className = 'pv-file';
      setIcon(el(button, 'span', 'pv-icon'), 'file-text');
      el(button, 'span', 'pv-note-name', path.split('/').pop()?.replace(/\.md$/, '') ?? path);
      const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      if (folder) el(button, 'small', 'pv-note-path', folder);
      button.addEventListener('click', event => {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) void this.app.workspace.getLeaf(event.ctrlKey || event.metaKey).openFile(file).catch(() => new Notice('Unable to open note.'));
      });
    }
    if (paths.length > limit) this.button(notes, 'Show more notes', 'Show 100 more notes', () => { this.limits.set(limitKey, limit + 100); this.render(); });
  }

  private queryFor(property: PropertyNode, node: ValueNode): string {
    if (property === node) return propertyQuery(property.label);
    const [kind] = JSON.parse(node.id) as string[];
    return propertyQuery(property.label, node.label, kind === 'empty');
  }

  private async copy(text: string): Promise<void> {
    try { await this.contentEl.ownerDocument.defaultView!.navigator.clipboard.writeText(text); new Notice('Copied to clipboard.'); }
    catch { new Notice('Clipboard unavailable.'); }
  }

  private async search(property: PropertyNode, node: ValueNode): Promise<void> {
    const query = this.queryFor(property, node);
    let created: WorkspaceLeaf | null = null;
    try {
      // The Search view is a host-internal interface; check it before use.
      let leaf = this.app.workspace.getLeavesOfType('search')[0];
      if (!leaf) {
        const newLeaf = this.app.workspace.getLeftLeaf(true) ?? this.app.workspace.getLeaf(true);
        created = newLeaf; leaf = newLeaf;
        await newLeaf.setViewState({ type: 'search', active: true });
      }
      const view = leaf.view as unknown as { setQuery?: (query: string) => void };
      if (typeof view.setQuery !== 'function') {
        created?.detach(); created = null;
        new Notice('Enable the Search core plugin to use Open in Search.'); return;
      }
      view.setQuery(query);
      created = null;
      await this.app.workspace.revealLeaf(leaf);
      if (node !== property && (JSON.parse(node.id) as string[])[0] === 'empty') {
        new Notice('Search matches null properties; the local empty row also includes blank strings and empty lists.');
      }
    } catch {
      if (created) {
        created.detach(); created = null;
        new Notice('Enable the Search core plugin to use Open in Search.'); return;
      }
      new Notice('Could not open Search. Your notes remain available in the property tree.');
    }
  }

  private showMenu(event: MouseEvent, property: PropertyNode, node: ValueNode): void {
    const menu = new Menu();
    menu.addItem(item => item.setTitle('Open in Search').setIcon('search').onClick(() => { void this.search(property, node); }));
    menu.addItem(item => item.setTitle('Copy search query').setIcon('copy').onClick(() => { void this.copy(this.queryFor(property, node)); }));
    menu.addItem(item => item.setTitle('Copy matching note links').setIcon('link').onClick(() => {
      void this.copy([...node.paths].sort(natural).map(path => `[[${path.replace(/\.md$/, '')}]]`).join('\n'));
    }));
    if (node === property) {
      menu.addItem(item => item.setTitle('Rename property…').setIcon('pencil').onClick(() => this.plugin.renameProperty(property)));
      const pinned = this.plugin.prefs.pinned.includes(property.id);
      menu.addItem(item => item.setTitle(pinned ? 'Unpin property' : 'Pin property').setIcon('pin').onClick(() => {
        this.plugin.prefs.pinned = pinned ? this.plugin.prefs.pinned.filter(key => key !== property.id) : [...this.plugin.prefs.pinned, property.id];
        void this.plugin.save(); this.render();
      }));
      menu.addItem(item => item.setTitle('Hide property').setIcon('eye-off').onClick(() => {
        this.plugin.prefs.hidden += `\n${property.label}`; void this.plugin.save(); this.render();
        new Notice('Property hidden. Restore it in Supercharged Properties settings.');
      }));
    }
    if (node !== property) {
      const [kind] = JSON.parse(node.id) as [PropertyValueKind, string];
      const addEdit = (title: string, mode: ValueEditMode) => menu.addItem(item => item.setTitle(title).setIcon('pencil').onClick(() => this.plugin.editValue(property, node, mode)));
      if (kind !== 'empty') {
        addEdit('Rename value…', 'rename');
        if ([...property.values.values()].some(value => value !== node && (JSON.parse(value.id) as string[])[0] === kind)) addEdit('Merge value…', 'merge');
        if (kind === 'string' && !isWikilink(node.label)) {
          addEdit('Convert to wikilink…', 'wikilink');
          if (supportsTextSplit(property, this.plugin.typeResolver)) addEdit('Split into list…', 'split');
        }
      }
    }
    menu.showAtMouseEvent(event);
  }

}

class PreferencesTab extends PluginSettingTab {
  constructor(private plugin: SuperchargedPropertiesPlugin) { super(plugin.app, plugin); }
  getSettingDefinitions() {
    // New hosts index these definitions; display() keeps compatibility with Obsidian 1.7.2.
    return [
      { name: 'Show note counts', render: (setting: Setting) => {
        setting.addToggle(toggle => toggle.setValue(this.plugin.prefs.counts).onChange(async value => {
          this.plugin.prefs.counts = value; await this.plugin.save();
        }));
      } },
      { name: 'Sort by', render: (setting: Setting) => {
        setting.addDropdown(dropdown => dropdown.addOptions(sortOptions).setValue(this.plugin.prefs.sort).onChange(async value => {
          this.plugin.prefs.sort = sortOrder(value); await this.plugin.save();
        }));
      } },
      { name: 'Excluded folders', desc: 'One vault-relative folder path per line, for example Templates or Resources/Templates. Includes subfolders; paths are case-sensitive, not patterns. Excluded notes are omitted from the tree, counts, copied links, and new bulk edits. Leave empty to include all folders.', render: (setting: Setting) => {
        setting.addTextArea(text => text.setValue(this.plugin.prefs.excludedFolders).onChange(value => this.plugin.setExcludedFolders(value)));
      } },
      { name: 'Hidden properties', desc: 'One property name per line. Leave empty to show all YAML properties.', render: (setting: Setting) => {
        setting.addTextArea(text => text.setValue(this.plugin.prefs.hidden).onChange(async value => {
          this.plugin.prefs.hidden = value; await this.plugin.save();
        }));
      } }
    ];
  }
  display(): void {
    this.containerEl.replaceChildren();
    for (const definition of this.getSettingDefinitions()) {
      const setting = new Setting(this.containerEl).setName(definition.name);
      if (definition.desc) setting.setDesc(definition.desc);
      definition.render(setting);
    }
  }
}
