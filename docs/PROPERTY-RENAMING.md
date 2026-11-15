# Rename property names

This feature is available in the current development build after 1.1.0. It changes a property's **name**, for example `author` → `authors`, while preserving each note's value and stored type. It does not merge properties.

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

The action covers matching notes across the vault, including those hidden by search or saved views. There is no per-note selection. The preview lists the exact source spelling, destination, value, and path for each eligible note. Names are trimmed; blank names, line breaks, null characters, and the reserved name `position` are rejected.

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

## Saved views and display preferences

After at least one successful rename, selections, saved views, pins, expanded-property preferences, and hidden-property preferences that reference the old key also include the destination key. The old reference is retained so skipped notes and undone notes remain covered. Repeated renames do not add duplicate references.

These additive preference updates are retained after undo; undo changes note properties only. You can remove unused references through the picker, saved-view manager, and settings. All-properties mode remains all-properties mode. A destination may stay hidden if the source was hidden.

## Obsidian property types and special properties

Stored value types are preserved, but the vault's configured property-type assignment is not renamed. The supported public API used by this plugin does not expose that operation. Review the destination's configured type in Obsidian after renaming it; if a destination type is already configured, it remains in effect.

Renaming special property names such as `tags`, `aliases`, or `cssclasses` changes which field Obsidian recognizes for that special behavior. The plugin does not update queries, templates, note-body references, or other plugins' settings that mention the old name.
