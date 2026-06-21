# 0010 — Skill-first design-system lens and a `ui_bearing` unit-of-work contract for layer-2 consumer apps

## Status

Accepted

- Date: 2026-06-21
- Deciders: Product owner (decision authority); Orchestrator + `aidlc-methodologist`,
  `skill-author`, `agent-author`, `qa`

## Context and Problem Statement

Consumer applications built by the layer-2 kit exhibit two recurring classes of
failure:

- **Visual / UX inconsistency** — components ship unstyled or inconsistently
  styled, default framework aesthetics leak through, and interaction states
  (empty / loading / error, hover / focus / disabled) are missing or ad hoc, so
  the resulting app looks and feels broken even when it functions.
- **Incomplete delivery** — units of work ship with deferred scope, orphan
  features wired to nothing, and stale companions, despite the methodology's
  intent to deliver whole, working increments.

The product already shipped a layer-2 `ux-design` skill, but it covers only
information architecture, interaction design, and a WCAG accessibility baseline —
it carries **no visual-design contract** (no token system, no element inventory,
no aesthetic brief). Worse, `ux-design` is **never preloaded** onto any lifecycle
agent, so it relies on on-demand triggering and rarely fires when a UI surface is
actually in play. The kit also has distributed completeness checks (the layer-1
`definition-of-done`, the layer-2 `requirements-elaboration` vocabulary), but no
**whole-unit completeness convention** tying UI fidelity to the unit-of-work
contract. A decision is needed on how to raise visual quality and whole-unit
completeness for UI-bearing work without bloating the agent roster or breaking
cross-platform degradation. This is a **multi-slice effort**; this ADR records the
directional decision, and **Slice 1 implements the UI-design portion**.

## Decision Drivers

- **Reliable triggering & orchestration (Core Principle 2).** The likely reason a
  dedicated UX agent helped in the field is that it *fired*; the incumbent
  `ux-design` skill's defect is that it never preloads. Fixing triggering is the
  highest-leverage move, ahead of adding roster surface.
- **Cross-platform integrity (Core Principle 3).** A dedicated agent degrades to
  nothing on Cursor / Kiro / AGENTS.md readers; a skill and a contract field
  degrade far better. Value should be delivered skill-first.
- **Reusability & non-overlap (Core Principles 4–5).** New capability must not
  duplicate existing skills/agents (`testing-strategy`, `code-review`, layer-1
  `definition-of-done`) or contradict the already-shipped `ux-design` design.
  Stack-neutrality keeps the guidance reusable across consumer stacks.
- **Correctness & faithfulness (Core Principle 1).** Aesthetic quality is a
  subjective judgment LLMs are demonstrably weak at; the design must not let an
  agent self-certify "looks good." Agents emit evidence; the human arbiter judges.
- **No new ceremony (methodology-fidelity constraint).** The AI-DLC loop already
  has gates; raising UI quality must reuse the **existing** Gate 1 (unit-of-work
  confirmation) and Gate 2 (review evidence), not add a new gate, prompt, or
  ceremony.

## Considered Options

- **(a)** Add dedicated **`ux-designer` + `verification`** agents now.
- **(b)** Endorse a **default stack** (e.g. shadcn / Tailwind) as the kit's
  baseline design system.
- **(c)** One **big-bang** change that lands the visual contract, the
  completeness convention, and visual-QA tooling together.
- **(d)** A **skill-first, agent-light, vertically-sliced** approach: a
  stack-neutral `design-system` skill, fixed preloading of the UI lenses, and a
  `ui_bearing` unit-of-work contract field — with later slices for completeness
  and visual-QA tooling, and dedicated agents kept only as an *earned* escalation.

## Decision Outcome

Chosen: **(d)**, delivered in **vertical slices**. **Slice 1** (implemented now)
covers the UI-design portion:

