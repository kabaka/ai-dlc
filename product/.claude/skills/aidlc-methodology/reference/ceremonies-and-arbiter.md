# Ceremonies, the arbiter, and decision points

This file covers the heart of how AI-DLC keeps you in control: the **solo-adapted
mob ceremonies** (and their honest limitations), the **human-as-arbiter** principle,
the **four decision points**, the **Decision Record**, and how ceremony depth scales
to **risk tier**.

## Contents

- The solo mob ceremonies — honest framing
- What the adaptation gives you, and what it costs
- The human as arbiter
- The four arbiter decision points
- The Decision Record
- Risk-tier triage (right-sizing ceremony depth)

## The solo mob ceremonies — honest framing

In AWS AI-DLC, **Mob Elaboration** and **Mob Construction** are ceremonies where
**multiple humans** validate AI's proposals and make decisions **collectively, in
real time** — "extreme decision-making via mob work." That multi-human room is the
defining property of a mob.

You are working **solo** (one human + an agent team). So the ceremonies are
**adapted**, and the adaptation is stated honestly:

> In AWS AI-DLC the mob ceremonies put **multiple humans** on a decision together in
> real time. AI-DLC for a solo developer adapts this: **AI specialist agents stand in
> for the absent human mob members to supply diverse, independent challenge, while
> you remain the sole arbiter who decides.** This is an adaptation, not a
> reproduction — agents can share blind spots that independent human stakeholders
> would not, so the diversity is weaker than a true human mob.

The two ceremonies:

- **Solo Mob Elaboration** (Inception) — agents propose requirements and units of
  work, and contest each other's reading of your intent. You decide.
- **Solo Mob Construction** (Construction) — agents propose architecture, plan, code,
  and tests, and red-team each other's choices. You decide.

**Operations has no mob ceremony in AI-DLC; human oversight is the constant.** Do not
expect a "Mob Operations" — there isn't one, by design.

