# Add or remove properties on notes

Add several frontmatter properties to a folder or group of notes, or remove whole properties in one batch. Every batch has a preview, live conflict checks, and shared session undo. This feature is available in the upcoming release.

[Back to the user guide](USER-GUIDE.md)

## Choose the notes

- **Folder:** right-click a folder in the file explorer and choose **Add properties to folder's notes…** or **Remove properties from folder's notes…**.
- **Multiple files or folders:** select them in the explorer, then choose **Add properties to selected notes…** or **Remove properties from selected notes…**.
- **YAML property or value:** right-click its row, or long-press on mobile, and choose **Add properties to these notes…** or **Remove properties from these notes…**. A property row targets notes with that property; a value row targets notes with that value.

The header shows the scope and exact eligible note count. **Include subfolders** applies to folders, including folders in a multi-selection. Excluded folders always win; their notes and non-Markdown files are omitted and counted separately. Overlapping selections count a note only once. A note without frontmatter can receive new properties. These Explorer menu entries are offered for a folder or a multi-selection, not for a single note.

Explorer selections ignore the plugin's view filters. YAML row actions use the row's already-filtered paths, including active Folder and Value filters. The active tree search also narrows these row actions to the notes represented by the displayed row count, regardless of collapsed branches or pagination. For example, searching `Calendar/Compass` before removing a property limits the batch to matching notes. Clear the search to restore the full row scope. These actions do not appear in Inline views; existing inline-field editing and conversion remain available separately.

## Add properties

Each row contains a type icon, property name, value, and remove button. Click the type icon to choose **Text**, **List**, **Number**, **Checkbox**, **Date**, or **Date and time**. Changing type resets the value; checkboxes start checked. Removing the last row leaves a new empty row.

Use **Add property** for a new row, or **Choose from existing** to select several vault properties. The picker shows how many scope notes already have each property. Properties already in the form and unavailable keys cannot be selected. You can add up to 20 properties at once.

Name suggestions search the full included YAML index, prefer prefix matches, and show in-scope counts. Choosing a suggestion fills its existing spelling and type, then focuses the value. New names are also allowed. The information line distinguishes **New property**, **Already on X of N notes**, and a type that differs from existing use. Configured vault types take priority; otherwise the plugin infers a type from sampled values.

Text and List fields suggest existing values, ranked by usage in the selected notes. In a List field, a suggestion replaces only the item at the cursor. Separate items with the configured delimiter, a comma by default. Items are trimmed, deduplicated, and written as text. Number fields accept decimals, negatives, and scientific notation, but reject non-finite numbers and unsafe integers. Dates must be valid calendar dates. Date and time values remain local ISO strings; no timezone conversion is performed.

Empty new values are not supported in this dialog. `tags` and `position` are unavailable. `aliases` and `cssclasses` must use List. Type selects the format of the value being written; the plugin never changes `types.json` or the type assigned in Obsidian.

### If a note already has the property

The selection applies to all rows:

| Choice | Result |
| --- | --- |
| **Skip** | Keep non-empty existing values. This is the default. |
| **Merge into list** | Combine Text/List rows with existing text or flat text/number lists. Text becomes a list. Other new row types use Overwrite behavior. |
| **Overwrite** | Replace the existing value with the new typed value. |

An existing null, empty string, empty list, or undefined value is treated as unset and filled even under Skip. Merge preserves existing item order and duplicates, then appends new distinct items. Matching is case-sensitive and type-sensitive. Unsupported existing values, such as nested lists or objects, cannot be merged into a text/list row. Existing date strings are not treated as mergeable text.

Case variants match the existing key spelling, so typing `STATUS` does not create a second key beside `status`. If a note already contains multiple keys that fold to the same name, that key is skipped as ambiguous. Duplicate names in the form must be corrected before previewing.

## Remove properties

The Remove dialog lists only properties actually present in the scoped notes, with counts. Filter the list, tick properties, or use **Select all**. With a filter, **Select shown** selects only matching, supported rows and preserves other selections. This removes each selected key and all its values. Missing keys are quiet no-ops.

For removing individual list items or setting an empty value, use [selected-note editing](NOTE-VALUE-EDITING.md).

## Review and apply

Choose **Preview changes**. The preview gives a summary per property and per-note additions/removals, using the current metadata cache. Changes use normal theme text on a neutral background, with green/red edge markers and plus/minus signs for additions/removals. It shows 20 changed notes initially; **Show more** loads 20 more. Notes that would not change are not counted in the confirmation button. More than 200 changed notes produces an additional reminder.

**Back** restores the form and your entered values. **Add to N notes** or **Remove from N notes** is the only write confirmation. **Nothing to change** is disabled when the preview contains no changes.

Apply processes notes sequentially, reports progress for batches over 50 notes, and yields regularly so the interface remains responsive. Before changing each key, it checks the current frontmatter against the preview, configured type, ambiguity, and exclusions. Changed keys are skipped instead of overwritten; unrelated keys can still be applied. A failed note does not stop the batch. The completion screen reports updated notes and provides expandable skipped/failed details.

## Undo

Choose **Undo** on the completion screen or run **Supercharged Properties: Undo last property edit**. Both use the same session undo snapshot shared with other YAML edits and inline-to-YAML conversion. No additional undo command is added.

A successful batch replaces the previous snapshot. A batch with no successful writes preserves it. Reloading clears the snapshot. Undo restores only keys whose values still match what the batch wrote, leaving unrelated edits alone. Conflicting, failed, or currently excluded entries remain retryable: restore the expected value or remove the exclusion, then run Undo again. The note must still exist and be eligible. Notes outside the chosen scope are never written.

Undo restores values; YAML formatting such as comments and quoting may differ from the original. Closing the dialog after Apply starts does not cancel the running batch.

## Defaults and keyboard controls

Plugin settings provide **Include subfolders by default** (on), **Default when a note already has the property** (Skip), and a one-character **List delimiter** (`,`). Invalid delimiter input reverts to the saved value.

The modal keeps its footer above the mobile keyboard. Native suggestions support keyboard navigation and Escape. **Ctrl/Cmd+Enter** triggers the current primary action. Enter in the last valid value field adds a row when a suggestion is not being selected. Validation focuses the first invalid field.