- **A stack-neutral `design-system` skill.** It defines a **DTCG 3-tier token**
  model (primitive → semantic → component tokens), a **UI-element inventory with
  per-element state matrices**, **empty / loading / error patterns**, and a
  **ban-defaults aesthetic brief** that forbids shipping raw framework defaults.
  It is stack-neutral, with an optional **repo-local binding** to whatever stack a
  consumer actually uses (no endorsed stack).
- **Fix the triggering defect.** Preload **both `ux-design` and `design-system`**
  onto the `requirements-analyst` and `architect` agents (via `skills:`
  frontmatter), so the UI lenses are loaded whenever UI-bearing requirements and
  architecture are in play — this is the change most likely to reproduce the
  benefit a dedicated UX agent gave in the field.
- **A `ui_bearing` unit-of-work contract field.** It is **agent-proposed and
  arbiter-confirmed at the EXISTING Gate 1** — **no new gate, prompt, or
  ceremony**. Effort is **proportional to `risk_tier × ui_bearing`**: non-UI units
  carry no UI lens; UI-bearing units pull in the design-system evidence
  proportional to their risk tier.

The design-system artifact becomes **evidence for the existing Gate 2** review;
`ui_bearing` is a **contract field**, not a gate of its own.

**Later slices** (recorded here as direction, implemented separately) add the
**layer-2 spec-completeness convention** — expressed over the **native
`acceptance_criteria` / `non_goals` / `risk_tier`** fields, mirroring (not
forking) the layer-1 `definition-of-done` — and **browser / app visual-QA
tooling with stack auto-binding**. The stack auto-binding *mechanism* may warrant
a short follow-up ADR when that slice is designed.

Options (a)–(c) are rejected (see below). Dedicated agents are **not** added up
front, but are explicitly **kept as an earned escalation**: if a later slice
proves a function the incumbent skills and agents cannot carry, a dedicated agent
becomes justified at that point.

### Consequences

- Good, because value is delivered **skill-first**, which **degrades better
  cross-platform** (Cursor / Kiro inherit the skill content) and adds **no roster
  bloat**.
- Good, because fixing the **preload/triggering defect** addresses the most likely
  real source of the field benefit, rather than papering over it with a new agent.
- Good, because the UI lens is **proportional** — only UI-bearing units pay the
  cost, scaled by `risk_tier`, so non-UI and trivial work is unburdened.
- Good, because it **reuses the existing Gate 1 and Gate 2** with no new ceremony,
  keeping the AI-DLC loop intact.
- Bad, because **aesthetic quality remains a human-arbiter judgment** — agents emit
  evidence (token coverage, state-matrix completeness, screenshots) and must
  **never self-certify "looks good."** This is grounded in research showing LLMs
  are weak at subjective UI-quality assessment; it is an accepted limitation, not
  a gap to be automated away.
- Bad, because the full value is **spread across multiple slices** — Slice 1 raises
  visual fidelity but the spec-completeness convention and visual-QA tooling land
  later, so the completeness failure is only partly addressed until then.
- Neutral, because the kit stays **stack-neutral**: consumers get an optional
  repo-local binding rather than an endorsed stack, which avoids lock-in but means
  the consumer must do the binding for stack-specific guidance.
- Neutral, because **layer-2 completeness will be expressed over native fields**
  (`acceptance_criteria` / `non_goals` / `risk_tier`) mirroring the layer-1
  `definition-of-done` — an ongoing anti-drift obligation to keep the two aligned.

## Pros and Cons of the Options

### (a) Dedicated `ux-designer` + `verification` agents now — rejected (kept as earned escalation)

- Good, because dedicated agents would own UI design and verification end to end,
  and a UX agent *did* appear to help in the field.
- Bad, because they **contradict the already-shipped `ux-design` skill's design**
  (which deliberately made UX a loaded lens, not an agent) and would have to be
  reconciled with it.
