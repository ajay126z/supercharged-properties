// SPDX-License-Identifier: MIT
import { fold, natural, type PropertyIndex } from './index';
import { isEmpty, isReserved, type DialogType } from './bulk-properties';
import { matchingKeys } from './property-rename';
export interface PropertyChoice {
    key: string;
    type: DialogType;
    inScope: number;
    mixed: boolean;
    disabledReason?: string;
}
export const typeLabels: Record<DialogType, string> = { text: 'Text', list: 'List', number: 'Number', checkbox: 'Checkbox', date: 'Date', datetime: 'Date and time' };
export const typeIcons: Record<DialogType, string> = { text: 'text', list: 'list', number: 'hash', checkbox: 'check-square', date: 'calendar', datetime: 'calendar-clock' };
export function inferType(values: unknown[]): {
    type: DialogType;
    mixed: boolean;
} {
    const counts = new Map<DialogType, number>();
    for (const value of values.filter(v => !isEmpty(v))) {
        const type: DialogType = Array.isArray(value) ? 'list' : typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'checkbox' : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? 'date' : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? 'datetime' : 'text';
        counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    const sorted = [...counts].sort((a, b) => b[1] - a[1]);
    return { type: sorted.length && sorted[0][1] !== sorted[1]?.[1] ? sorted[0][0] : 'text', mixed: counts.size > 1 };
}
export function propertyCatalog(index: PropertyIndex, paths: readonly string[], configured: (key: string) => DialogType | undefined, getFrontmatter: (path: string) => Record<string, unknown> | undefined): PropertyChoice[] {
    const scope = new Set(paths), scoped = index.scoped(scope);
    return [...index.properties.values()].map(property => {
        const samples = [...property.paths].sort((a, b) => Number(scope.has(b)) - Number(scope.has(a)) || natural(a, b)).slice(0, 200).map(path => { const fm = getFrontmatter(path) ?? {}; const keys = matchingKeys(fm, property.label); return keys.length === 1 ? fm[keys[0]] : undefined; });
        const inferred = inferType(samples);
        return { key: property.label, type: configured(property.label) ?? inferred.type, mixed: inferred.mixed, inScope: scoped.properties.get(property.id)?.paths.size ?? 0, ...(isReserved(property.label) ? { disabledReason: 'Unavailable' } : {}) };
    }).sort((a, b) => natural(a.key, b.key));
}
export function matchChoices(choices: PropertyChoice[], query: string, used: Set<string>): PropertyChoice[] {
    const q = fold(query);
    return choices.filter(c => fold(c.key).includes(q) && !used.has(fold(c.key))).sort((a, b) => Number(fold(b.key).startsWith(q)) - Number(fold(a.key).startsWith(q)) || b.inScope - a.inScope || natural(a.key, b.key)).slice(0, 50);
}
export function valueSuggestions(index: PropertyIndex, key: string, paths: readonly string[]): string[] {
    const scope = new Set(paths);
    return [...index.properties.get(fold(key))?.values.values() ?? []].filter(v => (JSON.parse(v.id) as string[])[0] === 'string' || (JSON.parse(v.id) as string[])[0] === 'number').map(v => ({ label: v.label, count: [...v.paths].filter(path => scope.has(path)).length })).sort((a, b) => b.count - a.count || natural(a.label, b.label)).slice(0, 20).map(v => v.label);
}
