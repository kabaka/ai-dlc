# SKILL.md anti-pattern catalog

Each entry: the symptom, why it hurts, and the fix. Verified against
https://code.claude.com/docs/en/skills and the platform best-practices guide
(mid-2026).

## Contents

- [Description anti-patterns](#description-anti-patterns)
- [Body anti-patterns](#body-anti-patterns)
- [Structure anti-patterns](#structure-anti-patterns)
- [Script anti-patterns](#script-anti-patterns)
- [Frontmatter anti-patterns](#frontmatter-anti-patterns)

## Description anti-patterns

### Vague description

- Symptom: `description: Helps you work with skills.`
- Why it hurts: nothing in the metadata layer matches a real request, so the skill
  never fires. Metadata is the only thing in context until the skill triggers — if
  it is vague, the skill is dead weight.
- Fix: `[what it does] + Use when [concrete scenarios + literal keywords]`. See the
  `description-engineering` skill.

### Workflow summary in the description

- Symptom: the description recounts the steps ("First it lints, then it validates
  frontmatter, then it checks links…").
- Why it hurts: spends the trigger budget describing internals instead of stating
  *when* to fire. The model routes on triggers, not on a procedure.
- Fix: state what it does and the trigger scenarios; keep the procedure in the body.

### First/second person description

- Symptom: "I help you write skills" / "you can use this to…".
- Why it hurts: breaks the routing convention and reads as a chat turn, not a
  catalog entry. Third person is the standard.
- Fix: "Best practices for authoring SKILL.md files… Use when…".

### Overfitting to test prompts

- Symptom: the description only fires on the exact phrasing you tested.
- Why it hurts: real users phrase things differently; the skill silently misses.
- Fix: include synonyms and adjacent scenarios; test with varied realistic prompts
  (the `skill-evaluation` skill).

## Body anti-patterns

### Over-explaining

- Symptom: paragraphs teaching the model things it already knows (what YAML is,
  how Markdown works).
- Why it hurts: wastes the sticky token budget (the body stays in context all
  session) for zero project-specific value.
- Fix: encode only the project-specific, fragile, and easily-forgotten. Assume an
  Opus-class reader.

### Menu of options

- Symptom: "you can use grep, ag, or ripgrep; pick whichever."
- Why it hurts: forces the model to choose with no basis and produces inconsistent
  runs.
- Fix: one default with an escape hatch — "Use `rg`. If unavailable, `grep -r`."

### Inconsistent terminology

- Symptom: the same concept is called "subagent", "agent", and "worker" across the
  body.
- Why it hurts: the model can't tell whether they're the same thing.
- Fix: pick one term per concept and use it everywhere.

### Wrong degrees of freedom

- Symptom: a destructive or fragile procedure described in loose prose.
- Why it hurts: prose invites improvisation; the model reinterprets and breaks
  something.
- Fix: give fragile/destructive steps an exact script to run. Match freedom to
  fragility.

## Structure anti-patterns

### Oversized body

- Symptom: `SKILL.md` over ~500 lines.
- Why it hurts: bloats context on trigger and after compaction (only the first ~5k
  tokens survive compaction).
- Fix: push depth into `reference/<topic>.md`; keep the body a lean playbook.

### Deeply nested references

- Symptom: `SKILL.md` → `reference/a.md` → `reference/b.md` → `reference/c.md`.
- Why it hurts: Claude only partially follows nested references; level-3+ content
  is often never read.
- Fix: link all references one level deep from the body. Flatten the tree.

### Reference with no TOC

- Symptom: a 300-line reference file with no table of contents.
- Why it hurts: the model reads the whole thing to find one section, wasting tokens.
- Fix: add a short TOC at the top of any reference over ~100 lines.

## Script anti-patterns

### Voodoo constants

- Symptom: `sleep 7`, `--retries 4`, a magic regex — no comment.
- Why it hurts: the next author can't safely change it; the model can't reason
  about it.
- Fix: comment every non-obvious constant with *why* it has that value.

### Punting on errors

- Symptom: a script that pipes to `|| true`, swallows stderr, or exits 0 on failure.
- Why it hurts: the model trusts a silent "success" and proceeds on broken state.
- Fix: fail loudly — exit non-zero with a clear message; `set -euo pipefail`.

### Phantom scripts

- Symptom: the body references `scripts/foo.sh` that doesn't exist or was never run.
- Why it hurts: a fake — violates the no-fakes delivery rule; the skill breaks on
  use.
- Fix: create it, run it, `shellcheck` it. Reference via `${CLAUDE_SKILL_DIR}`.

### RUN/READ ambiguity

- Symptom: the body points at a script without saying whether to run or read it.
- Why it hurts: opposite context costs; the model may dump a script into context
  it should have executed, or vice versa.
- Fix: state "run" or "read" explicitly for each bundled file.

## Frontmatter anti-patterns

### Reserved words / name mismatch

- Symptom: `name: claude-skill-helper`, or `name` ≠ directory name.
- Why it hurts: reserved words are rejected; a mismatch breaks the
  directory-is-identity model in Claude Code.
- Fix: kebab-case, no `claude`/`anthropic`, `name` == directory.

### Invented fields

- Symptom: frontmatter keys that aren't in the real schema (`tags:`, `priority:`).
- Why it hurts: ignored at best; a fake at worst.
- Fix: use only the documented fields (see `reference/frontmatter.md`).

### Misplaced license/version

- Symptom: `version: 1.2.0` in `SKILL.md`.
- Why it hurts: no effect; the real home is the plugin manifest.
- Fix: move to `plugin.json` / the marketplace entry.
