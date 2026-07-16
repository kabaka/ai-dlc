# 0014 — Publish the installer to npm as a scoped public package with OIDC trusted publishing

## Status

Accepted

- Date: 2026-07-16
- Deciders: Product owner (decision authority / arbiter); Orchestrator +
  `distribution-engineer`, `devops`, `security`

## Context and Problem Statement

[ADR-0002](0002-installer-primary-plugin-secondary-distribution.md) chose an
installer-primary, plugin-secondary distribution and **deferred the publish
mechanism to the product phase**. That phase is now here: the installer at
`product/installer/` (package `@kabaka/ai-dlc`, bin `ai-dlc`) must become
publicly installable — consumers should run `npx @kabaka/ai-dlc init` and
`npx @kabaka/ai-dlc update` against a public npm package, once the repository is
public. We must decide *how* the package is named and published, *how* the
publish is authenticated (Core Principle 1, correctness/faithfulness to current
npm behavior; and supply-chain posture), and *what* must be true for the
published tarball to actually work when a consumer runs it (Core Principle 4,
reusability/updatability). Two forces sharpen the decision:

- npm's **trusted publishing** (OIDC) removes long-lived tokens from the release
  path and generates provenance attestations automatically, but it has a
  documented **bootstrap gap**: OIDC cannot create a *brand-new* package
  ([npm/cli#8544](https://github.com/npm/cli/issues/8544)). The very first
  publish must therefore use a token.
- The installer ships a **built payload**, not the repository tree. Publishing
  the package directory as-is produces a tarball that throws
  `Could not locate the AI-DLC payload.` at runtime. The build and a
  pack-from-tarball smoke test must gate every publish.

A prior contradiction also has to be resolved: `plugin.json` and
`.claude-plugin/README.md` disagreed on whether the plugin manifest carries a
`version`, leaving the SemVer source of truth ambiguous across the two install
channels this ADR must cover.

## Decision Drivers

- **Faithfulness to current npm/GitHub behavior** (Core Principle 1). OIDC
  trusted-publisher matching, the new-package bootstrap gap, and the Node/npm
  version floors are platform facts the release design must honor exactly.
- **Supply-chain posture.** No long-lived `NPM_TOKEN` living in the repo or CI
  secrets; provenance on every published version.
- **A working published artifact** (Core Principle 4). The package a consumer
  installs must run `init`/`update` out of the box — the payload must be in the
  tarball and proven so before release.
- **One SemVer source of truth across both channels** (Core Principle 3,
  cross-platform integrity). The npm channel and the plugin channel must not
  contradict each other on versioning.
- **Coverage of both install channels post-public-repo.** npm `npx` for the
  cross-platform installer; the Claude Code plugin/marketplace for the
  Claude-native slice.

## Considered Options

- **(a)** Scoped public package `@kabaka/ai-dlc` published via **OIDC trusted
  publishing** on GitHub `release: published`, with a one-time token bootstrap,
  a mandatory payload build (`prepack`), and a CI tarball smoke test.
- **(b)** Same package, but authenticated with a **long-lived `NPM_TOKEN`**
  stored as a GitHub Actions secret.
- **(c)** An **unscoped** package name (e.g. `ai-dlc`) on npm.
- **(d)** **No npm publish** — distribute the installer via `git`/`curl` only.

## Decision Outcome

Chosen option: **(a)**. Publish the installer as the **scoped public** package
`@kabaka/ai-dlc` (retaining the `ai-dlc` bin name; consumers run
`npx @kabaka/ai-dlc init` / `update`), authenticated by **npm OIDC trusted
publishing** so no long-lived token lives in the repo and provenance
attestations are generated automatically. Concretely:

- **Trigger and workflow shape.** Publishing runs on GitHub
  `release: published`. The workflow is a **single top-level**
  `.github/workflows/release.yml`, and that exact filename is registered in
  npm's trusted-publisher configuration. The publish job must **not** be factored
  into a reusable / `workflow_call` job — OIDC subject matching is against the
  top-level workflow file, so indirection through a called workflow breaks the
  match.
- **Toolchain floors.** Trusted publishing with provenance requires **Node
  ≥ 22.14.0 and npm ≥ 11.5.1** in CI, so `release.yml` pins Node 22 and upgrades
  npm to satisfy the npm floor before publishing.
- **One-time bootstrap (required maintainer setup).** Because OIDC cannot create
  a new package ([npm/cli#8544](https://github.com/npm/cli/issues/8544)), a
  maintainer performs a **one-time** `npm publish --access public` to create
  `@kabaka/ai-dlc`, using a **short-lived automation granular access token** that
  is **revoked immediately afterward**. The trusted publisher is then configured
  in the npm package settings, and **all subsequent releases are tokenless**.
- **Mandatory payload build + smoke gate.** `package.json` runs
  `prepack` → `product/installer/scripts/build-payload.mjs` to assemble the
  installer payload into the tarball. CI **packs the tarball and runs
  `init --dry-run` from it** as a required gate on every publish — without the
  build step the published package throws
  `Could not locate the AI-DLC payload.`
- **Version model (single source of truth).** `product/installer/package.json`
  `version` is the **single SemVer source of truth**. `product/.claude-plugin/
  plugin.json` **omits** `version`; the plugin/marketplace channel uses the git
  SHA as its update key (consistent with the marketplace update model). This
  resolves the prior `plugin.json` ↔ `.claude-plugin/README.md` contradiction:
  the manifest is authoritative in omitting the field, and the README is aligned
  to it.

This realizes the publishing mechanism that
[ADR-0002](0002-installer-primary-plugin-secondary-distribution.md) marked as
deferred, and it covers **both** install channels once the repository is public.

### Consequences

- Good, because the release path carries **no long-lived npm token** — after the
  one-time bootstrap, every publish is tokenless OIDC with **provenance
  attestations** generated automatically, the strongest available supply-chain
  posture.
- Good, because the **scoped** name `@kabaka/ai-dlc` reduces the typosquat
  surface relative to an unscoped name — the scope is owned, so look-alike
  unscoped packages cannot impersonate the exact install string.
- Good, because the **payload build + tarball smoke test** guarantee the
  published package actually runs `init`/`update`, closing the
  "Could not locate the AI-DLC payload." failure mode before it can ship.
- Good, because there is **one SemVer source of truth** (`package.json`), and the
  plugin channel's git-SHA update key no longer contradicts it — both channels
  are covered without a versioning conflict.
- Bad, because the **one-time bootstrap and trusted-publisher registration are
  manual operational prerequisites**: the first publish requires a maintainer
  with a short-lived automation token, and the npm-side trusted-publisher config
  (repo and workflow filename) must be set before tokenless releases work. Leave
  npm's **"Environment name" field blank** — `release.yml` declares no
  `environment:`, and the field must be filled **only if** a matching
  `environment:` is added to the release job. A mismatch (e.g. a renamed workflow
  file, or an environment set on one side but not the other) silently breaks OIDC
  subject matching.
- Bad, because the **workflow cannot be refactored into a reusable/`workflow_call`
  job** without re-registering — this constrains future CI factoring of the
  release path.
- Neutral, because **Claude Code web/cloud cannot use the interactive `/plugin`
  flow**; consumers on that surface declare the marketplace in project-scope
  `.claude/settings.json` (or a setup script) rather than installing
  interactively. This is a plugin-channel consumption note, documented for the
  product phase.
- Neutral, because the **Node ≥ 22.14.0 / npm ≥ 11.5.1** floor is a moving target
  tied to npm's trusted-publishing implementation; the pin in `release.yml` must
  be re-verified if npm changes the minimum.

## Pros and Cons of the Options

### (a) Scoped public `@kabaka/ai-dlc` + OIDC trusted publishing — chosen

- Good, because tokenless publishing with automatic provenance is the best
  supply-chain posture npm offers, and the scoped name is squat-resistant.
- Good, because the mandatory payload build and tarball smoke gate make a broken
  published artifact impossible to release unnoticed.
- Bad, because it requires a one-time token bootstrap and exact trusted-publisher
  registration (workflow filename, no `workflow_call` indirection).

### (b) Same package with a long-lived `NPM_TOKEN` — rejected

- Good, because it publishes immediately with no bootstrap gap and no OIDC
  matching constraints.
- Bad, because a long-lived, broadly-scoped token in CI is exactly the
  supply-chain exposure trusted publishing exists to remove; it also does not
  produce provenance by default. Fails the supply-chain driver.

### (c) Unscoped `ai-dlc` — rejected

- Good, because the install string is marginally shorter.
- Bad, because an unscoped name is more exposed to typosquatting and the exact
  name may be unavailable or contested; a scope the project owns gives a stable,
  defensible namespace for this and future packages.

### (d) No npm publish (git/curl only) — rejected

- Good, because it avoids npm entirely — no bootstrap, no OIDC config.
- Bad, because it abandons the `npx`-based install/update ergonomics
  [ADR-0002](0002-installer-primary-plugin-secondary-distribution.md) committed
  to as the primary consumer path, and offers no provenance or version-resolution
  story. Fails the reusability/updatability driver.

## More Information

- Platform facts: npm **trusted publishing** (OIDC, provenance attestations); the
  new-package bootstrap gap [npm/cli#8544](https://github.com/npm/cli/issues/8544)
  (OIDC cannot create a brand-new package); the Node ≥ 22.14.0 / npm ≥ 11.5.1
  floors for trusted publishing (verified against official npm/GitHub docs,
  2026-07).
- Realized files: `product/installer/package.json` (`@kabaka/ai-dlc`, bin
  `ai-dlc`, `prepack` → `scripts/build-payload.mjs`, SemVer source of truth);
  `product/installer/scripts/build-payload.mjs` (payload assembly);
  `product/.claude-plugin/plugin.json` (no `version` field);
  `.github/workflows/release.yml` (the top-level release workflow registered as
  the trusted publisher).
- Skills/agents: `installer-design`, `plugin-packaging`, `marketplace-publishing`,
  `security-review`; agents `distribution-engineer`, `devops`, `security`.
- Related: [ADR-0002](0002-installer-primary-plugin-secondary-distribution.md)
  (installer-primary distribution — this ADR realizes its deferred publish
  mechanism); [ADR-0003](0003-deliverable-repository-layout-and-packaging.md)
  (repository layout and packaging — the version-omission / SemVer-source decision
  here settles its versioning model).
- **Revisit when:** npm closes the OIDC new-package bootstrap gap (removing the
  token step), changes the trusted-publishing Node/npm floors or the
  workflow-matching rules, or the plugin/marketplace update-key model changes.
