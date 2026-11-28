# Supercharged Properties user guide

Supercharged Properties displays your vault's YAML frontmatter as a tree of **properties → values → notes**. Use it to inspect metadata, find notes, organize the view, and explicitly edit matching values across notes.

Browsing, searching, sorting, and saving views do not modify notes. YAML edits write frontmatter; inline edits write note-body fields. Both require preview and confirmation.

This guide covers release **1.6.1**, including Add/Remove property batches, File explorer folder counts, and Manual property order. See the [1.6.1 patch notes](releases/1.6.1.md) and [1.6.0 release notes](releases/1.6.0.md) for changes since 1.5.1. The shared YAML undo command is **Undo last property edit**; inline-field edits use **Undo last inline property edit**.

## Contents

- [Install and open](#install-and-open)
- [Browse properties, values, and notes](#browse-properties-values-and-notes)
- [Understand values and counts](#understand-values-and-counts)
- [Search the tree](#search-the-tree)
- [Inline properties](#inline-properties)
- [Folder filters](#folder-filters)
- [Value filter](#value-filter)
- [Choose properties](#choose-properties)
- [Exclude template or other folders](#exclude-template-or-other-folders)
- [How display controls affect scope](#how-display-controls-affect-scope)
- [Save and manage views](#save-and-manage-views)
- [Sort, pin, and hide](#sort-pin-and-hide)
- [Reorder properties manually](#reorder-properties-manually)
- [File explorer folder counts](#file-explorer-folder-counts)
- [Use Obsidian Search and copy links](#use-obsidian-search-and-copy-links)
- [Rename property names](#rename-property-names)
- [Delete properties or values](#delete-properties-or-values)
- [Change a property on selected notes](#change-a-property-on-selected-notes)
- [Add or remove properties across folders or notes](#add-or-remove-properties-across-folders-or-notes)
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

For large trees, Search everything and Note names / paths wait briefly after typing before refreshing results. Press Enter for an immediate refresh. Small-tree searches and clearing the search remain immediate. Search branches load as they approach the visible area, so offscreen note rows do not hold up typing. Counts and property-removal scope still use the full matching subset, including results not yet drawn. Keyboard navigation and range selection load the complete property branch when needed.

| Scope | Searches |
| --- | --- |
| Search everything | Property names, values, and note paths. |
| Property names | Property names only. |
| Values | Value labels only. |
| Note names / paths | Note filenames and their folder paths. |

Search uses case-insensitive substring matching. It is a local tree filter, not an Obsidian query parser: enter `Projects/` to find matching paths, rather than `path:Projects`.

Matching branches expand automatically. You can then expand or collapse individual properties and value branches with their arrows, including after Collapse all. After Collapse all, expanding a property shows only its values; expand a value separately to see its notes. A new search automatically reveals matching note branches again. These choices stay in place during live refresh and reset when the search or view changes. A matching property can show all its values; a matching value can show all its notes. A note-path match reveals the relevant note branch. Clear the input to return to ordinary browsing. **Escape** or hiding the search input clears the tree search, but keeps an active Value filter. Changing the property view also clears the tree search.

Search operates within your current property selection and excludes hidden properties. It narrows YAML Delete property and tree Add/Remove properties to matching notes. Other row edits and the copy-links action retain their full Folder/Value-filtered scope.

## Inline properties

Available in 1.5.0. Turn on **Settings → Supercharged Properties → Show inline properties**, then select **Inline Properties** in the view dropdown. It is a built-in view separate from **All properties** and your saved YAML views.

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

Expand **property → value → notes**, search the tree, sort rows, open notes, or copy matching note links. **Filter by Value** and the expandable matching-note list also work within the inline index. Inline rows offer **Open in Search** and **Copy search query**, using a quoted `line:` text query for the property, `::`, and optional value. Native Search can also match code examples or separate fields on the same line; its results are broader than the inline parser. Search queries remain vault-wide. See [Obsidian Search operators](https://help.obsidian.md/plugins/search).

### Edit inline properties and values

Right-click a property row (long-press on mobile) for **Rename property…**, **Delete property…**, or **Replace selected values…**. On a value row, choose **Rename value…**. In the replacement dialog, select one or more values of that property and enter one new text value. Every matching occurrence of the selected values is replaced; it does not add another value. Repeated inline fields stay repeated, and values remain literal text.

Choose **Preview changes**, review each note's complete before/after text and skipped notes, then **Confirm changes**. Changing an input invalidates the preview. Delete property removes every occurrence of that inline field and its values, including inline wrappers. Rename preserves values and formatting and skips notes where the destination inline property already exists. YAML frontmatter, code, comments, other fields, and surrounding prose remain untouched. Ambiguous or unsupported formatting and replacements that would break inline syntax are skipped.

Edits honor excluded folders, folder filters, and the active Value filter. Tree search and saved views do not further restrict the affected notes. Notes changed after preview are skipped. Use **Supercharged Properties: Undo last inline property edit** to restore the last successful inline batch until reload. Undo restores the complete previous note only if the note still matches the applied version; later edits, missing notes, and currently excluded folders are skipped. Inline undo is separate from YAML's **Undo last property edit**.

Inline property menus also include **Pin/Unpin property** and **Hide property**. Pins in the built-in Inline Properties view are inherited by saved inline views, with local overrides inside each saved view. They do not affect YAML pins. Restore hidden inline properties in **Settings → Supercharged Properties → Hidden inline properties**. Inline note rows remain navigation-only; use property/value menus for inline edits.

### Convert inline fields to YAML

Use **Convert to YAML property…** from an inline property/value menu (right-click on desktop, long-press on mobile). Select notes, choose **Move** or **Keep**, and choose **Skip**, **Merge into list**, or **Overwrite** for existing YAML values. Literal text is the default; optional detection handles numbers, booleans, and ISO date text. Repeated fields become a list. Preview and confirmation are required.

Conversion honors Value filters, folder filters, and excluded folders; tree search stays display-only. It shares **Undo last property edit** with YAML editing and skips notes changed after preview or before undo. This is an explicit write action; ordinary browsing remains read-only. See [conversion options, scope, conflicts, and recovery](BULK-EDITING.md#convert-inline-properties-to-yaml).

### Save an inline view

1. Choose **Inline Properties** from the view dropdown.
2. Open **Choose properties to show** and select the inline fields you want.
3. Enter a view name and choose **Save new**.

Saved inline views appear as **Inline: Name** in the dropdown. Use **Update**, **Rename**, and **Delete** just as you would for a YAML view. Changing the selection marks a saved view **(modified)** until you update it or select the saved view again. Deleting a view keeps its current selection as a custom selection and does not change any notes.

**Inline Properties** is the built-in all-fields view and cannot be renamed or deleted. **All → Save new** without folders reports that this view already exists; all properties with a folder filter can be saved as a custom view; **None → Save new** asks you to select at least one property. All/None preserve the name you have typed. Empty names, duplicate names within inline views, and the built-in view names are rejected. A YAML view and an inline view can share a name because their dropdown labels distinguish them.

Inline selections and saved views are stored separately from YAML selections and views. Saved keys remain available even if no note currently uses them. Search and **Filter by Value** work within an inline saved view without replacing its saved keys.

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

When a Value filter is active, the matching-note dropdown and its count also follow the tree search (property names, values, or note names/paths). This works whether you search before or after applying the Value filter. Clearing the search restores the full Value filter note list; collapsing branches does not change the list. Search also narrows **Delete property…**, **Add properties to these notes…**, and **Remove properties from these notes…** to the matching row notes. Other row edit previews continue to use the full Folder/Value-filtered subset.

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

Changes apply immediately and are saved for the next session. Clear an entry to restore its notes. Excluded notes do not contribute properties, values, counts, local tree-search results, copied note links, or bulk-edit previews. A bulk edit opened before the setting changed also skips newly excluded notes. Undo for ordinary YAML value, selected-note, and property-name edits remains available if their folders are later excluded. Add/Remove batches, inline edits, and inline-to-YAML conversion skip currently excluded notes during undo; remove the exclusion before retrying an Add/Remove batch’s pending undo.

This setting does not change your notes or Obsidian's global Search settings. **Open in Search** and copied search queries use Obsidian Search and can still return excluded notes. Saved profiles retain their property keys; properties used only by excluded notes disappear until an included note uses them again.

## How display controls affect scope

| Control | Tree and counts | Copied note links | New bulk edits |
| --- | --- | --- | --- |
| Value filter | Recalculates properties, values, and counts for matching notes; hides the filter property. | Copies only matching subset links. | Narrows value edits, property renames, and property deletion to the subset. |
| Tree search | Filters branches and shows distinct matching-note counts. | Copies the row's full Folder/Value-filtered note set. | Narrows Delete property and tree Add/Remove properties to matching row notes; other row edits keep their full Folder/Value-filtered scope. |
| Property selection / saved view | Shows selected properties; does not filter notes within a property. | Uses the selected row's full indexed note set. | Does not narrow the selected row's notes. |
| Hidden properties | Hides named properties without removing their indexed notes. | Available from visible rows. | Does not act as a note exclusion rule. |
| Folder filter | Includes notes from selected folders and descendants; intersects the Value filter. | Only links inside the combined scope. | Only notes inside the combined scope. |
| Excluded folders | Removes notes from the index, values, and counts. | Excluded notes are omitted. | Excluded notes are omitted from previews and skipped before writes. |

The table describes property/value-row bulk actions. “Full indexed note set” means the row's subset after folder and Value filters. **Change status…** from a note row edits only the explicitly selected notes. Selection checkboxes do not narrow a value-row Rename, Merge, or Delete batch. Changing the search, property scope, folder filter, or Value filter clears note selection.

**Open in Search** and **Copy search query** generate queries for Obsidian's core Search. They do not add folder-exclusion, folder-filter, or Value filter conditions. Undo exclusion rules depend on the editing action, as described above.

## Save and manage views

Saved views, also called profiles, store a **property selection**, optional **folder filters**, and local pin/unpin choices. YAML and Inline sources can each store their own manual property order. The selected sort mode is global; the manual arrangement belongs to the view. Search text and hidden-property settings are not saved separately per profile.

### Create a view

1. Open **Choose properties to show**.
2. Select properties, for example `status`, `author`, and `topics`.
3. Enter a name such as `Writing` in **View name**.
4. Click **Save new**.

Choose a saved view from the **Property view** dropdown to restore its selection. Use **All properties** to return to every non-hidden property, including properties added later. A saved view records the selected keys at save time. In 1.2.1, new views must contain at least one property and cannot duplicate the all-properties selection.

### All, None, and the default view

In 1.2.1, **All** and **None** preserve any view name you have typed on both desktop and mobile. You can adjust the selection and then save without retyping the name.

- **All → Save new (without folders):** shows **All properties View already exists.** No duplicate view is created, and your typed name stays in the field.
- **None → Save new:** shows **Please select at least one property.** Select one or more properties and retry with the same name.
- Selecting every indexed property manually produces the same All-properties message.
- **Update** also rejects empty or all-property selections and preserves the existing saved view.
- **All properties** is the built-in default and cannot be renamed or deleted. Choosing All clears the active saved-view selection, disables its Update/Rename/Delete controls, and keeps your saved views intact.
- **All → Save new with folders:** saves a custom view containing the full property selection and the folder filter.
- The name **All properties** is reserved for the default view. Done/Enter uses the same validation as Save new.

### Save a view on mobile

In 1.2.1, the saved-view name field and buttons appear above the property choices on touch and narrow screens. Opening **Choose properties to show** leaves the keyboard closed until you tap a text field. The panel scrolls within the space above the keyboard, so **Save new**, **Update**, **Rename**, and **Delete** remain reachable even on a short screen.

Type a name and tap **Save new**, or press the keyboard's **Done/Enter** action to save a new view. Enter always creates a new view; use **Rename** to rename the active one. Successful actions dismiss the name-field keyboard when it still has focus. Blank or duplicate names keep the input available for correction. Composing characters with an input method does not prematurely submit the name.

These changes have automated and simulated mobile-browser coverage; verify keyboard behavior on your device's Obsidian app.

### Change or remove a view

| Action | Steps and result |
| --- | --- |
| Update | Select a saved view, change the checkboxes or folders, then click **Update** to replace its saved selection. |
| Rename | Select a saved view, type its new name, then click **Rename**. |
| Delete | Select a saved view and click **Delete**. The saved view is removed immediately; the current property selection remains as a custom selection. Notes are untouched. |

The view picker opens below the view bar and scrolls within the available screen space. Long view names wrap in the list. Use Up/Down, Home/End, or type a view name to navigate; Enter/Space selects, Escape cancels, and clicking outside closes the list. The selected view is highlighted.

Names cannot be blank or duplicate another view name, ignoring case. The input allows up to 80 characters. Update, Rename, and Delete require an active saved view.

A view is marked **(modified)** when its current selection differs from the saved selection. Click Update to keep the changes, or choose the saved view again to restore its saved keys and folders. Each dropdown count includes currently present, non-hidden properties in that entry’s own property selection and folders. All properties uses the full indexed source. Selecting another profile, applying a temporary Value filter, or searching the tree does not narrow the other dropdown counts. An active modified view uses its current selection and folders. A saved key that is temporarily absent from the vault is retained and becomes useful again when that property reappears.

## Folder filters

The property picker shows only properties found in the selected folders. Saved selections outside those folders remain stored and become available again when you clear or change the folder filter.

Use **Choose properties to show → Folders → + Add folder** to limit the current view to notes in selected folders. Type part of a folder path in the fuzzy chooser, then select it. The root, already selected folders, their descendants, and globally excluded folders are omitted from suggestions. Desktop and mobile use the same controls.

Selected folders appear as removable chips only inside **Choose properties to show**. Folder paths stay hidden while the panel is closed; the summary still indicates that the view is filtered. Remove a chip with **×**, or choose **Clear** in the panel’s Folders row to remove the folder filter. Multiple folders include notes from any of those folders, including descendants. Paths are case-sensitive and use exact folder boundaries: `Templates` does not match `Templates Archive`. There are no glob patterns. Adding an ancestor absorbs its selected descendants.

Folder filters are **per-view include lists**. **Excluded folders** remains a global blacklist and always wins, including excluded subfolders inside a selected folder. Folder filters narrow the tree, property/value counts, copied note links, selected-note edits, bulk value edits, property rename/delete, inline edits, and inline-to-YAML conversion. A Value filter intersects this folder scope: notes must match both. Clearing one filter leaves the other in place. The summary shows **N properties · Filtered (M notes)**; counts use distinct indexed notes, not property assignments.

Choose **Save new** or **Update** to save the folder chips with a YAML or Inline view. Each source stores its selection independently. **All** properties with at least one folder is a valid custom view; **All** without folders is the built-in view. **None** still requires selecting a property before saving. All/None in the property panel change only property selection and preserve the folder chips and typed view name. Choosing the built-in **All properties** or **Inline Properties** view clears that source's folder filter. Applying an older saved view without folders also clears it.

A saved view is marked **(modified)** when its selected keys or normalized folders differ; folder order and redundant descendants do not matter. Saved property keys come from the full source index, so narrowing to folders never silently drops keys. Update saves both the property selection and folders. Deleting a saved view keeps the current folders as a custom selection.

Deleted or newly excluded folders remain as muted, dashed chips. They are not automatically removed or rewritten on folder rename. Remove them or choose replacement folders, then Update the saved view. An empty folder scope shows **No notes in the selected folders.**

**Open in Search** and **Copy search query** remain vault-wide. Tree search additionally narrows Delete property and tree Add/Remove properties to the row's matching notes. Other row edits use the folder chips and Value filter to limit their scope. Preview and confirm every batch. Undo restores only notes changed by that batch; notes outside its folder scope are untouched.

## Sort, pin, and hide

Click **Sort properties** to choose:

- **Property name (A to Z)**
- **Property name (Z to A)**
- **Frequency (high to low)**
- **Frequency (low to high)**
- **Manual**

The automatic ordering options apply to property and value rows. Manual orders properties only; its values and notes use A–Z. A–Z and Z–A sort wikilink values by the target note’s filename, ignoring its folder, alias, and heading/block reference. Resolved links use the actual note basename; unresolved links use the last target segment without `.md`. Expanded notes use filename ordering too, with full paths breaking ties. Numeric ordering puts `2026-W9` before `2026-W21`. Original labels and edit values stay unchanged. Frequency means distinct-note count; ties use alphabetical order. The same preference is available in Settings.

Right-click a **property row** and choose **Pin property** to keep it above unpinned properties. Choose **Unpin property** to restore normal ordering. Pinning does not override the property selection, search, or hiding.

Pins set in **All properties** are inherited by other YAML views. Pinning inside a saved view affects only that view. Unpinning an inherited pin inside a saved view hides its pin only there; All properties and other views keep it. Local choices persist across reloads and stay with the saved view when renamed or updated. Existing pins remain global until you override them in a view.

Unsaved custom selections have their own local pin choices, which are copied when you save a new view. Deleting a saved view retains its current pin choices in the resulting custom selection. Inline views have separate pin settings and the same inheritance behavior within inline views.

Choose **Hide property** to remove a property from the tree. To restore it, open **Settings → Supercharged Properties → Hidden properties** and remove its name. Hiding changes the display only; it does not delete metadata. Hidden-property names are matched without regard to capitalization or surrounding whitespace.

### Reorder properties manually

Available since **1.6.0**. Choose **Sort properties → Manual** to restore the current view’s saved order without opening editing controls. If this view has no saved order, it inherits the source’s base order, or uses A–Z when no base order exists. Switching to Manual does not create or overwrite a saved order.

To change the order, choose **Sort properties → Reorder properties…**. Handles and **Done** / **Cancel** then appear. **Reset manual order** is a separate action that clears the current view’s explicit order.

- Drag a property’s grip to a new position. Dragging starts only from the grip, so you can still scroll on the rest of the row on mobile. A line shows where the property will go; release to save or press Escape to cancel. You can drop in the empty area below the last property to move to the end of its group. Background tree refreshes wait until the gesture finishes.
- Right-click the property name (long-press on mobile) and choose **Move up**, **Move down**, **Move to top**, or **Move to bottom**.
- Focus the grip with Tab, then use Up/Down to move one place or Home/End to move to the start/end. Alt+Up/Down also works on the property name button. Focus follows the moved property and its position is announced to screen readers.

Pinned properties remain first. Moves stay within the pinned or unpinned group; pin or unpin a property to change groups. Under search, hidden-property settings, or Folder and Value filters, moves use the visible neighbors. Filtered-out keys keep their relative order. New properties appear alphabetically after listed properties. Choose properties to show reflects the manual order, but its rows do not have drag handles.

Orders are stored separately for YAML and Inline sources:

| Current view | Where a move is saved |
| --- | --- |
| All properties / Inline Properties | The source’s base order. |
| Custom selection, including a folder-only selection | A custom order; inherits the base until changed. |
| Saved view | That saved view’s order; inherits the base until changed. |

Choose **Done** to keep the arranged order, hide the handles, and continue browsing in Manual mode. Choose **Cancel** to discard this session’s moves and restore the last automatic sort (A–Z, Z–A, high-to-low, or low-to-high), while preserving any previously saved manual order. Use **Sort properties → Reorder properties…** to arrange again. If no previous automatic sort is known, Cancel returns to A–Z.

Moves save as you arrange; you do not need **Update**, and order changes do not mark a view **(modified)**. Closing the view, changing order layers (for example switching saved views), or choosing an automatic sort ends arranging and retains the moves made so far. Use Cancel before leaving if you want to discard them. **Save new** copies an explicit order from the current view. Deleting a saved view retains its explicit order in the resulting custom selection. Switching to an automatic sort hides the controls but keeps all stored orders.

In Manual mode, **Sort properties → Reset manual order** clears only the current view’s explicit order. Saved and custom views then inherit their source’s base order; resetting a base view returns it to A–Z. Other views’ explicit orders are unchanged. Values and notes always use A–Z in Manual mode, including filename sorting for linked values.

Ordering is display-only: it never edits notes or changes Obsidian’s own property order. It is saved in plugin preferences and is independent of **Undo last property edit**.

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

This action supports Text, Number, Checkbox, Date, and Date & time properties, plus add/remove operations for flat List properties. Aliases and cssclasses support text-list items; tags remain unsupported in this selected-note dialog. For YAML tags, use [Add or Remove properties](ADD-REMOVE-PROPERTIES.md) instead. **Set empty (keep property)** retains a scalar key with `null`. List **Remove values** retains the key with `[]` when the last item is removed; **Remove property** deletes the entire key for lists of any size, including empty lists. It previews only the selected notes and shares **Undo last property edit** with other edits. See [changing selected notes](NOTE-VALUE-EDITING.md) for the complete workflow, eligibility, and safeguards.

## Add or remove properties across folders or notes

Available since **1.6.0**. Right-click a folder or an Explorer multi-selection to open **Add properties to folder’s notes…** / **Remove properties from folder’s notes…**, or their **selected notes…** equivalents. A single note’s Explorer menu does not offer these batch actions. In the YAML tree, property/value menus offer **Add properties to these notes…** and **Remove properties from these notes…**.

Add up to 20 typed properties together, or select whole properties to remove. The dialog shows eligible notes, supports subfolder inclusion, and previews changes before confirmation. Explorer selections ignore view filters; tree actions honor Folder and Value filters plus the active tree search. Global folder exclusions always apply. These actions are not available in the Inline tree.

Read the [Add/Remove guide](ADD-REMOVE-PROPERTIES.md) for supported types, existing-value choices, selection controls, previews, and retryable session undo.

Add properties supports YAML `tags` as a List; choose **Merge into list** to keep existing tags. Remove properties can delete the entire YAML `tags` property with preview and undo, and **Select none** clears the removal selection. Tags written in the note body remain unchanged.

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

**Vault enumeration.** The plugin lists Markdown notes in the current vault through Obsidian’s API to build its property index, then reads cached frontmatter. This supports vault-wide browsing and matching-note counts. Global excluded folders are applied after the file list is obtained: they prevent property indexing for those notes, but do not prevent their paths from appearing in the initial enumeration. Saved-view Folder and Value filters narrow the view and supported edits; they are not access permissions.

**Optional File explorer counts.** This feature is off by default. When enabled, it lists Markdown paths, including notes without properties. If you also enable counting all files, it lists non-Markdown attachment paths as well. Counting uses paths only and does not read file contents. Its separate exclusion setting controls whether globally excluded folders contribute to those counts.

**Other reads.** The plugin reads the vault’s configured property types for icons. When Show inline properties is enabled, it additionally reads included Markdown note bodies for the separate inline index; disabling that setting stops new inline reads and clears that index.

**Clipboard access.** **Copy search query** and **Copy matching note links** write only the generated query or links when you select the action. They replace the current clipboard contents, but never read them. The plugin does not read content copied from other applications or monitor the clipboard in the background.

The plugin does not send vault data to external services. Explicit YAML edits write frontmatter, and inline edits write note-body fields, after preview and confirmation.

**Security scanner recommendations.** Scanners may flag vault enumeration and clipboard access because the plugin uses those APIs. Enumeration supports indexing and optional folder counts; clipboard usage is write-only and user-triggered. A generic clipboard warning does not mean the plugin reads your clipboard. These notices describe capabilities, and may still appear for optional features that are disabled because static scanners inspect the code.

## File explorer folder counts

Available since **1.6.0**. Turn on **Settings → Supercharged Properties → Show note counts in the File explorer** to add a count beside folders in Obsidian’s built-in File explorer. This feature is off by default. It changes the display only and never edits notes.

- **Including subfolders** shows all Markdown notes in a folder and its descendants (the default).
- **Directly in the folder** counts only notes in that folder.
- **Both (direct · total)** shows both numbers. For example, `3 · 12` means 3 notes directly in the folder and 12 including subfolders.
- **Hide zero counts in the File explorer** is on by default. In Direct mode, a folder with notes only in subfolders has no badge. In Both mode, `0 · 5` remains visible.
- **Count all files in the File explorer** includes attachments and other file types. It is off by default.
- **Skip excluded folders in the File explorer counts** applies the plugin’s global Excluded folders list, including descendants. It is off by default; enable it if templates should not contribute to Explorer counts. Changes to exclusions update counts automatically.

Counts include notes without YAML or inline properties. Saved views, hidden properties, tree search, and Value and Folder filters do not narrow Explorer counts. **Show note counts** controls the property tree separately. File and folder creation, deletion, and moves refresh Explorer badges after a short delay. Collapsing a folder does not change its count. The vault-root folder, when shown, includes all counted files.

Use **Supercharged Properties: Toggle folder counts** in the command palette to turn badges on or off. The preference persists across restarts. Turning it off or unloading the plugin removes its badges. **Show tooltips** controls badge hover hints; accessible count descriptions remain available.

The built-in **Files** core plugin must be enabled to see the badges. If File explorer’s layout is incompatible, counts stop for the session and a notice appears; other Supercharged Properties features continue working. Turn the setting off and back on to retry. Counts also appear in additional Explorer panes, including popout windows where supported.

## Settings and commands

Open **Settings → Supercharged Properties**.

| Setting | Purpose |
| --- | --- |
| Show tooltips | Show hover hints on browser controls and rows. On by default; changes apply to open views. Screen-reader labels and note previews remain available when off. |
| Hidden inline properties | One inline property name per line; separate from YAML hiding. |
| Show inline properties | Add a separate tree of inline fields from note bodies. Off by default. |
| Show note counts | Shows or hides distinct-note counts beside rows. |
| Sort by | Selects automatic sorting or Manual property ordering. |
| Include subfolders by default | Default folder recursion for Add/Remove batches; on by default. |
| Default when a note already has the property | Skip, Merge into list, or Overwrite in Add properties; defaults to Skip. |
| List delimiter | One character separating items in Add properties; defaults to a comma. |
| Excluded folders | One vault-relative folder per line, including subfolders; omitted from the index and new bulk edits. |
| Hidden properties | One property name per line; remove a name to restore it. Leave empty to hide none. |
| Show note counts in the File explorer | Optional folder badges; off by default. |
| File explorer count to show | Including subfolders, directly in the folder, or both. |
| Hide zero counts in the File explorer | Hide badges whose displayed count is zero; on by default. |
| Count all files in the File explorer | Include attachments and other non-Markdown files; off by default. |
| Skip excluded folders in the File explorer counts | Apply global folder exclusions to Explorer counts; off by default. |

Preferences, pinned properties, property selections, and saved views are saved as plugin settings. They are not added to your notes. Bulk-edit undo is temporary and is not saved with preferences.

Available command-palette commands use the prefix **Supercharged Properties:**.

| Command | Purpose |
| --- | --- |
| Open sidebar | Opens or reveals the properties view. |
| Open in tab | Opens a properties view in a tab. |
| Refresh property index | Rebuilds metadata and type-icon information. |
| Toggle folder counts | Turn File explorer folder badges on or off. |
| Undo last inline property edit | Restore the last successful inline batch, skipping notes changed afterward. Separate from YAML undo. |
| Undo last property edit | Restores the last eligible YAML or inline-to-YAML batch, including Add/Remove properties; available while an undo snapshot exists and no edit is running. |

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

## Add or remove properties across notes

Since **1.6.0**, Explorer folder and multi-selection menus offer separate Add and Remove actions. YAML property/value rows offer the same actions for the notes behind that row, respecting active Folder and Value filters. Add typed properties with existing-name/value suggestions, or select whole properties to remove. Preview every batch, review skipped keys, and undo through the shared command or completion screen. See the [Add and Remove guide](ADD-REMOVE-PROPERTIES.md).
