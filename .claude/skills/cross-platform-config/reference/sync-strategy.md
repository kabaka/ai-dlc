# Sync strategy: share vs generate

The rule: **maximize what's shared natively; generate the rest from a canonical
source with a tool; never hand-maintain duplicates.**

## Tier 1 — share natively (no generation)

These formats already overlap, so one authored file serves multiple tools:

| Asset | Authored once at | Also consumed by |
| --- | --- | --- |
| Orchestrator prose | `AGENTS.md` (root) | Cursor, Copilot, Kiro, Codex, Jules, Windsurf, Zed, 20+ |
| Claude-Code instructions | `CLAUDE.md` = `@AGENTS.md` + notes | Claude Code; Copilot also reads `CLAUDE.md` |
| Subagents | `.claude/agents/*.md` | **Copilot reads `.claude/agents/` directly** |
| Skills | `.claude/skills/<name>/SKILL.md` | **Kiro** via symlink (`.kiro/skills/<name>/` → same schema) |

Sharing skills with Kiro:

```sh
ln -s ../../.claude/skills/<name> .kiro/skills/<name>
```

(Adjust the relative path to your layout. Symlink the directory, don't copy.)

## Tier 2 — generate scoped files (only when needed)

Reach for tool-specific files **only** when you need a tool's file-scoping that
`AGENTS.md` can't express:

- Cursor `.cursor/rules/*.mdc` — `globs` / `alwaysApply`
- Copilot `.github/instructions/*.instructions.md` — `applyTo:`
- Kiro `.kiro/steering/*.md` — `inclusion: fileMatch`

When you do, **generate them; don't write them by hand.** Hand-maintained copies
drift, and drift misleads agents (a correctness defect under the repo priorities).

## The tool: `rulesync`

`rulesync` (by dyoshikawa) generates per-tool config from unified rule files. It
supports **30+ tools and open standards** including Claude Code, Cursor, GitHub
Copilot, Kiro, Cline, Codex CLI, Gemini CLI, Zed, JetBrains Junie, and more — and
covers **subagents, skills, MCP config, and `AGENTS.md`**, not just plain rules.

Workflow:

1. Keep canonical rules in the unified source (per the repo's `rulesync` config).
2. Run `rulesync` to emit the scoped tool files you've opted into.
3. Commit generated files with a header comment marking them generated and pointing
   back to the canonical source, so editors don't treat them as the truth.

Treat generation as part of the pre-flight / validation step so generated files
never go stale relative to the canonical source.

## Decision summary

- Shared, unscoped → `AGENTS.md` (+ `CLAUDE.md` bridge). Done.
- Reusable agent → `.claude/agents/` (Claude + Copilot).
- Reusable skill → `.claude/skills/` (+ symlink to Kiro).
- Needs file-scoping → generate the scoped file(s) via `rulesync`.

## Source

- https://github.com/dyoshikawa/rulesync
