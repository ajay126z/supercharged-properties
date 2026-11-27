import { readPropertyValues } from './frontmatter-values';

export interface ValueNode { id: string; label: string; paths: Set<string> }
export interface PropertyNode extends ValueNode { values: Map<string, ValueNode> }
export const fold = (text: string): string => text.trim().normalize('NFC').toLowerCase();
// Reuse the locale comparator: constructing collation options for every comparison
// dominates sorting thousands of property values and note paths during search.
const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
export const natural = (a: string, b: string): number => naturalCollator.compare(a, b);

/** Incremental, read-only frontmatter index. Each note contributes at most one count per row. */
export class PropertyIndex {
  properties = new Map<string, PropertyNode>();
  private memberships = new Map<string, Map<string, Set<string>>>();

  remove(path: string): void {
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

  update(path: string, frontmatter?: Record<string, unknown>): void {
    this.remove(path);
    if (!frontmatter) return;
    const membership = new Map<string, Set<string>>();
    for (const [rawKey, rawValue] of Object.entries(frontmatter)) {
      if (rawKey === 'position') continue; // Obsidian cache metadata, not a YAML property.
      const key = fold(rawKey);
      if (!key) continue;
      let property = this.properties.get(key);
      if (!property) {
        property = { id: key, label: rawKey, paths: new Set(), values: new Map() };
        this.properties.set(key, property);
      }
      property.paths.add(path);
      const values = membership.get(key) ?? new Set<string>();
      membership.set(key, values);
      for (const entry of readPropertyValues(rawValue)) {
        // Keep types distinct, and retain complete wiki links to avoid alias collisions.
        const id = JSON.stringify([entry.kind, fold(entry.text)]);
        let node = property.values.get(id);
        if (!node) {
          node = { id, label: entry.text || '(empty)', paths: new Set() };
          property.values.set(id, node);
        }
        node.paths.add(path);
        values.add(id);
      }
    }
    this.memberships.set(path, membership);
  }
  /** Distinct note paths represented by properties, including in a scoped index. */
  paths(): Set<string> { return new Set([...this.properties.values()].flatMap(property => [...property.paths])); }

  /** Derive a read-only index for a note subset. Do not update the result. */
  scoped(paths: ReadonlySet<string>, excludeKey?: string): PropertyIndex {
    const result = new PropertyIndex();
    const intersect = (source: Set<string>) => new Set([...source].filter(path => paths.has(path)));
    for (const [key, property] of this.properties) {
      if (key === excludeKey) continue;
      const propertyPaths = intersect(property.paths);
      if (!propertyPaths.size) continue;
      const values = new Map<string, ValueNode>();
      for (const [id, value] of property.values) {
        const valuePaths = intersect(value.paths);
        if (valuePaths.size) values.set(id, { ...value, paths: valuePaths });
      }
      result.properties.set(key, { ...property, paths: propertyPaths, values });
    }
    return result;
  }

}

