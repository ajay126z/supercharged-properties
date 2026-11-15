/* Supercharged Properties — MIT. See LICENSE and NOTICE.md. */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  PropertiesView: () => PropertiesView,
  default: () => SuperchargedPropertiesPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/frontmatter-values.ts
var EMPTY = Object.freeze({ kind: "empty", text: "" });
var TRUE = Object.freeze({ kind: "boolean", text: "true" });
var FALSE = Object.freeze({ kind: "boolean", text: "false" });
function readPropertyValues(input) {
  switch (typeof input) {
    case "string": {
      const text = input.trim();
      return text ? [{ kind: "string", text }] : [EMPTY];
    }
    case "boolean":
      return input ? [TRUE] : [FALSE];
    case "number":
      return Number.isFinite(input) ? [{ kind: "number", text: String(input) }] : [];
    case "object":
      break;
    default:
      return [];
  }
  if (input === null) return [EMPTY];
  if (!Array.isArray(input)) return [];
  if (!input.length) return [EMPTY];
  return readList(input);
}
function readList(input) {
  const output = [];
  let items = input;
  let offset = 0;
  let parents;
  let ancestry;
  for (; ; ) {
    if (offset === items.length) {
      if (!parents?.length) break;
      ancestry?.delete(items);
      const parent = parents.pop();
      items = parent.items;
      offset = parent.offset;
      continue;
    }
    const item = items[offset++];
    switch (typeof item) {
      case "string": {
        const text = item.trim();
        if (text) output.push({ kind: "string", text });
        break;
      }
      case "number":
        if (Number.isFinite(item)) output.push({ kind: "number", text: String(item) });
        break;
      case "boolean":
        output.push(item ? TRUE : FALSE);
        break;
      case "object":
        if (item === null) {
          output.push(EMPTY);
          break;
        }
        if (!Array.isArray(item) || !item.length) break;
        parents ?? (parents = []);
        ancestry ?? (ancestry = /* @__PURE__ */ new Set([items]));
        if (!ancestry.has(item)) {
          parents.push({ items, offset });
          ancestry.add(item);
          items = item;
          offset = 0;
        }
        break;
    }
  }
  return output;
}

// src/index.ts
var fold = (text) => text.trim().normalize("NFC").toLowerCase();
var natural = (a, b) => a.localeCompare(b, void 0, { numeric: true, sensitivity: "base" });
var PropertyIndex = class {
  constructor() {
    this.properties = /* @__PURE__ */ new Map();
    this.memberships = /* @__PURE__ */ new Map();
  }
  remove(path) {
    for (const [key, values] of this.memberships.get(path) ?? []) {
      const property = this.properties.get(key);
      if (!property) continue;
      property.paths.delete(path);
      for (const value of values) {
        const node = property.values.get(value);
        node?.paths.delete(path);
        if (node?.paths.size === 0) property.values.delete(value);
      }
      if (!property.paths.size) this.properties.delete(key);
    }
    this.memberships.delete(path);
  }
  update(path, frontmatter) {
    this.remove(path);
    if (!frontmatter) return;
    const membership = /* @__PURE__ */ new Map();
    for (const [rawKey, rawValue] of Object.entries(frontmatter)) {
      if (rawKey === "position") continue;
      const key = fold(rawKey);
      if (!key) continue;
      let property = this.properties.get(key);
      if (!property) {
        property = { id: key, label: rawKey, paths: /* @__PURE__ */ new Set(), values: /* @__PURE__ */ new Map() };
        this.properties.set(key, property);
      }
      property.paths.add(path);
      const values = membership.get(key) ?? /* @__PURE__ */ new Set();
      membership.set(key, values);
      for (const entry of readPropertyValues(rawValue)) {
        const id = JSON.stringify([entry.kind, fold(entry.text)]);
        let node = property.values.get(id);
        if (!node) {
          node = { id, label: entry.text || "(empty)", paths: /* @__PURE__ */ new Set() };
          property.values.set(id, node);
        }
        node.paths.add(path);
        values.add(id);
      }
    }
    this.memberships.set(path, membership);
  }
};

// src/mobile-layout.ts
function usesTouchLayout(element) {
  return element.ownerDocument.body.classList.contains("is-mobile") || !!element.ownerDocument.defaultView?.matchMedia?.("(pointer: coarse)").matches;
}
function fitVisibleViewport(element) {
  const win = element.ownerDocument.defaultView;
  if (!win) return () => {
  };
  let frame;
  const viewport = win.visualViewport;
  const update = () => {
    frame = void 0;
    if (!usesTouchLayout(element) || viewport && viewport.scale !== 1) {
      element.style.removeProperty("--pv-visible-height");
      return;
    }
    const bottom = viewport ? viewport.offsetTop + viewport.height : win.innerHeight;
    const height = Math.max(0, Math.floor(bottom - element.getBoundingClientRect().top));
    element.style.setProperty("--pv-visible-height", `${height}px`);
  };
  const schedule = () => {
    if (frame !== void 0) win.cancelAnimationFrame(frame);
    frame = win.requestAnimationFrame(update);
  };
  win.addEventListener("resize", schedule);
  viewport?.addEventListener("resize", schedule);
  viewport?.addEventListener("scroll", schedule);
  element.addEventListener("focusin", schedule);
  element.addEventListener("focusout", schedule);
  const observer = typeof ResizeObserver === "undefined" ? void 0 : new ResizeObserver(schedule);
  if (element.parentElement) observer?.observe(element.parentElement);
  schedule();
  return () => {
    if (frame !== void 0) win.cancelAnimationFrame(frame);
    win.removeEventListener("resize", schedule);
    viewport?.removeEventListener("resize", schedule);
    viewport?.removeEventListener("scroll", schedule);
    element.removeEventListener("focusin", schedule);
    element.removeEventListener("focusout", schedule);
    observer?.disconnect();
    element.style.removeProperty("--pv-visible-height");
  };
}

// src/folder-exclusions.ts
function excludedFolders(text) {
  return [...new Set(text.split("\n").map((line) => line.trim().replace(/\\/g, "/").split("/").filter((part) => part && part !== ".").join("/")).filter((path) => path && !path.split("/").includes("..")))];
}
function isFolderExcluded(path, folders) {
  return folders.some((folder) => path.startsWith(`${folder}/`));
}

// src/sorting.ts
var sortOptions = {
  name: "Property name (A to Z)",
  "name-desc": "Property name (Z to A)",
  count: "Frequency (high to low)",
  "count-asc": "Frequency (low to high)"
};
function sortOrder(value) {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(sortOptions, value) ? value : "name";
}
function sortNodes(nodes, order) {
  return Array.from(nodes).sort((a, b) => {
    const alphabetical = natural(a.label, b.label) || a.id.localeCompare(b.id);
    if (order === "name-desc") return -alphabetical;
    if (order === "count") return b.paths.size - a.paths.size || alphabetical;
    if (order === "count-asc") return a.paths.size - b.paths.size || alphabetical;
    return alphabetical;
  });
}

// src/search.ts
function propertyQuery(key, value, empty = false) {
  const quote = (text) => JSON.stringify(text);
  return value === void 0 ? `[${quote(key)}]` : `[${quote(key)}:${empty ? "null" : quote(value)}]`;
}

// src/profiles.ts
function loadProfiles(raw) {
  if (!Array.isArray(raw)) return [];
  const ids = /* @__PURE__ */ new Set();
  const names = /* @__PURE__ */ new Set();
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const value = entry;
    if (!value || typeof value.id !== "string" || !value.id || typeof value.name !== "string" || !value.name.trim() || !Array.isArray(value.keys)) return [];
    if (ids.has(value.id) || names.has(fold(value.name))) return [];
    ids.add(value.id);
    names.add(fold(value.name));
    return [{ id: value.id, name: value.name.trim(), keys: [...new Set(value.keys.filter((key) => typeof key === "string").map(fold).filter(Boolean))] }];
  });
}
function sameKeys(a, b) {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((key) => right.has(key));
}

