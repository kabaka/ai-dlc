# 0005 — The five baked-in mechanisms and the two-tier eval strategy

## Status

Accepted

- Date: 2026-06-16
- Deciders: Product owner (decision authority); Orchestrator +
  `aidlc-methodologist`, `tooling-engineer`, `prompt-engineer`

## Context and Problem Statement

The methodology spec (`product/docs/methodology-spec.md`) defines several
properties the product must **guarantee**, not merely suggest: the human-arbiter
gate, proportional ceremony depth, structured phase handoffs, citation integrity,
and an independent verifier. The repo's own delivery rules say must-run behavior
needs a real mechanism, not a probabilistic LLM instruction. Separately, we must
decide how these mechanisms are **validated**: this repo has no model in CI, so any
"behavioral" CI gate would be a fake (a forbidden anti-pattern). We need to decide
both *what gets baked in and how* and *what "tested" honestly means* here.

## Decision Drivers

- **Faithfulness & honesty (Core Principle 1).** A guarantee must be real; prose
  that claims must-run behavior an LLM might skip is a defect. No fakes.
- **Reliable mechanism over probabilistic instruction (Core Principle 2).** Gates
  that must hold need enforcement (a hook), not an LLM's good intentions.
- **Methodology fidelity.** The baked-in mechanisms must realize the spec's
  arbiter gate, triage tiers, handoff contracts, citation gate, and verifier split
  exactly as written, with deviations stated honestly.
- **Verifiable validation.** Validation must genuinely exercise behavior where it
  claims to, and must never imply verification it did not perform.

## Considered Options

For the mechanisms: **(a)** bake in real enforcement where reachable (a hook) plus
honest "strongly instructed" prose only where a hook cannot reach, versus
**(b)** rely on prose/LLM instruction alone for all gates.

For the evals: **(c)** two honest tiers — a deterministic CI linter plus manual
model-in-the-loop behavioral evals — versus **(d)** a single CI "eval" suite that
claims to verify triggering/behavior.

## Decision Outcome

Chosen: **(a) real enforcement where reachable + honest prose elsewhere**, and
**(c) a two-tier eval strategy**. Prose-only gates **(b)** and a CI-claims-behavior
suite **(d)** are rejected as fakes under Core Principle 1.

**The five baked-in mechanisms:**

1. **Arbiter blocking gate — enforced by a real Claude Code HOOK** the installer
   wires. The hook checks for a recorded **Decision Record** before phase-transition
   actions; where a hook cannot reach, the product uses **honest "strongly
   instructed" prose** — never prose alone for the gate itself.
2. **Complexity-triage tiers** that scale **ceremony depth** to `risk_tier` but
   **NEVER** the human arbiter gate (the gate holds at every tier).
3. **Phase-handoff output contracts** — compact structured artifacts, including the
   **Unit-of-Work contract** — carrying work across phase boundaries.
4. **A hardened citation-verification gate** run by `research-synthesizer`.
5. **"Don't edit the oracle" / independent-verifier** via the
   `implementer` / `test-engineer` split (implementer may not edit grading tests;
   test-engineer owns the oracle).

**The two-tier eval strategy (both honest, neither overclaims):**

- **Tier 1 — deterministic CI-runnable eval-record LINTER.** Validates eval-record
  **schema** and flags **anti-patterns**. It makes **NO behavioral claim** — it
  checks that records are well-formed, not that any behavior occurred.
- **Tier 2 — MANUAL model-in-the-loop triggering/behavior evals**, with **recorded
  pass-rate artifacts**. These are the only checks that exercise actual triggering
  and behavior, and they run with a human/model in the loop, not in CI.

**CI green never implies triggering was verified.** The linter passing says nothing
about whether agents/skills fire correctly; only the manual Tier-2 evals do.

## Consequences

- Good, because the **arbiter gate is genuinely enforced** by a hook where it
  matters, satisfying the repo's "must-run behavior needs a hook" rule rather than
  trusting a probabilistic instruction.
- Good, because **triage never weakens the gate** — proportionality buys speed on
  ceremony depth without ever trading away the human decision point.
- Good, because the **eval strategy is honest**: a deterministic linter that admits
  it checks form only, plus manual behavioral evals that actually exercise behavior
  — no CI check pretends to verify triggering.
- Bad, because **Tier-2 evals cannot gate CI** (no model in CI). Behavioral
  regressions are caught only when the manual evals are run; this is a real,
  accepted limitation, stated plainly rather than papered over with a fake gate.
- Bad, because the **hook adds installer surface** (the installer must wire it) and
  a corresponding `security` review obligation (it runs on consumer machines).
- Neutral, because the **"strongly instructed" prose** at hook-unreachable points
  must be honestly labeled as best-effort, not enforcement — authors must not
  overstate it.

## Pros and Cons of the Options

### (a) Real enforcement (hook) + honest prose where unreachable — chosen

- Good, because the gate that must hold actually holds; prose is used only where no
  mechanism can reach, and is labeled as such.
- Bad, because a hook is more to build, wire, and security-review than prose.

### (b) Prose / LLM instruction alone — rejected

- Good, because it is trivial to ship (just words).
- Bad, because a blocking gate enforced only by an LLM instruction is
  **probabilistic** — the model can skip it. The repo's own rule forbids this for
  must-run behavior. It would be a fake guarantee.

### (c) Two honest eval tiers — chosen

- Good, because each tier is truthful about what it verifies; CI stays
  deterministic and behavioral evals stay real.
- Bad, because behavioral coverage depends on someone running the manual tier.

### (d) Single CI suite claiming to verify behavior — rejected

- Good, because it would look like a clean, automated quality gate.
- Bad, because **there is no model in CI** — such a suite cannot exercise triggering
  or behavior. It would assert verification it never performed: a forbidden fake.

## More Information

- Spec: `product/docs/methodology-spec.md` (§4 arbiter/Decision Record and blocking
  semantics, §5 triage tiers, §3 Unit-of-Work contract, the independent-verifier
  split).
- Skills: `kit-validation` (the two-tier static-vs-behavioral model),
  `skill-evaluation` (model-in-the-loop triggering/behavior evals),
  `installer-design` (wiring the hook), `security-review` (reviewing the hook that
  runs on consumer machines).
- Agents: `tooling-engineer` (the linter and eval harness),
  `research-synthesizer` (the citation gate), `test-engineer` / `implementer`
  (the oracle split).
- Related: [ADR-0004](0004-consumer-agent-roster-and-security-documentation-hybrid.md)
  (the roster, including the implementer/test-engineer split that realizes the
  verifier mechanism); [ADR-0006](0006-installer-idempotent-merge-and-consumer-file-preservation.md)
  (the installer that wires the arbiter hook).
- **Revisit when:** a model becomes runnable in CI (Tier-2 could then gate), or the
  Claude Code hook model changes what a hook can intercept at phase transitions.
