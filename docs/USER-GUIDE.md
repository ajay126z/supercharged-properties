# Supercharged Properties user guide

Supercharged Properties displays your vault's YAML frontmatter as a tree of **properties → values → notes**. Use it to inspect metadata, find notes, organize the view, and explicitly edit matching values across notes.

Browsing, searching, sorting, and saving views do not modify notes. Property-name and value edits write frontmatter only after you review a preview and confirm.

This guide describes **1.4.2**, with Value filter and its expandable note list, including property/value deletion and selected-note editing. It covers property-name renaming, excluded folders, and text-property-only Split eligibility. The shared undo command is **Undo last property edit**; in 1.1.0 it was called **Undo last value edit**.

## Contents

- [Install and open](#install-and-open)
- [Browse properties, values, and notes](#browse-properties-values-and-notes)
- [Understand values and counts](#understand-values-and-counts)
- [Search the tree](#search-the-tree)
- [Inline properties](#inline-properties)
- [Value filter](#value-filter)
- [Choose properties](#choose-properties)
- [Exclude template or other folders](#exclude-template-or-other-folders)
- [How display controls affect scope](#how-display-controls-affect-scope)
- [Save and manage views](#save-and-manage-views)
- [Sort, pin, and hide](#sort-pin-and-hide)
- [Use Obsidian Search and copy links](#use-obsidian-search-and-copy-links)
- [Rename property names](#rename-property-names)
- [Delete properties or values](#delete-properties-or-values)
- [Change a property on selected notes](#change-a-property-on-selected-notes)
- [Edit values across notes](#edit-values-across-notes)
- [Data access and privacy](#data-access-and-privacy)
- [Settings and commands](#settings-and-commands)
- [Keyboard and mobile use](#keyboard-and-mobile-use)
- [Troubleshooting](#troubleshooting)

## Install and open

The plugin requires Obsidian **1.7.2 or later** and supports desktop and mobile. The core Search plugin is needed only for **Open in Search**.

If available in the community plugin browser, find **Supercharged Properties**, install it, and enable it. For manual installation:

1. Create `<YourVault>/.obsidian/plugins/supercharged-properties/`.
2. Copy `main.js`, `manifest.json`, and `styles.css` from the same build into that folder.
3. Reload Obsidian and enable the plugin under **Settings → Community plugins**.

Click the plugin's list-tree ribbon icon to open the sidebar. Alternatively, open the command palette and run **Supercharged Properties: Open sidebar** or **Supercharged Properties: Open in tab**.

### Try a small example

Create a note with this frontmatter at its beginning:

```yaml
---
status: doing
author: Ada Lovelace
topics:
  - research
  - writing
rating: 4
published: false
---
```

Open Supercharged Properties, expand `status`, then expand `doing` to find the note. Expand `topics` to see the note under both `research` and `writing`.

## Browse properties, values, and notes

| Control | What it does |
| --- | --- |
| Property label or chevron | Expands or collapses that property's values. |
| Value label or chevron | Shows or hides notes containing that value. |
| Note row | Opens the note; Ctrl/Cmd-click opens a new tab. In mobile selection mode, tapping toggles selection. Right-click (desktop) or long-press (mobile) opens supported property-editing actions. |
| Note-selection checkbox | Toggles selection without opening the note. Available during selection mode on desktop and mobile. |
| Expand all properties | Expands currently visible properties. It does not open every value's note list. |
| Collapse all properties | Collapses displayed properties while preserving the search, active view, and Value filter. |
| Show more | Reveals another page of a large value or note list. |
| Refresh property index | Rebuilds the tree and reloads property type icons. |

The tree updates automatically as notes and metadata change, including note and folder renames. Use Refresh if the view appears out of date. The bottom summary reports visible properties and whether a custom property selection is active.

Property rows show type icons based on the vault's configured property types, such as text, list, tags, number, checkbox, date, or date & time. Unrecognized or unavailable types fall back to text. Icons describe the configured property type; individual value rows retain the actual stored value's type.

## Understand values and counts

During search, property and value counts reflect distinct matching notes, including matches by value or note name/path. Collapsing branches does not change those counts; clearing search restores the full counts.

Counts are **distinct notes**, not the number of assignments. A note with `topics: [writing, writing]` contributes one count to `writing`. A note with two different topics appears under both topics, so adding value counts can exceed the property's note count.

Property names and text values are grouped without regard to capitalization or surrounding whitespace, with Unicode normalization. For example, `Status` and `status` share a property row; `Doing` and `doing` share a text-value row. This grouping does not rename anything in your files.

| Stored value | How it appears |
| --- | --- |
| `status: doing` | A text value. |
| `rating: 4` and `rating: "4"` | Distinct number and text rows, even when their labels look alike. |
| `published: false` and `published: "false"` | Distinct boolean and text rows. |
| A list or nested list | Individual supported values are indexed beneath the property. |
| `status: null`, `status: ""`, or `status: []` | The `(empty)` row. Whitespace-only scalar text is also empty. |
| A missing property | The note is absent from that property's branch. |
| A nested map/object | No value row for the object; the note remains reachable under the property. |

Within nonempty lists, null entries contribute to `(empty)`; blank text and empty nested lists are ignored. Wikilinks keep their full text, including targets and aliases, so different targets with the same alias remain distinct.

## Search the tree

1. Click **Toggle search**.
2. Enter part of a property name, value, note name, or path.
3. Use the sliders button beside the input to choose a search scope.

| Scope | Searches |
| --- | --- |
| Search everything | Property names, values, and note paths. |
| Property names | Property names only. |
| Values | Value labels only. |
| Note names / paths | Note filenames and their folder paths. |

Search uses case-insensitive substring matching. It is a local tree filter, not an Obsidian query parser: enter `Projects/` to find matching paths, rather than `path:Projects`.

Matching branches expand automatically. You can then expand or collapse individual properties and value branches with their arrows, including after Collapse all. After Collapse all, expanding a property shows only its values; expand a value separately to see its notes. A new search automatically reveals matching note branches again. These choices stay in place during live refresh and reset when the search or view changes. A matching property can show all its values; a matching value can show all its notes. A note-path match reveals the relevant note branch. Clear the input to return to ordinary browsing. **Escape** or hiding the search input clears the tree search, but keeps an active Value filter. Changing the property view also clears the tree search.

Search operates within your current property selection and excludes hidden properties. It does not limit the scope of bulk edits or the row's copy-links action.

## Inline properties

This feature is unreleased, following 1.4.2. Turn on **Settings → Supercharged Properties → Show inline properties**, then select **Inline Properties** in the view dropdown. It is a built-in, read-only view separate from **All properties** and your saved YAML views.

Supported forms:

```markdown
author:: AJ
We discussed [topic:: design] today.
(rating:: 4)
related:: [[Project A]]
- [owner:: Alex]
> status:: active
```

Full-line fields use the rest of the line as their value. Bracketed and parenthesized fields can appear within prose, including several fields on one line. Repeated fields contribute their values to the same property; repeated values in one note count once. Empty values appear as `(empty)`. Names and values use the same case-insensitive grouping as the property tree.

Values are **literal text**. Numbers, dates, booleans, commas, and expressions are not evaluated or converted into Dataview types. For example, `topics:: design, art` is one text value; use repeated `topics::` fields for separate values. Complete wikilinks are retained as text. This is support for these field forms, not a full Dataview parser or query engine, and does not require Dataview to be installed.

Fields in nested bullet/numbered lists and their indented continuation lines are supported, including `[[Wikilinks]]` and URL values. List indentation is distinguished from indented code.

The parser ignores YAML frontmatter, fenced and indented code, inline code, HTML comments, and Obsidian `%%` comments. It does not collect implicit Dataview fields, task emoji shorthand, or multiline values. The reserved metadata key `position` is excluded.

Expand **property → value → notes**, search the tree, sort rows, open notes, or copy matching note links. **Filter by Value** and the expandable matching-note list also work within the inline index. Inline rows offer no rename, merge, split, delete, selected-note editing, or **Open in Search / Copy search query** actions. Those Search queries target YAML properties, so they would not describe inline fields correctly.

### Save an inline view

1. Choose **Inline Properties** from the view dropdown.
2. Open **Choose properties to show** and select the inline fields you want.
3. Enter a view name and choose **Save new**.

Saved inline views appear as **Inline: Name** in the dropdown. Use **Update**, **Rename**, and **Delete** just as you would for a YAML view. Changing the selection marks a saved view **(modified)** until you update it or select the saved view again. Deleting a view keeps its current selection as a custom selection and does not change any notes.

**Inline Properties** is the built-in all-fields view and cannot be renamed or deleted. **All → Save new** reports that this view already exists; **None → Save new** asks you to select at least one property. All/None preserve the name you have typed. Empty names, duplicate names within inline views, and the built-in view names are rejected. A YAML view and an inline view can share a name because their dropdown labels distinguish them.

Inline selections and saved views are stored separately from YAML selections and views. Saved keys remain available even if no note currently uses them. Search and **Filter by Value** work within an inline saved view without replacing its saved keys. Inline views remain read-only.

YAML pins, hidden-property settings, and configured type icons do not apply to the inline tree; inline properties use a text icon. Sorting and the Show note counts setting apply to both sources. Inline expansion and filtering are local to the view; switching between sources clears search, value filtering, and note selection without changing the saved YAML views.

The setting is off by default. While enabled, the plugin reads included Markdown note bodies in a bounded background queue. The summary reports indexing progress and any unreadable notes. Metadata/body changes update results; renames, moves, deletions, and folder exclusions are respected. Use **Refresh property index** to retry failed reads or force a rescan. Disabling the setting clears the inline index, hides its dropdown entries, and switches an active inline view back to **All properties**. Saved inline views and selections are retained and become available when you enable the setting again. After plugin reload, choose your saved inline view from the dropdown; new panes initially open the YAML source.

## Value filter

![Filter notes by a value and explore the matching note list](media/07-value-filter-notes.gif)

Use a Value filter to answer cross-property questions, such as “Which topics appear in completed notes?” Available in **1.4.0**.

1. Expand a property such as `status`.
2. Right-click a value such as `done`, long-press it on mobile, or focus its label and press **Shift+F10** or the menu key.
3. Choose **Filter by Value**. The `(empty)` row is supported too: it includes existing null values, blank strings, and empty lists, not notes missing that property.
4. Explore the remaining properties. Counts and copied note links now describe only matching notes. The filter property is omitted from the tree and property picker; its name and value remain in the filter bar.
5. Click or tap the note count to reveal a scrollable list of matching notes. Select a name to open it.
6. Choose **Clear** in the filter bar to return to unfiltered notes. Your search and property selection remain in place.

For example, with three recipes and two tasks, filter `type = recipe` to compare only recipe statuses and cuisines. Renaming a `wip` status while this filter is active changes matching recipes, leaving tasks untouched. Property-name renames and property deletions also respect the filtered group. Merge targets come from values present in that group. As always, inspect the before/after preview before confirming. The dialog previews the paths from the row you opened; subsequent edits still use the existing value/conflict safeguards and undo.

Only one condition is active. Choosing another value replaces the condition and resolves its matches across all included notes; it does not intersect with the previous filter. Separate tabs have independent filters. Saved views retain their complete property selections and do not save the condition. Closing and recreating the view or reloading the plugin clears it.

Counts are distinct note paths, not property assignments or list items. For one note with `author: AJ`, `rating: 4`, and `topic: design`, filtering `author = AJ` shows **1 note** in the bar and **2 properties · Filtered (1 note)** in the summary. The two properties are rating and topic.

The expandable note list sorts by note name, with numeric ordering (Note 2 before Note 10) and full path as a tie-breaker. Folder labels and full-path tooltips (when Show tooltips is enabled) distinguish duplicate names. It initially shows up to 200 notes; **Show more** loads the next batch. The count includes all matching notes, even before all rows are loaded.

When a Value filter is active, the matching-note dropdown and its count also follow the tree search (property names, values, or note names/paths). This works whether you search before or after applying the Value filter. Clearing the search restores the full Value filter note list; collapsing branches does not change the list. Search narrows the displayed list only: edit previews continue to use the Value filter's full note subset.

Click or tap a name to open that note in the current editor. Ctrl/Cmd-click opens a new tab; Obsidian's additional opening modifiers are respected. Opening a note leaves the filter and disclosure state intact. This list is for opening notes only; use note rows in the property tree for selection and editing. On desktop, Page preview works according to Obsidian's settings (by default, hold Ctrl/Cmd while hovering). It requires the Page preview core plugin.

With focus on the count, Enter/Space toggles the list and ArrowDown opens it and focuses its first note. Inside the list, Up/Down and Home/End move between loaded notes, Enter opens a note, and Escape collapses the list and returns focus to the count. Tab also reaches the note buttons and **Show more**.

The list keeps its scroll position and focused path when results update. If the focused note disappears, focus moves to a nearby row; when no notes remain, the list collapses and focus moves to Clear. Applying another filter or clearing the current filter resets the list. If the underlying Value filter becomes empty and later matches notes again, it stays collapsed. A search that temporarily yields no results keeps the disclosure state, so an open list returns when matching search results return. Each tab has independent disclosure state, which is not saved.

On mobile, note rows have larger touch targets. The list scrolls within a limited part of the pane, leaving space for the property tree even when the keyboard reduces the available height.

Results follow the live index: notes enter or leave the group as metadata changes. If the filtered value disappears, the filter remains visible with **0 notes** and **No notes match this filter.** Choose Clear or restore the value. When notes match but their other properties are hidden or excluded by search/selection, the tree instead says **No matching properties. Adjust your search or selection.**

Filtering and clearing return keyboard focus to the property-picker button and clear note selection. Live updates remove selected notes that no longer match. The filter label wraps to show the full property and value. On narrow screens, the note-count and Clear buttons move below the label when needed, so they do not cover the text.

**Open in Search** and **Copy search query** remain vault-wide. They do not include the Value filter. **Copy matching note links** does respect it. Tree search, sorting, hidden/pinned properties, counts settings, and saved views continue to work within the filtered tree.

## Choose properties

Click **Choose properties to show** to open the property picker.

1. Check the properties you want to include.
2. Uncheck those you do not want in this view.
3. Use **Find a property…** to narrow the picker list.

**All** includes all properties; **None** clears the selection. These buttons apply to every property, even when the picker list is filtered. The picker search only filters the checkbox list; it does not search notes or change the tree search.

A selection controls which properties are displayed, not which notes belong to a value. Hidden properties remain hidden even when selected. Choosing None produces an empty tree with a prompt to select properties.

## Exclude template or other folders

In the 1.2.0, open **Settings → Supercharged Properties → Excluded folders** and enter one vault-relative folder path per line:

```text
Templates
Resources/Templates
Archive/Drafts
```

Each entry excludes that folder and all descendants. `Templates` excludes `Templates/Daily/Example.md`, but not `Templates Archive/Example.md` or a root note named `Templates.md`. Paths are case-sensitive and are literal paths, not wildcard patterns. Leading/trailing slashes and pasted backslash separators are normalized; blank lines are ignored. Use paths relative to the vault, not absolute filesystem paths. Entries containing `..` are ignored.

Changes apply immediately and are saved for the next session. Clear an entry to restore its notes. Excluded notes do not contribute properties, values, counts, local tree-search results, copied note links, or bulk-edit previews. A bulk edit opened before the setting changed also skips newly excluded notes. Existing undo remains available for earlier edits, even if their folders are now excluded.

This setting does not change your notes or Obsidian's global Search settings. **Open in Search** and copied search queries use Obsidian Search and can still return excluded notes. Saved profiles retain their property keys; properties used only by excluded notes disappear until an included note uses them again.

## How display controls affect scope

| Control | Tree and counts | Copied note links | New bulk edits |
| --- | --- | --- | --- |
| Value filter | Recalculates properties, values, and counts for matching notes; hides the filter property. | Copies only matching subset links. | Narrows value edits, property renames, and property deletion to the subset. |
| Tree search | Filters displayed branches; row counts still represent their full indexed note set. | Copies the row's full indexed note set, not just visible search matches. | Does not restrict the selected row's batch to search matches. |
| Property selection / saved view | Shows selected properties; does not filter notes within a property. | Uses the selected row's full indexed note set. | Does not narrow the selected row's notes. |
| Hidden properties | Hides named properties without removing their indexed notes. | Available from visible rows. | Does not act as a note exclusion rule. |
| Excluded folders | Removes notes from the index, values, and counts. | Excluded notes are omitted. | Excluded notes are omitted from previews and skipped before writes. |

The table describes property/value-row bulk actions. “Full indexed note set” means the row's subset when a Value filter is active. **Change status…** from a note row edits only the explicitly selected notes. Selection checkboxes do not narrow a value-row Rename, Merge, or Delete batch. Changing the search, property scope, or Value filter clears note selection.

**Open in Search** and **Copy search query** generate queries for Obsidian's core Search. They do not add folder-exclusion or Value filter conditions. Earlier edits can still be undone after their folders are excluded.

## Save and manage views

Saved views, also called profiles, store a **property selection**. They do not save search text, sorting, pinning, or hidden-property settings as separate per-view preferences.

### Create a view

1. Open **Choose properties to show**.
2. Select properties, for example `status`, `author`, and `topics`.
3. Enter a name such as `Writing` in **View name**.
4. Click **Save new**.

Choose a saved view from the **Property view** dropdown to restore its selection. Use **All properties** to return to every non-hidden property, including properties added later. A saved view records the selected keys at save time. In 1.2.1, new views must contain at least one property and cannot duplicate the all-properties selection.

### All, None, and the default view

In 1.2.1, **All** and **None** preserve any view name you have typed on both desktop and mobile. You can adjust the selection and then save without retyping the name.

- **All → Save new:** shows **All properties View already exists.** No duplicate view is created, and your typed name stays in the field.
- **None → Save new:** shows **Please select at least one property.** Select one or more properties and retry with the same name.
- Selecting every indexed property manually produces the same All-properties message.
- **Update** also rejects empty or all-property selections and preserves the existing saved view.
- **All properties** is the built-in default and cannot be renamed or deleted. Choosing All clears the active saved-view selection, disables its Update/Rename/Delete controls, and keeps your saved views intact.
- The name **All properties** is reserved for the default view. Done/Enter uses the same validation as Save new.

### Save a view on mobile

In 1.2.1, the saved-view name field and buttons appear above the property choices on touch and narrow screens. Opening **Choose properties to show** leaves the keyboard closed until you tap a text field. The panel scrolls within the space above the keyboard, so **Save new**, **Update**, **Rename**, and **Delete** remain reachable even on a short screen.

Type a name and tap **Save new**, or press the keyboard's **Done/Enter** action to save a new view. Enter always creates a new view; use **Rename** to rename the active one. Successful actions dismiss the name-field keyboard when it still has focus. Blank or duplicate names keep the input available for correction. Composing characters with an input method does not prematurely submit the name.

These changes have automated and simulated mobile-browser coverage; verify keyboard behavior on your device's Obsidian app.

### Change or remove a view

| Action | Steps and result |
| --- | --- |
| Update | Select a saved view, change the checkboxes, then click **Update** to replace its saved selection. |
| Rename | Select a saved view, type its new name, then click **Rename**. |
| Delete | Select a saved view and click **Delete**. The saved view is removed immediately; the current property selection remains as a custom selection. Notes are untouched. |

The view picker opens below the view bar and scrolls within the available screen space. Long view names wrap in the list. Use Up/Down, Home/End, or type a view name to navigate; Enter/Space selects, Escape cancels, and clicking outside closes the list. The selected view is highlighted.

Names cannot be blank or duplicate another view name, ignoring case. The input allows up to 80 characters. Update, Rename, and Delete require an active saved view.

A view is marked **(modified)** when its current selection differs from the saved selection. Click Update to keep the changes, or choose the saved view again to restore its saved keys. The dropdown count includes only currently present, non-hidden properties. A saved key that is temporarily absent from the vault is retained and becomes useful again when that property reappears.

## Sort, pin, and hide

Click **Sort properties** to choose:

- **Property name (A to Z)**
- **Property name (Z to A)**
- **Frequency (high to low)**
- **Frequency (low to high)**

The selected ordering applies to property and value rows. Frequency means distinct-note count; ties use alphabetical order. The same preference is available in Settings.

Right-click a **property row** and choose **Pin property** to keep it above unpinned properties. Choose **Unpin property** to restore normal ordering. Pinning does not override the property selection, search, or hiding.

Choose **Hide property** to remove a property from the tree. To restore it, open **Settings → Supercharged Properties → Hidden properties** and remove its name. Hiding changes the display only; it does not delete metadata. Hidden-property names are matched without regard to capitalization or surrounding whitespace.

## Use Obsidian Search and copy links

Right-click a property or value row to open its menu.

| Action | Result |
| --- | --- |
| Open in Search | Opens the core Search view with a query for the property or value. |
| Copy search query | Copies that query for pasting into Search or elsewhere. |
| Copy matching note links | Copies newline-separated wikilinks for all notes belonging to the row, including folder paths. |

A property row generates a query such as `["status"]`; a value row generates `["status":"doing"]`. Copied links refer to the row's complete note set, even when the tree search displays only part of it.

Obsidian Search applies its own matching and type rules, so results may differ from the local tree. In particular, an empty-row query uses `null`, while the tree's `(empty)` group also includes empty text and empty lists. Enable the **Search** core plugin if Open in Search asks you to do so. Copy actions do not require Search to be enabled.

## Rename property names

In 1.2.0, right-click a property row and choose **Rename property…**. Review all affected and skipped notes before confirming. Values keep their stored types; destination conflicts are skipped. Read the [property-name renaming guide](PROPERTY-RENAMING.md) for case-only renames, preference updates, configured-type limitations, and shared undo. The same property-row menu also offers **Delete property…**.

## Change a property on selected notes

Right-click a note on desktop or long-press it on mobile, then choose **Change status…** (using the parent property's name). Choose or enter a typed scalar value, set the property empty, add/remove List items, or choose **Remove property** to delete the entire key and all its values from selected notes. **Select notes…** starts a selection within the property. Selection mode shows checkboxes and highlighted rows on both desktop and mobile. Click a checkbox to toggle a note without opening it. Desktop shortcuts remain: Alt/Option-click toggles individual notes, Shift-click adds a range, and Escape clears the selection. Plain clicks open notes and clear desktop multi-selection; Ctrl/Cmd-click opens a new tab. Mobile selection uses checkboxes and tap-to-toggle rows. Normal taps open notes outside selection mode; scrolling cancels a pending long-press.

This action supports Text, Number, Checkbox, Date, and Date & time properties, plus add/remove operations for flat List properties. Aliases and cssclasses support text-list items; tags remain unsupported. **Set empty (keep property)** retains a scalar key with `null`. List **Remove values** retains the key with `[]` when the last item is removed; **Remove property** deletes the entire key for lists of any size, including empty lists. It previews only the selected notes and shares **Undo last property edit** with other edits. See [changing selected notes](NOTE-VALUE-EDITING.md) for the complete workflow, eligibility, and safeguards.

## Edit values across notes

Value-row menus offer **Rename value…**, **Delete value…**, **Merge value…**, **Convert to wikilink…**, and **Split into list…** when applicable. These actions change values, not property names. **Delete value…** removes a matching scalar property or matching list entries; removing the entire value also removes the key from that note. Empty and object rows do not offer deletion. **Split into list…** requires a Text property and a text value. It is hidden for List, Number, Checkbox, Date, Date & Time, tags, aliases, and cssclasses. Strings already stored inside lists are not split.

Read the [bulk editing guide](BULK-EDITING.md) for examples, exact matching rules, preview and confirmation, partial failures, and undo. Each operation covers matching notes in included folders across the vault regardless of your tree search or saved view. Excluded folders are skipped. The full preview shows which notes will change.

## Delete properties or values

| Action | Where | Result |
| --- | --- | --- |
| Delete property… | Property-row menu | Removes the property key and its complete value from every eligible note. |
| Delete value… | Value-row menu | Removes matching scalars or list entries; removing the entire value also removes the property key from that note. |

Both actions require an explicit confirmation after reviewing the affected and skipped notes. They share preview, conflict skipping, and one-step undo with other edits. Property deletion preserves selections, saved views, pins, expanded properties, and hidden-property references so undo restores the property into its previous views. Read [property deletion](PROPERTY-RENAMING.md#delete-a-property) and [value deletion](BULK-EDITING.md#delete-a-value) for eligibility and undo details.

## Data access and privacy

The plugin enumerates Markdown notes in your current vault to build the property index and reads cached frontmatter. This is necessary for vault-wide browsing and matching-note counts. It does not enumerate non-Markdown attachments. It also reads the vault's configured property types for icons. When Show inline properties is enabled, it additionally reads included Markdown note bodies for the separate inline index; disabling that setting stops new inline reads and clears that index.

**Copy search query** and **Copy matching note links** write only the generated query or links when you select the action. They replace the current clipboard contents, but never read them. No clipboard monitoring runs in the background. The plugin does not send vault data to external services. Explicit bulk edits write frontmatter after confirmation.

Security scanners may flag vault enumeration and clipboard access as capabilities. These capabilities support the features described above; removing them would remove vault-wide indexing or the Copy actions.

## Settings and commands

Open **Settings → Supercharged Properties**.

| Setting | Purpose |
| --- | --- |
| Show tooltips | Show hover hints on browser controls and rows. On by default; changes apply to open views. Screen-reader labels and note previews remain available when off. |
| Show inline properties | Add a separate read-only tree of inline fields from note bodies. Off by default. |
| Show note counts | Shows or hides distinct-note counts beside rows. |
| Sort by | Selects the shared property/value sort preference. |
| Excluded folders | One vault-relative folder per line, including subfolders; omitted from the index and new bulk edits. |
| Hidden properties | One property name per line; remove a name to restore it. Leave empty to hide none. |

Preferences, pinned properties, property selections, and saved views are saved as plugin settings. They are not added to your notes. Bulk-edit undo is temporary and is not saved with preferences.

Available command-palette commands use the prefix **Supercharged Properties:**.

| Command | Purpose |
| --- | --- |
| Open sidebar | Opens or reveals the properties view. |
| Open in tab | Opens a properties view in a tab. |
| Refresh property index | Rebuilds metadata and type-icon information. |
| Undo last property edit | Restores the last eligible property-name or value edit batch; available only while an undo batch exists and no edit is running. |

## Keyboard and mobile use

Tab through controls and use their normal keyboard activation. With a property, value, or editable note row focused, press **Shift+F10** or the **Context Menu** key to open its row menu. **Escape** in the tree search closes it and clears the query. Ctrl-click or Cmd-click on a note opens a new tab.

For note selection on desktop, Alt/Option-click toggles individual notes, Shift-click adds a displayed range, and Shift+Up/Down adds notes while moving keyboard focus. Escape clears note selection. Checkboxes toggle notes on both desktop and mobile without opening them; Shift-clicking a checkbox adds a range.

The interface provides labelled controls, visible focus, expand/collapse state, and a live summary. On mobile, use the ribbon or command palette to open the view. Long-press an editable note row for **Change property…** or **Select notes…**; scrolling cancels the pending long-press. The change dialog uses the visible screen area, scrolls its contents, and keeps Apply and Cancel above the keyboard.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| The tree is empty | Clear the tree search, choose All properties, check Hidden properties and Excluded folders, and confirm notes contain YAML frontmatter. Then refresh. |
| A property is missing from a saved view | Check its selected keys, Hidden properties, and Excluded folders. A view does not automatically gain new property keys. |
| Counts seem too low | Excluded notes are not counted. Counts represent distinct notes; duplicate list values in one note count once. |
| Two rows have the same label | They may have different stored types, such as numeric `4` and text `"4"`. Review the note's YAML. |
| A nested object has no value row | Objects are not indexed as editable scalar values. Open its note through the property branch. |
| A type icon is incorrect | Check the property's type in Obsidian and refresh the index. Missing type information falls back to text. |
| Open in Search does not work | Enable the core Search plugin. The local property tree remains usable without it. |
| Copy reports Clipboard unavailable | Clipboard access failed in the current host; open the note directly or retry after restoring clipboard access. |
| A setting does not persist | Check the settings-write notice, vault permissions, and available storage, then retry. |
| Split into list is missing | Confirm the property is configured as Text, the selected value is text, and the property is not tags, aliases, or cssclasses. After a type change, refresh the property index. |
| A template note still appears | Use a vault-relative path with the exact folder capitalization. Templates excludes Templates/Note.md, not Other/Templates/Note.md. Core Search is independent of this setting. |
| Rename property is missing | Confirm you are using version 1.2.0 or later and open the property-row menu, not a value-row menu. |
| Change status… is missing | Open the note-row menu under a supported property. Text, Number, Checkbox, Date, Date & time, List, aliases, and cssclasses are supported. The special tags property and unknown property types are excluded. |
| Some selected notes do not change | Inspect the preview for unchanged values, excluded folders, missing/ambiguous keys, and unsupported stored values. Changes made after preview are skipped at Apply. |
| Shift-click does not deselect notes when moving back | Shift-click adds to the selection. Use a checkbox or Alt/Option-click to deselect individual notes. |
| Delete value is missing | Empty `(empty)` and object rows do not offer deletion. To remove the whole property, use **Delete property…** on its property row. |
| A property disappeared after deleting its last value | Deleting an entire value removes the property key from that note. Undo restores it while the key name remains free. |
| An edit is skipped, fails, or cannot be undone | See [edit troubleshooting and limits](BULK-EDITING.md#troubleshooting-and-limits). |

For development and release information, see the [documentation index](README.md).
