---
name: writing-skills
description: Best practices for authoring Claude Code SKILL.md files — frontmatter fields, three-level progressive disclosure, size budgets, scripts-vs-prose, terminology, and the anti-pattern catalog. Use when writing or revising a skill, a SKILL.md, a `.claude/skills/<name>/` directory, deciding what belongs in `reference/` vs the body, or fixing a skill that loads too much or fires wrong (the skill-author agent's playbook).
---

# Writing Skills

A skill is a directory holding a `SKILL.md` plus optional bundled `reference/`,
`scripts/`, and `assets/`. Claude Code surfaces the skill's name and description
in every session and loads the rest only when the skill triggers. Your job as
author is to make it fire at the right time (the `description` does this — see the
`description-engineering` skill) and, once fired, to teach the model exactly what
it needs and nothing more.

Assume the reader is an Opus-class model. A 50-token snippet beats a 150-token
explanation. Do not explain what the model already knows; encode the
project-specific, the fragile, and the easily-forgotten.

Sources, all verified mid-2026 — cite inline when a claim is non-obvious:

- https://code.claude.com/docs/en/skills
- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
- https://github.com/anthropics/skills (the `skill-creator` skill)

## Frontmatter

Only two fields are needed in almost every case:

```yaml
---
name: writing-skills          # kebab-case, ≤64 chars, lowercase + hyphens
description: <see below>      # ≤1024 chars, third person, front-loaded trigger
---
```

- **`name`** must be lowercase letters, digits, and hyphens; ≤64 chars; must NOT
  contain the words "claude" or "anthropic" (reserved). In Claude Code the
  **directory name** sets the `/command` and the activation key; the `name` field
  is the display label. Keep them equal to avoid confusion (the accuracy bar in
  `AGENTS.md` requires `name` == directory name).
- **`description`** is the single biggest lever for whether the skill fires. Write
  it third person, front-load the trigger in the first ~100 chars, then "Use
  when …" with concrete scenarios and the literal keywords a request would
  contain. Full craft lives in the `description-engineering` skill. Claude Code
  truncates the skill *listing* at 1536 chars total per entry, and `/doctor`
  shows a truncated form — keep the first sentence self-sufficient.

Add an optional field ONLY when the skill genuinely needs it. All are real; do not
invent others. See `reference/frontmatter.md` for the field-by-field reference.

| Field | Use it when |
| --- | --- |
| `allowed-tools` | Pre-approve specific tools so the skill runs without prompts (e.g. `Bash(shellcheck *)`). Pre-approves; does **not** restrict. |
| `disable-model-invocation: true` | Side-effecting / user-only workflows that must never auto-fire; reachable only via explicit `/command`. |
| `user-invocable: false` | Auto-only skills that should not appear as a slash command. |
| `model` / `effort` | Pin a model or effort for this skill's work. |
| `paths` | Glob-gate auto-activation to matching files only. |
| `context: fork` + `agent` | Run the skill in a forked context / hand off to a named agent. |

`license` and `version` belong in the **plugin manifest**, not in `SKILL.md` —
putting them here does nothing. See the `plugin-packaging` skill.

## Progressive disclosure — the core model

Skills load context in three levels. Design every skill around this:

1. **Metadata** (`name` + description, ~100 words). Always in context, for *every*
   installed skill, every session. This is a permanent token cost across the whole
   roster — keep it tight.
2. **`SKILL.md` body.** Loaded when the skill triggers. Target **under ~400–500
   lines.** This is the playbook.
3. **Bundled files** (`reference/`, `scripts/`, `assets/`). Loaded on demand, only
   when the body points to them. Effectively unbounded — this is where depth goes.

Rules that fall out of this model:

- Keep the body lean; push field-by-field references, long examples, and
  anti-pattern catalogs into `reference/<topic>.md`.
- Link references **one level deep** from `SKILL.md`. Claude only partially reads
  nested references (a ref that links to another ref), so a reader may never reach
  level-3-of-3. Flatten instead.
- Put a short **table of contents at the top of any reference file over ~100
  lines** so the model can jump to the relevant section without reading it all.
- Reference bundled files by relative path and say what to do with each: *read*
  `reference/foo.md` for knowledge, *run* `scripts/bar.sh` for an action.

## Body structure

Open with 1–3 sentences: what the skill is for and when to use it. Then either:

- **Workflow skill** — numbered steps or a copy-into-notes checklist. Use checklists
  for multi-step processes the model should track (see `brainstorming`,
  `orchestration-workflow`).
- **Knowledge skill** — structured reference: tables, field lists, decision rules.

Write imperatively and in the second person for instructions ("List every stated
requirement…"). Use consistent terminology throughout — pick one term per concept
and never alias it. Give **one recommended default** approach with an escape hatch,
not a menu of equally-weighted options that forces the model to choose.

### Match degrees of freedom to task fragility

This is the central style decision. The more fragile or destructive the operation,
the less freedom you give the model:

| Task character | What to write |
| --- | --- |
| Open-ended, creative, many valid answers | Prose guidance and principles. Let the model reason. |
| A reliable procedure with judgement at each step | A numbered checklist with rationale per step. |
| Fragile, deterministic, or destructive (migrations, releases, parsing) | An exact script the model **runs**, not prose it reinterprets. |

Prose invites improvisation; a script guarantees the same bytes every time. Choose
deliberately. A skill that hand-waves a destructive step in prose is a defect.

## Scripts

Bundle a script when you need determinism, token savings (the model runs it
instead of re-deriving logic), or repeated exact behavior.

- Say explicitly whether to **run** or **read** each script. They have opposite
  costs: running keeps logic out of context; reading pulls it in.
- Reference scripts via `${CLAUDE_SKILL_DIR}/scripts/<file>` so the path resolves
  wherever the skill is installed. Never hardcode an absolute repo path.
- Scripts must **handle errors and fail loudly** — never swallow a failure and
  continue, because the model will trust a silent success. Exit non-zero with a
  clear message.
- **Document every magic number / "voodoo constant."** A bare `sleep 7` or
  `--retries 4` with no comment is a defect; the next author cannot safely change
  it. State why the value is what it is.
- Only reference scripts you actually create and that actually work (no fakes —
  see `AGENTS.md` delivery rules). Run `shellcheck` and a dry run; see the
  `pre-flight-checks` skill.

## Tools and MCP

- Recommend **one default tool** per job, not a menu. "Use `rg` to search" beats
  "you can use grep, ag, or rg."
- Refer to MCP tools by their **fully-qualified name** (`Server:tool`, e.g.
  `Linear:create_issue`). A bare tool name is ambiguous across servers.

## Claude Code lifecycle gotchas

These shape what you put in a body, because the body is *sticky*:

- An invoked `SKILL.md` **stays in the conversation for the rest of the session** —
  a recurring token cost on every subsequent turn. Write the body as **standing
  instructions** that remain useful after the immediate task, not as one-shot
  scratch notes.
- **After compaction**, Claude Code re-attaches recent skill invocations, keeping
  the first ~5k tokens of each within a combined ~25k-token budget. A large skill
  is truncated to its first 5k tokens after compaction. So: front-load the
  essentials, and **re-invoke a big skill after compaction** if you still need its
  tail. Keep load-bearing content early in the body.

## Anti-patterns

Full catalog with fixes in `reference/anti-patterns.md`. The headline offenders:

- Vague descriptions ("helps with skills") — the skill never fires.
- Summarizing the whole workflow in the description instead of stating triggers.
- First/second-person descriptions ("I help you…", "you can use this to…").
- Body over ~500 lines, or deeply nested references the model never reaches.
- A menu of tool options instead of one default.
- Undocumented "voodoo constants"; scripts that punt on errors.
- Reserved words ("claude"/"anthropic") or a `name` that mismatches the directory.
- Overfitting the description to your test prompts so it only fires on the exact
  wording you tested. Test with varied real prompts — see the `skill-evaluation`
  skill.

## Validate before shipping

A skill is not done until it triggers and behaves. Write evals **before** the
docs and iterate against them (the `skill-evaluation` skill), and run the
`pre-flight-checks` gate (frontmatter parses, links resolve, `shellcheck` passes).
