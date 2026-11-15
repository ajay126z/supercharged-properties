# Releasing a Version

This is the command-by-command runbook for publishing a release. [Publishing](PUBLISHING.md) explains the workflow and attestation model; [Release QA](RELEASE-QA.md) covers manual checks in Obsidian.

## Before you start

- Use Node 22.13+, 24.x, or 26+ from `package.json` engines.
- Install and authenticate GitHub CLI for verification: `gh auth login`.
- Start from a clean, up-to-date `main` branch.
- Run manual QA from the build candidate when possible.

```sh
git switch main
git pull --ff-only
npm ci
gh auth status
```

## 1. Update the version

Use the next semantic version for `VERSION`. A patch release is appropriate for fixes that do not add new user-facing features.

```sh
VERSION=1.2.1
npm version "$VERSION" --no-git-tag-version
```

`npm version` updates `package.json` and the root entries in `package-lock.json`. Then update the remaining version files manually:

- `manifest.json`: `version`; update `minAppVersion` only when required.
- `versions.json`: add `"<version>": "<minAppVersion>"` and keep older entries.
- `CHANGELOG.md`: move the `Unreleased` entries under `## [<version>] - YYYY-MM-DD`.
- `docs/releases/<version>.md`: add release notes; this file must exist and be non-empty.
- `docs/README.md`: link the new release notes and update version-specific wording.
- `README.md` and user guides: replace temporary phrases such as "next build" with the release version.

All of these must agree:

| File | Field |
| --- | --- |
| `manifest.json` | `version`, `minAppVersion` |
| `package.json` | `version` |
| `package-lock.json` | root `version` and `packages[""].version` |
| `versions.json` | plugin version mapped to minimum Obsidian version |
| `docs/releases/<version>.md` | release notes |

## 2. Validate and stage assets

```sh
npm run release:prepare
```

This runs lint, TypeScript/build, the full test suite, release validation, and then recreates `dist/<version>/` with only:

```text
main.js
manifest.json
styles.css
```

Review the result before committing:

```sh
git status --short
git diff --check
ls -l "dist/$VERSION"
```

`main.js` is a tracked release artifact. Commit the rebuilt file when source behavior changes. `dist/` is ignored and must not be committed.

## 3. Commit and tag

The tag must equal `manifest.json` `version` exactly, without a `v` prefix.

```sh
git add -A
git commit -m "Release $VERSION: <short summary>"
git tag -a "$VERSION" -m "Supercharged Properties $VERSION"
git push origin main
git push origin "$VERSION"
```

Pushing the tag triggers **Release and attest**. Do not push the tag until the commit contains the final source, rebuilt `main.js`, version metadata, and release notes.

## 4. Watch the workflow

```sh
gh run list --workflow release.yml --limit 5
gh run watch <run-id> --exit-status
```

The workflow installs locked dependencies, validates and builds the tagged source, checks the tag against the manifest, attests the three assets, verifies the attestations, and publishes the release. A successful run creates a non-draft release containing only `main.js`, `manifest.json`, and `styles.css`.

## 5. Verify the published release

Download the published assets and compare them with the staged build:

```sh
VERIFY_DIR=$(mktemp -d)
gh release download "$VERSION" --dir "$VERIFY_DIR" \
  --pattern main.js --pattern manifest.json --pattern styles.css

for asset in main.js manifest.json styles.css; do
  cmp "dist/$VERSION/$asset" "$VERIFY_DIR/$asset"
  gh attestation verify "$VERIFY_DIR/$asset" \
    --repo ajay126z/supercharged-properties
done

gh release view "$VERSION" \
  --json tagName,isDraft,isPrerelease,isImmutable,url,assets
```

Confirm all of the following:

- `cmp` reports no differences for all three assets.
- `gh attestation verify` succeeds for every asset.
- The release is not a draft or prerelease.
- Only the three supported assets are attached.
- The published tag, manifest version, and release title agree.

## 6. After publishing

- Install the release from the community list or the three attached assets and confirm the version shown in Obsidian.
- Keep older `versions.json` entries for users on older Obsidian versions.
- Leave an `Unreleased` section in the changelog for the next cycle.
- Do not delete or replace published tags or assets. Ship a patch release for fixes.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Vitest fails at startup with `node:util` / `styleText` | You are on Node 20. Switch to a supported Node version and rerun. |
| Release validation reports a version mismatch | Sync manifest, package, lockfile, `versions.json`, and release notes, then rerun `npm run release:prepare`. |
| Workflow fails at **Check release version** | The tag and `manifest.json` differ, or the tag has a `v` prefix. Fix before publication; if a release already exists, publish a new patch instead of moving the tag. |
| `gh release create` says the release exists | Do not replace its assets. Publish a new patch version. |
| Attestation verification fails | Verify you downloaded the matching version, then confirm the workflow attested the same commit and assets. Do not re-attest newer source as an older binary. |
| Documentation links fail validation | Fix every relative link after renaming or moving a document. |

Manual workflow dispatch only re-attests an existing release after comparing rebuilt assets byte-for-byte. It never replaces assets or publishes a new release.

## Related documents

- [Publishing and attestation workflow](PUBLISHING.md)
- [Release QA checklist](RELEASE-QA.md)
- [Changelog](../CHANGELOG.md)
- [Contributing](../CONTRIBUTING.md)
- [Project overview](../README.md)
