# Contributing to Supercharged Properties

Thanks for helping improve Supercharged Properties. This guide covers local setup, the project conventions, and what to check before opening a pull request.

## Prerequisites

- Node **22.13+**, **24+**, or **26+** (see `engines` in `package.json`). Node 20 cannot start the current Vitest toolchain.
- npm.
- An Obsidian vault for manual testing.

## Setup

```sh
npm install
npm run build
```

To try a local build, create `<YourVault>/.obsidian/plugins/supercharged-properties/` and copy `main.js`, `manifest.json`, and `styles.css` into it. Reload Obsidian and enable the plugin under **Settings → Community plugins**.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run lint` | ESLint with `eslint-plugin-obsidianmd`; zero warnings allowed. |
| `npm test` | Vitest suite covering pure logic, plugin lifecycle, and the view. |
| `npm run build` | Type-check with `tsc --noEmit`, then bundle `src/main.ts` to `main.js`. |
| `npm run validate` | Lint, build, test, and run release validation. |
| `npm run release:prepare` | Validate, then stage release assets in `dist/<version>/`. |

Run `npm run lint` and `npm test` before submitting changes. If behavior changes, rebuild `main.js` and include it in the commit because it is the tracked release artifact.

## Project layout

```text
src/main.ts              Plugin entry, view rendering, commands, settings
src/index.ts             Property index and folding
src/frontmatter-values.ts Typed value reader for frontmatter
src/property-types.ts   Public property-type icon resolver
src/sorting.ts           Sort modes and natural ordering
src/search.ts            Obsidian property query builder
src/profiles.ts          Saved-view validation and comparison
styles.css               View styling, prefixed with pv-
tests/                   Vitest suites and host doubles
scripts/                 Release validation and asset preparation
docs/                    Publishing, QA, and release notes
```

## Design rules

- **Explicit writes only.** Browsing uses the metadata cache. Bulk value writes require a full preview and confirmation, must skip stale values, and retain a conflict-aware undo snapshot. Use the public frontmatter API.
- **Never interpret note content as HTML.** Use `textContent` and the `el()` helper rather than `innerHTML`.
- **Guard host internals.** APIs such as the Search view's `setQuery` are not part of the public typings; feature-detect and wrap them in `try/catch`.
- **Use public property-type data.** Resolve type icons from `types.json`, built-in property names, or the text fallback. Do not use `metadataTypeManager` or other private type registries.
- **Keep identity stable.** Property keys are trimmed, NFC-normalized, and case-folded. Value identity combines the value kind and folded text so types and complete wiki links stay distinct.
- **Count notes, not assignments.** A note contributes at most one count per row.
- **Serialize settings writes.** Use the plugin's `save()` method instead of calling `saveData` directly.
- **No new runtime dependencies.** The release validator requires the production bundle to import only `obsidian`.
- **Use theme variables.** New CSS should use Obsidian variables and keep the `pv-` prefix.

## Tests

Tests use Vitest. `tests/obsidian-stub.ts` resolves the `obsidian` module during test startup, and individual suites provide doubles with `vi.mock('obsidian')`. DOM tests opt into jsdom with `// @vitest-environment jsdom`.

- Add pure-logic tests for index, value parsing, sorting, search, profiles, and property types.
- Add lifecycle tests for event handling, rebuild debouncing, persistence, and cleanup.
- Add view tests for interaction changes. Tests select controls by accessible labels, menu titles, and CSS classes, so update them when those change.
- To generate a standalone CSS fixture, set `PV_PREVIEW=/path/to/out.html` when running the view tests.

## Accessibility

The view should remain usable with a keyboard and a screen reader:

- Every icon-only button needs an `aria-label` or title.
- Preserve focus across re-renders.
- Keep menus reachable through Shift+F10 and the Context Menu key.
- Maintain visible focus styles and the live summary announcement.
- Check coarse-pointer sizing when changing row controls.

## Documentation

Update the relevant documentation when behavior, settings, or commands change:

- [README.md](README.md) for user-facing features and installation.
- [CHANGELOG.md](CHANGELOG.md) for notable changes.
- [docs/RELEASING.md](docs/RELEASING.md) for the release runbook, [docs/PUBLISHING.md](docs/PUBLISHING.md) for the workflow and attestations, and [docs/RELEASE-QA.md](docs/RELEASE-QA.md) for manual checks.
- `docs/releases/<version>.md` for release notes.

Release validation checks relative Markdown links, so renaming a document requires updating every reference.

## Versioning

A release updates all of these files together:

- `manifest.json` — `version` and, when applicable, `minAppVersion`.
- `package.json` — `version`.
- `package-lock.json` — root `version` and package version.
- `versions.json` — map the plugin version to its minimum Obsidian version.
- `docs/releases/<version>.md` — release notes.

`npm run validate` fails if they disagree.

## Pull requests

- Keep changes focused and explain the user-visible behavior.
- Include tests for logic and interaction changes.
- Run `npm run validate` when you touch source, build output, or release files.
- Note any manual QA performed in Obsidian, especially on mobile.
- Do not commit generated `dist/` content; it is ignored.

## License

By contributing, you agree that your contributions are licensed under the MIT License, the same license as this project. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).
