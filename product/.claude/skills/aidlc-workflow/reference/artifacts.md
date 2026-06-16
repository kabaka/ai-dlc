# Phase-handoff artifacts & output contracts

The compact, structured artifacts that carry work across phase boundaries, plus the
Unit-of-Work contract and the enumerated review verdicts. Produce and validate each
handoff against the schema here — the next phase consumes a known shape, not prose.

## Contents

- [The handoff chain](#the-handoff-chain)
- [Unit of Work — the Inception → Construction contract](#unit-of-work)
- [Architecture handoff](#architecture-handoff)
- [Plan handoff](#plan-handoff)
- [Diff + tests handoff](#diff--tests-handoff)
- [Review verdict (enumerated)](#review-verdict)
- [Operations record](#operations-record)

## The handoff chain

Each arrow is a structured artifact handed forward; the receiving stage needs the
producing stage's whole output:

```text
requirements → architecture → plan → diff+tests → review verdict → ops record
```

Keep each artifact compact and structured. These are contracts, not narrative —
the value is that the next agent (or the human at a gate) reads a predictable shape.

## Unit of Work

The **Inception output** and the **Inception → Construction handoff template**. A
parallelizable chunk of value sized to fit a bolt. Ship it as a real artifact (the
`requirements-elaboration` skill produces it; Construction consumes it).

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Stable identifier for the unit. |
| `title` | yes | One-line name of the value delivered. |
| `scope` | yes | What is in this unit — the WHAT, concretely. |
| `acceptance_criteria` | yes | Testable conditions that define "done". Drive the `test-engineer`'s oracle. |
| `non_goals` | yes | What is deliberately excluded — prevents scope creep; faithful to "sized to be parallelizable". |
| `dependencies` | yes (may be empty) | Other units this one needs; supports parallelization decisions. |
| `bolt_time_box` | yes | The intended bolt window (hours–days) for this unit. Documentation/intent field — **not** an enforced timer. |
| `risk_tier` | yes | `trivial` / `standard` / `high-risk` — sets ceremony depth (see `triage.md`). |
| `arbiter_signoff` | yes | Reference to the Inception Decision Record (Gate 1) approving this unit. |

`bolt_time_box` records intent only — there is no timer, burndown, or cutoff in
AI-DLC. See the bolt section of `SKILL.md`.

## Architecture handoff

The `architect`'s output at the design fork — the system **structure** (how it is
shaped). Suggested shape: the chosen design, the components/domain model and their
boundaries, key interfaces/contracts, the alternatives considered and why rejected,
and the risks/assumptions. This artifact is what Gate 2 (design fork) approves.

## Plan handoff

The `planner`'s output — the **sequence** (in what order the unit is built).
Suggested shape: ordered steps, the files/areas each step touches, dependencies
between steps, and the validation each step must pass. Dual `planner`s produce two
plans for the Solo Mob Construction round; the arbiter approves one at Gate 2.

## Diff + tests handoff

The Construction implementation output handed to review. Two coupled parts:

- The **diff** — the `implementer`'s code change for the unit.
- The **grading tests** — owned by `test-engineer` (the oracle), derived from the
  unit's `acceptance_criteria`. The **implementer never edits these** (see the
  "don't edit the oracle" rule in `SKILL.md`).

## Review verdict

The `code-reviewer`'s pre-merge output: the independent intent-vs-letter check plus
**one enumerated verdict**. The enumeration keeps routing deterministic:

| Verdict | Meaning | Next |
| --- | --- | --- |
| `APPROVE` | Code satisfies the unit's intent and the oracle; safe to merge. | Proceed to Gate 3 (merge). |
| `REQUEST_CHANGES` | Defects or gaps; not mergeable as-is. | Back to `implementer`; re-review. |
| `ESCALATE_SECURITY` | A security concern beyond the in-line lens. | Hand off to `security`; resolve before Gate 3. |
| `BLOCK` | A fundamental problem (wrong approach, broken oracle, scope mismatch). | Stop; escalate to the human arbiter. |

The verdict is the review-stage handoff. A gate (Gate 3) still requires a human
Decision Record — `APPROVE` does not open the gate by itself.

## Operations record

The `devops` output at deploy/release: what was deployed, where, the
deploy/rollback method, monitoring/health signals to watch, and a link to the Gate 4
Decision Record authorizing it. Operations runs under standing human oversight (no
ceremony); this record is the audit trail for each change shipped.
