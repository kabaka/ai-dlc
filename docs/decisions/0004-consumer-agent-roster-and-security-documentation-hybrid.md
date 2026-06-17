# 0004 — Consumer agent roster and the security/documentation hybrid

## Status

Accepted — amended by [ADR-0007](0007-consumer-kit-self-extension-via-propose-for-approval-generator.md)

- Date: 2026-06-16
- Deciders: Product owner (decision authority); Orchestrator + `agent-author`,
  `prompt-engineer`, `aidlc-methodologist`

> **Amendment ([ADR-0007](0007-consumer-kit-self-extension-via-propose-for-approval-generator.md)).**
> This ADR's stance that "consumers need lifecycle agents, not kit-authoring agents"
> stands for the **layer-1 kit-builder roster**. ADR-0007 adds **one deliberate,
> scoped exception**: a `kit-extender` agent that lets a consumer extend **their own**
> installed kit for **their own** repo, on a bounded, propose-for-approval basis. It
> is not a reversal of the core rejection here — see ADR-0007 for the argument.

## Context and Problem Statement

The deliverable product (layer 2) ships an agent roster for **consumers** running
the AI-DLC lifecycle on their own code. The layer-1 kit-builder roster
(`skill-author`, `orchestration-designer`, `prompt-engineer`, …) is the wrong shape
for consumers: they need **lifecycle** agents (requirements, architecture,
implementation, testing, review, ops), not kit-authoring agents. We must define the
consumer roster, resolve the inevitable responsibility overlaps so routing stays
reliable (Core Principle 2), and decide how security and documentation work are
covered — both are sometimes a heavy, dedicated effort and sometimes a light,
in-line concern, and a single answer for each would either over-weight trivial work
or under-serve critical work.

## Decision Drivers

- **Reliable triggering & routing.** Agents must route unambiguously; overlapping
  responsibilities cause cross-fire and dead agents (Core Principle 2).
- **Faithfulness to the methodology.** The roster must serve Inception →
  Construction → Operations and the human-as-arbiter / independent-verifier model
  (`product/docs/methodology-spec.md`; Core Principle 1).
- **Right-sizing.** Security and documentation effort spans trivial-to-critical;
  the model must scale without either extreme being mishandled.
- **Least privilege.** Read-only gates and diagnosers get no write access; only
  authoring/implementing agents mutate files.

## Considered Options

- **(a)** A 12-agent lifecycle roster, with **hybrid** security and documentation
  coverage: a dedicated agent for heavy/critical work **plus** an on-demand skill
  any lifecycle agent loads, separated by an enumerated escalation boundary.
- **(b)** Reuse / lightly rename the layer-1 kit-builder roster for consumers.
- **(c)** Security and documentation as **skills only** (no dedicated agents), or as
  **dedicated agents only** (no on-demand skill).

## Decision Outcome

Chosen option: **(a) a 12-agent lifecycle roster with a hybrid security/docs
model**, because it is the only option that fits consumer lifecycle work, keeps
routing unambiguous, and right-sizes security/documentation across the trivial-to-
critical span.

**The 12 consumer agents:**

| Agent | Mutates? | Role |
| --- | --- | --- |
| `requirements-analyst` | authoring | Inception WHAT/WHY; produces units of work |
| `architect` | authoring | Construction **structure** (design) |
| `planner` | read-only | Construction **sequence**; dispatched ×2 for Solo Mob |
| `implementer` | authoring | Builds the unit; **may not edit grading tests** |
| `test-engineer` | authoring | Owns the test **oracle** (independent verifier) |
| `code-reviewer` | read-only | Pre-merge **gate**; applies a security lens; emits an **enumerated verdict** |
| `debugger` | read-only | Post-failure **diagnosis** |
| `devops` | authoring | Operations |
| `researcher` | read-only | Fan-out **gather** |
| `research-synthesizer` | authoring | **Synthesize**; runs the citation gate |
| `security` | read-only | Security escalation |
| `documentation` | authoring | Documentation escalation |

**Overlap resolutions (the routing boundaries):**

