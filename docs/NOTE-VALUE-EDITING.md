# Change a property on selected notes

Use note-row actions to change one text property on one or more notes. For example, move selected notes from `status: todo` and `status: active` to `status: closed` without changing every note that uses those values.

This guide covers the unreleased selected-note editing feature after 1.2.1. It shares the preview, confirmation, and session-scoped undo used by other property edits.

## Change one note

1. Expand a property and one of its values to show the notes.
2. **Desktop:** right-click a note. **Mobile:** long-press the note. With keyboard focus on the note, press **Shift+F10** or the context-menu key.
3. Choose **Change status…** (the menu uses the parent property's name).
4. Choose an existing value, **Add new value…**, or **Set empty (keep property)**.
5. Review each affected path and its before/after values, plus any skipped notes.
6. Press **Apply to N notes** to confirm.

The property is fixed to the note's parent property in this view. Opening the menu under `status` changes only `status`; other properties and the note body are preserved. Suggestions come only from that property's indexed values in included folders. Adding a new value changes the selected notes and makes the new value appear in the tree.

On mobile, the dialog uses the available screen height with a scrollable value picker and preview. Cancel and Apply stay visible above the on-screen keyboard, and the dialog expands again when the keyboard closes.

A normal desktop click opens the note and clears multi-selection. A normal mobile tap opens the note outside selection mode. Scrolling cancels a pending long-press. A completed long-press opens the menu without opening the note.

## Change multiple notes

Selection stays within one property. Selection mode shows checkboxes beside notes on both desktop and mobile, with selected rows highlighted. Click a checkbox to toggle a note without opening it; Shift-click a checkbox to add a range. Desktop row clicks retain the shortcuts below.

| Desktop interaction | Behavior |
| --- | --- |
| Alt-click (Windows/Linux) or Option-click (macOS) | Toggle individual notes without opening them. |
| Shift-click | Add the displayed range from the starting note to the selection. Existing selected notes remain selected. |
| Plain click | Open the note and clear the multi-selection. |
| Ctrl/Cmd-click | Open the note in a new tab and clear the multi-selection. |
| Up/Down | Move keyboard focus between displayed notes within the property. |
| Shift+Up/Down | Move focus and add both notes to the selection. |
| Escape | Clear the multi-selection. |

Click a note to establish a starting point, then Shift-click another to add the range. Alt/Option-selecting a note also establishes a new starting point. Repeated Shift-clicks add ranges; moving back does not deselect notes. Use Alt/Option-click to remove individual notes, or a plain click, Escape, or **Cancel** to clear the selection. This follows Obsidian's selection modifiers; see the [File explorer documentation](https://obsidian.md/help/plugins/file-explorer).

Only currently displayed rows participate: collapsed branches and notes behind **Show more notes** are not included. If there is no starting point in the displayed rows of that property, Shift-click selects just the clicked note and makes it the starting point. Changing the search or property scope, or canceling selection, resets the starting point. Selection never crosses into another property.

On mobile:

1. Long-press a note and choose **Select notes…**. That note is selected initially.
2. Tap checkboxes or note rows to toggle additional notes. You can expand other value groups within the property.
3. Tap **Change status…** in the selection bar, choose a destination, review the preview, and confirm.

Desktop users can also start with **Select notes…** in the right-click menu, then use the checkboxes, Alt/Option-click, or Shift-click. Each path is edited once. Right-clicking or long-pressing a selected note uses the selection; opening the menu on an unselected note targets that note alone. Choosing **Select notes…** starts a new selection with that note.

**Cancel** exits selection mode. Changing the tree search, search mode, property scope, hidden properties, or folder exclusions clears the selection. Deleted or moved paths are removed from selection when the index refreshes. Collapsing a branch keeps its selected notes, which remain included in the selection-bar count. Finishing an edit exits selection mode; canceling its dialog keeps the selection.

## Supported values

The initial version supports **Text** properties whose stored value is a string or `null` (empty). Empty strings can also be changed. Lists, objects, numbers, booleans, and missing properties are skipped rather than converted. Actions are unavailable for configured List, Number, Checkbox, Date, Date & Time, tags, aliases, and cssclasses properties.

- **Existing value:** select a value used by this property.
- **Add new value:** enter nonblank text. Surrounding whitespace is trimmed. Numeric-looking text remains text; this action does not change the property's type.
- **Set empty:** writes `status: null`, keeping the property key. It does not delete the property.
- **Literal `empty`:** selecting or entering this word writes the text `empty`, not `null`.

A selected note already containing the destination is counted as unchanged. No-change previews cannot be applied.

## Safeguards and undo

Only explicitly selected note paths are considered. Excluded folders, unavailable notes, missing properties, unsupported values, and ambiguous spellings such as both `status` and `Status` are reported in the preview. Before writing, the plugin rechecks exclusions, the configured type, the exact original value, and property-name ambiguity. Changes since preview are skipped.

Successful writes can coexist with skipped notes or failures; the completion notice reports the counts and path-specific failures. The tree refreshes after the operation. Saved views, pins, selections of properties, and hiding preferences are preserved.

Run **Supercharged Properties: Undo last property edit** to restore successful changes. Later edits to the affected property are skipped. A batch with no successful writes preserves the previous undo batch. A successful new edit replaces it, and reload, disable, or restart clears it. Undo restores values rather than YAML formatting or comments. Notes moved or deleted after the edit cannot be restored through their old paths.

See also [bulk value editing](BULK-EDITING.md) for actions that affect all matching values, and [property-name editing](PROPERTY-RENAMING.md) for renaming or deleting keys.
