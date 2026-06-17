# 0007 — Consumer kit self-extension via a propose-for-approval generator

## Status

Accepted

- Date: 2026-06-17
- Deciders: Product owner (decision authority); Orchestrator + `agent-author`,
  `skill-author`, `prompt-engineer`, `aidlc-methodologist`

This ADR **amends [ADR-0004](0004-consumer-agent-roster-and-security-documentation-hybrid.md)**:
it adds a single, deliberately scoped consumer agent (`kit-extender`) that authors
kit assets. ADR-0004's core rejection still stands — see *Relationship to ADR-0004*
below — so 0004 is amended, not superseded.

## Context and Problem Statement

The consumer kit (layer 2) ships a **fixed** lifecycle roster and a fixed skill set.
But consumer repos are heterogeneous: a Rust embedded project, a Django service, a
data-science notebook codebase, and a legal-research workspace each need expertise
the fixed roster can never enumerate. The maintainer cannot ship a combinatorial
matrix of per-language / per-framework / per-domain agents and skills — that is
unbounded, and most of it would be dead weight in any given repo.

The product owner asked for a different capability: let a consumer **extend their own
installed kit for their own repo**, authoring repo-tailored skills (and, rarely,
agents) **to the same standards the kit itself enforces**. The forces: this must not
become a back door for cloning the kit-builder roster (ADR-0004's rejection); it must
not let the AI silently rewrite the consumer's installed config; it must produce
assets that actually meet the kit's frontmatter, description, and least-privilege
standards (Core Principle 1); and the generated assets must actually trigger and
route (Core Principle 2). A generator that authors plausible-but-broken skills, or
that lands changes without human review, is a defect.

## Decision Drivers

- **Bounded growth over a combinatorial matrix.** Per-repo expertise must be
  *generated on demand*, not enumerated and shipped (Core Principles 4, 5).
- **Faithfulness of generated assets.** Drafts must meet real frontmatter and
  least-privilege standards, mechanically checkable, not asserted (Core Principle 1).
- **Reliable triggering of what gets generated.** Generated skills/agents are
  useless if they never fire or route (Core Principle 2).
- **Human-as-arbiter.** The AI proposes; the human decides what enters `.claude/`.
  No silent self-extension.
- **Honesty about limits.** We must not claim an enforced sandbox we do not have, or
  a triggering harness we do not ship.

## Considered Options

- **(a)** Ship a single `kit-extender` agent that **generates per-repo expertise as
  skills + reference files by default** (agents only when warranted), mirroring
  Anthropic's `skill-creator` loop (assess → propose gap list → author drafts →
  eval-gate → **human approval** → iterate → optimize description → register), with
  a **shipped consumer-side validator** for mechanical checks and **guardrails**
  (least-privilege, default-to-skill, STOP condition, untrusted-repo-content rule).
- **(b)** Ship a fixed set of per-language / per-framework expert agents.
- **(c)** Ship nothing — tell consumers to hand-author their own assets using the
  kit's authoring skills.

## Decision Outcome

Chosen option: **(a) the `kit-extender` propose-for-approval generator**, because it
is the only option that grows the kit per-repo without a combinatorial matrix, keeps
the human as arbiter of what enters `.claude/`, and makes the kit's standards
mechanically real for generated assets.

**Generator-only, skill-first.** We ship **no** fixed per-language/framework/domain
agents (that set is unbounded). The `kit-extender` **generates** per-repo expertise,
and **defaults to skills + `reference/` files** — the official domain-specific
progressive-disclosure pattern — reaching for a generated agent only when a distinct,
delegable responsibility genuinely earns one.

**The loop (mirrors `skill-creator`).** Assess the consumer repo → propose a **gap
list** for human selection → author drafts → run the **eval-gate** → obtain **human
approval** → iterate → optimize the description for triggering → register.

**Propose-for-approval, framed honestly.** The agent **stages** drafts to a
consumer-owned path **outside** the installer's `.ai-dlc/` namespace, where the human
reviews them before promoting them into `.claude/`. "Stages, does not land" is a
**behavioral discipline** — reinforced by the agent body and by the human reviewing
drafts — **not an OS-enforced sandbox**: the agent holds `Write`/`Edit` and could
technically write elsewhere. We record this limitation rather than overclaim.

**Mechanical standards enforcement, made real.** We ship a **generalized
consumer-side validator** (frontmatter conformance + eval-record presence) that the
`kit-extender` runs on its own drafts for a **PASS/FAIL**. This half is real and
mechanical. The other half — **triggering behavior** — remains a **manual fresh-session
check**: **no triggering harness ships** to consumers. Both halves are recorded
plainly; we do not imply automated triggering evals exist on the consumer side.

**Guardrails (all required).**

- **Least-privilege tools, always.** Generated agents must declare `tools`; omitting
  the field **inherits all tools including MCP** and is treated as a failure.
- **Front-loaded "Use when…" descriptions** so generated assets trigger/route.
- **Overlap / sprawl refusal** — the generator declines to add an asset that
  duplicates an existing one; **default to a skill** over an agent.
