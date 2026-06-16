# AI-DLC cross-platform support — the honest degradation contract

AI-DLC is **Claude-Code-first**. It runs on other tools by degrading gracefully —
**not** by claiming parity. This page is the authoritative, per-tool contract: for
each supported tool, exactly **what it consumes** and **what it does not provide**.
If a tool is not listed, assume the "other AGENTS.md readers" row.

The single source of truth is **`AGENTS.md`** at your repo root (the canonical
orchestrator definition). Every other steering file the installer lands is a
**derived summary** that points back to `AGENTS.md`; none of them duplicate it, so
none of them can drift into a second source of truth. See
[ADR 0001](../../docs/decisions/0001-canonical-agents-md-with-claude-md-import.md) for why
`AGENTS.md` is canonical with a `CLAUDE.md` `@AGENTS.md` import.

## What "full experience" means

The complete AI-DLC experience has four parts:

1. **Orchestrator definition** — the Orchestrator role, core principles, delivery
   rules, and the AI-DLC lifecycle loop (Inception → Construction → Operations).
   Lives in `AGENTS.md`.
2. **Specialist agent roster** — the 12 lifecycle agents in `.claude/agents/`
   (`requirements-analyst`, `researcher`, `research-synthesizer`, `architect`,
   `planner`, `implementer`, `test-engineer`, `code-reviewer`, `debugger`, `devops`,
   `security`, `documentation`).
3. **On-demand skills** — the procedural playbooks in `.claude/skills/`, loaded when
   relevant (the `aidlc-workflow`, `architecture-design`, `code-review`,
   `security-review`, … skills).
4. **The arbiter-gate hook** — a **real installed hook** that blocks phase-transition
   actions until a human Decision Record exists. This is enforcement, not a prompt.

A tool that has all four runs AI-DLC at full strength. A tool that has fewer runs a
**degraded** experience — useful, but you must supply by discipline what the platform
does not enforce.

## Per-tool degradation contract

| Tool | Reads canonical `AGENTS.md`? | Specialist agent roster | On-demand skills | Arbiter-gate hook | Net experience |
| --- | --- | --- | --- | --- |
| **Claude Code** | Yes — via `CLAUDE.md`'s `@AGENTS.md` import | **Yes** — all 12 agents in `.claude/agents/` | **Yes** — `.claude/skills/` auto-load on demand | **Yes** — installed, blocking | **Full.** Orchestrator + 12-agent roster + skills + enforced arbiter gate. |
| **GitHub Copilot** | **Yes** — reads `AGENTS.md` directly (and `.github/copilot-instructions.md`) | **Reported yes (verify)** — as of 2026-06 Copilot is reported to read `.claude/agents/` (Claude sub-agents format); this is third-party behavior that can change, so confirm against current Copilot docs | **No** — Copilot has no skill primitive; skills do **not** auto-load | **No** — no hook; arbiter gate is instruction only | **Strong but partial.** Orchestrator + agent roster (Copilot-side support unverified), **no** skill auto-loading, **no** enforced gate. |
| **Cursor** | **Yes** — reads `AGENTS.md` (and `.cursor/rules/*.mdc`) | **No** — no specialist roster on Cursor | **No** — no skill primitive | **No** — no hook | **Rules only.** Orchestrator / steering rules; single assistant, no agent team, no enforced gate. |
| **Kiro** | **Yes** — reads `AGENTS.md` (and `.kiro/steering/*.md`) | **No** — roster is Claude/Copilot only | **Not by default** — `SKILL.md` schema is shareable into `.kiro/skills/` only via a manual step | **No** — no hook | **Steering only.** Orchestrator / steering rules; single assistant, no agent team, no enforced gate. |
| **Other AGENTS.md readers** (Codex, Jules, Windsurf, Zed, …) | **Yes** — read `AGENTS.md` | **No** | **No** | **No** | **AGENTS.md only.** Orchestrator prose, nothing tool-specific. |

### Key claims, stated plainly

- **Only Claude Code gets the enforced arbiter gate.** Everywhere else, the four
  phase-transition decisions (Inception → Construction; the design fork;
  Construction → merge; → Operations) are honored **by discipline** — record a
  Decision Record yourself; nothing blocks you mechanically.
- **The specialist agent roster works on Claude Code, and is reported to work on
  GitHub Copilot.** Claude Code reads `.claude/agents/` natively; Copilot is
  reported (as of 2026-06) to read the same directory, but that is fast-moving
  third-party behavior — verify it against current Copilot docs before relying on
  it. Cursor and Kiro do **not** get the roster — they get orchestrator/steering
  rules and a single assistant. We do not imply a 12-agent team operates on Cursor
  or Kiro.
- **Skills auto-load only on Claude Code.** Copilot, Cursor, and Kiro have no
  automatic skill activation. (Kiro shares the `SKILL.md` schema, so skills can be
  shared into `.kiro/skills/` as a deliberate, manual step — not automatic.)
- **`AGENTS.md` is the only source of truth.** The installer's tool-specific files
  (`.github/copilot-instructions.md`, `.cursor/rules/*.mdc`, `.kiro/steering/*.md`)
  are derived summaries that point back to it. Edit `AGENTS.md`; regenerate the rest.

## Why we degrade instead of faking parity

Shipping `.cursor/`, `.kiro/`, and `.github/` files that *imply* a full agent team
and an enforced gate on every platform would be a **correctness defect** under
AI-DLC's own priority order — it would mislead the user about what the tool actually
does. Each tool-specific file therefore states its own limits up front. Believe the
contract above over any impression a steering file's tone might give.

## Where each tool's files live (after install)

| Tool | Files the installer lands |
| --- | --- |
| Claude Code | `CLAUDE.md` (`@AGENTS.md` import + Claude notes), `.claude/agents/`, `.claude/skills/`, the arbiter-gate hook |
| GitHub Copilot | `.github/copilot-instructions.md` (+ reuses `AGENTS.md` and `.claude/agents/`) |
| Cursor | `.cursor/rules/*.mdc` (+ reuses `AGENTS.md`) |
| Kiro | `.kiro/steering/*.md` (+ reuses `AGENTS.md`) |
| Other AGENTS.md readers | `AGENTS.md` only |

For the canonical-source model and sync strategy, see the `cross-platform-config`
material in the AI-DLC kit and [ADR 0001](../../docs/decisions/0001-canonical-agents-md-with-claude-md-import.md).
