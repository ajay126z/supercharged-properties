# Publishing Supercharged Properties

This document describes how to prepare and publish a release. Local scripts stage and validate files. Pushing a version tag triggers the GitHub Actions workflow that builds, attests, and publishes the release.

## Before the first release

1. Ensure the repository is public and contains the plugin at its root.
2. Confirm `manifest.json` has a stable plugin ID, a description ending in a period, and the correct author and minimum Obsidian version.
3. Confirm [README.md](../README.md), [LICENSE](../LICENSE), [NOTICE.md](../NOTICE.md), and [CHANGELOG.md](../CHANGELOG.md) are complete.
4. Confirm the project uses the MIT License and that release validation passes.
5. Submit the plugin to the Obsidian community list by opening a pull request against the [obsidian-releases](https://github.com/obsidianmd/obsidian-releases) repository and adding an entry to `community-plugins.json`. Follow the repository's current instructions and template.

## Release checklist

- [ ] All user-facing changes are in [CHANGELOG.md](../CHANGELOG.md).
- [ ] `manifest.json` `version` is the new semantic version.
- [ ] `manifest.json` `minAppVersion` is correct for the APIs used.
- [ ] `package.json` `version` matches `manifest.json`.
- [ ] `package-lock.json` root `version` and package version match.
- [ ] `versions.json` maps the new version to `minAppVersion`, and keeps older entries.
- [ ] `docs/releases/<version>.md` exists and is not empty.
- [ ] `npm run validate` passes.
- [ ] Manual checks in [RELEASE-QA.md](RELEASE-QA.md) pass.
- [ ] `main.js` was rebuilt from the current source.

## Version files

A release must keep these values synchronized:

| File | Field |
| --- | --- |
| `manifest.json` | `version`, `minAppVersion` |
| `package.json` | `version` |
| `package-lock.json` | root `version` and `packages[""].version` |
| `versions.json` | key: plugin version, value: minimum Obsidian version |
| `docs/releases/<version>.md` | release notes for this version |

For example, version `1.0.0` with a minimum app version of `1.7.2` requires:

```json
{
  "1.0.0": "1.7.2"
}
```

in `versions.json`, plus matching `1.0.0` values in the manifest, package, and lockfile.

## Build and validate

Use a supported Node version (22.13+, 24+, or 26+):

```sh
npm ci
npm run validate
```

`npm run validate` performs:

- ESLint with zero warnings allowed.
- `tsc --noEmit` and an esbuild production bundle to `main.js`.
- The full Vitest suite.
- Release validation from `scripts/validate-release.mjs`.

Release validation checks version agreement, license metadata, required assets, machine-specific paths, the runtime module graph, and relative Markdown links.

## Prepare release assets

```sh
npm run release:prepare
```

This runs validation, then creates:

```text
dist/<version>/
  main.js
  manifest.json
  styles.css
```

The staging directory for this version is recreated to remove stale files. License and notice documents remain in the repository; release notes are used as the GitHub release description. Do not upload these documents or checksum files as separate release assets.

## Create an attested GitHub release

1. Update version metadata, changelog, and `docs/releases/<version>.md`.
2. Run `npm run release:prepare`, review the output, and perform manual QA.
3. Commit the source and rebuilt `main.js`, then push the branch.
4. Tag that commit with the exact manifest version, without a `v` prefix, and push the tag.
5. Watch **Actions → Release and attest** until it succeeds.

The workflow installs locked dependencies, validates and builds the tagged source, checks the tag against the manifest, creates build-provenance attestations for the three assets, verifies them, and publishes a release containing only those assets. The GitHub-maintained actions are pinned to commit hashes. Update those pins deliberately when upgrading actions.

Attestations require `id-token: write` and `attestations: write`; release publication requires `contents: write`. These permissions are limited to the release job. The workflow does not run on pull requests. See [GitHub's artifact-attestation documentation](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations).

### Attest an existing release

Manually run **Release and attest** from a commit whose manifest and build correspond to the published version. The workflow rebuilds that commit, downloads the existing release's three supported assets, and compares every byte before attesting. A mismatch stops the workflow. Manual runs never replace assets or publish a new release. The attestation identifies the workflow run and its source commit, which may be a later commit containing only release-workflow changes.

Do not run this against newer source expecting it to attest an older binary. Publish a new patch release for source changes; do not rewrite existing release binaries or tags.

### Verify downloaded assets

With GitHub CLI installed and authenticated, run these commands beside the downloaded assets:

```sh
gh attestation verify main.js --repo ajay126z/supercharged-properties
gh attestation verify manifest.json --repo ajay126z/supercharged-properties
gh attestation verify styles.css --repo ajay126z/supercharged-properties
```

Attestations are stored by GitHub; no extra attestation file needs to be attached to the release. Confirm the attestation's source commit and workflow match the build you expect.

## After publishing

- Verify the plugin installs from the community list, or from a manual install using the attached files.
- Confirm the version shown in Obsidian matches the release.
- Keep older entries in `versions.json` so users on older app versions can install compatible releases.
- Open the next development cycle by adding an `Unreleased` section to the changelog if it is missing.

## Rolling back

If a release is broken:

1. Do not delete the tag or rewrite published assets; users may already depend on them.
2. Publish a new patch version with the fix and release notes explaining the issue.
3. If necessary, update the community plugin entry to point users to the fixed version.

## Related documents

- [RELEASING.md](RELEASING.md) - command-by-command release runbook
- [README.md](../README.md)
- [CONTRIBUTING.md](../CONTRIBUTING.md)
- [RELEASE-QA.md](RELEASE-QA.md)
- [CHANGELOG.md](../CHANGELOG.md)
- [NOTICE.md](../NOTICE.md)
- [LICENSE](../LICENSE)
