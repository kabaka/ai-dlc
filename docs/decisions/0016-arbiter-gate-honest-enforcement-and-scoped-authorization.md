# 0016 — Arbiter-gate honest enforcement boundary and scoped upfront authorization

## Status

Accepted

- Date: 2026-07-17
- Deciders: Product owner (decision authority); Orchestrator + `adr-author`,
  `aidlc-methodologist`

## Context and Problem Statement

[ADR-0005](0005-baked-in-mechanisms-and-two-tier-eval-strategy.md) established the
**arbiter blocking gate as a baked-in mechanism** — a real Claude Code hook that
requires a recorded Decision Record before a phase-transition action may run. That
decision stands. What this ADR corrects is the **prose model** the product ships
around that mechanism, which overclaimed relative to both what the hook can do and
how product owners actually work.

The shipped docs described a **strict, synchronous** gate: the human personally
records every decision, work **stops** at each gate, and (in places) "you must not
author Decision Records." But the installed hook
(`product/templates/hooks/arbiter-gate.sh`) enforces something narrower and purely
mechanical: it checks that a Decision Record **file exists** whose **machine
fields** match the gated action —

- `transition` equals the gate class (only the two command-level classes,
  `construction-to-merge` and `to-operations`, are interceptable),
- `chosen_option` equals `approve` (exact value), and
- `target` references the current branch/tag/release identity (a freshness check
  so a record for a *different* target cannot authorize the action),

and it **fails closed** when `jq` is absent. The hook **cannot** authenticate *who*
authored the record or *when*, and — because the only freshness constraint is
target identity — **one** `approve` record for a target authorizes **every future**
merge or deploy to that same target, non-expiring.

Meanwhile, real practice diverges from the strict prose in the opposite direction:
product owners routinely grant **blanket upfront authorization** ("fix it, open a
PR, merge it") and prefer the agent to complete autonomously; the agent then
**scribes** the Decision Record citing that authorization. The strict docs
overclaimed in both directions at once — asserting an enforcement the hook does not
perform, while forbidding a workflow owners actively want. Under Core Principle 1
(correctness/faithfulness), guidance that misrepresents the mechanism it documents
is a defect as serious as a broken build.

## Decision Drivers

- **Faithfulness to the mechanism (Core Principle 1).** The prose must describe
  exactly what the hook enforces and disclose, honestly, what it does not — no claim
  the hook cannot back.
- **Faithfulness to real practice.** The model must accommodate the legitimate,
  owner-preferred workflow of scoped upfront authorization plus autonomous
  completion, rather than describing a synchronous ritual owners reject.
- **Preserve human authority where it matters.** Genuine design forks,
  high-risk/irreversible units, and deploys must still route to a real human
  decision — proportionality must never dissolve the arbiter's authority.
- **No mechanism churn (Core Principle 4).** The hook, its machine fields, and the
  Decision Record schema are already shipped and installed; a prose reconciliation
  must not force a code, field, or record-format change.

## Considered Options

- **(a)** Reconcile the docs to an **honest enforced-vs-discipline model** — describe
  precisely what the hook enforces, label the rest as discipline the hook cannot
  catch, and legitimize **scoped** upfront authorization. Mechanism unchanged.
- **(b)** **Enforce the strict model** — make agents stop mid-session at every gate
  and require a fresh, human-authored record for each individual action.
- **(c)** **Leave the docs as-is.**

## Decision Outcome

Chosen option: **(a) — reconcile the docs to an honest model; the mechanism is
unchanged.** This **refines** [ADR-0005](0005-baked-in-mechanisms-and-two-tier-eval-strategy.md):
ADR-0005's arbiter hook stands exactly as built; ADR-0016 corrects the prose model
around it and discloses the enforcement boundary honestly. No hook, machine field,
or record-format changes — this is a docs/prose reconciliation only.

The reconciled model has five parts.

1. **Enforced vs. Discipline partition (state both, never blur them).**
   - **ENFORCED (the hook checks it):** a matching `approve` Decision Record exists
     for the two command-level transitions — `construction-to-merge` and
     `to-operations` — with `target` equal to the branch/tag/release identity being
     acted on; the hook **fails closed** without `jq`.
   - **DISCIPLINE (unenforced — the hook reads none of this):** that the record
     reflects a **genuine human authorization**; that `approver` names a human; that
     `rationale` cites the authorizing instruction; per-unit / per-risk / per-time
     scoping; and the **scope-boundary stop** (the agent halts and returns to the
     human when an action falls outside the authorization it was given). The hook
     cannot see any of this; it is honored by discipline, not enforcement.

2. **Authorship vs. timing are different axes.** The Decision Record **artifact**
   may be **agent-scribed** — the human need not type it. What must remain human is
   the **decision** at a genuine fork. Routine, low-risk **forward** actions may be
   **pre-authorized**, so the agent proceeds without a fresh per-action stop. Who
   writes the file and when the human decides are separate questions; conflating them
   produced the "you must not author Decision Records" overclaim, which is retired.

3. **Scoped upfront authorization is legitimate — but only within bounds.** It is
   valid **only** for a `construction-to-merge` action, on a **trivial / low-risk,
   reversible** unit, to a **human-named target**, that resolves **no genuine design
   fork**, and is **traceable to a human instruction** that named the target(s) and a
   maximum risk tier. It is **INVALID** (the agent must stop and return to the human)
   for: Gate-2 **design forks** with real alternatives; **high-risk or irreversible**
   units; **`to-operations`** / deploy / release; or any **unnamed target**.

4. **The breach is fabrication.** The one thing an agent must never do is
   **fabricate or infer an authorization the human never gave** — scribing a record,
   or citing a scope, that no human instruction supports. Because the hook cannot
   detect this, it is the load-bearing discipline of the whole model, and is now
   stated explicitly.

5. **Mechanism unchanged.** No change to the hook, its machine fields, the
   freshness rule, or the Decision Record template. Prose and methodology docs only.

Option (b) was rejected on two grounds: the product owner **rejects** the
synchronous stop-at-every-gate workflow, and enforcing it **exceeds what the hook
can do** — the hook cannot authenticate authorship or timing, so "each action needs
a fresh human-authored record" would itself be an unenforceable claim (the same
faithfulness defect, reversed). Option (c) was rejected because leaving the docs
as-is keeps a Core Principle 1 overclaim in shipped material.

