# Releasing `@kabaka/ai-dlc`

Maintainer runbook for shipping the AI-DLC installer package to npm. Releases are
automated with [release-please](https://github.com/googleapis/release-please) and
published via npm OIDC trusted publishing. In steady state, **cutting a release
is one action: merge the standing Release PR.** No manual version edits, no
hand-created tags, no npm token.

This is a maintainer document. Consumers install the package with
`npx @kabaka/ai-dlc init` and never touch anything here.

## Cut a release (the normal path)

1. Land Conventional Commits on `main` as usual. The commit type drives the
   Semantic Version bump:
   - `fix:` → patch (`0.1.1` → `0.1.2`)
   - `feat:` → minor (`0.1.1` → `0.2.0`)
   - `feat!:` or a `BREAKING CHANGE:` footer → major (`0.1.1` → `1.0.0`)
2. release-please keeps a **standing Release PR** open against `main`. Each push
   updates it: it bumps
   [`product/installer/package.json`](product/installer/package.json) and rewrites
   the `Unreleased` section of
   [`product/installer/CHANGELOG.md`](product/installer/CHANGELOG.md) into a
   dated, versioned entry.
3. When you are ready to ship, **review and merge the Release PR.** That merge is
   the deliberate ship gate — nothing publishes until you take it.

Merging the Release PR creates the `vX.Y.Z` tag and the GitHub Release, which
fires the publish workflow. Watch the `release` workflow run to green; when it
finishes, `@kabaka/ai-dlc@X.Y.Z` is live on npm with build provenance.

To decline a release, just leave the PR open — it keeps absorbing commits until
you merge it.

## How the automation works

Two workflows compose. Neither edits a version by hand.

### `release-please.yml` — propose and cut

[`.github/workflows/release-please.yml`](.github/workflows/release-please.yml)
runs on every push to `main` (manifest mode, config in
[`release-please-config.json`](release-please-config.json)). It maintains the
Release PR and, when that PR merges, creates the `vX.Y.Z` tag and GitHub Release.
Tags carry no component prefix and do carry the `v` (`include-component-in-tag:
false`, `include-v-in-tag: true`). It does **not** publish.

The workflow mints a token from a **GitHub App** rather than using the default
`GITHUB_TOKEN`. This is load-bearing: a Release created with `GITHUB_TOKEN` does
**not** trigger other workflows (GitHub suppresses recursive runs), so the publish
workflow would never fire. A Release created with the App token *does* dispatch
`release: published`, which is what makes publishing happen. The App token also
carries the `contents` + `pull-requests` write scopes release-please needs, so the
job's own `GITHUB_TOKEN` stays read-only.

### `release.yml` — publish

[`.github/workflows/release.yml`](.github/workflows/release.yml) runs on
`release: published` and publishes `@kabaka/ai-dlc` to npm using **OIDC trusted
publishing with provenance** (Node 22, tokenless — no npm secret exists). Before
it publishes it enforces two gates:

- **Version guard.** The Release tag (with the leading `v` stripped) must equal
  the `version` in `product/installer/package.json`. Because release-please bumps
  that file and tags `v<same version>`, this passes automatically. A hand-made
  mismatched tag fails the run.
- **Tarball smoke test.** It runs `npm pack` (which builds the real payload via
  `prepack`), extracts the tarball, and does a `--dry-run` install into a throwaway
  repo. A broken package fails here instead of shipping.

## One-time setup (per repository)

Done once for `kabaka/ai-dlc`. Recorded here so the release path can be rebuilt or
audited.

### 1. Create a GitHub App

Create a GitHub App (org-owned or personal) with exactly these **Repository**
permissions and nothing else:

| Permission      | Access         | Why                                    |
| --------------- | -------------- | -------------------------------------- |
| Contents        | Read and write | Create the release commit, tag, Release |
| Pull requests   | Read and write | Open and update the Release PR         |

### 2. Install the App on `kabaka/ai-dlc`

Install the App on the repository (or on the org, scoped to this repo). The
`release-please.yml` job is guarded to run only on `kabaka/ai-dlc`, so forks never
attempt to use it.

### 3. Add the two repository secrets

Under **Settings → Secrets and variables → Actions**, add:

| Secret                          | Value                                    |
| ------------------------------- | ---------------------------------------- |
| `RELEASE_PLEASE_APP_ID`         | the App's numeric App ID                 |
| `RELEASE_PLEASE_APP_PRIVATE_KEY`| the full contents of the App's `.pem` key |

The App ID is not itself sensitive; storing it as a secret keeps the two inputs
together. See the "Why a GitHub App token" explanation above for the reason this
App exists.

### 4. Register the npm trusted publisher

Already configured for `@kabaka/ai-dlc` (since 0.1.1); recorded for completeness.
On npmjs.com, under the package's **Settings → Trusted Publisher → GitHub
Actions**, set:

| Field              | Value        |
| ------------------ | ------------ |
| Organization/user  | `kabaka`     |
| Repository         | `ai-dlc`     |
| Workflow filename  | `release.yml` |
| Environment name   | *(blank)*    |

Two traps to respect:

- **Workflow filename must be `release.yml`.** npm matches the *initiating*
  workflow filename, which is why publishing runs directly in `release.yml` and is
  never delegated to a reusable (`workflow_call`) job — that would change the
  filename npm sees and fail with a 404.
- **Leave Environment blank.** The publish job declares no `environment:`, so the
  OIDC subject has no environment component. Setting an environment name on npm's
  side without adding a matching `environment:` to the job breaks the OIDC match
  (403/404). Change both sides together or neither.

The `@kabaka` npm scope must also exist with 2FA enabled on the account that owns
it.

## Manual fallback

If the automation is ever unavailable, a maintainer can publish by hand:

1. Ensure `product/installer/package.json` holds the version you intend to ship.
2. Create a GitHub Release with a tag `vX.Y.Z` that **exactly matches** that
   version.

The published Release fires `release.yml` exactly as an automated one does; the
version guard and smoke test still run, and the OIDC publish proceeds. You do not
need an npm token.

## Historical note: the OIDC bootstrap

npm trusted publishing cannot *create* a brand-new package name. The very first
publish of `@kabaka/ai-dlc` (0.1.0) was therefore a one-time manual bootstrap
(`npm publish` from a maintainer machine) to register the name. That is done — it
is **not** needed again. Every release since is fully tokenless via OIDC.

## When a release doesn't publish

Work down the chain; each step hands off to the next:

1. **Did the Release PR merge?** No merge → no tag, no Release, nothing to
   publish. Merge it.
2. **Did merging create a tag and GitHub Release?** Check the repo's Releases and
   tags. If absent, `release-please.yml` failed — check its run, and confirm
   `RELEASE_PLEASE_APP_ID` / `RELEASE_PLEASE_APP_PRIVATE_KEY` are present and the
   App is still installed.
3. **Did the Release fire `release.yml`?** If the tag and Release exist but no
   `release` run started, the Release was likely created with `GITHUB_TOKEN`
   instead of the App token (recursive-trigger suppression). Confirm
   `release-please.yml` is minting and using the App token.
4. **Did `release.yml` fail a gate?** Open the run:
   - *Version guard failed* → the tag doesn't match
     `product/installer/package.json` version. Re-tag to match, or fix the
     version.
   - *Publish step failed (403/404)* → recheck the npm trusted-publisher config:
     org `kabaka`, repo `ai-dlc`, workflow `release.yml`, Environment blank.
