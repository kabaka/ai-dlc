# 0011 — The layer-2 spec-completeness convention (`spec-conformance`) over native unit-of-work primitives

## Status

Accepted

- Date: 2026-06-21
- Deciders: Product owner (decision authority); Orchestrator + `skill-author`,
  `aidlc-methodologist`, `qa`

## Context and Problem Statement

Layer-2 consumer applications built with the kit ship **incomplete** in three
recurring ways:

- **Deferred scope** — work quietly slips to a "later phase" instead of being met
  in the same effort, contradicting the AGENTS.md Non-Negotiable Delivery Rules.
- **Orphan features** — a capability is built but never wired end-to-end (an API
  with no caller, a component nothing routes to), so it is unreachable in practice.
- **Stale companions** — the change lands but its docs, tests, and `CHANGELOG` are
  not updated alongside it.

The product already carried the *intent* (the no-deferral Delivery Rule in
`AGENTS.md`, the `testing-strategy` oracle proving acceptance criteria, the
`code-review` verdict). But completeness was **distributed** across `planner`,
`test-engineer`, and `code-reviewer` with **no whole-unit "is this done?"
convention** and **no end-to-end reachability evidence**. Each agent checked its
own slice; nothing asked, for the unit as a whole, "is every requirement covered,
is every capability reachable, are the companions fresh, and was anything silently
deferred?" [ADR-0010](0010-layer2-design-system-and-ui-bearing-completeness.md)
recorded this layer-2 completeness convention as a **later slice**; this is that
slice. A decision is needed on how to make whole-unit completeness checkable
without forking the layer-1 mechanism, bloating the roster, or adding a gate.

## Decision Drivers

- **Correctness & faithfulness (Core Principle 1).** Completeness must be checked
  against something concrete — the unit's own contract — not asserted; and the
  convention must honestly label what it does and does not guarantee.
- **Reliable triggering & orchestration (Core Principle 2).** The check must fire
  at a real beat in the lifecycle (merge), routed through an agent that already
  runs there, not sit as inert prose or depend on a never-loaded skill.
- **No new ceremony (methodology-fidelity constraint).** The AI-DLC loop's four
  arbiter gates are fixed. Raising completeness must reuse the **existing** Gate 3
  (merge) and the **existing** `code-reviewer` verdict — no new gate, verdict,
  ceremony, or agent.
- **Reusability & non-overlap (Core Principles 4–5).** The convention must
  **mirror, not fork** the layer-1 `definition-of-done`
  ([ADR-0009](0009-definition-of-done-spec-completeness.md)), and must not
  duplicate `testing-strategy`, `code-review`, or `requirements-elaboration`. It
  should express itself over the **native** layer-2 unit-of-work primitives
  (`acceptance_criteria` / `non_goals` / `dependencies`).
- **Prevent orphans by construction.** A merge-time check catches orphans late;
  the cheaper fix is to make end-to-end reachability a design-time habit so orphans
  are largely never built.

## Considered Options

- **(a)** **Import the layer-1 `definition-of-done` skill** into layer 2.
- **(b)** A **new verification agent / a new completeness gate** that owns the
  whole-unit "is this done?" check.
- **(c)** **Leave completeness distributed** across `planner` / `test-engineer` /
  `code-reviewer` as today.
- **(d)** A **`spec-conformance` skill** — an enumerated acceptance checklist over
  the native unit-of-work primitives — **applied by `code-reviewer` and folded into
  its existing verdict at the existing Gate 3**, with vertical-slice and
  walking-skeleton woven into `requirements-elaboration` and `implementation-planning`
  to prevent orphans by construction.

## Decision Outcome

Chosen: **(d)**. We add a layer-2 **`spec-conformance` skill** that owns an
**enumerated acceptance checklist** expressed over the **native**
`acceptance_criteria` / `non_goals` / `dependencies` fields, covering:

- **Requirement coverage** — every `acceptance_criteria` item is met, every
  `non_goals` item is honored.
- **End-to-end reachability** — every capability has a named user-reachable path;
  no orphan (no API with no caller, no component nothing routes to).
