# 0009 — Operationalizing spec-completeness with a Definition of Done

## Status

Accepted

- Date: 2026-06-21
- Deciders: Product owner (decision authority); Orchestrator + `skill-author`,
  `orchestration-designer`, `qa`

## Context and Problem Statement

When the kit-builder (layer 1) produces work, three completeness failures recur:

- **Silent deferral** — scope quietly slips to a "v2" / "later phase" instead of
  being met in the same effort, contradicting the Non-Negotiable Delivery Rules.
- **Orphan features** — a capability is authored but never wired end-to-end (a
  skill that nothing routes to, an agent never delegated, a manifest entry with no
  backing file), so it is unreachable in practice.
- **Stale companions** — the feature lands but its companions (docs, tests/evals,
  `CHANGELOG.md`) are not updated alongside it.

The root cause is not absence of intent: completeness is *asserted in prose* in
roughly ten places across `AGENTS.md`, the workflow, and several skills ("meet
every requirement, fully", "no fakes", "no deferring"). But it is never
**operationalized as a checkable artifact** — there is no enumerated, agreed list
a reviewer can check work against. Declarations without a detector are exactly the
failure mode. A decision is needed on how to make completeness checkable without
violating the repo's standing constraints.

## Decision Drivers

- **Correctness & faithfulness (Core Principle 1).** Completeness must be verified
  against something concrete, not assumed; an honest gate must not overstate what
  it guarantees.
- **Reliable triggering & orchestration (Core Principle 2).** The check must
  actually fire at the right beats in the workflow loop, not sit as inert prose.
- **Gates not scripts (product-owner constraint).** The product owner explicitly
  ruled out a deterministic deferral-scan script/hook for this; enforcement is to
  flow through workflow beats and the blocking `qa` gate.
- **Honest enforcement boundary (continuity with [ADR-0005](0005-baked-in-mechanisms-and-two-tier-eval-strategy.md)).**
  LLM-instruction gates are best-effort, not hard guarantees; this ADR must label
  its enforcement the same way.
- **Cross-platform integrity (Core Principle 3).** A `.claude/`-resident mechanism
  is Claude-Code-first; non-Claude tools must still inherit the principle via the
  canonical `AGENTS.md` Delivery Rule.
- **Reusability & single source of truth (Core Principles 4–5).** The new skill
  must establish one canonical home for the completeness/no-deferral rule that the
  existing scattered declarations point to, and must mirror (not fork) the layer-2
  vocabulary it overlaps with. (Deleting the role-specific reinforcements was
  considered and deliberately rejected — see the Decision Outcome.)

## Considered Options

- **(a)** More / stronger prose rules — add or strengthen the no-deferral wording.
- **(b)** A deterministic deferral-scan **script / hook** — a CI or pre-commit
  detector for "v2" / "TODO" / "phase 2" patterns.
- **(c)** A new dedicated **agent** that owns completeness review.
- **(d)** A canonical **`definition-of-done` skill** + deterministic-ish workflow
  beats + the blocking `qa` gate.

## Decision Outcome

Chosen: **(d)**. We introduce a new layer-1 skill, **`definition-of-done`**, that
owns an **enumerated, arbiter-confirmed acceptance checklist produced up front**,
with **end-to-end reachability** and **companions (docs / tests / changelog)** as
explicit line items. We then wire it into the operating model:

- **`orchestration-workflow`** gains **two beats**: an *enumerate-&-confirm* beat
  near step 1 (the acceptance checklist is drafted and confirmed with the arbiter
  before authoring), and a *spec-conformance gate* near steps 7–8 (work is checked
  against that checklist before delivery).
- **`delegation-patterns`** gains a **no-unilateral-descope** rule (a subagent may
  not silently drop a requirement) and a **seam-ownership** rule (every end-to-end
  seam has a named owner, so nothing is left an orphan).
- **`kit-review` / `qa`** fold in a **completeness scan** against the checklist,
  with **`definition-of-done` preloaded on the `qa` agent** so the blocking gate
  always has the checklist semantics loaded.
- `definition-of-done` is established as the **single canonical home** for the
  completeness/no-deferral rule, and each pre-existing role-specific declaration
  gains a **one-line pointer** to it. The declarations are **kept in place, not
  deleted** — preserving the role-specific reinforcements was a deliberate choice
  flagged in review (deleting them was judged a regression in triggering). Net
  declaration count therefore does **not** decrease; the gain is one canonical
  operational procedure (the up-front acceptance checklist) plus pointers, not
  less prose.

The skill **mirrors** the layer-2 `requirements-elaboration` vocabulary
(`acceptance_criteria` / `non_goals` / `dependencies`) rather than forking it, with
an anti-drift cross-reference between the two.

Options (a)–(c) are rejected: (a) is the failure mode itself (declarations without
detectors); (b) is ruled out by the gates-not-scripts constraint and cannot verify
the judgment-call items anyway; (c) duplicates `qa`'s remit.

### Consequences

- Good, because completeness becomes a **concrete, enumerated artifact** a reviewer
  can check against, instead of ten prose assertions no one checks.
- Good, because the checklist is **arbiter-confirmed up front**, so scope is agreed
  before authoring rather than relitigated at delivery.
- Good, because **reachability and companions are line items**, directly targeting
  the orphan-feature and stale-companion failures.
- Good, because establishing one canonical home with pointers gives every
  location a **single source of truth** for the rule — the canonical procedure is
  defined once and referenced, even though the role-specific declarations are
  deliberately retained (so net prose does not shrink).
- Bad, because enforcement is **strongly-instructed prose plus a blocking `qa`
  gate — NOT a hard deterministic guarantee.** Consistent with
  [ADR-0005](0005-baked-in-mechanisms-and-two-tier-eval-strategy.md), an
  LLM-instruction gate is best-effort; a hard guarantee would need a hook, which
  the gates-not-scripts constraint rules out for this case.
- Bad, because **reachability and companions are arbiter-confirmed judgments, not
  machine-verified** — there is no detector proving a seam is wired or a doc is
  current; a human/model arbiter must confirm it.
- Neutral, because the mechanism lives in `.claude/` and is therefore
  **Claude-Code-first**: Copilot, Kiro, and Cursor inherit only the *principle*,
  via the retained `AGENTS.md` Delivery Rule (the standard cross-platform
  degradation — named here so it is not mistaken for a gap).
- Neutral, because the skill is **layer-1-first** and must **mirror, not fork** the
  layer-2 `requirements-elaboration` vocabulary; the anti-drift cross-reference is
  ongoing maintenance to keep the two vocabularies aligned.

## Pros and Cons of the Options

### (a) More / stronger prose rules — rejected

- Good, because it is trivial to ship (just more words) and needs no new file.
- Bad, because it is **the failure mode itself**: completeness is already asserted
  in ~10 places and still slips. Adding declarations without a detector does not
  make completeness checkable.

### (b) Deterministic deferral-scan script / hook — rejected

- Good, because it would be a real, automatic, deterministic detector.
- Bad, because the product owner ruled it out — **"gates not scripts."**
- Bad, because it **cannot verify the items that matter** — end-to-end
  reachability and companion freshness are judgment calls, not pattern matches.
- Bad, because it would **false-positive** on legitimate "phase 2" / "TODO" prose
  in docs and skills, training authors to ignore it.

### (c) A new dedicated agent — rejected

- Good, because a single agent could own completeness review end to end.
- Bad, because it **overlaps `qa`'s remit** — `qa` already is the blocking quality
  gate. A second reviewer agent splits responsibility and bloats the roster against
  Core Principle 5 (rich but non-overlapping).

### (d) Canonical skill + workflow beats + blocking `qa` gate — chosen

- Good, because it makes completeness a **checkable artifact**, wires it into the
  loop where work actually flows, and lands the enforcement on the **gate that
  already blocks** (`qa`) rather than a new one.
- Good, because it gives the scattered declarations **one canonical procedure to
  point to** (the up-front checklist), rather than leaving the rule asserted in
  many places with no shared operational home. (It adds a procedure and pointers;
  it does not reduce the declaration count — the role-specific cues are kept.)
- Bad, because enforcement is **best-effort prose + a blocking gate**, not a hard
  guarantee (the honest limitation carried over from ADR-0005).

## More Information

- **New skill:** `definition-of-done` (the canonical home for the enumerated,
  arbiter-confirmed acceptance checklist; reachability and companions as line
  items).
- **Wired into:** `orchestration-workflow` (enumerate-&-confirm beat near step 1;
  spec-conformance gate near steps 7–8), `delegation-patterns` (no-unilateral-
  descope + seam-ownership), `kit-review` / the `qa` agent (completeness scan;
  `definition-of-done` preloaded).
- **Cross-platform:** non-Claude tools inherit the principle via the `AGENTS.md`
  Non-Negotiable Delivery Rules ("meet every requirement, fully").
- **Anti-drift:** mirrors the layer-2 `requirements-elaboration` vocabulary
  (`acceptance_criteria` / `non_goals` / `dependencies`) with a cross-reference;
  do not fork it.
- **Related:** [ADR-0005](0005-baked-in-mechanisms-and-two-tier-eval-strategy.md)
  (the enforcement-honesty boundary — LLM-instruction gates are best-effort; a hard
  guarantee needs a hook this decision deliberately does not add).
- **Revisit when:** the gates-not-scripts constraint is relaxed (a deterministic
  reachability/companion detector could then supplement the gate), or the layer-2
  `requirements-elaboration` vocabulary changes (re-sync the mirror).
