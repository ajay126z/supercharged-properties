/**
 * Optional feature: show a note count next to each folder in Obsidian's built-in File explorer.
 *
 * Isolation rules:
 * - Off by default. While off, nothing is registered (no vault listeners, no observers, no counts).
 * - Imports nothing from the property features. The only link to the rest of the plugin is the
 *   optional read-only `isExcluded` callback supplied by the host.
 * - Only adds or removes its own badge elements. It never moves or re-parents Obsidian's nodes.
 * - If anything throws, only this feature turns itself off for the session.
 *
 * The File explorer DOM is not a public Obsidian API. The selectors used below
 * (`.nav-folder-title[data-path]`) may break in a future Obsidian update.
 */
import { App, Debouncer, EventRef, Notice, Setting, debounce } from 'obsidian';
import { CountMode, FolderCounts, countByFolder, describeCount, formatCount } from './counting';
import { ExplorerCountsSettings } from './settings';

const BADGE_CLASS = 'pv-folder-count';
const EXPLORER_VIEW_TYPE = 'file-explorer';
const FOLDER_TITLE_SELECTOR = '.nav-folder-title[data-path]';

export interface ExplorerCountsOptions {
  /** Read-only check, used only when "Skip excluded folders" is on. */
  isExcluded?: (path: string) => boolean;
  /** Called once if the feature turned itself off after an error. */
  onFailure?: (error: unknown) => void;
}

export class ExplorerCounts {
  private running = false;
  private failed = false;
  private counts = new Map<string, FolderCounts>();
  private readonly observers = new Map<HTMLElement, MutationObserver>();
  private vaultRefs: EventRef[] = [];
  private workspaceRefs: EventRef[] = [];
  private readonly scheduleRecount: Debouncer<[], void>;
  private readonly scheduleRender: Debouncer<[], void>;

  constructor(
    private readonly app: App,
    private readonly getSettings: () => ExplorerCountsSettings,
    private readonly options: ExplorerCountsOptions = {},
  ) {
    this.scheduleRecount = debounce(() => this.guard(() => { this.rebuild(); this.render(); }), 250, true);
    this.scheduleRender = debounce(() => this.guard(() => this.render()), 100, true);
  }

  /** Start listening and decorating. Safe to call repeatedly. */
  start(): void {
    if (this.running || this.failed) return;
    this.running = true;
    // Register after layout is ready: vault "create" events also fire for every file while loading.
    this.app.workspace.onLayoutReady(() => {
      if (!this.running) return;
      this.guard(() => {
        const { vault, workspace } = this.app;
        this.vaultRefs.push(
          vault.on('create', () => this.scheduleRecount()),
          vault.on('delete', () => this.scheduleRecount()),
          vault.on('rename', () => this.scheduleRecount()),
        );
        this.workspaceRefs.push(
          workspace.on('layout-change', () => {
            this.attach();
            this.scheduleRender();
          }),
        );
        this.rebuild();
        this.attach();
        this.render();
      });
    });
  }

  /** Stop everything and remove every badge. Safe to call repeatedly. */
  stop(): void {
    this.running = false;
    this.scheduleRecount.cancel();
    this.scheduleRender.cancel();
    for (const ref of this.vaultRefs) this.app.vault.offref(ref);
    for (const ref of this.workspaceRefs) this.app.workspace.offref(ref);
    this.vaultRefs = [];
    this.workspaceRefs = [];
    for (const [container, observer] of this.observers) {
      observer.disconnect();
      this.removeBadges(container);
    }
    this.observers.clear();
    // Also clear badges in any explorer leaf that was never observed.
    for (const leaf of this.app.workspace.getLeavesOfType(EXPLORER_VIEW_TYPE)) {
      this.removeBadges(leaf.view.containerEl);
    }
    this.counts.clear();
  }

  /** Call after the settings change: starts, stops, or refreshes to match `enabled`. */
  apply(): void {
    const enabled = this.getSettings().enabled;
    if (!enabled) this.failed = false; // turning it off then on again retries after a failure
    if (enabled && !this.running) this.start();
    else if (!enabled && this.running) this.stop();
    else if (this.running) this.guard(() => { this.rebuild(); this.render(); });
  }

  private rebuild(): void {
    const settings = this.getSettings();
    const { vault } = this.app;
    const files = settings.countAllFiles ? vault.getFiles() : vault.getMarkdownFiles();
    const skip = settings.skipExcludedFolders ? this.options.isExcluded : undefined;
    const paths: string[] = [];
    for (const file of files) {
      if (skip && skip(file.path)) continue;
      paths.push(file.path);
    }
    this.counts = countByFolder(paths);
  }

