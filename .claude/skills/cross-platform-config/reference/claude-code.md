# Claude Code config & the bridge to AGENTS.md

Claude Code is the first-class target for AI-DLC. It reads **only `CLAUDE.md`** for
project instructions — it does **not** read `AGENTS.md`. To keep `AGENTS.md`
canonical, bridge.

## The bridge: `@AGENTS.md` import (preferred)

Make `CLAUDE.md` a thin file that imports the canonical doc, then add only
Claude-specific notes:

```markdown
@AGENTS.md

<!-- Claude-Code-only notes below, e.g. references to skills/subagents that
     only exist in Claude Code -->
```

Claude Code resolves `@path` imports, so the content of `AGENTS.md` is pulled in at
load time. This is preferred over a symlink because:

- It works on Windows and on CI checkouts that don't preserve symlinks.
- It lets you append Claude-only lines without forking the shared content.

### Alternative: symlink (use only if you have a reason)

```sh
ln -sf AGENTS.md CLAUDE.md
```

Gives byte-identical content, but **can break on some Windows/CI checkouts** (the
symlink becomes a text file containing the path) and **cannot carry Claude-only
notes**. Prefer the import.

## Subagents — `.claude/agents/*.md`

Claude Code's subagent definitions. Frontmatter: `name`, `description`, optional
`tools`, optional `model`, optional `skills`. See the `writing-subagents` skill for
authoring.

**Interop win:** GitHub Copilot reads this same `.claude/agents/` directory
directly (Claude sub-agents format). Our subagents work in Copilot with zero
duplication — author them once here.

## Skills — `.claude/skills/<name>/SKILL.md`

Claude Code skills. Frontmatter: `name` + `description` (see `writing-skills`).
Kiro uses the same schema under `.kiro/skills/<name>/` — share by symlinking the
skill directory rather than copying (copies drift). See `kiro.md` and
`sync-strategy.md`.

## Source

- AGENTS.md reader list and Claude Code exception: https://agents.md
