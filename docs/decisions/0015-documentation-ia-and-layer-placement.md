# 0015 — Documentation information architecture and layer placement

## Status

Accepted

- Date: 2026-07-17
- Deciders: Product owner (decision authority); Orchestrator + `adr-author`,
  `documentation`

## Context and Problem Statement

This repository holds two distinct layers that the cardinal "two layers, never
conflate them" rule (`AGENTS.md`) keeps separate: **layer 1**, the internal
kit-builder that the AI team uses to build the product, and **layer 2**, the
consumer-installable AI-DLC product under `product/`
([ADR-0003](0003-deliverable-repository-layout-and-packaging.md)).

`product/docs/` had drifted into serving both. It is the consumer-facing product
documentation hub — quickstart, usage, cross-platform, and rtk guidance read on
GitHub and npm — yet it also held two files that self-label as **internal build
specs**:

- `methodology-spec.md` — the internal build spec that maps AWS's AI-DLC onto the
  product; explicitly "not consumer-facing copy."
- `extension-methodology-notes.md` — a "binding ruling for authors (internal build
  spec)."

Both are **layer-1 authoring artifacts**: they are consumed by kit authors to
build layer 2, they are **never installed** by `npx @kabaka/ai-dlc`, and they are
**never linked** from any consumer documentation index. Their presence in a
layer-2, consumer-facing folder is precisely the layer conflation the repo forbids
— a Core Principle 1 (correctness/faithfulness) defect: a reader of `product/docs/`
cannot tell which files are product documentation and which are internal specs.

We verified the constraints: consumer documentation is a read-on-GitHub/npm
surface, and the intended consumer hub is the Documentation section of
`product/README.md`. Neither spec is referenced by any markdown link — a whole-repo
grep found only backtick **code-span** mentions of their paths (in ADRs 0004, 0005,
0007, 0008) plus one same-directory intra-reference between the two files. No link
integrity depends on their location.

## Decision Drivers

- **Layer integrity (Core Principle 1, faithfulness).** `product/` must faithfully
  represent the consumer-installable product; internal build specs contradict that.
- **Reader clarity (Core Principle 5).** A consumer browsing `product/docs/` should
  see only material that is true and useful to them.
- **Reusability/updatability (Core Principle 4).** The installer payload and the
  consumer doc hub should not carry authoring artifacts that are never shipped.
- **Low blast radius.** The two files have zero inbound markdown links, so a move is
  a pure relocation with no link breakage — only mechanical code-span path
  maintenance in prose.

## Considered Options

- **(a)** Relocate the two internal specs to a repo-root **`docs/methodology/`**
  directory (a layer-1 home alongside `docs/decisions/`), and make `product/docs/`
  exclusively consumer-facing.
- **(b)** Leave the files in `product/docs/` but add "internal, not installed"
  banners and exclude them from the installer payload and any consumer index.
- **(c)** Move them under the existing repo-root `docs/` root without a dedicated
  subdirectory (e.g. `docs/methodology-spec.md`).

## Decision Outcome

Chosen option: **(a) — `product/docs/` is exclusively consumer-facing; internal
build and authoring specs live under repo-root `docs/methodology/`.** This refines
[ADR-0003](0003-deliverable-repository-layout-and-packaging.md): ADR-0003 fixed
*where the product lives*; this ADR fixes *what may live in the product's
consumer-facing documentation folder* — namely, only consumer-facing material.

Concretely:

- `product/docs/methodology-spec.md` → `docs/methodology/methodology-spec.md`.
- `product/docs/extension-methodology-notes.md` →
  `docs/methodology/extension-methodology-notes.md`.
- The two files move together, so the same-directory intra-reference between them
  stays valid, and their content is otherwise unchanged.
- The backtick code-span paths that referenced the old locations in ADRs 0004,
  0005, 0007, and 0008 were updated to the new paths. This is **mechanical path
  maintenance**, not a revision of those decisions: no decision content changed, and
  those ADRs keep their point-in-time-correct, Accepted records.
- `product/docs/` now contains only consumer-facing guidance (quickstart, usage,
  cross-platform, rtk); the consumer documentation hub remains the Documentation
  section of `product/README.md`.

Option (b) was rejected because banners do not remove the conflation — internal
specs would still sit in the consumer folder, and every future reader and validator
would have to re-learn the exception. Option (c) was rejected because a bare
`docs/` placement mixes methodology specs with other repo-root docs (e.g.
`docs/decisions/`); a dedicated `docs/methodology/` names the category and leaves
room for future methodology-mapping artifacts.

## Consequences

### Positive

- `product/` is now faithful: everything under `product/docs/` is consumer-facing,
  matching what ADR-0003 says `product/` represents.
- Layer 1 and layer 2 are cleanly separated for these artifacts — the "never
  conflate" rule is upheld.
- No links broke: the move was verified to touch zero markdown links, and the ADR
  code-span paths were corrected so no path is factually stale.

### Negative

- Internal authoring specs are now one directory further from the product they
  describe; authors must know to look under repo-root `docs/methodology/` rather
  than `product/docs/`.
- Any future external bookmark to the old `product/docs/` paths (there are none in
  the repo) would 404 — acceptable, since these are internal, never-published files.

### Neutral

- A new top-level `docs/methodology/` directory joins `docs/decisions/` as a
  layer-1 documentation home; future methodology-mapping specs have an obvious
  place to live.
- Out of scope but worth recording as context: ADR-0004's roster figure of "12
  consumer agents" is point-in-time-correct for that Accepted decision; the roster
  has since grown to 14 (adding `observability` and `kit-extender` per ADR-0008 /
  ADR-0007). This ADR does not amend that count.

## More Information

- Migrated files: `docs/methodology/methodology-spec.md`,
  `docs/methodology/extension-methodology-notes.md`.
- Related: [ADR-0003](0003-deliverable-repository-layout-and-packaging.md) (the
  parent this refines — where the deliverable product lives);
  [ADR-0004](0004-consumer-agent-roster-and-security-documentation-hybrid.md),
  [ADR-0005](0005-baked-in-mechanisms-and-two-tier-eval-strategy.md),
  [ADR-0007](0007-consumer-kit-self-extension-via-propose-for-approval-generator.md),
  and [ADR-0008](0008-observability-agent-and-practice-domain-guidance-skills.md)
  (whose code-span paths to the two specs were updated to match).
- **Revisit when:** a genuinely consumer-facing methodology document needs a home
  (it belongs in `product/docs/`, not `docs/methodology/`), or the two-layer split
  is otherwise restructured.
