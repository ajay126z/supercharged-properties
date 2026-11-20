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

// src/inline-conversion.ts
var import_obsidian = require("obsidian");

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
var PropertyIndex = class _PropertyIndex {
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
  /** Derive a read-only index for a note subset. Do not update the result. */
  scoped(paths, excludeKey) {
    const result = new _PropertyIndex();
    const intersect = (source) => new Set([...source].filter((path) => paths.has(path)));
    for (const [key, property] of this.properties) {
      if (key === excludeKey) continue;
      const propertyPaths = intersect(property.paths);
      if (!propertyPaths.size) continue;
      const values = /* @__PURE__ */ new Map();
      for (const [id, value] of property.values) {
        const valuePaths = intersect(value.paths);
        if (valuePaths.size) values.set(id, { ...value, paths: valuePaths });
      }
      result.properties.set(key, { ...property, paths: propertyPaths, values });
    }
    return result;
  }
};

// src/inline-properties.ts
function parseInlineProperties(source) {
  const fields2 = /* @__PURE__ */ Object.create(null);
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
  let frontmatter = lines[0]?.trim() === "---";
  let fence;
  const listIndents = [];
  const prose = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (frontmatter) {
      if (i > 0 && /^(---|\.\.\.)\s*$/.test(line)) frontmatter = false;
      continue;
    }
    const unquoted = line.replace(/^(?: {0,3}> ?)+/, "").replace(/^[ \t]+/, (whitespace) => {
      let columns = 0;
      for (const char of whitespace) columns += char === "	" ? 4 - columns % 4 : 1;
      return " ".repeat(columns);
    });
    if (fence) {
      const closing = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(unquoted.slice(fence.indent));
      if (closing && closing[1][0] === fence.char && closing[1].length >= fence.length) fence = void 0;
      continue;
    }
    if (!unquoted.trim()) {
      prose.push("");
      continue;
    }
    const indent = unquoted.length - unquoted.trimStart().length;
    while (listIndents.length && indent < listIndents[listIndents.length - 1]) listIndents.pop();
    const containerIndent = listIndents[listIndents.length - 1] ?? 0;
    if (indent - containerIndent >= 4) continue;
    let content = unquoted.slice(containerIndent);
    let contentIndent = containerIndent;
    const list = /^ {0,3}(?:[-*+]|\d+[.)]) +/.exec(content);
    if (list) {
      contentIndent += list[0].length;
      listIndents.push(contentIndent);
      content = content.slice(list[0].length).replace(/^\[[ xX]\] /, "");
    }
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(content);
    if (marker) {
      fence = { char: marker[1][0], length: marker[1].length, indent: contentIndent };
      continue;
    }
    prose.push(content);
  }
  const text = prose.join("\n").replace(/<!--[\s\S]*?(?:-->|$)|%%[\s\S]*?(?:%%|$)/g, (match) => match.replace(/[^\n]/g, " ")).replace(/(`+)([\s\S]*?)\1(?!`)/g, (match) => match.replace(/[^\n]/g, " "));
  const add = (raw) => {
    const colon = raw.indexOf("::");
    if (colon < 0) return false;
    const key = raw.slice(0, colon).trim().replace(/^\*\*(.*?)\*\*$/, "$1").trim();
    if (!key || /[[\]():`\\]/.test(key) || key === "position") return false;
    const value = raw.slice(colon + 2).trim();
    (fields2[key] ?? (fields2[key] = [])).push(value || null);
    return true;
  };
  for (const line of text.split("\n")) {
    const plain = line.replace(/^\s*(?:[-*+] |\d+[.)] )(?:\[[ xX]\] )?/, "").trim();
    if (add(plain)) continue;
    const stack = [];
    for (let i = 0; i < line.length; i++) {
      if (line[i] === "\\") {
        i++;
        continue;
      }
      if (line[i] === "[" || line[i] === "(") stack.push({ at: i, close: line[i] === "[" ? "]" : ")" });
      else if (stack.length && line[i] === stack[stack.length - 1].close) {
        const start = stack.pop();
        add(line.slice(start.at + 1, i));
      }
    }
  }
  return fields2;
}

// src/inline-edit.ts
var validKey = (key) => !!key.trim() && !/[\r\n[\]():`\\*]/.test(key) && fold(key) !== "position";
function fields(source, property) {
  const candidates = [];
  let offset = 0;
  const add = (raw, at, start, end) => {
    const colon = raw.indexOf("::");
    if (colon < 0) return;
    const rawKey = raw.slice(0, colon), trimmed = rawKey.trim();
    const bold = trimmed.startsWith("**") && trimmed.endsWith("**");
    const key = bold ? trimmed.slice(2, -2).trim() : trimmed;
    if (fold(key) !== fold(property) || !validKey(key)) return;
    const keyStart = at + rawKey.indexOf(key);
    const tail = raw.slice(colon + 2), value = tail.trim();
    const valueStart = at + colon + 2 + (value ? tail.indexOf(value) : tail.length);
    candidates.push({ key, value, keyStart, keyEnd: keyStart + key.length, valueStart, valueEnd: valueStart + value.length, start, end });
  };
  for (const part of source.matchAll(/[^\r\n]*(?:\r\n|\n|\r|$)/g)) {
    if (!part[0]) continue;
    const line = part[0].replace(/[\r\n]+$/, "");
    const prefix = /^(?:\uFEFF)?\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)?/.exec(line)[0];
    add(line.slice(prefix.length), offset + prefix.length, offset, offset + part[0].length);
    const stack = [];
    for (let i = 0; i < line.length; i++) {
      if (line[i] === "\\") {
        i++;
        continue;
      }
      if (line[i] === "[" || line[i] === "(") stack.push({ at: i, close: line[i] === "[" ? "]" : ")" });
      else if (stack.length && line[i] === stack[stack.length - 1].close) {
        const open = stack.pop();
        add(line.slice(open.at + 1, i), offset + open.at + 1, offset + open.at, offset + i + 1);
      }
    }
    offset += part[0].length;
  }
  return candidates.filter((field, i) => {
    let probe = `supercharged_probe_${i}`;
    while (source.includes(probe)) probe += "_";
    const changed = source.slice(0, field.keyStart) + probe + source.slice(field.keyEnd);
    const values = parseInlineProperties(changed)[probe];
    return Array.isArray(values) && values.length === 1 && values[0] === (field.value || null);
  });
}
function inlineEditError(edit) {
  if (edit.mode === "rename-property" && !validKey(edit.replacement)) return "Enter a valid inline property name without brackets, colons, backticks, or line breaks.";
  if (edit.mode === "replace-values" && (!edit.replacement.trim() || /[\r\n]/.test(edit.replacement))) return "Enter a nonempty value on one line.";
  if (edit.mode === "replace-values" && !edit.values?.length) return "Select at least one value.";
  return void 0;
}
function normalized(source) {
  const values = /* @__PURE__ */ new Map();
  for (const [key, items] of Object.entries(parseInlineProperties(source))) values.set(fold(key), [...values.get(fold(key)) ?? [], ...items.map((v) => v ?? "")]);
  return JSON.stringify([...values].map(([key, items]) => [key, items.sort()]).sort());
}
function transformInline(source, edit) {
  const error = inlineEditError(edit);
  if (error) throw new Error(error);
  const parsed = parseInlineProperties(source);
  if (edit.mode === "rename-property" && fold(edit.replacement) !== fold(edit.property) && Object.keys(parsed).some((key) => fold(key) === fold(edit.replacement))) throw new Error("Destination inline property already exists.");
  const selected = new Set(edit.values?.map(fold));
  const matches2 = fields(source, edit.property).filter((field) => edit.mode !== "replace-values" || selected.has(fold(field.value)));
  const expected = /* @__PURE__ */ Object.create(null);
  let expectedCount = 0;
  for (const [key, raw] of Object.entries(parsed)) {
    const values = raw;
    if (fold(key) !== fold(edit.property)) {
      expected[key] = values;
      continue;
    }
    if (edit.mode === "delete-property") {
      expectedCount += values.length;
      continue;
    }
    if (edit.mode === "rename-property") {
      expectedCount += values.length;
      expected[edit.replacement.trim()] = [...expected[edit.replacement.trim()] ?? [], ...values];
    } else expected[key] = values.map((value) => {
      if (!selected.has(fold(value ?? ""))) return value;
      expectedCount++;
      return edit.replacement.trim();
    });
  }
  if (expectedCount !== matches2.length) throw new Error("Some matching inline fields use unsupported or ambiguous formatting; note skipped.");
  const replacements = matches2.map((field) => edit.mode === "delete-property" ? { start: field.start, end: field.end, text: "" } : edit.mode === "rename-property" ? { start: field.keyStart, end: field.keyEnd, text: edit.replacement.trim() } : { start: field.valueStart, end: field.valueEnd, text: edit.replacement.trim() }).sort((a, b) => b.start - a.start);
  let output = source, last = source.length;
  for (const item of replacements) {
    if (item.end > last) throw new Error("Overlapping inline fields; note skipped.");
    output = output.slice(0, item.start) + item.text + output.slice(item.end);
    last = item.start;
  }
  const canonical = (raw) => {
    const result = /* @__PURE__ */ new Map();
    for (const [key, items] of Object.entries(raw)) result.set(fold(key), [...result.get(fold(key)) ?? [], ...items.map((v) => v ?? "")]);
    return JSON.stringify([...result].map(([key, items]) => [key, items.sort()]).sort());
  };
  if (normalized(output) !== canonical(expected)) throw new Error("This edit would change inline field syntax or other fields; note skipped.");
  return output;
}
function inlineQuery(property, value) {
  const quote = (text) => JSON.stringify(text);
  return `line:(${quote(property)} ${quote("::")}${value === void 0 ? "" : ` ${quote(value)}`})`;
}
function inlineRemovalFragments(source, property) {
  transformInline(source, { property, mode: "delete-property", replacement: "" });
  return fields(source, property).map((field) => source.slice(field.start, field.end));
}

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
  const carryPins = (overrides) => {
    if (overrides && Object.prototype.hasOwnProperty.call(overrides, from) && !Object.prototype.hasOwnProperty.call(overrides, to)) Object.defineProperty(overrides, to, { value: overrides[from], enumerable: true, configurable: true, writable: true });
  };
  carryPins(prefs.customPinOverrides);
  for (const profile of prefs.profiles) {
    profile.keys = include(profile.keys);
    carryPins(profile.pinOverrides);
  }
}

// src/note-value-operations.ts
function textOnlyList(property) {
  return ["aliases", "cssclasses"].includes(fold(property));
}
function parseNoteNumber(text) {
  const value = text.trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) return void 0;
  const number = Number(value);
  if (!Number.isFinite(number) || Number.isInteger(number) && !Number.isSafeInteger(number)) return void 0;
  return number === 0 ? 0 : number;
}
function validNoteDate(text, withTime = false) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?)?$/.exec(text);
  if (!match || withTime !== (match[4] !== void 0)) return false;
  const [, yearText, monthText, dayText, hours, minutes, seconds] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] && (!withTime || Number(hours) < 24 && Number(minutes) < 60 && Number(seconds ?? 0) < 60);
}
function noteEditError(edit, property) {
  if (edit.mode === "delete") return;
  if (edit.type === "list") {
    if (!["add", "remove"].includes(edit.mode) || !edit.values.length) return "Choose at least one list value.";
    if (edit.values.some((value) => typeof value === "string" ? !value.trim() || value.includes("\0") : typeof value !== "number" || !Number.isFinite(value))) return "Use nonblank text or finite numbers for list values.";
    if (textOnlyList(property) && edit.values.some((value) => typeof value !== "string")) return "Aliases and CSS classes require text list values.";
    return;
  }
  if (edit.mode !== "set") return "Choose a supported property operation.";
  if (edit.value === null) return;
  switch (edit.type) {
    case "text":
      return typeof edit.value === "string" && !!edit.value.trim() && !edit.value.includes("\0") ? void 0 : "Enter text or choose Set empty.";
    case "checkbox":
      return typeof edit.value === "boolean" ? void 0 : "Choose true, false, or Set empty.";
    case "number":
      return typeof edit.value === "number" && Number.isFinite(edit.value) && (!Number.isInteger(edit.value) || Number.isSafeInteger(edit.value)) ? void 0 : "Enter a finite number within the supported precision.";
    case "date":
      return typeof edit.value === "string" && validNoteDate(edit.value) ? void 0 : "Choose a valid date (YYYY-MM-DD).";
    case "datetime":
      return typeof edit.value === "string" && validNoteDate(edit.value, true) ? void 0 : "Choose a valid local date and time.";
  }
}
function transformNoteValue(original, edit, property) {
  const error = noteEditError(edit, property);
  if (error) return { error };
  if (edit.mode === "delete") return { remove: true };
  if (edit.type === "list") {
    const empty2 = original === null || original === "";
    if (!empty2 && (!Array.isArray(original) || !original.every((item) => typeof item === "string" || typeof item === "number" && Number.isFinite(item)))) return { error: "Only flat text/number lists or empty values are supported." };
    const items = empty2 ? [] : original;
    if (textOnlyList(property) && items.some((item) => typeof item !== "string")) return { error: "This property requires a text list." };
    if (edit.mode === "remove") return { value: empty2 ? original : items.filter((item) => !edit.values.includes(item)) };
    const result = [...items];
    for (const item of edit.values) if (!result.includes(item)) result.push(item);
    return { value: result };
  }
  const empty = original === null || original === "";
  const compatible = edit.type === "number" ? typeof original === "number" && Number.isFinite(original) : edit.type === "checkbox" ? typeof original === "boolean" : typeof original === "string";
  if (!empty && !compatible) return { error: `Stored value does not match the ${edit.type} property type.` };
  return { value: edit.value };
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
    if (request.mode === "delete") return deleteFromList(raw, request);
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
  if (request.mode === "delete") return { changed: 1, value: raw, remove: true };
  const value = transformScalar(raw, request, inList);
  return sameValue(value, raw) ? { changed: 0, value: raw } : { changed: 1, value };
}
function deleteFromList(items, request) {
  let changed = 0;
  const value = [];
  for (const item of items) {
    if (Array.isArray(item)) {
      const result = deleteFromList(item, request);
      changed += result.changed;
      if (result.remove) continue;
      value.push(result.value);
    } else if (matches(item, request)) {
      changed++;
    } else {
      value.push(item);
    }
  }
  return changed ? { changed, value, remove: value.length === 0 } : { changed: 0, value: items };
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
      const parts2 = raw.split(delimiter).map((part) => part.trim()).filter(Boolean);
      return parts2.length > 1 ? parts2 : raw;
    }
    case "delete":
      return raw;
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

