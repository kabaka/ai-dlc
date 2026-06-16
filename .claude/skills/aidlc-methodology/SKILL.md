---
name: aidlc-methodology
description: Reference knowledge for the AI-Driven Development Lifecycle (AI-DLC) — the AWS methodology that treats AI as a central collaborator. Covers the three phases (Inception, Construction, Operations), the mob ceremonies (Mob Elaboration, Mob Construction), the renamed vocabulary (bolts, units of work), the four values, and the human-as-arbiter principle. Use when designing or describing the methodology the AI-DLC product embodies, writing methodology-facing docs/skills/agents, mapping our orchestration loop to AI-DLC concepts, or answering "what is a bolt / unit of work / mob elaboration / the arbiter role?".
---

# AI-DLC Methodology

**AI-DLC** — the **AI-Driven Development Lifecycle** — is the AWS methodology this
kit is built around. (AWS's source material writes it "Life Cycle"; this kit
standardizes on the one-word "Lifecycle" — the same concept.) Its premise: AI is a
**central collaborator and teammate**,
not just an assistant. Humans retain decision authority and accountability; AI
does the heavy lifting of turning intent into requirements, designs, code, and
infrastructure, and **defers critical decisions to humans**.

This skill is **reference knowledge**, not a workflow to run. Use it to design the
methodology the **deliverable product** will embody, to keep our methodology-facing
docs/agents accurate, and to map AI-DLC concepts onto our own internal orchestration
loop (the two are intentionally aligned — see "How this maps to our kit").

## Provenance

- Created by **Raja SP** (Principal Solutions Architect, AWS); introduced on the
  **AWS DevOps Blog, July 31, 2025**.
- Open-sourced as **`awslabs/aidlc-workflows`** (MIT-0 license, Nov 2025). The repo
  encodes the phases as directories: `inception/`, `construction/`, `operations/`,
  plus `common/` and `extensions/`.
- **Tool-agnostic:** `aidlc-workflows` ships steering/rules for Kiro, Amazon Q,
  Cursor, Cline, Claude Code, GitHub Copilot, and OpenAI Codex.

> **Naming collision — read this.** AWS also has an **ML Development Lifecycle**
> (the Well-Architected Machine Learning Lens), which is about *building models*.
> That is a different thing. AI-DLC here is the **software-development
> methodology**. Don't conflate them.

## The two dimensions and four values

Two dimensions: **AI-powered execution with human oversight**, and **dynamic team
collaboration**. Four values (the "X over Y" framing, higher-impact side first):

1. **Human-AI Collaboration** over Isolated Solutions
2. **Collective Intelligence** over Individual Brilliance
3. **Rapid Informed Decisions** over Analysis Paralysis
4. **Business Impact** over Development Velocity

The community gloss for how the ceremonies feel: *"extreme decision-making via mob
work."*

## The three phases

| Phase | Question | What AI does | Ceremony |
| --- | --- | --- | --- |
| **Inception** | WHAT / WHY | Turns business intent into requirements, user stories, and units of work | **Mob Elaboration** |
| **Construction** | HOW | Proposes logical architecture, domain models, code, and tests (incl. security & resilience) plus IaC | **Mob Construction** |
| **Operations** | run it | Manages deploy, infrastructure, and monitoring with team oversight | — |

Detail on each phase and ceremony is in `reference/phases.md`.

## Renamed vocabulary

AI-DLC compresses traditional Agile terms to reflect AI-accelerated cadence:

| Traditional | AI-DLC | Notes |
| --- | --- | --- |
| Sprint | **Bolt** | Hours-to-days, intense — not weeks |
| Epic | **Unit of Work** | A parallelizable chunk of value |
| Requirements meeting | **Mob Elaboration** | Team validates AI's requirements/questions |
| Design / build planning | **Mob Construction** | Team makes real-time technical decisions with AI |

Full glossary in `reference/vocabulary.md`.

## Human-as-arbiter loop

The core operating pattern, repeated across every phase:

> AI creates a plan, asks clarifying questions to seek context, and implements
> solutions **only after receiving human validation**.

This is the **"AI-Powered Execution with Human Oversight"** principle: AI defers
critical decisions to humans, who hold the business context, the decision-making
authority, and the accountability. Humans are the **arbiter**; AI is the tireless,
fast collaborator that never proceeds past a critical fork without sign-off.

## How this maps to our kit (important framing)

This skill documents the methodology the **deliverable product** will embody — it
is reference knowledge for *designing* that product, not instructions consumers
run. Two layers stay distinct (see `AGENTS.md`): the internal kit-builder vs. the
shipped product.

Notably, **our own internal orchestration loop is itself an instance of AI-DLC
values:**

- **Mob ceremonies ≈ our dual-planning + adversarial review.** Mob Elaboration and
  Mob Construction put many minds on a decision in real time; our two `planner`
  agents and two `adversarial-reviewer` agents are the same collective-intelligence
  move, mechanized.
- **Human-as-arbiter ≈ the product owner reviewing the Orchestrator.** The user is
  the arbiter; the Orchestrator plans, asks, and delivers, but the human holds
  decision authority and accountability — exactly the AI-DLC principle.

When designing the product, make this lineage explicit and keep the methodology
vocabulary (phases, ceremonies, bolts, units of work, arbiter) consistent with the
definitions here.

## Accuracy bar

The methodology is young and evolving. Keep claims faithful to the cited sources;
when AWS or the `aidlc-workflows` repo changes terms or structure, verify before
asserting (route to the `researcher` agent). Don't invent ceremonies, values, or
phase names.

## Reference

- `reference/phases.md` — the three phases and their ceremonies in depth, plus how
  Kiro's spec-driven development is one tool-level implementation.
- `reference/vocabulary.md` — full glossary (bolt, unit of work, mob elaboration,
  mob construction, arbiter) with Agile mappings.
- `reference/sources.md` — primary sources and what each substantiates.
