# Changelog

All notable changes to Supercharged Properties are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.6.1] - 2026-11-28

### Documentation

- Explain vault enumeration, exclusions, optional attachment-path counting, and user-triggered write-only clipboard access, including security scanner recommendations.

### Fixed

- Replace clip-path in screen-reader-only announcements with legacy rectangular clipping for compatibility.
- Remove the globalThis type reference from progressive search rendering while retaining owner-window observers and animation frames for popouts.

## [1.6.0] - 2026-11-28

### YAML tags and removal selection

- Support adding YAML tags as a List with Skip, Merge, and Overwrite, and add Select none to clear all removal selections.
- Allow Remove properties to delete the entire YAML tags property, with preview, conflict checks, and undo; body tags remain unchanged.

### Changed

- Selecting Manual restores the saved or inherited order without opening reorder controls. Use Reorder properties… explicitly to arrange rows; first use falls back to the inherited order or A–Z.

### Fixed

- Keep folder-filtered property pickers limited to properties found in the selected folders, without restoring unrelated saved keys as visible choices. Saved selections remain intact.

- Keep view-dropdown property counts independent of the active profile’s filters. All properties counts the full source; each YAML or Inline profile counts its own selected keys and folders. Temporary search and Value filters do not affect dropdown counts.

- Keep reorder gestures stable across background refreshes and progressive search rendering. Accept drops in the empty area below the final property; reject drops outside the pane or across pinned groups.

- Speed up Search everything and Note names/paths by reusing natural collation, caching repeated matches per render, and filtering before sorting. Coalesce typing bursts for large trees without allowing stale tree actions. Render search branches near the viewport in small chunks, preserving full counts, edit scopes, keyboard navigation, and range selection.

- Limit Delete property and tree Add/Remove properties to the active search matches, reusing displayed row-count semantics and preserving notes outside the searched subset.

- Improve Add/Remove preview readability with theme-matched text and neutral backgrounds, using colored edge markers and plus/minus signs to distinguish changes.

### Added

- Manual property sorting with pointer/touch drag handles, context-menu moves, keyboard controls, and position announcements. Done keeps the order and hides controls; Cancel restores the pre-session order and last automatic sort. Order is saved per YAML/Inline base, custom selection, and saved view; pinned groups remain separate and values/notes use A–Z.

- Separate Add and Remove properties workflows for explorer folders, multi-selections, and scoped YAML property/value rows.
- Compact typed rows, native name/value suggestions, existing-property picker, in-scope counts, and removal selection with filtering.
- Skip, Merge into list, and Overwrite defaults; configurable recursion and list delimiter; per-note previews with progressive disclosure.
- Plan-based sequential writes, progress, per-key drift checks, and retryable shared session undo.
- Optional File explorer folder counts with direct, recursive, and combined modes, zero hiding, attachment counting, optional global exclusions, and a command-palette toggle. Counts are independent of property filters and include notes without properties.
- Lifecycle and DOM integration coverage for startup, live changes, exclusions, additional panes, cleanup, failure isolation, accessibility, and saved settings.

## [1.5.1] - 2026-11-21

### Fixed

- Sort wikilink values by resolved note basename (or cleaned link target when unresolved), and expanded notes by filename with full-path tie-breakers, in A–Z and Z–A modes. Preserve original display/edit values and frequency ordering.

### Changed

- Keep folder chips and Clear inside Choose properties to show, removing the persistent folder-path bar from YAML and Inline views while retaining filtering and summary counts.

## [1.5.0] - 2026-11-20

### Folder filters

- Add per-view folder include lists to YAML and Inline views, with fuzzy folder selection, removable chips, a Clear action, and saved-view persistence.
- Intersect folder and Value filters for the tree, distinct-note counts, copied links, bulk edits, and inline-to-YAML conversion; global excluded folders always win.
- Allow all-properties views with folders, compare normalized folders for modified state, and clear folders when selecting built-in or legacy views.
- Retain missing/excluded folder chips and show an empty-folder message. Folder renames do not rewrite saved paths.
- Keep native Search vault-wide and tree search display-only; conversion now uses the explicit folder filter rather than note/path search to limit folders.