// src/inline-conversion.ts
function parts(source) {
  const info = (0, import_obsidian.getFrontMatterInfo)(source);
  const raw = info.exists ? (0, import_obsidian.parseYaml)(info.frontmatter) : {};
  if (raw !== null && (typeof raw !== "object" || Array.isArray(raw))) throw new Error("Frontmatter must be a property mapping.");
  if (!info.exists && /^\uFEFF?---\s*(?:\r?\n|$)/.test(source)) throw new Error("Unclosed frontmatter.");
  return { body: source.slice(info.exists ? info.contentStart : 0), prefix: source.slice(0, info.exists ? info.contentStart : 0), frontmatter: raw ?? {} };
}
function detect(text) {
  if (/^(true|false)$/i.test(text)) return text.toLowerCase() === "true";
  return parseNoteNumber(text) ?? text;
}
function planConversion(source, options, path) {
  if (["position", "tags", "aliases", "cssclasses"].includes(fold(options.property))) throw new Error("Reserved and built-in properties cannot be converted.");
  const parsed = parseInlineProperties(source), keys = Object.keys(parsed).filter((key2) => fold(key2) === fold(options.property));
  if (keys.length !== 1) throw new Error(keys.length ? "Ambiguous folded inline keys." : "Inline property is missing.");
  const key = keys[0], originalParts = parts(source), fm = originalParts.frontmatter;
  const existing = matchingKeys(fm, key);
  if (existing.length > 1 || existing.length === 1 && existing[0] !== key) throw new Error("Folded YAML key collision.");
  const existed = existing.length === 1;
  if (existed && options.conflict === "skip") throw new Error("YAML property already exists.");
  const texts = parsed[key].map((value) => value ?? "");
  const values = texts.map((value) => options.detect ? detect(value) : value);
  let replacement = values.length === 1 ? values[0] : values;
  if (existed && options.conflict === "merge") {
    const original = fm[key];
    if (original !== null && typeof original === "object" && !Array.isArray(original)) throw new Error("Cannot merge a YAML object into a property list.");
    const merged = Array.isArray(original) ? [...original] : [original];
    if (merged.some((value) => value !== null && typeof value === "object")) throw new Error("Cannot merge nested YAML values.");
    for (const value of values) if (!merged.some((item) => sameValue(item, value))) merged.push(value);
    replacement = merged;
  }
  const removed = transformInline(source, { property: key, mode: "delete-property", replacement: "" });
  return { path, before: source, removed: options.move ? inlineRemovalFragments(source, key) : [], body: originalParts.body, afterBody: options.move ? parts(removed).body : originalParts.body, key, existed, original: cloneValue(fm[key]), replacement, frontmatter: fm };
}
var InlineConverter = class {
  constructor(app, editor, includes) {
    this.app = app;
    this.editor = editor;
    this.includes = includes;
  }
  async preview(options, paths) {
    const plan = { options: { ...options }, changes: [], skipped: [] };
    for (const path of new Set(paths)) {
      const file = this.app.vault.getFileByPath(path);
      if (!file || !this.includes(path)) {
        plan.skipped.push({ path, reason: "Note missing or folder excluded." });
        continue;
      }
      try {
        plan.changes.push(planConversion(await this.app.vault.read(file), options, path));
      } catch (error) {
        plan.skipped.push({ path, reason: error instanceof Error ? error.message : "Could not read note." });
      }
    }
    return plan;
  }
  async apply(plan) {
    return this.editor.runExclusive(async () => {
      const snapshots = [], failures = [];
      let skipped = 0, updated = 0;
      for (const change of plan.changes) {
        const file = this.app.vault.getFileByPath(change.path);
        if (!file || !this.includes(change.path)) {
          skipped++;
          continue;
        }
        let stage;
        try {
          if (await this.app.vault.read(file) !== change.before) {
            skipped++;
            continue;
          }
          let wrote = false;
          await this.app.fileManager.processFrontMatter(file, (fm) => {
            if (file.path !== change.path || !this.includes(file.path) || !sameValue(fm, change.frontmatter)) throw new Error("Note changed since preview.");
            setOwnValue(fm, change.key, cloneValue(change.replacement));
            wrote = true;
          });
          if (!wrote) {
            skipped++;
            continue;
          }
          const written = await this.app.vault.read(file);
          const current = parts(written);
          const expected = { ...change.frontmatter };
          setOwnValue(expected, change.key, change.replacement);
          if (!sameValue(current.frontmatter, expected) || current.body !== change.body) {
            await this.app.fileManager.processFrontMatter(file, (fm) => {
              if (!sameValue(fm, expected)) throw new Error("Note changed during conversion; YAML may have been copied. Review the note.");
              if (change.existed) setOwnValue(fm, change.key, cloneValue(change.original));
              else delete fm[change.key];
            });
            throw new Error("Note changed during conversion; YAML assignment reverted and source fields retained.");
          }
          stage = written;
          let after = stage;
          if (plan.options.move) {
            let removed = false;
            await this.app.vault.process(file, (text) => {
              if (text !== stage || file.path !== change.path || !this.includes(file.path)) return text;
              const verified = planConversion(text, { ...plan.options, conflict: "overwrite" }, change.path);
              if (verified.body !== change.body || verified.afterBody !== change.afterBody) return text;
              after = parts(text).prefix + change.afterBody;
              removed = true;
              return after;
            });
            if (!removed) throw new Error("Note changed during conversion; source fields retained.");
          }
          snapshots.push({ change, after });
          updated++;
        } catch (error) {
          if (stage !== void 0) {
            const current = await this.app.vault.read(file).catch(() => void 0);
            if (current === stage || current === void 0) snapshots.push({ change, after: stage });
            else {
              const expected = { ...change.frontmatter };
              setOwnValue(expected, change.key, change.replacement);
              try {
                await this.app.fileManager.processFrontMatter(file, (fm) => {
                  if (!sameValue(fm, expected)) throw new Error("Frontmatter also changed.");
                  if (change.existed) setOwnValue(fm, change.key, cloneValue(change.original));
                  else delete fm[change.key];
                });
              } catch {
                failures.push(`${change.path}: Could not revert the YAML copy; review this note.`);
              }
            }
          }
          failures.push(`${change.path}: ${error instanceof Error ? error.message : "Write failed."}`);
        }
      }
      if (snapshots.length) this.editor.rememberUndo(() => this.undo(snapshots));
      return { updated, skipped, failures };
    });
  }
  async undo(snapshots) {
    let restored = 0, skipped = 0;
    const failures = [];
    for (const { change, after } of snapshots) {
      const file = this.app.vault.getFileByPath(change.path);
      if (!file || !this.includes(change.path)) {
        skipped++;
        continue;
      }
      try {
        let done = false;
        await this.app.vault.process(file, (text) => {
          if (text !== after || file.path !== change.path || !this.includes(file.path)) return text;
          done = true;
          return change.before;
        });
        if (done) restored++;
        else skipped++;
      } catch (error) {
        failures.push({ path: change.path, message: error instanceof Error ? error.message : "Undo failed." });
      }
    }
    return { restored, skipped, failures };
  }
};

// src/inline-conversion-dialog.ts
var import_obsidian2 = require("obsidian");

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

// src/modal-layout.ts
function fitModalViewport(container) {
  const win = container.ownerDocument.defaultView;
  if (!win) return () => {
  };
  const viewport = win.visualViewport;
  let frame;
  const clear = () => {
    container.classList.remove("pv-touch-modal");
    container.style.removeProperty("--pv-dialog-height");
    container.style.removeProperty("--pv-dialog-top");
  };
  const update = () => {
    frame = void 0;
    if (!usesTouchLayout(container)) {
      clear();
      return;
    }
    if (viewport && viewport.scale !== 1) return;
    container.classList.add("pv-touch-modal");
    container.style.setProperty("--pv-dialog-height", `${Math.max(0, Math.floor(viewport?.height ?? win.innerHeight))}px`);
    container.style.setProperty("--pv-dialog-top", `${Math.max(0, Math.floor(viewport?.offsetTop ?? 0))}px`);
  };
  const schedule = () => {
    if (frame !== void 0) win.cancelAnimationFrame(frame);
    frame = win.requestAnimationFrame(update);
  };
  win.addEventListener("resize", schedule);
  viewport?.addEventListener("resize", schedule);
  viewport?.addEventListener("scroll", schedule);
  update();
  return () => {
    if (frame !== void 0) win.cancelAnimationFrame(frame);
    win.removeEventListener("resize", schedule);
    viewport?.removeEventListener("resize", schedule);
    viewport?.removeEventListener("scroll", schedule);
    clear();
  };
}

// src/inline-conversion-dialog.ts
var InlineConversionModal = class extends import_obsidian2.Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
    this.revision = 0;
  }
  onOpen() {
    this.titleEl.textContent = "Convert to YAML property";
    this.containerEl.classList.add("pv-note-modal-container");
    this.modalEl.classList.add("pv-note-value-modal");
    this.contentEl.classList.add("pv-edit-modal", "pv-note-edit");
    this.dispose = fitModalViewport(this.containerEl);
    const scroll = this.contentEl.createDiv({ cls: "pv-note-edit-scroll" });
    scroll.createEl("p", { text: `Convert all occurrences of ${this.options.property} in the selected notes. Value filters, note/path search, and excluded folders limit this list.` });
    scroll.createEl("p", { text: "Repeated fields become a list. Preview before confirming. Undo last property edit restores this batch until reload or another property edit. YAML formatting may change." });
    const options = { property: this.options.property, move: true, detect: false, conflict: "skip" };
    const inputs = [];
    const select = (name, choices, update) => {
      const label2 = scroll.createEl("label", { cls: "pv-edit-field" });
      label2.createSpan({ text: name });
      const input = label2.createEl("select");
      input.setAttribute("aria-label", name);
      inputs.push(input);
      for (const [value, text] of choices) input.createEl("option", { value, text });
      input.addEventListener("change", () => {
        update(input.value);
        invalidate();
      });
    };
    select("Source text", [["move", "Move \u2014 remove inline fields"], ["keep", "Keep \u2014 copy only"]], (value) => {
      options.move = value === "move";
    });
    select("Existing YAML property", [["skip", "Skip"], ["merge", "Merge into list"], ["overwrite", "Overwrite"]], (value) => {
      options.conflict = value;
    });
    const label = scroll.createEl("label", { cls: "pv-scope-choice" }), detection = label.createEl("input");
    detection.type = "checkbox";
    inputs.push(detection);
    label.createSpan({ text: "Detect numbers, checkboxes, and dates" });
    detection.setAttribute("aria-label", "Detect numbers, checkboxes, and dates");
    detection.addEventListener("change", () => {
      options.detect = detection.checked;
      invalidate();
    });
    scroll.createEl("p", { text: "Default: literal text, including links and leading zeros. Detection converts numeric text and true/false; ISO dates remain date-compatible text. Property display types are managed by Obsidian." });
    const selected = new Set(this.options.paths);
    const notes = scroll.createEl("details");
    notes.createEl("summary", { text: `${selected.size} eligible notes \u2014 choose notes` });
    let shown = 0;
    const more = notes.createEl("button", { text: "Show more notes" });
    const showNotes = () => {
      for (const path of this.options.paths.slice(shown, shown + 50)) {
        const row = notes.createEl("label", { cls: "pv-scope-choice" }), input = row.createEl("input");
        input.type = "checkbox";
        input.checked = selected.has(path);
        inputs.push(input);
        row.createSpan({ text: path });
        input.addEventListener("change", () => {
          if (input.checked) selected.add(path);
          else selected.delete(path);
          invalidate();
        });
        notes.insertBefore(row, more);
      }
      shown += 50;
      more.hidden = shown >= this.options.paths.length;
    };
    more.addEventListener("click", showNotes);
    showNotes();
    const preview = scroll.createDiv({ cls: "pv-edit-preview" });
    preview.setAttribute("aria-live", "polite");
    const actions = this.contentEl.createDiv({ cls: "pv-edit-actions" });
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    const inspect = actions.createEl("button", { text: "Preview changes" }), apply = actions.createEl("button", { text: "Confirm conversion", cls: "mod-cta" });
    apply.disabled = true;
    let plan;
    const invalidate = () => {
      this.revision++;
      plan = void 0;
      apply.disabled = true;
      preview.replaceChildren();
    };
    inspect.addEventListener("click", () => {
      const revision = ++this.revision;
      apply.disabled = true;
      inspect.disabled = true;
      preview.textContent = "Reading notes\u2026";
      void this.options.preview({ ...options }, [...selected]).then((result) => {
        if (revision !== this.revision) return;
        plan = result;
        preview.replaceChildren();
        preview.createEl("p", { text: `${result.changes.length} notes will change; ${result.skipped.length} skipped. Showing up to 50 notes; excerpts are limited to 4,000 characters.` });
        for (const change of result.changes.slice(0, 50)) {
          const row = preview.createDiv({ cls: "pv-edit-change" });
          row.createEl("strong", { text: change.path });
          row.createEl("pre", { text: `YAML ${change.key}
Before: ${change.existed ? JSON.stringify(change.original) : "(missing)"}
After: ${JSON.stringify(change.replacement)}`.slice(0, 4e3) });
          row.createEl("pre", { text: result.options.move ? `Removed from body:
${change.removed.join("\n").slice(0, 4e3)}
Body after:
${change.afterBody.slice(0, 4e3)}` : "Inline fields kept." });
        }
        for (const skip of result.skipped.slice(0, 50)) preview.createEl("p", { text: `${skip.path}: ${skip.reason}` });
        apply.disabled = !result.changes.length;
      }).catch(() => {
        if (revision === this.revision) preview.textContent = "Could not preview conversion.";
      }).finally(() => {
        inspect.disabled = false;
      });
    });
    apply.addEventListener("click", () => {
      if (!plan || apply.disabled) return;
      apply.disabled = true;
      inspect.disabled = true;
      cancel.disabled = true;
      more.disabled = true;
      inputs.forEach((input) => {
        input.disabled = true;
      });
      void this.options.apply(plan).then(() => this.close()).catch((error) => {
        new import_obsidian2.Notice(error instanceof Error ? error.message : "Conversion failed.");
        invalidate();
        inspect.disabled = false;
        cancel.disabled = false;
        more.disabled = false;
        inputs.forEach((input) => {
          input.disabled = false;
        });
      });
    });
  }
  onClose() {
    this.revision++;
    this.dispose?.();
    this.contentEl.replaceChildren();
  }
};

// src/inline-editor.ts
var InlineEditor = class {
  constructor(app, includes, coordinator) {
    this.app = app;
    this.includes = includes;
    this.coordinator = coordinator;
    this.last = [];
    this.busy = false;
  }
  canUndo() {
    return !!this.last.length && !this.busy;
  }
  async preview(edit, paths) {
    const plan = { edit, changes: [], skipped: [], error: inlineEditError(edit) };
    if (plan.error) return plan;
    for (const path of new Set(paths)) {
      const file = this.app.vault.getFileByPath(path);
      if (!file || !this.includes(path)) continue;
      try {
        const before = await this.app.vault.read(file), after = transformInline(before, edit);
        if (after !== before) plan.changes.push({ path, before, after });
      } catch (error) {
        plan.skipped.push({ path, reason: error instanceof Error ? error.message : "Could not read note." });
      }
    }
    return plan;
  }
  async apply(plan) {
    if (this.coordinator) return this.coordinator.runExclusive(() => this.applyUnlocked(plan));
    return this.applyUnlocked(plan);
  }
  async applyUnlocked(plan) {
    if (this.busy) throw new Error("Another inline edit is running.");
    if (plan.error) throw new Error(plan.error);
    this.busy = true;
    const applied = [];
    let skipped = 0, failed = 0;
    try {
      for (const change of plan.changes) {
        const file = this.app.vault.getFileByPath(change.path);
        if (!file || !this.includes(change.path)) {
          skipped++;
          continue;
        }
        let wrote = false;
        try {
          await this.app.vault.process(file, (current) => {
            if (current !== change.before || !this.includes(file.path) || file.path !== change.path) return current;
            wrote = true;
            return change.after;
          });
          if (wrote) applied.push(change);
          else skipped++;
        } catch {
          failed++;
        }
      }
      if (applied.length) this.last = applied;
      return { updated: applied.length, skipped, failed };
    } finally {
      this.busy = false;
    }
  }
  async undo() {
    const changes = this.last.map((c) => ({ path: c.path, before: c.after, after: c.before }));
    const result = await this.apply({ edit: { mode: "delete-property", property: "", replacement: "" }, changes, skipped: [] });
    this.last = [];
    return result;
  }
};

