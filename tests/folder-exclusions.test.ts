import { expect, it } from 'vitest';
import { excludedFolders, isFolderExcluded } from '../src/folder-exclusions';
it('normalizes pasted paths and ignores empty, root-only and parent traversal entries', () => {
  expect(excludedFolders(' Templates/ \n/Resources//Templates/\n.\\Templates\\\n\n/\n../Elsewhere')).toEqual(['Templates', 'Resources/Templates']);
});
it('matches whole folder boundaries and descendants with exact case', () => {
  const folders = excludedFolders('Templates\nResources/Templates');
  for (const path of ['Templates/Note.md', 'Templates/Nested/Note.md', 'Resources/Templates/T.md']) expect(isFolderExcluded(path, folders)).toBe(true);
  for (const path of ['Templates.md', 'Templates Archive/Note.md', 'templates/Note.md', 'Other/Templates/T.md', 'Note.md']) expect(isFolderExcluded(path, folders)).toBe(false);
  expect(isFolderExcluded('Templates/T.md', excludedFolders(''))).toBe(false);
});
