// SPDX-License-Identifier: MIT
import { natural } from './index';
export type MoveAction = 'up' | 'down' | 'top' | 'bottom';
export function normalizeOrder(raw: unknown, fold: (value: string) => string): string[] | undefined {
  return Array.isArray(raw) ? [...new Set(raw.filter((value): value is string => typeof value === 'string').map(fold).filter(Boolean))] : undefined;
}
export function sortByOrder<T extends {id: string; label: string}>(nodes: Iterable<T>, order: readonly string[]): T[] {
  const positions = new Map(order.map((key, index) => [key, index]));
  return [...nodes].sort((a,b) => {
    const left = positions.get(a.id), right = positions.get(b.id);
    if (left !== undefined || right !== undefined) return (left ?? Infinity) - (right ?? Infinity);
    return natural(a.label,b.label);
  });
}
export function materializeOrder(stored: readonly string[], keysInDisplayOrder: readonly string[]): string[] {
  return [...new Set([...stored, ...keysInDisplayOrder])];
}
function insert(order: readonly string[], key: string, target: string, after: boolean): string[] {
  const result = order.filter(item => item !== key);
  result.splice(result.indexOf(target) + Number(after), 0, key);
  return result;
}
export function moveWithinGroup(order: readonly string[], key: string, group: readonly string[], action: MoveAction): string[] {
  const result = materializeOrder(order, group), index = group.indexOf(key);
  if (index < 0) return result;
  const target = action === 'up' ? index - 1 : action === 'down' ? index + 1 : action === 'top' ? 0 : group.length - 1;
  if (target < 0 || target >= group.length || target === index) return result;
  return insert(result, key, group[target], action === 'down' || action === 'bottom');
}
export function placeInGroup(order: readonly string[], key: string, group: readonly string[], before: string | null): string[] {
  const result = materializeOrder(order, group), index = group.indexOf(key);
  if (index < 0 || before === key || (before !== null && !group.includes(before))) return result;
  // A drop in the current visible slot must not shift hidden keys.
  if (before === (group[index + 1] ?? null)) return result;
  if (before !== null) return insert(result, key, before, false);
  return group.length > 1 ? insert(result, key, group[group.length - 1], true) : result;
}
