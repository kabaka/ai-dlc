---
name: definition-of-done
description: Enumerates an arbiter-confirmed acceptance checklist UP FRONT that makes "every requirement met" falsifiable, and decides "are we done" against it. Use when asked to build/implement X fully wired or to spec with no v2/no deferral, to define or confirm an acceptance checklist before work starts, or to judge "is this actually done or did we defer something" — covers requirement coverage, end-to-end reachability (every capability has a named user-reachable path, no orphan API-with-no-UI), and companion docs/tests/changelog updated in the same effort. Proportional: trivial changes get a one-line checklist. The canonical home for the no-deferral rule. Not for refining a fuzzy ask (brainstorming), sequencing the build (implementation-planning), or reviewing a finished change (kit-review/qa).
---

# Definition of Done

A **Definition of Done (DoD)** is an enumerated **acceptance checklist** you
produce UP FRONT — at planning, before substantial authoring — and re-check
before anyone claims "done." This skill is the canonical home of the kit's
**no-deferral rule**: it operationalizes the `AGENTS.md` delivery rule *"meet
every requirement, fully"* by turning an implicit "looks done" into an explicit,
checkable list the human **arbiter** signs off on.

The DoD makes that delivery rule **falsifiable**. The enumerated list is the
**acceptance criteria** for a kit deliverable — the same acceptance-criteria
primitive AI-DLC attaches to a unit of work, applied to a kit change (a skill,
agent, script, or orchestrator edit). Only the product owner (reviewing the
Orchestrator) approves done — **AI checks, the human decides.**

This is a **kit convention**, not an AWS-named ceremony, value, or artifact:
AI-DLC prescribes no Definition of Done. It is the kit-builder layer's discipline
for not silently dropping scope, built during **Mob Elaboration** (our
dual-planning + adversarial review).

## When to use

- The request says build/implement X **fully wired**, **to spec**, with **no v2**,
  **no "later phase,"** no deferral.
- You need to **define or confirm** the acceptance checklist before work starts.
- You're judging **"is this actually done, or did we defer something?"**