// src/inline-dialog.ts
var import_obsidian3 = require("obsidian");
var InlineEditModal = class extends import_obsidian3.Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
    this.revision = 0;
  }
  onOpen() {
    const edit = { ...this.options.edit, values: [...this.options.edit.values ?? []] };
    this.titleEl.textContent = edit.mode === "rename-property" ? "Rename inline property" : edit.mode === "delete-property" ? "Delete inline property" : "Replace inline values";
    this.contentEl.classList.add("pv-edit-modal", "pv-note-edit");
    this.containerEl.classList.add("pv-note-modal-container");
    this.modalEl.classList.add("pv-note-value-modal");
    this.dispose = fitModalViewport(this.containerEl);
    const fields2 = this.contentEl.createDiv({ cls: "pv-note-edit-scroll" });
    fields2.createEl("p", { text: `Property: ${edit.property}. Changes apply to included notes in the active Value filter, regardless of tree search or saved-view selection. YAML frontmatter is not edited.` });
    fields2.createEl("p", { text: "Preview first, then confirm. Notes changed since preview are skipped. Undo last inline property edit is available until reload; a new inline batch replaces it." });
    const controls = fields2.createDiv();
    const inputs = [];
    if (edit.mode === "replace-values") {
      controls.createEl("p", { text: "Select values to replace with one new text value:" });
      for (const value of this.options.values) {
        const label = controls.createEl("label", { cls: "pv-scope-choice" }), input = label.createEl("input");
        input.type = "checkbox";
        const raw = JSON.parse(value.id), text = raw[0] === "empty" ? "" : value.label;
        input.checked = edit.values.includes(text);
        input.setAttribute("aria-label", `Replace ${value.label}`);
        label.createSpan({ text: value.label });
        inputs.push(input);
        input.addEventListener("change", () => {
          edit.values = input.checked ? [...edit.values, text] : edit.values.filter((v) => v !== text);
          invalidate();
        });
      }
    }
    if (edit.mode !== "delete-property") {
      const label = controls.createEl("label", { cls: "pv-edit-field" });
      label.createSpan({ text: edit.mode === "rename-property" ? "New property name" : "New value" });
      const input = label.createEl("input");
      input.type = "text";
      input.value = edit.replacement;
      input.setAttribute("aria-label", edit.mode === "rename-property" ? "New inline property name" : "New inline value");
      inputs.push(input);
      input.addEventListener("input", () => {
        edit.replacement = input.value;
        invalidate();
      });
    } else controls.createEl("p", { text: "Deletes every occurrence of this inline property and its values. Surrounding prose and other fields are preserved." });
    const preview = fields2.createDiv({ cls: "pv-edit-preview" });
    preview.setAttribute("aria-live", "polite");
    const actions = this.contentEl.createDiv({ cls: "pv-edit-actions" });
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    const inspect = actions.createEl("button", { text: "Preview changes" });
    const apply = actions.createEl("button", { text: "Confirm changes", cls: "mod-cta" });
    apply.disabled = true;
    let plan;
    const invalidate = () => {
      this.revision++;
      plan = void 0;
      apply.disabled = true;
      preview.replaceChildren();
    };
    inspect.addEventListener("click", () => {
      const revision = ++this.revision;
      apply.disabled = true;
      inspect.disabled = true;
      preview.textContent = "Reading notes\u2026";
      void this.options.preview({ ...edit, values: [...edit.values] }).then((result) => {
        if (revision !== this.revision) return;
        plan = result;
        preview.replaceChildren();
        preview.createEl("p", { text: result.error ?? `${result.changes.length} notes will change; ${result.skipped.length} skipped.` });
        for (const change of result.changes) {
          const row = preview.createDiv({ cls: "pv-edit-change" });
          row.createEl("strong", { text: change.path });
          row.createEl("pre", { text: `Before:
${change.before}
After:
${change.after}` });
        }
        for (const skip of result.skipped) preview.createEl("p", { text: `${skip.path}: ${skip.reason}` });
        apply.disabled = !!result.error || !result.changes.length;
      }).catch(() => {
        preview.textContent = "Could not preview inline edits.";
      }).finally(() => {
        inspect.disabled = false;
      });
    });
    apply.addEventListener("click", () => {
      if (!plan || apply.disabled) return;
      apply.disabled = true;
      inspect.disabled = true;
      cancel.disabled = true;
      for (const input of inputs) input.disabled = true;
      void this.options.apply(plan).then(() => this.close()).catch((error) => {
        new import_obsidian3.Notice(error instanceof Error ? error.message : "Could not edit inline properties.");
        invalidate();
        inspect.disabled = false;
        cancel.disabled = false;
        for (const input of inputs) input.disabled = false;
      });
    });
  }
  onClose() {
    this.revision++;
    this.dispose?.();
    this.contentEl.replaceChildren();
  }
};

// src/tooltips.ts
function applyTooltips(root, enabled) {
  const selector = "[title], [data-pv-tooltip-title], [aria-label], [data-tooltip-classes]";
  const elements = Array.from(root.querySelectorAll(selector));
  if (root.matches(selector)) elements.push(root);
  for (const element of elements) {
    if (!enabled) {
      if (element.hasAttribute("title")) {
        element.dataset.pvTooltipTitle = element.getAttribute("title");
        element.removeAttribute("title");
      }
    } else if (element.dataset.pvTooltipTitle !== void 0) {
      if (!element.hasAttribute("title")) element.title = element.dataset.pvTooltipTitle;
      delete element.dataset.pvTooltipTitle;
    }
    const classes = new Set((element.getAttribute("data-tooltip-classes") ?? "").split(/\s+/).filter(Boolean));
    if (!enabled && element.hasAttribute("aria-label")) classes.add("pv-tooltip-disabled");
    else classes.delete("pv-tooltip-disabled");
    if (classes.size) element.setAttribute("data-tooltip-classes", [...classes].join(" "));
    else element.removeAttribute("data-tooltip-classes");
  }
}

// src/main.ts
var import_obsidian12 = require("obsidian");

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
    const pinOverrides = loadPinOverrides(value.pinOverrides);
    return [{ ...pinOverrides ? { pinOverrides } : {}, id: value.id, name: value.name.trim(), keys: [...new Set(value.keys.filter((key) => typeof key === "string").map(fold).filter(Boolean))] }];
  });
}
function sameKeys(a, b) {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((key) => right.has(key));
}
function loadViewState(raw) {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const profiles = loadProfiles(value.profiles);
  return {
    profiles,
    ...value.pinned !== void 0 ? { pinned: Array.isArray(value.pinned) ? value.pinned.filter((v) => typeof v === "string").map(fold) : [] } : {},
    ...typeof value.hidden === "string" ? { hidden: value.hidden } : {},
    ...loadPinOverrides(value.customPinOverrides) ? { customPinOverrides: loadPinOverrides(value.customPinOverrides) } : {},
    scope: Array.isArray(value.scope) ? [...new Set(value.scope.filter((key) => typeof key === "string").map(fold).filter(Boolean))] : null,
    activeProfile: typeof value.activeProfile === "string" && profiles.some((profile) => profile.id === value.activeProfile) ? value.activeProfile : null
  };
}
function loadPinOverrides(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return void 0;
  return Object.fromEntries(Object.entries(raw).filter(([key, value]) => fold(key) && typeof value === "boolean").map(([key, value]) => [fold(key), value]));
}

// src/property-types.ts
var import_obsidian4 = require("obsidian");
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
      const path = (0, import_obsidian4.normalizePath)(`${this.app.vault.configDir}/types.json`);
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
function noteEditType(property, resolver) {
  const id = fold(property.id), type = resolver.typeFor(property);
  if (id === "tags" || type === "tags") return void 0;
  if (id === "aliases" || id === "cssclasses" || ["multitext", "list", "aliases"].includes(type)) return "list";
  if (["text", "number", "checkbox", "date", "datetime"].includes(type)) return type;
  return void 0;
}
function supportsTextSplit(property, resolver) {
  return !BUILTIN_TYPES.has(fold(property.id)) && resolver.typeFor(property) === "text";
}

// src/value-editor.ts
var import_obsidian5 = require("obsidian");
var ValueEditor = class {
  constructor(app, includesPath = () => true, noteEditType2 = () => "text") {
    this.app = app;
    this.includesPath = includesPath;
    this.noteEditType = noteEditType2;
    this.busy = false;
  }
  async runExclusive(action) {
    if (this.busy) throw new Error("Another property edit is running.");
    this.busy = true;
    try {
      return await action();
    } finally {
      this.busy = false;
    }
  }
  rememberUndo(action) {
    this.last = void 0;
    this.externalUndo = action;
  }
  canUndo() {
    return (!!this.last || !!this.externalUndo) && !this.busy;
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
      const remove = result.remove === true;
      if (remove && matchingKeys(frontmatter, request.property).length !== 1) continue;
      changes.push({ path, key: propertyKey(frontmatter, request.property), original: cloneValue(raw), replacement: remove ? void 0 : cloneValue(result.value), remove, before: JSON.stringify(raw), after: remove ? "(removed)" : JSON.stringify(result.value) });
    }
    return { total: changes.length, changes };
  }
  previewNoteValue(property, replacement, paths) {
    return this.previewNoteEdit(property, { type: "text", mode: "set", value: replacement }, paths);
  }
  /** Preview typed edits on explicit paths, retaining each note's original key spelling. */
  previewNoteEdit(property, edit, paths) {
    const changes = [], conflicts = [];
    let unchanged = 0;
    for (const path of new Set(paths)) {
      const skip = (message2) => conflicts.push({ path, message: message2 });
      if (!this.includesPath(path)) {
        skip("Folder is excluded.");
        continue;
      }
      if (this.noteEditType(property) !== edit.type) {
        skip("Property type changed or is unsupported.");
        continue;
      }
      const error = noteEditError(edit, property);
      if (error) {
        skip(error);
        continue;
      }
      const file = this.file(path);
      const frontmatter = file ? this.frontmatter(file) : void 0;
      if (!frontmatter) {
        skip("Note or metadata unavailable.");
        continue;
      }
      const keys = matchingKeys(frontmatter, property);
      if (keys.length !== 1) {
        skip(keys.length ? "Ambiguous property keys." : "Property is missing.");
        continue;
      }
      const key = keys[0], original = frontmatter[key];
      const result = transformNoteValue(original, edit, property);
      if (result.error) {
        skip(result.error);
        continue;
      }
      if (!result.remove && sameValue(original, result.value)) {
        unchanged++;
        continue;
      }
      changes.push({ path, key, original: cloneValue(original), replacement: cloneValue(result.value), remove: result.remove === true, noteEditType: edit.type, before: JSON.stringify(original), after: result.remove ? "(property removed)" : JSON.stringify(result.value) });
    }
    return { total: changes.length, changes, conflicts, unchanged };
  }
  previewPropertyDelete(property, paths) {
    const changes = [], conflicts = [];
    for (const path of new Set(paths)) {
      if (!this.includesPath(path)) continue;
      const file = this.file(path);
      const frontmatter = file ? this.frontmatter(file) : void 0;
      if (!frontmatter) {
        conflicts.push({ path, message: "Note or metadata unavailable." });
        continue;
      }
      const keys = matchingKeys(frontmatter, property);
      if (!keys.length) continue;
      if (keys.length !== 1) {
        conflicts.push({ path, message: "Ambiguous source keys." });
        continue;
      }
      const key = keys[0];
      const original = cloneValue(frontmatter[key]);
      changes.push({ path, key, original, replacement: void 0, remove: true, before: JSON.stringify(original), after: "(removed)" });
    }
    return { property, total: changes.length, changes, conflicts };
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
            if ((change.remove || change.noteEditType) && matchingKeys(frontmatter, change.key).length !== 1) return;
            if (change.noteEditType && this.noteEditType(change.key) !== change.noteEditType) return;
            if (change.targetKey !== void 0 && !canRename(frontmatter, change.key, change.targetKey)) return;
            const remove = change.remove === true;
            snapshot = { path: change.path, key: change.key, before: cloneValue(change.original), after: remove ? void 0 : cloneValue(change.replacement), targetKey: change.targetKey, remove };
            if (remove) delete frontmatter[change.key];
            else {
              setOwnValue(frontmatter, change.targetKey ?? change.key, cloneValue(change.replacement));
              if (change.targetKey !== void 0) delete frontmatter[change.key];
            }
          });
          if (snapshot) snapshots.push(snapshot);
          else unchanged++;
        } catch (error) {
          failures.push({ path: change.path, message: message(error) });
        }
      }
      if (snapshots.length) {
        this.last = { snapshots };
        this.externalUndo = void 0;
      }
      return { updated: snapshots.length, unchanged, failures };
    } finally {
      this.busy = false;
    }
  }
  async undo() {
    if (this.busy) throw new Error("Another value edit is running.");
    if (this.externalUndo) {
      const undo = this.externalUndo;
      return this.runExclusive(async () => {
        const result = await undo();
        this.externalUndo = void 0;
        return result;
      });
    }
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
          if (snapshot.remove) {
            if (matchingKeys(frontmatter, snapshot.key).length) {
              skipped++;
              remaining.push(snapshot);
              return;
            }
            matched = true;
            setOwnValue(frontmatter, snapshot.key, cloneValue(snapshot.before));
            return;
          }
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
    return file instanceof import_obsidian5.TFile ? file : void 0;
  }
  frontmatter(file) {
    return this.app.metadataCache.getFileCache(file)?.frontmatter;
  }
};
function message(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/property-rename-dialog.ts
var import_obsidian6 = require("obsidian");
var PropertyRenameModal = class extends import_obsidian6.Modal {
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
        new import_obsidian6.Notice("Could not rename properties.");
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

// src/property-delete-dialog.ts
var import_obsidian7 = require("obsidian");
var PropertyDeleteModal = class extends import_obsidian7.Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
    this.busy = false;
  }
  onOpen() {
    this.titleEl.textContent = "Delete property";
    const content = this.contentEl;
    content.classList.add("pv-edit-modal");
    content.createEl("p", { text: `Delete ${this.options.property} from every eligible note in included folders across the vault, including notes hidden by search filters. Excluded folders are skipped.` });
    content.createEl("p", { cls: "pv-edit-hint", text: "The property key and its values are removed from matching notes. Notes with ambiguous keys or unavailable metadata are skipped. Undo last property edit restores the last batch until reload." });
    const previewEl = content.createDiv({ cls: "pv-edit-preview" });
    previewEl.setAttribute("aria-live", "polite");
    const actions = content.createDiv({ cls: "pv-edit-actions" });
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.type = "button";
    cancel.addEventListener("click", () => this.close());
    const apply = actions.createEl("button", { text: "Delete", cls: "mod-warning" });
    apply.type = "button";
    const render = () => {
      this.displayed = this.options.preview();
      const plan = this.displayed;
      previewEl.replaceChildren();
      apply.textContent = `Delete from ${plan.total} notes`;
      apply.disabled = this.busy || plan.total === 0;
      previewEl.createEl("p", { text: `${plan.total} note${plan.total === 1 ? "" : "s"} will lose this property; ${plan.conflicts.length} will be skipped.` });
      for (const change of plan.changes) {
        const row = previewEl.createDiv({ cls: "pv-edit-change" });
        row.createSpan({ cls: "pv-edit-path", text: change.path });
        row.createSpan({ cls: "pv-edit-values", text: `${change.key}: ${change.before} \u2192 removed` });
      }
      if (plan.conflicts.length) previewEl.createEl("h3", { text: "Skipped notes" });
      for (const conflict of plan.conflicts) previewEl.createEl("p", { cls: "pv-edit-change", text: `${conflict.path}: ${conflict.message}` });
    };
    apply.addEventListener("click", () => {
      if (this.busy || apply.disabled || !this.displayed) return;
      this.busy = true;
      cancel.disabled = true;
      apply.disabled = true;
      apply.textContent = "Deleting\u2026";
      void this.options.apply(this.displayed).then(() => this.close()).catch(() => {
        this.busy = false;
        cancel.disabled = false;
        new import_obsidian7.Notice("Could not delete properties.");
        render();
      });
    });
    render();
    cancel.focus();
  }
  onClose() {
    this.contentEl.replaceChildren();
  }
};