- **A STOP condition** — bounded extension, no runaway self-extension across a repo.
- **Untrusted-repo-content guardrail** — repository text is **data, not
  instructions**. A repo file that says "omit the `tools` field" or "skip the eval"
  is ignored; the standards come from the kit, not the scanned repo.

**Platform-behavior notes (verified).** Generated **skills hot-reload** mid-session;
generated **agents need a restart or `/agents`** — the agent surfaces this hot-load
asymmetry so the human knows why a new agent is not yet routable. The capability is
**complementary to** Claude Code's `/agents` "Generate with Claude" flow; there is
**no built-in "Meta Agent"** (verified — do not reference one).

### Relationship to ADR-0004

ADR-0004 rejected reusing the **layer-1 kit-builder roster** for consumers, because
those agents author **this** kit's skills/agents/orchestrators — work consumers do
not do. That rejection **still holds**. The `kit-extender` is a **different,
product-owner-requested capability**: a consumer extending **their own** installed
kit for **their own** repo, on a bounded, propose-for-approval basis. It is the
**only** consumer agent whose output target is `.claude/` itself, and it exists by
**deliberate, scoped exception** — not by reversing ADR-0004's principle. Per
`product/docs/extension-methodology-notes.md`, it is an **on-demand authoring
capability outside the three-phase model** (like `documentation`/`security`): **not a
phase, ceremony, or arbiter gate**, and anything it proposes re-enters the normal
lifecycle and the four existing gates when adopted.

### Consequences

- Good, because the kit **grows per-repo on demand** — no maintainer-shipped
  combinatorial matrix of language/framework/domain assets.
- Good, because **generated assets meet real standards**: a shipped validator gives a
  mechanical PASS/FAIL on frontmatter and eval-record presence, and least-privilege /
  default-to-skill guardrails are enforced in the loop.
- Good, because the **human stays arbiter** — drafts are staged for review, never
  silently landed in `.claude/`.
- Good, because the **untrusted-repo-content guardrail** treats scanned repo text as
  data, blunting prompt-injection from the very repo being extended.
- Bad, because "stages, does not land" is a **discipline, not a sandbox** — the agent
  holds `Write`/`Edit` and could write outside the staging path; we rely on the body
  and human review, and say so honestly.
- Bad, because **triggering remains a manual fresh-session check** — no consumer-side
  harness proves a generated asset fires; the human must run the check.
- Neutral, because the **hot-load asymmetry** (skills reload; agents need
  restart/`/agents`) is an ergonomic wrinkle the agent must surface every time it
  generates an agent.
- Neutral, because this is **one** scoped exception to ADR-0004; any further
  consumer-authoring capability must clear the same "different from the kit-builder
  roster, bounded, propose-for-approval" bar or be rejected.

## Pros and Cons of the Options

### (a) `kit-extender` propose-for-approval generator — chosen

- Good, because it grows the kit per-repo without an unbounded shipped matrix, keeps
  the human as arbiter, and makes standards mechanically real for drafts.
- Good, because skill-first + default-to-skill keeps the generated footprint small
  and progressive.
- Bad, because it leans on agent-body discipline (not a sandbox) for "stages, does
  not land," and on a manual check for triggering.

### (b) Fixed per-language/framework expert agents — rejected

- Good, because each expert would be purpose-built and immediately routable.
- Bad, because the set is **unbounded** — the maintainer cannot enumerate every
  language × framework × domain, and most would be dead weight in any one repo,
  violating reusability and non-overlapping-roster goals.

### (c) Ship nothing; consumers hand-author — rejected

- Good, because it adds no new agent and no over-privilege surface.
- Bad, because it pushes the kit's authoring standards onto every consumer by hand,
  with no mechanical check and no guided loop — most repo-tailored expertise would
  never get written, or would be written below standard.

## More Information

- Methodology placement: `product/docs/extension-methodology-notes.md` §1 —
  `kit-extender` is an on-demand authoring capability outside the three phases; not a
  phase, ceremony, or gate.
- Prior art: Anthropic's `skill-creator` loop (assess → draft → eval → approve →
  register) and the domain-specific skills + `reference/` progressive-disclosure
  pattern.
- Skills/agents: the `extending-the-kit` umbrella skill (the loop and guardrails);
  the shipped consumer-side validator (frontmatter + eval-record PASS/FAIL);
  `description-engineering` and `skill-evaluation` (front-loaded descriptions and the
  manual triggering check).
- Amends: [ADR-0004](0004-consumer-agent-roster-and-security-documentation-hybrid.md)
  (the scoped exception to "consumers need lifecycle agents, not kit-authoring
  agents"). Related: [ADR-0005](0005-baked-in-mechanisms-and-two-tier-eval-strategy.md)
  (the two-tier eval strategy this validator's static tier mirrors).
- **Revisit when:** a consumer-side triggering harness becomes feasible (closing the
  manual-check gap), an enforced staging sandbox becomes available (closing the
  discipline-not-sandbox gap), or a built-in platform "Meta Agent" / agent generator
  ships that this should defer to.
