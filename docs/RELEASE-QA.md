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
- [ ] Number, Checkbox, Date, and Date & time controls preserve YAML types; invalid inputs are blocked and empty values retain the key.
- [ ] List Add preserves existing items/order and avoids new duplicates; Remove deletes exact typed matches and leaves `[]` after the last removal.
- [ ] List previews handle each selected note independently, skip nested/object/mismatched values, and keep aliases/cssclasses text-only.
- [ ] Changing the configured property type after preview prevents the old typed edit from being applied.
- [ ] Remove property is explicit for every supported scalar/list type, shows a destructive preview, and removes keys only after confirmation.
- [ ] Check empty scalars, false/zero, one-item lists, multi-item lists, and empty lists; Remove values still retains `[]` while Remove property deletes the key.
- [ ] Whole-property removal skips ambiguous or stale keys; undo restores original spelling/values and never overwrites recreated case variants.
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

## Value filter (1.4.0)

- Filter a value from its desktop, keyboard, and mobile long-press menus, including `(empty)`. Confirm the filter property disappears and counts shrink.
- Clear and replace filters; confirm separate tabs stay independent and saved views retain their keys.
- Search inside a filter and copy links; confirm outside notes are absent. Core Search queries remain vault-wide.
- Preview and apply a filtered value edit, property rename, and property deletion; confirm outside notes are unchanged, then undo.
- Change or delete the filter value externally; confirm live updates and the clearable zero-note state.
- Check long labels and Clear at narrow widths with the keyboard open.

- For a single Note-A with author AJ, rating 4, and topic design: author AJ must show 1 before filtering, the filter bar must show 1 note, and the summary must show 2 properties · Filtered (1 note). Repeated metadata updates, renaming, and moving the note must retain one matching path.

## Filter note list (1.4.0)

- Expand the count; confirm names, folder labels, numeric-aware sorting, and duplicate-name disambiguation.
- Open notes with click/tap, Ctrl/Cmd-click, and keyboard Enter; missing paths must never create a note.
- With Page preview enabled, check desktop hover according to the configured modifier requirement; touch must not trigger hover previews.
- Load more than 200 notes, verify the full count, and use Show more to reach the remaining notes.
- Move focus and scroll within the list, then edit/rename/delete a matching note; verify stable focus and scroll or sensible fallback.
- Confirm replacement filters and Clear collapse the list. When the underlying Value filter has no matches, returning matches stay collapsed. A temporary zero-result tree search retains disclosure state and restores the open list when matches return.
- Confirm search updates the list and distinct-note count in either action order, while separate tabs retain independent controls. With no tree search, the list shows the full Value filter subset regardless of property selection.
- Check a 320px-wide pane and reduced keyboard height: Clear and the count fit, note rows remain tappable, and the tree retains visible space.

## Mobile tap regression

- In All properties, a custom saved view, and a Value filter, tap a tree note and confirm it opens. Also tap a note in the expandable filter note list.
- Long-press a note: the menu opens without opening the note. Dismiss it and confirm the next short tap opens normally.
- Scroll through notes: no menu or accidental note opening. Confirm tapping a note after scrolling works.
- In note-selection mode, short taps still toggle selection rather than opening notes.

## Search startup regression

- Enable core Search, close/reopen the vault without opening Search, and use Open in Search from a property and value row. Confirm the pane opens with the correct query on desktop and mobile.
- Repeat with an existing Search pane restored in a collapsed sidebar, then with Search already loaded.
- Disable core Search and repeat: show the enable-Search notice and remove only a newly created unusable pane, preserving existing panes.

## Inline properties (1.5.0)

- Enable Show inline properties and choose Inline Properties. Check all three field forms, repeated values, empty fields, wikilinks, comments and code exclusions.
- Confirm YAML values with the same names remain separate, with inline edit menus routed to the inline editor and no note selection controls.
- Check local search, sorting, Copy matching note links, Value filters, and opening notes on desktop/mobile.
- Switch back to a saved YAML view; confirm its keys, expansion, pins, and hidden settings are preserved.
- Edit, rename, move, delete, and exclude notes while indexing; confirm no stale paths reappear. Disable while reads are pending; the option must disappear and the active inline view must return to All properties.
- Confirm loading/failure feedback, forced refresh retries, and no body reads for inline indexing when disabled.


### Inline saved views

- [ ] Create an inline view with a subset of fields; verify it appears as Inline: Name.
- [ ] Modify, update, rename, and delete it without changing YAML saved views or notes.
- [ ] On desktop and mobile, All/None retain the typed name and reject duplicate-all/empty selections.
- [ ] Search and Filter by Value retain saved keys and distinct-note counts.
- [ ] Reload the plugin and verify saved inline views can be selected again.
- [ ] Disable/re-enable inline properties and verify saved inline views are retained.


### Search expansion, counts, and tooltips