// src/property-types.ts
var import_obsidian = require("obsidian");
var TYPE_ICONS = /* @__PURE__ */ new Map([
  ["text", "text"],
  ["multitext", "list"],
  ["aliases", "list"],
  ["tags", "tags"],
  ["number", "hash"],
  ["checkbox", "check-square"],
  ["date", "calendar"],
  ["datetime", "calendar-clock"]
]);
var BUILTIN_TYPES = /* @__PURE__ */ new Map([
  ["tags", "tags"],
  ["aliases", "aliases"],
  ["cssclasses", "multitext"]
]);
var PropertyTypeResolver = class {
  constructor(app) {
    this.app = app;
    this.types = /* @__PURE__ */ new Map();
  }
  /** Reload types.json. Missing, malformed, or unreadable files keep the built-in fallbacks. */
  async load() {
    let raw;
    try {
      const path = (0, import_obsidian.normalizePath)(`${this.app.vault.configDir}/types.json`);
      if (!await this.app.vault.adapter.exists(path)) {
        this.types.clear();
        return;
      }
      const parsed = JSON.parse(await this.app.vault.adapter.read(path));
      raw = parsed?.types;
    } catch {
      return;
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
    const types = /* @__PURE__ */ new Map();
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value !== "string") continue;
      const normalizedKey = fold(key);
      const normalizedType = fold(value);
      if (normalizedKey && normalizedType) types.set(normalizedKey, normalizedType);
    }
    this.types = types;
  }
  typeFor(property) {
    const id = fold(property.id);
    return this.types.get(id) ?? BUILTIN_TYPES.get(id) ?? "text";
  }
  iconFor(property) {
    return TYPE_ICONS.get(this.typeFor(property)) ?? "text";
  }
};
function supportsTextSplit(property, resolver) {
  return !BUILTIN_TYPES.has(fold(property.id)) && resolver.typeFor(property) === "text";
}

// src/value-editor.ts
var import_obsidian2 = require("obsidian");

// src/property-rename.ts
function propertyNameError(name) {
  if (!name.trim()) return "Enter a property name.";
  if (/[\r\n]/.test(name) || name.includes(String.fromCharCode(0))) return "Property names cannot contain line breaks or null characters.";
  if (fold(name) === "position") return "The name position is reserved for metadata.";
  return void 0;
}
function matchingKeys(frontmatter, name) {
  return Object.keys(frontmatter).filter((key) => key !== "position" && fold(key) === fold(name));
}
function canRename(frontmatter, source, target) {
  const keys = matchingKeys(frontmatter, source);
  return !propertyNameError(target) && source !== target && keys.length === 1 && keys[0] === source && matchingKeys(frontmatter, target).every((key) => key === source);
}
function setOwnValue(frontmatter, key, value) {
  Object.defineProperty(frontmatter, key, { value, enumerable: true, writable: true, configurable: true });
}
function includeRenamedProperty(prefs, source, target) {
  const from = fold(source), to = fold(target);
  if (from === to) return;
  const include = (keys) => keys.some((key) => fold(key) === from) && !keys.some((key) => fold(key) === to) ? [...keys, to] : keys;
  if (prefs.scope) prefs.scope = include(prefs.scope);
  prefs.pinned = include(prefs.pinned);
  prefs.expanded = include(prefs.expanded);
  prefs.hidden = include(prefs.hidden.split("\n")).join("\n");
  for (const profile of prefs.profiles) profile.keys = include(profile.keys);
}

// src/value-operations.ts
function propertyKey(frontmatter, property) {
  const target = fold(property);
  for (const key of Object.keys(frontmatter)) {
    if (key !== "position" && fold(key) === target) return key;
  }
  return void 0;
}
function getPropertyValue(frontmatter, property) {
  const key = propertyKey(frontmatter, property);
  return key === void 0 ? void 0 : frontmatter[key];
}
function previewValue(raw, request) {
  return transformValue(raw, request, false);
}
function isWikilink(text) {
  return /^\[\[[\s\S]*\]\]$/.test(text.trim());
}
function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === "object") {
    const copy = {};
    for (const [key, item] of Object.entries(value)) Object.defineProperty(copy, key, { value: cloneValue(item), enumerable: true, writable: true, configurable: true });
    return copy;
  }
  return value;
}
function sameValue(a, b) {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => sameValue(item, b[index]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const left = a;
    const right = b;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && sameValue(left[key], right[key]));
  }
  return false;
}
function transformValue(raw, request, inList) {
  if (Array.isArray(raw)) {
    let changed = 0;
    let value2 = raw.map((item) => {
      const result = transformValue(item, request, true);
      changed += result.changed;
      return result.value;
    });
    if (changed && (request.mode === "merge" || request.mode === "rename")) {
      value2 = value2.filter((item, index) => value2.findIndex((other) => sameValue(item, other)) === index);
    }
    return changed ? { changed, value: value2 } : { changed: 0, value: raw };
  }
  if (!matches(raw, request)) return { changed: 0, value: raw };
  const value = transformScalar(raw, request, inList);
  return sameValue(value, raw) ? { changed: 0, value: raw } : { changed: 1, value };
}
function matches(raw, request) {
  if (request.kind === "empty") return false;
  if (request.kind === "string") {
    return typeof raw === "string" && raw.trim() !== "" && fold(raw) === fold(request.value);
  }
  if (request.kind === "number") return typeof raw === "number" && Number.isFinite(raw) && String(raw) === request.value;
  return typeof raw === "boolean" && String(raw) === request.value;
}
function transformScalar(raw, request, inList) {
  switch (request.mode) {
    case "rename":
    case "merge":
      return coerce(request.kind, request.replacement ?? "");
    case "wikilink": {
      if (typeof raw !== "string") return raw;
      const text = raw.trim();
      if (!text || isWikilink(text) || /[\r\n[\]]/.test(text)) return raw;
      return `[[${text}]]`;
    }
    case "split": {
      if (inList || typeof raw !== "string") return raw;
      const delimiter = request.delimiter ?? ",";
      if (!delimiter) return raw;
      const parts = raw.split(delimiter).map((part) => part.trim()).filter(Boolean);
      return parts.length > 1 ? parts : raw;
    }
  }
}
function coerce(kind, replacement) {
  const text = replacement.trim();
  if (kind === "number" && text !== "" && Number.isFinite(Number(text))) return Number(text);
  if (kind === "boolean") {
    const lower = text.toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;
  }
  return replacement;
}

