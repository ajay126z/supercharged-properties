# AGENTS.md

## Project

Supercharged Properties is an Obsidian plugin that indexes YAML frontmatter across the vault and renders a full-pane tree of properties, values, and notes. It supports search, sorting, property scoping, saved profiles, pinning, hiding, and native Obsidian Search integration. Browsing is read-only; explicit bulk value, property-name, and deletion edits use preview, confirmation, conflict checks, and session-scoped one-step undo through public processFrontMatter.

- Plugin ID: `supercharged-properties`
- Runtime entry: `src/main.ts` bundled to `main.js` (CommonJS, ES2020)
- Minimum Obsidian version: `1.7.2` (`manifest.json`, `versions.json`)
- License: `MIT`; full text in `LICENSE`, notices in `NOTICE.md`

## Environment

Use Node 22.13+, 24.x, or 26+ as declared in `package.json` engines. The default shell may be Node 20; Vitest 5/rolldown then fails at startup because `node:util` has no `styleText`. Check `node -v` and prepend a supported install, for example:

```sh
export PATH="$HOME/.nvm/versions/node/v24.22.2/bin:$PATH"
```

## Commands

```sh
npm run lint       # ESLint with eslint-plugin-obsidianmd, zero warnings allowed
npm run build      # tsc --noEmit, then esbuild -> main.js
npm test           # Vitest, 17 files / 137 tests
npm test -- tests/view.test.ts             # one suite
npm test -- tests/search.test.ts -t quotes # one test by name
npm run validate   # lint -> build -> test -> release validation
npm run release:prepare  # validate, then stage dist/<version>/ assets
```

Run `npm run lint` and `npm test` after source changes. `npm run build` regenerates the tracked release artifact `main.js`; commit it when behavior changes. `dist/` is ignored and should not be committed. There is no PR CI; `.github/workflows/release.yml` runs only on version tags or manual dispatch. ESLint ignores `tests/`, `scripts/`, and `*.mjs`/`*.mts`, and `tsc --noEmit` includes only `src/`, so tests are not linted or type-checked.

## Architecture and data flow

`onload` (`src/main.ts`) loads preferences from `loadData`, registers the view/commands/settings, and subscribes to vault events. On layout ready it calls `rebuild()`:

1. `PropertyIndex` (`src/index.ts`) maps folded property keys to `PropertyNode`s, each containing typed `ValueNode`s. Every node tracks the set of note paths.
2. `readPropertyValues` (`src/frontmatter-values.ts`) turns raw frontmatter values into typed `{ kind, text }` records. It preserves strings, finite numbers, and booleans, treats null/blank/empty lists as `empty`, ignores unsupported objects, and walks nested lists iteratively with cycle protection.
3. `PropertiesView` (`src/main.ts`) renders the toolbar, picker, profile selector, summary, and tree. Rendering is full-rebuild with scroll/focus restoration.
4. Incremental events (`metadataCache.changed`, vault create/delete/rename) update or remove single notes. Metadata resolution and folder renames schedule a debounced full rebuild (150 ms); view rendering is separately debounced (100 ms).

Bulk edits flow through `ValueEditor.preview()` -> modal confirmation -> `apply()`, then `rebuild()`. The preview includes every matching note in included folders even when search or property scope hides it. `apply()` re-checks the original value inside `processFrontMatter`, so notes changed after preview are skipped rather than overwritten. One successful batch replaces the session-scoped undo snapshot; undo also skips later conflicting edits. Property renames additionally skip folded-key collisions and reject the reserved `position` key. Value deletion removes a scalar key or matching list entries; property deletion removes the key from every eligible note and re-checks folded-key ambiguity at apply time. Property deletion preserves selection, profile, pin, expansion, and hidden references for undo. Value deletions that remove the whole key skip folded-key ambiguity in preview and at apply time; undo restores a deleted key only while no folded matching key exists.

Supporting modules:

