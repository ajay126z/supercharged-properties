import { normalizeOrder, sortByOrder, materializeOrder, moveWithinGroup, placeInGroup, type MoveAction } from './manual-order';
import { attachManualOrderDrag } from './manual-order-drag';
import { SearchTreeRenderer } from './search-tree-renderer';
import {bulkSettings,validDelimiter,type BulkSettings} from './bulk-properties';
import {resolveSelectionScope,resolveTreeScope,type BulkScope} from './bulk-scope';
import {propertyCatalog,valueSuggestions} from './property-catalog';
import {BulkPropertiesService} from './bulk-properties-service';
import {BulkPropertiesModal} from './bulk-properties-modal';
import {registerBulkMenus} from './explorer-menu';
import { normalizeFolders, sameFolders, folderPaths, folderChoices, intersectPaths } from './folder-filter';
import { InlineConverter } from './inline-conversion';
import { InlineConversionModal } from './inline-conversion-dialog';
import { InlineEditor } from './inline-editor';
import { InlineEditModal } from './inline-dialog';
import { inlineQuery, type InlineEdit } from './inline-edit';
import { applyTooltips } from './tooltips';
import { FuzzySuggestModal, ItemView, Menu, Notice, Plugin, PluginSettingTab, Setting, TFile, WorkspaceLeaf, setIcon } from 'obsidian';
import { fold, natural, PropertyIndex, PropertyNode, ValueNode } from './index';

import { fitVisibleViewport, usesTouchLayout } from './mobile-layout';
import { excludedFolders, isFolderExcluded } from './folder-exclusions';
import { SortOrder, sortOptions, sortOrder, sortNodes, linkedValueSortKey } from './sorting';
import { propertyQuery } from './search';
import { loadProfiles, loadPinOverrides, loadViewState, sameKeys, PropertyProfile, PropertyViewState } from './profiles';
import { PropertyTypeResolver, supportsTextSplit, noteEditType } from './property-types';
import { ValueEditor, type ValueEditPreview, type ValueEditResult } from './value-editor';
import { PropertyRenameModal } from './property-rename-dialog';
import { PropertyDeleteModal } from './property-delete-dialog';
import { includeRenamedProperty } from './property-rename';
import { ValueEditModal } from './value-dialog';
import { NoteValueModal } from './note-value-dialog';
import { InlineIndex } from './inline-index';
import { ViewPicker, type ViewChoice } from './view-picker';
import { FilterNoteList, noteRows } from './filter-note-list';
import { attachNoteMenu } from './note-menu';
import { isWikilink, type ValueEditMode, type ValueEditRequest } from './value-operations';
import type { PropertyValueKind } from './frontmatter-values';
import { noteEditError, textOnlyList, type ListItem } from './note-value-operations';

// Folder Explorer Count
import { ExplorerCounts, explorerCountsSettingDefinitions } from './explorer-counts/explorer-counts';
import { DEFAULT_EXPLORER_COUNTS, normalizeExplorerCounts, type ExplorerCountsSettings } from './explorer-counts/settings';

const VIEW = 'supercharged-properties';
interface Preferences extends BulkSettings { lastAutomaticSort?: SortOrder; manualOrder?: string[]; customOrder?: string[]; explorerCounts?: ExplorerCountsSettings; folders?: string[]; customPinOverrides?: Record<string, boolean>; showTooltips: boolean; inlineViews: PropertyViewState; showInlineProperties: boolean; counts: boolean; sort: SortOrder; hidden: string; excludedFolders: string; expanded: string[]; pinned: string[]; scope: string[] | null; profiles: PropertyProfile[]; activeProfile: string | null }
interface ValueFilter { property: string; value: string; propertyLabel: string; label: string }
const defaults: Preferences = { ...bulkSettings({}), showTooltips: true, inlineViews: loadViewState(null), showInlineProperties: false, counts: true, sort: 'name', hidden: '', excludedFolders: '', expanded: [], pinned: [], scope: null, profiles: [], activeProfile: null };

export default class SuperchargedPropertiesPlugin extends Plugin {
  index = new PropertyIndex();
  inline!: InlineIndex;
  inlineEditor!: InlineEditor;
  inlineConverter!: InlineConverter;
  prefs: Preferences = { ...defaults, inlineViews: loadViewState(null) };
  typeResolver!: PropertyTypeResolver;
  valueEditor!: ValueEditor;
  explorerCounts!: ExplorerCounts;
  private timer: number | undefined;
  private rebuildTimer: number | undefined;
  private saveQueue: Promise<void> = Promise.resolve();