// src/value-dialog.ts
var import_obsidian8 = require("obsidian");
var ValueEditModal = class extends import_obsidian8.Modal {
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
    } else if (this.request.mode === "delete") {
      el(this.contentEl, "p", "pv-edit-hint", "Matching values are removed from eligible notes. If the value is the entire property value, the property key is removed. Empty and object values do not offer deletion.");
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
    if (this.request.mode === "delete") this.applyButton.classList.add("mod-warning");
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
  applyLabel(total) {
    const verb = this.request.mode === "delete" ? "Delete from" : "Apply to";
    return `${verb} ${total} note${total === 1 ? "" : "s"}`;
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
    this.applyButton.textContent = this.applyLabel(preview.total);
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
      this.applyButton.textContent = this.applyLabel(this.displayed?.total ?? 0);
      this.updatePreview();
      new import_obsidian8.Notice("Could not update property values.");
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
    case "delete":
      return "Delete value";
  }
}
function el(parent, tag, cls = "", text = "") {
  return parent.createEl(tag, { cls, text });
}

// src/note-value-dialog.ts
var import_obsidian9 = require("obsidian");

// src/note-value-input.ts
function createNoteValueInput(parent, options, changed) {
  const controls = [];
  const field = (name) => {
    const label = parent.createEl("label", { cls: "pv-edit-field" });
    label.createSpan({ text: name });
    return label;
  };
  const select = (label, name, choices) => {
    const element = label.createEl("select");
    element.setAttribute("aria-label", name);
    for (const [value, text] of choices) element.createEl("option", { text }).value = value;
    element.addEventListener("change", changed);
    controls.push(element);
    return element;
  };
  const validate = (edit) => {
    const error = noteEditError(edit, options.property);
    return error ? { error } : { edit };
  };
  let read;
  if (options.type === "list") {
    const operation = select(field("List operation"), "List operation", [["add", "Add values"], ["remove", "Remove values"], ["delete", "Remove property"]]);
    const choices = parent.createEl("fieldset", { cls: "pv-list-choices" });
    choices.createEl("legend", { text: "Existing list values" });
    const selected = /* @__PURE__ */ new Map();
    for (const value of options.values) {
      const label = choices.createEl("label", { cls: "pv-list-choice" });
      const checkbox = label.createEl("input");
      checkbox.type = "checkbox";
      const description = `${JSON.stringify(value)} (${typeof value === "number" ? "number" : "text"})`;
      label.createSpan({ text: description });
      checkbox.setAttribute("aria-label", `Select list value ${description}`);
      selected.set(checkbox, value);
      controls.push(checkbox);
      checkbox.addEventListener("change", changed);
    }
    if (!options.values.length) choices.createEl("p", { text: "No existing values. Enter values below." });
    const itemTypeLabel = field("Entered value type");
    itemTypeLabel.hidden = textOnlyList(options.property);
    const itemType = select(itemTypeLabel, "Entered value type", [["text", "Text"], ["number", "Number"]]);
    const input = field("Values, one per line").createEl("textarea", { cls: "pv-edit-input" });
    input.rows = 3;
    input.setAttribute("aria-label", "Values, one per line");
    input.placeholder = "One value per line";
    controls.push(input);
    input.addEventListener("input", changed);
    const hint = parent.createEl("p", { cls: "pv-edit-hint", text: "Choose existing items, enter values, or both. Text matching is case-sensitive; numbers and text stay distinct. Add keeps existing items and skips duplicates. Remove deletes all exact matches and keeps an empty list when no items remain." });
    read = () => {
      const removingProperty = operation.value === "delete";
      choices.hidden = input.parentElement.hidden = hint.hidden = removingProperty;
      itemTypeLabel.hidden = removingProperty || textOnlyList(options.property);
      if (removingProperty) return validate({ type: "list", mode: "delete" });
      const values = [...selected].filter(([checkbox]) => checkbox.checked).map(([, value]) => value);
      for (const line of input.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)) {
        if (itemType.value === "number") {
          const number = parseNoteNumber(line);
          if (number === void 0) return { error: `Invalid number: ${line}` };
          values.push(number);
        } else values.push(line);
      }
      return validate({ type: "list", mode: operation.value === "remove" ? "remove" : "add", values: [...new Set(values)] });
    };
  } else {
    const type = options.type;
    const choices = [["", "Choose a value\u2026"]];
    if (type === "checkbox") choices.push(["true", "True (checked)"], ["false", "False (unchecked)"]);
    else {
      for (const [index, value] of options.values.entries()) choices.push([`value:${index}`, String(value)]);
      choices.push(["custom", type === "date" || type === "datetime" ? "Choose a date\u2026" : "Enter new value\u2026"]);
    }
    choices.push(["empty", "Set empty (keep property)"], ["delete", "Remove property"]);
    const destination = select(field("Destination value"), "Destination value", choices);
    const custom = field(type === "date" ? "New date" : type === "datetime" ? "New date and time" : "New value");
    const input = custom.createEl("input", { cls: "pv-edit-input" });
    input.type = type === "number" ? "number" : type === "date" ? "date" : type === "datetime" ? "datetime-local" : "text";
    input.setAttribute("aria-label", type === "date" ? "New date" : type === "datetime" ? "New date and time" : "New value");
    if (type === "number") input.step = "any";
    if (type === "date" || type === "datetime") {
      input.min = type === "date" ? "0001-01-01" : "0001-01-01T00:00";
      input.max = type === "date" ? "9999-12-31" : "9999-12-31T23:59:59";
      if (type === "datetime") input.step = "0.001";
    }
    controls.push(input);
    input.addEventListener("input", changed);
    input.addEventListener("change", changed);
    read = () => {
      custom.hidden = destination.value !== "custom";
      if (destination.value === "delete") return validate({ type, mode: "delete" });
      let value;
      if (destination.value === "empty") value = null;
      else if (type === "checkbox" && ["true", "false"].includes(destination.value)) value = destination.value === "true";
      else if (destination.value === "custom") {
        if (type === "number") {
          const number = parseNoteNumber(input.value);
          if (number === void 0) return { error: "Enter a finite integer or decimal number, or choose Set empty." };
          value = number;
        } else value = type === "datetime" ? input.value.trim().replace(/\.0+$/, "") : input.value.trim();
      } else if (destination.value.startsWith("value:")) value = options.values[Number(destination.value.slice(6))];
      else return {};
      return validate({ type, mode: "set", value });
    };
  }
  return { read, setDisabled: (disabled) => controls.forEach((control) => {
    control.disabled = disabled;
  }), blur: () => controls.forEach((control) => control.blur()) };
}

// src/note-value-dialog.ts
var NoteValueModal = class extends import_obsidian9.Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
    this.busy = false;
  }
  onOpen() {
    this.titleEl.textContent = `Change ${this.options.property}`;
    const content = this.contentEl;
    content.classList.add("pv-edit-modal", "pv-note-edit");
    this.containerEl.classList.add("pv-note-modal-container");
    this.modalEl.classList.add("pv-note-value-modal");
    const disposeViewport = fitModalViewport(this.containerEl);
    const fields2 = content.createDiv({ cls: "pv-note-edit-scroll" });
    const win = content.ownerDocument.defaultView;
    let revealFrame;
    const revealFocusedField = () => {
      if (revealFrame !== void 0) win.cancelAnimationFrame(revealFrame);
      revealFrame = win.requestAnimationFrame(() => {
        revealFrame = void 0;
        const active = content.ownerDocument.activeElement;
        if (!active || !fields2.contains(active)) return;
        const field = active.getBoundingClientRect(), area = fields2.getBoundingClientRect();
        if (field.bottom > area.bottom) fields2.scrollTop += field.bottom - area.bottom;
        else if (field.top < area.top) fields2.scrollTop -= area.top - field.top;
      });
    };
    win.visualViewport?.addEventListener("resize", revealFocusedField);
    win.visualViewport?.addEventListener("scroll", revealFocusedField);
    win.addEventListener("resize", revealFocusedField);
    fields2.addEventListener("focusin", revealFocusedField);
    this.disposeViewport = () => {
      disposeViewport();
      if (revealFrame !== void 0) win.cancelAnimationFrame(revealFrame);
      win.visualViewport?.removeEventListener("resize", revealFocusedField);
      win.visualViewport?.removeEventListener("scroll", revealFocusedField);
      win.removeEventListener("resize", revealFocusedField);
      fields2.removeEventListener("focusin", revealFocusedField);
    };
    fields2.createEl("p", { text: `Property: ${this.options.property} \xB7 ${this.options.count} selected note${this.options.count === 1 ? "" : "s"}` });
    const editor = createNoteValueInput(fields2, this.options, () => render());
    fields2.createEl("p", { cls: "pv-edit-hint", text: "Only the selected notes change. Incompatible stored values are skipped. Undo last property edit restores successful changes until reload or another successful edit. YAML formatting may change." });
    const previewEl = fields2.createDiv({ cls: "pv-edit-preview" });
    previewEl.setAttribute("aria-live", "polite");
    const actions = content.createDiv({ cls: "pv-edit-actions" });
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.type = "button";
    cancel.addEventListener("click", () => this.close());
    const apply = actions.createEl("button", { text: "Apply", cls: "mod-cta" });
    apply.type = "button";
    const render = () => {
      previewEl.replaceChildren();
      this.displayed = void 0;
      apply.disabled = true;
      apply.textContent = "Apply";
      apply.classList.remove("mod-warning");
      const result = editor.read();
      if (result.error) {
        previewEl.createEl("p", { text: result.error });
        return;
      }
      if (!result.edit) return;
      const preview = this.options.preview(result.edit);
      this.displayed = preview;
      apply.disabled = this.busy || preview.total === 0;
      const removingProperty = result.edit.mode === "delete";
      apply.classList.toggle("mod-warning", removingProperty);
      apply.textContent = `${removingProperty ? "Remove property from" : "Apply to"} ${preview.total} note${preview.total === 1 ? "" : "s"}`;
      if (removingProperty) previewEl.createEl("p", { cls: "pv-edit-hint", text: `The entire ${this.options.property} property and all its values will be removed from the selected notes. Other properties and the note body are preserved.` });
      previewEl.createEl("p", { text: `${preview.total} ${removingProperty ? "will lose this property" : "will change"}; ${preview.unchanged} already match; ${preview.conflicts.length} will be skipped.` });
      for (const change of preview.changes) {
        const row = previewEl.createDiv({ cls: "pv-edit-change" });
        row.createSpan({ cls: "pv-edit-path", text: change.path });
        row.createSpan({ cls: "pv-edit-values", text: `${change.before} \u2192 ${change.after === "null" ? "(empty)" : change.after}` });
      }
      for (const conflict of preview.conflicts) previewEl.createEl("p", { cls: "pv-edit-change", text: `${conflict.path}: ${conflict.message}` });
    };
    apply.addEventListener("click", () => {
      if (this.busy || apply.disabled || !this.displayed) return;
      this.busy = true;
      editor.setDisabled(true);
      cancel.disabled = apply.disabled = true;
      apply.textContent = this.displayed.changes.some((change) => change.remove) ? "Removing\u2026" : "Updating\u2026";
      editor.blur();
      void this.options.apply(this.displayed).then(() => this.close()).catch(() => {
        this.busy = false;
        editor.setDisabled(false);
        cancel.disabled = false;
        render();
        new import_obsidian9.Notice("Could not change property values. Review the preview before retrying.");
      });
    });
    render();
  }
  onClose() {
    this.disposeViewport?.();
    this.disposeViewport = void 0;
    this.contentEl.replaceChildren();
  }
};

// src/inline-index.ts
var InlineIndex = class {
  constructor(read, included, changed) {
    this.read = read;
    this.included = included;
    this.changed = changed;
    this.index = new PropertyIndex();
    this.enabled = false;
    this.failures = /* @__PURE__ */ new Set();
    this.epoch = 0;
    this.active = 0;
    this.requests = /* @__PURE__ */ new Map();
    this.queue = /* @__PURE__ */ new Map();
    this.stamps = /* @__PURE__ */ new Map();
  }
  get pending() {
    return this.requests.size;
  }
  stamp(file) {
    return `${file.stat?.mtime}:${file.stat?.size}`;
  }
  setEnabled(enabled, notify = true) {
    this.epoch++;
    this.enabled = enabled;
    this.requests.clear();
    this.queue.clear();
    this.stamps.clear();
    this.failures.clear();
    this.index = new PropertyIndex();
    if (notify) this.changed();
  }
  sync(files, force = false) {
    if (!this.enabled) return;
    const included = new Set(files.filter((file) => this.included(file.path)).map((file) => file.path));
    for (const path of /* @__PURE__ */ new Set([...this.stamps.keys(), ...this.requests.keys(), ...this.failures])) if (!included.has(path)) this.remove(path);
    for (const file of files) if (included.has(file.path) && (force || this.stamps.get(file.path) !== this.stamp(file))) this.update(file);
  }
  update(file, content) {
    const path = file.path;
    if (!this.enabled) return;
    if (file.extension !== "md" || !this.included(path)) {
      this.remove(path);
      return;
    }
    if (content !== void 0) {
      this.requests.delete(path);
      this.queue.delete(path);
      this.failures.delete(path);
      this.index.update(path, parseInlineProperties(content));
      this.stamps.set(path, this.stamp(file));
      this.changed();
      return;
    }
    const request = { file, stamp: this.stamp(file), epoch: this.epoch };
    this.requests.set(path, request);
    this.queue.set(path, request);
    this.pump();
    this.changed();
  }
  remove(path) {
    this.requests.delete(path);
    this.queue.delete(path);
    this.stamps.delete(path);
    this.failures.delete(path);
    this.index.remove(path);
    this.changed();
  }
  pump() {
    while (this.active < 4 && this.queue.size) {
      const [path, request] = this.queue.entries().next().value;
      this.queue.delete(path);
      this.active++;
      void this.load(path, request);
    }
  }
  async load(path, request) {
    const current = () => this.enabled && request.epoch === this.epoch && this.requests.get(path) === request && request.file.path === path && this.included(path);
    try {
      const content = await this.read(request.file);
      if (current()) {
        this.index.update(path, parseInlineProperties(content));
        this.stamps.set(path, request.stamp);
        this.failures.delete(path);
      }
    } catch {
      if (current()) {
        this.index.remove(path);
        this.failures.add(path);
      }
    } finally {
      if (this.requests.get(path) === request) this.requests.delete(path);
      this.active--;
      this.pump();
      if (this.enabled) this.changed();
    }
  }
};