// src/value-editor.ts
var ValueEditor = class {
  constructor(app, includesPath = () => true) {
    this.app = app;
    this.includesPath = includesPath;
    this.busy = false;
  }
  canUndo() {
    return !!this.last && !this.busy;
  }
  preview(request, paths) {
    const changes = [];
    for (const path of new Set(paths)) {
      if (!this.includesPath(path)) continue;
      const file = this.file(path);
      if (!file) continue;
      const frontmatter = this.frontmatter(file);
      if (!frontmatter) continue;
      const raw = getPropertyValue(frontmatter, request.property);
      if (raw === void 0) continue;
      const result = previewValue(raw, request);
      if (!result.changed) continue;
      changes.push({ path, key: propertyKey(frontmatter, request.property), original: cloneValue(raw), replacement: cloneValue(result.value), before: JSON.stringify(raw), after: JSON.stringify(result.value) });
    }
    return { total: changes.length, changes };
  }
  previewPropertyRename(source, name, paths) {
    const target = name.trim();
    const error = propertyNameError(name);
    const changes = [], conflicts = [];
    if (error) return { source, target, total: 0, changes, conflicts, error };
    for (const path of new Set(paths)) {
      if (!this.includesPath(path)) continue;
      const file = this.file(path);
      const frontmatter = file ? this.frontmatter(file) : void 0;
      if (!frontmatter) {
        conflicts.push({ path, message: "Note or metadata unavailable." });
        continue;
      }
      const keys = matchingKeys(frontmatter, source);
      if (keys.length !== 1) {
        conflicts.push({ path, message: keys.length ? "Ambiguous source keys." : "Source property is missing." });
        continue;
      }
      const key = keys[0];
      if (key === target) continue;
      if (!canRename(frontmatter, key, target)) {
        conflicts.push({ path, message: "Destination property already exists." });
        continue;
      }
      const original = cloneValue(frontmatter[key]);
      changes.push({ path, key, targetKey: target, original, replacement: cloneValue(original), before: JSON.stringify(original), after: JSON.stringify(original) });
    }
    return { source, target, total: changes.length, changes, conflicts };
  }
  async apply(preview) {
    if (this.busy) throw new Error("Another value edit is running.");
    this.busy = true;
    const snapshots = [];
    const failures = [];
    let unchanged = 0;
    try {
      for (const change of preview.changes) {
        if (!this.includesPath(change.path)) {
          unchanged++;
          continue;
        }
        const file = this.file(change.path);
        if (!file) {
          failures.push({ path: change.path, message: "Note not found." });
          continue;
        }
        let snapshot;
        try {
          await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
            if (!this.includesPath(change.path)) return;
            if (!Object.prototype.hasOwnProperty.call(frontmatter, change.key) || !sameValue(frontmatter[change.key], change.original)) return;
            if (change.targetKey !== void 0 && !canRename(frontmatter, change.key, change.targetKey)) return;
            snapshot = { path: change.path, key: change.key, before: cloneValue(change.original), after: cloneValue(change.replacement), targetKey: change.targetKey };
            setOwnValue(frontmatter, change.targetKey ?? change.key, cloneValue(change.replacement));
            if (change.targetKey !== void 0) delete frontmatter[change.key];
          });
          if (snapshot) snapshots.push(snapshot);
          else unchanged++;
        } catch (error) {
          failures.push({ path: change.path, message: message(error) });
        }
      }
      if (snapshots.length) this.last = { snapshots };
      return { updated: snapshots.length, unchanged, failures };
    } finally {
      this.busy = false;
    }
  }
  async undo() {
    if (this.busy) throw new Error("Another value edit is running.");
    const last = this.last;
    if (!last) return { restored: 0, skipped: 0, failures: [] };
    this.busy = true;
    const remaining = [];
    const failures = [];
    let restored = 0;
    let skipped = 0;
    for (const snapshot of last.snapshots) {
      const file = this.file(snapshot.path);
      if (!file) {
        failures.push({ path: snapshot.path, message: "Note not found." });
        remaining.push(snapshot);
        continue;
      }
      let matched = false;
      try {
        await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
          const currentKey = snapshot.targetKey ?? snapshot.key;
          const safeKey = snapshot.targetKey === void 0 || canRename(frontmatter, currentKey, snapshot.key);
          if (!safeKey || !Object.prototype.hasOwnProperty.call(frontmatter, currentKey) || !sameValue(frontmatter[currentKey], snapshot.after)) {
            skipped++;
            remaining.push(snapshot);
            return;
          }
          matched = true;
          setOwnValue(frontmatter, snapshot.key, cloneValue(snapshot.before));
          if (snapshot.targetKey !== void 0) delete frontmatter[snapshot.targetKey];
        });
        if (matched) restored++;
      } catch (error) {
        failures.push({ path: snapshot.path, message: message(error) });
        remaining.push(snapshot);
      }
    }
    this.last = remaining.length ? { snapshots: remaining } : void 0;
    this.busy = false;
    return { restored, skipped, failures };
  }
  file(path) {
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof import_obsidian2.TFile ? file : void 0;
  }
  frontmatter(file) {
    return this.app.metadataCache.getFileCache(file)?.frontmatter;
  }
};
function message(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/property-rename-dialog.ts
var import_obsidian3 = require("obsidian");
var PropertyRenameModal = class extends import_obsidian3.Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
    this.busy = false;
  }
  onOpen() {
    this.titleEl.textContent = "Rename property";
    const content = this.contentEl;
    content.classList.add("pv-edit-modal");
    content.createEl("p", { text: `Rename ${this.options.property} across included folders in the vault, including notes hidden by search filters. Excluded folders are skipped.` });
    const label = content.createEl("label", { cls: "pv-edit-field" });
    label.createSpan({ text: "New property name" });
    const input = label.createEl("input", { cls: "pv-edit-input" });
    input.type = "text";
    input.value = this.options.property;
    input.setAttribute("aria-label", "New property name");
    content.createEl("p", { cls: "pv-edit-hint", text: "Values and their stored types are preserved. Existing destination keys and ambiguous source keys are skipped. Check the destination property type in Obsidian; its type configuration is not renamed. YAML formatting may change." });
    content.createEl("p", { cls: "pv-edit-hint", text: "Undo last property edit restores the last batch until reload; a successful batch replaces previous undo. Saved views and display preferences include the new name and retain the old name for skipped notes and undo." });
    const previewEl = content.createDiv({ cls: "pv-edit-preview" });
    previewEl.setAttribute("aria-live", "polite");
    const actions = content.createDiv({ cls: "pv-edit-actions" });
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.type = "button";
    cancel.addEventListener("click", () => this.close());
    const apply = actions.createEl("button", { text: "Rename", cls: "mod-cta" });
    apply.type = "button";
    const render = () => {
      this.displayed = this.options.preview(input.value);
      const plan = this.displayed;
      previewEl.replaceChildren();
      apply.textContent = `Rename in ${plan.total} notes`;
      apply.disabled = this.busy || !!plan.error || plan.total === 0;
      if (plan.error) {
        previewEl.createEl("p", { text: plan.error });
        return;
      }
      previewEl.createEl("p", { text: `${plan.total} notes will change; ${plan.conflicts.length} notes will be skipped.` });
      for (const change of plan.changes) {
        const row = previewEl.createDiv({ cls: "pv-edit-change" });
        row.createSpan({ cls: "pv-edit-path", text: change.path });
        row.createSpan({ cls: "pv-edit-values", text: `${change.key} \u2192 ${change.targetKey ?? plan.target}: ${change.before}` });
      }
      if (plan.conflicts.length) previewEl.createEl("h3", { text: "Skipped notes" });
      for (const conflict of plan.conflicts) previewEl.createEl("p", { cls: "pv-edit-change", text: `${conflict.path}: ${conflict.message}` });
    };
    input.addEventListener("input", render);
    apply.addEventListener("click", () => {
      if (this.busy || apply.disabled || !this.displayed) return;
      this.busy = true;
      input.disabled = true;
      apply.disabled = true;
      cancel.disabled = true;
      apply.textContent = "Renaming\u2026";
      void this.options.apply(this.displayed).then(() => this.close()).catch(() => {
        this.busy = false;
        input.disabled = false;
        cancel.disabled = false;
        render();
        new import_obsidian3.Notice("Could not rename properties.");
      });
    });
    render();
    input.focus();
    input.select();
  }
  onClose() {
    this.contentEl.replaceChildren();
  }
};