- `src/mobile-layout.ts` - fits touch views to the visual viewport while the keyboard is open, with listener cleanup on view close.
- `src/sorting.ts` - sort modes and natural ordering with deterministic ID tie-breaks.
- `src/search.ts` - quotes Obsidian property queries; null/empty uses the `null` operator.
- `src/profiles.ts` - validates and normalizes saved profiles; rejects malformed or duplicate entries.
- `src/folder-exclusions.ts` - parses newline-separated vault paths; matching is case-sensitive, includes descendants, and is not glob-based.
- `src/property-types.ts` - resolves property type icons from the vault's `types.json` through public adapter APIs, with built-in and text fallbacks. `supportsTextSplit` gates the text-only Split edit.
- `src/value-operations.ts` - pure frontmatter transforms for rename, merge, wikilink, split, and delete edits.
- `src/property-rename.ts` - property-name validation, folded collision checks, and preference carry-over after a rename.
- `src/value-editor.ts` - preview/apply/undo over public `processFrontMatter`, including property deletion, with a busy guard that rejects overlapping batches.
- `src/value-dialog.ts`, `src/property-rename-dialog.ts`, `src/property-delete-dialog.ts` - preview and confirmation modals.
- `styles.css` - all view styling, using Obsidian theme variables. Keep selectors prefixed with `pv-`.

## Conventions

- Property keys are normalized with `fold` (trim, NFC, lowercase). Value identity is `JSON.stringify([kind, foldedText])` so types and complete wiki links stay distinct.
- Counts are distinct notes, not value assignments. One note contributes at most one count per row.
- Prefer `textContent` and `el()` helpers. Never inject note content as HTML.
- Host APIs that are not in the public typings (for example the Search `setQuery`) must be feature-detected and guarded with `try/catch`.
- Property type icons must come from public APIs (`types.json`, built-in names, or `text`). Do not use `metadataTypeManager`, `registeredTypeWidgets`, or similar private registries.
- Settings writes are snapshotted and serialized through `saveQueue`; do not call `saveData` directly elsewhere.
- Keep code under `src/` strict TypeScript, no runtime dependencies beyond `obsidian`. The release validator asserts the production bundle imports only `obsidian`.
- Use SPDX-style comments in new source files where the surrounding file already does; `src/frontmatter-values.ts` carries the MIT header.
- Saved views are managed in `PropertiesView`, not `profiles.ts`. The built-in **All properties** view cannot be renamed or deleted; new or updated views require a non-empty, non-All selection, and **All properties** is a reserved name.
- User-visible changes also update `README.md`, `CHANGELOG.md`, and the relevant `docs/` guide. Release validation fails on dead relative Markdown links, so renamed docs need every reference updated.

## Tests

Vitest aliases `obsidian` to the empty `tests/obsidian-stub.ts`; each suite that touches the host supplies its own `vi.mock('obsidian')` doubles. `tests/dom-helpers.ts` runs as a setup file and shims Obsidian's `createEl`/`createDiv`/`createSpan` for jsdom tests, which opt in with `// @vitest-environment jsdom`.

- Pure logic: `index`, `frontmatter-values`, `sorting`, `search`, `profiles`, `property-types`, `folder-exclusions`.
- Edit behavior: `value-editor.test.ts`, `property-rename.test.ts`, and `property-delete.test.ts` exercise previews, conflict skips, and undo with fake app/file doubles.
- Host lifecycle: `refresh.test.ts` (fake timers, event emitters, save queue).
- Mobile viewport: `mobile-layout.test.ts` (jsdom, fake `visualViewport`, resize/scroll/focus events, cleanup).
- UI behavior: `view.test.ts`, `value-dialog.test.ts`, `property-rename-dialog.test.ts`, `property-delete-dialog.test.ts` (jsdom, accessible labels, menus, profiles, CSS fixture). Set `PV_PREVIEW=/path/out.html` to emit a standalone layout fixture for CSS QA.

When changing accessible labels, menu titles, or DOM classes, update the tests that select by them.

## Release validation and publishing

`scripts/validate-release.mjs` enforces matching versions across `manifest.json`, `package.json`, `package-lock.json` (including root `packages[""]`), `versions.json`, and a non-empty `docs/releases/<version>.md`, plus MIT licensing, asset presence, no machine-specific paths, no unexpected runtime imports, and no dead relative Markdown links. `scripts/prepare-release.mjs` copies only `main.js`, `manifest.json`, and `styles.css` into a freshly recreated `dist/<version>/`; it does not publish.

The release workflow triggers on bare version tags such as `1.2.0`, not `v1.2.0`, and fails if the tag differs from `manifest.json`. A tag push builds, attests, and publishes a draft-then-latest release containing only the three assets. Manual dispatch only re-attests an existing release after byte-comparing rebuilt assets; it never replaces assets or tags. Do not delete or rewrite published tags/assets; ship a patch release instead.

License metadata must stay synchronized across `package.json`, `package-lock.json` (root package), `LICENSE`, `NOTICE.md`, the esbuild banner, and SPDX headers in source files. The license check expects the canonical MIT License text in `LICENSE`; do not replace it with a short notice.