- Bad, because `verification` **duplicates `testing-strategy`, `code-review`, and
  the layer-1 `definition-of-done`**, splitting responsibility and bloating the
  roster against Core Principle 5.
- Bad, because both agents **degrade to nothing on Cursor / Kiro / AGENTS.md
  readers**, whereas a skill + contract field degrade gracefully.
- Note: this is **not permanently rejected** — it is held as an *earned*
  escalation for a later slice that proves the incumbents cannot carry a needed
  function.

### (b) Endorse a default stack (shadcn / Tailwind) — rejected

- Good, because an endorsed stack would give immediately concrete, copy-pasteable
  component guidance.
- Bad, because it **breaks stack-neutrality and reusability** — consumers on other
  stacks get guidance that does not apply, and the kit takes on lock-in to a
  specific ecosystem's churn.
- Bad, because the same outcome is achievable **stack-neutrally** via a DTCG token
  model plus an **optional repo-local binding** to the consumer's real stack.

### (c) One big-bang change — rejected

- Good, because it would land the visual contract, completeness convention, and
  visual-QA tooling at once.
- Bad, because it is **high-risk and hard to review**, and it **fails to dogfood**
  the kit's own vertical-slice discipline.
- Bad, because the slices have **different risk and validation profiles** (a skill
  vs. preload wiring vs. a contract field vs. browser-driving tooling); bundling
  them obscures which part regressed.

### (d) Skill-first, agent-light, vertically-sliced — chosen

- Good, because it puts value in a **portable skill**, fixes the **real triggering
  defect**, and adds a **proportional contract field** at an **existing gate** —
  maximizing cross-platform reach and minimizing roster growth.
- Good, because it **dogfoods vertical slicing**, keeping each slice reviewable and
  independently validated.
- Bad, because it **defers** the completeness convention and visual-QA tooling to
  later slices, so the completeness failure is only partly resolved by Slice 1.

## More Information

- **Slice 1 deliverables:** the stack-neutral `design-system` skill (DTCG 3-tier
  tokens; UI-element inventory with state matrices; empty / loading / error
  patterns; ban-defaults aesthetic brief; optional repo-local stack binding);
  preload of **`ux-design` + `design-system`** onto the `requirements-analyst` and
  `architect` agents; the **`ui_bearing`** unit-of-work contract field
  (agent-proposed, arbiter-confirmed at the **existing Gate 1**; proportionality
  `risk_tier × ui_bearing`).
- **Reuses, does not add:** the **existing Gate 1** (unit-of-work confirmation) and
  **Gate 2** (review evidence) — no new gate, prompt, phase, or ceremony.
  `design-system` output is **evidence for Gate 2**; `ui_bearing` is a **contract
  field**.
- **Later slices (direction only):** a layer-2 **spec-completeness convention** over
  the native `acceptance_criteria` / `non_goals` / `risk_tier` fields, mirroring
  (not forking) the layer-1 `definition-of-done`; **browser / app visual-QA
  tooling** with **stack auto-binding** — the auto-binding mechanism may get a
  short **follow-up ADR** — now
  [ADR-0012](0012-layer2-visual-qa-tooling-and-stack-auto-binding.md).
- **Honest boundary:** aesthetic quality stays a **human-arbiter judgment**; agents
  emit evidence and never self-certify "looks good" (grounded in research on LLM
  weakness at subjective UI quality).
- **Related:** the layer-2 `ux-design` skill (IA / interaction / WCAG lens this
  decision preloads and complements); [ADR-0009](0009-definition-of-done-spec-completeness.md)
  (the layer-1 `definition-of-done` the later completeness slice mirrors rather
  than forks).
- **Revisit when:** a later slice proves a UI/verification function the incumbent
  skills and agents cannot carry (earned-escalation to a dedicated agent), or when
  the visual-QA stack auto-binding slice is designed (likely a follow-up ADR) — now
  [ADR-0012](0012-layer2-visual-qa-tooling-and-stack-auto-binding.md).