// src/value-dialog.ts
var import_obsidian4 = require("obsidian");
var ValueEditModal = class extends import_obsidian4.Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
    this.busy = false;
    this.request = { ...options.request };
  }
  onOpen() {
    this.titleEl.textContent = titleFor(this.request.mode);
    this.contentEl.classList.add("pv-edit-modal");
    el(this.contentEl, "p", "pv-edit-meta", `${this.request.property}: ${this.request.value}`);
    if (this.request.mode === "rename") {
      this.field("New value", this.request.value, (value) => {
        this.request = { ...this.request, replacement: value };
      });
    } else if (this.request.mode === "merge") {
      const label = el(this.contentEl, "label", "pv-edit-field");
      el(label, "span", "pv-edit-field-label", "Merge into");
      this.select = el(label, "select", "pv-edit-select");
      this.select.setAttribute("aria-label", "Merge into value");
      for (const sibling of this.options.siblings) {
        const option = el(this.select, "option", "", sibling);
        option.value = sibling;
      }
      this.select.value = this.request.replacement ?? this.options.siblings[0] ?? "";
      this.request = { ...this.request, replacement: this.select.value };
      this.select.addEventListener("change", () => {
        this.request = { ...this.request, replacement: this.select.value };
        this.updatePreview();
      });
    } else if (this.request.mode === "wikilink") {
      el(this.contentEl, "p", "pv-edit-hint", `Every matching note will use ${`[[${this.request.value}]]`}.`);
    } else {
      this.field("Delimiter", this.request.delimiter ?? ",", (value) => {
        this.request = { ...this.request, delimiter: value };
      }, "Split the current text into a list. Each trimmed part becomes an item.");
    }
    el(this.contentEl, "p", "pv-edit-hint", "Edits affect matching values in included folders across the vault, including notes hidden by search filters. Excluded folders are skipped. Undo is available for the last batch until the plugin reloads. Applying another batch replaces that undo. YAML formatting may change.");
    this.previewEl = el(this.contentEl, "div", "pv-edit-preview");
    this.previewEl.setAttribute("aria-live", "polite");
    const actions = el(this.contentEl, "div", "pv-edit-actions");
    const cancel = el(actions, "button", "", "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", () => this.close());
    this.applyButton = el(actions, "button", "mod-cta", "Apply");
    this.applyButton.type = "button";
    this.applyButton.addEventListener("click", () => {
      void this.submit();
    });
    this.updatePreview();
  }
  onClose() {
    window.clearTimeout(this.timer);
    this.contentEl.replaceChildren();
  }
  field(labelText, value, update, hint) {
    const label = el(this.contentEl, "label", "pv-edit-field");
    el(label, "span", "pv-edit-field-label", labelText);
    this.input = el(label, "input", "pv-edit-input");
    this.input.type = "text";
    this.input.value = value;
    this.input.setAttribute("aria-label", labelText);
    this.input.addEventListener("input", () => {
      update(this.input.value);
      this.schedulePreview();
    });
    if (hint) el(this.contentEl, "p", "pv-edit-hint", hint);
  }
  schedulePreview() {
    this.applyButton.disabled = true;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.updatePreview(), 120);
  }
  valid() {
    if (this.request.mode === "rename" || this.request.mode === "merge") return !!this.request.replacement?.trim();
    if (this.request.mode === "split") return !!this.request.delimiter;
    return true;
  }
  updatePreview() {
    this.previewEl.replaceChildren();
    if (!this.valid()) {
      this.applyButton.disabled = true;
      el(this.previewEl, "p", "pv-edit-hint", "Enter a value to continue.");
      return;
    }
    const preview = this.options.preview(this.request);
    this.displayed = preview;
    this.applyButton.textContent = `Apply to ${preview.total} notes`;
    this.applyButton.disabled = this.busy || preview.total === 0;
    el(this.previewEl, "p", "pv-edit-count", preview.total ? `${preview.total} note${preview.total === 1 ? "" : "s"} will change.` : "No notes will change.");
    for (const change of preview.changes) {
      const row = el(this.previewEl, "div", "pv-edit-change");
      el(row, "span", "pv-edit-path", change.path);
      el(row, "span", "pv-edit-values", `${change.before} \u2192 ${change.after}`);
    }
  }
  async submit() {
    if (this.busy || this.applyButton.disabled || !this.displayed) return;
    this.busy = true;
    if (this.input) this.input.disabled = true;
    if (this.select) this.select.disabled = true;
    this.applyButton.disabled = true;
    this.applyButton.textContent = "Updating\u2026";
    try {
      await this.options.apply(this.displayed);
      this.close();
    } catch {
      this.busy = false;
      if (this.input) this.input.disabled = false;
      if (this.select) this.select.disabled = false;
      this.applyButton.textContent = "Apply";
      this.updatePreview();
      new import_obsidian4.Notice("Could not update property values.");
    }
  }
};
function titleFor(mode) {
  switch (mode) {
    case "rename":
      return "Rename value";
    case "merge":
      return "Merge value";
    case "wikilink":
      return "Convert to wikilink";
    case "split":
      return "Split into list";
  }
}
function el(parent, tag, cls = "", text = "") {
  return parent.createEl(tag, { cls, text });
}

