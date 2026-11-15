# AGENTS.md

## Project

Supercharged Properties is an Obsidian plugin that indexes YAML frontmatter across the vault and renders a full-pane tree of properties, values, and notes. It supports search, sorting, property scoping, saved profiles, pinning, hiding, and native Obsidian Search integration. Browsing is read-only; explicit bulk value and property-name edits use preview, confirmation, conflict checks, and session-scoped one-step undo through public processFrontMatter.

- Plugin ID: `supercharged-properties`
- Runtime entry: `src/main.ts` bundled to `main.js` (CommonJS, ES2020)
- Minimum Obsidian version: `1.7.2` (`manifest.json`, `versions.json`)
- License: `MIT`; full text in `LICENSE`, notices in `NOTICE.md`

## Environment

Use Node 22.13+ or 24+ as declared in `package.json` engines. Node 20 fails to start Vitest 5/rolldown (`node:util` has no `styleText`). If the default `node -v` is older, prepend a supported install, for example:

```sh
export PATH="$HOME/.nvm/versions/node/v24.22.2/bin:$PATH"
```

## Commands

```sh
npm run lint       # ESLint with eslint-plugin-obsidianmd, zero warnings allowed
npm run build      # tsc --noEmit, then esbuild -> main.js
npm test           # Vitest, 13 files / 103 tests
npm run validate   # lint + build + test + release validation
npm run release:prepare  # validate, then stage dist/<version>/ assets
```

Run `npm run lint` and `npm test` after source changes. `npm run build` regenerates the tracked release artifact `main.js`; commit it when behavior changes.

## Architecture and data flow

`onload` (`src/main.ts`) loads preferences from `loadData`, registers the view/commands/settings, and subscribes to vault events. On layout ready it calls `rebuild()`:

1. `PropertyIndex` (`src/index.ts`) maps folded property keys to `PropertyNode`s, each containing typed `ValueNode`s. Every node tracks the set of note paths.
2. `readPropertyValues` (`src/frontmatter-values.ts`) turns raw frontmatter values into typed `{ kind, text }` records. It preserves strings, finite numbers, and booleans, treats null/blank/empty lists as `empty`, ignores unsupported objects, and walks nested lists iteratively with cycle protection.
3. `PropertiesView` (`src/main.ts`) renders the toolbar, picker, profile selector, summary, and tree. Rendering is full-rebuild with scroll/focus restoration.
4. Incremental events (`metadataCache.changed`, vault create/delete/rename) update or remove single notes. Metadata resolution and folder renames schedule a debounced full rebuild (150 ms).

Supporting modules:

- `src/sorting.ts` - sort modes and natural ordering with deterministic ID tie-breaks.
- `src/search.ts` - quotes Obsidian property queries; null/empty uses the `null` operator.
- `src/profiles.ts` - validates and normalizes saved profiles; rejects malformed or duplicate entries.
- `src/property-types.ts` - resolves property type icons from the vault's `types.json` through public adapter APIs, with built-in and text fallbacks.
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

## Tests

Vitest uses `tests/obsidian-stub.ts` for module resolution; individual tests supply `vi.mock('obsidian')` doubles. DOM tests opt into jsdom with `// @vitest-environment jsdom`.

- Pure logic: `index`, `frontmatter-values`, `sorting`, `search`, `profiles`, `property-types`.
- Host lifecycle: `refresh.test.ts` (fake timers, event emitters, save queue).
- UI behavior: `view.test.ts` (jsdom, accessibility labels, menus, profiles, CSS fixture). Set `PV_PREVIEW=/path/out.html` to emit a standalone layout fixture for CSS QA.

When changing accessible labels, menu titles, or DOM classes, update the tests that select by them.

## Release validation

`scripts/validate-release.mjs` enforces matching versions across `manifest.json`, `package.json`, `package-lock.json`, and `versions.json`, MIT licensing, asset presence, no machine-specific paths, no unexpected runtime imports, and no dead relative Markdown links. `scripts/prepare-release.mjs` copies only `main.js`, `manifest.json`, and `styles.css` into a freshly recreated `dist/<version>/`; it does not publish.

License metadata must stay synchronized across `package.json`, `package-lock.json` (root package), `LICENSE`, `NOTICE.md`, the esbuild banner, and SPDX headers in source files. The license check expects the canonical MIT License text in `LICENSE`; do not replace it with a short notice.
