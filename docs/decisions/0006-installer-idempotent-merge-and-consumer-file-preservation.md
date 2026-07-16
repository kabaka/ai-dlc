# 0006 — Installer idempotent merge and consumer-file preservation

## Status

Accepted

- Date: 2026-06-16
- Deciders: Product owner (decision authority); Orchestrator +
  `distribution-engineer`, `tooling-engineer`, `security`

## Context and Problem Statement

The installer ([ADR-0002](0002-installer-primary-plugin-secondary-distribution.md))
scaffolds cross-platform files into a consumer's repo, several of which the consumer
may **already own** — most critically `AGENTS.md`, `CLAUDE.md`, and other project
instructions. Re-running install or update must not clobber the consumer's
hand-written content, must be safe to run repeatedly, and must detect drift so
updates are deterministic. Because it runs on the consumer's machine and touches
files they care about, getting the merge/ownership semantics wrong is both a
correctness failure and a trust failure. We need precise rules for what the kit owns
versus what it must preserve, and how updates are tracked.

> **Naming note ([ADR-0014](0014-publish-installer-to-npm-with-oidc-trusted-publishing.md)):**
> the installer is published as the scoped package `@kabaka/ai-dlc`; the
> `npx @kabaka/ai-dlc init` / `update` commands below reflect that name. This
> ADR's merge and consumer-file-preservation decision is unchanged by the package
> name.

## Decision Drivers

- **Faithfulness & safety on the consumer's machine (Core Principle 1).** Never
  silently overwrite or corrupt consumer-authored files; runs on another machine,
  so a mandatory `security` review applies.
- **Reusability & updatability (Core Principle 4).** Idempotent, version-stamped,
  drift-detecting install/update is the whole point of an installer over manual
  copying.
- **Clear ownership boundaries.** Whole-file-owned, co-owned, and consumer-owned
  files each need unambiguous, predictable handling.
- **Cross-platform robustness.** The mechanism must behave the same across the
  platforms the kit targets.

## Considered Options

- **(a)** Idempotent, version-stamped installer (`npx @kabaka/ai-dlc init/update`) with a
  per-file-hash manifest, drift detection, **whole-file stamping** for kit-owned
  files, and a **first-touch sidecar rule** that never edits a pre-existing co-owned
  file in place.
- **(b)** Overwrite-on-update (the kit's copy always wins).
- **(c)** In-place marker-region editing of co-owned files on first touch (auto-wrap
  existing content in managed markers).

## Decision Outcome

Chosen option: **(a) idempotent, version-stamped install with consumer-file
preservation**, because it is the only option that updates deterministically while
guaranteeing the consumer's hand-written instructions are never destroyed.
Specifics:

- **`npx @kabaka/ai-dlc init/update` is idempotent and version-stamped.** A
  `.ai-dlc/manifest.json` records per-file hashes; the installer is
  **drift-detecting** (it compares on-disk hashes to the manifest before acting).
- **Consumer-authored files are preserved.** A pre-existing consumer `AGENTS.md`,
  `CLAUDE.md`, or project-instructions file is never clobbered.
- **First-touch rule for a marker-less, pre-existing co-owned file: NEVER edit in
  place.** The installer writes a **`.new` sidecar** and **prints explicit merge
  instructions**. Adopting the managed
  `<!-- ai-dlc:begin -->` / `<!-- ai-dlc:end -->` marker regions is **opt-in**;
  once markers are present, the installer updates only the marked region.
- **Whole-file stamping** is used **only for files the kit fully owns** (no consumer
  content to preserve).
- **A `security` review is mandatory** because the installer runs on consumer
  machines.

## Consequences

- Good, because **re-running install/update is safe**: idempotent, hash-stamped, and
  drift-aware, so updates are deterministic and repeatable.
- Good, because **consumer-authored instructions are never destroyed** — the
  first-touch sidecar rule turns a dangerous in-place edit into a reviewable `.new`
  file plus explicit guidance, preserving consumer trust.
- Good, because the **ownership model is explicit**: whole-file stamping for
  kit-owned files, opt-in marker regions for co-owned files, hands-off for
  consumer-owned files.
- Bad, because the **sidecar path needs a human merge** on first touch for co-owned
  files — the update is not fully automatic until the consumer opts into markers.
- Bad, because **per-file hashing and drift detection add implementation
  complexity** (the manifest must be maintained and validated).
- Neutral, because the installer must carry a **mandatory `security` review** on
  every change — correct, but an ongoing gate to honor.

## Pros and Cons of the Options

### (a) Idempotent, stamped install + first-touch sidecar — chosen

- Good, because it is safe, repeatable, and never destroys consumer content.
- Good, because ownership tiers (whole-file / marker / preserve) are explicit.
- Bad, because first-touch co-owned files require a manual merge until markers are
  adopted, and the hash manifest adds complexity.

### (b) Overwrite-on-update — rejected

- Good, because it is trivially deterministic (the kit's copy always wins).
- Bad, because it **destroys consumer-authored `AGENTS.md`/`CLAUDE.md`/project
  instructions** — a correctness and trust failure on the consumer's machine.

### (c) In-place marker-wrap on first touch — rejected

- Good, because it would make future updates automatic immediately.
- Bad, because **editing a pre-existing file in place on first touch is exactly the
  risky write we forbid** — it mutates content the consumer never asked us to touch.
  Marker adoption must be opt-in, not imposed.

## More Information

- Skills: `installer-design` (marker-vs-whole-file ownership, idempotent
  update/version-stamp/drift-detection semantics), `security-review` (the mandatory
  review for installer code on consumer machines).
- Agents: `distribution-engineer` (installer design), `tooling-engineer` (installer
  implementation and manifest validation), `security` (mandatory review).
- Related: [ADR-0002](0002-installer-primary-plugin-secondary-distribution.md)
  (installer-primary distribution — why the installer owns top-level files);
  [ADR-0003](0003-deliverable-repository-layout-and-packaging.md) (the
  `product/.claude/` payload the installer applies);
  [ADR-0005](0005-baked-in-mechanisms-and-two-tier-eval-strategy.md) (the arbiter
  hook the installer wires onto the consumer's repo).
- **Revisit when:** the product phase builds the installer and the merge semantics
  meet real consumer repos, or a platform's discovery-file conventions change which
  files are co-owned.
