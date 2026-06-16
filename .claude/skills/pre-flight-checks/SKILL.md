---
name: pre-flight-checks
description: The pre-commit / pre-PR gate for AI-DLC. Use before committing, before opening or updating a PR, or when CI fails — runs markdown lint, frontmatter validation, JSON manifest schema checks, link integrity, and shellcheck so that if pre-flight passes locally, CI is green.
---

# Pre-Flight Checks

The local gate every change clears before commit and before a PR. The contract:
**if pre-flight passes locally, CI must be green.** Any divergence is a pipeline
bug to fix immediately, not a check to skip.

Run the whole set; do not cherry-pick. Validation tooling lives in `scripts/`
(invoke the scripts there); the *strategy* behind these checks — including the
triggering evals that complement them — is the `kit-validation` skill.

## The checklist

```text
- [ ] 1. Markdown lint clean
- [ ] 2. Frontmatter valid (skills + agents)
- [ ] 3. JSON manifests valid against schema (when present)
- [ ] 4. Links + cross-references resolve
- [ ] 5. shellcheck clean (any shell touched)
- [ ] 6. Commit message is a Conventional Commit
```

### 1. Markdown lint

Lint all Markdown against `.markdownlint.jsonc` at the repo root.

```bash
npx markdownlint-cli2 "**/*.md"
```

`markdownlint`/`markdownlint-cli2` reads the repo's `.markdownlint.jsonc`
(MD013/line-length and MD041/first-line-heading are intentionally relaxed there
for frontmatter files and tables — do not re-enable them locally).

### 2. Frontmatter validation

Every authored file must have valid, conformant YAML frontmatter:

- **Skills** (`.claude/skills/*/SKILL.md`): frontmatter parses as YAML; has
  `name` and `description`; `name` is kebab-case and **equals the directory
  name**; `description` is present and within length limits; no invented fields.
- **Agents** (`.claude/agents/*.md`): frontmatter parses; has `name` and
  `description`; `name` **equals the filename** without `.md`; any `tools` value
  is a real tool list; **read-only agents declare no `Write` or `Edit`** in
  `tools` (the `qa`, `security`, `rca-analyst`, `researcher`, `brainstorm`,
  `planner`, `adversarial-reviewer` agents are read-only). Authoring agents that
  inherit all tools omit `tools` entirely.

This is correctness, not style: a name/dir mismatch breaks invocation, and a
read-only reviewer with `Write` violates least-privilege.

### 3. JSON manifest schema validation

When the repo carries plugin/marketplace manifests (e.g. `plugin.json`,
`.claude-plugin/marketplace.json` — present once distribution lands), validate
each against its schema and confirm referenced paths exist. Skip cleanly when no
manifest is present; never fabricate a passing result for a file that does not
exist.

### 4. Link integrity

Resolve every intra-repo link and every skill/agent cross-reference:

- Relative Markdown links (e.g. `[`.claude/agents/`](.claude/agents/)`) point to
  files/dirs that exist.
- Skill/agent names referenced in backticks (e.g. the `kit-validation` skill,
  the `security` agent) correspond to an actual directory/file. A broken
  cross-reference is a defect — guidance that points nowhere misleads agents.
- `reference/`/`scripts/` paths a `SKILL.md` cites exist and are one level deep.

### 5. shellcheck

Any shell script (installer, validation tooling under `scripts/`) passes
`shellcheck` and a dry run:

```bash
shellcheck path/to/script.sh
```

Scripts that run on a consumer's machine also warrant a `security` review (see
the `security-review` skill) — `shellcheck` clean is necessary, not sufficient.

### 6. Conventional Commit

The commit message conforms to the `conventional-commits` skill (type, optional
repo scope, imperative description, breaking-change footer when applicable).

## When something fails

Fix it before committing. If a check fails in CI but passed locally — or vice
versa — that mismatch is itself the bug: reconcile the local invocation with the
CI workflow so the contract holds. Report failures honestly with the tool
output; never claim green checks you did not see.
