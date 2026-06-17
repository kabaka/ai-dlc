# 0008 — Observability agent and practice/domain guidance skills

## Status

Accepted

- Date: 2026-06-17
- Deciders: Product owner (decision authority); Orchestrator + `agent-author`,
  `skill-author`, `aidlc-methodologist`, `prompt-engineer`

## Context and Problem Statement

The consumer roster ([ADR-0004](0004-consumer-agent-roster-and-security-documentation-hybrid.md))
covered the lifecycle but left several real practice concerns thin: production
**observability** (instrumentation, SLOs, OpenTelemetry design) was folded into
`delivery-operations`/`devops` as a deploy-time afterthought; **dependency / license
compliance**, **test-strategy selection** (TDD and its alternatives, plus the AI /
test-oracle angle), and **UX design** had no home at all. Two forces pull in
opposite directions. First, observability design is substantial enough that burying
it in a deploy checklist under-serves it. Second, the methodology is **fixed at three
phases, two ceremonies, and four blocking gates**
(`product/docs/extension-methodology-notes.md`) — so new concerns must **not** become
new phases, ceremonies, or gates. We must decide which concerns **earn an agent**,
which ship as **guidance skills**, and how to keep routing unambiguous (Core
Principle 2) without inflating the gate model (Core Principle 1).

## Decision Drivers

- **"Earns a seat."** An agent is justified only by a distinct, delegable
  responsibility with enough depth that a skill alone under-serves it.
- **No new phases/ceremonies/gates.** Faithfulness to the fixed methodology model is
  the binding constraint (Core Principle 1; the extension-methodology ruling).
- **Unambiguous routing.** New agents/skills must not cross-fire with existing ones
  (`devops`, `security`, `architect`, `requirements-analyst`) — Core Principle 2.
- **Right-sizing.** Practice/domain concerns that are advisory belong in **guidance
  skills**, not in mandatory mechanics.

## Considered Options

- **(a)** Promote **observability to a first-class agent** (carving the design
  content out of `delivery-operations` into a new `observability-practice` skill so
  there is no duplication), and ship the other practice/domain concerns as
  **on-demand guidance skills** (`dependency-compliance`, a `testing-strategy`
  extension, a bounded `ux-design`) whose recommended checks **nest in existing
  checklists** — adding **no** phase, ceremony, or gate.
- **(b)** Keep observability inside `devops`/`delivery-operations`; add the others as
  skills only.
- **(c)** Make each concern (dependency-compliance, observability readiness) a new
  **release/compliance gate**.

## Decision Outcome

Chosen option: **(a)**, because it gives observability the dedicated owner the
product owner judged it earns, eliminates the `devops` overlap by **carving the
design content into a skill**, and ships the remaining concerns as advisory guidance
that informs existing gates without inflating the four-gate model.

**`observability` becomes a first-class agent (Operations phase).** It owns
instrumentation, SLO, and OpenTelemetry **design**. We chose an **agent over a
skill** because the product owner judged this the strongest "earns a seat" case in
the batch: it is a distinct, delegable design responsibility, not just advice. Per
the extension-methodology ruling, observability is an **Operations-phase concern that
begins in Construction — instrument as you build** — and it is **standing
instrumentation/measurement work, not a ceremony** (Operations has no mob ceremony).

**Overlap resolved by a content carve + sharp descriptions.** The observability
**design** content is **carved out of `delivery-operations`** into a new
**`observability-practice`** skill (preloaded by the agent). `delivery-operations`
keeps **deploy-time consumption** (wiring/readiness at ship time). `devops` **cedes
monitoring/observability** to the new agent. Routing: `observability` designs the
instrumentation; `devops` deploys and runs it.

**Practice/domain concerns ship as guidance skills — not phases or gates.**

- **`dependency-compliance`** (license / SBOM) — on-demand; surfaces **recommended,
  non-blocking** checks that nest in the `delivery-operations` pre-deploy checklist
  and the `security-review` supply-chain lens. Explicitly **not legal advice**.
- **A `testing-strategy` extension** — a **TDD-and-alternatives selection framework**
  plus the **AI / test-oracle angle** (how the independent-verifier oracle interacts
  with AI-written code).
- **A bounded `ux-design` skill** — scoped UX guidance, routed away from
  `architecture-design` (system structure) and `requirements-elaboration` (WHAT/WHY).

**The gate model is unchanged.** Per the ruling: **recommended checks nest inside
existing checklists; the four blocking arbiter gates are unchanged.** No addition
here is a gate, is wired into the arbiter-gate hook, or is worded to read as
blocking; findings are surfaced to the arbiter at an **existing** gate.

### Consequences

- Good, because observability gets a **dedicated design owner** with no duplication —
  the design content lives once, in `observability-practice`, consumed by both the
  agent and (at ship time) `delivery-operations`.
- Good, because the **four-gate model is preserved**: the new compliance and
  readiness checks are recommended inputs inside existing checklists, faithful to the
  fixed methodology.
- Good, because practice/domain concerns are **right-sized as guidance skills** — no
  heavyweight agent for advisory work, no new mandatory mechanics.
- Bad, because the roster grows **12 → 14 agents** (`kit-extender` from
  [ADR-0007](0007-consumer-kit-self-extension-via-propose-for-approval-generator.md),
  `observability` here), tightening the routing-boundary budget: `observability` vs
  `devops`, `dependency-compliance` vs `security-review`, and `ux-design` vs
  `architecture-design`/`requirements-elaboration` must all stay mutually exclusive,
  proven by near-miss evals.
- Neutral, because the `delivery-operations` ↔ `observability-practice` split must be
  maintained as a clean **design vs deploy-time** seam; if the carve blurs, the two
  could re-overlap.

## Pros and Cons of the Options

### (a) Observability agent (with content carve) + guidance skills — chosen

- Good, because it right-sizes each concern: an agent where depth earns it, skills
  where advice suffices, and no new gates.
- Good, because the content carve removes the `devops`/`delivery-operations` overlap
  at the source rather than papering over it with descriptions alone.
- Bad, because two more routing boundaries must be held mutually exclusive by evals.

### (b) Keep observability in `devops`; others as skills only — rejected

- Good, because it adds no agent and the smallest routing surface.
- Bad, because it leaves observability design **under-served** as a deploy-checklist
  afterthought — the product owner judged it earns a dedicated owner.

### (c) New release/compliance gates — rejected

- Good, because a gate would make compliance/readiness unmissable.
- Bad, because it **violates the fixed four-gate model** (the binding faithfulness
  constraint); these concerns are recommended inputs to existing gates, not new
  blocking points.

## More Information

- Binding ruling: `product/docs/extension-methodology-notes.md` §2 (observability =
  Operations, instrumented from Construction, no ceremony) and §3 (recommended checks
  nest in existing checklists; four gates unchanged).
- Skills: new `observability-practice` (carved from `delivery-operations`);
  `dependency-compliance`; the `testing-strategy` extension; the bounded `ux-design`
  skill. `description-engineering` and `skill-evaluation` prove the new routing
  boundaries.
- Related: [ADR-0002](0002-installer-primary-plugin-secondary-distribution.md) (the
  installer ships these skills/agents to consumers) and
  [ADR-0004](0004-consumer-agent-roster-and-security-documentation-hybrid.md) (the
  roster and hybrid model this extends; the same near-miss-eval discipline applies).
- **Revisit when:** near-miss evals show irreducible cross-fire (`observability` vs
  `devops`, or any new skill against an existing one), or a guidance skill proves it
  needs a dedicated agent of its own.