**Naming:** call them **Solo Mob Elaboration / Solo Mob Construction** (or "the mob
ceremony, adapted for solo use"). They are not the bare AWS multi-human ceremonies,
and the agents are not a human mob.

## What the adaptation gives you, and what it costs

**Gives you:** diverse, independent *challenge* on demand — multiple specialist
perspectives (a planner, an adversarial reviewer, a security pass) pressuring a
decision the way a mob's many minds would, but available instantly and tirelessly.
This is real collective-intelligence pressure, mechanized.

**Costs you:** the agents **share a model and a context**, so they can share blind
spots that genuinely independent human stakeholders would not. Their diversity is
**weaker** than a human mob's. And because you are the *only* human, you carry the
**full accountability** that a multi-human mob would have distributed across several
people. The adaptation trades independent-human diversity for speed and availability —
a good trade for most work, but know it before you bet a high-stakes, irreversible
decision on the agent mob alone. For those, seek a real second human.

## The human as arbiter

The central operating principle, repeated in every phase:

> AI creates a plan, asks clarifying questions to seek context, and implements a
> solution **only after receiving your validation.**

Read "receiving your validation" as a constraint on the **timing of genuine
decisions**, not on who types the record. At a **genuine fork** — a real choice
among real alternatives — AI does not proceed until you decide, and you decide *at*
the fork. What it is **not** is a rule that you must personally hand-write every
record artifact: the record may be **agent-scribed**; the *authorization* is what
must be yours.

You are the **arbiter**: you hold the business context, the decision authority, and
the accountability. Agents propose and contest; **they never decide.** Your
sign-off may be granted **in advance** for a *routine, low-risk* forward action to a
target you have named — an agent may then scribe the record and proceed within that
scope. But a **genuine design fork, a high-risk or irreversible unit, or a deploy**
is decided **at** the fork, not pre-granted; there, AI stops and returns to you.
This is the "AI-driven with a human arbiter" sweet spot (see `values.md`).

## The four arbiter decision points

These are the only points where work is **blocked** until an authorizing record is
present — recorded by you at the fork, or scribed from a standing authorization you
gave for a routine, in-scope forward action (see the risk-tier table below).
Between them, AI proposes and contests freely.

1. **Inception → Construction** — requirements and units of work approved.
2. **Within Construction (design fork)** — architecture/plan approved before
   implementation begins.
3. **Construction → integration (merge)** — the implemented unit approved to merge.
4. **→ Operations (deploy/release)** — the change authorized for deployment.

Each is a place where "AI proceeds only after the human validates" takes concrete
form. A gate is **open** only when an approving Decision Record for that transition
exists; **no record = closed gate = AI must not proceed.**

## The Decision Record

The artifact you produce at each decision point. It is *our* concrete realization of
AI-DLC's "human validates before AI proceeds" loop — AWS states the principle; the
Decision Record is how this kit makes it auditable. Fields:

| Field | Meaning |
| --- | --- |
| `decision_id` | Stable identifier. |
| `transition` | Which gate (one of the four above). **Hook reads this** (Gates 3–4). |
| `unit_of_work` | The unit(s) this decision covers. *Discipline — the hook does not read it.* |
| `chosen_option` | What you decided (e.g. "approve plan A", "request changes"). **Hook reads this** (must be `approve`, Gates 3–4). |
| `rationale` | Why — the business/technical reasoning you own; it should cite the authorizing instruction. *Discipline — the hook does not read it.* |
| `approver` | You, the human arbiter (the single human in the solo model). *Discipline — the hook does not read it.* |
| `date` | When recorded. |
| `risk_tier` | The unit's risk tier (below), so depth is auditable. *Discipline — the hook does not read it.* |

At Gates 3–4 the hook also matches a `target` field (the branch/tag/release
identity being acted on) by exact value; see `aidlc-workflow`. **What the hook
reads is a narrow slice**: `transition`, `chosen_option == approve`, and `target`
**identity** — nothing more. The `approver`, `rationale`, `risk_tier`, and
`unit_of_work` fields, and any per-unit / per-risk / per-time scoping you intend,
are **discipline**: they make the decision honest and auditable, but the hook never
enforces them. Concretely, a single `approve` record is keyed to its `transition` +
`target` identity, so it authorizes *every* future command of that transition that
resolves to the same target (for example, every `git push` to `main`), does not
expire, and stays valid until you delete it — it is not scoped to one unit of work,
diff, or point in time. Never describe this discipline layer as "deterministic" or
"fail-closed" — only the `target`-identity check is.

A high-risk decision additionally records the **alternatives considered** and an
explicit risk note (and may warrant an ADR).

## Risk-tier triage (right-sizing ceremony depth)

AWS warns against **"one-size-fits-all rigidity."** This kit avoids it by scaling
ceremony **depth** to a unit of work's **risk tier** — the ceremonies stay the same;
only how much challenge you apply changes. This is a faithful application of AWS's
anti-rigidity guidance, **not** an AWS-named tiering scheme.

| Tier | When | Ceremony depth | Decision Record |
| --- | --- | --- | --- |
| **Trivial** | Low-risk, reversible, narrow scope (copy fix, isolated config). | Lightweight: a single proposer, no full mob round; you may approve **inline — or in advance**. | Still required for the gate, but may be terse (one-line rationale). **The only tier whose merge you may pre-authorize.** |
| **Standard** | A typical feature unit of work. | Full Solo Mob: a lead proposes, ≥1 challenge agent contests, you decide. | Full Decision Record at each transition, decided **at** the gate. |
| **High-risk** | Irreversible, security-sensitive, broad blast radius, or high ambiguity. | Deepest: multiple challenge agents incl. security/adversarial review, explicit options surfaced. | Full Decision Record **plus** recorded alternatives and an explicit risk note; consider an ADR. **Never pre-authorizable** — options must be surfaced and recorded *before* you decide, at the fork. |

Rules:

- The tier is set on the unit of work at Inception (`risk_tier`) and may be
  **escalated** if Construction reveals more risk — **never silently downgraded.**
- Triage **reduces ceremony, never the arbiter gate.** Even a trivial unit crosses a
  human decision point; triage changes *how much challenge*, not *whether you decide*.
  The human-as-arbiter principle holds at every tier.
- **Pre-authorization is narrow.** You may grant sign-off *in advance* — letting an
  agent scribe the record and proceed — **only** for a merge (Gate 3) when **all**
  hold: the `target` is a branch you **named**; the unit is **trivial or low-risk and
  reversible**; there is **no genuine design fork with real alternatives**; and it
  **traces to a specific instruction** of yours naming the target and a maximum risk
  tier. Anything else — a **design fork** (Gate 2) with real alternatives, a
  **high-risk or irreversible** unit, a **deploy** (Gate 4), or any **unnamed
  target** — is decided **at** the fork and returns to you. Scribing an approval you
  never gave (inferring a fork, target, or risk tier you did not name) is a **breach**,
  not a shortcut.