- **`architect` vs `planner`:** architect owns **structure** (how the system is
  shaped); planner owns **sequence** (in what order it is built).
- **`code-reviewer` vs `debugger` vs `security`:** code-reviewer is the
  **pre-merge gate**; debugger is **post-failure diagnosis**; security is the
  **escalation** target for deep/critical security work.
- **`researcher` vs `research-synthesizer`:** researcher **gathers** (read-only
  fan-out); synthesizer **synthesizes** and runs the citation gate (authoring).
- **`implementer` vs `test-engineer`:** the implementer **may not edit the grading
  tests**; the test-engineer owns the **oracle** — the independent-verifier split.

**The hybrid security/documentation model.** Each of security and documentation is
covered by **a dedicated agent for heavy/critical work PLUS an on-demand skill**
(`security-review`, `writing-docs`) that **any lifecycle agent can load** for
in-line work. An **enumerated escalation boundary** decides when in-line work must
hand off to the dedicated agent:

- **Escalate to `security`** on: authentication, cryptography, secrets, untrusted
  input, anything that **runs on another machine**, MCP configuration, an explicit
  threat-model request, **or any High+ severity finding**.
- **Escalate to `documentation`** on: multi-file documentation, information
  architecture, or a dedicated documentation unit of work.

## Consequences

- Good, because the roster is **shaped for consumers** (lifecycle agents), not
  borrowed from the kit-builder — faithful to what consumers actually do.
- Good, because the **hybrid model right-sizes** security and documentation:
  trivial in-line work loads a skill; heavy/critical work escalates to a dedicated
  agent on an enumerated, auditable boundary.
- Good, because the **independent-verifier split** (implementer cannot edit grading
  tests; test-engineer owns the oracle) is structurally enforced, supporting the
  methodology's verification integrity.
- Bad, because **routing reliability now depends on mutually-exclusive
  descriptions** that must be **proven by near-miss evals** — overlapping pairs
  (architect/planner, code-reviewer/debugger/security, researcher/synthesizer) are
  the cross-fire risk.
- Neutral, because if a pair shows **irreducible cross-fire** in evals it gets
  **merged**; `debugger` is the prime merge candidate (its post-failure role can
  fold into code-reviewer or implementer if it cannot be cleanly separated).

## Pros and Cons of the Options

### (a) 12-agent lifecycle roster + hybrid security/docs — chosen

- Good, because it matches consumer lifecycle needs and right-sizes the
  cross-cutting concerns.
- Good, because overlaps are explicitly resolved into routing boundaries.
- Bad, because it leans heavily on description quality and near-miss evals to keep
  routing clean.

### (b) Reuse the layer-1 kit-builder roster — rejected

- Good, because it would be zero new design work.
- Bad, because the kit-builder agents author **skills/agents/orchestrators**, which
  consumers do not do; the roster would be unfaithful to consumer lifecycle work
  and route nonsense.

### (c) Security/docs as skills-only or agents-only — rejected

- Good (skills-only), because it is the lightest footprint; good (agents-only),
  because escalation is unambiguous.
- Bad (skills-only), because heavy/critical security and documentation work has no
  dedicated owner — under-serving the most important cases. Bad (agents-only),
  because every trivial security/doc touch would route to a heavyweight agent —
  over-weighting trivial work and adding latency.

## More Information

- Spec: `product/docs/methodology-spec.md` (phase → agent mapping, Solo Mob,
  independent-verifier model).
- Skills: `description-engineering` and `skill-evaluation` (mutually-exclusive
  descriptions and near-miss evals that prove routing); `security-review` and the
  consumer `writing-docs` skill (the on-demand halves of the hybrid).
- Agents: `agent-author` (authored the roster), `prompt-engineer` (routing evals).
- Related: [ADR-0005](0005-baked-in-mechanisms-and-two-tier-eval-strategy.md)
  (the baked-in mechanisms — including the independent-verifier split — and the
  eval strategy that proves triggering).
- **Revisit when:** near-miss evals show irreducible cross-fire for a pair (merge
  it), or a new consumer lifecycle need has no clean owner in the roster.
