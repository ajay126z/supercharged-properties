# Upcoming release: Add and Remove properties

Add typed frontmatter properties or remove whole keys across folders, explorer multi-selections, and the notes behind YAML property/value rows.

- Reuse existing names with native suggestions or the multi-select property picker.
- Choose Text, List, Number, Checkbox, Date, or Date and time; preview up to 20 property additions together.
- Choose Skip, Merge into list, or Overwrite. Set defaults for recursion, conflicts, and list delimiters.
- Review per-note changes before confirming. Apply checks live data and exclusions, reports progress, and skips conflicting keys.
- Undo through the existing shared command or completion screen; conflicting entries remain retryable. YAML comments and quoting may change.

Explorer actions ignore view filters; tree actions retain their scoped paths. No new actions appear in Inline views. Existing single-property editing and inline conversion remain available.

Read the [Add and Remove guide](../ADD-REMOVE-PROPERTIES.md). This feature has not been released; version metadata remains unchanged until release preparation.

Delete property and tree Add/Remove properties now honor active tree search. Their preview scope matches the displayed row count, including matches beyond pagination or inside collapsed branches. Explorer batches and other row-edit scopes retain their existing behavior.

Search everything and Note names / paths now reuse match results during rendering, filter before sorting, and share a natural-sort comparator. Large trees combine typing bursts into one refresh; Enter refreshes immediately. Search matching and deletion scope remain unchanged.

Search results now build offscreen value and note rows as you scroll, yielding between small rendering chunks. Counts and removal previews include the full matching subset; keyboard navigation and range selection load their property branch when needed.