- [ ] Search by property, value, everything, and note name/path in YAML and inline saved views; verify distinct matching note counts.
- [ ] Collapse all without clearing search, then expand a property to values and a value to notes. Individual arrows remain enabled.
- [ ] Repeat inside a Value filter, apply search/filter in both orders, clear search, and verify the matching-note list and counts update.
- [ ] Open at least ten saved views in the view picker; verify downward opening, bounded scrolling, wrapped names, and keyboard navigation on desktop and mobile.
- [ ] Turn Show tooltips off/on; check toolbar, tree rows, view picker, and expanded matching-note list. Screen-reader labels and note previews remain available.
- [ ] Reload the plugin and verify the tooltip preference persists.


### View-local pins

- [ ] Pin in All properties and verify inheritance in two saved YAML views.
- [ ] Pin a different property and unpin an inherited property in one view; verify other views and All properties remain unchanged.
- [ ] Reload, rename/update a saved view, and rename a property; verify local pin choices persist.
- [ ] Save a custom selection as a view and verify its local pins carry over.


### Inline editing and display controls

- [ ] Check property/value menus on desktop and mobile: Search, Copy search query, rename/delete property, rename/replace selected values, pin/unpin and hide.
- [ ] Preview a multi-value replacement and confirm only selected values change in the current Value filter's notes.
- [ ] Verify YAML, comments, code examples, CRLF, links and surrounding prose are preserved; unsafe syntax and name collisions are reported as skipped.
- [ ] Change a note after preview and after apply; verify apply/undo skip the changed note.
- [ ] Test separate Undo last inline property edit, local inline pin inheritance and Hidden inline properties settings.
- [ ] Confirm action buttons remain reachable above the keyboard on mobile while reviewing long previews.

## Folder filters and inline conversion (1.5.0)

- Choose folders in YAML and Inline views; confirm child folders match but similarly prefixed folders do not.
- Save an all-properties folder view, switch to a built-in view, and restore the saved view. Verify folder chips and property selections restore independently for each source.
- Combine folder and Value filters; clear each independently. Check counts, copied links, and edit previews against the expected notes.
- Exclude or delete a selected folder. Verify its chip stays muted and an empty scope reports no notes in selected folders.
- On mobile, check chip wrapping, the fuzzy folder chooser, and Save/Update reachability while the keyboard is open.
- Convert repeated inline fields with Move and Keep; preview Skip/Merge/Overwrite conflicts. Confirm code/comments and notes outside the filter are untouched.
- Undo a conversion and verify both YAML and body fields. Edit a note after preview or apply and verify conflict protection and the reported result.
- Verify inline rename/delete uses **Undo last inline property edit**, while conversion uses **Undo last property edit**. Both undo slots reset on reload.

- Folder-filter UI follow-up: verify folder paths and Clear appear only inside Choose properties to show in YAML and Inline views; closing the panel keeps filtering, saved-view state, and summary counts active.

## Add and Remove properties (upcoming)

- Right-click a folder and a multi-selection containing overlapping folders/files. Confirm scope counts, excluded/non-Markdown counts, and the subfolder toggle.
- Launch from a YAML property and value with Folder and Value filters active; verify only derived notes are in the preview. Confirm no new Inline menu entries.
- On desktop and a physical mobile device, test native suggestions with 50 names and 20 values; scroll, select, dismiss with Escape, and replace a token in the middle of a list.
- Choose existing keys with different configured types. Confirm casing, type, in-scope counts, disabled reserved keys, and focus in the value field. Test type-menu reset and Back preserving form inputs.
- At 360 px with the keyboard open, verify row controls and fixed-footer actions remain reachable. Test Ctrl/Cmd+Enter and Enter-to-add-row without accepting a suggestion twice.
- Preview more than 200 notes, reveal additional pages, apply with progress, then undo. Edit one targeted key between preview/apply and between apply/undo; verify skips and a successful retry after resolving the undo conflict.
- Keep a note outside the scope open and confirm its bytes remain untouched. Confirm ordinary selected-note edits and inline-to-YAML conversion still share the correct undo behavior.

## Manual property order

- [ ] Select Manual after each automatic sort: rows stay in place on first use, and previous orders return on later use.
- [ ] Drag with mouse and touch; check insertion line, edge autoscroll, pointer cancellation, Escape, and no accidental click after a drop.
- [ ] Tab to a grip, use arrows/Home/End, and check focus plus screen-reader position announcements. Test Alt+arrows on a property name.
- [ ] Confirm pinned-group boundaries, disabled menu moves, and long-press menus on mobile.
- [ ] Reorder under search, hidden properties, Folder filters and Value filters; clear them and verify hidden keys retain relative order.
- [ ] Check base/custom/saved order inheritance, Save new/Update/Delete, source switches, reset, and persistence after reload.
- [ ] Verify values/notes remain A–Z in Manual and all automatic sorts retain their existing behavior.
- [ ] Check a 360px sidebar, 36px touch grips, ordinary scrolling outside grips, reduced-motion mode, and a large property list.

- [ ] Done hides grips and retains Manual; Cancel restores each of the four automatic sorts and the pre-session layer order. Reopen arranging after Done and reload; check saved-view inheritance is restored on Cancel.