Stay in this lane — see [Routing boundary](#routing-boundary).

## The primitive: an up-front, arbiter-confirmed checklist

Produce the checklist at planning time, before substantial authoring. Each item is
**testable, binary, observable** — a box that is checked or unchecked, never "ish."
Confirm it with the arbiter, then re-check every item before claiming done.

```text
Definition of Done — <change name>
Requirement coverage:
  - [ ] R1: <one stated requirement, observably satisfied>
  - [ ] R2: ...
End-to-end reachability:
  - [ ] <capability> reachable via <named path: skill/command/agent/caller>
Companion freshness (same effort):
  - [ ] Docs updated: <files>
  - [ ] Tests/evals updated or added: <which>
  - [ ] CHANGELOG entry added
  - [ ] Cross-references resolve: <links>
Non-goals / out of scope:
  - <explicitly excluded — NOT done here, by design>
Dependencies:
  - [ ] <thing this points to> exists and is reachable
```

## The three line-item families (weighted equally)

Every non-trivial DoD carries all three. Dropping any one is the failure mode this
skill exists to prevent.

1. **Requirement coverage.** One item per stated requirement; nothing silently
   dropped. If the request lists five things, the checklist has at least five
   coverage items.

2. **End-to-end reachability.** Every capability has a **named user-reachable
   path** — a skill, slash command, agent route, installer step, or explicit
   caller. An API/function/skill with no UI/CLI/caller path is an **incomplete
   item, not a done one** (no orphan "API with no UI"). The named path is an
   **arbiter-confirmed assertion, not a machine-verified fact** — you assert the
   path and the human confirms it; nothing mechanically proves end-to-end
   reachability.

3. **Companion freshness.** Docs, tests/evals, `CHANGELOG`, and cross-references
   are updated **in the same effort** — each is its own line item so staleness
   shows up as a visible unchecked box rather than slipping through unnoticed.

## Non-goals and dependencies-as-reachability

Every DoD also carries an explicit **non-goals / out-of-scope** list — naming what
is deliberately excluded prevents silent scope creep in *either* direction (you
neither drop a real requirement nor smuggle in unscoped work).

Treat **dependencies as reachability**: an item is **not done if a thing it points
to is unreachable.** A skill that references `reference/foo.md`, a cross-link, or a
script path is incomplete until that target exists and resolves.

## Proportionality (binding)

Scale the checklist to the request, exactly as `orchestration-workflow` scales the
process to the request. A **trivial change — a typo, a one-line copy fix, a tiny
obvious wording change** — uses a **one-line checklist or none.** A new skill,
agent, or any change with more than one moving part uses the full three-family
checklist.

The loop must still converge: proportionality keeps the DoD from turning a
one-line fix into ceremony. But the threshold is concrete — *more than a single
obvious edit ⇒ full checklist* — so "it's trivial" cannot become an escape hatch
for shipping a real feature half-wired.

**CRITICAL:** deciding a change is trivial enough to skip the full checklist is an
**arbiter decision, not an author or Orchestrator self-declaration.** The
Orchestrator may *propose* "this is trivial"; the arbiter confirms it.

## Descope discipline

**No checklist item may be dropped or deferred by the Orchestrator or any
specialist.** A descope is a critical decision only the **arbiter** (the product
owner reviewing the Orchestrator) may approve.

- **AI proposes, human decides.** A specialist that believes an item should be cut
  surfaces it as a proposed descope with rationale — it does not act on it.
- **Batch, never trickle.** Collect proposed descopes into **one arbiter
  checkpoint** rather than draining scope item-by-item across the work. One
  decision, one record of what the human agreed to drop.

## Honest enforcement framing

State this plainly to anyone relying on the DoD: **enforcement is
strongly-instructed prose plus the blocking `qa` gate — not a deterministic
guarantee.** The checklist's *existence* and *completeness* are confirmed by the
arbiter and checked by `qa`; they are **not mechanically enforced.** Nothing in
the kit programmatically proves every requirement was met or every path is
reachable. This is consistent with ADR 0005 and ADR 0009: the DoD raises the floor
and makes gaps visible, but the human arbiter remains the final authority on
"done."

## Relationship to the product-layer contract (anti-drift)

> This skill applies the **acceptance-criteria**, **non-goals**, and
> **dependencies** vocabulary of the product-layer Unit-of-Work contract
> (`product/.claude/skills/requirements-elaboration/SKILL.md`) to **kit
> deliverables** — a skill, agent, script, or orchestrator change — rather than
> product units of work. We **mirror that vocabulary, never fork it**. We
> deliberately do **not** adopt that contract's `arbiter_signoff`, `risk_tier`,
> `bolt_time_box`, or the four-gate Decision-Record machinery — those govern the
> shipped product's lifecycle, not kit authoring.

So this skill borrows three terms (acceptance criteria, non-goals, dependencies)
and nothing else. Do not import Decision Records, `.ai-dlc/records/`, gate numbers,
`risk_tier`, `bolt_time_box`, or any hook — those are layer-2 product machinery,
not kit-builder convention.

## Routing boundary

The DoD does two things and only two: **enumerate/confirm the checklist up front**,
and **judge "are we done" against it.** It is:

- **Not `brainstorming`** — that refines a fuzzy ask into a sharp problem statement.
- **Not `implementation-planning`** — that sequences the build; planning *seeds*
  the DoD with the requirement list, but ordering work is its job, not this one's.
- **Not `kit-review` / `qa`** — those review a *finished* change. The DoD is the
  standard `qa` checks the change against; it is not the review pass itself.

## Cross-references

- `orchestration-workflow` — where the enumerate/confirm beats and the
  spec-conformance re-check live in the canonical loop.
- `implementation-planning` — seeds the checklist with the requirement list and
  the validation plan.
- `kit-review` and the `qa` agent — the blocking gate that checks the checklist
  against the finished change.
- `aidlc-methodology` — the acceptance-criteria / arbiter lineage this convention
  descends from.