### Conversion to YAML

- Add **Convert to YAML property…** to inline property/value menus, including mobile long-press.
- Support selected notes, Move/Keep, literal text or optional detection, repeated-field lists, and Skip/Merge/Overwrite conflicts.
- Honor Value filters, folder filters, and excluded folders; preview changes and removed source fragments before confirmation.
- Share the YAML editor busy guard and undo slot for conversion, protect changed notes, and retain recovery snapshots for partial writes.


### Fixed

- Keep pin/unpin choices local to each YAML saved view or custom selection, while inheriting pins from All properties. Persist local overrides and preserve them through property renames.

- After Collapse all in note/path search results, expand properties to values first, then expand values to notes. New searches still reveal matching branches automatically.

- Show distinct search-matching note counts on property and value rows in YAML and inline views, including inside Value filters.

- Keep Value filter note lists and counts synchronized with tree search regardless of whether search or filtering is applied first.

- Enable individual property and value expanders in search results, including within Value filters and after Collapse all.

- Preserve search results when collapsing or expanding all properties in YAML and inline views, including saved views and Value filters.

- Open the view picker below the toolbar with viewport-bounded scrolling, wrapped names, and keyboard navigation, avoiding native dropdowns that open upward and hide views.

- Recognize inline properties and link values inside nested lists and indented list continuations, while continuing to exclude fenced and indented code.

### Added

- Inline property/name deletion and renaming, multi-value replacement with one text value, complete note previews, conflict-checked writes, and separate session undo. Inline text Search queries, source-specific pins with view-local overrides, and hidden-inline-property settings.

- Show tooltips setting, enabled by default, to hide property-browser hover hints while preserving screen-reader labels and note previews.

- Saved inline property views with source-specific selections, Save/Update/Rename/Delete controls, persistent settings, and search and Value filter support. Built-in Inline Properties remains protected and saved inline views stay separate from YAML views.

- Optional Show inline properties setting and separate Inline Properties view with read-only browsing and explicit edit actions. Browse literal Dataview-style fields as property → value → notes, with local search, sorting, distinct-note counts, copied links, and Value filters. Excluded folders apply; YAML views and editing remain separate. Background reads are bounded and discard outdated results.

## [1.4.2] - 2026-11-18

### Fixed

- Wait for the core Search pane to load before applying Open in Search queries, avoiding the incorrect enable-Search notice when the vault has just opened.

- Restore mobile note taps in all, custom, and filtered property views. A touch pointer leaving after release no longer suppresses its click; long-press and scroll gestures still prevent accidental opening.

## [1.4.1] - 2026-11-17

### Changed

- Rename the value-filter menu action to **Filter by Value**.
- Update the README, user guide, and demo GIF to use the new label.

## [1.4.0] - 2026-11-17

### Fixed

- Wrap the Value filter label so long property names and values remain visible on mobile and narrow panes; move the note-count and Clear buttons to the next line when needed.

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

[Unreleased]: https://github.com/ajay126z/supercharged-properties/compare/1.4.2...HEAD
[1.4.2]: https://github.com/ajay126z/supercharged-properties/releases/tag/1.4.2
[1.4.1]: https://github.com/ajay126z/supercharged-properties/releases/tag/1.4.1
[1.4.0]: https://github.com/ajay126z/supercharged-properties/releases/tag/1.4.0
[1.3.0]: https://github.com/ajay126z/supercharged-properties/releases/tag/1.3.0
[1.2.1]: https://github.com/ajay126z/supercharged-properties/releases/tag/1.2.1
[1.2.0]: https://github.com/ajay126z/supercharged-properties/releases/tag/1.2.0
[1.1.0]: https://github.com/ajay126z/supercharged-properties/releases/tag/1.1.0
[1.0.3]: https://github.com/ajay126z/supercharged-properties/releases/tag/1.0.3
[1.0.2]: https://github.com/ajay126z/supercharged-properties/releases/tag/1.0.2
[1.0.1]: https://github.com/ajay126z/supercharged-properties/releases/tag/1.0.1
[1.0.0]: https://github.com/ajay126z/supercharged-properties/releases/tag/1.0.0
