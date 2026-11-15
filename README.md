# Supercharged Properties

Supercharged Properties is an Obsidian plugin that turns your vault's YAML frontmatter into a full-pane, browsable tree of **properties → values → notes**. Explore how metadata is used across your vault, filter it, save focused views, and jump straight to the notes you need.

Browsing remains read-only. Explicit property-name and value actions can modify frontmatter after you review and confirm a preview.

## Feature availability

This README describes **1.2.0**, which adds property-name renaming, excluded folders, and text-only Split eligibility. The shared undo command is **Undo last property edit**; in 1.1.0 it was called **Undo last value edit**.

For complete instructions, start with the [user guide](docs/USER-GUIDE.md).

## Features

- **Property-name renaming** — rename a property across the vault with a complete preview, conflict skipping, and shared one-step undo.
- **Excluded folders** — omit template folders and their subfolders from the tree, counts, copied links, and new bulk edits.
- **Bulk value editing** — rename or merge values, convert text to wikilinks, and split eligible text into lists with preview, confirmation, and one-step undo.
- **Full property tree** — properties, values, and notes from included folders.
- **Typed value rows** — strings, numbers, booleans, empty values, and nested lists are kept distinct. Repeated values are deduplicated per note.
- **Property type icons** — rows show the icon for the type configured in Obsidian, such as text, list, tags, number, checkbox, date, or date & time. The plugin reads `.obsidian/types.json` through public APIs and falls back to built-in names and text.
- **Search everything or narrow the scope** — search property names, values, note names, or paths, with automatic branch expansion for matches.
- **Property picker** — include only the properties you care about, with All / None shortcuts and a live filter.
- **Saved views (profiles)** — save a property selection, switch between views, then update, rename, or delete them.
- **Sorting** — by property name (A–Z or Z–A) or by note frequency (high or low).
- **Pinning and hiding** — keep important properties at the top and hide noisy ones.
- **Native Search integration** — open an Obsidian property query for a property or value, copy the query, or copy matching note links.
- **Accessible controls** — labelled buttons, keyboard-operable menus, visible focus states, and live summaries.
- **Live updates** — edits, renames, deletes, and metadata resolution refresh the tree automatically. Refreshing the index reloads property type icons.

## Data access

The property index enumerates Markdown notes in the current vault and reads their cached frontmatter. It needs those paths to provide vault-wide browsing and bulk editing; it does not enumerate non-Markdown attachments. Property icons read the vault's property-type configuration. Copy actions write a generated query or note-link list to the clipboard only when you select them. The plugin never reads clipboard contents and does not send vault data over the network. Explicit bulk edits write frontmatter only after confirmation.

## Requirements

- Obsidian **1.7.2** or later.
- Desktop and mobile are supported (`isDesktopOnly` is `false`).
- The core **Search** plugin is required only for the "Open in Search" action.

## Installation

### Community plugins

If the plugin is listed, open **Settings → Community plugins → Browse**, search for **Supercharged Properties**, install, and enable it.

### Manual installation

1. Create this folder in your vault:

   ```text
   <YourVault>/.obsidian/plugins/supercharged-properties/
   ```

2. Copy these files into it:
   - `main.js`
   - `manifest.json`
   - `styles.css`

3. Reload Obsidian, then enable **Supercharged Properties** under **Settings → Community plugins**.

### From source

```sh
npm install
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` into your plugin folder as described above.

## Usage

Open the view with the ribbon icon or a command:

- **Supercharged Properties: Open sidebar**
- **Supercharged Properties: Open in tab**
- **Supercharged Properties: Refresh property index**

The toolbar provides:

- **Sort properties** — choose a sort order.
- **Refresh property index** — rebuild the index from the vault.
- **Expand/collapse all** — follows the current property selection.
- **Toggle search** — show or hide the search field without silently filtering the tree.
- **Choose properties to show** — open the property picker and profile manager.
- **Property view** — switch between all properties, a custom selection, and saved profiles.

### Working with rows

- Click a property to expand or collapse its values.
- Click a value to show or hide the notes that contain it.
- Click a note to open it; Ctrl/Cmd-click opens it in a new tab.
- Right-click a row, or press Shift+F10 / the Context Menu key, for actions:
  - **Open in Search**
  - **Copy search query**
  - **Copy matching note links**
  - **Pin property** / **Unpin property**
  - **Hide property**
  - **Rename property…** (property rows)

### Rename property names

Right-click a property row and choose **Rename property…**. Enter the destination name, review eligible and skipped notes, then confirm with **Rename in N notes**. Values and stored types are preserved; existing destination keys and ambiguous source keys are skipped. Case-only corrections are supported. Saved views and display preferences include the new name and retain the old one for skipped or undone notes. The vault's configured property type is not renamed. See the [property-name guide](docs/PROPERTY-RENAMING.md).

### Exclude template folders

Open **Settings → Supercharged Properties → Excluded folders** and enter one vault-relative folder path per line, such as `Templates` or `Resources/Templates`. Entries include subfolders, are case-sensitive, and take effect immediately. Excluded notes are absent from the tree, counts, copied note links, and new bulk edits. Obsidian's core Search remains independent. See [folder exclusions](docs/USER-GUIDE.md#exclude-template-or-other-folders).

