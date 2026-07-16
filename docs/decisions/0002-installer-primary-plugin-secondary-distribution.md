# 0002 — Installer-primary, plugin-secondary distribution

## Status

Accepted

- Date: 2026-06-16
- Deciders: Product owner (decision authority); Orchestrator +
  `distribution-engineer`, `cross-platform-integrator`

## Context and Problem Statement

The deliverable AI-DLC kit must scaffold a cross-platform set of files into a
consumer's repository, including **top-level files**: `AGENTS.md`, `CLAUDE.md`, and
tool-specific directories such as `.github/`, `.cursor/`, and `.kiro/`. How should
the kit be delivered and updated? A Claude Code **plugin** is the most discoverable,
Claude-native surface, but it provably **cannot place these top-level files**: a
plugin-root `CLAUDE.md` is not loaded, and an installed plugin runs from its cache
directory and cannot write outside it into the user's repo root. The closest prior
art, `awslabs/aidlc-workflows`, itself ships as copyable repository files rather than
as a plugin. We need a primary mechanism that can deliver and cleanly update
top-level files, with the Claude-native surface as a complement.

> **Scope note.** This ADR records the *decision and rationale* for the
> distribution strategy. The distribution **implementation** is deferred to the
> product phase; this internal layer only builds the expertise (the
> `installer-design`, `plugin-packaging`, and `marketplace-publishing` skills and
> the `distribution-engineer` agent).
>
> **Realized by [ADR-0014](0014-publish-installer-to-npm-with-oidc-trusted-publishing.md):**
> the deferred publish mechanism (scoped public npm package `@kabaka/ai-dlc` via
> OIDC trusted publishing) is decided there.

## Decision Drivers

- **Deliver cross-platform top-level files.** `AGENTS.md`, `CLAUDE.md`, `.github/`,
  `.cursor/`, `.kiro/` must land at the repo root — non-negotiable.
- **Trivial install, clean updates.** One command to install; deterministic,
  low-friction updates over time.
- **Claude-native discoverability.** A first-class, discoverable surface for Claude
  Code users (the kit's primary platform).

## Considered Options

- **(a)** Installer (npx/curl) **primary**, with a Claude Code plugin + marketplace
  as a **secondary** surface.
- **(b)** Plugin / marketplace **only**.
- **(c)** Manual copy / git submodule **only**.

## Decision Outcome

Chosen option: **(a) installer-primary, plugin/marketplace-secondary**, because it
is the only option that can deliver the required top-level files while still
offering a Claude-native discovery and update path. An installer invoked via
`npx`/`curl` owns the cross-platform top-level files and applies deterministic,
version-stamped updates; a Claude Code plugin plus a marketplace entry provides
`/plugin` discovery and updates for the Claude-native slice (skills/agents).
**Implementation is deferred to the product phase** — see the scope note above.

### Consequences

- Good, because the **installer owns the top-level files** (`AGENTS.md`,
  `CLAUDE.md`, `.github/`, `.cursor/`, `.kiro/`) with deterministic, stamped updates
  the plugin model cannot provide.
- Good, because the **plugin gives `/plugin` discovery and update** for the
  Claude-native slice, meeting the discoverability driver without compromising
  delivery.
- Bad, because there are **two delivery mechanisms to maintain** and keep in sync
  (the installer-scaffolded files and the plugin-distributed assets).
- Neutral, because **implementation is deferred**: this layer only builds the
  packaging/installer/marketplace expertise; the product phase will build and test
  the actual mechanisms.

## Pros and Cons of the Options

### (a) Installer primary + plugin/marketplace secondary

- Good, because the installer can write top-level files anywhere in the consumer's
  repo, with idempotent, version-stamped scaffolding and updates.
- Good, because the plugin/marketplace surface adds Claude-native discovery and a
  clean update path for skills/agents.
- Bad, because it is two mechanisms, not one — more surface to build, test, and
  keep consistent.

### (b) Plugin / marketplace only — rejected

- Good, because it is the single most discoverable Claude-native surface.
- Bad, because it **cannot deliver the top-level files**: a plugin-root `CLAUDE.md`
  is not loaded, and an installed plugin cannot write outside its cache directory
  into the repo root. It fails the primary driver outright.

### (c) Manual copy / git submodule only — rejected

- Good, because it trivially places top-level files (you copy them in).
- Bad, because it has a **poor update story**: copies drift and must be merged by
  hand; submodules add workflow friction and no version-stamped update path. No
  Claude-native discoverability either.

## More Information

- Prior art: `awslabs/aidlc-workflows` (distributed as copyable repository files).
- Skills: `installer-design` (idempotent npx/curl installer; scaffold + update +
  version-stamp strategy), `plugin-packaging` (what a Claude Code plugin can and
  cannot ship — notably **not** top-level files), `marketplace-publishing`
  (marketplace schema, install/enable/update mechanics).
- Agent: `distribution-engineer` (packaging, marketplace, installer, versioning).
- Related: [ADR-0001](0001-canonical-agents-md-with-claude-md-import.md) (why
  `AGENTS.md`/`CLAUDE.md` are top-level files in the first place);
  [ADR-0014](0014-publish-installer-to-npm-with-oidc-trusted-publishing.md) (the
  npm publish mechanism that realizes the deferred implementation).
- **Revisit when:** the product phase begins and the distribution implementation is
  built, or if the Claude Code plugin model changes to permit writing top-level
  files at the repo root.
