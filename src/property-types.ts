// SPDX-License-Identifier: MIT
// Supercharged Properties: public property-type icons.

import { normalizePath, type App } from 'obsidian';
import { fold, PropertyNode } from './index';

const TYPE_ICONS: ReadonlyMap<string, string> = new Map([
  ['text', 'text'],
  ['multitext', 'list'],
  ['aliases', 'list'],
  ['tags', 'tags'],
  ['number', 'hash'],
  ['checkbox', 'check-square'],
  ['date', 'calendar'],
  ['datetime', 'calendar-clock']
]);

const BUILTIN_TYPES: ReadonlyMap<string, string> = new Map([
  ['tags', 'tags'],
  ['aliases', 'aliases'],
  ['cssclasses', 'multitext']
]);

/**
 * Resolves the configured type of a property using public Obsidian APIs only.
 * Types come from the vault's types.json, built-in property names, or the text fallback.
 */
export class PropertyTypeResolver {
  private types = new Map<string, string>();

  constructor(private readonly app: App) {}

  /** Reload types.json. Missing, malformed, or unreadable files keep the built-in fallbacks. */
  async load(): Promise<void> {
    let raw: unknown;
    try {
      const path = normalizePath(`${this.app.vault.configDir}/types.json`);
      if (!(await this.app.vault.adapter.exists(path))) { this.types.clear(); return; }
      const parsed: unknown = JSON.parse(await this.app.vault.adapter.read(path));
      raw = (parsed as { types?: unknown } | null)?.types;
    } catch {
      // Icons are cosmetic; keep whatever was loaded previously and use fallbacks.
      return;
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    const types = new Map<string, string>();
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value !== 'string') continue;
      const normalizedKey = fold(key);
      const normalizedType = fold(value);
      if (normalizedKey && normalizedType) types.set(normalizedKey, normalizedType);
    }
    this.types = types;
  }

  typeFor(property: Pick<PropertyNode, 'id'>): string {
    const id = fold(property.id);
    return this.types.get(id) ?? BUILTIN_TYPES.get(id) ?? 'text';
  }

  iconFor(property: Pick<PropertyNode, 'id'>): string {
    return TYPE_ICONS.get(this.typeFor(property)) ?? 'text';
  }
}

/** Split is a text-property operation, never a special built-in property operation. */
export function supportsTextSplit(property: Pick<PropertyNode, 'id'>, resolver: Pick<PropertyTypeResolver, 'typeFor'>): boolean {
  return !BUILTIN_TYPES.has(fold(property.id)) && resolver.typeFor(property) === 'text';
}
