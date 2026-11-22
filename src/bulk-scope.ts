// SPDX-License-Identifier: MIT
import { TFile, TFolder, type TAbstractFile, type Vault } from 'obsidian';
export interface BulkScope {
    kind: 'folder' | 'selection' | 'tree';
    label: string;
    paths: string[];
    includeSubfolders?: boolean;
    skippedExcluded: number;
    skippedNonMarkdown: number;
    treeProperty?: boolean;
}
export function resolveSelectionScope(targets: readonly TAbstractFile[], recursive: boolean, includes: (path: string) => boolean): BulkScope {
    const all = new Map<string, TFile>();
    const visited = new Set<string>();
    let folders = false;
    const visit = (file: TAbstractFile, depth: number) => {
        if (file instanceof TFile) {
            all.set(file.path, file);
            return;
        }
        if (!(file instanceof TFolder) || visited.has(file.path))
            return;
        if (depth > 0 && !recursive)
            return;
        visited.add(file.path);
        folders = true;
        for (const child of file.children)
            visit(child, depth + 1);
    };
    for (const target of targets)
        visit(target, 0);
    let skippedExcluded = 0, skippedNonMarkdown = 0;
    const paths: string[] = [];
    for (const file of all.values())
        if (file.extension.toLowerCase() !== 'md')
            skippedNonMarkdown++;
        else if (!includes(file.path))
            skippedExcluded++;
        else
            paths.push(file.path);
    paths.sort();
    const folder = targets.length === 1 && targets[0] instanceof TFolder;
    return { kind: folder ? 'folder' : 'selection', label: folder ? targets[0].path : `${paths.length} selected notes`, paths, ...(folders ? { includeSubfolders: recursive } : {}), skippedExcluded, skippedNonMarkdown };
}
export function resolveTreeScope(vault: Pick<Vault, 'getAbstractFileByPath'>, paths: Iterable<string>, label: string, includes: (path: string) => boolean, treeProperty: boolean): BulkScope {
    const files = [...new Set(paths)].map(path => vault.getAbstractFileByPath(path)).filter((file): file is TFile => file instanceof TFile);
    return { ...resolveSelectionScope(files, false, includes), kind: 'tree', label, treeProperty };
}
