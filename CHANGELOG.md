# Changelog

All notable changes to Supercharged Properties are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Expand the Value filter note count to browse matching notes with folder labels, native opening shortcuts, keyboard navigation, and desktop hover preview. Load additional notes in batches of 200; live updates preserve focus and scroll, with a compact mobile layout.

- Value filter: narrow each property view to notes sharing a value, with live subset counts, note links, a clearable filter bar, keyboard menus, and mobile long-press. Value edits, property renames, and property deletion respect the subset. Saved views retain their full keys; Obsidian Search queries remain vault-wide.

## [1.3.0] - 2026-11-16

### Fixed

- Give the Change property dialog a stable, spacious mobile layout. Fit the outer modal to the visible viewport, keep its preview scrollable and actions reachable above the keyboard, and restore its full height after keyboard dismissal.

### Added

- Add an explicit Remove property choice to selected-note editing for every supported scalar and list type, with whole-value previews, guarded deletion, and undo. Set empty and Remove values continue to retain the property key.

- Extend selected-note editing to Number, Checkbox, Date, and Date & time properties with typed controls and validation. Add/remove multiple values on flat List properties, including text lists for aliases/cssclasses, while preserving other items and supporting preview and undo.

- Show note-selection checkboxes on desktop as well as mobile, while retaining row highlights and desktop selection shortcuts.

- Align desktop note selection with File explorer: highlighted rows, Alt/Option-click toggles, additive Shift-click ranges, Shift+Up/Down, Escape to clear, and plain/Ctrl/Cmd-click opening notes. Mobile retains long-press and checkbox selection.

- Change a property on one or more selected notes via desktop right-click or mobile long-press. Choose existing values, add new text, or set empty, with property-scoped selection, preview, conflict checks, and shared undo.

- Delete a property name from matching notes, or delete a matching value from scalar and list frontmatter. Both actions reuse preview, explicit confirmation, conflict skipping, and the shared one-step undo. Property deletion preserves selections, saved views, pins, expansion, and hiding references for undo. Value deletion skips ambiguous property names when removing the whole key, both in preview and before writing.

## [1.2.1] - 2026-11-15

### Fixed

- Preserve the typed view name when choosing All or None on desktop and mobile.
- Prevent saving empty or all-property selections, reserve the default All properties name, and keep the default view protected from deletion and renaming.
- Keep the property picker and saved-view actions reachable above the mobile keyboard using a scrollable panel and visible-viewport sizing.
- Show saved-view controls first on touch/narrow screens, enlarge touch controls, and avoid automatically opening the keyboard when the picker opens.

### Added

- Done/Enter saves a new view from the name field, without submitting during IME composition. Successful mobile actions release name-field focus.

## [1.2.0] - 2026-11-15

### Fixed

- Restrict Split into list to text properties; hide it for list, number, checkbox, date, date & time, tags, aliases, and cssclasses properties.
- Use Obsidian's `createEl` helpers for UI elements and specific CSS selectors instead of `!important`.
- Stage and publish only the three Obsidian release assets, removing stale staging files.

### Added

- Excluded folders setting: omit selected folders and descendants from the property index, counts, copied links, and new bulk edits, with immediate updates and persisted preferences.
- Property-name renaming with complete previews, destination and ambiguity conflict skipping, guarded writes, and shared one-step undo.
- Saved views and display preferences retain the old key and include the renamed key. Configured Obsidian property types are not changed.
- GitHub Actions builds and cryptographically attests release assets before publication. Manual runs attest an existing release only when rebuilt assets match exactly.
- Document Markdown-only vault enumeration and explicit, write-only clipboard actions.

## [1.1.0] - 2026-11-14

### Added

- Bulk value rename, merge, wikilink conversion, and scalar text-to-list splitting from value-row menus.
- Complete affected-note previews and explicit confirmation before writes.
- Conflict-aware, session-scoped one-step undo, with partial-failure reporting and retries.
- User guide and bulk-editing walkthrough covering all features and limitations.
- Automated coverage for value transforms, previews, stale values, write failures, concurrent edits, and undo.

### Changed

- Browsing remains read-only; explicitly confirmed value actions can now modify frontmatter across the vault.
- Renaming and merging deduplicate equal entries in changed lists.


## [1.0.3] - 2026-11-14

### Added

- Property type icons in the tree. Types resolve from the vault's `.obsidian/types.json` through public `vault.adapter` APIs, then built-in `tags`, `aliases`, and `cssclasses` names, then a text fallback.

### Changed

- Refreshing the property index also reloads configured property types, so icon changes appear after a refresh.
- The plugin description mentions property type icons again without using private Obsidian APIs.

## [1.0.2] - 2026-11-14

### Fixed

- **Open in Search** now closes the temporary pane and shows a clear notice when the core Search plugin is unavailable.

## [1.0.1] - 2026-11-14

### Removed

- Property type icons and the private `metadataTypeManager` integration. Property rows no longer display type icons, and the plugin no longer reads undocumented Obsidian APIs. Value kinds remain visible for non-string values.

### Changed

- Plugin description updated to remove the type-icon claim.

## [1.0.0] - 2026-11-14

Initial public release.

### Added

- Full-pane property tree showing properties, typed values, and the notes that use them.
- Incremental index built from Obsidian's metadata cache, with live updates for edits, creates, deletes, renames, metadata resolution, and property type changes.
- Typed value handling for strings, numbers, booleans, empty values, and nested lists, with cycle protection and per-note deduplication.
- Search across property names, values, note names, and paths, including automatic branch expansion and a dedicated search scope menu.
- Property picker with All / None shortcuts, filtering, and a count for the current selection.
- Saved views (profiles) with create, update, rename, and delete actions.
- Sorting by property name or distinct-note frequency in both directions.
- Pin and hide actions for properties, with hidden properties managed in settings.
- Native Obsidian Search integration, plus copy actions for property queries and matching note links.
- Type icons based on Obsidian's configured property types, with a text fallback and no inference from note contents.
- Accessible controls with labelled buttons, keyboard-operable context menus, focus restoration, and an aria-live summary.
- Settings for note counts, sort order, and hidden properties.
- Release tooling that validates manifest/package/lockfile versions, assets, runtime imports, and local Markdown links.

### Security

- Note content is rendered with `textContent` and is never interpreted as HTML.
- Host APIs that are not part of the public typings are feature-detected and guarded.
- The plugin is read-only and does not write to notes.

### License

- Released under the MIT License. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).

[Unreleased]: https://github.com/ajay126z/supercharged-properties/compare/1.2.1...HEAD
[1.2.1]: https://github.com/ajay126z/supercharged-properties/releases/tag/1.2.1
[1.2.0]: https://github.com/ajay126z/supercharged-properties/releases/tag/1.2.0
[1.1.0]: https://github.com/ajay126z/supercharged-properties/releases/tag/1.1.0
[1.0.3]: https://github.com/ajay126z/supercharged-properties/releases/tag/1.0.3
[1.0.2]: https://github.com/ajay126z/supercharged-properties/releases/tag/1.0.2
[1.0.1]: https://github.com/ajay126z/supercharged-properties/releases/tag/1.0.1
[1.0.0]: https://github.com/ajay126z/supercharged-properties/releases/tag/1.0.0
