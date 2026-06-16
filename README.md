# AI-DLC

A reusable, **Claude-Code-first** development-lifecycle kit — an *Orchestrator +
specialist-agents + skills* operating model paired with the **AI-Driven
Development Lifecycle (AI-DLC)** methodology. Built to run first-class in Claude
Code and to degrade gracefully onto GitHub Copilot, Kiro, Cursor, and any other
[`AGENTS.md`](https://agents.md)-compatible tool.

> **Status:** The **internal kit-builder** — the orchestrator, agents, and skills
> the AI team uses to produce the kit — is in place, and the **deliverable
> product** now exists under [`product/`](product/README.md). Consumers install it
> with `npx ai-dlc init`. See [Two layers](#two-layers).

## What this is

AI-DLC combines two ideas:

1. **An orchestration model.** You talk to a single **Orchestrator** (the main AI
   session). It plans, delegates to specialist subagents, runs dual planning and
   adversarial review, and reports back — it does not do the work itself.
2. **The AI-DLC methodology.** AWS's AI-Driven Development Lifecycle: phases
   **Inception → Construction → Operations**, the **Mob Elaboration** and **Mob
   Construction** ceremonies, *bolts* instead of sprints, *units of work* instead
   of epics, and the **human as arbiter** — AI executes, humans decide.

## Two layers

This repository deliberately separates two things:

| Layer | What it is | Who it serves | Lives in |
| ----- | ---------- | ------------- | -------- |
| **Internal kit-builder** | The orchestrator + agents + skills + tooling used to *build the kit itself* | This repo's contributors (human + AI) | `AGENTS.md`, `CLAUDE.md`, `.claude/` |
| **Deliverable product** | The AI-DLC kit that *consumers install* into their own repos (`npx ai-dlc init`) | Downstream adopters | [`product/`](product/README.md) |

When you contribute, always know which layer your change serves. To install and
use the deliverable product, see [`product/README.md`](product/README.md).

## How to work in this repo

Just talk to the Orchestrator. Describe what you want; it breaks the work down,
dispatches specialists, reviews their output, and delivers via a PR. The
authoritative operating instructions are in **[`AGENTS.md`](AGENTS.md)**
(canonical) — `CLAUDE.md` imports it and adds Claude-Code-specific notes.

## Repository layout

```text
ai-dlc/
├── AGENTS.md            # Canonical orchestrator definition (read by all tools)
├── CLAUDE.md            # @AGENTS.md import + Claude-Code-specific notes
├── .claude/
│   ├── agents/          # Specialist subagents (also read by GitHub Copilot)
│   └── skills/          # On-demand procedural playbooks (same SKILL.md as Kiro)
├── docs/
│   └── decisions/       # Architecture Decision Records (MADR)
├── scripts/             # Pre-flight validation tooling
└── .github/workflows/   # CI pre-flight checks
```

## Cross-platform support

`AGENTS.md` is the single source of truth and is read natively by Cursor, GitHub
Copilot, and Kiro. Claude Code reads `CLAUDE.md`, which imports `AGENTS.md`. The
`.claude/agents/` definitions are also consumed directly by GitHub Copilot, and
the `SKILL.md` format is shared with Kiro — so the same assets serve multiple
tools with minimal duplication. Tools without a subagent/skill concept still get
the full orchestrator prose from `AGENTS.md`. See the `cross-platform-config`
skill for the mapping.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: describe the change to the
Orchestrator, let the agent team do the work, and ship it through the standard
PR → CI → merge flow. All deliverables pass pre-flight checks (markdown lint,
frontmatter validation, manifest schema validation, link integrity, `shellcheck`).

## License

[MIT](LICENSE).
