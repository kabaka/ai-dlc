# AI-DLC

**AI-DLC** is an installable, **Claude-Code-first** development-lifecycle kit for
your own software and research work. It configures your main AI session as an
**Orchestrator** that coordinates a team of **14 specialist agents** through the
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
npx @kabaka/ai-dlc init      # scaffold the kit into the current repo
npx @kabaka/ai-dlc update    # update an existing install to the current kit version
npx @kabaka/ai-dlc init --dry-run   # print the plan, write nothing
```

`@kabaka/ai-dlc` is a public, SemVer-versioned npm package. (A global install
exposes the command as `ai-dlc`; the `npx` form uses the scoped package name.)

`init` lands these in your repo:

| Path | What it is |
| ---- | ---------- |
| `AGENTS.md`, `CLAUDE.md` | The canonical Orchestrator definition (`CLAUDE.md` imports `AGENTS.md`). **Co-owned** — a pre-existing copy is never edited in place. |
| `.claude/agents/` | The 14 specialist lifecycle agents. |
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

- **Installer (primary).** `npx @kabaka/ai-dlc init` / `update`. It is the only
  channel that can place the cross-platform top-level files (`AGENTS.md`,
  `CLAUDE.md`, `.github/`, `.cursor/`, `.kiro/`) and wire the arbiter-gate hook.
  See
  [ADR 0002](../docs/decisions/0002-installer-primary-plugin-secondary-distribution.md).
- **Claude Code plugin / marketplace (secondary).** A Claude-native discovery
  surface for the agents and skills. It cannot place the top-level files, so it
  complements the installer rather than replacing it.
  - **Local Claude Code CLI** (interactive slash commands):

    ```text
    /plugin marketplace add kabaka/ai-dlc
    /plugin install ai-dlc@ai-dlc
    ```

  - **Claude Code on the web / cloud.** The interactive `/plugin` commands are
    **not available** there. Declare the plugin ahead of time in your target
    repo's project-scope `.claude/settings.json`:

    ```json
    {
      "extraKnownMarketplaces": {
        "ai-dlc": { "source": { "source": "github", "repo": "kabaka/ai-dlc" } }
      },
      "enabledPlugins": { "ai-dlc@ai-dlc": true }
    }
    ```

    (`enabledPlugins` is an object map of `"name@marketplace": true`, not an
    array.) Alternatively, run the non-interactive
    `claude plugin marketplace add kabaka/ai-dlc` and
    `claude plugin install ai-dlc@ai-dlc` from the environment's setup script or a
    `SessionStart` hook. Either way, on the web the plugin channel still does
    **not** deliver the top-level files (`AGENTS.md`, `CLAUDE.md`, and the
    cross-platform steering), so `npx @kabaka/ai-dlc init` (or the setup script) is
    still needed for those.

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
- **Operations (run it).** `devops` deploys and operates; `observability`
  designs what to measure — SLOs, error budgets, and OpenTelemetry
  instrumentation you add **as you build**; `security` reviews; `debugger` does
  incident RCA.

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

### Extend the kit to your repo

The shipped roster is general-purpose. When you want it to know **your** stack —
your language, framework, infra, or domain — ask the Orchestrator to assess this
repo and extend the kit. The `kit-extender` agent inventories the repo, finds
where the kit is silent, and **proposes** tailored skills (and, rarely, agents)
authored to the kit's own standards. This is an **on-demand capability**, not a
lifecycle phase, ceremony, or gate.

- **Skills by default; per-language expertise is a skill plus a `reference/`
  file** — never a shipped-in, fixed per-language agent. The kit does not ship
  language or framework experts; `kit-extender` generates them per repo, on request.
- **You approve before anything lands.** Drafts go to a `ai-dlc-proposed/` staging
  directory; nothing is promoted into live `.claude/` until you authorize it.
- **Honest verification.** The kit ships a **mechanical validator** that
  `kit-extender` runs on every draft — it checks frontmatter and eval-record
  rules and confirms the artifact is **well-formed**. It does **not** verify that a
  skill actually *triggers*; that behavior is checked **by hand in a fresh
  session**. There is no eval-runner harness.
- **Reload rules.** A promoted **skill**'s edited text hot-reloads mid-session, but
  a brand-new skill **directory** (the usual case for a generated skill) is only
  discovered on a session restart; a promoted **agent** likewise needs a session
  restart (or `/agents`) before you can delegate to it.

The on-demand workflow and the guidance skills below are covered in the
[usage guide](docs/usage.md).

### Recommended guidance (not gates)

Beyond the lifecycle agents, the kit ships practice skills any agent loads on
demand. These inform your decisions; they are **recommended guidance, never new
arbiter gates** — the four gates are unchanged.

- **`observability-practice`** — instrument-as-you-build, SLIs/SLOs/error budgets,
  OpenTelemetry; a recommended, non-blocking pre-release operability check inside
  the existing deploy checklist.
- **`testing-strategy`** — choosing how to arrive at the test oracle: TDD by
  default, with ATDD, spikes, and property-based testing selected by the work.
- **`dependency-compliance`** — license compatibility and SBOM/SPDX checks before
  you add a dependency. Recommended supply-chain hygiene; **not legal advice**.
- **`ux-design`** — interaction, IA, usability, and WCAG accessibility, for
  UI-bearing work only.

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
