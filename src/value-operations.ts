// SPDX-License-Identifier: MIT
// Supercharged Properties: pure frontmatter value transforms.

import { fold } from './index';
import type { PropertyValueKind } from './frontmatter-values';

export type ValueEditMode = 'rename' | 'merge' | 'wikilink' | 'split';

export interface ValueEditRequest {
  readonly property: string;
  readonly kind: PropertyValueKind;
  readonly value: string;
  readonly mode: ValueEditMode;
  readonly replacement?: string;
  readonly delimiter?: string;
}

export interface ValueTransform { readonly changed: number; readonly value: unknown }

/** Find the original frontmatter key for a folded property id. */
export function propertyKey(frontmatter: Record<string, unknown>, property: string): string | undefined {
  const target = fold(property);
  for (const key of Object.keys(frontmatter)) {
    if (key !== 'position' && fold(key) === target) return key;
  }
  return undefined;
}

export function getPropertyValue(frontmatter: Record<string, unknown>, property: string): unknown {
  const key = propertyKey(frontmatter, property);
  return key === undefined ? undefined : frontmatter[key];
}

/** Replace matching values in place and return how many scalar values changed. */
export function applyToFrontmatter(frontmatter: Record<string, unknown>, request: ValueEditRequest): number {
  const key = propertyKey(frontmatter, request.property);
  if (key === undefined) return 0;
  const result = transformValue(frontmatter[key], request, false);
  if (!result.changed) return 0;
  frontmatter[key] = result.value;
  return result.changed;
}

/** Transform a property value without mutating the frontmatter. */
export function previewValue(raw: unknown, request: ValueEditRequest): ValueTransform {
  return transformValue(raw, request, false);
}

export function isWikilink(text: string): boolean {
  return /^\[\[[\s\S]*\]\]$/.test(text.trim());
}

export function formatPropertyValue(value: unknown): string {
  if (value === undefined) return '(missing)';
  if (value === null) return '(empty)';
  if (typeof value === 'string') return value || '(empty)';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.map(formatPropertyValue).join(', ')}]`;
  return JSON.stringify(value) ?? '(unsupported)';
}

export function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === 'object') {
    const copy: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) Object.defineProperty(copy, key, { value: cloneValue(item), enumerable: true, writable: true, configurable: true });
    return copy;
  }
  return value;
}

export function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => sameValue(item, b[index]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every(key => Object.prototype.hasOwnProperty.call(right, key) && sameValue(left[key], right[key]));
  }
  return false;
}

function transformValue(raw: unknown, request: ValueEditRequest, inList: boolean): ValueTransform {
  if (Array.isArray(raw)) {
    let changed = 0;
    let value = raw.map(item => {
      const result = transformValue(item, request, true);
      changed += result.changed;
      return result.value;
    });
    if (changed && (request.mode === 'merge' || request.mode === 'rename')) {
      value = value.filter((item, index) => value.findIndex(other => sameValue(item, other)) === index);
    }
    return changed ? { changed, value } : { changed: 0, value: raw };
  }
  if (!matches(raw, request)) return { changed: 0, value: raw };
  const value = transformScalar(raw, request, inList);
  return sameValue(value, raw) ? { changed: 0, value: raw } : { changed: 1, value };
}

function matches(raw: unknown, request: ValueEditRequest): boolean {
  if (request.kind === 'empty') return false;
  if (request.kind === 'string') {
    return typeof raw === 'string' && raw.trim() !== '' && fold(raw) === fold(request.value);
  }
  if (request.kind === 'number') return typeof raw === 'number' && Number.isFinite(raw) && String(raw) === request.value;
  return typeof raw === 'boolean' && String(raw) === request.value;
}

function transformScalar(raw: unknown, request: ValueEditRequest, inList: boolean): unknown {
  switch (request.mode) {
    case 'rename':
    case 'merge':
      return coerce(request.kind, request.replacement ?? '');
    case 'wikilink': {
      if (typeof raw !== 'string') return raw;
      const text = raw.trim();
      if (!text || isWikilink(text) || /[\r\n[\]]/.test(text)) return raw;
      return `[[${text}]]`;
    }
    case 'split': {
      if (inList || typeof raw !== 'string') return raw;
      const delimiter = request.delimiter ?? ',';
      if (!delimiter) return raw;
      const parts = raw.split(delimiter).map(part => part.trim()).filter(Boolean);
      return parts.length > 1 ? parts : raw;
    }
  }
}

function coerce(kind: PropertyValueKind, replacement: string): unknown {
  const text = replacement.trim();
  if (kind === 'number' && text !== '' && Number.isFinite(Number(text))) return Number(text);
  if (kind === 'boolean') {
    const lower = text.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
  }
  return replacement;
}