  async onload(): Promise<void> {
    const loaded: unknown = await this.loadData();
    const saved = loaded && typeof loaded === 'object' && !Array.isArray(loaded) ? loaded as Record<string, unknown> : {};
    const profiles = loadProfiles(saved?.profiles);
    this.prefs = {
      ...bulkSettings(saved),
      showInlineProperties: saved.showInlineProperties === true,
      showTooltips: saved.showTooltips !== false,
      inlineViews: loadViewState(saved.inlineViews),
      profiles,
      ...(saved.folders !== undefined ? { folders: normalizeFolders(saved.folders) } : {}),
      ...(saved.explorerCounts !== undefined ? { explorerCounts: normalizeExplorerCounts(saved.explorerCounts) } : {}),
      customPinOverrides: loadPinOverrides(saved.customPinOverrides),
      ...(normalizeOrder(saved.manualOrder, fold) ? { manualOrder: normalizeOrder(saved.manualOrder, fold) } : {}),
      ...(normalizeOrder(saved.customOrder, fold) ? { customOrder: normalizeOrder(saved.customOrder, fold) } : {}),
      activeProfile: typeof saved.activeProfile === 'string' && profiles.some(profile => profile.id === saved.activeProfile) ? saved.activeProfile : null,
      scope: Array.isArray(saved?.scope) ? saved.scope.filter((v: unknown) => typeof v === 'string') : null,
      pinned: Array.isArray(saved?.pinned) ? saved.pinned.filter((v: unknown) => typeof v === 'string') : [],
      counts: typeof saved?.counts === 'boolean' ? saved.counts : true,
      sort: sortOrder(saved?.sort),
      ...(saved.lastAutomaticSort !== undefined ? { lastAutomaticSort: sortOrder(saved.lastAutomaticSort) === 'manual' ? 'name' : sortOrder(saved.lastAutomaticSort) } : {}),
      excludedFolders: typeof saved.excludedFolders === 'string' ? saved.excludedFolders : '',
      hidden: typeof saved?.hidden === 'string' ? saved.hidden : '',
      expanded: Array.isArray(saved?.expanded) ? saved.expanded.filter((v: unknown) => typeof v === 'string') : []
    };
    this.inline = new InlineIndex(file => this.app.vault.cachedRead(file), path => this.includesPath(path), () => this.refresh());
    this.inline.setEnabled(this.prefs.showInlineProperties);
    this.typeResolver = new PropertyTypeResolver(this.app);
    await this.typeResolver.load();
    this.valueEditor = new ValueEditor(this.app, path => this.includesPath(path), id => noteEditType({ id }, this.typeResolver));
    this.inlineEditor = new InlineEditor(this.app, path => this.includesPath(path), this.valueEditor);
    this.inlineConverter = new InlineConverter(this.app, this.valueEditor, path => this.includesPath(path));
    this.registerHoverLinkSource(VIEW, { display: 'Supercharged Properties', defaultMod: true });
    this.registerView(VIEW, leaf => new PropertiesView(leaf, this));
    this.addRibbonIcon('list-tree', 'Open Supercharged Properties', () => { void this.open(); });
    this.addCommand({ id: 'open', name: 'Open sidebar', callback: () => { void this.open(); } });
    this.addCommand({ id: 'open-tab', name: 'Open in tab', callback: () => { void this.openTab(); } });
    this.addCommand({ id: 'rebuild', name: 'Refresh property index', callback: () => this.rebuild(true) });
    this.addCommand({
      id: 'undo-value-edit',
      name: 'Undo last property edit',
      checkCallback: checking => {
        if (!this.valueEditor.canUndo()) return false;
        if (!checking) void this.undoValueEdit();
        return true;
      }
    });
    this.addCommand({ id: 'undo-inline-edit', name: 'Undo last inline property edit', checkCallback: checking => {
      if (!this.inlineEditor.canUndo()) return false;
      if (!checking) void this.inlineEditor.undo().then(result => { new Notice(`Restored ${result.updated} notes; skipped ${result.skipped}; ${result.failed} failed.`); this.rebuild(true); });
      return true;
    } });
    registerBulkMenus(this, (mode, targets) => this.openBulkProperties(mode, recursive => resolveSelectionScope(targets, recursive, path => this.includesPath(path))));
    this.addSettingTab(new PreferencesTab(this));
    this.registerEvent(this.app.metadataCache.on('changed', (file, _data, cache) => {
      this.updateIndexedNote(file.path, cache.frontmatter);
      this.inline.update(file, _data);
      this.refresh();
    }));
    this.registerEvent(this.app.metadataCache.on('resolved', () => this.scheduleRebuild()));
    this.registerEvent(this.app.vault.on('create', file => {
      if (file instanceof TFile && file.extension === 'md' && this.includesPath(file.path)) {
        // Metadata may not be available yet; the cache changed event completes indexing.
        this.inline.update(file);
        const cache = this.app.metadataCache.getFileCache(file);
        if (cache) { this.updateIndexedNote(file.path, cache.frontmatter); this.refresh(); }
      }
    }));
    this.registerEvent(this.app.vault.on('modify', file => {
      if (file instanceof TFile) this.inline.update(file);
    }));
    this.registerEvent(this.app.vault.on('delete', file => {
      if (file instanceof TFile) { this.index.remove(file.path); this.inline.remove(file.path); this.refresh(); }
      else this.scheduleRebuild();
    }));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      if (file instanceof TFile) {
        this.index.remove(oldPath); this.inline.remove(oldPath); this.inline.update(file);
        if (file.extension === 'md' && this.includesPath(file.path)) this.updateIndexedNote(file.path, this.app.metadataCache.getFileCache(file)?.frontmatter);
        this.refresh();
      } else this.scheduleRebuild();
    }));
    this.register(() => { this.inline.setEnabled(false, false); window.clearTimeout(this.timer); window.clearTimeout(this.rebuildTimer); });
    this.explorerCounts = new ExplorerCounts(this.app, () => this.explorerCountsSettings(), {
      isExcluded: path => !this.includesPath(path),
      showTooltips: () => this.prefs.showTooltips,
    });
    this.register(() => this.explorerCounts.stop());
    this.addCommand({
      id: 'toggle-folder-counts',
      name: 'Toggle folder counts',
      callback: () => { void this.updateExplorerCounts({ enabled: !this.explorerCountsSettings().enabled }); }
    });
    this.explorerCounts.apply(); // does nothing unless enabled
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
    this.explorerCounts?.exclusionsChanged();
    this.rebuild();
    await this.save();
  }

  async setShowInlineProperties(enabled: boolean): Promise<void> {
    this.prefs.showInlineProperties = enabled;
    this.inline.setEnabled(enabled);
    if (enabled) this.inline.sync(this.app.vault.getMarkdownFiles());
    await this.save();
  }

  explorerCountsSettings(): ExplorerCountsSettings {
    return this.prefs.explorerCounts ?? DEFAULT_EXPLORER_COUNTS;
  }

  async updateExplorerCounts(patch: Partial<ExplorerCountsSettings>): Promise<void> {
    this.prefs.explorerCounts = { ...this.explorerCountsSettings(), ...patch };
    this.explorerCounts.apply();
    await this.save(); // serialized with other preference updates
  }

  private scheduleRebuild(): void {
    window.clearTimeout(this.rebuildTimer);
    this.rebuildTimer = window.setTimeout(() => this.rebuild(), 150);
  }

  rebuild(forceInline = false): void {
    window.clearTimeout(this.rebuildTimer);
    this.index = new PropertyIndex();
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (this.includesPath(file.path)) this.updateIndexedNote(file.path, this.app.metadataCache.getFileCache(file)?.frontmatter);
    }
    this.inline.sync(this.app.vault.getMarkdownFiles(), forceInline);
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

  async applyValueEdit(preview: ValueEditPreview, verb = 'Updated'): Promise<void> {
    const result: ValueEditResult = await this.valueEditor.apply(preview);
    new Notice(`${verb} ${result.updated} notes; skipped ${result.unchanged} changed notes; ${result.failures.length} failed. Undo last property edit is available in the command palette.`, 10000);
    for (const failure of result.failures) new Notice(`${failure.path}: ${failure.message}`, 10000);
    this.rebuild();
  }

  async undoValueEdit(): Promise<void> {
    const result = await this.valueEditor.undo();
    new Notice(`Restored ${result.restored} notes; skipped ${result.skipped} later edits; ${result.failures.length} failed.`, 10000);
    for (const failure of result.failures) new Notice(`${failure.path}: ${failure.message}`, 10000);
    this.rebuild();
  }

  openBulkProperties(mode:'add'|'remove', scope:(recursive:boolean)=>BulkScope):void {
    const fileAt=(path:string)=>{const file=this.app.vault.getAbstractFileByPath(path);return file instanceof TFile&&file.extension.toLowerCase()==='md'?file:undefined;};
    const frontmatter=(path:string)=>{const file=fileAt(path);if(!file)return undefined;const cache=this.app.metadataCache.getFileCache(file);return cache?cache.frontmatter??{}:undefined;};
    const configuredType=(key:string)=>this.typeResolver.configuredTypeFor(key);
    const service=new BulkPropertiesService({eligible:path=>!!fileAt(path)&&this.includesPath(path),frontmatter,configuredType,process:async(path,update)=>{const file=fileAt(path);if(!file)throw new Error('Note not found.');await this.app.fileManager.processFrontMatter(file,update);}},this.valueEditor);
    new BulkPropertiesModal(this.app,{mode,settings:this.prefs,scope,
      catalog:paths=>propertyCatalog(this.index,paths,key=>configuredType(key)?noteEditType({id:fold(key)},this.typeResolver):undefined,frontmatter),
      values:(key,paths)=>valueSuggestions(this.index,key,paths),preview:(paths,request)=>service.preview(paths,request),apply:(plan,progress)=>service.apply(plan,progress),
      undo:()=>this.valueEditor.undo(),canUndo:()=>this.valueEditor.canUndo()
    }).open();
  }

  convertInline(property: PropertyNode, paths: string[]): void {
    new InlineConversionModal(this.app, {property: property.label, paths,
      preview: (options, selected) => this.inlineConverter.preview(options, selected),
      apply: async plan => {
        const result = await this.inlineConverter.apply(plan);
        new Notice(`Converted ${result.updated} notes; skipped ${result.skipped}; ${result.failures.length} failed.${result.failures.length ? ' '+result.failures.join('\n') : ''}`);
        this.rebuild(true);
      }
    }).open();
  }

  editInline(property: PropertyNode, mode: InlineEdit['mode'], value?: ValueNode): void {
    const selected = value ? [(JSON.parse(value.id) as string[])[0] === 'empty' ? '' : value.label] : [];
    new InlineEditModal(this.app, {
      edit: { property: property.label, mode, replacement: mode === 'rename-property' ? property.label : selected[0] ?? '', values: selected },
      values: [...property.values.values()].sort((a,b) => natural(a.label,b.label)),
      preview: edit => this.inlineEditor.preview(edit, property.paths),
      apply: async plan => {
        const result = await this.inlineEditor.apply(plan);
        if (result.updated && mode === 'rename-property') {
          const state = this.prefs.inlineViews;
          const prefs = { scope: state.scope, profiles: state.profiles, pinned: state.pinned ?? [], hidden: state.hidden ?? '', expanded: [], manualOrder: state.manualOrder, customOrder: state.customOrder, customPinOverrides: state.customPinOverrides };
          includeRenamedProperty(prefs, property.id, plan.edit.replacement);
          Object.assign(state, { scope: prefs.scope, pinned: prefs.pinned, hidden: prefs.hidden });
          await this.save();
        }
        new Notice(`Updated ${result.updated} notes; skipped ${result.skipped}; ${result.failed} failed. Use Undo last inline property edit to restore the last batch.`, 10000);
        this.rebuild(true);
      }
    }).open();
  }

  renameProperty(property: PropertyNode): void {
    new PropertyRenameModal(this.app, {
      property: property.label,
      preview: target => this.valueEditor.previewPropertyRename(property.id, target, property.paths),
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

  deleteProperty(property: PropertyNode): void {
    new PropertyDeleteModal(this.app, {
      property: property.label,
      preview: () => this.valueEditor.previewPropertyDelete(property.id, property.paths),
      apply: async preview => {
        const result = await this.valueEditor.apply(preview);
        new Notice(`Deleted ${property.label} from ${result.updated} notes; skipped ${preview.conflicts.length + result.unchanged}; ${result.failures.length} failed. Use Undo last property edit to restore the last batch.`, 10000);
        for (const failure of result.failures) new Notice(`${failure.path}: ${failure.message}`, 10000);
        this.rebuild();
        // Retain view references so undo (or a recreated property) restores visibility.
      }
    }).open();
  }

  changeNoteValue(property: PropertyNode, paths: readonly string[], complete: () => void): void {
    const type = noteEditType(property, this.typeResolver);
    if (!type) return;
    const selected = [...new Set(paths)];
    const values: ListItem[] = [];
    for (const node of property.values.values()) {
      const [kind] = JSON.parse(node.id) as string[];
      if (kind !== 'string' && kind !== 'number') continue;
      const value = kind === 'number' ? Number(node.label) : node.label;
      if (type === 'list') {
        if (!textOnlyList(property.id) || typeof value === 'string') values.push(value);
      } else if (!noteEditError({ type, mode: 'set', value }, property.id)) values.push(value);
    }
    values.sort((a, b) => natural(String(a), String(b)));
    new NoteValueModal(this.app, {
      property: property.label,
      count: selected.length,
      type,
      values,
      preview: edit => this.valueEditor.previewNoteEdit(property.id, edit, selected),
      apply: async preview => {
        // Refresh configured types before the write as the dialog may have remained open.
        await this.typeResolver.load();
        const result = await this.valueEditor.apply(preview);
        const action = preview.changes.some(change => change.remove) ? 'Removed property from' : 'Updated';
        new Notice(`${action} ${result.updated} notes; ${preview.unchanged} already matched; skipped ${preview.conflicts.length + result.unchanged}; ${result.failures.length} failed. Undo last property edit is available for successful changes.`, 10000);
        for (const failure of result.failures) new Notice(`${failure.path}: ${failure.message}`, 10000);
        this.rebuild();
        complete();
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
        return this.applyValueEdit(preview, mode === 'delete' ? 'Deleted from' : 'Updated');
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
  private selectedNotes: { property: string; paths: Set<string>; context: string } | undefined;
  private noteAnchor: { property: string; row: string; context: string } | undefined;
  private renderedNotes = new Map<string, Array<{ row: string; path: string }>>();
  private selectionBar!: HTMLElement;
  private noteMenuDisposers: Array<() => void> = [];
  private query = '';
  private searchTimer: number | undefined;
  private searchTree?: SearchTreeRenderer;
  private renderTextMatches?: Map<string, boolean>;
  private renderPathMatches?: Map<ValueNode, Set<string>>;
  private searchScope = 'any';
  private searchExpanded = true;
  private autoExpandSearchNotes = true;
  private searchPropertyExpansion = new Map<string, boolean>();
  private searchValueExpansion = new Map<string, boolean>();
  private expansionContext = '';
  private searchHeader!: HTMLElement;
  private searchToggle!: HTMLButtonElement;
  private searchScopeButton!: HTMLButtonElement;
  private body!: HTMLElement;
  private summary!: HTMLElement;
  private filter: ValueFilter | null = null;
  private inlineView = false;
  private inlineExpanded: string[] = [];
  private filterBar!: HTMLElement;
  private filterLabel!: HTMLElement;
  private filterNoteList!: FilterNoteList;
  private scopeButton!: HTMLButtonElement;
  private scopePanel!: HTMLElement;
  private orderLive!: HTMLElement;
  private orderDisposers: Array<() => void> = [];
  private orderDragging = false;
  private orderRenderPending = false;
  private manualHintShown = false;
  private orderActions!: HTMLElement;
  private orderSession?: { target: {order?: string[]; manualOrder?: string[]; customOrder?: string[]}; field: 'order' | 'manualOrder' | 'customOrder'; original?: string[]; previousSort: SortOrder };
  private scopeChoices!: HTMLElement;
  private folderRow?: HTMLElement;
  private profilePicker!: ViewPicker;
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
    this.contentEl.addEventListener('keydown', this.onSelectionKeydown);
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
    this.input.addEventListener('input', () => { this.query = fold(this.input.value); this.scheduleSearchRender(); });
    this.searchScopeButton = this.iconButton(this.searchHeader, 'Search in: Search everything', 'sliders-horizontal', () => this.openSearchScopeMenu());
    this.searchScopeButton.setAttribute('aria-haspopup', 'menu');
    this.input.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); this.toggleSearch(false); }
      else if (event.key === 'Enter' && this.searchTimer !== undefined) { event.preventDefault(); this.render(); }
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
    this.profilePicker = new ViewPicker(profileRow, value => {
      const wasInline = this.inlineView;
      this.inlineView = (value === 'inline' || value.startsWith('inline:')) && this.plugin.prefs.showInlineProperties;
      if (wasInline !== this.inlineView) {
        this.filter = null; this.filterNoteList.reset(); this.selectedNotes = undefined; this.noteAnchor = undefined;
        this.scopeQuery = '';
        this.scopePanel.hidden = true; this.scopeButton.setAttribute('aria-expanded', 'false');
      }
      const prefs = this.viewPrefs;
      if (value === 'all' || value === 'inline') { prefs.scope = null; prefs.activeProfile = null; prefs.folders = []; }
      else if (value === 'custom' || value === 'inline:custom') prefs.activeProfile = null;
      else {
        const prefix = this.inlineView ? 'inline:profile:' : 'profile:';
        const profile = prefs.profiles.find(item => `${prefix}${item.id}` === value);
        if (profile) { prefs.scope = [...profile.keys]; prefs.folders = normalizeFolders(profile.folders); prefs.activeProfile = profile.id; }
      }
      this.query = ''; this.input.value = ''; this.expandedValues.clear();
      void this.plugin.save(); this.plugin.refresh(); this.render();
    }, () => this.plugin.prefs.showTooltips !== false);
    const actions = el(toolbar, 'div', 'pv-actions pv-nav-actions');
    toolbar.prepend(actions);
    this.sortButton = this.iconButton(actions, 'Sort properties', 'arrow-up-narrow-wide', () => this.openSortMenu());
    this.sortButton.setAttribute('aria-haspopup', 'menu');
    this.iconButton(actions, 'Refresh property index', 'refresh-cw', () => this.plugin.rebuild(true));
    this.expandToggle = this.iconButton(actions, 'Expand all properties', 'list-tree', () => {
      if (this.allExpanded) {
        this.expandedValues.clear();
        this.searchValueExpansion.clear();
        this.autoExpandSearchNotes = false;
      }
      if (this.query) {
        this.searchExpanded = !this.allExpanded;
        this.searchPropertyExpansion.clear();
      } else if (this.allExpanded) {
        const visible = new Set(this.visibleKeys);
        this.expandedKeys = this.expandedKeys.filter(key => !visible.has(key));
      } else {
        this.expandedKeys = [...new Set([...this.expandedKeys, ...this.visibleKeys])];
      }
      void this.plugin.save(); this.render();
    });
    this.searchToggle = this.iconButton(actions, 'Toggle search', 'search', () => this.toggleSearch(this.searchHeader.hidden));
    this.searchToggle.setAttribute('aria-expanded', 'false');
    this.scopePanel = el(toolbar, 'div', 'pv-scope-panel'); this.scopePanel.hidden = true;
    this.filterBar = el(this.contentEl, 'div', 'pv-filter-bar');
    this.filterBar.hidden = true;
    this.filterLabel = el(this.filterBar, 'span', 'pv-filter-label');
    const filterActions = el(this.filterBar, 'div', 'pv-filter-actions');
    const clearFilter = this.button(filterActions, 'Clear', 'Clear property filter', () => this.setFilter(null));
    const filterNotes = el(this.contentEl, 'div', 'pv-filter-notes');
    this.filterNoteList = new FilterNoteList(this.app, filterActions, filterNotes, clearFilter, this, VIEW, () => this.plugin.prefs.showTooltips !== false);
    this.summary = el(this.contentEl, 'div', 'pv-summary'); this.summary.setAttribute('aria-live', 'polite');
    this.selectionBar = el(this.contentEl, 'div', 'pv-note-selection');
    this.selectionBar.hidden = true;
    this.orderActions = el(this.contentEl, 'div', 'pv-order-actions'); this.orderActions.hidden = true;
    el(this.orderActions, 'span', '', 'Reorder properties');
    this.button(this.orderActions, 'Done', 'Done reordering properties', () => this.finishOrder(true));
    this.button(this.orderActions, 'Cancel', 'Cancel property reordering', () => this.finishOrder(false));
    this.body = el(this.contentEl, 'div', 'pv-tree');
    this.searchTree = new SearchTreeRenderer(this.body);
    this.orderLive = el(this.contentEl, 'div', 'pv-sr-only');
    this.orderLive.setAttribute('aria-live', 'polite'); this.orderLive.setAttribute('aria-atomic', 'true');
    this.body.setAttribute('aria-label', 'Properties, values and notes');
    this.contentEl.appendChild(this.summary);
    this.render();
  }

  async onClose(): Promise<void> {
    this.orderSession = undefined;
    this.orderRenderPending = false; this.orderDragging = false;
    this.cancelSearchRender();
    this.searchTree?.reset();
    this.orderRenderPending = false;
    this.disposeOrderControls();
    this.profilePicker?.close(false);
    this.contentEl.removeEventListener('keydown', this.onSelectionKeydown);
    this.disposeNoteMenus();
    this.selectedNotes = undefined;
    this.noteAnchor = undefined;
    this.disposeViewport?.();
    this.disposeViewport = undefined;
  }

  private cancelSearchRender(): void {
    this.contentEl.ownerDocument.defaultView?.clearTimeout(this.searchTimer);
    this.searchTimer = undefined;
    if (this.body) { this.body.inert = false; this.body.removeAttribute('aria-busy'); }
    if (this.selectionBar) this.selectionBar.inert = false;
  }
  private scheduleSearchRender(): void {
    this.cancelSearchRender();
    this.searchTree?.reset();
    this.orderRenderPending = false;
    this.disposeOrderControls();
    // Small trees remain immediate. Large path searches wait briefly for a typing
    // burst to finish instead of building the same broad intermediate DOM repeatedly.
    let assignments = 0;
    if (this.query && (this.searchScope === 'any' || this.searchScope === 'note')) {
      for (const property of this.sourceIndex().properties.values()) {
        assignments += property.paths.size;
        if (assignments > 500) break;
      }
    }
    if (assignments <= 500) { this.render(); return; }
    this.body.inert = true; this.body.setAttribute('aria-busy', 'true');
    this.selectionBar.inert = true;
    this.searchTimer = this.contentEl.ownerDocument.defaultView!.setTimeout(() => this.render(), 80);
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
        this.orderSession = undefined;
        if (this.plugin.prefs.sort !== 'manual') this.plugin.prefs.lastAutomaticSort = this.plugin.prefs.sort;
        this.plugin.prefs.sort = sortOrder(value);
        if (this.plugin.prefs.sort !== 'manual') this.plugin.prefs.lastAutomaticSort = this.plugin.prefs.sort;
        void this.plugin.save(); this.plugin.refresh(); this.render();
      }));
    }
    if (this.plugin.prefs.sort === 'manual') {
      menu.addSeparator();
      if (!this.orderSession) menu.addItem(item => item.setTitle('Reorder properties…').setIcon('grip-vertical').onClick(() => this.beginOrder()));
      menu.addItem(item => item.setTitle('Reset manual order').setDisabled(this.layerOrder === undefined).onClick(() => {
        this.writeOrder(undefined); void this.plugin.save(); this.render();
      }));
    }
    const rect = this.sortButton.getBoundingClientRect();
    menu.showAtPosition({ x: rect.left, y: rect.bottom });
  }
  private sorted<T extends ValueNode>(nodes: Iterable<T>): T[] {
    return this.plugin.prefs.sort === 'manual' ? sortByOrder(nodes, this.effectiveOrder()) : sortNodes(nodes, this.plugin.prefs.sort);
  }
  private get inlinePrefs(): PropertyViewState { return this.plugin.prefs.inlineViews ??= loadViewState(null); }
  private get viewPrefs(): PropertyViewState { return this.inlineView ? this.inlinePrefs : this.plugin.prefs; }
  private get orderLayer(): { target: {order?: string[]; manualOrder?: string[]; customOrder?: string[]}; field: 'order' | 'manualOrder' | 'customOrder' } {
    const prefs = this.viewPrefs, profile = prefs.profiles.find(item => item.id === prefs.activeProfile);
    return profile ? {target: profile, field: 'order'} : {target: prefs, field: prefs.scope !== null || normalizeFolders(prefs.folders).length ? 'customOrder' : 'manualOrder'};
  }
  private get layerOrder(): string[] | undefined { const {target, field} = this.orderLayer; return target[field]; }
  private effectiveOrder(): string[] { return this.layerOrder ?? this.viewPrefs.manualOrder ?? []; }
  private writeOrder(order: string[] | undefined): void { const {target, field} = this.orderLayer; target[field] = order; }
  private beginOrder(): void {
    if (this.orderSession) return;
    const {target, field} = this.orderLayer;
    const automatic = this.plugin.prefs.sort === 'manual' ? this.plugin.prefs.lastAutomaticSort ?? 'name' : this.plugin.prefs.sort;
    this.plugin.prefs.lastAutomaticSort = automatic === 'manual' ? 'name' : automatic;
    this.orderSession = {target, field, original: target[field] ? [...target[field]] : undefined, previousSort: this.plugin.prefs.lastAutomaticSort};
    this.plugin.prefs.sort = 'manual';
    if (!this.manualHintShown) { new Notice('Drag the handle or use the property menu to reorder.'); this.manualHintShown = true; }
    void this.plugin.save(); this.plugin.refresh(); this.render();
  }
  private restoreOrder(): void {
    const session = this.orderSession; if (!session) return;
    session.target[session.field] = session.original ? [...session.original] : undefined;
    this.plugin.prefs.sort = session.previousSort; this.orderSession = undefined;
  }
  private finishOrder(keep: boolean): void {
    if (!this.orderSession) return;
    if (keep) this.orderSession = undefined; else this.restoreOrder();
    void this.plugin.save(); this.plugin.refresh(); this.render(); this.sortButton.focus();
    this.orderLive.textContent = keep ? 'Property order saved.' : 'Reordering cancelled. Previous sort restored.';
  }
  private orderGroup(key: string): string[] {
    const pins = this.effectivePins();
    return this.visibleKeys.filter(item => pins.has(item) === pins.has(key));
  }
  private reorderProperty(key: string, action: MoveAction | {before: string | null}): void {
    if (this.plugin.prefs.sort !== 'manual' || !this.orderSession) return;
    const group = this.orderGroup(key);
    if (!group.includes(key) || group.length < 2) return;
    const source = this.sourceIndex().properties;
    if (!source.has(key)) return;
    const full = materializeOrder(this.effectiveOrder(), this.sorted(source.values()).map(property => property.id));
    const moved = typeof action === 'string' ? moveWithinGroup(full, key, group, action) : placeInGroup(full, key, group, action.before);
    if (moved.every((item,index) => item === full[index])) return;
    this.writeOrder(moved.filter(item => source.has(item)));
    void this.plugin.save(); this.render();
    this.orderLive.textContent = `${source.get(key)?.label ?? key} moved to position ${this.orderGroup(key).indexOf(key) + 1} of ${group.length}`;
  }
  private disposeOrderControls(): void { const disposers = this.orderDisposers; this.orderDisposers = []; for (const dispose of disposers) dispose(); }
  private renderOrderControls(): void {
    if (this.plugin.prefs.sort !== 'manual' || !this.orderSession) return;
    const rows = Array.from(this.body.querySelectorAll<HTMLElement>(':scope > .pv-group'));
    for (const row of rows) {
      const key = row.dataset.pvProperty!, property = this.sourceIndex().properties.get(key)!;
      const group = this.orderGroup(key), position = group.indexOf(key) + 1;
      const header = row.querySelector<HTMLElement>('.pv-property-row')!;
      const grip = this.iconButton(header, `Reorder ${property.label}, position ${position} of ${group.length}`, 'grip-vertical', () => {});
      grip.className = 'pv-grip'; grip.dataset.pvFocus = JSON.stringify(['grip', key]);
      grip.setAttribute('aria-description', 'Use the arrow keys to move'); header.prepend(grip);
      const moveKey = (event: KeyboardEvent, requireAlt: boolean) => {
        if (requireAlt && !event.altKey) return;
        const action: MoveAction | undefined = event.key === 'ArrowUp' ? 'up' : event.key === 'ArrowDown' ? 'down' : !requireAlt && event.key === 'Home' ? 'top' : !requireAlt && event.key === 'End' ? 'bottom' : undefined;
        if (action) { event.preventDefault(); event.stopPropagation(); this.reorderProperty(key, action); }
      };
      grip.addEventListener('keydown', event => moveKey(event, false));
      header.querySelector<HTMLElement>('.pv-node')!.addEventListener('keydown', event => moveKey(event, true));
    }
    const pins = this.effectivePins();
    for (const pinned of [true, false]) {
      const groupRows = rows.filter(row => pins.has(row.dataset.pvProperty!) === pinned);
      if (groupRows.length > 1) this.orderDisposers.push(attachManualOrderDrag({rows: groupRows, keys: groupRows.map(row => row.dataset.pvProperty!), scrollEl: this.body,
        onStart: () => {
          this.orderDragging = true;
          if (this.query) { this.searchTree?.reset(); this.orderRenderPending = true; }
        },
        onEnd: () => {
          this.orderDragging = false;
          if (this.orderRenderPending) { this.orderRenderPending = false; this.render(); }
        },
        onDrop: (key, before) => { this.orderDragging = false; this.reorderProperty(key, {before}); }}));
    }
  }
  private get pinOverrides(): Record<string, boolean> | undefined {
    const prefs = this.viewPrefs;
    const profile = prefs.profiles.find(item => item.id === prefs.activeProfile);
    return profile ? profile.pinOverrides : (prefs.scope !== null || normalizeFolders(prefs.folders).length) ? prefs.customPinOverrides : undefined;
  }
  private effectivePins(): Set<string> {
    const pins = new Set(this.inlineView ? this.inlinePrefs.pinned ?? [] : this.plugin.prefs.pinned);
    for (const [key, pinned] of Object.entries(this.pinOverrides ?? {})) {
      if (pinned) pins.add(key); else pins.delete(key);
    }
    return pins;
  }
  private togglePin(key: string): void {
    const prefs = this.inlineView ? this.inlinePrefs : this.plugin.prefs;
    const pinned = this.effectivePins().has(key);
    const profile = prefs.profiles.find(item => item.id === prefs.activeProfile);
    if (profile || prefs.scope !== null || normalizeFolders(prefs.folders).length) {
      const overrides = { ...this.pinOverrides, [key]: !pinned };
      if (profile) profile.pinOverrides = overrides;
      else prefs.customPinOverrides = overrides;
    } else prefs.pinned = pinned ? (prefs.pinned ?? []).filter(item => item !== key) : [...prefs.pinned ?? [], key];
    void this.plugin.save(); this.render();
  }
  private get expandedKeys(): string[] { return this.inlineView ? this.inlineExpanded : this.plugin.prefs.expanded; }
  private set expandedKeys(keys: string[]) { if (this.inlineView) this.inlineExpanded = keys; else this.plugin.prefs.expanded = keys; }
  private propertyExpanded(key: string): boolean {
    return this.query ? this.searchPropertyExpansion.get(key) ?? this.searchExpanded : this.expandedKeys.includes(key);
  }
  private toggleProperty(key: string): void {
    if (this.query) {
      this.searchPropertyExpansion.set(key, !this.propertyExpanded(key));
      this.render(); return;
    }
    const keys = new Set(this.expandedKeys);
    if (keys.has(key)) keys.delete(key); else keys.add(key);
    this.expandedKeys = [...keys]; void this.plugin.save(); this.render();
  }
  private renderScope(): void {
    this.scopePanel.replaceChildren();
    const actions = el(this.scopePanel, 'div', 'pv-actions');
    this.button(actions, 'All', 'Show all properties', () => { this.viewPrefs.scope = null; this.viewPrefs.activeProfile = null; void this.plugin.save(); this.render(); });
    this.button(actions, 'None', 'Clear property selection', () => { this.viewPrefs.scope = []; void this.plugin.save(); this.render(); });
    this.folderRow = el(this.scopePanel, 'div', 'pv-folder-row');
    this.renderFolders();
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
    applyTooltips(this.scopePanel, this.plugin.prefs.showTooltips !== false);
  }
  private syncProfiles(): void {
    const choices: ViewChoice[] = [];
    const addSource = (inline: boolean, prefs: PropertyViewState, source: PropertyIndex) => {
      const active = prefs.profiles.find(profile => profile.id === prefs.activeProfile);
      const hidden = new Set((inline ? this.inlinePrefs.hidden ?? '' : this.plugin.prefs.hidden).split('\n').map(fold).filter(Boolean));
      // Each dropdown entry describes its own scope, never the active tree's temporary filters.
      const count = (keys: Iterable<string>, folders?: string[]) => {
        const included = normalizeFolders(folders);
        return new Set([...keys].filter(key => {
          const property = source.properties.get(key);
          if (!property || hidden.has(key)) return false;
          if (!included.length) return true;
          for (const path of property.paths) if (isFolderExcluded(path, included)) return true;
          return false;
        })).size;
      };
      const prefix = inline ? 'inline:' : '';
      choices.push({ label: `${inline ? 'Inline Properties' : 'All properties'} (${count(source.properties.keys())})`, value: inline ? 'inline' : 'all' });
      if ((prefs.scope !== null || normalizeFolders(prefs.folders).length) && !active) choices.push({ label: `${inline ? 'Inline: ' : ''}Custom selection (${count(prefs.scope ?? source.properties.keys(), prefs.folders)})`, value: `${prefix}custom` });
      for (const profile of prefs.profiles) {
        const keys = profile === active ? prefs.scope ?? [...source.properties.keys()] : profile.keys;
        const modified = profile === active && (!sameKeys(profile.keys, keys) || !sameFolders(profile.folders, prefs.folders));
        choices.push({ label: `${inline ? 'Inline: ' : ''}${profile.name}${modified ? ' (modified)' : ''} (${count(keys, profile === active ? prefs.folders : profile.folders)})`, value: `${prefix}profile:${profile.id}` });
      }
    };
    addSource(false, this.plugin.prefs, this.plugin.index);
    if (this.plugin.prefs.showInlineProperties) addSource(true, this.inlinePrefs, this.plugin.inline.index);
    const prefs = this.viewPrefs;
    const active = prefs.profiles.find(profile => profile.id === prefs.activeProfile);
    const prefix = this.inlineView ? 'inline:' : '';
    this.profilePicker.setChoices(choices, active ? `${prefix}profile:${active.id}` : prefs.scope === null && !normalizeFolders(prefs.folders).length ? this.inlineView ? 'inline' : 'all' : `${prefix}custom`);
    if (this.profileUpdate) {
      this.profileUpdate.disabled = !active;
      this.profileRename.disabled = !active;
      this.profileDelete.disabled = !active;
    }
  }
  private manageProfile(action: 'new' | 'update' | 'rename' | 'delete'): void {
    const prefs = this.viewPrefs;
    const active = prefs.profiles.find(profile => profile.id === prefs.activeProfile);
    const name = this.profileName.value.trim();
    const keys = [...(prefs.scope ?? this.sourceIndex().properties.keys())];
    const folders = normalizeFolders(prefs.folders);
    if (action === 'new' || action === 'update') {
      if (!keys.length && !(prefs.scope === null && folders.length)) { new Notice('Please select at least one property.'); return; }
      if (!folders.length && (prefs.scope === null || sameKeys(keys, [...this.sourceIndex().properties.keys()]))) {
        new Notice(this.inlineView ? 'Inline Properties View already exists.' : 'All properties View already exists.'); return;
      }
    }
    if (action === 'new' || action === 'rename') {
      if (!name) { new Notice('Enter a name for this view.'); this.profileName.focus(); return; }
      if (fold(name) === 'all properties') { new Notice('All properties View already exists.'); return; }
      if (fold(name) === 'inline properties') { new Notice('Inline Properties is a built-in view. Choose another name.'); return; }
      if (prefs.profiles.some(profile => fold(profile.name) === fold(name) && (action === 'new' || profile !== active))) {
        new Notice('A view with that name already exists.'); return;
      }
    }
    if (action === 'new') {
      const id = this.contentEl.ownerDocument.defaultView!.crypto.randomUUID();
      prefs.profiles.push({ id, name, keys, ...(folders.length ? { folders } : {}), ...(this.pinOverrides ? { pinOverrides: { ...this.pinOverrides } } : {}), ...(this.layerOrder !== undefined ? { order: [...this.layerOrder] } : {}) }); prefs.activeProfile = id; prefs.scope = [...keys];
    } else if (!active) return;
    else if (action === 'update') { active.keys = keys; active.folders = folders; prefs.scope = [...keys]; }
    else if (action === 'rename') active.name = name;
    else {
      prefs.customOrder = active.order ? [...active.order] : undefined;
      prefs.customPinOverrides = active.pinOverrides ? { ...active.pinOverrides } : undefined;
      prefs.profiles = prefs.profiles.filter(profile => profile !== active); prefs.activeProfile = null;
    }
    this.profileName.value = '';
    if (usesTouchLayout(this.contentEl) && this.contentEl.ownerDocument.activeElement === this.profileName) {
      this.profileName.blur();
      this.scopeButton.focus({ preventScroll: true });
    }
    void this.plugin.save(); this.plugin.refresh(); this.render();
  }
  private renderScopeChoices(index = this.activeIndex()): void {
    if (!this.scopeChoices) return;
    const scroll = this.scopeChoices.scrollTop;
    this.scopeChoices.replaceChildren();
    const choices = new Map([...index.properties.values()].map(property => [property.id, property]));
    // Keep absent saved keys editable only without a folder filter. Folder-scoped
    // pickers must not reintroduce properties that have no notes in those folders.
    for (const key of this.folders.length ? [] : this.viewPrefs.scope ?? []) {
      if (key !== this.filter?.property && !choices.has(key)) choices.set(key, { id: key, label: key, paths: new Set(), values: new Map() });
    }
    const properties = this.sorted(choices.values()).filter(property => fold(property.label).includes(fold(this.scopeQuery)));
    for (const property of properties) {
      const label = el(this.scopeChoices, 'label', 'pv-scope-choice');
      const checkbox = el(label, 'input'); checkbox.type = 'checkbox';
      checkbox.checked = this.viewPrefs.scope === null || this.viewPrefs.scope.includes(property.id);
      checkbox.dataset.pvFocus = JSON.stringify(['scope', property.id]);
      checkbox.setAttribute('aria-label', `Include ${property.label}`);
      el(label, 'span', '', property.label);
      checkbox.addEventListener('change', () => {
        const scope = new Set(this.viewPrefs.scope ?? this.sourceIndex().properties.keys());
        if (checkbox.checked) scope.add(property.id); else scope.delete(property.id);
        this.viewPrefs.scope = [...scope]; void this.plugin.save(); this.render();
      });
    }
    if (!properties.length) el(this.scopeChoices, 'p', 'pv-hint', 'No matching properties.');
    this.scopeChoices.scrollTop = scroll;
  }
  private matches(text: string, scope: string): boolean {
    if (this.searchScope !== 'any' && this.searchScope !== scope) return false;
    const cached = this.renderTextMatches?.get(text);
    if (cached !== undefined) return cached;
    const matched = fold(text).includes(this.query);
    this.renderTextMatches?.set(text, matched);
    return matched;
  }
  /** Match the row's displayed note count, independently of expansion and pagination. */
  private searchMatchingPaths(property: PropertyNode, node: ValueNode): Set<string> {
    if (!this.query || this.matches(property.label, 'key')) return node.paths;
    if (node !== property && this.matches(node.label, 'value')) return node.paths;
    const cached = this.renderPathMatches?.get(node);
    if (cached) return cached;
    const paths = new Set([...node.paths].filter(path => this.matches(path, 'note')));
    if (node === property) for (const value of property.values.values()) {
      if (this.matches(value.label, 'value')) for (const path of value.paths) paths.add(path);
    }
    this.renderPathMatches?.set(node, paths);
    return paths;
  }
  private setFilter(filter: ValueFilter | null): void {
    this.filter = filter;
    this.filterNoteList.reset();
    this.selectedNotes = undefined;
    this.noteAnchor = undefined;
    this.render();
    (this.inlineView ? this.searchToggle : this.scopeButton).focus({ preventScroll: true });
  }

  private get folders(): string[] { return normalizeFolders(this.viewPrefs.folders); }
  private selectedFolderPaths(): Set<string> | null {
    return this.folders.length ? folderPaths(this.sourceIndex().paths(), this.folders, excludedFolders(this.plugin.prefs.excludedFolders ?? '')) : null;
  }
  private setFolders(folders: string[]): void {
    const normalized = normalizeFolders(folders);
    if (sameFolders(this.folders, normalized)) return;
    this.viewPrefs.folders = normalized;
    this.selectedNotes = undefined; this.noteAnchor = undefined; this.filterNoteList.reset();
    void this.plugin.save(); this.render();
  }
  private addFolder(): void {
    const items = () => folderChoices(this.app.vault.getAllFolders().map(folder => folder.path), this.folders, excludedFolders(this.plugin.prefs.excludedFolders ?? ''));
    const choose = (path: string) => this.setFolders([...this.folders, path]);
    class FolderSuggest extends FuzzySuggestModal<string> {
      getItems(): string[] { return items(); }
      getItemText(path: string): string { return path; }
      onChooseItem(path: string): void { choose(path); }
    }
    const modal = new FolderSuggest(this.app); modal.setPlaceholder('Find a folder…'); modal.open();
  }
  private renderFolders(): void {
    if (!this.folderRow) return;
    const focused = this.contentEl.ownerDocument.activeElement;
    const focusParent = focused && this.folderRow.contains(focused) ? this.folderRow : undefined;
    const focusLabel = focusParent ? focused?.getAttribute('aria-label') : null;
    const folders = this.folders, excluded = excludedFolders(this.plugin.prefs.excludedFolders ?? '');
    const chips = (parent: HTMLElement) => {
      for (const folder of folders) {
        const chip = el(parent, 'span', 'pv-folder-chip');
        const unavailable = excluded.includes(folder) || isFolderExcluded(folder, excluded) || !this.app.vault.getFolderByPath(folder);
        chip.classList.toggle('is-unavailable', unavailable);
        const label = el(chip, 'span', 'pv-folder-name', folder);
        if (unavailable) { label.title = 'Folder is missing or excluded. The saved filter is retained.'; label.setAttribute('aria-label', `${folder}: missing or excluded`); }
        const remove = this.button(chip, '×', `Remove folder ${folder}`, () => this.setFolders(folders.filter(path => path !== folder)));
        remove.dataset.pvFocus = `folder:${folder}`;
      }
    };
    if (this.folderRow) {
      this.folderRow.replaceChildren(); el(this.folderRow, 'span', 'pv-hint', 'Folders'); chips(this.folderRow);
      this.button(this.folderRow, '+ Add folder', 'Add folder filter', () => this.addFolder());
      if (folders.length) this.button(this.folderRow, 'Clear', 'Clear folder filter', () => this.setFolders([]));
    }
    if (focusParent) {
      const buttons = Array.from(focusParent.querySelectorAll<HTMLButtonElement>('button'));
      (buttons.find(button => button.getAttribute('aria-label') === focusLabel) ?? buttons[0] ?? this.scopeButton).focus({ preventScroll: true });
    }
  }

  private filterPaths(): Set<string> | null {
    const values = this.filter ? this.sourceIndex().properties.get(this.filter.property)?.values.get(this.filter.value)?.paths ?? new Set<string>() : null;
    return intersectPaths(this.selectedFolderPaths(), values);
  }

  private sourceIndex(): PropertyIndex { return this.inlineView ? this.plugin.inline.index : this.plugin.index; }

  private canEditNotes(property: PropertyNode): boolean { return !this.inlineView && !!noteEditType(property, this.plugin.typeResolver); }

  private activeIndex(paths = this.filterPaths()): PropertyIndex {
    const source = this.sourceIndex();
    return paths ? source.scoped(paths, this.filter?.property) : source;
  }

  render(): void {
    if (!this.body) return;
    if (this.orderDragging) { this.orderRenderPending = true; return; }
    this.cancelSearchRender();
    this.searchTree?.reset();
    this.orderRenderPending = false;
    this.disposeOrderControls();
    // Per-render caches cannot survive index updates or changes in search scope.
    this.renderTextMatches = new Map();
    this.renderPathMatches = new Map();
    if (this.inlineView && !this.plugin.prefs.showInlineProperties) {
      this.inlineView = false; this.filter = null; this.filterNoteList.reset();
      this.selectedNotes = undefined; this.noteAnchor = undefined;
      this.plugin.prefs.scope = null; this.plugin.prefs.activeProfile = null; this.plugin.prefs.folders = [];
      void this.plugin.save();
    }
    const layer = this.orderLayer;
    if (this.orderSession && (this.plugin.prefs.sort !== 'manual' || layer.target !== this.orderSession.target || layer.field !== this.orderSession.field)) this.orderSession = undefined;
    this.orderActions.hidden = !this.orderSession;
    const expansionContext = JSON.stringify([this.inlineView, this.query, this.searchScope, this.viewPrefs.scope, this.viewPrefs.activeProfile, this.viewPrefs.folders, this.filter]);
    if (expansionContext !== this.expansionContext) {
      this.expansionContext = expansionContext;
      this.searchExpanded = true;
      this.autoExpandSearchNotes = true;
      this.searchPropertyExpansion.clear();
      this.searchValueExpansion.clear();
    }
    this.scopeButton.disabled = false;
    this.scopeButton.title = 'Choose properties to show';
    const valuePaths = this.filterPaths();
    const index = this.activeIndex(valuePaths);
    this.syncProfiles();
    this.renderFolders();
    this.disposeNoteMenus();
    this.syncNoteSelection(index);
    this.renderedNotes.clear();
    const focusId = (this.contentEl.ownerDocument.activeElement as HTMLElement | null)?.dataset.pvFocus;
    const scroll = this.body.scrollTop; this.body.replaceChildren();
    if (!this.scopePanel.hidden) this.renderScopeChoices(index);
    const hidden = new Set((this.inlineView ? this.inlinePrefs.hidden ?? '' : this.plugin.prefs.hidden).split('\n').map(fold).filter(Boolean));
    const pinned = this.effectivePins();
    const scope = this.viewPrefs.scope;
    const properties = this.sorted(index.properties.values()).filter(p => !hidden.has(p.id) && (scope === null || scope.includes(p.id)))
      .sort((a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id)));
    this.sortButton.title = `Sort: ${sortOptions[this.plugin.prefs.sort]}`;
    let visible = 0;
    const searchPaths = new Set<string>();
    this.visibleKeys = [];
    for (const property of properties) {
      const keyMatches = !this.query || this.matches(property.label, 'key');
      const noteMatches = (node: ValueNode) => this.searchMatchingPaths(property, node).size > 0;
      // Discard non-matches before sorting or resolving linked note names.
      const candidates = [...property.values.values()].filter(v => keyMatches || this.matches(v.label, 'value') || noteMatches(v));
      const values = sortNodes(candidates, this.plugin.prefs.sort, node => linkedValueSortKey(node, (target, source) => this.app.metadataCache.getFirstLinkpathDest(target, source)));
      if (!keyMatches && !values.length && !noteMatches(property)) continue;
      visible++;
      // Count distinct matching notes, independently of expansion and pagination.
      const matchingPaths = this.searchMatchingPaths(property, property);
      if ((this.filter || this.folders.length) && this.query) for (const path of matchingPaths) searchPaths.add(path);
      this.visibleKeys.push(property.id);
      const group = el(this.body, 'div', 'pv-group');
      group.dataset.pvProperty = property.id;
      const row = el(group, 'div', 'pv-row pv-property-row');
      const expanded = this.propertyExpanded(property.id);
      const toggle = this.iconButton(row, `${expanded ? 'Collapse' : 'Expand'} ${property.label}`, expanded ? 'chevron-down' : 'chevron-right', () => this.toggleProperty(property.id));
      toggle.className = 'pv-toggle';
      toggle.dataset.pvFocus = JSON.stringify(['toggle', property.id]); toggle.setAttribute('aria-expanded', String(expanded));
      const button = this.nodeButton(row, property, property, () => this.toggleProperty(property.id), matchingPaths.size);
      button.setAttribute('aria-expanded', String(expanded));
      if (!expanded) continue;
      const children = el(group, 'div', 'pv-values');
      children.dataset.pvProperty = property.id;
      children.addEventListener('focusin', () => this.searchTree?.flush(children), {once: true});
      const eagerProperty = this.selectedNotes?.property === property.id || !!focusId && (JSON.parse(focusId) as string[]).includes(property.id);
      const renderChildren = () => {
        const limit = this.limits.get(property.id) ?? 100;
        for (const value of values.slice(0, limit)) {
          const valueGroup = el(children, 'div', 'pv-value-group');
          const id = JSON.stringify([property.id, value.id]);
          const automaticNotes = this.expandedValues.has(id) || (!!this.query && this.autoExpandSearchNotes && !keyMatches && !this.matches(value.label, 'value') && noteMatches(value));
          const showNotes = this.query ? this.searchValueExpansion.get(id) ?? automaticNotes : automaticNotes;
          const renderValue = () => {
            const valueRow = el(valueGroup, 'div', 'pv-row');
            const toggleValue = () => {
              if (this.query) this.searchValueExpansion.set(id, !showNotes);
              else if (showNotes) this.expandedValues.delete(id); else this.expandedValues.add(id);
              this.render();
            };
            const valueToggle = this.iconButton(valueRow, `${showNotes ? 'Collapse' : 'Expand'} notes for ${property.label}: ${value.label}`, showNotes ? 'chevron-down' : 'chevron-right', toggleValue);
            valueToggle.className = 'pv-toggle';
            valueToggle.dataset.pvFocus = JSON.stringify(['value-toggle', property.id, value.id]);
            valueToggle.setAttribute('aria-expanded', String(showNotes));
            const matchingCount = this.searchMatchingPaths(property, value).size;
            const valueButton = this.nodeButton(valueRow, property, value, toggleValue, matchingCount);
            valueButton.setAttribute('aria-expanded', String(showNotes));
            if (showNotes) this.renderNotes(valueGroup, property, value, id, keyMatches || this.matches(value.label, 'value'));
            applyTooltips(valueGroup, this.plugin.prefs.showTooltips !== false);
          };
          const noteCount = showNotes ? Math.min(this.searchMatchingPaths(property, value).size, this.limits.get(`notes:${id}`) ?? 100) : 0;
          if (this.query) this.searchTree!.add(valueGroup, 28 + noteCount * 28, renderValue, eagerProperty); else renderValue();
        }
        if (values.length > limit) this.button(children, `Show more (${values.length - limit})`, 'Show more values', () => { this.limits.set(property.id, limit + 100); this.render(); });
        // Properties with unsupported object values still expose their notes.
        const assigned = new Set([...property.values.values()].flatMap(value => [...value.paths]));
        const otherPaths = new Set([...property.paths].filter(path => !assigned.has(path)));
        if (otherPaths.size) this.renderNotes(children, property, { ...property, paths: otherPaths }, property.id, keyMatches);
      };
      const shownValues = values.slice(0, this.limits.get(property.id) ?? 100);
      let estimatedHeight = shownValues.length * 28;
      if (this.query) for (const value of shownValues) {
        const id = JSON.stringify([property.id, value.id]);
        const automatic = this.expandedValues.has(id) || (this.autoExpandSearchNotes && !keyMatches && !this.matches(value.label, 'value'));
        if (this.searchValueExpansion.get(id) ?? automatic) estimatedHeight += Math.min(this.searchMatchingPaths(property, value).size, this.limits.get(`notes:${id}`) ?? 100) * 28;
      }
      if (this.query) this.searchTree!.add(children, estimatedHeight, renderChildren, eagerProperty); else renderChildren();
    }
    this.renderOrderControls();
    this.allExpanded = this.visibleKeys.length > 0 && this.visibleKeys.every(key => this.propertyExpanded(key));
    const toggleLabel = this.allExpanded ? 'Collapse all properties' : 'Expand all properties';
    this.expandToggle.title = toggleLabel;
    this.expandToggle.setAttribute('aria-label', toggleLabel);
    this.expandToggle.setAttribute('aria-pressed', String(this.allExpanded));
    this.expandToggle.disabled = this.visibleKeys.length === 0;
    setIcon(this.expandToggle, this.allExpanded ? 'fold-vertical' : 'list-tree');
    const displayedPaths = (this.filter || this.folders.length) && this.query ? searchPaths : valuePaths;
    const n = displayedPaths?.size ?? 0;
    const noteCount = `${n} ${n === 1 ? 'note' : 'notes'}`;
    this.filterBar.hidden = !this.filter;
    if (this.filter) {
      const text = `Filtered by ${this.filter.propertyLabel} = ${this.filter.label}`;
      this.filterLabel.textContent = text;
      this.filterLabel.title = this.filterBar.title = text;
    }
    this.filterNoteList.update(this.filter ? displayedPaths : null, !!this.query && !!valuePaths?.size);
    this.summary.textContent = `${visible} properties · ${this.filter || this.folders.length ? `Filtered (${noteCount})` : scope === null ? 'Entire vault' : 'Custom selection'}`;
    if (this.inlineView) {
      const pending = this.plugin.inline.pending, failures = this.plugin.inline.failures.size;
      this.summary.textContent += ` · Inline properties${pending ? ` · Indexing ${pending} ${pending === 1 ? 'note' : 'notes'}…` : ''}${failures ? ` · ${failures} ${failures === 1 ? 'note' : 'notes'} could not be read` : ''}`;
    }
    if (!visible) {
      const message = this.folders.length && !this.selectedFolderPaths()?.size ? 'No notes in the selected folders.' : this.inlineView && !this.filter && this.plugin.inline.pending ? 'Reading inline properties…' : this.inlineView && !this.filter && !this.query && !index.properties.size ? 'No inline properties found in included notes.' : this.filter && !valuePaths?.size ? 'No notes match this filter.'
        : !this.filter && !this.query && scope?.length === 0 ? 'Choose properties above to start exploring.'
        : 'No matching properties. Adjust your search or selection.';
      el(this.body, 'div', 'pv-empty', message);
    }
    applyTooltips(this.contentEl, this.plugin.prefs.showTooltips !== false);
    this.body.scrollTop = scroll;
    if (focusId) Array.from(this.contentEl.querySelectorAll<HTMLElement>('[data-pv-focus]')).find(e => e.dataset.pvFocus === focusId)?.focus({ preventScroll: true });
    this.renderTextMatches = undefined;
    this.renderPathMatches = undefined;
  }
  private nodeButton(row: HTMLElement, property: PropertyNode, node: ValueNode, run: () => void, count = node.paths.size): HTMLButtonElement {
    const isKey = node === property;
    const button = this.button(row, '', `${isKey ? 'Toggle' : 'Show notes with'} ${property.label}${isKey ? '' : ': ' + node.label} (${count})`, run);
    button.className = 'pv-node'; button.dataset.pvFocus = JSON.stringify([property.id, isKey ? null : node.id]);
    this.noteMenuDisposers.push(attachNoteMenu(button, point => {
      this.showMenu(new MouseEvent('contextmenu', { clientX: point.x, clientY: point.y }), property, node);
    }));
    if (isKey) {
      const type = this.inlineView ? 'Inline text' : this.plugin.typeResolver.typeFor(property);
      const icon = el(button, 'span', 'pv-icon pv-type-icon');
      icon.title = `Type: ${type}`;
      icon.setAttribute('aria-hidden', 'true');
      setIcon(icon, this.inlineView ? 'text' : this.plugin.typeResolver.iconFor(property));
    }
    el(button, 'span', 'pv-label', node.label);
    if (isKey && this.effectivePins().has(property.id)) setIcon(el(button, 'span', 'pv-pin'), 'pin');
    if (!isKey) { const kind = (JSON.parse(node.id) as string[])[0]; if (kind !== 'string') el(button, 'span', 'pv-kind', kind); }
    if (this.plugin.prefs.counts) el(button, 'span', 'pv-count', String(count));
    return button;
  }
  private renderNotes(parent: HTMLElement, property: PropertyNode, node: ValueNode, id: string, ancestorMatches: boolean): void {
    const notes = el(parent, 'div', 'pv-notes');
    const matchedPaths = !this.query || ancestorMatches ? node.paths : new Set([...node.paths].filter(path => this.matches(path, 'note')));
    const paths = noteRows(matchedPaths, this.plugin.prefs.sort === 'name-desc').map(note => note.path);
    const limitKey = `notes:${id}`; const limit = this.limits.get(limitKey) ?? 100;
    for (const path of paths.slice(0, limit)) {
      const rowId = JSON.stringify(['note', property.id, id, path]);
      const rendered = this.renderedNotes.get(property.id) ?? [];
      rendered.push({ row: rowId, path });
      this.renderedNotes.set(property.id, rendered);
      const row = el(notes, 'div', 'pv-note-row');
      if (this.selectedNotes?.property === property.id) {
        const checkbox = el(row, 'input', 'pv-note-checkbox');
        checkbox.type = 'checkbox'; checkbox.checked = this.selectedNotes.paths.has(path);
        checkbox.setAttribute('aria-label', `Select ${path} for ${property.label}`);
        checkbox.dataset.pvFocus = JSON.stringify(['note-select', property.id, id, path]);
        checkbox.addEventListener('click', event => {
          if (event.shiftKey) {
            event.preventDefault();
            this.selectNoteRange(property, rowId, path);
          }
        });
        checkbox.addEventListener('change', () => {
          this.noteAnchor = { property: property.id, row: rowId, context: this.noteSelectionContext() };
          if (!this.selectedNotes) return;
          if (checkbox.checked) this.selectedNotes.paths.add(path); else this.selectedNotes.paths.delete(path);
          this.render();
        });
      }
      const button = this.button(row, '', path, () => {}); button.className = 'pv-file';
      button.dataset.pvFocus = rowId;
      button.dataset.notePath = path;
      button.classList.toggle('is-selected', this.selectedNotes?.property === property.id && this.selectedNotes.paths.has(path));
      if (this.canEditNotes(property)) {
        button.setAttribute('aria-haspopup', 'menu');
        this.noteMenuDisposers.push(attachNoteMenu(button, point => this.showNoteMenu(point, property, path, rowId)));
        button.addEventListener('keydown', event => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
          event.preventDefault();
          const notes = this.orderedRenderedNotes(property);
          const index = notes.findIndex(note => note.row === rowId);
          const next = notes[index + (event.key === 'ArrowDown' ? 1 : -1)];
          if (!next) return;
          if (event.shiftKey) {
            const paths = new Set(this.selectedNotes?.property === property.id ? this.selectedNotes.paths : []);
            paths.add(path); paths.add(next.path);
            this.selectedNotes = { property: property.id, paths, context: this.noteSelectionContext() };
            this.render();
          }
          Array.from(this.body.querySelectorAll<HTMLElement>('.pv-file')).find(note => note.dataset.pvFocus === next.row)?.focus();
        });
      }
      setIcon(el(button, 'span', 'pv-icon'), 'file-text');
      el(button, 'span', 'pv-note-name', path.split('/').pop()?.replace(/\.md$/, '') ?? path);
      const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      if (folder) el(button, 'small', 'pv-note-path', folder);
      button.addEventListener('click', event => {
        const modifiedOpen = event.ctrlKey || event.metaKey;
        if (this.canEditNotes(property)) {
          if (!modifiedOpen && event.shiftKey) {
            event.preventDefault();
            this.selectNoteRange(property, rowId, path);
            return;
          }
          if (!modifiedOpen && (event.altKey || (usesTouchLayout(this.contentEl) && this.selectedNotes?.property === property.id))) {
            event.preventDefault();
            const paths = new Set(this.selectedNotes?.property === property.id ? this.selectedNotes.paths : []);
            if (paths.has(path)) paths.delete(path);
            else {
              paths.add(path);
              this.noteAnchor = { property: property.id, row: rowId, context: this.noteSelectionContext() };
            }
            this.selectedNotes = { property: property.id, paths, context: this.noteSelectionContext() };
            this.render(); return;
          }
          this.noteAnchor = { property: property.id, row: rowId, context: this.noteSelectionContext() };
        } else this.noteAnchor = undefined;
        this.selectedNotes = undefined;
        this.render();
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) void this.app.workspace.getLeaf(event.ctrlKey || event.metaKey).openFile(file).catch(() => new Notice('Unable to open note.'));
      });
    }
    if (paths.length > limit) this.button(notes, 'Show more notes', 'Show 100 more notes', () => { this.limits.set(limitKey, limit + 100); this.render(); });
  }

  private orderedRenderedNotes(property: PropertyNode): Array<{row: string; path: string}> {
    const branch = Array.from(this.body.querySelectorAll<HTMLElement>('.pv-values')).find(element => element.dataset.pvProperty === property.id);
    if (branch) this.searchTree?.flush(branch);
    const rows = new Map((this.renderedNotes.get(property.id) ?? []).map(note => [note.row, note]));
    return Array.from(this.body.querySelectorAll<HTMLElement>('.pv-file')).flatMap(button => {
      const note = rows.get(button.dataset.pvFocus ?? ''); return note ? [note] : [];
    });
  }

  private selectNoteRange(property: PropertyNode, row: string, path: string): void {
    const context = this.noteSelectionContext();
    const notes = this.orderedRenderedNotes(property);
    const anchor = this.noteAnchor;
    const start = anchor?.property === property.id && anchor.context === context
      ? notes.findIndex(note => note.row === anchor.row) : -1;
    const end = notes.findIndex(note => note.row === row);
    const paths = start >= 0 && end >= 0
      ? notes.slice(Math.min(start, end), Math.max(start, end) + 1).map(note => note.path)
      : [path];
    if (start < 0) this.noteAnchor = { property: property.id, row, context };
    const selected = new Set(this.selectedNotes?.property === property.id ? this.selectedNotes.paths : []);
    for (const path of paths) selected.add(path);
    this.selectedNotes = { property: property.id, paths: selected, context };
    this.render();
  }

  private onSelectionKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.selectedNotes) {
      event.preventDefault(); event.stopPropagation();
      this.selectedNotes = undefined;
      this.render();
    }
  };

  private disposeNoteMenus(): void {
    for (const dispose of this.noteMenuDisposers) dispose();
    this.noteMenuDisposers = [];
  }

  private noteSelectionContext(): string {
    return JSON.stringify([this.query, this.searchScope, this.plugin.prefs.scope, this.plugin.prefs.hidden, this.plugin.prefs.excludedFolders, this.filter, this.inlineView, this.viewPrefs.folders]);
  }

  private syncNoteSelection(index: PropertyIndex): void {
    if (this.noteAnchor?.context !== this.noteSelectionContext()) this.noteAnchor = undefined;
    let selection = this.selectedNotes;
    const property = selection && index.properties.get(selection.property);
    if (selection && (!property || !this.canEditNotes(property) || selection.context !== this.noteSelectionContext())) {
      this.selectedNotes = selection = undefined;
    }
    this.selectionBar.replaceChildren();
    this.selectionBar.hidden = !selection;
    if (!selection || !property) return;
    for (const path of selection.paths) if (!property.paths.has(path)) selection.paths.delete(path);
    el(this.selectionBar, 'span', 'pv-selection-count', `${selection.paths.size} selected · ${property.label}`);
    const change = this.button(this.selectionBar, `Change ${property.label}…`, `Change ${property.label} for selected notes`, () => {
      this.plugin.changeNoteValue(property, [...selection.paths], () => { this.selectedNotes = undefined; this.noteAnchor = undefined; this.render(); });
    });
    change.disabled = selection.paths.size === 0;
    this.button(this.selectionBar, 'Cancel', 'Cancel note selection', () => { this.selectedNotes = undefined; this.noteAnchor = undefined; this.render(); });
  }

  private showNoteMenu(point: { x: number; y: number }, property: PropertyNode, path: string, row: string): void {
    const menu = new Menu();
    const selection = this.selectedNotes;
    const paths = selection?.property === property.id && selection.paths.has(path) ? [...selection.paths] : [path];
    menu.addItem(item => item.setTitle(`Change ${property.label}…`).setIcon('pencil').onClick(() => {
      this.plugin.changeNoteValue(property, paths, () => { this.selectedNotes = undefined; this.noteAnchor = undefined; this.render(); });
    }));
    menu.addItem(item => item.setTitle('Select notes…').setIcon('list-checks').onClick(() => {
      this.noteAnchor = { property: property.id, row, context: this.noteSelectionContext() };
      this.selectedNotes = { property: property.id, paths: new Set([path]), context: this.noteSelectionContext() };
      this.render();
    }));
    menu.showAtPosition(point);
  }

  private queryFor(property: PropertyNode, node: ValueNode): string {
    if (this.inlineView) return inlineQuery(property.label, property === node ? undefined : (JSON.parse(node.id) as string[])[0] === 'empty' ? '' : node.label);
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
      // Since Obsidian 1.7.2, a background leaf may still hold a DeferredView.
      // Revealing it also waits for loading; read leaf.view only after that completes.
      await this.app.workspace.revealLeaf(leaf);
      const view = leaf.view as unknown as { setQuery?: (query: string) => void };
      if (typeof view.setQuery !== 'function') {
        created?.detach(); created = null;
        new Notice('Enable the Search core plugin to use Open in Search.'); return;
      }
      view.setQuery(query);
      created = null;
      if (this.inlineView) new Notice('Inline Search matches text on the same line and can include code examples or other fields.');
      if (!this.inlineView && node !== property && (JSON.parse(node.id) as string[])[0] === 'empty') {
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
    if (!this.inlineView) for (const mode of ['add','remove'] as const) menu.addItem(item => item.setTitle(mode==='add'?'Add properties to these notes…':'Remove properties from these notes…').setIcon(mode==='add'?'list-plus':'list-minus').onClick(()=>{
      const paths=[...this.searchMatchingPaths(property, node)],label=node===property?property.label:`${property.label} = ${node.label}`;
      this.plugin.openBulkProperties(mode,()=>resolveTreeScope(this.app.vault,paths,label,path=>this.plugin.includesPath(path),node===property));
    }));
    if (node === property) {
      if (this.plugin.prefs.sort === 'manual' && this.orderSession) {
        const group = this.orderGroup(property.id), index = group.indexOf(property.id);
        for (const [action, title, icon] of [['up','Move up','arrow-up'],['down','Move down','arrow-down'],['top','Move to top','arrow-up-to-line'],['bottom','Move to bottom','arrow-down-to-line']] as const) {
          const disabled = index < 0 || (action === 'up' || action === 'top' ? index === 0 : index === group.length - 1);
          menu.addItem(item => item.setTitle(title).setIcon(icon).setDisabled(disabled).onClick(() => this.reorderProperty(property.id, action)));
        }
      }
      menu.addItem(item => item.setTitle('Rename property…').setIcon('pencil').onClick(() => this.inlineView ? this.plugin.editInline(property, 'rename-property') : this.plugin.renameProperty(property)));
      menu.addItem(item => item.setTitle('Delete property…').setIcon('trash-2').onClick(() => this.inlineView ? this.plugin.editInline(property, 'delete-property') : this.plugin.deleteProperty({ ...property, paths: this.searchMatchingPaths(property, property) })));
      const pinned = this.effectivePins().has(property.id);
      menu.addItem(item => item.setTitle(pinned ? 'Unpin property' : 'Pin property').setIcon('pin').onClick(() => {
        this.togglePin(property.id);
      }));
      menu.addItem(item => item.setTitle('Hide property').setIcon('eye-off').onClick(() => {
        if (this.inlineView) this.inlinePrefs.hidden = `${this.inlinePrefs.hidden ?? ''}\n${property.label}`;
        else this.plugin.prefs.hidden += `\n${property.label}`; void this.plugin.save(); this.render();
        new Notice('Property hidden. Restore it in Supercharged Properties settings.');
      }));
    }
    if (this.inlineView) menu.addItem(item => item.setTitle('Convert to YAML property…').setIcon('arrow-right-left').onClick(() => {
      const paths = [...node.paths];
      this.plugin.convertInline(property, paths.sort(natural));
    }));
    if (this.inlineView) menu.addItem(item => item.setTitle(node === property ? 'Replace selected values…' : 'Rename value…').setIcon('pencil').onClick(() => this.plugin.editInline(property, 'replace-values', node === property ? undefined : node)));
    if (node !== property) {
      menu.addItem(item => item.setTitle('Filter by Value').setIcon('filter').onClick(() => {
        this.setFilter({ property: property.id, value: node.id, propertyLabel: property.label, label: node.label });
      }));
      const [kind] = JSON.parse(node.id) as [PropertyValueKind, string];
      const addEdit = (title: string, mode: ValueEditMode, icon = 'pencil') => menu.addItem(item => item.setTitle(title).setIcon(icon).onClick(() => this.plugin.editValue(property, node, mode)));
      if (!this.inlineView && kind !== 'empty') {
        addEdit('Rename value…', 'rename');
        if ([...property.values.values()].some(value => value !== node && (JSON.parse(value.id) as string[])[0] === kind)) addEdit('Merge value…', 'merge');
        addEdit('Delete value…', 'delete', 'trash-2');
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
      { name: 'Include subfolders by default', desc: 'Default folder scope for Add and Remove properties.', render: (setting: Setting) => {
        setting.addToggle(toggle=>toggle.setValue(this.plugin.prefs.bulkIncludeSubfolders).onChange(async value=>{this.plugin.prefs.bulkIncludeSubfolders=value;await this.plugin.save();}));
      } },
      { name: 'Default when a note already has the property', render: (setting: Setting) => {
        setting.addDropdown(dropdown=>dropdown.addOptions({skip:'Skip',merge:'Merge into list',overwrite:'Overwrite'}).setValue(this.plugin.prefs.bulkExistsMode).onChange(async value=>{this.plugin.prefs.bulkExistsMode=bulkSettings({bulkExistsMode:value}).bulkExistsMode;await this.plugin.save();}));
      } },
      { name: 'List delimiter', desc: 'One character used to separate list items in Add properties.', render: (setting: Setting) => {
        setting.addText(text=>text.setValue(this.plugin.prefs.bulkListDelimiter).onChange(async value=>{if(!validDelimiter(value)){text.setValue(this.plugin.prefs.bulkListDelimiter);new Notice('Use exactly one character.');return;}this.plugin.prefs.bulkListDelimiter=value;await this.plugin.save();}));
      } },
      { name: 'Show inline properties', desc: 'Add a separate Inline Properties view for Dataview-style fields in note bodies. Reads Markdown notes in included folders; no Dataview plugin is required.', render: (setting: Setting) => {
        setting.addToggle(toggle => toggle.setValue(this.plugin.prefs.showInlineProperties).onChange(value => this.plugin.setShowInlineProperties(value)));
      } },
      { name: 'Show tooltips', desc: 'Show hover hints on the property browser controls and rows. Turning this off keeps screen-reader labels and note previews available.', render: (setting: Setting) => {
        setting.addToggle(toggle => toggle.setValue(this.plugin.prefs.showTooltips).onChange(async value => {
          this.plugin.prefs.showTooltips = value; this.plugin.explorerCounts?.refreshDisplay(); await this.plugin.save();
        }));
      } },
      { name: 'Show note counts', render: (setting: Setting) => {
        setting.addToggle(toggle => toggle.setValue(this.plugin.prefs.counts).onChange(async value => {
          this.plugin.prefs.counts = value; await this.plugin.save();
        }));
      } },
      { name: 'Sort by', desc: 'Manual lets you drag properties into your own order.', render: (setting: Setting) => {
        setting.addDropdown(dropdown => dropdown.addOptions(sortOptions).setValue(this.plugin.prefs.sort).onChange(async value => {
          if (this.plugin.prefs.sort !== 'manual') this.plugin.prefs.lastAutomaticSort = this.plugin.prefs.sort;
          this.plugin.prefs.sort = sortOrder(value);
          if (this.plugin.prefs.sort !== 'manual') this.plugin.prefs.lastAutomaticSort = this.plugin.prefs.sort;
          await this.plugin.save();
        }));
      } },
      { name: 'Excluded folders', desc: 'One vault-relative folder path per line, for example Templates or Resources/Templates. Includes subfolders; paths are case-sensitive, not patterns. Excluded notes are omitted from the tree, counts, copied links, and new bulk edits. Leave empty to include all folders.', render: (setting: Setting) => {
        setting.addTextArea(text => text.setValue(this.plugin.prefs.excludedFolders).onChange(value => this.plugin.setExcludedFolders(value)));
      } },
      { name: 'Hidden inline properties', desc: 'One inline property name per line. Does not hide YAML properties.', render: (setting: Setting) => {
        setting.addTextArea(text => text.setValue(this.plugin.prefs.inlineViews.hidden ?? '').onChange(async value => {
          this.plugin.prefs.inlineViews.hidden = value; await this.plugin.save();
        }));
      } },
      { name: 'Hidden properties', desc: 'One property name per line. Leave empty to show all YAML properties.', render: (setting: Setting) => {
        setting.addTextArea(text => text.setValue(this.plugin.prefs.hidden).onChange(async value => {
          this.plugin.prefs.hidden = value; await this.plugin.save();
        }));
      } },
      ...explorerCountsSettingDefinitions(
        () => this.plugin.explorerCountsSettings(),
        patch => this.plugin.updateExplorerCounts(patch)
      )
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