// src/view-picker.ts
var import_obsidian10 = require("obsidian");
var ViewPicker = class {
  constructor(parent, change, showTooltips = () => true) {
    this.change = change;
    this.showTooltips = showTooltips;
    this.choices = [];
    this.active = 0;
    this.typed = "";
    this.typedAt = 0;
    this.keydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        this.close();
        return;
      }
      if (event.key === "Tab") {
        this.close();
        return;
      }
      const last = this.choices.length - 1;
      if (event.key === "ArrowDown") this.active = Math.min(last, this.active + 1);
      else if (event.key === "ArrowUp") this.active = Math.max(0, this.active - 1);
      else if (event.key === "Home") this.active = 0;
      else if (event.key === "End") this.active = last;
      else if (event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const now = Date.now();
        this.typed = (now - this.typedAt < 700 ? this.typed : "") + event.key.toLocaleLowerCase();
        this.typedAt = now;
        const match = this.choices.findIndex((choice) => choice.label.toLocaleLowerCase().startsWith(this.typed));
        if (match >= 0) this.active = match;
      } else return;
      event.preventDefault();
      this.focusOption();
    };
    this.position = () => {
      if (!this.popup) return;
      const win = this.button.ownerDocument.defaultView;
      const viewport = win.visualViewport;
      const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? win.innerWidth, height = viewport?.height ?? win.innerHeight;
      const rect = this.button.getBoundingClientRect();
      const popupWidth = Math.max(0, Math.min(Math.max(rect.width, 220), width - 16));
      const y = rect.bottom + 4;
      this.popup.style.left = `${Math.max(left + 8, Math.min(rect.left, left + width - popupWidth - 8))}px`;
      this.popup.style.top = `${y}px`;
      this.popup.style.width = `${popupWidth}px`;
      this.popup.style.maxHeight = `${Math.max(0, Math.min(360, top + height - y - 8))}px`;
    };
    this.button = parent.createEl("button", { cls: "pv-profile-select", attr: { type: "button", "aria-label": "Property view", "aria-haspopup": "listbox", "aria-expanded": "false" } });
    this.label = this.button.createSpan({ cls: "pv-profile-label" });
    (0, import_obsidian10.setIcon)(this.button.createSpan({ cls: "pv-profile-chevron" }), "chevron-down");
    this.button.addEventListener("click", () => this.popup ? this.close() : this.open());
    this.button.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        this.open(event.key === "ArrowUp");
      }
    });
  }
  setChoices(choices, value) {
    this.choices = choices;
    this.button.value = value;
    this.label.textContent = choices.find((choice) => choice.value === value)?.label ?? "Choose a view";
    this.button.title = this.label.textContent;
    applyTooltips(this.button, this.showTooltips());
    if (this.popup) {
      const focused = this.popup.contains(this.button.ownerDocument.activeElement);
      const scroll = this.popup.scrollTop;
      this.renderOptions();
      this.position();
      if (focused) this.focusOption(false);
      this.popup.scrollTop = scroll;
    }
  }
  open(last = false) {
    if (this.popup || !this.choices.length) return;
    const doc = this.button.ownerDocument;
    const win = doc.defaultView;
    this.popup = doc.body.createDiv({ cls: "pv-view-menu", attr: { role: "listbox", "aria-label": "Property views" } });
    this.popup.id = `pv-views-${win.crypto.randomUUID()}`;
    this.button.setAttribute("aria-controls", this.popup.id);
    this.button.setAttribute("aria-expanded", "true");
    this.active = last ? this.choices.length - 1 : 0;
    this.typed = "";
    this.renderOptions();
    this.position();
    this.focusOption();
    const outside = (event) => {
      if (event.target instanceof win.Node && !this.popup?.contains(event.target) && !this.button.contains(event.target)) this.close(false);
    };
    const scroll = (event) => {
      if (event.target !== this.popup) this.position();
    };
    doc.addEventListener("pointerdown", outside, true);
    doc.addEventListener("focusin", outside);
    doc.addEventListener("scroll", scroll, true);
    win.addEventListener("resize", this.position);
    win.visualViewport?.addEventListener("resize", this.position);
    win.visualViewport?.addEventListener("scroll", this.position);
    this.popup.addEventListener("keydown", this.keydown);
    this.removeListeners = () => {
      doc.removeEventListener("pointerdown", outside, true);
      doc.removeEventListener("focusin", outside);
      doc.removeEventListener("scroll", scroll, true);
      win.removeEventListener("resize", this.position);
      win.visualViewport?.removeEventListener("resize", this.position);
      win.visualViewport?.removeEventListener("scroll", this.position);
    };
  }
  renderOptions() {
    this.popup.replaceChildren();
    this.active = Math.min(this.active, this.choices.length - 1);
    for (const [index, choice] of this.choices.entries()) {
      const option = this.popup.createEl("button", { cls: "pv-view-option", text: choice.label, attr: { type: "button", role: "option", "aria-selected": String(choice.value === this.button.value), tabindex: "-1" } });
      option.dataset.value = choice.value;
      option.addEventListener("click", () => {
        this.close();
        this.change(choice.value);
      });
      option.addEventListener("focus", () => {
        this.active = index;
      });
    }
    applyTooltips(this.popup, this.showTooltips());
  }
  focusOption(scroll = true) {
    const option = this.popup?.children[this.active];
    option?.focus({ preventScroll: true });
    if (scroll && option && this.popup) {
      if (option.offsetTop < this.popup.scrollTop) this.popup.scrollTop = option.offsetTop;
      else if (option.offsetTop + option.offsetHeight > this.popup.scrollTop + this.popup.clientHeight) this.popup.scrollTop = option.offsetTop + option.offsetHeight - this.popup.clientHeight;
    }
  }
  close(restoreFocus = true) {
    if (!this.popup) return;
    this.removeListeners?.();
    this.removeListeners = void 0;
    this.popup.remove();
    this.popup = void 0;
    this.button.setAttribute("aria-expanded", "false");
    this.button.removeAttribute("aria-controls");
    if (restoreFocus) this.button.focus({ preventScroll: true });
  }
};

// src/filter-note-list.ts
var import_obsidian11 = require("obsidian");
var nextListId = 0;
var batchSize = 200;
function noteRows(paths) {
  return [...paths].map((path) => {
    const slash = path.lastIndexOf("/");
    return { path, name: path.slice(slash + 1).replace(/\.md$/i, ""), folder: slash < 0 ? "" : path.slice(0, slash) };
  }).sort((a, b) => natural(a.name, b.name) || a.path.localeCompare(b.path));
}
var FilterNoteList = class {
  constructor(app, bar, panel, clear, hoverParent, source, showTooltips = () => true) {
    this.app = app;
    this.panel = panel;
    this.clear = clear;
    this.hoverParent = hoverParent;
    this.source = source;
    this.showTooltips = showTooltips;
    this.paths = /* @__PURE__ */ new Set();
    this.open = false;
    this.limit = batchSize;
    panel.id = `pv-filter-notes-${++nextListId}`;
    panel.hidden = true;
    this.toggle = bar.createEl("button", { cls: "pv-filter-toggle" });
    this.toggle.type = "button";
    bar.insertBefore(this.toggle, clear);
    this.toggle.setAttribute("aria-controls", panel.id);
    this.count = this.toggle.createSpan();
    this.icon = this.toggle.createSpan({ cls: "pv-icon" });
    this.icon.setAttribute("aria-hidden", "true");
    this.toggle.addEventListener("click", () => {
      this.open = !this.open;
      this.render();
    });
    this.toggle.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" && this.paths.size) {
        event.preventDefault();
        event.stopPropagation();
        this.open = true;
        this.render();
        this.buttons()[0]?.focus();
      } else if (event.key === "Escape" && this.open) this.collapse(event);
    });
    panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.collapse(event);
    });
  }
  reset() {
    this.open = false;
    this.limit = batchSize;
    this.panel.scrollTop = 0;
  }
  update(paths, preserveOpenWhenEmpty = false) {
    if (!paths?.size && !preserveOpenWhenEmpty) this.reset();
    this.paths = paths ?? /* @__PURE__ */ new Set();
    this.render();
  }
  buttons() {
    return Array.from(this.panel.querySelectorAll(".pv-filter-note"));
  }
  collapse(event) {
    event.preventDefault();
    event.stopPropagation();
    this.open = false;
    this.render();
    this.toggle.focus({ preventScroll: true });
  }
  openNote(path, event) {
    const file = this.app.vault.getFileByPath(path);
    if (!file) return;
    void this.app.workspace.getLeaf(import_obsidian11.Keymap.isModEvent(event)).openFile(file).catch(() => new import_obsidian11.Notice("Could not open this note. It may have been moved or deleted."));
  }
  render() {
    const active = this.panel.ownerDocument.activeElement;
    const hadFocus = !!active && this.panel.contains(active);
    const oldButtons = this.buttons();
    const oldIndex = oldButtons.findIndex((button) => button === active);
    const activePath = active?.dataset.path;
    const moreFocused = active?.classList.contains("pv-filter-note-more-button");
    const scroll = this.panel.scrollTop;
    const n = this.paths.size;
    this.count.textContent = `${n} ${n === 1 ? "note" : "notes"}`;
    this.toggle.disabled = n === 0;
    this.toggle.setAttribute("aria-expanded", String(this.open && n > 0));
    this.toggle.setAttribute("aria-label", `${this.open ? "Hide" : "Show"} ${n} filtered ${n === 1 ? "note" : "notes"}`);
    this.toggle.title = this.open ? "Hide matching notes" : "Show matching notes";
    (0, import_obsidian11.setIcon)(this.icon, this.open ? "chevron-up" : "chevron-down");
    applyTooltips(this.toggle, this.showTooltips());
    this.panel.hidden = !this.open || !n;
    this.panel.parentElement?.classList.toggle("pv-filter-notes-open", !this.panel.hidden);
    this.panel.replaceChildren();
    if (this.panel.hidden) {
      if (hadFocus || active === this.toggle && !n) (n ? this.toggle : this.clear).focus({ preventScroll: true });
      return;
    }
    const rows = noteRows(this.paths).slice(0, this.limit);
    const ul = this.panel.createEl("ul", { cls: "pv-filter-note-list" });
    ul.setAttribute("aria-label", "Notes matching the value filter");
    for (const row of rows) {
      const li = ul.createEl("li");
      const button = li.createEl("button", { cls: "pv-filter-note" });
      button.type = "button";
      button.dataset.path = row.path;
      button.title = row.path;
      button.setAttribute("aria-label", `Open ${row.name}${row.folder ? ` in ${row.folder}` : ""}`);
      const icon = button.createSpan({ cls: "pv-icon" });
      icon.setAttribute("aria-hidden", "true");
      (0, import_obsidian11.setIcon)(icon, "file-text");
      button.createSpan({ cls: "pv-filter-note-name", text: row.name });
      if (row.folder) button.createSpan({ cls: "pv-filter-note-folder", text: row.folder });
      button.addEventListener("click", (event) => this.openNote(row.path, event));
      button.addEventListener("auxclick", (event) => {
        if (event.button === 1) {
          event.preventDefault();
          this.openNote(row.path, event);
        }
      });
      button.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          this.openNote(row.path, event);
          return;
        }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        const buttons = this.buttons(), index = buttons.indexOf(button);
        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : index + (event.key === "ArrowDown" ? 1 : -1);
        buttons[Math.max(0, Math.min(buttons.length - 1, next))]?.focus();
      });
      button.addEventListener("pointerenter", (event) => {
        if (event.pointerType !== "mouse" || button.ownerDocument.body.classList.contains("is-mobile")) return;
        this.app.workspace.trigger("hover-link", { event, source: this.source, hoverParent: this.hoverParent, targetEl: button, linktext: row.path, sourcePath: "" });
      });
    }
    if (n > rows.length) {
      const footer = this.panel.createDiv({ cls: "pv-filter-note-more" });
      footer.createSpan({ text: `Showing ${rows.length} of ${n} notes` });
      const more = footer.createEl("button", { cls: "pv-filter-note-more-button", text: `Show ${Math.min(batchSize, n - rows.length)} more` });
      more.type = "button";
      more.addEventListener("click", () => {
        const firstNew = rows.length;
        this.limit += batchSize;
        this.render();
        this.buttons()[firstNew]?.focus();
      });
    }
    applyTooltips(this.panel, this.showTooltips());
    this.panel.scrollTop = scroll;
    if (hadFocus) {
      const buttons = this.buttons();
      const target = buttons.find((button) => button.dataset.path === activePath) ?? (moreFocused ? this.panel.querySelector(".pv-filter-note-more-button") : null) ?? buttons[moreFocused ? buttons.length - 1 : Math.max(0, Math.min(oldIndex, buttons.length - 1))];
      target?.focus({ preventScroll: true });
    }
  }
};

