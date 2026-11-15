# Supercharged Properties user guide

Supercharged Properties displays your vault's YAML frontmatter as a tree of **properties → values → notes**. Use it to inspect metadata, find notes, organize the view, and explicitly edit matching values across notes.

Browsing, searching, sorting, and saving views do not modify notes. Property-name and value edits write frontmatter only after you review a preview and confirm.

This guide describes **1.2.0**, including property-name renaming, excluded folders, and text-property-only Split eligibility. The shared undo command is **Undo last property edit**; in 1.1.0 it was called **Undo last value edit**.

## Contents

- [Install and open](#install-and-open)
- [Browse properties, values, and notes](#browse-properties-values-and-notes)
- [Understand values and counts](#understand-values-and-counts)
- [Search the tree](#search-the-tree)
- [Choose properties](#choose-properties)
- [Exclude template or other folders](#exclude-template-or-other-folders)
- [How display controls affect scope](#how-display-controls-affect-scope)
- [Save and manage views](#save-and-manage-views)
- [Sort, pin, and hide](#sort-pin-and-hide)
- [Use Obsidian Search and copy links](#use-obsidian-search-and-copy-links)
- [Rename property names](#rename-property-names)
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
| Note row | Opens the note; Ctrl-click or Cmd-click opens a new tab. |
| Expand all properties | Expands currently visible properties. It does not open every value's note list. |
| Collapse all properties | Collapses branches and clears the tree search. |
| Show more | Reveals another page of a large value or note list. |
| Refresh property index | Rebuilds the tree and reloads property type icons. |

The tree updates automatically as notes and metadata change, including note and folder renames. Use Refresh if the view appears out of date. The bottom summary reports visible properties and whether a custom property selection is active.

Property rows show type icons based on the vault's configured property types, such as text, list, tags, number, checkbox, date, or date & time. Unrecognized or unavailable types fall back to text. Icons describe the configured property type; individual value rows retain the actual stored value's type.

## Understand values and counts

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

Matching branches expand automatically. A matching property can show all its values; a matching value can show all its notes. A note-path match reveals the relevant note branch. Clear the input to return to ordinary browsing. **Escape** or hiding the search input clears the filter. Changing the property view also clears the tree search.

Search operates within your current property selection and excludes hidden properties. It does not limit the scope of bulk edits or the row's copy-links action.

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
| Tree search | Filters displayed branches; row counts still represent their full indexed note set. | Copies the row's full indexed note set, not just visible search matches. | Does not restrict the selected row's batch to search matches. |
| Property selection / saved view | Shows selected properties; does not filter notes within a property. | Uses the selected row's full indexed note set. | Does not narrow the selected row's notes. |
| Hidden properties | Hides named properties without removing their indexed notes. | Available from visible rows. | Does not act as a note exclusion rule. |
| Excluded folders | Removes notes from the index, values, and counts. | Excluded notes are omitted. | Excluded notes are omitted from previews and skipped before writes. |

**Open in Search** and **Copy search query** generate queries for Obsidian's core Search. They do not add folder-exclusion conditions. Earlier edits can still be undone after their folders are excluded.

## Save and manage views

Saved views, also called profiles, store a **property selection**. They do not save search text, sorting, pinning, or hidden-property settings as separate per-view preferences.

### Create a view

1. Open **Choose properties to show**.
2. Select properties, for example `status`, `author`, and `topics`.
3. Enter a name such as `Writing` in **View name**.
4. Click **Save new**.

Choose a saved view from the **Property view** dropdown to restore its selection. Use **All properties** to return to every non-hidden property, including properties added later. A saved view records the selected keys at save time; saving while All is selected captures the properties currently indexed.

### Change or remove a view

| Action | Steps and result |
| --- | --- |
| Update | Select a saved view, change the checkboxes, then click **Update** to replace its saved selection. |
| Rename | Select a saved view, type its new name, then click **Rename**. |
| Delete | Select a saved view and click **Delete**. The saved view is removed immediately; the current property selection remains as a custom selection. Notes are untouched. |

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

In 1.2.0, right-click a property row and choose **Rename property…**. Review all affected and skipped notes before confirming. Values keep their stored types; destination conflicts are skipped. Read the [property-name renaming guide](PROPERTY-RENAMING.md) for case-only renames, preference updates, configured-type limitations, and shared undo.

## Edit values across notes

Value-row menus offer **Rename value…**, **Merge value…**, **Convert to wikilink…**, and **Split into list…** when applicable. These actions change values, not property names. **Split into list…** requires a Text property and a text value. It is hidden for List, Number, Checkbox, Date, Date & Time, tags, aliases, and cssclasses. Strings already stored inside lists are not split.

Read the [bulk editing guide](BULK-EDITING.md) for examples, exact matching rules, preview and confirmation, partial failures, and undo. Each operation covers matching notes in included folders across the vault regardless of your tree search or saved view. Excluded folders are skipped. The full preview shows which notes will change.

## Data access and privacy

The plugin enumerates Markdown notes in your current vault to build the property index and reads cached frontmatter. This is necessary for vault-wide browsing and matching-note counts. It does not enumerate non-Markdown attachments. It also reads the vault's configured property types for icons.

**Copy search query** and **Copy matching note links** write only the generated query or links when you select the action. They replace the current clipboard contents, but never read them. No clipboard monitoring runs in the background. The plugin does not send vault data to external services. Explicit bulk edits write frontmatter after confirmation.

Security scanners may flag vault enumeration and clipboard access as capabilities. These capabilities support the features described above; removing them would remove vault-wide indexing or the Copy actions.

## Settings and commands

Open **Settings → Supercharged Properties**.

| Setting | Purpose |
| --- | --- |
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

Tab through controls and use their normal keyboard activation. With a property or value label focused, press **Shift+F10** or the **Context Menu** key to open its row menu. **Escape** in the tree search closes it and clears the query. Ctrl-click or Cmd-click on a note opens a new tab.

The interface provides labelled controls, visible focus, expand/collapse state, and a live summary. On mobile, use the available ribbon or command-palette entry to open the view. Row menus depend on the host's context-menu gesture, such as long-press; touch behavior should be verified on your device.

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
| An edit is skipped, fails, or cannot be undone | See [edit troubleshooting and limits](BULK-EDITING.md#troubleshooting-and-limits). |

For development and release information, see the [documentation index](README.md).