- **Companion freshness** — docs, tests, and `CHANGELOG` are updated in the same
  effort as the change.
- **A converge / anti-deferral diff** — what the unit promised vs. what it
  delivered, so silently dropped or deferred scope is surfaced rather than lost.
- **"Show, don't assert" evidence** — the unit is demonstrated (the app is run,
  the path is exercised), not merely claimed done.

It is wired into the operating model with **no new mechanism**:

- **`code-reviewer` applies `spec-conformance`** and **folds the result into its
  EXISTING enumerated verdict** (`APPROVE` / `REQUEST_CHANGES` / `ESCALATE_SECURITY`
  / `BLOCK`) at the **EXISTING Gate 3** (merge). Unmet or silently deferred items
  become `REQUEST_CHANGES`. The skill is **preloaded on `code-reviewer`** so the
  convention is always loaded at the gate. **No new gate, no new verdict, no new
  agent.**
- **Vertical-slice and walking-skeleton** discipline is woven into
  `requirements-elaboration` (units are sliced as thin end-to-end increments) and
  `implementation-planning` (a walking skeleton wires the seam first), so
  reachability holds **by construction** and orphans are largely never built.
- **"Show, don't assert"** run-the-app evidence is woven into `testing-strategy`,
  so demonstration — not assertion — is the norm the reviewer checks against.

Options (a)–(c) are rejected:

- **(a) Import layer-1 `definition-of-done` — rejected.** It would **fork** the
  layer-1 mechanism into layer 2 and create a second home to keep in sync. The
  product **already** carries the no-deferral rule in `AGENTS.md` and proves
  acceptance criteria through the `testing-strategy` oracle; the right move is to
  **express the convention over the native layer-2 primitives**, mirroring (not
  copying) layer-1, with an anti-drift cross-reference.
- **(b) New verification agent / new gate — rejected.** It **overlaps**
  `code-reviewer` (the pre-merge gate) and `test-engineer` (the oracle), splitting
  responsibility and bloating the roster against Core Principle 5. Routing the
  convention through the **existing** verdict, skill-first, achieves the same
  outcome without new surface.
- **(c) Leave completeness distributed — rejected.** This is the actual gap: no
  whole-unit reachability or companion check exists, so orphans and stale
  companions slip through precisely because no single beat owns "is the unit, as a
  whole, done?"

### Consequences

- Good, because completeness is now a **named convention checked at merge** against
  the unit's own contract — the whole-unit reachability and companion checks that
  were missing now exist.
- Good, because it lands on the **existing `code-reviewer` verdict at the existing
  Gate 3** — no new gate, verdict, ceremony, or agent, so the AI-DLC loop and
  roster stay intact (Core Principles 2, 5).
- Good, because vertical-slice + walking-skeleton **prevent orphans by
  construction** in `requirements-elaboration` and `implementation-planning`, so
  the merge-time check is a backstop, not the only defense.
- Good, because it **mirrors, not forks**, layer-1
  [ADR-0009](0009-definition-of-done-spec-completeness.md) and expresses itself
  over **native** primitives, giving a single source of truth per layer with an
  anti-drift cross-reference (Core Principle 4).
- Bad, because **enforcement is the EXISTING `code-reviewer` verdict plus the human
  arbiter — NOT a new deterministic mechanism.** Consistent with
  [ADR-0009](0009-definition-of-done-spec-completeness.md), an LLM-instruction
  convention is best-effort; the verdict can request changes but cannot prove
  completeness machine-deterministically.
