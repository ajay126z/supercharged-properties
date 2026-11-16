# Release QA

Run this checklist against a build candidate before publishing. Automated checks are necessary but not sufficient: verify the plugin in Obsidian on desktop, and on mobile when possible.

## Test setup

- [ ] Use a disposable vault or a backed-up vault with a mix of notes.
- [ ] Include notes with strings, numbers, booleans, dates, lists, nested lists, wiki links, empty values, and unsupported object values.
- [ ] Include at least one large note set (a few thousand notes) when checking performance.
- [ ] Confirm the build was produced from the release source and `main.js` is current.

## Automated checks

- [ ] `npm run lint` passes with zero warnings.
- [ ] `npm test` passes all suites.
- [ ] `npm run validate` passes.
- [ ] `npm run release:prepare` creates `dist/<version>/` with the expected files.
- [ ] Only `main.js`, `manifest.json`, and `styles.css` are staged and attached.
- [ ] GitHub Actions succeeds and `gh attestation verify` verifies each downloaded asset.
- [ ] The release tag equals `manifest.json` `version`, without a `v` prefix.

## Installation and startup

- [ ] Enable the plugin in a vault that did not previously have it installed.
- [ ] The plugin loads without console errors.
- [ ] The ribbon icon opens the sidebar.
- [ ] **Open sidebar** and **Open in tab** commands work.
- [ ] **Refresh property index** rebuilds without errors.
- [ ] Reloading Obsidian restores the previously saved settings.

## Indexing

- [ ] Every expected YAML property appears.
- [ ] `Status` and `status` share one row.
- [ ] Note counts reflect distinct notes, not repeated values.
- [ ] Strings, numbers, booleans, empty values, and nested lists remain distinct.
- [ ] Wiki links with aliases are not merged when their targets differ.
- [ ] Unsupported object values do not crash the view; their notes remain reachable.
- [ ] The Obsidian cache `position` field is not shown as a property.

## Property type icons

- [ ] Configured types show matching icons: text, list, tags, number, checkbox, date, and date & time.
- [ ] Properties without a configured type fall back to text.
- [ ] `tags`, `aliases`, and `cssclasses` use built-in types.
- [ ] Changing a property type and refreshing the index updates its icon.
- [ ] A missing or malformed `.obsidian/types.json` leaves the text fallback without errors.
- [ ] Type icons appear only on property rows, not value rows.

## Live updates

- [ ] Editing frontmatter updates values and counts.
- [ ] Removing a property from a note removes the note from that row.
- [ ] Creating a note adds it after metadata is available.
- [ ] Deleting a note removes its contributions.
- [ ] Renaming a note moves its contributions to the new path.
- [ ] Renaming a folder rebuilds the index.
- [ ] Rapid edits do not leave stale values or duplicate counts.

## Search

- [ ] Search finds property names, values, note names, and paths.
- [ ] Scope switching between everything, property names, values, and notes behaves correctly.
- [ ] Matching branches expand automatically.
- [ ] Clearing search restores the previous tree without stale filtering.
- [ ] Hiding search clears the filter and returns focus to the toggle.
- [ ] Escape closes search and clears the filter.
- [ ] Search text with quotes, backslashes, and newlines does not break query actions.

## Property picker and saved views

- [ ] **All** and **None** update the selection without clearing the typed view name on desktop or mobile.
- [ ] All → Save new shows “All properties View already exists.”; None → Save new shows “Please select at least one property.” The name remains available for retry.
- [ ] Update rejects empty/all selections without modifying the saved view; Enter uses the same Save new validation.
- [ ] All switches to the default view and disables Update/Rename/Delete without deleting any existing saved views.
- [ ] The picker filter narrows the list without changing the tree query.
- [ ] The picker keeps its filter and focus during live index updates.
- [ ] Saving a new view records the current selection.
- [ ] Switching views restores the saved selection.
- [ ] A modified active view is marked as modified.
- [ ] **Update** replaces the active view with the current selection.
- [ ] **Rename** changes the name and rejects blank or duplicate names.
- [ ] **Delete** removes the active view without affecting notes.
- [ ] A view referencing a currently absent property preserves that key and shows the property once it appears.
- [ ] All / None apply to every property, not only filtered results.

## Sorting, pinning, and hiding

- [ ] All four sort modes work: name A–Z, name Z–A, frequency high to low, frequency low to high.
- [ ] Frequency ties fall back to alphabetical order.
- [ ] The sort button reflects the active order.
- [ ] Pinning moves a property to the top and shows a pin marker.
- [ ] Unpinning restores the normal order.
- [ ] Hiding removes a property from the tree and the settings entry restores it.
- [ ] Hidden properties are excluded from profile and selection counts.

## Row interactions

- [ ] Property rows expand and collapse.
- [ ] Value rows reveal and hide their notes.
- [ ] Note rows open on click; Ctrl/Cmd-click opens a new tab.
- [ ] Long names, paths, and Unicode text truncate without breaking layout.
- [ ] **Show more** appears for large value and note lists and pages correctly.
- [ ] Expand all and collapse all follow the current selection and search state.

## Context menu and Search integration

- [ ] Right-click opens the row menu.
- [ ] Shift+F10 and the Context Menu key open the same menu.
- [ ] **Open in Search** opens the core Search view with a property query.
- [ ] Disabling the core Search plugin produces a helpful notice, leaves no empty pane, and does not break the property tree.
- [ ] **Copy search query** copies a correctly quoted query.
- [ ] **Copy matching note links** copies wiki links for every matching note.
- [ ] Empty-value searches explain the local empty-row approximation.

## Bulk value edits