// src/main.ts
var VIEW = "supercharged-properties";
var defaults = { counts: true, sort: "name", hidden: "", excludedFolders: "", expanded: [], pinned: [], scope: null, profiles: [], activeProfile: null };
var SuperchargedPropertiesPlugin = class extends import_obsidian5.Plugin {
  constructor() {
    super(...arguments);
    this.index = new PropertyIndex();
    this.prefs = { ...defaults };
    this.saveQueue = Promise.resolve();
  }
  async onload() {
    const loaded = await this.loadData();
    const saved = loaded && typeof loaded === "object" && !Array.isArray(loaded) ? loaded : {};
    const profiles = loadProfiles(saved?.profiles);
    this.prefs = {
      profiles,
      activeProfile: typeof saved.activeProfile === "string" && profiles.some((profile) => profile.id === saved.activeProfile) ? saved.activeProfile : null,
      scope: Array.isArray(saved?.scope) ? saved.scope.filter((v) => typeof v === "string") : null,
      pinned: Array.isArray(saved?.pinned) ? saved.pinned.filter((v) => typeof v === "string") : [],
      counts: typeof saved?.counts === "boolean" ? saved.counts : true,
      sort: sortOrder(saved?.sort),
      excludedFolders: typeof saved.excludedFolders === "string" ? saved.excludedFolders : "",
      hidden: typeof saved?.hidden === "string" ? saved.hidden : "",
      expanded: Array.isArray(saved?.expanded) ? saved.expanded.filter((v) => typeof v === "string") : []
    };
    this.typeResolver = new PropertyTypeResolver(this.app);
    await this.typeResolver.load();
    this.valueEditor = new ValueEditor(this.app, (path) => this.includesPath(path));
    this.registerView(VIEW, (leaf) => new PropertiesView(leaf, this));
    this.addRibbonIcon("list-tree", "Open Supercharged Properties", () => {
      void this.open();
    });
    this.addCommand({ id: "open", name: "Open sidebar", callback: () => {
      void this.open();
    } });
    this.addCommand({ id: "open-tab", name: "Open in tab", callback: () => {
      void this.openTab();
    } });
    this.addCommand({ id: "rebuild", name: "Refresh property index", callback: () => this.rebuild() });
    this.addCommand({
      id: "undo-value-edit",
      name: "Undo last property edit",
      checkCallback: (checking) => {
        if (!this.valueEditor.canUndo()) return false;
        if (!checking) void this.undoValueEdit();
        return true;
      }
    });
    this.addSettingTab(new PreferencesTab(this));
    this.registerEvent(this.app.metadataCache.on("changed", (file, _data, cache) => {
      this.updateIndexedNote(file.path, cache.frontmatter);
      this.refresh();
    }));
    this.registerEvent(this.app.metadataCache.on("resolved", () => this.scheduleRebuild()));
    this.registerEvent(this.app.vault.on("create", (file) => {
      if (file instanceof import_obsidian5.TFile && file.extension === "md" && this.includesPath(file.path)) {
        const cache = this.app.metadataCache.getFileCache(file);
        if (cache) {
          this.updateIndexedNote(file.path, cache.frontmatter);
          this.refresh();
        }
      }
    }));
    this.registerEvent(this.app.vault.on("delete", (file) => {
      if (file instanceof import_obsidian5.TFile) {
        this.index.remove(file.path);
        this.refresh();
      } else this.scheduleRebuild();
    }));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      if (file instanceof import_obsidian5.TFile) {
        this.index.remove(oldPath);
        if (file.extension === "md" && this.includesPath(file.path)) this.updateIndexedNote(file.path, this.app.metadataCache.getFileCache(file)?.frontmatter);
        this.refresh();
      } else this.scheduleRebuild();
    }));
    this.register(() => {
      window.clearTimeout(this.timer);
      window.clearTimeout(this.rebuildTimer);
    });
    this.app.workspace.onLayoutReady(() => this.rebuild());
  }
  includesPath(path) {
    return !isFolderExcluded(path, excludedFolders(this.prefs.excludedFolders));
  }
  updateIndexedNote(path, frontmatter) {
    if (this.includesPath(path)) this.index.update(path, frontmatter);
    else this.index.remove(path);
  }
  async setExcludedFolders(value) {
    this.prefs.excludedFolders = value;
    this.rebuild();
    await this.save();
  }
  scheduleRebuild() {
    window.clearTimeout(this.rebuildTimer);
    this.rebuildTimer = window.setTimeout(() => this.rebuild(), 150);
  }
  rebuild() {
    window.clearTimeout(this.rebuildTimer);
    this.index = new PropertyIndex();
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (this.includesPath(file.path)) this.updateIndexedNote(file.path, this.app.metadataCache.getFileCache(file)?.frontmatter);
    }
    void this.reloadTypes();
  }
  async reloadTypes() {
    await this.typeResolver.load();
    this.refresh();
  }
  refresh() {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) {
        if (leaf.view instanceof PropertiesView) leaf.view.render();
      }
    }, 100);
  }
  save() {
    const snapshot = JSON.parse(JSON.stringify(this.prefs));
    this.saveQueue = this.saveQueue.then(() => this.saveData(snapshot)).catch(() => {
      new import_obsidian5.Notice("Could not save Supercharged Properties settings. Check vault permissions and available storage.");
    });
    this.refresh();
    return this.saveQueue;
  }
  async applyValueEdit(preview) {
    const result = await this.valueEditor.apply(preview);
    new import_obsidian5.Notice(`Updated ${result.updated} notes; skipped ${result.unchanged} changed notes; ${result.failures.length} failed. Undo last property edit is available in the command palette.`, 1e4);
    for (const failure of result.failures) new import_obsidian5.Notice(`${failure.path}: ${failure.message}`, 1e4);
    this.rebuild();
  }
  async undoValueEdit() {
    const result = await this.valueEditor.undo();
    new import_obsidian5.Notice(`Restored ${result.restored} notes; skipped ${result.skipped} later edits; ${result.failures.length} failed.`, 1e4);
    for (const failure of result.failures) new import_obsidian5.Notice(`${failure.path}: ${failure.message}`, 1e4);
    this.rebuild();
  }
  renameProperty(property) {
    new PropertyRenameModal(this.app, {
      property: property.label,
      preview: (target) => this.valueEditor.previewPropertyRename(property.id, target, this.index.properties.get(property.id)?.paths ?? []),
      apply: async (preview) => {
        const result = await this.valueEditor.apply(preview);
        if (result.updated) {
          includeRenamedProperty(this.prefs, preview.source, preview.target);
          await this.save();
        }
        new import_obsidian5.Notice(`Renamed in ${result.updated} notes; skipped ${preview.conflicts.length + result.unchanged}; ${result.failures.length} failed. Use Undo last property edit to restore the last batch.`, 1e4);
        for (const failure of result.failures) new import_obsidian5.Notice(`${failure.path}: ${failure.message}`, 1e4);
        this.rebuild();
      }
    }).open();
  }
  editValue(property, node, mode) {
    const [kind] = JSON.parse(node.id);
    if (mode === "split" && (kind !== "string" || !supportsTextSplit(property, this.typeResolver))) return;
    const request = { property: property.id, kind, value: node.label, mode, replacement: node.label };
    const siblings = [...property.values.values()].filter((value) => value !== node && JSON.parse(value.id)[0] === kind).map((value) => value.label);
    new ValueEditModal(this.app, {
      request: mode === "merge" ? { ...request, replacement: siblings[0] } : request,
      siblings,
      preview: (edit) => edit.mode === "split" && !supportsTextSplit(property, this.typeResolver) ? { total: 0, changes: [] } : this.valueEditor.preview(edit, node.paths),
      apply: (preview) => {
        if (mode === "split" && !supportsTextSplit(property, this.typeResolver)) {
          new import_obsidian5.Notice("Split into list is only available for text properties.");
          return Promise.resolve();
        }
        return this.applyValueEdit(preview);
      }
    }).open();
  }
  async openTab() {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }
  async open() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
  }
};
function el2(parent, tag, cls = "", text = "") {
  return parent.createEl(tag, { cls, text });
}
var PropertiesView = class extends import_obsidian5.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.query = "";
    this.searchScope = "any";
    this.scopeQuery = "";
    this.visibleKeys = [];
    this.allExpanded = false;
    this.expandedValues = /* @__PURE__ */ new Set();
    this.limits = /* @__PURE__ */ new Map();
  }
  getViewType() {
    return VIEW;
  }
  getDisplayText() {
    return "Supercharged Properties";
  }
  getIcon() {
    return "list-tree";
  }
  async onOpen() {
    this.contentEl.replaceChildren();
    this.contentEl.classList.add("pv-view");
    this.disposeViewport?.();
    this.disposeViewport = fitVisibleViewport(this.contentEl);
    const toolbar = el2(this.contentEl, "div", "pv-toolbar");
    this.searchHeader = el2(toolbar, "div", "pv-search-header");
    this.searchHeader.hidden = true;
    const search = el2(this.searchHeader, "div", "pv-search");
    (0, import_obsidian5.setIcon)(el2(search, "span", "pv-icon"), "search");
    this.input = el2(search, "input", "pv-filter");
    this.input.type = "search";
    this.input.placeholder = "Find properties, values, notes\u2026";
    this.input.setAttribute("aria-label", "Filter properties and values");
    this.input.addEventListener("input", () => {
      this.query = fold(this.input.value);
      this.render();
    });
    this.searchScopeButton = this.iconButton(this.searchHeader, "Search in: Search everything", "sliders-horizontal", () => this.openSearchScopeMenu());
    this.searchScopeButton.setAttribute("aria-haspopup", "menu");
    this.input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        this.toggleSearch(false);
      }
    });
    const profileRow = el2(toolbar, "div", "pv-profile-row");
    this.scopeButton = this.iconButton(profileRow, "Choose properties to show", "panels-top-left", () => {
      this.scopePanel.hidden = !this.scopePanel.hidden;
      this.scopeButton.setAttribute("aria-expanded", String(!this.scopePanel.hidden));
      if (!this.scopePanel.hidden) {
        this.renderScope();
        if (!usesTouchLayout(this.contentEl)) this.scopePanel.querySelector("input")?.focus();
      }
    });
    this.scopeButton.setAttribute("aria-expanded", "false");
    this.profileSelect = el2(profileRow, "select", "pv-profile-select");
    this.profileSelect.setAttribute("aria-label", "Property view");
    this.profileSelect.addEventListener("change", () => {
      const value = this.profileSelect.value;
      if (value === "all") {
        this.plugin.prefs.scope = null;
        this.plugin.prefs.activeProfile = null;
      } else if (value !== "custom") {
        const profile = this.plugin.prefs.profiles.find((item) => `profile:${item.id}` === value);
        if (profile) {
          this.plugin.prefs.scope = [...profile.keys];
          this.plugin.prefs.activeProfile = profile.id;
        }
      } else this.plugin.prefs.activeProfile = null;
      this.query = "";
      this.input.value = "";
      this.expandedValues.clear();
      void this.plugin.save();
      this.plugin.refresh();
      this.render();
    });
    const actions = el2(toolbar, "div", "pv-actions pv-nav-actions");
    toolbar.prepend(actions);
    this.sortButton = this.iconButton(actions, "Sort properties", "arrow-up-narrow-wide", () => this.openSortMenu());
    this.sortButton.setAttribute("aria-haspopup", "menu");
    this.iconButton(actions, "Refresh property index", "refresh-cw", () => this.plugin.rebuild());
    this.expandToggle = this.iconButton(actions, "Expand all properties", "list-tree", () => {
      if (this.allExpanded) {
        this.query = "";
        this.input.value = "";
        this.expandedValues.clear();
        this.plugin.prefs.expanded = [];
      } else {
        this.plugin.prefs.expanded = [.../* @__PURE__ */ new Set([...this.plugin.prefs.expanded, ...this.visibleKeys])];
      }
      void this.plugin.save();
      this.render();
    });
    this.searchToggle = this.iconButton(actions, "Toggle search", "search", () => this.toggleSearch(this.searchHeader.hidden));
    this.searchToggle.setAttribute("aria-expanded", "false");
    this.scopePanel = el2(toolbar, "div", "pv-scope-panel");
    this.scopePanel.hidden = true;
    this.summary = el2(this.contentEl, "div", "pv-summary");
    this.summary.setAttribute("aria-live", "polite");
    this.body = el2(this.contentEl, "div", "pv-tree");
    this.body.setAttribute("aria-label", "Properties, values and notes");
    this.contentEl.appendChild(this.summary);
    this.render();
  }
  async onClose() {
    this.disposeViewport?.();
    this.disposeViewport = void 0;
  }
  toggleSearch(show) {
    this.searchHeader.hidden = !show;
    this.searchToggle.setAttribute("aria-expanded", String(show));
    this.searchToggle.setAttribute("aria-pressed", String(show));
    if (show) this.input.focus();
    else {
      this.query = "";
      this.input.value = "";
      this.render();
      this.searchToggle.focus();
    }
  }
  openSearchScopeMenu() {
    const menu = new import_obsidian5.Menu();
    for (const [value, label] of [["any", "Search everything"], ["key", "Property names"], ["value", "Values"], ["note", "Note names / paths"]]) {
      menu.addItem((item) => item.setTitle(label).setChecked(this.searchScope === value).onClick(() => {
        this.searchScope = value;
        this.searchScopeButton.title = `Search in: ${label}`;
        this.searchScopeButton.setAttribute("aria-label", `Search in: ${label}`);
        this.searchScopeButton.setAttribute("data-filtered", String(value !== "any"));
        this.render();
        this.input.focus();
      }));
    }
    const rect = this.searchScopeButton.getBoundingClientRect();
    menu.showAtPosition({ x: rect.left, y: rect.bottom });
  }
  button(parent, label, title, run) {
    const button = el2(parent, "button", "", label);
    button.type = "button";
    button.title = title;
    button.setAttribute("aria-label", title);
    button.addEventListener("click", run);
    return button;
  }
  iconButton(parent, title, icon, run) {
    const button = this.button(parent, "", title, run);
    button.className = "pv-icon-button";
    (0, import_obsidian5.setIcon)(button, icon);
    return button;
  }
  openSortMenu() {
    const menu = new import_obsidian5.Menu();
    for (const [value, label] of Object.entries(sortOptions)) {
      menu.addItem((item) => item.setTitle(label).setChecked(this.plugin.prefs.sort === value).onClick(() => {
        this.plugin.prefs.sort = sortOrder(value);
        void this.plugin.save();
        this.plugin.refresh();
        this.render();
      }));
    }
    const rect = this.sortButton.getBoundingClientRect();
    menu.showAtPosition({ x: rect.left, y: rect.bottom });
  }
  sorted(nodes) {
    return sortNodes(nodes, this.plugin.prefs.sort);
  }
  toggleProperty(key) {
    const keys = new Set(this.plugin.prefs.expanded);
    if (keys.has(key)) keys.delete(key);
    else keys.add(key);
    this.plugin.prefs.expanded = [...keys];
    void this.plugin.save();
    this.render();
  }
  renderScope() {
    this.scopePanel.replaceChildren();
    const actions = el2(this.scopePanel, "div", "pv-actions");
    this.button(actions, "All", "Show all properties", () => {
      this.plugin.prefs.scope = null;
      this.plugin.prefs.activeProfile = null;
      void this.plugin.save();
      this.render();
    });
    this.button(actions, "None", "Clear property selection", () => {
      this.plugin.prefs.scope = [];
      void this.plugin.save();
      this.render();
    });
    const search = el2(this.scopePanel, "div", "pv-search pv-picker-search");
    (0, import_obsidian5.setIcon)(el2(search, "span", "pv-icon"), "search");
    const input = el2(search, "input", "pv-filter");
    input.type = "search";
    input.placeholder = "Find a property\u2026";
    input.value = this.scopeQuery;
    input.setAttribute("aria-label", "Search properties to select");
    input.addEventListener("input", () => {
      this.scopeQuery = input.value;
      this.renderScopeChoices();
    });
    this.scopeChoices = el2(this.scopePanel, "div", "pv-scope-choices");
    this.renderScopeChoices();
    el2(this.scopePanel, "p", "pv-hint", "Search filters this list only. All / None apply to every property.");
    const manager = el2(this.scopePanel, "div", "pv-profile-manager");
    el2(manager, "div", "pv-hint", "Save this selection as a view");
    this.profileName = el2(manager, "input", "pv-profile-name");
    this.profileName.type = "text";
    this.profileName.placeholder = "View name, e.g. Writing";
    this.profileName.maxLength = 80;
    this.profileName.setAttribute("aria-label", "Profile name");
    this.profileName.enterKeyHint = "done";
    this.profileName.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        this.manageProfile("new");
      }
    });
    const buttons = el2(manager, "div", "pv-profile-actions");
    this.button(buttons, "Save new", "Save selection as new profile", () => this.manageProfile("new"));
    this.profileUpdate = this.button(buttons, "Update", "Update active profile selection", () => this.manageProfile("update"));
    this.profileRename = this.button(buttons, "Rename", "Rename active profile", () => this.manageProfile("rename"));
    this.profileDelete = this.button(buttons, "Delete", "Delete active profile", () => this.manageProfile("delete"));
    this.syncProfiles();
  }
  syncProfiles() {
    const profiles = this.plugin.prefs.profiles;
    const active = profiles.find((profile) => profile.id === this.plugin.prefs.activeProfile);
    this.profileSelect.replaceChildren();
    const hidden = new Set(this.plugin.prefs.hidden.split("\n").map(fold).filter(Boolean));
    const count = (keys) => new Set([...keys].filter((key) => this.plugin.index.properties.has(key) && !hidden.has(key))).size;
    el2(this.profileSelect, "option", "", `All properties (${count(this.plugin.index.properties.keys())})`).value = "all";
    if (this.plugin.prefs.scope !== null && !active) el2(this.profileSelect, "option", "", `Custom selection (${count(this.plugin.prefs.scope)})`).value = "custom";
    for (const profile of profiles) {
      const modified = profile === active && !sameKeys(profile.keys, this.plugin.prefs.scope ?? [...this.plugin.index.properties.keys()]);
      el2(this.profileSelect, "option", "", profile.name + (modified ? " (modified)" : "") + ` (${count(profile === active ? this.plugin.prefs.scope ?? this.plugin.index.properties.keys() : profile.keys)})`).value = `profile:${profile.id}`;
    }
    this.profileSelect.value = active ? `profile:${active.id}` : this.plugin.prefs.scope === null ? "all" : "custom";
    if (this.profileUpdate) {
      this.profileUpdate.disabled = !active;
      this.profileRename.disabled = !active;
      this.profileDelete.disabled = !active;
    }
  }
  manageProfile(action) {
    const prefs = this.plugin.prefs;
    const active = prefs.profiles.find((profile) => profile.id === prefs.activeProfile);
    const name = this.profileName.value.trim();
    const keys = [...prefs.scope ?? this.plugin.index.properties.keys()];
    if (action === "new" || action === "update") {
      if (!keys.length) {
        new import_obsidian5.Notice("Please select at least one property.");
        return;
      }
      if (prefs.scope === null || sameKeys(keys, [...this.plugin.index.properties.keys()])) {
        new import_obsidian5.Notice("All properties View already exists.");
        return;
      }
    }
    if (action === "new" || action === "rename") {
      if (!name) {
        new import_obsidian5.Notice("Enter a name for this view.");
        this.profileName.focus();
        return;
      }
      if (fold(name) === "all properties") {
        new import_obsidian5.Notice("All properties View already exists.");
        return;
      }
      if (prefs.profiles.some((profile) => fold(profile.name) === fold(name) && (action === "new" || profile !== active))) {
        new import_obsidian5.Notice("A view with that name already exists.");
        return;
      }
    }
    if (action === "new") {
      const id = this.contentEl.ownerDocument.defaultView.crypto.randomUUID();
      prefs.profiles.push({ id, name, keys });
      prefs.activeProfile = id;
      prefs.scope = [...keys];
    } else if (!active) return;
    else if (action === "update") {
      active.keys = keys;
      prefs.scope = [...keys];
    } else if (action === "rename") active.name = name;
    else {
      prefs.profiles = prefs.profiles.filter((profile) => profile !== active);
      prefs.activeProfile = null;
    }
    this.profileName.value = "";
    if (usesTouchLayout(this.contentEl) && this.contentEl.ownerDocument.activeElement === this.profileName) {
      this.profileName.blur();
      this.scopeButton.focus({ preventScroll: true });
    }
    void this.plugin.save();
    this.plugin.refresh();
    this.render();
  }
  renderScopeChoices() {
    if (!this.scopeChoices) return;
    const scroll = this.scopeChoices.scrollTop;
    this.scopeChoices.replaceChildren();
    const choices = new Map([...this.plugin.index.properties.values()].map((property) => [property.id, property]));
    for (const key of this.plugin.prefs.scope ?? []) {
      if (!choices.has(key)) choices.set(key, { id: key, label: key, paths: /* @__PURE__ */ new Set(), values: /* @__PURE__ */ new Map() });
    }
    const properties = this.sorted(choices.values()).filter((property) => fold(property.label).includes(fold(this.scopeQuery)));
    for (const property of properties) {
      const label = el2(this.scopeChoices, "label", "pv-scope-choice");
      const checkbox = el2(label, "input");
      checkbox.type = "checkbox";
      checkbox.checked = this.plugin.prefs.scope === null || this.plugin.prefs.scope.includes(property.id);
      checkbox.dataset.pvFocus = JSON.stringify(["scope", property.id]);
      checkbox.setAttribute("aria-label", `Include ${property.label}`);
      el2(label, "span", "", property.label);
      checkbox.addEventListener("change", () => {
        const scope = new Set(this.plugin.prefs.scope ?? this.plugin.index.properties.keys());
        if (checkbox.checked) scope.add(property.id);
        else scope.delete(property.id);
        this.plugin.prefs.scope = [...scope];
        void this.plugin.save();
        this.render();
      });
    }
    if (!properties.length) el2(this.scopeChoices, "p", "pv-hint", "No matching properties.");
    this.scopeChoices.scrollTop = scroll;
  }
  matches(text, scope) {
    return (this.searchScope === "any" || this.searchScope === scope) && fold(text).includes(this.query);
  }
  render() {
    if (!this.body) return;
    this.syncProfiles();
    const focusId = this.contentEl.ownerDocument.activeElement?.dataset.pvFocus;
    const scroll = this.body.scrollTop;
    this.body.replaceChildren();
    if (!this.scopePanel.hidden) this.renderScopeChoices();
    const hidden = new Set(this.plugin.prefs.hidden.split("\n").map(fold).filter(Boolean));
    const pinned = new Set(this.plugin.prefs.pinned);
    const scope = this.plugin.prefs.scope;
    const properties = this.sorted(this.plugin.index.properties.values()).filter((p) => !hidden.has(p.id) && (scope === null || scope.includes(p.id))).sort((a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id)));
    this.sortButton.title = `Sort: ${sortOptions[this.plugin.prefs.sort]}`;
    let visible = 0;
    this.visibleKeys = [];
    for (const property of properties) {
      const keyMatches = !this.query || this.matches(property.label, "key");
      const noteMatches = (node) => [...node.paths].some((path) => this.matches(path, "note"));
      const values = this.sorted(property.values.values()).filter((v) => keyMatches || this.matches(v.label, "value") || noteMatches(v));
      if (!keyMatches && !values.length && !noteMatches(property)) continue;
      visible++;
      this.visibleKeys.push(property.id);
      const group = el2(this.body, "div", "pv-group");
      const row = el2(group, "div", "pv-row pv-property-row");
      const expanded = !!this.query || this.plugin.prefs.expanded.includes(property.id);
      const toggle = this.iconButton(row, `${expanded ? "Collapse" : "Expand"} ${property.label}`, expanded ? "chevron-down" : "chevron-right", () => this.toggleProperty(property.id));
      toggle.className = "pv-toggle";
      toggle.disabled = !!this.query;
      toggle.dataset.pvFocus = JSON.stringify(["toggle", property.id]);
      toggle.setAttribute("aria-expanded", String(expanded));
      const button = this.nodeButton(row, property, property, () => this.toggleProperty(property.id));
      button.setAttribute("aria-expanded", String(expanded));
      if (!expanded) continue;
      const children = el2(group, "div", "pv-values");
      const limit = this.limits.get(property.id) ?? 100;
      for (const value of values.slice(0, limit)) {
        const valueGroup = el2(children, "div", "pv-value-group");
        const id = JSON.stringify([property.id, value.id]);
        const showNotes = this.expandedValues.has(id) || !!this.query && !keyMatches && !this.matches(value.label, "value") && noteMatches(value);
        const valueRow = el2(valueGroup, "div", "pv-row");
        const toggleValue = () => {
          if (showNotes) this.expandedValues.delete(id);
          else this.expandedValues.add(id);
          this.render();
        };
        const valueToggle = this.iconButton(valueRow, `${showNotes ? "Collapse" : "Expand"} notes for ${property.label}: ${value.label}`, showNotes ? "chevron-down" : "chevron-right", toggleValue);
        valueToggle.className = "pv-toggle";
        valueToggle.dataset.pvFocus = JSON.stringify(["value-toggle", property.id, value.id]);
        valueToggle.setAttribute("aria-expanded", String(showNotes));
        valueToggle.disabled = !!this.query && !keyMatches && !this.matches(value.label, "value") && noteMatches(value);
        const valueButton = this.nodeButton(valueRow, property, value, toggleValue);
        valueButton.setAttribute("aria-expanded", String(showNotes));
        if (showNotes) this.renderNotes(valueGroup, value, id, keyMatches || this.matches(value.label, "value"));
      }
      if (values.length > limit) this.button(children, `Show more (${values.length - limit})`, "Show more values", () => {
        this.limits.set(property.id, limit + 100);
        this.render();
      });
      const assigned = new Set([...property.values.values()].flatMap((value) => [...value.paths]));
      const otherPaths = new Set([...property.paths].filter((path) => !assigned.has(path)));
      if (otherPaths.size) this.renderNotes(children, { ...property, paths: otherPaths }, property.id, keyMatches);
    }
    this.allExpanded = this.visibleKeys.length > 0 && (!!this.query || this.visibleKeys.every((key) => this.plugin.prefs.expanded.includes(key)));
    const toggleLabel = this.allExpanded ? "Collapse all properties" : "Expand all properties";
    this.expandToggle.title = toggleLabel;
    this.expandToggle.setAttribute("aria-label", toggleLabel);
    this.expandToggle.setAttribute("aria-pressed", String(this.allExpanded));
    this.expandToggle.disabled = this.visibleKeys.length === 0;
    (0, import_obsidian5.setIcon)(this.expandToggle, this.allExpanded ? "fold-vertical" : "list-tree");
    this.summary.textContent = `${visible} properties \xB7 ${scope === null ? "Entire vault" : "Custom selection"}`;
    if (!visible) el2(this.body, "div", "pv-empty", scope?.length === 0 ? "Choose properties above to start exploring." : "No matching properties. Adjust your search or selection.");
    this.body.scrollTop = scroll;
    if (focusId) Array.from(this.contentEl.querySelectorAll("[data-pv-focus]")).find((e) => e.dataset.pvFocus === focusId)?.focus({ preventScroll: true });
  }
  nodeButton(row, property, node, run) {
    const isKey = node === property;
    const button = this.button(row, "", `${isKey ? "Toggle" : "Show notes with"} ${property.label}${isKey ? "" : ": " + node.label} (${node.paths.size})`, run);
    button.className = "pv-node";
    button.dataset.pvFocus = JSON.stringify([property.id, isKey ? null : node.id]);
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      this.showMenu(event, property, node);
    });
    button.addEventListener("keydown", (event) => {
      if (event.key === "ContextMenu" || event.shiftKey && event.key === "F10") {
        event.preventDefault();
        const rect = button.getBoundingClientRect();
        this.showMenu(new MouseEvent("contextmenu", { clientX: rect.left, clientY: rect.bottom }), property, node);
      }
    });
    if (isKey) {
      const type = this.plugin.typeResolver.typeFor(property);
      const icon = el2(button, "span", "pv-icon pv-type-icon");
      icon.title = `Type: ${type}`;
      icon.setAttribute("aria-hidden", "true");
      (0, import_obsidian5.setIcon)(icon, this.plugin.typeResolver.iconFor(property));
    }
    el2(button, "span", "pv-label", node.label);
    if (isKey && this.plugin.prefs.pinned.includes(property.id)) (0, import_obsidian5.setIcon)(el2(button, "span", "pv-pin"), "pin");
    if (!isKey) {
      const kind = JSON.parse(node.id)[0];
      if (kind !== "string") el2(button, "span", "pv-kind", kind);
    }
    if (this.plugin.prefs.counts) el2(button, "span", "pv-count", String(node.paths.size));
    return button;
  }
  renderNotes(parent, node, id, ancestorMatches) {
    const notes = el2(parent, "div", "pv-notes");
    const paths = [...node.paths].sort(natural).filter((path) => !this.query || ancestorMatches || this.matches(path, "note"));
    const limitKey = `notes:${id}`;
    const limit = this.limits.get(limitKey) ?? 100;
    for (const path of paths.slice(0, limit)) {
      const button = this.button(notes, "", path, () => {
      });
      button.className = "pv-file";
      (0, import_obsidian5.setIcon)(el2(button, "span", "pv-icon"), "file-text");
      el2(button, "span", "pv-note-name", path.split("/").pop()?.replace(/\.md$/, "") ?? path);
      const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
      if (folder) el2(button, "small", "pv-note-path", folder);
      button.addEventListener("click", (event) => {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof import_obsidian5.TFile) void this.app.workspace.getLeaf(event.ctrlKey || event.metaKey).openFile(file).catch(() => new import_obsidian5.Notice("Unable to open note."));
      });
    }
    if (paths.length > limit) this.button(notes, "Show more notes", "Show 100 more notes", () => {
      this.limits.set(limitKey, limit + 100);
      this.render();
    });
  }
  queryFor(property, node) {
    if (property === node) return propertyQuery(property.label);
    const [kind] = JSON.parse(node.id);
    return propertyQuery(property.label, node.label, kind === "empty");
  }
  async copy(text) {
    try {
      await this.contentEl.ownerDocument.defaultView.navigator.clipboard.writeText(text);
      new import_obsidian5.Notice("Copied to clipboard.");
    } catch {
      new import_obsidian5.Notice("Clipboard unavailable.");
    }
  }
  async search(property, node) {
    const query = this.queryFor(property, node);
    let created = null;
    try {
      let leaf = this.app.workspace.getLeavesOfType("search")[0];
      if (!leaf) {
        const newLeaf = this.app.workspace.getLeftLeaf(true) ?? this.app.workspace.getLeaf(true);
        created = newLeaf;
        leaf = newLeaf;
        await newLeaf.setViewState({ type: "search", active: true });
      }
      const view = leaf.view;
      if (typeof view.setQuery !== "function") {
        created?.detach();
        created = null;
        new import_obsidian5.Notice("Enable the Search core plugin to use Open in Search.");
        return;
      }
      view.setQuery(query);
      created = null;
      await this.app.workspace.revealLeaf(leaf);
      if (node !== property && JSON.parse(node.id)[0] === "empty") {
        new import_obsidian5.Notice("Search matches null properties; the local empty row also includes blank strings and empty lists.");
      }
    } catch {
      if (created) {
        created.detach();
        created = null;
        new import_obsidian5.Notice("Enable the Search core plugin to use Open in Search.");
        return;
      }
      new import_obsidian5.Notice("Could not open Search. Your notes remain available in the property tree.");
    }
  }
  showMenu(event, property, node) {
    const menu = new import_obsidian5.Menu();
    menu.addItem((item) => item.setTitle("Open in Search").setIcon("search").onClick(() => {
      void this.search(property, node);
    }));
    menu.addItem((item) => item.setTitle("Copy search query").setIcon("copy").onClick(() => {
      void this.copy(this.queryFor(property, node));
    }));
    menu.addItem((item) => item.setTitle("Copy matching note links").setIcon("link").onClick(() => {
      void this.copy([...node.paths].sort(natural).map((path) => `[[${path.replace(/\.md$/, "")}]]`).join("\n"));
    }));
    if (node === property) {
      menu.addItem((item) => item.setTitle("Rename property\u2026").setIcon("pencil").onClick(() => this.plugin.renameProperty(property)));
      const pinned = this.plugin.prefs.pinned.includes(property.id);
      menu.addItem((item) => item.setTitle(pinned ? "Unpin property" : "Pin property").setIcon("pin").onClick(() => {
        this.plugin.prefs.pinned = pinned ? this.plugin.prefs.pinned.filter((key) => key !== property.id) : [...this.plugin.prefs.pinned, property.id];
        void this.plugin.save();
        this.render();
      }));
      menu.addItem((item) => item.setTitle("Hide property").setIcon("eye-off").onClick(() => {
        this.plugin.prefs.hidden += `
${property.label}`;
        void this.plugin.save();
        this.render();
        new import_obsidian5.Notice("Property hidden. Restore it in Supercharged Properties settings.");
      }));
    }
    if (node !== property) {
      const [kind] = JSON.parse(node.id);
      const addEdit = (title, mode) => menu.addItem((item) => item.setTitle(title).setIcon("pencil").onClick(() => this.plugin.editValue(property, node, mode)));
      if (kind !== "empty") {
        addEdit("Rename value\u2026", "rename");
        if ([...property.values.values()].some((value) => value !== node && JSON.parse(value.id)[0] === kind)) addEdit("Merge value\u2026", "merge");
        if (kind === "string" && !isWikilink(node.label)) {
          addEdit("Convert to wikilink\u2026", "wikilink");
          if (supportsTextSplit(property, this.plugin.typeResolver)) addEdit("Split into list\u2026", "split");
        }
      }
    }
    menu.showAtMouseEvent(event);
  }
};
var PreferencesTab = class extends import_obsidian5.PluginSettingTab {
  constructor(plugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }
  getSettingDefinitions() {
    return [
      { name: "Show note counts", render: (setting) => {
        setting.addToggle((toggle) => toggle.setValue(this.plugin.prefs.counts).onChange(async (value) => {
          this.plugin.prefs.counts = value;
          await this.plugin.save();
        }));
      } },
      { name: "Sort by", render: (setting) => {
        setting.addDropdown((dropdown) => dropdown.addOptions(sortOptions).setValue(this.plugin.prefs.sort).onChange(async (value) => {
          this.plugin.prefs.sort = sortOrder(value);
          await this.plugin.save();
        }));
      } },
      { name: "Excluded folders", desc: "One vault-relative folder path per line, for example Templates or Resources/Templates. Includes subfolders; paths are case-sensitive, not patterns. Excluded notes are omitted from the tree, counts, copied links, and new bulk edits. Leave empty to include all folders.", render: (setting) => {
        setting.addTextArea((text) => text.setValue(this.plugin.prefs.excludedFolders).onChange((value) => this.plugin.setExcludedFolders(value)));
      } },
      { name: "Hidden properties", desc: "One property name per line. Leave empty to show all YAML properties.", render: (setting) => {
        setting.addTextArea((text) => text.setValue(this.plugin.prefs.hidden).onChange(async (value) => {
          this.plugin.prefs.hidden = value;
          await this.plugin.save();
        }));
      } }
    ];
  }
  display() {
    this.containerEl.replaceChildren();
    for (const definition of this.getSettingDefinitions()) {
      const setting = new import_obsidian5.Setting(this.containerEl).setName(definition.name);
      if (definition.desc) setting.setDesc(definition.desc);
      definition.render(setting);
    }
  }
};