  /** Observe every File explorer leaf (including ones in popout windows). */
  private attach(): void {
    const containers = new Set<HTMLElement>();
    for (const leaf of this.app.workspace.getLeavesOfType(EXPLORER_VIEW_TYPE)) {
      containers.add(leaf.view.containerEl);
    }
    for (const [container, observer] of this.observers) {
      if (containers.has(container)) continue;
      observer.disconnect();
      this.observers.delete(container);
    }
    for (const container of containers) {
      if (this.observers.has(container)) continue;
      const observer = new MutationObserver(() => this.scheduleRender());
      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-path'],
      });
      this.observers.set(container, observer);
    }
  }

  private render(): void {
    const settings = this.getSettings();
    const noun = settings.countAllFiles
      ? { singular: 'file', plural: 'files' }
      : { singular: 'note', plural: 'notes' };
    for (const [container, observer] of this.observers) {
      // Feature-detect: folders exist but none has the row markup we rely on.
      if (container.querySelector('.nav-folder') && !container.querySelector(FOLDER_TITLE_SELECTOR)) {
        throw new Error('File explorer folder rows not found');
      }
      container.querySelectorAll<HTMLElement>(FOLDER_TITLE_SELECTOR).forEach(title => {
        const path = title.getAttribute('data-path') ?? '';
        const counts = this.counts.get(path);
        const text = formatCount(counts, settings.mode, settings.hideZero);
        let badge = title.querySelector<HTMLElement>(`:scope > .${BADGE_CLASS}`);
        if (text === null) {
          badge?.remove();
          return;
        }
        if (!badge) {
          badge = title.createSpan({ cls: BADGE_CLASS });
          badge.setAttribute('aria-hidden', 'true');
        }
        if (badge.textContent !== text) badge.textContent = text;
        const tooltip = describeCount(counts, noun);
        if (badge.getAttribute('title') !== tooltip) badge.setAttribute('title', tooltip);
      });
      // Drop the mutations caused by our own badges so they do not trigger another render.
      observer.takeRecords();
    }
  }

  private removeBadges(container: HTMLElement): void {
    container.querySelectorAll(`.${BADGE_CLASS}`).forEach(element => element.remove());
  }

  private guard(action: () => void): void {
    try {
      action();
    } catch (error) {
      this.fail(error);
    }
  }

  private fail(error: unknown): void {
    if (this.failed) return;
    this.failed = true;
    console.error('[Supercharged Properties] Folder counts stopped after an error', error);
    this.stop();
    new Notice('Folder counts were turned off for this session because the File explorer could not be updated.');
    this.options.onFailure?.(error);
  }
}

/** Same shape as the host's settings definitions (name, optional description, render callback). */
export interface ExplorerCountsSettingDefinition {
  name: string;
  desc?: string;
  render: (setting: Setting) => void;
}

/**
 * Setting definitions for the host's settings tab. The host passes a getter and an updater,
 * so this file never touches the plugin's preferences object directly. All entries are always
 * present (no conditional rows), so hosts that index the definitions see a stable list.
 */
export function explorerCountsSettingDefinitions(
  get: () => ExplorerCountsSettings,
  update: (patch: Partial<ExplorerCountsSettings>) => void | Promise<void>,
): ExplorerCountsSettingDefinition[] {
  return [
    {
      name: 'Show note counts in the File explorer',
      desc: "Optional. Adds a count next to each folder in Obsidian's built-in File explorer. Off by default; the options below apply only when this is on.",
      render: setting => {
        setting.addToggle(toggle =>
          toggle.setValue(get().enabled).onChange(async value => {
            await update({ enabled: value });
          }),
        );
      },
    },
    {
      name: 'File explorer count to show',
      render: setting => {
        setting.addDropdown(dropdown =>
          dropdown
            .addOptions({
              total: 'Notes including subfolders',
              direct: 'Notes directly in the folder',
              both: 'Both (direct · total)',
            })
            .setValue(get().mode)
            .onChange(async value => {
              await update({ mode: value as CountMode });
            }),
        );
      },
    },
    {
      name: 'Hide zero counts in the File explorer',
      render: setting => {
        setting.addToggle(toggle =>
          toggle.setValue(get().hideZero).onChange(async value => {
            await update({ hideZero: value });
          }),
        );
      },
    },
    {
      name: 'Count all files in the File explorer',
      desc: 'Include attachments and other file types, not only notes.',
      render: setting => {
        setting.addToggle(toggle =>
          toggle.setValue(get().countAllFiles).onChange(async value => {
            await update({ countAllFiles: value });
          }),
        );
      },
    },
    {
      name: 'Skip excluded folders in the File explorer counts',
      desc: "Do not count files inside this plugin's Excluded folders.",
      render: setting => {
        setting.addToggle(toggle =>
          toggle.setValue(get().skipExcludedFolders).onChange(async value => {
            await update({ skipExcludedFolders: value });
          }),
        );
      },
    },
  ];
}