### Bulk value edits

Right-click a value row to **Rename value**, **Merge value** into another value of the same type, **Convert to wikilink**, or **Split into list**. To merge `in-progress` and `doing` into a new `active` value, rename one to `active`, then merge the other into it. Each confirmed operation is a separate undo batch.

The dialog lists every affected path and its before/after value. Actions cover matching values in included folders across the vault, regardless of search filters or saved views. Excluded folders are skipped, including notes excluded after the preview was opened. Matching follows the tree's case-insensitive, Unicode-normalized identity and preserves distinct scalar types. Rename accepts text; numeric and boolean replacements retain their type when valid. Rename/merge deduplicate equal list entries. Split is offered only for text values under Text properties and applies only to scalar text. List, Number, Checkbox, Date, Date & Time, tags, aliases, and cssclasses properties do not offer Split. It uses a literal delimiter, trims parts, and drops empty parts. Wiki conversion wraps plain text in `[[…]]`; existing links and text containing brackets or newlines are skipped.

Click **Apply to N notes** to confirm. Notes whose property changed since preview are skipped. Failures are reported individually; successful notes can still be undone. Obsidian's frontmatter writer may reformat YAML, including comments and quoting; note bodies are not edited.

Use **Supercharged Properties: Undo last property edit** in the command palette to undo the last successful property-name or value batch in one step. Undo preserves other properties and skips values edited since the batch. Failed or skipped undo entries can be retried. Undo is held in memory: another successful batch replaces it, and restarting or disabling the plugin clears it. Renamed or deleted notes cannot be restored through their old paths. Undo restores keys and values, not YAML formatting. It remains available for previous edits even after their folders are excluded.

### Search scopes

Use the sliders button next to the search field to search:

- everything,
- property names only,
- values only, or
- note names and paths only.

When the search field is hidden, the filter is cleared so the tree always reflects what you see.

### Saved views

Open **Choose properties to show**, select the properties you want, and use **Save new** to create a named view. **Update** overwrites the active view with the current selection, **Rename** changes its name, and **Delete** removes it. Property selections are stored in the plugin's settings, not in your notes.

## Settings

Open **Settings → Supercharged Properties**:

- **Show note counts** — display the number of distinct notes for each property and value.
- **Sort by** — set the default sort order.
- **Excluded folders** — one vault-relative folder path per line, such as `Templates` or `Resources/Templates`. Includes subfolders; matching is case-sensitive. Changes apply immediately.
- **Hidden properties** — one property name per line. Hidden properties can be restored by removing their names here.

## How it works

On startup, the plugin reads frontmatter from Obsidian's metadata cache and builds an incremental index:

1. Property names are normalized (trimmed, Unicode NFC, case-folded) so `Status` and `status` share one row.
2. Values keep their type identity, so `false`, `"false"`, `0`, and `"0"` remain distinct. Complete wiki links are preserved to avoid alias collisions.
3. Each row counts distinct notes, not assignments; a note contributes at most one count per row.
4. Metadata and vault events update single notes when possible. Metadata resolution and folder renames trigger a debounced rebuild.

Unsupported object values (for example, nested maps) do not produce value rows, but their notes remain visible under the property so they are not lost.

## Development

Development requires Node **22.13+**, **24+**, or **26+**.

```sh
npm install
npm run lint       # ESLint, zero warnings allowed
npm test           # Vitest suite
npm run build      # Type-check and bundle to main.js
npm run validate   # Lint, build, test, and release validation
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for architecture, testing, and review conventions.

## Documentation

- [User guide](docs/USER-GUIDE.md)
- [Bulk value editing and undo](docs/BULK-EDITING.md)
- [Property-name renaming](docs/PROPERTY-RENAMING.md)
- [Documentation index](docs/README.md)
- [Contributing](CONTRIBUTING.md)
- [Publishing](docs/PUBLISHING.md)
- [Release QA](docs/RELEASE-QA.md)
- [Changelog](CHANGELOG.md)
- [1.2.0 release notes](docs/releases/1.2.0.md)
- [1.1.0 release notes](docs/releases/1.1.0.md)
- [1.0.3 release notes](docs/releases/1.0.3.md)
- [1.0.2 release notes](docs/releases/1.0.2.md)
- [1.0.1 release notes](docs/releases/1.0.1.md)
- [1.0.0 release notes](docs/releases/1.0.0.md)

## License

Copyright (c) 2026 Ajay Zapadiya.

Released under the **MIT License**. You may use, copy, modify, merge, publish, distribute, sublicense, and sell copies of the software, provided the copyright and permission notice are included. The software is provided **as is**, without warranty of any kind. See [LICENSE](LICENSE) for the full text.

Third-party notices are documented in [NOTICE.md](NOTICE.md).

## Disclaimer

Supercharged Properties is an independent community plugin and is not affiliated with or endorsed by Obsidian. Obsidian is a trademark of Dynalist Inc.
