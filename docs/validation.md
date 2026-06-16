# Validation & pre-flight checks

This repo validates its own Markdown, frontmatter, and links before every commit
and PR. The checks are light, zero-dependency (Node built-ins only, plus two
optional external tools), and fast. They cover the **internal kit-builder layer**
— the skills, agents, and docs in this repo — not the future product installer.

## Run it locally

```sh
bash scripts/preflight.sh
```

It runs every check, aggregates the results, prints a `PASSED / SKIPPED / FAILED`
summary, and exits non-zero if anything failed. A check is `SKIPPED` (not failed)
when its optional tool is missing, so you can run a partial pre-flight without
installing everything — but CI installs all tools, so a green CI run requires all
checks to pass.

You can also run any single check directly:

```sh
node scripts/validate-frontmatter.mjs
node scripts/validate-links.mjs
```

## What each check does

| Check                  | Command                                           | Verifies                                                 |
| ---------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| Markdown lint          | `npx markdownlint-cli2 "**/*.md" "#node_modules"` | Style/format rules in `.markdownlint.jsonc`              |
| Frontmatter validation | `node scripts/validate-frontmatter.mjs`           | Skill/agent YAML frontmatter is well-formed and conforms |
| Link validation        | `node scripts/validate-links.mjs`                 | Local Markdown links and `@imports` resolve              |
| Shellcheck             | `shellcheck scripts/*.sh`                         | Shell scripts are POSIX-clean                            |

### Frontmatter validation (`validate-frontmatter.mjs`)

For every `.claude/skills/<dir>/SKILL.md`:

- has YAML frontmatter with non-empty `name` and `description`;
- `name` is kebab-case (lowercase, digits, hyphens), ≤64 chars, and contains
  neither `claude` nor `anthropic`;
- `name` **equals** the skill's directory name;
- `description` is ≤1024 chars.

For every `.claude/agents/<name>.md`:

- has YAML frontmatter with non-empty `name` and `description`;
- `name` matches `^[a-z0-9-]+$` and **equals** the filename without `.md`;
- if a `tools` field is present and the agent is a known read-only agent
  (`brainstorm`, `planner`, `adversarial-reviewer`, `qa`, `security`,
  `rca-analyst`, `researcher`), `tools` must not include `Write` or `Edit`;
- if a `skills:` list is present, every entry must be an existing directory under
  `.claude/skills/`.

The script parses frontmatter with a small built-in YAML reader (flat scalars,
block/inline lists) — no YAML dependency. It tolerates a half-authored repo: a
skill directory that exists without a `SKILL.md`, or a missing `.claude/agents/`
directory, is skipped rather than treated as an error. Only files that exist are
validated.

### Link validation (`validate-links.mjs`)

Scans every tracked (and not-git-ignored) `.md` file for inline Markdown links
`[text](target)` and `@imports` (e.g. `CLAUDE.md`'s `@AGENTS.md`). For every
**local** target — anything that is not `http(s):`/`mailto:`/`tel:`/`ftp:` and not
a bare `#anchor` — it strips any `#anchor`/`?query` and checks the file exists
relative to the linking file. It skips links inside fenced code blocks and inline
code spans (illustrative, not live) and obvious fill-in placeholders (e.g. the ADR
template's `./XXXX-....md`). Broken links are reported as `file:line -> target`.

### Markdown lint and shellcheck

Markdown lint uses `markdownlint-cli2` with the repo's `.markdownlint.jsonc`.
Shellcheck lints every `scripts/*.sh`. Both are optional locally (the orchestrator
reports `SKIPPED` with an install hint if the tool is absent) and installed in CI.

## CI

`.github/workflows/preflight.yml` runs on every pull request and on pushes to
`main`. It checks out the repo, sets up Node 20, installs `markdownlint-cli2` and
`shellcheck`, then runs `bash scripts/preflight.sh`. Because CI installs all
tools, nothing is skipped there: **if pre-flight passes locally with the tools
installed, CI is green.**

## How this maps to the skills

These scripts are the executable core of two skills in this repo's roster:

- **`pre-flight-checks`** — the pre-commit/pre-PR gate (markdown lint, frontmatter
  validation, link check, shellcheck). `scripts/preflight.sh` is that gate; run it
  before committing or opening a PR.
- **`kit-validation`** — what "real tests" mean for this kit: validation tooling
  plus triggering evals. The frontmatter and link validators are the validation
  half of that story (the triggering-eval harness is the complementary half).

Keep these scripts faithful to current skill/agent schema: when the authoring
conventions in the `writing-skills` and `writing-subagents` skills change, update
the validators in the same effort.
