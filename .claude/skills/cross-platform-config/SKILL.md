---
name: cross-platform-config
description: How to keep one source of truth for AI-agent config across Claude Code, GitHub Copilot, Kiro, Cursor, and any AGENTS.md reader — the AGENTS.md standard, the CLAUDE.md bridge, shared agents/skills, and when (and how) to generate tool-specific files. Use when adding or editing AGENTS.md / CLAUDE.md / .cursor/rules / .github instructions / .kiro steering, deciding where instructions live, sharing subagents or skills across tools, setting up rulesync, or asking "which file does <tool> read?".
---

# Cross-Platform Config

AI-DLC is Claude-Code-first but must degrade gracefully to GitHub Copilot, Kiro,
Cursor, and any AGENTS.md-compatible tool. The goal is **one canonical source**
that every tool reads, with tool-specific files generated only where a tool's
scoping features actually buy us something. Hand-maintaining N copies of the same
guidance is the failure mode to avoid — they drift, and drift is a correctness
defect.

This skill is the map: what each tool reads, how they overlap, and the exact
single-source-of-truth + sync strategy this repo follows. For per-tool depth (every
path, frontmatter field, and rule type) see the `reference/` files linked below.

## The one rule

**`AGENTS.md` at the repo root is canonical.** It is freeform Markdown, read
directly by Cursor, GitHub Copilot, Kiro, OpenAI Codex, Jules, Windsurf, Zed, and
20+ other tools (see https://agents.md). Write orchestrator guidance there, once.

Everything else either *reads* `AGENTS.md` natively or is *bridged/generated* from
it. Claude Code is the one first-class tool that does **not** read `AGENTS.md` —
it reads only `CLAUDE.md`. So we bridge.

## Tool comparison

| Tool | Instruction file(s) | Agent concept | Skill concept | Reads `AGENTS.md`? |
| --- | --- | --- | --- | --- |
| **Claude Code** | `CLAUDE.md` only | `.claude/agents/*.md` subagents | `.claude/skills/<name>/SKILL.md` | **No** — bridge via `CLAUDE.md` |
| **GitHub Copilot** | `.github/copilot-instructions.md` (always-on); `.github/instructions/*.instructions.md` (`applyTo:` glob) | `*.agent.md` in `.github/agents/`, `~/.copilot/agents/`, **and reads `.claude/agents/`** | none (no skill primitive) | **Yes** (and `CLAUDE.md`) |
| **Kiro** (AWS) | `.kiro/steering/*.md` (`inclusion:` always/fileMatch/manual/auto) | custom subagents (v0.9+) | `.kiro/skills/<name>/SKILL.md` (same schema) | **Yes** (root or `~/.kiro/steering/`; no inclusion modes) |
| **Cursor** | `.cursor/rules/*.mdc` (`description`/`globs`/`alwaysApply`); plain `.md` ignored | modes / background agents (no file primitive) | none | **Yes** (nested/specific wins) |

`.cursorrules` (legacy, single file) is superseded — migrate to `.cursor/rules/*.mdc`
or rely on `AGENTS.md`. Full per-tool detail, including rule-type mapping and every
frontmatter field, is in the reference files.

## Single-source-of-truth strategy

Layered so that AGENTS.md-only tools still get the orchestrator, and richer tools
get the layered behavior they can express:

1. **`AGENTS.md` (root) — canonical orchestrator.** All shared guidance lives here.
   Monorepos may nest `AGENTS.md` in subpackages; the **closest file to the edited
   file wins**, and an explicit chat prompt overrides any file.
2. **`CLAUDE.md` — the bridge.** Make it a one-line import: `@AGENTS.md`, then
   append any Claude-only notes below. This is preferred over a symlink because it
   works on Windows and CI checkouts and lets you add Claude-specific lines without
   forking the content. (Symlink `ln -sf AGENTS.md CLAUDE.md` gives identical bytes
   but can break on some Windows/CI checkouts and can't carry Claude-only notes.)
   See `reference/claude-code.md`.
3. **Shared assets where formats already overlap — no generation needed:**
   - **`.claude/agents/*.md`** — Claude subagents. **GitHub Copilot reads this
     directory directly** (Claude sub-agents format), so our subagents work in
     Copilot with zero duplication. This is the biggest interop win in the kit.
   - **`SKILL.md`** — Kiro uses the *same* `name` + `description` schema under
     `.kiro/skills/<name>/`. Share by symlinking the skill dir, not by copying.
4. **Generate tool-specific files ONLY for scoping you actually need** — Cursor
   `.mdc` (`globs`/`alwaysApply`), Copilot `.instructions.md` (`applyTo:`), Kiro
   steering (`inclusion: fileMatch`). When you do, **generate them with a sync
   tool, don't hand-maintain.** Use `rulesync` (by dyoshikawa, supports 30+ tools
   incl. subagents/skills/MCP/AGENTS.md): keep canonical rules in one place, emit
   the rest. See `reference/sync-strategy.md`.

### Decision: where does new guidance go?

- Applies to every tool, always → **`AGENTS.md`** (the default; start here).
- Claude-Code-only behavior → append below the `@AGENTS.md` import in `CLAUDE.md`.
- A reusable subagent → **`.claude/agents/`** (works in Claude + Copilot).
- A reusable procedure/skill → **`.claude/skills/`** (share to Kiro via symlink).
- Must only apply to certain files/paths → generate the scoped file for the tools
  that support it (Cursor `globs`, Copilot `applyTo:`, Kiro `fileMatch`) **via
  rulesync from a canonical rule** — never by hand.

## Graceful degradation

A tool that only understands `AGENTS.md` still gets the full orchestrator prose and
behaves correctly, just without file-scoped layering. Richer tools layer on top:
Copilot picks up `.claude/agents/` and `applyTo:` instructions; Kiro picks up
shared skills and `inclusion` modes; Cursor picks up `.mdc` rule types. Never let a
richer tool's feature pull guidance *out* of `AGENTS.md` — canonical content stays
canonical; tool files only add scoping or tool-specific notes.

## Accuracy & maintenance

- Do not duplicate prose across files; duplication drifts and drift misleads agents
  (a correctness defect under the repo's priority order).
- Tool behavior here moves fast — re-verify paths and frontmatter against official
  docs (cited in the reference files) before asserting, and route uncertainty to
  the `researcher` agent rather than guessing.
- When you add a tool-specific file, leave a comment pointing back to `AGENTS.md`
  as canonical so future editors don't treat the generated file as the source.

## Reference

- `reference/agents-md.md` — the AGENTS.md standard: format, nesting/precedence,
  full reader list, sources.
- `reference/claude-code.md` — `CLAUDE.md`, the `@AGENTS.md` import vs symlink
  bridge, `.claude/agents/`, `.claude/skills/`.
- `reference/github-copilot.md` — instruction files, `applyTo:`, custom agents,
  and the `.claude/agents/` interop.
- `reference/kiro.md` — steering (`inclusion` modes), specs, hooks, skills,
  subagents, AGENTS.md handling.
- `reference/cursor.md` — `.cursor/rules/*.mdc`, rule types, `.cursorrules`
  migration, AGENTS.md.
- `reference/sync-strategy.md` — what to share vs generate, and using `rulesync`.
