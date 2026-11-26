# Rename property names

This feature is available starting in **1.2.0**. It changes a property's **name**, for example `author` → `authors`, while preserving each note's value and stored type. It does not merge properties. Property deletion is covered below and was added after 1.2.1.

[Back to the user guide](USER-GUIDE.md)

## Preview and apply

1. Open Supercharged Properties.
2. Right-click the **property row**, such as `author`, and choose **Rename property…**. You can also focus the label and press Shift+F10 or the Context Menu key.
3. Enter the new name, such as `authors`.
4. Review every eligible note and the separate **Skipped notes** list.
5. Click **Rename in N notes** to confirm, or **Cancel** to leave notes unchanged.

Before:

```yaml
author:
  - Ada Lovelace
  - Grace Hopper
```

After:

```yaml
authors:
  - Ada Lovelace
  - Grace Hopper
```

Lists, nested objects, text, numbers, booleans, and empty values are preserved. Other properties and the note body are not edited. Obsidian may reformat YAML, including comments and quoting.

The action covers matching notes in included folders, narrowed by any active [Value filter](USER-GUIDE.md#value-filter), including those hidden by tree search or saved views. Excluded folders are omitted from previews and checked again before writes. There is no per-note selection. The preview lists the exact source spelling, destination, value, and path for each eligible note. Names are trimmed; blank names, line breaks, null characters, and the reserved name `position` are rejected.

## Matching and conflicts

Property matching follows the tree's case-insensitive, Unicode-normalized grouping. A rename from `author` to `authors` can therefore rename both `author` and `Author` in different notes. Case-only corrections such as `Author` → `author` are allowed. Keys already spelled exactly like the destination are unchanged.

The plugin skips a note when:

- Another key already matches the destination, including capitalization variants—even if its value is empty or equal to the source value.
- Multiple keys match the source, such as both `Author` and `author` in one note.
- The source or its cached metadata is unavailable.

Immediately before each write, the plugin checks the exact source key, its previewed value, and destination availability again. New conflicts or changes since preview are skipped. A batch may partially succeed; its notice reports renamed, skipped, and failed counts, with separate path-specific failure notices. Successful notes remain undoable.

## Undo

Run **Supercharged Properties: Undo last property edit** from the command palette. This command shares one undo slot with bulk value edits. Its existing command ID is retained, so previously assigned hotkeys continue to use the same command.

Undo restores each note's original key spelling and value only if the destination still contains the batch's value and the original name is free. New ambiguous keys or later changes are skipped. Other properties remain untouched. Failed or skipped entries remain available for retry; retrying never forces an overwrite.

Another successful property-name or value batch replaces the previous undo. Undo is cleared by plugin reload, disable, or restart. It restores values and keys, not YAML formatting. Renamed or deleted note paths cannot be recovered through their old paths. There is no redo.

## Delete a property

Right-click the **property row** and choose **Delete property…**. Review every eligible note and the separate **Skipped notes** list, then click **Delete from N notes** to confirm.

Deletion removes the property key and its complete value from each eligible note, including lists, nested lists, objects, text, numbers, booleans, and empty values. Other properties and the note body are not edited. Deletion covers matching notes in included folders, narrowed by Folder and [Value filters](USER-GUIDE.md#value-filter) and the active tree search. Its preview count matches the property row count, including matching notes under collapsed branches or beyond pagination. Clear the search to delete across the full filtered property scope. Saved views do not further restrict notes. Excluded folders are omitted from previews and checked again before writes.

The plugin skips a note when:

- Multiple keys match the property name, such as both `Author` and `author` in one note.
- The note or its cached metadata is unavailable.
- The key or its value changed after preview, or a new folded-key collision appeared.

Immediately before each write, the exact key and its previewed value are checked again. A batch may partially succeed; its notice reports deleted, skipped, and failed counts, with path-specific failure notices.

Deleting a property preserves the active selection, saved views, pins, expanded-property preferences, and hidden-property preferences. A saved view containing only that property remains available, even while no notes match. Undo restores the property into its previous views and selection. You can remove unused references manually.

Deletion shares the **Undo last property edit** slot with renames and value edits. Undo restores the original key spelling and value only while no key with the same folded name exists. A later recreated key is skipped and the entry remains available for retry. Another successful batch replaces the previous undo; reload, disable, or restart clears it. Undo restores keys and values, not YAML formatting, and cannot recover notes deleted or renamed at the file level.

## Saved views and display preferences

After at least one successful rename, selections, saved views, pins, expanded-property preferences, and hidden-property preferences that reference the old key also include the destination key. The old reference is retained so skipped notes and undone notes remain covered. Repeated renames do not add duplicate references.

These additive preference updates are retained after undo; undo changes note properties only. You can remove unused references through the picker, saved-view manager, and settings. All-properties mode remains all-properties mode. A destination may stay hidden if the source was hidden.

## Obsidian property types and special properties

Stored value types are preserved, but the vault's configured property-type assignment is not renamed. The supported public API used by this plugin does not expose that operation. Review the destination's configured type in Obsidian after renaming it; if a destination type is already configured, it remains in effect.

Renaming special property names such as `tags`, `aliases`, or `cssclasses` changes which field Obsidian recognizes for that special behavior. The plugin does not update queries, templates, note-body references, or other plugins' settings that mention the old name.

## Excluded folders

Version 1.2.0 respects **Settings → Supercharged Properties → Excluded folders** for previews and new writes. Search and saved views do not limit a batch, but folder exclusions do. Notes newly excluded after a preview are skipped at apply time. Undo remains available for earlier edits even if their folders are subsequently excluded.
