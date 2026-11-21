import { natural, ValueNode } from './index';
export const sortOptions = {
  name: 'Property name (A to Z)',
  'name-desc': 'Property name (Z to A)',
  count: 'Frequency (high to low)',
  'count-asc': 'Frequency (low to high)'
};
export type SortOrder = keyof typeof sortOptions;
export function sortOrder(value: unknown): SortOrder {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(sortOptions, value) ? value as SortOrder : 'name';
}
export function sortNodes<T extends ValueNode>(nodes: Iterable<T>, order: SortOrder, name: (node: T) => string = node => node.label): T[] {
  const keys = new Map<T, string>();
  const list = Array.from(nodes);
  for (const node of list) keys.set(node, order === 'name' || order === 'name-desc' ? name(node) : node.label);
  return list.sort((a, b) => {
    const alphabetical = natural(keys.get(a)!, keys.get(b)!) || a.id.localeCompare(b.id);
    if (order === 'name-desc') return -alphabetical;
    if (order === 'count') return b.paths.size - a.paths.size || alphabetical;
    if (order === 'count-asc') return a.paths.size - b.paths.size || alphabetical;
    return alphabetical;
  });
}

/** Only a complete wikilink is a linked value; labels remain untouched. */
export function linkedValueSortKey(node: ValueNode, resolve: (target: string, source: string) => {basename: string} | null | undefined): string {
  const match = /^\[\[([^\]\n[]+)\]\]$/.exec(node.label.trim());
  if (!match) return node.label;
  const target = match[1].split('|', 1)[0].split(/[#^]/, 1)[0].trim();
  const source = [...node.paths].sort()[0] ?? '';
  const file = resolve(target, source);
  if (file) return file.basename;
  return target.slice(target.lastIndexOf('/') + 1).replace(/\.md$/i, '');
}
