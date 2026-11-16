// SPDX-License-Identifier: MIT
import { fold } from './index';
import type { PropertyProfile } from './profiles';

interface PropertyPreferences {
  scope: string[] | null;
  pinned: string[];
  expanded: string[];
  hidden: string;
  profiles: PropertyProfile[];
  activeProfile?: string | null;
}

/**
 * Drop references to a property that no longer exists in the tree.
 * Keep the caller's references when a conflict or failure left the property in place.
 */
export function forgetDeletedProperty(prefs: PropertyPreferences, name: string): boolean {
  const target = fold(name);
  const matches = (key: string) => fold(key) === target;
  let changed = false;
  if (prefs.scope) {
    const scope = prefs.scope.filter(key => !matches(key));
    if (scope.length !== prefs.scope.length) { prefs.scope = scope; changed = true; }
  }
  const removeKeys = (keys: string[]) => keys.filter(key => !matches(key));
  const pinned = removeKeys(prefs.pinned);
  if (pinned.length !== prefs.pinned.length) { prefs.pinned = pinned; changed = true; }
  const expanded = removeKeys(prefs.expanded);
  if (expanded.length !== prefs.expanded.length) { prefs.expanded = expanded; changed = true; }
  const hidden = prefs.hidden.split('\n');
  const visible = hidden.filter(line => !matches(line));
  if (visible.length !== hidden.length) { prefs.hidden = visible.join('\n'); changed = true; }
  const profiles: PropertyProfile[] = [];
  for (const profile of prefs.profiles) {
    const keys = removeKeys(profile.keys);
    if (keys.length !== profile.keys.length) { profile.keys = keys; changed = true; }
    if (keys.length) profiles.push(profile);
    else changed = true;
  }
  if (profiles.length !== prefs.profiles.length) {
    prefs.profiles = profiles;
    if (prefs.activeProfile && !profiles.some(profile => profile.id === prefs.activeProfile)) {
      prefs.activeProfile = null;
      changed = true;
    }
  }
  return changed;
}
