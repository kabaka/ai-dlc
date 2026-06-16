---
name: conventional-commits
description: Write commit messages for the AI-DLC repo following the Conventional Commits specification. Use when committing changes, writing a commit message, squashing a PR, or reviewing commit-message format — covers types, repo scopes (agents/skills/orchestrator/ci/docs/dist), and breaking-change footers that drive SemVer.
---

# Conventional Commits

All commits in AI-DLC follow the
[Conventional Commits](https://www.conventionalcommits.org/) specification. The
team derives the release version from commit history — see *Versioning* below —
so the type and the breaking-change marker are load-bearing, not cosmetic.

## Format

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Types

| Type       | When to use                                                       |
| ---------- | ----------------------------------------------------------------- |
| `feat`     | A new skill, agent, capability, or user-facing addition           |
| `fix`      | A correction to existing guidance, frontmatter, links, or scripts |
| `docs`     | Documentation only (README, usage guides, contributor docs)       |
| `refactor` | Restructuring an agent/skill/doc without changing its behavior    |
| `test`     | Adding or updating validation: evals, schema checks, lint config  |
| `chore`    | Maintenance, dependency bumps, repo housekeeping                  |
| `ci`       | CI/CD workflow and pipeline changes                               |
| `perf`     | Measurable improvement (e.g. trimming a skill that over-loads)    |
| `build`    | Packaging, manifest, or installer build-system changes            |

`test` covers this repo's validation changes — pre-flight checks, frontmatter
schema rules, and triggering evals — since those are how we "test" the kit (see
the `kit-validation` skill).

## Rules

- **Description**: imperative mood, lowercase, no trailing period. Max 72 chars.
- **Scope**: optional but encouraged; name the area touched. Common scopes for
  this repo: `agents`, `skills`, `orchestrator` (for `AGENTS.md`/`CLAUDE.md`),
  `ci`, `docs`, `dist` (packaging/marketplace/installer), `methodology`,
  `cross-platform`. A skill or agent name is also a fine scope when a change is
  local to one (e.g. `fix(skills): tighten kit-review triggering`).
- **Body**: explain *what* and *why*, not *how*. Wrap at 72 characters.
- **Breaking changes**: append `!` after the type/scope (e.g. `feat(skills)!:`)
  **and** add a `BREAKING CHANGE:` footer describing the break and the migration.
  A breaking change is anything that forces consumers or contributors to change
  how they install, configure, or invoke the kit — e.g. renaming a skill/agent,
  removing a frontmatter field, or changing a manifest schema.

## Examples

```text
feat(skills): add ecosystem-research skill for the researcher agent

fix(agents): give the security agent read-only tools only

docs: document the install flow in the README quickstart

refactor(orchestrator): split delegation rules into delegation-patterns

test(ci): add frontmatter name==dir validation to pre-flight

chore(dist): pin marketplace source to a tagged ref

feat(skills)!: rename code-review skill to kit-review
```

Footer for the breaking example:

```text
feat(skills)!: rename code-review skill to kit-review

BREAKING CHANGE: the `code-review` skill is now `kit-review`. Update any
agent `skills:` lists and cross-references that named `code-review`.
```

## Versioning (team-owned, never hand-edited)

The repo uses [Semantic Versioning](https://semver.org/). The version is
**derived from commit history**, not edited by hand:

- `fix:` / `perf:` → patch bump.
- `feat:` → minor bump.
- any commit with `!` or a `BREAKING CHANGE:` footer → major bump.

The product owner (the user) **never edits version numbers or the changelog by
hand**. The team (the `devops` agent, automation) computes the bump from commits
and updates `CHANGELOG.md` (Keep a Changelog format) at release time. Write the
commit correctly and the version takes care of itself.