- [ ] Rename, merge, and wikilink conversion show full previews and require confirmation.
- [ ] Split appears for text values under Text properties, including default unconfigured text properties.
- [ ] Split is absent for List, Number, Checkbox, Date, Date & Time, tags, aliases, and cssclasses properties, even when stored values look like text.
- [ ] Built-in tags, aliases, and cssclasses remain ineligible with a Text override.
- [ ] Non-text and complete-wikilink value rows do not offer Split.
- [ ] Split changes only scalar strings, honors the literal delimiter, trims parts, and requires at least two nonempty parts.
- [ ] Lists already stored under a Text property are not split again.
- [ ] Stale previews and changed property types cannot apply unsupported splits.
- [ ] Partial failures preserve undo for successful writes; later edits survive undo.

## Excluded folders

- [ ] Excluding Templates removes its notes and descendants from properties, counts, and copied links; similarly named sibling folders remain included.
- [ ] Changing and clearing the setting updates the tree immediately and persists after reload.
- [ ] Create, edit, note moves, and folder renames respect exclusions.
- [ ] Existing bulk previews skip newly excluded notes when applied; undo of earlier edits still works.
- [ ] Obsidian Search remains independent of folder exclusions, as documented.

## Property-name renaming

- [ ] Property-row menus offer Rename property via mouse and keyboard.
- [ ] Preview shows every eligible note and every conflict separately.
- [ ] Blank names and reserved metadata names cannot be applied; exact no-ops do not write.
- [ ] Case-only renames restore original spelling on undo.
- [ ] Lists, maps, null, boolean, numeric, and text values retain their types.
- [ ] Destination collisions and ambiguous source keys are skipped, including collisions introduced after preview.
- [ ] Later edits survive undo; failed and skipped entries can be retried.
- [ ] Value edits and property-name renames share a single undo slot.
- [ ] Saved views, selections, pins, expansion, and hiding carry to the new key while retaining the old key.
- [ ] Configured property types remain unchanged; the dialog explains the limitation.

## Accessibility

- [ ] Every icon-only control has a meaningful accessible name.
- [ ] Keyboard focus is visible.
- [ ] Focus returns to the same control after a re-render.
- [ ] Controls are reachable and operable without a mouse.
- [ ] Expand/collapse state is exposed with `aria-expanded`.
- [ ] The summary updates and is announced through the live region.
- [ ] Zooming to 200% does not hide essential controls.
- [ ] Coarse-pointer and mobile layouts keep touch targets usable.

## Performance and resilience

- [ ] Opening the view on a large vault remains responsive.
- [ ] Typing in search does not noticeably lag.
- [ ] Expanding large branches does not freeze the app.
- [ ] Repeated metadata events are debounced rather than causing constant rebuilds.
- [ ] A failed settings write shows a notice and later saves still work.
- [ ] Malformed saved settings fall back to defaults instead of breaking startup.
- [ ] Disabling the plugin removes its listeners and pending timers.

## Mobile

- [ ] At widths 320, 390, and 430 pixels, open the picker without automatically opening the keyboard.
- [ ] Focus Profile name with the keyboard open; scroll to reach every action without horizontal overflow.
- [ ] Save a new view using Save new and Done/Enter; verify Rename and Update still act on the active view.
- [ ] Blank/duplicate names preserve the input; IME composition does not submit prematurely.
- [ ] Verify on actual iOS and Android: keyboard open/close, rotation, viewport panning, and sidebar versus tab presentation.
- [ ] Dismissing the keyboard restores available height; closing the view removes viewport listeners.

- [ ] The view opens and scrolls correctly.
- [ ] Search, picker, profile, and sort controls are reachable.
- [ ] Row and icon controls meet touch-target expectations.
- [ ] Context menus work through long-press or the host equivalent.
- [ ] Note opening and Ctrl/Cmd-equivalent behavior are sane.

## Selected-note editing

- [ ] Right-click an editable note on desktop and long-press it on mobile; both expose Change property and Select notes actions.
- [ ] Long-press does not open the note; scrolling cancels a pending long-press.
- [ ] Selection checkboxes and row highlights remain synchronized on desktop and mobile.
- [ ] Alt/Option-click toggles notes, Shift-click adds ranges, Shift+Up/Down adds focused notes, and Escape clears selection.
- [ ] Plain desktop clicks clear multi-selection and open notes; Ctrl/Cmd-click opens a new tab. Mobile taps toggle notes while selection mode is active.
- [ ] Selection stays within one property. Range selection includes only displayed rows, and search/scope changes clear selection.
- [ ] Existing, custom, and empty destinations update only selected paths; literal `empty` remains text, while Set empty retains the key with null.
- [ ] Preview reports unsupported values, missing/ambiguous keys, exclusions, and unchanged notes; stale notes and type changes are skipped before writing.
- [ ] Undo restores successful selected-note changes and preserves later edits; zero-write batches retain the previous undo.
- [ ] The mobile dialog opens at a usable height for one and many notes, its preview scrolls, and focused inputs and actions remain visible above the keyboard.
- [ ] Closing the keyboard restores the dialog height, and closing the dialog removes its viewport listeners.

## Documentation and licensing

- [ ] [README.md](../README.md) matches the shipped behavior.
- [ ] [CHANGELOG.md](../CHANGELOG.md) describes the release.
- [ ] The release notes in [docs/releases/](releases/) describe the release.
- [ ] `LICENSE` contains the MIT License text and the project is identified as MIT.
- [ ] [NOTICE.md](../NOTICE.md) lists third-party notices.
- [ ] Relative documentation links resolve.
- [ ] The plugin description, author, and minimum app version are correct in the community list.

## Sign-off

| Field | Value |
| --- | --- |
| Version | |
| Obsidian version | |
| Platform | |
| Reviewer | |
| Date | |
| Result | Pass / Fail |
| Notes | |