## Consequences

### Positive

- **Honesty about the enforcement boundary.** The docs now say exactly what the
  hook checks (file-exists + machine-field match, fail-closed without `jq`) and
  exactly what it cannot (authorship, timing, genuineness of the authorization) —
  no claim the hook cannot back.
- **The owner-preferred workflow is legitimate.** Scoped upfront authorization plus
  autonomous, agent-scribed completion is now a sanctioned path for trivial,
  reversible merges to a named target — matching how owners actually delegate.
- **Human authority is preserved where it matters.** Genuine design forks,
  high-risk/irreversible units, and all deploys still route back to a real human
  decision; proportionality buys autonomy on the low-risk forward path only.
- **The fabrication prohibition is explicit.** A discipline the hook can never
  catch — inventing an authorization the human never gave — is now named as the
  model's central rule, rather than left implicit.

### Negative

- **The model's integrity rests on unenforced discipline.** The most important rule
  (no fabricated authorization) and the scope boundaries are honored by agent
  discipline, not by the hook — the same honestly-labeled limitation ADR-0005
  accepted for hook-unreachable points, now applied to authorship and scope.
- **Scope judgment is required.** "Trivial / reversible / no genuine fork / named
  target" is a judgment the agent must make correctly each time; a mis-scoped
  self-authorization would pass the hook (the machine fields still match) and is
  caught only by review, not by the mechanism.

### Neutral

- **No code, field, or schema change.** The hook, the machine fields
  (`transition` / `chosen_option` / `target`), the freshness rule, and the
  decision-record template are untouched; only prose and methodology docs move.
- **The non-expiring, target-scoped nature of an `approve` record** (one record
  authorizes every future action against that same target) is a pre-existing
  property of the shipped freshness rule, now documented rather than changed.

## Pros and Cons of the Options

### (a) Reconcile to an honest enforced-vs-discipline model — chosen

- Good, because the prose finally matches the mechanism *and* real practice, closing
  the two-way overclaim.
- Good, because it requires no change to already-installed hooks or records.
- Bad, because it concedes on paper that the model's central safeguards are
  discipline, not enforcement — honest, but it removes the comfort of the strict
  framing.

### (b) Enforce the strict model (stop at every gate; fresh per-action record) — rejected

- Good, because a synchronous human record per action would maximize human
  involvement in principle.
- Bad, because the product owner rejects the workflow, and the hook **cannot**
  authenticate authorship or timing — so "each action needs a fresh human record"
  would be another unenforceable overclaim, not a real enforcement.

### (c) Leave the docs as-is — rejected

- Good, because it is zero effort.
- Bad, because the shipped docs would keep asserting an enforcement the hook does
  not perform while forbidding a workflow owners want — a standing Core Principle 1
  faithfulness defect.

## More Information

- Refines: [ADR-0005](0005-baked-in-mechanisms-and-two-tier-eval-strategy.md) (the
  arbiter blocking gate as a baked-in hook — mechanism unchanged; this ADR corrects
  the prose model and discloses the enforcement boundary).
- Mechanism (unchanged): `product/templates/hooks/arbiter-gate.sh` (the
  file-exists + machine-field match, the target-freshness rule, the fail-closed-on-
  `jq` behavior) and `product/templates/artifacts/decision-record.md` (the machine
  fields `transition` / `chosen_option` / `target` the hook reads).
- Methodology and workflow prose reconciled by this decision: the arbiter-gate
  sections of `product/AGENTS.md` / `product/CLAUDE.md`, the `aidlc-workflow` skill
  and its `reference/arbiter-gate.md`, and `docs/methodology/methodology-spec.md`.
- **Revisit when:** the Claude Code hook model gains a way to authenticate record
  authorship or timing (some discipline items could then become enforced), or the
  freshness rule changes what a single `approve` record authorizes.
