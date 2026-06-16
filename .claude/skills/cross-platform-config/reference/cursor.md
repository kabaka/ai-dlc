# Cursor config

Cursor reads `AGENTS.md` natively and adds its own structured rules under
`.cursor/rules/`. It has no file-based subagent or skill primitive (it uses modes
and background agents instead), so AI-DLC reaches Cursor mainly through
`AGENTS.md` plus optional scoped `.mdc` rules.

## Rules — `.cursor/rules/*.mdc`

Rules are `.mdc` files (Markdown + frontmatter). **A plain `.md` file in
`.cursor/rules` is ignored** — without frontmatter there's nothing to specify
`description`/`globs`/`alwaysApply`. The three frontmatter fields map to four rule
types:

| Frontmatter | Rule type | When applied |
| --- | --- | --- |
| `alwaysApply: true` | Always | Included in every session |
| `globs: <pattern>` (+ `alwaysApply: false`) | Auto-Attached | When matching files are referenced |
| `description: <text>` (+ `alwaysApply: false`) | Agent-Requested | Agent decides relevance from the description |
| neither | Manual | Only via `@rule-name` mention in chat |

```markdown
---
description: API client conventions
globs: src/api/**
alwaysApply: false
---
Always wrap fetch calls in the retry helper.
```

## `.cursorrules` (legacy)

The single-file `.cursorrules` is the old mechanism. **Migrate** to
`.cursor/rules/*.mdc` (for scoped behavior) or rely on `AGENTS.md` (for shared
prose). Don't author new `.cursorrules`.

## AGENTS.md

Cursor reads `AGENTS.md` directly as a plain-Markdown alternative to structured
rules; nested `AGENTS.md` files are supported and the **more specific / nested file
wins**. This is the path by which AI-DLC's canonical orchestrator reaches Cursor
with no extra work.

## Strategy for AI-DLC

Lean on `AGENTS.md` for everything shared. Generate `.mdc` rules only when you need
Cursor's `globs`/`alwaysApply` scoping, via `rulesync` (see `sync-strategy.md`).

## Source

- https://cursor.com/docs/rules
