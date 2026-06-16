# SKILL.md frontmatter — field-by-field reference

Every field below is real and current as of mid-2026. Sources:
https://code.claude.com/docs/en/skills and the platform best-practices guide
(https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices).
Do not add fields not listed here.

## Contents

- [Required fields](#required-fields)
- [Optional fields](#optional-fields)
- [Where it does NOT belong](#where-it-does-not-belong)
- [Validation checklist](#validation-checklist)

## Required fields

### `name`

- Lowercase letters, digits, and hyphens only. ≤64 characters.
- Must NOT contain the reserved words `claude` or `anthropic`.
- In Claude Code the **directory name** is what sets the `/command` and the
  activation identity; the `name` field is the human-readable label shown in
  listings. Keep `name` equal to the directory name — the repo accuracy bar
  (`AGENTS.md`) requires it, and a mismatch is confusing at best.

### `description`

- Platform-wise *recommended*, not strictly required — if omitted, Claude Code
  falls back to the first paragraph of the body. **This repo requires it** (the
  accuracy/triggering bar in `AGENTS.md`): a skill with no explicit description is
  a skill that won't reliably trigger. Always write one.
- ≤1024 characters. Third person. No "I"/"you".
- Front-load the trigger in the first ~100 chars; then `Use when …` with concrete
  scenarios and literal keywords. This is the activation lever — see the
  `description-engineering` skill for the full craft.
- Claude Code truncates the skill **listing** at 1536 chars per entry and `/doctor`
  shows a truncated form, so the opening sentence must stand on its own.

## Optional fields

Add ONLY when the skill needs the behavior.

### `allowed-tools`

Pre-approves specific tool invocations so the skill runs without a permission
prompt. Pattern syntax matches settings permissions, e.g.:

```yaml
allowed-tools:
  - Bash(shellcheck *)
  - Bash(git diff *)
```

It **pre-approves; it does not restrict.** A skill does not lose access to other
tools by listing some here. To actually limit what an *agent* can touch, use the
agent's `tools`/`disallowedTools` (see the `writing-subagents` skill).

### `disable-model-invocation: true`

Stops the model from auto-firing the skill on its own judgement. The skill becomes
reachable only via explicit `/command` invocation. Use for side-effecting or
user-only workflows (publishing, deleting, anything you never want triggered as a
guess).

### `user-invocable: false`

The inverse surface control: the skill can auto-fire but does **not** appear as a
slash command for the user.

### `model` / `effort`

Pin the model or effort level for the skill's work when it has a clear tier need
(e.g. a mechanical extraction skill pinned to a cheaper model). Omit to inherit.

### `paths`

Glob(s) that gate auto-activation to matching files. The skill only auto-fires
when the working context involves a matching path. Useful for language- or
framework-specific skills:

```yaml
paths:
  - "**/*.tf"
```

### `context: fork` + `agent`

Run the skill's work in a forked context, optionally handing off to a named
`agent`. Use when the skill does heavy exploration whose intermediate context you
do not want polluting the main conversation.

## Where it does NOT belong

- **`license`, `version`** — these live in the **plugin manifest**
  (`plugin.json` / marketplace entry), not in `SKILL.md`. Putting them in
  frontmatter has no effect. See the `plugin-packaging` and `marketplace-publishing`
  skills.
- **Tool *restriction* for safety** — frontmatter `allowed-tools` only
  pre-approves. Hard limits are an agent concern.

## Validation checklist

```text
- [ ] Frontmatter parses as YAML (no tabs, quoted colons/special chars)
- [ ] name == directory name, kebab-case, ≤64 chars, no claude/anthropic
- [ ] description third person, ≤1024 chars, trigger in first ~100 chars
- [ ] every optional field present is actually used by the skill
- [ ] no license/version (those belong in the plugin manifest)
```
