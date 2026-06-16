# 0003 — Deliverable repository layout and packaging

## Status

Accepted

- Date: 2026-06-16
- Deciders: Product owner (decision authority); Orchestrator +
  `distribution-engineer`, `cross-platform-integrator`

## Context and Problem Statement

The consumer-installable AI-DLC product (layer 2) must live somewhere in this
repository without colliding with the layer-1 kit-builder assets at the repo's
top-level `.claude/`. It has to be (a) a single source of truth the installer can
package as its payload, (b) describable by a Claude Code plugin manifest, and
(c) discoverable through a marketplace catalog — all while the cross-platform
consumption story ([ADR-0002](0002-installer-primary-plugin-secondary-distribution.md))
happens **post-install at the consumer's repo root**, not from this layout in
place. We need a layout that satisfies all three packaging surfaces from one set
of files without symlinks (which are fragile on Windows checkouts, in CI, and for
local-path plugin installs that skip out-of-plugin-dir symlinks).

## Decision Drivers

- **Single source of truth.** One copy of every consumer agent/skill; no
  duplicated trees to drift (Core Principle 4, reusability/updatability).
- **Cross-platform integrity.** The plugin manifest, marketplace catalog, and
  installer payload must all point at the same files (Core Principle 3).
- **Faithfulness to current tool behavior.** Manifest path fields and marketplace
  source semantics must match what Claude Code actually supports today
  (Core Principle 1).
- **Windows / CI robustness.** No mechanism that breaks on Windows or in CI — rules
  out symlinks.
- **Isolation from layer 1.** The top-level `.claude/` kit-builder assets must stay
  untouched.

## Considered Options

- **(a)** Product under `product/` with `product/.claude/{agents,skills}/`, the
  plugin manifest at `product/.claude-plugin/plugin.json` (custom relative
  component dirs pointed at the product dirs), and a repo-root
  `.claude-plugin/marketplace.json` with `source: ./product`. **No symlinks.**
- **(b)** Product under `product/claude/` (dotless) with manifest path fields
  mapping the dotless dirs to plugin components.
- **(c)** Product under `product/.claude/` plus a separate `plugin/` directory that
  symlinks back into the product tree to assemble the plugin layout.

## Decision Outcome

Chosen option: **(a) a `product/` top-level directory as the single source of
truth, with custom manifest component paths and no symlinks**, because it is the
only option that serves all three packaging surfaces from one file set without a
Windows/CI-fragile mechanism. Concretely:

- Consumer agents and skills live at `product/.claude/{agents,skills}/`.
- The plugin manifest at `product/.claude-plugin/plugin.json` sets its `agents`
  and `skills` path fields to the product dirs. Custom relative component
  directories are supported by Claude Code (verified against current docs,
  2026-06-16; `distribution-engineer` confirms with
  `claude plugin validate --strict`).
- The marketplace catalog at repo-root `.claude-plugin/marketplace.json` uses
  `source: ./product`, with `git-subdir` documented for URL installs.
- `product/.claude/` is the **installer payload source** — nothing reads it in
  place. Cross-platform consumption happens post-install at the consumer's repo
  root (see [ADR-0002](0002-installer-primary-plugin-secondary-distribution.md)).

## Consequences

- Good, because there is **one source of truth** (`product/.claude/`) feeding the
  installer payload, the plugin manifest, and the marketplace catalog — no
  duplicated tree to drift.
- Good, because **no symlinks** means the layout is robust on Windows, in CI, and
  for local-path plugin installs (which skip out-of-plugin-dir symlinks).
- Good, because the **layer-1 top-level `.claude/`** kit-builder assets are
  untouched — the two layers stay cleanly separated.
- Bad, because **validators must be parameterized** to scan the product surface as
  a separate read-only set, in addition to the layer-1 surface — more validation
  configuration to maintain.
- Neutral, because the manifest's **custom component paths depend on current
  Claude Code behavior**; if the plugin manifest schema changes, the path fields
  must be re-verified (the `distribution-engineer` re-runs
  `claude plugin validate --strict`).

## Pros and Cons of the Options

### (a) `product/` single source + custom manifest paths, no symlinks

- Good, because one file set serves installer payload, plugin manifest, and
  marketplace catalog — single source of truth.
- Good, because no symlinks: robust on Windows, CI, and local-path installs.
- Good, because it keeps layer-1 `.claude/` isolated.
- Bad, because validators must be parameterized to cover both surfaces, and the
  custom manifest paths rest on current tool behavior that must be re-verified.

### (b) `product/claude/` (dotless) + manifest path mapping — rejected

- Good, because a dotless directory avoids any ambiguity with the conventional
  `.claude/` discovery location.
- Bad, because consumer assets that the kit ships are conventionally `.claude/`
  assets; a dotless source needlessly diverges from the consumer-side layout the
  installer produces, adding a mapping with no offsetting benefit.

### (c) `product/.claude/` + separate `plugin/` dir with symlinks — rejected

- Good, because it assembles a clean, conventional plugin directory layout.
- Bad, because the symlinks are exactly the Windows/CI-fragile mechanism we reject;
  local-path plugin installs skip out-of-plugin-dir symlinks, so the assembled
  layout would not even install reliably.

## More Information

- Skills: `plugin-packaging` (what `plugin.json` can ship and its component path
  fields), `marketplace-publishing` (`marketplace.json` schema, `source` types,
  `git-subdir`), `installer-design` (the installer payload and scaffolding model).
- Agent: `distribution-engineer` (packaging, manifest, marketplace, validation).
- Related: [ADR-0002](0002-installer-primary-plugin-secondary-distribution.md)
  (installer-primary, plugin-secondary distribution — why the installer owns
  post-install consumption); [ADR-0006](0006-installer-idempotent-merge-and-consumer-file-preservation.md)
  (how the installer applies the payload idempotently).
- **Revisit when:** the Claude Code plugin manifest schema changes which component
  path fields are supported, or the marketplace `source`/`git-subdir` semantics
  change.
