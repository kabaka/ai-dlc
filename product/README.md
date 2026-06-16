# AI-DLC

**AI-DLC** is an installable, **Claude-Code-first** development-lifecycle kit for
your own software and research work. It configures your main AI session as an
**Orchestrator** that coordinates a team of **12 specialist agents** through the
**AI-Driven Development Lifecycle** AWS introduced — Inception → Construction →
Operations — with **you as the product owner and sole arbiter** of every decision
that matters.

You describe what you want. The Orchestrator breaks it down, delegates to
specialists, makes them contest each other's work, and gates progress on **your**
recorded decisions. The same loop drives building a feature and producing a
verified, cited research report.

It runs first-class on Claude Code and **degrades gracefully** — not at parity —
to GitHub Copilot, Cursor, Kiro, and any [`AGENTS.md`](https://agents.md) reader.

## Install

The installer is the primary way in. It needs only Node 18+ and writes only into
your repo.

```bash
npx ai-dlc init      # scaffold the kit into the current repo
npx ai-dlc update    # update an existing install to the current kit version
npx ai-dlc init --dry-run   # print the plan, write nothing
```

`init` lands these in your repo:

| Path | What it is |
| ---- | ---------- |
| `AGENTS.md`, `CLAUDE.md` | The canonical Orchestrator definition (`CLAUDE.md` imports `AGENTS.md`). **Co-owned** — a pre-existing copy is never edited in place. |
| `.claude/agents/` | The 12 specialist lifecycle agents. |
| `.claude/skills/` | The on-demand procedural playbooks. |
| `.ai-dlc/templates/artifacts/` | Methodology artifact templates to copy and fill. |
| `.ai-dlc/hooks/arbiter-gate.sh` | The arbiter-gate hook (Claude Code). |
| `.github/`, `.cursor/`, `.kiro/` | Cross-platform steering files. |
| `.ai-dlc/manifest.json` | Version stamp + per-file hashes for safe updates. |

Re-running is safe. The installer is **idempotent and version-stamped**: with no
kit change it writes nothing, and `update` never clobbers a kit-owned file you
edited — it writes the new version as `<file>.new` and flags it for you to merge.
A pre-existing `AGENTS.md` or `CLAUDE.md` is **preserved**, never overwritten.
Full behavior is in the [installer README](installer/README.md).

### Install channels

- **Installer (primary).** `npx ai-dlc init` / `update`. It is the only channel
  that can place the cross-platform top-level files (`AGENTS.md`, `CLAUDE.md`,
  `.github/`, `.cursor/`, `.kiro/`) and wire the arbiter-gate hook. See
  [ADR 0002](../docs/decisions/0002-installer-primary-plugin-secondary-distribution.md).
- **Claude Code plugin / marketplace (secondary).** A `/plugin`-discoverable
  surface for the Claude-native slice (agents and skills). It cannot manage the
  top-level files, so it complements the installer rather than replacing it.

## How it works

The Orchestrator runs the AI-DLC loop across three phases, with your decision
recorded at each transition.

- **Inception (WHAT / WHY).** `requirements-analyst` — with `researcher` and
  `research-synthesizer` where evidence is needed — produces **units of work**:
  parallelizable chunks of value with acceptance criteria, non-goals, and a risk
  tier. Challenged via **Solo Mob Elaboration**.
- **Construction (HOW).** `architect` owns structure, `planner` owns sequence,
  `implementer` builds, and `test-engineer` owns the independent test oracle —
  which the implementer may not edit. Challenged via **Solo Mob Construction**.
- **Operations (run it).** `devops` deploys and operates; `security` reviews;
  `debugger` does incident RCA.

A few principles make this honest rather than theatrical:

- **You are the sole arbiter.** Four phase transitions require a recorded
  **Decision Record** — your chosen option, rationale, and risk tier — before
  work proceeds. On Claude Code a **real installed hook** blocks phase-transition
  actions until that record exists; the model cannot talk past a missing decision.
- **Research is a first-class peer to software.** Research *parallelizes* (fan out
  many `researcher` agents), software development is *linear*. Research
  deliverables pass a **citation gate**: every load-bearing claim traces to a
  re-fetched source that supports it.
- **Solo Mob is an adaptation, stated honestly.** AWS's mob ceremonies put
  multiple humans on a decision together. Here, AI specialist agents stand in for
  the absent human mob to supply independent challenge while you decide. Agents
  can share blind spots that independent humans would not — so this is an
  adaptation, **not** a reproduction of a human mob, and we never imply otherwise.

The full playbook lives in the installed `aidlc-workflow` skill; the concepts and
vocabulary in `aidlc-methodology`.

## Documentation

- **[Quickstart](docs/quickstart.md)** — install and run a first unit of work
  through a phase, with a Decision Record and a gate.
- **[Usage guide](docs/usage.md)** — the phases and which agent/skill drives each,
  the four arbiter gates, complexity triage, the research fan-out workflow, and
  the artifact templates.
- **[Cross-platform support](docs/cross-platform.md)** — the honest, per-tool
  degradation contract: exactly what each platform consumes and what it does not.
- **[Installer reference](installer/README.md)** — install/update semantics,
  drift detection, and the arbiter-gate hook.

## License

[MIT](../LICENSE).
