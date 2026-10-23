# ChatMe Release Notes Directory

This directory contains the historical changelog and release notes for all published versions of ChatMe.

## Structure

- `release_notes/vX.Y.Z.md`: Detailed release notes and highlights for version `vX.Y.Z`.
- `../RELEASE_NOTES.md`: The root release notes file reflecting the **latest** release. This file is automatically read by the GitHub Actions release workflow (`.github/workflows/release.yml`) and published as the GitHub release body.

## Release Process

1. When preparing a new version:
   - Create a copy of the release notes in `release_notes/v<version>.md`.
   - Update the root `RELEASE_NOTES.md` with the new version notes.
   - Run `npm run update-version <version>` to update version numbers across configuration files (`package.json`, `Cargo.toml`, `tauri.conf.json`).
   - Commit changes and push a git tag matching `v*` or `app-v*` (e.g. `git tag app-v<version>` and `git push origin app-v<version>`).
2. GitHub Actions will trigger the release workflow on the tag push and publish the draft release with the contents of `RELEASE_NOTES.md`.