// src/note-menu.ts
function attachNoteMenu(element, open) {
  const doc = element.ownerDocument;
  const win = doc.defaultView;
  if (!win) return () => {
  };
  let timer;
  let start;
  let suppressed = false;
  let opened = false;
  let moved = false;
  const cancel = () => {
    win.clearTimeout(timer);
    timer = void 0;
    doc.removeEventListener("scroll", scroll, true);
  };
  const scroll = () => {
    moved = true;
    suppressed = true;
    cancel();
  };
  const down = (event) => {
    cancel();
    if (event.isPrimary === false) {
      moved = true;
      return;
    }
    suppressed = opened = moved = false;
    start = void 0;
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    doc.addEventListener("scroll", scroll, true);
    timer = win.setTimeout(() => {
      timer = void 0;
      suppressed = opened = true;
      open({ x: event.clientX, y: event.clientY });
    }, 500);
  };
  const move = (event) => {
    if (start?.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) {
      moved = true;
      suppressed = true;
      cancel();
    }
  };
  const up = () => {
    cancel();
    start = void 0;
  };
  const abort = (event) => {
    if (!start || start.id !== event.pointerId) return;
    moved = true;
    suppressed = true;
    up();
  };
  const context = (event) => {
    event.preventDefault();
    cancel();
    if (opened || moved) return;
    suppressed = true;
    opened = !!start;
    open({ x: event.clientX, y: event.clientY });
  };
  const click = (event) => {
    if (suppressed) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  const key = (event) => {
    if (event.key === "ContextMenu" || event.shiftKey && event.key === "F10") {
      event.preventDefault();
      cancel();
      const rect = element.getBoundingClientRect();
      open({ x: rect.left, y: rect.bottom });
    } else if (event.key === "Enter" || event.key === " ") suppressed = false;
  };
  element.addEventListener("pointerdown", down);
  element.addEventListener("pointermove", move);
  element.addEventListener("pointerup", up);
  element.addEventListener("pointercancel", abort);
  element.addEventListener("pointerleave", abort);
  element.addEventListener("contextmenu", context);
  element.addEventListener("click", click, true);
  element.addEventListener("keydown", key);
  return () => {
    cancel();
    element.removeEventListener("pointerdown", down);
    element.removeEventListener("pointermove", move);
    element.removeEventListener("pointerup", up);
    element.removeEventListener("pointercancel", abort);
    element.removeEventListener("pointerleave", abort);
    element.removeEventListener("contextmenu", context);
    element.removeEventListener("click", click, true);
    element.removeEventListener("keydown", key);
  };
}

// src/main.ts
var VIEW = "supercharged-properties";
var defaults = { showTooltips: true, inlineViews: loadViewState(null), showInlineProperties: false, counts: true, sort: "name", hidden: "", excludedFolders: "", expanded: [], pinned: [], scope: null, profiles: [], activeProfile: null };
var SuperchargedPropertiesPlugin = class extends import_obsidian12.Plugin {
  constructor() {
    super(...arguments);
    this.index = new PropertyIndex();
    this.prefs = { ...defaults, inlineViews: loadViewState(null) };
    this.saveQueue = Promise.resolve();
  }
  async onload() {
    const loaded = await this.loadData();
    const saved = loaded && typeof loaded === "object" && !Array.isArray(loaded) ? loaded : {};
    const profiles = loadProfiles(saved?.profiles);
    this.prefs = {
      showInlineProperties: saved.showInlineProperties === true,
      showTooltips: saved.showTooltips !== false,
      inlineViews: loadViewState(saved.inlineViews),
      profiles,
      customPinOverrides: loadPinOverrides(saved.customPinOverrides),
      activeProfile: typeof saved.activeProfile === "string" && profiles.some((profile) => profile.id === saved.activeProfile) ? saved.activeProfile : null,
      scope: Array.isArray(saved?.scope) ? saved.scope.filter((v) => typeof v === "string") : null,
      pinned: Array.isArray(saved?.pinned) ? saved.pinned.filter((v) => typeof v === "string") : [],
      counts: typeof saved?.counts === "boolean" ? saved.counts : true,
      sort: sortOrder(saved?.sort),
      excludedFolders: typeof saved.excludedFolders === "string" ? saved.excludedFolders : "",
      hidden: typeof saved?.hidden === "string" ? saved.hidden : "",
      expanded: Array.isArray(saved?.expanded) ? saved.expanded.filter((v) => typeof v === "string") : []
    };
    this.inline = new InlineIndex((file) => this.app.vault.cachedRead(file), (path) => this.includesPath(path), () => this.refresh());
    this.inline.setEnabled(this.prefs.showInlineProperties);
    this.typeResolver = new PropertyTypeResolver(this.app);
    await this.typeResolver.load();
    this.valueEditor = new ValueEditor(this.app, (path) => this.includesPath(path), (id) => noteEditType({ id }, this.typeResolver));
    this.inlineEditor = new InlineEditor(this.app, (path) => this.includesPath(path), this.valueEditor);
    this.inlineConverter = new InlineConverter(this.app, this.valueEditor, (path) => this.includesPath(path));
    this.registerHoverLinkSource(VIEW, { display: "Supercharged Properties", defaultMod: true });
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
    this.addCommand({ id: "rebuild", name: "Refresh property index", callback: () => this.rebuild(true) });
    this.addCommand({
      id: "undo-value-edit",
      name: "Undo last property edit",
      checkCallback: (checking) => {
        if (!this.valueEditor.canUndo()) return false;
        if (!checking) void this.undoValueEdit();
        return true;
      }
    });
    this.addCommand({ id: "undo-inline-edit", name: "Undo last inline property edit", checkCallback: (checking) => {
      if (!this.inlineEditor.canUndo()) return false;
      if (!checking) void this.inlineEditor.undo().then((result) => {
        new import_obsidian12.Notice(`Restored ${result.updated} notes; skipped ${result.skipped}; ${result.failed} failed.`);
        this.rebuild(true);
      });
      return true;
    } });
    this.addSettingTab(new PreferencesTab(this));
    this.registerEvent(this.app.metadataCache.on("changed", (file, _data, cache) => {
      this.updateIndexedNote(file.path, cache.frontmatter);
      this.inline.update(file, _data);
      this.refresh();
    }));
    this.registerEvent(this.app.metadataCache.on("resolved", () => this.scheduleRebuild()));
    this.registerEvent(this.app.vault.on("create", (file) => {
      if (file instanceof import_obsidian12.TFile && file.extension === "md" && this.includesPath(file.path)) {
        this.inline.update(file);
        const cache = this.app.metadataCache.getFileCache(file);
        if (cache) {
          this.updateIndexedNote(file.path, cache.frontmatter);
          this.refresh();
        }
      }
    }));
    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (file instanceof import_obsidian12.TFile) this.inline.update(file);
    }));
    this.registerEvent(this.app.vault.on("delete", (file) => {
      if (file instanceof import_obsidian12.TFile) {
        this.index.remove(file.path);
        this.inline.remove(file.path);
        this.refresh();
      } else this.scheduleRebuild();
    }));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      if (file instanceof import_obsidian12.TFile) {
        this.index.remove(oldPath);
        this.inline.remove(oldPath);
        this.inline.update(file);
        if (file.extension === "md" && this.includesPath(file.path)) this.updateIndexedNote(file.path, this.app.metadataCache.getFileCache(file)?.frontmatter);
        this.refresh();
      } else this.scheduleRebuild();
    }));
    this.register(() => {
      this.inline.setEnabled(false, false);
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
  async setShowInlineProperties(enabled) {
    this.prefs.showInlineProperties = enabled;
    this.inline.setEnabled(enabled);
    if (enabled) this.inline.sync(this.app.vault.getMarkdownFiles());
    await this.save();
  }
  scheduleRebuild() {
    window.clearTimeout(this.rebuildTimer);
    this.rebuildTimer = window.setTimeout(() => this.rebuild(), 150);
  }
  rebuild(forceInline = false) {
    window.clearTimeout(this.rebuildTimer);
    this.index = new PropertyIndex();
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (this.includesPath(file.path)) this.updateIndexedNote(file.path, this.app.metadataCache.getFileCache(file)?.frontmatter);
    }
    this.inline.sync(this.app.vault.getMarkdownFiles(), forceInline);
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
      new import_obsidian12.Notice("Could not save Supercharged Properties settings. Check vault permissions and available storage.");
    });
    this.refresh();
    return this.saveQueue;
  }
  async applyValueEdit(preview, verb = "Updated") {
    const result = await this.valueEditor.apply(preview);
    new import_obsidian12.Notice(`${verb} ${result.updated} notes; skipped ${result.unchanged} changed notes; ${result.failures.length} failed. Undo last property edit is available in the command palette.`, 1e4);
    for (const failure of result.failures) new import_obsidian12.Notice(`${failure.path}: ${failure.message}`, 1e4);
    this.rebuild();
  }
  async undoValueEdit() {
    const result = await this.valueEditor.undo();
    new import_obsidian12.Notice(`Restored ${result.restored} notes; skipped ${result.skipped} later edits; ${result.failures.length} failed.`, 1e4);
    for (const failure of result.failures) new import_obsidian12.Notice(`${failure.path}: ${failure.message}`, 1e4);
    this.rebuild();
  }
  convertInline(property, paths) {
    new InlineConversionModal(this.app, {
      property: property.label,
      paths,
      preview: (options, selected) => this.inlineConverter.preview(options, selected),
      apply: async (plan) => {
        const result = await this.inlineConverter.apply(plan);
        new import_obsidian12.Notice(`Converted ${result.updated} notes; skipped ${result.skipped}; ${result.failures.length} failed.${result.failures.length ? " " + result.failures.join("\n") : ""}`);
        this.rebuild(true);
      }
    }).open();
  }
  editInline(property, mode, value) {
    const selected = value ? [JSON.parse(value.id)[0] === "empty" ? "" : value.label] : [];
    new InlineEditModal(this.app, {
      edit: { property: property.label, mode, replacement: mode === "rename-property" ? property.label : selected[0] ?? "", values: selected },
      values: [...property.values.values()].sort((a, b) => natural(a.label, b.label)),
      preview: (edit) => this.inlineEditor.preview(edit, property.paths),
      apply: async (plan) => {
        const result = await this.inlineEditor.apply(plan);
        if (result.updated && mode === "rename-property") {
          const state = this.prefs.inlineViews;
          const prefs = { scope: state.scope, profiles: state.profiles, pinned: state.pinned ?? [], hidden: state.hidden ?? "", expanded: [], customPinOverrides: state.customPinOverrides };
          includeRenamedProperty(prefs, property.id, plan.edit.replacement);
          Object.assign(state, { scope: prefs.scope, pinned: prefs.pinned, hidden: prefs.hidden });
          await this.save();
        }
        new import_obsidian12.Notice(`Updated ${result.updated} notes; skipped ${result.skipped}; ${result.failed} failed. Use Undo last inline property edit to restore the last batch.`, 1e4);
        this.rebuild(true);
      }
    }).open();
  }
  renameProperty(property) {
    new PropertyRenameModal(this.app, {
      property: property.label,
      preview: (target) => this.valueEditor.previewPropertyRename(property.id, target, property.paths),
      apply: async (preview) => {
        const result = await this.valueEditor.apply(preview);
        if (result.updated) {
          includeRenamedProperty(this.prefs, preview.source, preview.target);
          await this.save();
        }
        new import_obsidian12.Notice(`Renamed in ${result.updated} notes; skipped ${preview.conflicts.length + result.unchanged}; ${result.failures.length} failed. Use Undo last property edit to restore the last batch.`, 1e4);
        for (const failure of result.failures) new import_obsidian12.Notice(`${failure.path}: ${failure.message}`, 1e4);
        this.rebuild();
      }
    }).open();
  }
  deleteProperty(property) {
    new PropertyDeleteModal(this.app, {
      property: property.label,
      preview: () => this.valueEditor.previewPropertyDelete(property.id, property.paths),
      apply: async (preview) => {
        const result = await this.valueEditor.apply(preview);
        new import_obsidian12.Notice(`Deleted ${property.label} from ${result.updated} notes; skipped ${preview.conflicts.length + result.unchanged}; ${result.failures.length} failed. Use Undo last property edit to restore the last batch.`, 1e4);
        for (const failure of result.failures) new import_obsidian12.Notice(`${failure.path}: ${failure.message}`, 1e4);
        this.rebuild();
      }
    }).open();
  }
  changeNoteValue(property, paths, complete) {
    const type = noteEditType(property, this.typeResolver);
    if (!type) return;
    const selected = [...new Set(paths)];
    const values = [];
    for (const node of property.values.values()) {
      const [kind] = JSON.parse(node.id);
      if (kind !== "string" && kind !== "number") continue;
      const value = kind === "number" ? Number(node.label) : node.label;
      if (type === "list") {
        if (!textOnlyList(property.id) || typeof value === "string") values.push(value);
      } else if (!noteEditError({ type, mode: "set", value }, property.id)) values.push(value);
    }
    values.sort((a, b) => natural(String(a), String(b)));
    new NoteValueModal(this.app, {
      property: property.label,
      count: selected.length,
      type,
      values,
      preview: (edit) => this.valueEditor.previewNoteEdit(property.id, edit, selected),
      apply: async (preview) => {
        await this.typeResolver.load();
        const result = await this.valueEditor.apply(preview);
        const action = preview.changes.some((change) => change.remove) ? "Removed property from" : "Updated";
        new import_obsidian12.Notice(`${action} ${result.updated} notes; ${preview.unchanged} already matched; skipped ${preview.conflicts.length + result.unchanged}; ${result.failures.length} failed. Undo last property edit is available for successful changes.`, 1e4);
        for (const failure of result.failures) new import_obsidian12.Notice(`${failure.path}: ${failure.message}`, 1e4);
        this.rebuild();
        complete();
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
          new import_obsidian12.Notice("Split into list is only available for text properties.");
          return Promise.resolve();
        }
        return this.applyValueEdit(preview, mode === "delete" ? "Deleted from" : "Updated");
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
var PropertiesView = class extends import_obsidian12.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.renderedNotes = /* @__PURE__ */ new Map();
    this.noteMenuDisposers = [];
    this.query = "";
    this.searchScope = "any";
    this.searchExpanded = true;
    this.autoExpandSearchNotes = true;
    this.searchPropertyExpansion = /* @__PURE__ */ new Map();
    this.searchValueExpansion = /* @__PURE__ */ new Map();
    this.expansionContext = "";
    this.filter = null;
    this.inlineView = false;
    this.inlineExpanded = [];
    this.scopeQuery = "";
    this.visibleKeys = [];
    this.allExpanded = false;
    this.expandedValues = /* @__PURE__ */ new Set();
    this.limits = /* @__PURE__ */ new Map();
    this.onSelectionKeydown = (event) => {
      if (event.key === "Escape" && this.selectedNotes) {
        event.preventDefault();
        event.stopPropagation();
        this.selectedNotes = void 0;
        this.render();
      }
    };
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
    this.contentEl.addEventListener("keydown", this.onSelectionKeydown);
    this.disposeViewport?.();
    this.disposeViewport = fitVisibleViewport(this.contentEl);
    const toolbar = el2(this.contentEl, "div", "pv-toolbar");
    this.searchHeader = el2(toolbar, "div", "pv-search-header");
    this.searchHeader.hidden = true;
    const search = el2(this.searchHeader, "div", "pv-search");
    (0, import_obsidian12.setIcon)(el2(search, "span", "pv-icon"), "search");
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
    this.profilePicker = new ViewPicker(profileRow, (value) => {
      const wasInline = this.inlineView;
      this.inlineView = (value === "inline" || value.startsWith("inline:")) && this.plugin.prefs.showInlineProperties;
      if (wasInline !== this.inlineView) {
        this.filter = null;
        this.filterNoteList.reset();
        this.selectedNotes = void 0;
        this.noteAnchor = void 0;
        this.scopeQuery = "";
        this.scopePanel.hidden = true;
        this.scopeButton.setAttribute("aria-expanded", "false");
      }
      const prefs = this.viewPrefs;
      if (value === "all" || value === "inline") {
        prefs.scope = null;
        prefs.activeProfile = null;
      } else if (value === "custom" || value === "inline:custom") prefs.activeProfile = null;
      else {
        const prefix = this.inlineView ? "inline:profile:" : "profile:";
        const profile = prefs.profiles.find((item) => `${prefix}${item.id}` === value);
        if (profile) {
          prefs.scope = [...profile.keys];
          prefs.activeProfile = profile.id;
        }
      }
      this.query = "";
      this.input.value = "";
      this.expandedValues.clear();
      void this.plugin.save();
      this.plugin.refresh();
      this.render();
    }, () => this.plugin.prefs.showTooltips !== false);
    const actions = el2(toolbar, "div", "pv-actions pv-nav-actions");
    toolbar.prepend(actions);
    this.sortButton = this.iconButton(actions, "Sort properties", "arrow-up-narrow-wide", () => this.openSortMenu());
    this.sortButton.setAttribute("aria-haspopup", "menu");
    this.iconButton(actions, "Refresh property index", "refresh-cw", () => this.plugin.rebuild(true));
    this.expandToggle = this.iconButton(actions, "Expand all properties", "list-tree", () => {
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
        this.expandedKeys = this.expandedKeys.filter((key) => !visible.has(key));
      } else {
        this.expandedKeys = [.../* @__PURE__ */ new Set([...this.expandedKeys, ...this.visibleKeys])];
      }
      void this.plugin.save();
      this.render();
    });
    this.searchToggle = this.iconButton(actions, "Toggle search", "search", () => this.toggleSearch(this.searchHeader.hidden));
    this.searchToggle.setAttribute("aria-expanded", "false");
    this.scopePanel = el2(toolbar, "div", "pv-scope-panel");
    this.scopePanel.hidden = true;
    this.filterBar = el2(this.contentEl, "div", "pv-filter-bar");
    this.filterBar.hidden = true;
    this.filterLabel = el2(this.filterBar, "span", "pv-filter-label");
    const filterActions = el2(this.filterBar, "div", "pv-filter-actions");
    const clearFilter = this.button(filterActions, "Clear", "Clear property filter", () => this.setFilter(null));
    const filterNotes = el2(this.contentEl, "div", "pv-filter-notes");
    this.filterNoteList = new FilterNoteList(this.app, filterActions, filterNotes, clearFilter, this, VIEW, () => this.plugin.prefs.showTooltips !== false);
    this.summary = el2(this.contentEl, "div", "pv-summary");
    this.summary.setAttribute("aria-live", "polite");
    this.selectionBar = el2(this.contentEl, "div", "pv-note-selection");
    this.selectionBar.hidden = true;
    this.body = el2(this.contentEl, "div", "pv-tree");
    this.body.setAttribute("aria-label", "Properties, values and notes");
    this.contentEl.appendChild(this.summary);
    this.render();
  }
  async onClose() {
    this.profilePicker?.close(false);
    this.contentEl.removeEventListener("keydown", this.onSelectionKeydown);
    this.disposeNoteMenus();
    this.selectedNotes = void 0;
    this.noteAnchor = void 0;
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
    const menu = new import_obsidian12.Menu();
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
    (0, import_obsidian12.setIcon)(button, icon);
    return button;
  }
  openSortMenu() {
    const menu = new import_obsidian12.Menu();
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
  get inlinePrefs() {
    var _a;
    return (_a = this.plugin.prefs).inlineViews ?? (_a.inlineViews = loadViewState(null));
  }
  get viewPrefs() {
    return this.inlineView ? this.inlinePrefs : this.plugin.prefs;
  }
  get pinOverrides() {
    const prefs = this.viewPrefs;
    const profile = prefs.profiles.find((item) => item.id === prefs.activeProfile);
    return profile ? profile.pinOverrides : prefs.scope !== null ? prefs.customPinOverrides : void 0;
  }
  effectivePins() {
    const pins = new Set(this.inlineView ? this.inlinePrefs.pinned ?? [] : this.plugin.prefs.pinned);
    for (const [key, pinned] of Object.entries(this.pinOverrides ?? {})) {
      if (pinned) pins.add(key);
      else pins.delete(key);
    }
    return pins;
  }
  togglePin(key) {
    const prefs = this.inlineView ? this.inlinePrefs : this.plugin.prefs;
    const pinned = this.effectivePins().has(key);
    const profile = prefs.profiles.find((item) => item.id === prefs.activeProfile);
    if (profile || prefs.scope !== null) {
      const overrides = { ...this.pinOverrides, [key]: !pinned };
      if (profile) profile.pinOverrides = overrides;
      else prefs.customPinOverrides = overrides;
    } else prefs.pinned = pinned ? (prefs.pinned ?? []).filter((item) => item !== key) : [...prefs.pinned ?? [], key];
    void this.plugin.save();
    this.render();
  }
  get expandedKeys() {
    return this.inlineView ? this.inlineExpanded : this.plugin.prefs.expanded;
  }
  set expandedKeys(keys) {
    if (this.inlineView) this.inlineExpanded = keys;
    else this.plugin.prefs.expanded = keys;
  }
  propertyExpanded(key) {
    return this.query ? this.searchPropertyExpansion.get(key) ?? this.searchExpanded : this.expandedKeys.includes(key);
  }
  toggleProperty(key) {
    if (this.query) {
      this.searchPropertyExpansion.set(key, !this.propertyExpanded(key));
      this.render();
      return;
    }
    const keys = new Set(this.expandedKeys);
    if (keys.has(key)) keys.delete(key);
    else keys.add(key);
    this.expandedKeys = [...keys];
    void this.plugin.save();
    this.render();
  }
  renderScope() {
    this.scopePanel.replaceChildren();
    const actions = el2(this.scopePanel, "div", "pv-actions");
    this.button(actions, "All", "Show all properties", () => {
      this.viewPrefs.scope = null;
      this.viewPrefs.activeProfile = null;
      void this.plugin.save();
      this.render();
    });
    this.button(actions, "None", "Clear property selection", () => {
      this.viewPrefs.scope = [];
      void this.plugin.save();
      this.render();
    });
    const search = el2(this.scopePanel, "div", "pv-search pv-picker-search");
    (0, import_obsidian12.setIcon)(el2(search, "span", "pv-icon"), "search");
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
    applyTooltips(this.scopePanel, this.plugin.prefs.showTooltips !== false);
  }
  syncProfiles(index = this.activeIndex()) {
    const choices = [];
    const addSource = (inline, prefs2, source) => {
      const active2 = prefs2.profiles.find((profile) => profile.id === prefs2.activeProfile);
      const hidden = new Set((inline ? this.inlinePrefs.hidden ?? "" : this.plugin.prefs.hidden).split("\n").map(fold).filter(Boolean));
      const available = inline === this.inlineView ? index : source;
      const count = (keys) => new Set([...keys].filter((key) => available.properties.has(key) && !hidden.has(key))).size;
      const prefix2 = inline ? "inline:" : "";
      choices.push({ label: `${inline ? "Inline Properties" : "All properties"} (${count(source.properties.keys())})`, value: inline ? "inline" : "all" });
      if (prefs2.scope !== null && !active2) choices.push({ label: `${inline ? "Inline: " : ""}Custom selection (${count(prefs2.scope)})`, value: `${prefix2}custom` });
      for (const profile of prefs2.profiles) {
        const keys = profile === active2 ? prefs2.scope ?? [...source.properties.keys()] : profile.keys;
        const modified = profile === active2 && !sameKeys(profile.keys, keys);
        choices.push({ label: `${inline ? "Inline: " : ""}${profile.name}${modified ? " (modified)" : ""} (${count(keys)})`, value: `${prefix2}profile:${profile.id}` });
      }
    };
    addSource(false, this.plugin.prefs, this.plugin.index);
    if (this.plugin.prefs.showInlineProperties) addSource(true, this.inlinePrefs, this.plugin.inline.index);
    const prefs = this.viewPrefs;
    const active = prefs.profiles.find((profile) => profile.id === prefs.activeProfile);
    const prefix = this.inlineView ? "inline:" : "";
    this.profilePicker.setChoices(choices, active ? `${prefix}profile:${active.id}` : prefs.scope === null ? this.inlineView ? "inline" : "all" : `${prefix}custom`);
    if (this.profileUpdate) {
      this.profileUpdate.disabled = !active;
      this.profileRename.disabled = !active;
      this.profileDelete.disabled = !active;
    }
  }
  manageProfile(action) {
    const prefs = this.viewPrefs;
    const active = prefs.profiles.find((profile) => profile.id === prefs.activeProfile);
    const name = this.profileName.value.trim();
    const keys = [...prefs.scope ?? this.sourceIndex().properties.keys()];
    if (action === "new" || action === "update") {
      if (!keys.length) {
        new import_obsidian12.Notice("Please select at least one property.");
        return;
      }
      if (prefs.scope === null || sameKeys(keys, [...this.sourceIndex().properties.keys()])) {
        new import_obsidian12.Notice(this.inlineView ? "Inline Properties View already exists." : "All properties View already exists.");
        return;
      }
    }
    if (action === "new" || action === "rename") {
      if (!name) {
        new import_obsidian12.Notice("Enter a name for this view.");
        this.profileName.focus();
        return;
      }
      if (fold(name) === "all properties") {
        new import_obsidian12.Notice("All properties View already exists.");
        return;
      }
      if (fold(name) === "inline properties") {
        new import_obsidian12.Notice("Inline Properties is a built-in view. Choose another name.");
        return;
      }
      if (prefs.profiles.some((profile) => fold(profile.name) === fold(name) && (action === "new" || profile !== active))) {
        new import_obsidian12.Notice("A view with that name already exists.");
        return;
      }
    }
    if (action === "new") {
      const id = this.contentEl.ownerDocument.defaultView.crypto.randomUUID();
      prefs.profiles.push({ id, name, keys, ...this.pinOverrides ? { pinOverrides: { ...this.pinOverrides } } : {} });
      prefs.activeProfile = id;
      prefs.scope = [...keys];
    } else if (!active) return;
    else if (action === "update") {
      active.keys = keys;
      prefs.scope = [...keys];
    } else if (action === "rename") active.name = name;
    else {
      prefs.customPinOverrides = active.pinOverrides ? { ...active.pinOverrides } : void 0;
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
  renderScopeChoices(index = this.activeIndex()) {
    if (!this.scopeChoices) return;
    const scroll = this.scopeChoices.scrollTop;
    this.scopeChoices.replaceChildren();
    const choices = new Map([...index.properties.values()].map((property) => [property.id, property]));
    for (const key of this.viewPrefs.scope ?? []) {
      if (key !== this.filter?.property && !choices.has(key)) choices.set(key, { id: key, label: key, paths: /* @__PURE__ */ new Set(), values: /* @__PURE__ */ new Map() });
    }
    const properties = this.sorted(choices.values()).filter((property) => fold(property.label).includes(fold(this.scopeQuery)));
    for (const property of properties) {
      const label = el2(this.scopeChoices, "label", "pv-scope-choice");
      const checkbox = el2(label, "input");
      checkbox.type = "checkbox";
      checkbox.checked = this.viewPrefs.scope === null || this.viewPrefs.scope.includes(property.id);
      checkbox.dataset.pvFocus = JSON.stringify(["scope", property.id]);
      checkbox.setAttribute("aria-label", `Include ${property.label}`);
      el2(label, "span", "", property.label);
      checkbox.addEventListener("change", () => {
        const scope = new Set(this.viewPrefs.scope ?? this.sourceIndex().properties.keys());
        if (checkbox.checked) scope.add(property.id);
        else scope.delete(property.id);
        this.viewPrefs.scope = [...scope];
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
  setFilter(filter) {
    this.filter = filter;
    this.filterNoteList.reset();
    this.selectedNotes = void 0;
    this.noteAnchor = void 0;
    this.render();
    (this.inlineView ? this.searchToggle : this.scopeButton).focus({ preventScroll: true });
  }
  filterPaths() {
    if (!this.filter) return null;
    return this.sourceIndex().properties.get(this.filter.property)?.values.get(this.filter.value)?.paths ?? /* @__PURE__ */ new Set();
  }
  sourceIndex() {
    return this.inlineView ? this.plugin.inline.index : this.plugin.index;
  }
  canEditNotes(property) {
    return !this.inlineView && !!noteEditType(property, this.plugin.typeResolver);
  }
  activeIndex(paths = this.filterPaths()) {
    const source = this.sourceIndex();
    return this.filter ? source.scoped(paths ?? /* @__PURE__ */ new Set(), this.filter.property) : source;
  }
  render() {
    if (!this.body) return;
    if (this.inlineView && !this.plugin.prefs.showInlineProperties) {
      this.inlineView = false;
      this.filter = null;
      this.filterNoteList.reset();
      this.selectedNotes = void 0;
      this.noteAnchor = void 0;
      this.plugin.prefs.scope = null;
      this.plugin.prefs.activeProfile = null;
      void this.plugin.save();
    }
    const expansionContext = JSON.stringify([this.inlineView, this.query, this.searchScope, this.viewPrefs.scope, this.viewPrefs.activeProfile, this.filter]);
    if (expansionContext !== this.expansionContext) {
      this.expansionContext = expansionContext;
      this.searchExpanded = true;
      this.autoExpandSearchNotes = true;
      this.searchPropertyExpansion.clear();
      this.searchValueExpansion.clear();
    }
    this.scopeButton.disabled = false;
    this.scopeButton.title = "Choose properties to show";
    const valuePaths = this.filterPaths();
    const index = this.activeIndex(valuePaths);
    this.syncProfiles(index);
    this.disposeNoteMenus();
    this.syncNoteSelection(index);
    this.renderedNotes.clear();
    const focusId = this.contentEl.ownerDocument.activeElement?.dataset.pvFocus;
    const scroll = this.body.scrollTop;
    this.body.replaceChildren();
    if (!this.scopePanel.hidden) this.renderScopeChoices(index);
    const hidden = new Set((this.inlineView ? this.inlinePrefs.hidden ?? "" : this.plugin.prefs.hidden).split("\n").map(fold).filter(Boolean));
    const pinned = this.effectivePins();
    const scope = this.viewPrefs.scope;
    const properties = this.sorted(index.properties.values()).filter((p) => !hidden.has(p.id) && (scope === null || scope.includes(p.id))).sort((a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id)));
    this.sortButton.title = `Sort: ${sortOptions[this.plugin.prefs.sort]}`;
    let visible = 0;
    const searchPaths = /* @__PURE__ */ new Set();
    this.visibleKeys = [];
    for (const property of properties) {
      const keyMatches = !this.query || this.matches(property.label, "key");
      const noteMatches = (node) => [...node.paths].some((path) => this.matches(path, "note"));
      const values = this.sorted(property.values.values()).filter((v) => keyMatches || this.matches(v.label, "value") || noteMatches(v));
      if (!keyMatches && !values.length && !noteMatches(property)) continue;
      visible++;
      const matchingPaths = keyMatches ? property.paths : new Set([...property.paths].filter((path) => this.matches(path, "note")));
      if (!keyMatches) {
        for (const value of values) if (this.matches(value.label, "value")) {
          for (const path of value.paths) matchingPaths.add(path);
        }
      }
      if (this.filter && this.query) for (const path of matchingPaths) searchPaths.add(path);
      this.visibleKeys.push(property.id);
      const group = el2(this.body, "div", "pv-group");
      const row = el2(group, "div", "pv-row pv-property-row");
      const expanded = this.propertyExpanded(property.id);
      const toggle = this.iconButton(row, `${expanded ? "Collapse" : "Expand"} ${property.label}`, expanded ? "chevron-down" : "chevron-right", () => this.toggleProperty(property.id));
      toggle.className = "pv-toggle";
      toggle.dataset.pvFocus = JSON.stringify(["toggle", property.id]);
      toggle.setAttribute("aria-expanded", String(expanded));
      const button = this.nodeButton(row, property, property, () => this.toggleProperty(property.id), matchingPaths.size);
      button.setAttribute("aria-expanded", String(expanded));
      if (!expanded) continue;
      const children = el2(group, "div", "pv-values");
      const limit = this.limits.get(property.id) ?? 100;
      for (const value of values.slice(0, limit)) {
        const valueGroup = el2(children, "div", "pv-value-group");
        const id = JSON.stringify([property.id, value.id]);
        const automaticNotes = this.expandedValues.has(id) || !!this.query && this.autoExpandSearchNotes && !keyMatches && !this.matches(value.label, "value") && noteMatches(value);
        const showNotes = this.query ? this.searchValueExpansion.get(id) ?? automaticNotes : automaticNotes;
        const valueRow = el2(valueGroup, "div", "pv-row");
        const toggleValue = () => {
          if (this.query) this.searchValueExpansion.set(id, !showNotes);
          else if (showNotes) this.expandedValues.delete(id);
          else this.expandedValues.add(id);
          this.render();
        };
        const valueToggle = this.iconButton(valueRow, `${showNotes ? "Collapse" : "Expand"} notes for ${property.label}: ${value.label}`, showNotes ? "chevron-down" : "chevron-right", toggleValue);
        valueToggle.className = "pv-toggle";
        valueToggle.dataset.pvFocus = JSON.stringify(["value-toggle", property.id, value.id]);
        valueToggle.setAttribute("aria-expanded", String(showNotes));
        const matchingCount = keyMatches || this.matches(value.label, "value") ? value.paths.size : [...value.paths].filter((path) => this.matches(path, "note")).length;
        const valueButton = this.nodeButton(valueRow, property, value, toggleValue, matchingCount);
        valueButton.setAttribute("aria-expanded", String(showNotes));
        if (showNotes) this.renderNotes(valueGroup, property, value, id, keyMatches || this.matches(value.label, "value"));
      }
      if (values.length > limit) this.button(children, `Show more (${values.length - limit})`, "Show more values", () => {
        this.limits.set(property.id, limit + 100);
        this.render();
      });
      const assigned = new Set([...property.values.values()].flatMap((value) => [...value.paths]));
      const otherPaths = new Set([...property.paths].filter((path) => !assigned.has(path)));
      if (otherPaths.size) this.renderNotes(children, property, { ...property, paths: otherPaths }, property.id, keyMatches);
    }
    this.allExpanded = this.visibleKeys.length > 0 && this.visibleKeys.every((key) => this.propertyExpanded(key));
    const toggleLabel = this.allExpanded ? "Collapse all properties" : "Expand all properties";
    this.expandToggle.title = toggleLabel;
    this.expandToggle.setAttribute("aria-label", toggleLabel);
    this.expandToggle.setAttribute("aria-pressed", String(this.allExpanded));
    this.expandToggle.disabled = this.visibleKeys.length === 0;
    (0, import_obsidian12.setIcon)(this.expandToggle, this.allExpanded ? "fold-vertical" : "list-tree");
    const displayedPaths = this.filter && this.query ? searchPaths : valuePaths;
    const n = displayedPaths?.size ?? 0;
    const noteCount = `${n} ${n === 1 ? "note" : "notes"}`;
    this.filterBar.hidden = !this.filter;
    if (this.filter) {
      const text = `Filtered by ${this.filter.propertyLabel} = ${this.filter.label}`;
      this.filterLabel.textContent = text;
      this.filterLabel.title = this.filterBar.title = text;
    }
    this.filterNoteList.update(displayedPaths, !!this.query && !!valuePaths?.size);
    this.summary.textContent = `${visible} properties \xB7 ${this.filter ? `Filtered (${noteCount})` : scope === null ? "Entire vault" : "Custom selection"}`;
    if (this.inlineView) {
      const pending = this.plugin.inline.pending, failures = this.plugin.inline.failures.size;
      this.summary.textContent += ` \xB7 Inline properties${pending ? ` \xB7 Indexing ${pending} ${pending === 1 ? "note" : "notes"}\u2026` : ""}${failures ? ` \xB7 ${failures} ${failures === 1 ? "note" : "notes"} could not be read` : ""}`;
    }
    if (!visible) {
      const message2 = this.inlineView && !this.filter && this.plugin.inline.pending ? "Reading inline properties\u2026" : this.inlineView && !this.filter && !this.query && !index.properties.size ? "No inline properties found in included notes." : this.filter && !valuePaths?.size ? "No notes match this filter." : !this.filter && !this.query && scope?.length === 0 ? "Choose properties above to start exploring." : "No matching properties. Adjust your search or selection.";
      el2(this.body, "div", "pv-empty", message2);
    }
    applyTooltips(this.contentEl, this.plugin.prefs.showTooltips !== false);
    this.body.scrollTop = scroll;
    if (focusId) Array.from(this.contentEl.querySelectorAll("[data-pv-focus]")).find((e) => e.dataset.pvFocus === focusId)?.focus({ preventScroll: true });
  }
  nodeButton(row, property, node, run, count = node.paths.size) {
    const isKey = node === property;
    const button = this.button(row, "", `${isKey ? "Toggle" : "Show notes with"} ${property.label}${isKey ? "" : ": " + node.label} (${count})`, run);
    button.className = "pv-node";
    button.dataset.pvFocus = JSON.stringify([property.id, isKey ? null : node.id]);
    this.noteMenuDisposers.push(attachNoteMenu(button, (point) => {
      this.showMenu(new MouseEvent("contextmenu", { clientX: point.x, clientY: point.y }), property, node);
    }));
    if (isKey) {
      const type = this.inlineView ? "Inline text" : this.plugin.typeResolver.typeFor(property);
      const icon = el2(button, "span", "pv-icon pv-type-icon");
      icon.title = `Type: ${type}`;
      icon.setAttribute("aria-hidden", "true");
      (0, import_obsidian12.setIcon)(icon, this.inlineView ? "text" : this.plugin.typeResolver.iconFor(property));
    }
    el2(button, "span", "pv-label", node.label);
    if (isKey && this.effectivePins().has(property.id)) (0, import_obsidian12.setIcon)(el2(button, "span", "pv-pin"), "pin");
    if (!isKey) {
      const kind = JSON.parse(node.id)[0];
      if (kind !== "string") el2(button, "span", "pv-kind", kind);
    }
    if (this.plugin.prefs.counts) el2(button, "span", "pv-count", String(count));
    return button;
  }
  renderNotes(parent, property, node, id, ancestorMatches) {
    const notes = el2(parent, "div", "pv-notes");
    const paths = [...node.paths].sort(natural).filter((path) => !this.query || ancestorMatches || this.matches(path, "note"));
    const limitKey = `notes:${id}`;
    const limit = this.limits.get(limitKey) ?? 100;
    for (const path of paths.slice(0, limit)) {
      const rowId = JSON.stringify(["note", property.id, id, path]);
      const rendered = this.renderedNotes.get(property.id) ?? [];
      rendered.push({ row: rowId, path });
      this.renderedNotes.set(property.id, rendered);
      const row = el2(notes, "div", "pv-note-row");
      if (this.selectedNotes?.property === property.id) {
        const checkbox = el2(row, "input", "pv-note-checkbox");
        checkbox.type = "checkbox";
        checkbox.checked = this.selectedNotes.paths.has(path);
        checkbox.setAttribute("aria-label", `Select ${path} for ${property.label}`);
        checkbox.dataset.pvFocus = JSON.stringify(["note-select", property.id, id, path]);
        checkbox.addEventListener("click", (event) => {
          if (event.shiftKey) {
            event.preventDefault();
            this.selectNoteRange(property, rowId, path);
          }
        });
        checkbox.addEventListener("change", () => {
          this.noteAnchor = { property: property.id, row: rowId, context: this.noteSelectionContext() };
          if (!this.selectedNotes) return;
          if (checkbox.checked) this.selectedNotes.paths.add(path);
          else this.selectedNotes.paths.delete(path);
          this.render();
        });
      }
      const button = this.button(row, "", path, () => {
      });
      button.className = "pv-file";
      button.dataset.pvFocus = rowId;
      button.dataset.notePath = path;
      button.classList.toggle("is-selected", this.selectedNotes?.property === property.id && this.selectedNotes.paths.has(path));
      if (this.canEditNotes(property)) {
        button.setAttribute("aria-haspopup", "menu");
        this.noteMenuDisposers.push(attachNoteMenu(button, (point) => this.showNoteMenu(point, property, path, rowId)));
        button.addEventListener("keydown", (event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          const notes2 = this.renderedNotes.get(property.id) ?? [];
          const index = notes2.findIndex((note) => note.row === rowId);
          const next = notes2[index + (event.key === "ArrowDown" ? 1 : -1)];
          if (!next) return;
          if (event.shiftKey) {
            const paths2 = new Set(this.selectedNotes?.property === property.id ? this.selectedNotes.paths : []);
            paths2.add(path);
            paths2.add(next.path);
            this.selectedNotes = { property: property.id, paths: paths2, context: this.noteSelectionContext() };
            this.render();
          }
          Array.from(this.body.querySelectorAll(".pv-file")).find((note) => note.dataset.pvFocus === next.row)?.focus();
        });
      }
      (0, import_obsidian12.setIcon)(el2(button, "span", "pv-icon"), "file-text");
      el2(button, "span", "pv-note-name", path.split("/").pop()?.replace(/\.md$/, "") ?? path);
      const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
      if (folder) el2(button, "small", "pv-note-path", folder);
      button.addEventListener("click", (event) => {
        const modifiedOpen = event.ctrlKey || event.metaKey;
        if (this.canEditNotes(property)) {
          if (!modifiedOpen && event.shiftKey) {
            event.preventDefault();
            this.selectNoteRange(property, rowId, path);
            return;
          }
          if (!modifiedOpen && (event.altKey || usesTouchLayout(this.contentEl) && this.selectedNotes?.property === property.id)) {
            event.preventDefault();
            const paths2 = new Set(this.selectedNotes?.property === property.id ? this.selectedNotes.paths : []);
            if (paths2.has(path)) paths2.delete(path);
            else {
              paths2.add(path);
              this.noteAnchor = { property: property.id, row: rowId, context: this.noteSelectionContext() };
            }
            this.selectedNotes = { property: property.id, paths: paths2, context: this.noteSelectionContext() };
            this.render();
            return;
          }
          this.noteAnchor = { property: property.id, row: rowId, context: this.noteSelectionContext() };
        } else this.noteAnchor = void 0;
        this.selectedNotes = void 0;
        this.render();
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof import_obsidian12.TFile) void this.app.workspace.getLeaf(event.ctrlKey || event.metaKey).openFile(file).catch(() => new import_obsidian12.Notice("Unable to open note."));
      });
    }
    if (paths.length > limit) this.button(notes, "Show more notes", "Show 100 more notes", () => {
      this.limits.set(limitKey, limit + 100);
      this.render();
    });
  }
  selectNoteRange(property, row, path) {
    const context = this.noteSelectionContext();
    const notes = this.renderedNotes.get(property.id) ?? [];
    const anchor = this.noteAnchor;
    const start = anchor?.property === property.id && anchor.context === context ? notes.findIndex((note) => note.row === anchor.row) : -1;
    const end = notes.findIndex((note) => note.row === row);
    const paths = start >= 0 && end >= 0 ? notes.slice(Math.min(start, end), Math.max(start, end) + 1).map((note) => note.path) : [path];
    if (start < 0) this.noteAnchor = { property: property.id, row, context };
    const selected = new Set(this.selectedNotes?.property === property.id ? this.selectedNotes.paths : []);
    for (const path2 of paths) selected.add(path2);
    this.selectedNotes = { property: property.id, paths: selected, context };
    this.render();
  }
  disposeNoteMenus() {
    for (const dispose of this.noteMenuDisposers) dispose();
    this.noteMenuDisposers = [];
  }
  noteSelectionContext() {
    return JSON.stringify([this.query, this.searchScope, this.plugin.prefs.scope, this.plugin.prefs.hidden, this.plugin.prefs.excludedFolders, this.filter, this.inlineView]);
  }
  syncNoteSelection(index) {
    if (this.noteAnchor?.context !== this.noteSelectionContext()) this.noteAnchor = void 0;
    let selection = this.selectedNotes;
    const property = selection && index.properties.get(selection.property);
    if (selection && (!property || !this.canEditNotes(property) || selection.context !== this.noteSelectionContext())) {
      this.selectedNotes = selection = void 0;
    }
    this.selectionBar.replaceChildren();
    this.selectionBar.hidden = !selection;
    if (!selection || !property) return;
    for (const path of selection.paths) if (!property.paths.has(path)) selection.paths.delete(path);
    el2(this.selectionBar, "span", "pv-selection-count", `${selection.paths.size} selected \xB7 ${property.label}`);
    const change = this.button(this.selectionBar, `Change ${property.label}\u2026`, `Change ${property.label} for selected notes`, () => {
      this.plugin.changeNoteValue(property, [...selection.paths], () => {
        this.selectedNotes = void 0;
        this.noteAnchor = void 0;
        this.render();
      });
    });
    change.disabled = selection.paths.size === 0;
    this.button(this.selectionBar, "Cancel", "Cancel note selection", () => {
      this.selectedNotes = void 0;
      this.noteAnchor = void 0;
      this.render();
    });
  }
  showNoteMenu(point, property, path, row) {
    const menu = new import_obsidian12.Menu();
    const selection = this.selectedNotes;
    const paths = selection?.property === property.id && selection.paths.has(path) ? [...selection.paths] : [path];
    menu.addItem((item) => item.setTitle(`Change ${property.label}\u2026`).setIcon("pencil").onClick(() => {
      this.plugin.changeNoteValue(property, paths, () => {
        this.selectedNotes = void 0;
        this.noteAnchor = void 0;
        this.render();
      });
    }));
    menu.addItem((item) => item.setTitle("Select notes\u2026").setIcon("list-checks").onClick(() => {
      this.noteAnchor = { property: property.id, row, context: this.noteSelectionContext() };
      this.selectedNotes = { property: property.id, paths: /* @__PURE__ */ new Set([path]), context: this.noteSelectionContext() };
      this.render();
    }));
    menu.showAtPosition(point);
  }
  queryFor(property, node) {
    if (this.inlineView) return inlineQuery(property.label, property === node ? void 0 : JSON.parse(node.id)[0] === "empty" ? "" : node.label);
    if (property === node) return propertyQuery(property.label);
    const [kind] = JSON.parse(node.id);
    return propertyQuery(property.label, node.label, kind === "empty");
  }
  async copy(text) {
    try {
      await this.contentEl.ownerDocument.defaultView.navigator.clipboard.writeText(text);
      new import_obsidian12.Notice("Copied to clipboard.");
    } catch {
      new import_obsidian12.Notice("Clipboard unavailable.");
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
      await this.app.workspace.revealLeaf(leaf);
      const view = leaf.view;
      if (typeof view.setQuery !== "function") {
        created?.detach();
        created = null;
        new import_obsidian12.Notice("Enable the Search core plugin to use Open in Search.");
        return;
      }
      view.setQuery(query);
      created = null;
      if (this.inlineView) new import_obsidian12.Notice("Inline Search matches text on the same line and can include code examples or other fields.");
      if (!this.inlineView && node !== property && JSON.parse(node.id)[0] === "empty") {
        new import_obsidian12.Notice("Search matches null properties; the local empty row also includes blank strings and empty lists.");
      }
    } catch {
      if (created) {
        created.detach();
        created = null;
        new import_obsidian12.Notice("Enable the Search core plugin to use Open in Search.");
        return;
      }
      new import_obsidian12.Notice("Could not open Search. Your notes remain available in the property tree.");
    }
  }
  showMenu(event, property, node) {
    const menu = new import_obsidian12.Menu();
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
      menu.addItem((item) => item.setTitle("Rename property\u2026").setIcon("pencil").onClick(() => this.inlineView ? this.plugin.editInline(property, "rename-property") : this.plugin.renameProperty(property)));
      menu.addItem((item) => item.setTitle("Delete property\u2026").setIcon("trash-2").onClick(() => this.inlineView ? this.plugin.editInline(property, "delete-property") : this.plugin.deleteProperty(property)));
      const pinned = this.effectivePins().has(property.id);
      menu.addItem((item) => item.setTitle(pinned ? "Unpin property" : "Pin property").setIcon("pin").onClick(() => {
        this.togglePin(property.id);
      }));
      menu.addItem((item) => item.setTitle("Hide property").setIcon("eye-off").onClick(() => {
        if (this.inlineView) this.inlinePrefs.hidden = `${this.inlinePrefs.hidden ?? ""}
${property.label}`;
        else this.plugin.prefs.hidden += `
${property.label}`;
        void this.plugin.save();
        this.render();
        new import_obsidian12.Notice("Property hidden. Restore it in Supercharged Properties settings.");
      }));
    }
    if (this.inlineView) menu.addItem((item) => item.setTitle("Convert to YAML property\u2026").setIcon("arrow-right-left").onClick(() => {
      const paths = [...node.paths].filter((path) => !this.query || this.searchScope !== "note" || this.matches(path, "note"));
      this.plugin.convertInline(property, paths.sort(natural));
    }));
    if (this.inlineView) menu.addItem((item) => item.setTitle(node === property ? "Replace selected values\u2026" : "Rename value\u2026").setIcon("pencil").onClick(() => this.plugin.editInline(property, "replace-values", node === property ? void 0 : node)));
    if (node !== property) {
      menu.addItem((item) => item.setTitle("Filter by Value").setIcon("filter").onClick(() => {
        this.setFilter({ property: property.id, value: node.id, propertyLabel: property.label, label: node.label });
      }));
      const [kind] = JSON.parse(node.id);
      const addEdit = (title, mode, icon = "pencil") => menu.addItem((item) => item.setTitle(title).setIcon(icon).onClick(() => this.plugin.editValue(property, node, mode)));
      if (!this.inlineView && kind !== "empty") {
        addEdit("Rename value\u2026", "rename");
        if ([...property.values.values()].some((value) => value !== node && JSON.parse(value.id)[0] === kind)) addEdit("Merge value\u2026", "merge");
        addEdit("Delete value\u2026", "delete", "trash-2");
        if (kind === "string" && !isWikilink(node.label)) {
          addEdit("Convert to wikilink\u2026", "wikilink");
          if (supportsTextSplit(property, this.plugin.typeResolver)) addEdit("Split into list\u2026", "split");
        }
      }
    }
    menu.showAtMouseEvent(event);
  }
};
var PreferencesTab = class extends import_obsidian12.PluginSettingTab {
  constructor(plugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }
  getSettingDefinitions() {
    return [
      { name: "Show inline properties", desc: "Add a separate Inline Properties view for Dataview-style fields in note bodies. Reads Markdown notes in included folders; no Dataview plugin is required.", render: (setting) => {
        setting.addToggle((toggle) => toggle.setValue(this.plugin.prefs.showInlineProperties).onChange((value) => this.plugin.setShowInlineProperties(value)));
      } },
      { name: "Show tooltips", desc: "Show hover hints on the property browser controls and rows. Turning this off keeps screen-reader labels and note previews available.", render: (setting) => {
        setting.addToggle((toggle) => toggle.setValue(this.plugin.prefs.showTooltips).onChange(async (value) => {
          this.plugin.prefs.showTooltips = value;
          await this.plugin.save();
        }));
      } },
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
      { name: "Hidden inline properties", desc: "One inline property name per line. Does not hide YAML properties.", render: (setting) => {
        setting.addTextArea((text) => text.setValue(this.plugin.prefs.inlineViews.hidden ?? "").onChange(async (value) => {
          this.plugin.prefs.inlineViews.hidden = value;
          await this.plugin.save();
        }));
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
      const setting = new import_obsidian12.Setting(this.containerEl).setName(definition.name);
      if (definition.desc) setting.setDesc(definition.desc);
      definition.render(setting);
    }
  }
};
