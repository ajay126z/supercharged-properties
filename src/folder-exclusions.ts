// SPDX-License-Identifier: MIT
/** Vault-relative, case-sensitive folders, including descendants; not glob patterns. */
export function excludedFolders(text: string): string[] {
  return [...new Set(text.split('\n').map(line => line.trim().replace(/\\/g, '/').split('/').filter(part => part && part !== '.').join('/')).filter(path => path && !path.split('/').includes('..')))];
}

export function isFolderExcluded(path: string, folders: readonly string[]): boolean {
  return folders.some(folder => path.startsWith(`${folder}/`));
}