- Bad, because **end-to-end reachability is an arbiter-confirmed / evidenced
  assertion, not a machine-verified fact** — the reviewer demonstrates a path
  (show, don't assert) and the arbiter confirms it; there is no detector proving a
  seam is wired.
- Neutral, because the **deterministic visual-QA + patch-coverage TOOLING and the
  stack auto-binding are a LATER slice** — this slice ships the convention and its
  wiring, not the deterministic detectors. Honest sequencing, not a hidden gap.
- Neutral, because the convention lives in `.claude/` and is therefore
  **Claude-Code-first**; non-Claude tools inherit only the *principle* via the
  canonical `AGENTS.md` Delivery Rule (the standard cross-platform degradation).

## Pros and Cons of the Options

### (a) Import the layer-1 `definition-of-done` skill — rejected

- Good, because it would reuse an already-authored, reviewed mechanism verbatim.
- Bad, because it **forks** layer-1 into layer 2 — two homes for one convention,
  an ongoing sync liability against the single-source-of-truth model.
- Bad, because the product **already** carries no-deferral in `AGENTS.md` and the
  oracle proves acceptance criteria; the gap is a whole-unit convention over the
  **native** primitives, which a verbatim import does not express.

### (b) New verification agent / new gate — rejected

- Good, because a dedicated owner could carry whole-unit completeness end to end.
- Bad, because it **overlaps `code-reviewer`** (the pre-merge gate) and
  **`test-engineer`** (the oracle), splitting responsibility and bloating the
  roster (Core Principle 5).
- Bad, because a new gate **adds ceremony** the methodology-fidelity constraint
  forbids; the existing Gate 3 and verdict already run at merge.

### (c) Leave completeness distributed — rejected

- Good, because it changes nothing and adds no surface.
- Bad, because it is **the failure mode itself**: with completeness split across
  `planner` / `test-engineer` / `code-reviewer`, **no beat owns the whole-unit
  reachability and companion-freshness check**, so orphans and stale companions
  slip through.

### (d) `spec-conformance` skill applied by `code-reviewer` at the existing verdict/gate — chosen

- Good, because it makes completeness a **checkable, enumerated convention** over
  the unit's native contract, fires at the **merge beat where `code-reviewer`
  already runs**, and lands on the **gate and verdict that already exist**.
- Good, because vertical-slice + walking-skeleton in elaboration and planning
  **prevent orphans by construction**, not just catch them late.
- Good, because it **mirrors, not forks**, layer-1 and adds **no new gate, verdict,
  ceremony, or agent**.
- Bad, because enforcement is the **existing verdict + human arbiter**, not a new
  deterministic mechanism, and reachability remains an **evidenced/confirmed
  assertion** (the honest limitation carried from ADR-0009).

## More Information

- **New skill:** `spec-conformance` (the layer-2 whole-unit completeness
  convention: requirement coverage, end-to-end reachability, companion freshness, a
  converge / anti-deferral diff, and "show, don't assert" evidence, over the native
  `acceptance_criteria` / `non_goals` / `dependencies` primitives).
- **Wired into (no new mechanism):** `code-review` / the `code-reviewer` agent
  (applies the convention; folds it into the **existing** enumerated verdict at the
  **existing Gate 3**; `spec-conformance` **preloaded**); `requirements-elaboration`
  and `implementation-planning` (vertical-slice + walking-skeleton to prevent
  orphans by construction); `testing-strategy` (run-the-app "show, don't assert"
  evidence).
- **Reuses, does not add:** the **existing** Gate 3 (merge) and the **existing**
  `code-reviewer` verdict. No new gate, verdict, ceremony, or agent.
- **Honest boundary:** enforcement is the existing `code-reviewer` verdict plus the
  human arbiter, **not** a new deterministic mechanism; reachability is an
  arbiter-confirmed / evidenced assertion. The deterministic **visual-QA +
  patch-coverage tooling** and **stack auto-binding** are a **later slice**.
- **Mirrors, does not fork:** layer-1
  [ADR-0009](0009-definition-of-done-spec-completeness.md) (`definition-of-done`);
  expressed over native layer-2 primitives with an anti-drift cross-reference.
- **Related:** [ADR-0010](0010-layer2-design-system-and-ui-bearing-completeness.md)
  (recorded this layer-2 spec-completeness convention as a later slice — this ADR
  implements that direction); [ADR-0009](0009-definition-of-done-spec-completeness.md)
  (the layer-1 mechanism this mirrors).
- **Revisit when:** the deterministic visual-QA / patch-coverage tooling and stack
  auto-binding slice is designed (likely a follow-up ADR), or the native
  unit-of-work vocabulary changes (re-sync the mirror).
