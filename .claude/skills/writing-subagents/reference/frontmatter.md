# Subagent frontmatter — field-by-field reference

Every field is real and current as of mid-2026. Sources:
https://code.claude.com/docs/en/sub-agents and
https://claude.com/blog/subagents-in-claude-code. Do not invent fields.

## Contents

- [Required fields](#required-fields)
- [Tool control](#tool-control)
- [Execution control](#execution-control)
- [Context and capabilities](#context-and-capabilities)
- [Cosmetic](#cosmetic)
- [Tools never available to subagents](#tools-never-available-to-subagents)
- [Precedence and plugin caveats](#precedence-and-plugin-caveats)

## Required fields

### `name`

The agent's identity and `@name` handle. Kebab-case. **Identity comes from this
field, not the filename** — but keep them equal (repo accuracy bar).

### `description`

The routing/dispatch signal. Third person; describe *when to delegate*. Add "Use
PROACTIVELY for…" / "MUST BE USED when…" to push auto-delegation. See the
`description-engineering` skill.

## Tool control

### `tools`

Allowlist of tools the agent may use. **Omitting it inherits ALL tools, including
all MCP tools** — the most important default to internalize. Examples:

```yaml
tools: Read, Grep, Glob, Bash          # read-only reviewer (+Bash for git diff)
tools: Read, Grep, Glob, WebSearch, WebFetch   # research-oriented read-only
```

### `disallowedTools`

Denylist. Use for an "inherit everything minus a few" shape, instead of re-listing
a large allowlist:

```yaml
disallowedTools: Write, Edit, Bash(rm *)
```

If both are present, the denylist subtracts from the (inherited or listed)
allowlist.

## Execution control

### `model`

`sonnet` | `opus` | `haiku` | `fable` | a full model id | `inherit`. Default
`inherit`. See the model-tiering section of `SKILL.md`.

### `permissionMode`

The permission posture for the agent's run, e.g. `plan`, `acceptEdits`,
`bypassPermissions`. `bypassPermissions` only in throwaway/isolated envs.
`plan` is what lets an agent use the plan-mode tools.

### `maxTurns`

Caps the agent's internal turn count — a budget guardrail for autonomous or
fan-out agents that might loop.

### `effort`

Pins the reasoning effort for the agent's model where supported.

### `background`

Runs the agent as a background task that reports back on completion, rather than
blocking the dispatch.

### `isolation: worktree`

Runs the agent in its own git worktree. Use for **parallel mutating** agents so
their edits don't collide. Unnecessary (and wasteful) for read-only agents.

## Context and capabilities

### `skills`

Preloads the **full content** of the named skill(s) into the agent at startup
(distinct from on-demand skill activation in the main session). This is the
mechanism for keeping the agent body short while still giving it a full procedure:

```yaml
skills:
  - writing-skills
  - description-engineering
```

### `mcpServers`

Scopes which MCP servers the agent can reach. (Ignored for plugin-provided agents
— see caveats.)

### `hooks`

Agent-scoped hooks. (Ignored for plugin-provided agents.)

### `memory`

`user` | `project` | `local` — selects which memory scope the agent reads/writes.

## Cosmetic

### `color`

Display color for the agent in the UI. No behavioral effect.

## Tools never available to subagents

Do not list these; do not design an agent that depends on them:

- `AskUserQuestion` — subagents cannot prompt the user. Return the question to the
  parent instead.
- `EnterPlanMode` / `ExitPlanMode` — only when `permissionMode: plan`.
- `ScheduleWakeup`.

## Precedence and plugin caveats

Name-collision resolution order (highest wins):

```text
managed  >  --agents flag  >  project .claude/agents/  >  user ~/.claude/agents/  >  plugin agents
```

**Plugin-provided subagents IGNORE `hooks`, `mcpServers`, and `permissionMode`.**
If you ship an agent inside a plugin, do not rely on those three fields. See the
`plugin-packaging` skill.

## Validation checklist

```text
- [ ] Frontmatter parses as YAML
- [ ] name == filename (without .md), kebab-case
- [ ] description is a "when to delegate" routing signal, third person
- [ ] tools present for any specialized agent (omission = inherit ALL incl. MCP)
- [ ] read-only reviewers have NO Write/Edit
- [ ] model tier matches the job (mechanical fan-out downshifted to haiku)
- [ ] no reliance on hooks/mcpServers/permissionMode if shipped in a plugin
```
