// SPDX-License-Identifier: MIT
import { fold } from './index';
import type { PropertyProfile } from './profiles';

export function propertyNameError(name: string): string | undefined {
  if (!name.trim()) return 'Enter a property name.';
  if (/[\r\n]/.test(name) || name.includes(String.fromCharCode(0))) return 'Property names cannot contain line breaks or null characters.';
  if (fold(name) === 'position') return 'The name position is reserved for metadata.';
  return undefined;
}

export function matchingKeys(frontmatter: Record<string, unknown>, name: string): string[] {
  return Object.keys(frontmatter).filter(key => key !== 'position' && fold(key) === fold(name));
}

/** Exact source spelling is required at write time; folded collisions are never overwritten. */
export function canRename(frontmatter: Record<string, unknown>, source: string, target: string): boolean {
  const keys = matchingKeys(frontmatter, source);
  return !propertyNameError(target) && source !== target && keys.length === 1 && keys[0] === source
    && matchingKeys(frontmatter, target).every(key => key === source);
}

export function setOwnValue(frontmatter: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(frontmatter, key, { value, enumerable: true, writable: true, configurable: true });
}

interface PropertyPreferences {
  customPinOverrides?: Record<string, boolean>; scope: string[] | null; pinned: string[]; expanded: string[]; hidden: string; profiles: PropertyProfile[];
}

/** Keep source references for skipped notes and undo; carry their display preferences to the destination. */
export function includeRenamedProperty(prefs: PropertyPreferences, source: string, target: string): void {
  const from = fold(source), to = fold(target);
  if (from === to) return;
  const include = (keys: string[]) => keys.some(key => fold(key) === from) && !keys.some(key => fold(key) === to) ? [...keys, to] : keys;
  if (prefs.scope) prefs.scope = include(prefs.scope);
  prefs.pinned = include(prefs.pinned);
  prefs.expanded = include(prefs.expanded);
  prefs.hidden = include(prefs.hidden.split('\n')).join('\n');
  const carryPins = (overrides?: Record<string, boolean>) => {
    if (overrides && Object.prototype.hasOwnProperty.call(overrides, from) && !Object.prototype.hasOwnProperty.call(overrides, to)) Object.defineProperty(overrides, to, { value: overrides[from], enumerable: true, configurable: true, writable: true });
  };
  carryPins(prefs.customPinOverrides);
  for (const profile of prefs.profiles) { profile.keys = include(profile.keys); carryPins(profile.pinOverrides); }
}
