# Kiro config (AWS)

Kiro is AWS's spec-driven, agentic IDE. It reads `AGENTS.md` and shares the
`SKILL.md` schema with Claude Code, so much of AI-DLC reaches Kiro with little or
no per-tool work.

## Steering — `.kiro/steering/*.md`

Persistent project guidance. YAML frontmatter key `inclusion` controls when each
file loads:

| `inclusion` | Behavior |
| --- | --- |
| `always` | Loaded in every interaction (default) |
| `fileMatch` | Conditionally loaded when working with matching file patterns |
| `manual` | On demand via `#steering-file-name` reference |
| `auto` | Included when a request matches the file's `description` |

```markdown
---
inclusion: fileMatch
fileMatchPattern: "**/*.tf"
---
Terraform conventions for this repo.
```

Global steering lives in `~/.kiro/steering/`.

## AGENTS.md handling

Kiro picks up `AGENTS.md` automatically from the workspace root **or** from
`~/.kiro/steering/`. AGENTS.md files do **not** support `inclusion` modes — they
are always included. No documented `CLAUDE.md` support, so Kiro relies on
`AGENTS.md` (canonical) for shared orchestrator prose.

## Skills — `.kiro/skills/<name>/SKILL.md`

**Same schema as Claude Code** (`name` + `description` frontmatter, progressive
disclosure body). Share AI-DLC skills by **symlinking** the skill directory into
`.kiro/skills/` rather than copying — copies drift. Global skills:
`~/.kiro/skills/<name>/`.

## Specs — `.kiro/specs/<feature>/`

Kiro's spec-driven development: per feature, `requirements.md`, `design.md`,
`tasks.md`. This is one *tool-level implementation* of the AI-DLC methodology layer
(see the `aidlc-methodology` skill) — Kiro structures the WHAT/HOW/tasks flow on
disk. AI-DLC is the methodology; Kiro specs are one way to enact it.

## Hooks & subagents

- **Hooks:** `.kiro/hooks/*.json` — event-triggered automation.
- **Subagents:** custom subagents supported as of Kiro v0.9+.

## Strategy for AI-DLC

Rely on `AGENTS.md` for orchestrator prose; symlink shared skills into
`.kiro/skills/`; generate `inclusion: fileMatch` steering only for file-scoped
needs, via `rulesync` (see `sync-strategy.md`).

## Sources

- https://kiro.dev/docs/steering/
- https://kiro.dev/docs/skills/
- https://kiro.dev/docs/specs/
