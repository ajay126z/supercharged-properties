import { normalizeFolders } from './folder-filter';
import { fold } from './index';
export interface PropertyProfile { id: string; name: string; keys: string[]; folders?: string[]; pinOverrides?: Record<string, boolean> }
export function loadProfiles(raw: unknown): PropertyProfile[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set<string>(); const names = new Set<string>();
  return raw.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const value = entry as Record<string, unknown>;
    if (!value || typeof value.id !== 'string' || !value.id || typeof value.name !== 'string' || !value.name.trim() || !Array.isArray(value.keys)) return [];
    if (ids.has(value.id) || names.has(fold(value.name))) return [];
    ids.add(value.id); names.add(fold(value.name));
    const pinOverrides = loadPinOverrides(value.pinOverrides);
    return [{ ...(value.folders !== undefined ? { folders: normalizeFolders(value.folders) } : {}), ...(pinOverrides ? { pinOverrides } : {}), id: value.id, name: value.name.trim(), keys: [...new Set<string>(value.keys.filter((key: unknown): key is string => typeof key === 'string').map(fold).filter(Boolean))] }];
  });
}
export function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a); const right = new Set(b);
  return left.size === right.size && [...left].every(key => right.has(key));
}

export interface PropertyViewState { folders?: string[]; pinned?: string[]; hidden?: string; profiles: PropertyProfile[]; scope: string[] | null; activeProfile: string | null; customPinOverrides?: Record<string, boolean> }
export function loadViewState(raw: unknown): PropertyViewState {
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const profiles = loadProfiles(value.profiles);
  return {
    profiles,
    ...(value.folders !== undefined ? { folders: normalizeFolders(value.folders) } : {}),
    ...(value.pinned !== undefined ? { pinned: Array.isArray(value.pinned) ? value.pinned.filter((v): v is string => typeof v === 'string').map(fold) : [] } : {}),
    ...(typeof value.hidden === 'string' ? { hidden: value.hidden } : {}),
    ...(loadPinOverrides(value.customPinOverrides) ? { customPinOverrides: loadPinOverrides(value.customPinOverrides) } : {}),
    scope: Array.isArray(value.scope) ? [...new Set(value.scope.filter((key): key is string => typeof key === 'string').map(fold).filter(Boolean))] : null,
    activeProfile: typeof value.activeProfile === 'string' && profiles.some(profile => profile.id === value.activeProfile) ? value.activeProfile : null
  };
}

export function loadPinOverrides(raw: unknown): Record<string, boolean> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  return Object.fromEntries(Object.entries(raw).filter(([key, value]) => fold(key) && typeof value === 'boolean').map(([key, value]) => [fold(key), value as boolean]));
}
