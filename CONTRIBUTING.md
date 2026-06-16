# Contributing to AI-DLC

This guide is for contributors to the **internal kit-builder** — the Orchestrator,
agents, and skills the AI team uses to build the AI-DLC kit. Read
[`AGENTS.md`](AGENTS.md) first; it is the canonical operating definition and this
guide assumes it.

## How work happens here: the Orchestrator model

You do not edit agents and skills by hand. You **describe the change to the
Orchestrator** — the main AI session — and it does the work:

- **You are the product owner, reviewer, and arbiter.** You state requirements,
  judge results, and make the calls AI is not allowed to make on its own.
- **The Orchestrator coordinates.** It plans, runs dual planning and adversarial
  review, delegates to specialist subagents, judges their feedback, and reports
  back. It does not implement itself.
- **The agent team does the work.** Authoring, validation, and review are done by
  the specialists in `.claude/agents/`, driven by the skills in `.claude/skills/`.

So a contribution looks like: *talk to the Orchestrator, review what comes back,
arbitrate when agents disagree or a decision needs a human, and approve the PR.*
The full loop is in the `orchestration-workflow` skill; the operating rules are in
[`AGENTS.md`](AGENTS.md).

## Know which layer you are touching

The repo holds two layers — keep them straight (see [`AGENTS.md`](AGENTS.md) and
the [README](README.md)):

| Layer | What it is | Lives in |
| ----- | ---------- | -------- |
| **Internal kit-builder** | The orchestrator + agents + skills used to *build the kit* | `AGENTS.md`, `CLAUDE.md`, `.claude/` |
| **Deliverable product** | The kit *consumers install* into their own repos | built later, using layer 1 |

A skill that teaches *us* how to author skills is layer 1. A skill we *ship to
consumers* is layer 2. Today the repo is almost entirely layer 1 — we are building
the expertise that will later produce the product. Before you start, name the layer
your change serves; if it is product, it is almost certainly out of scope right now.

## The standard flow

Every change ships the same way (this is step 8 of the workflow in `AGENTS.md`):

1. **Feature branch.** Never commit directly to `main`; `main` stays releasable.
2. **Conventional Commits.** Commit messages follow Conventional Commits — see the
   `conventional-commits` skill (`feat:`, `fix:`, `docs:`, `chore:`, etc.).
3. **Pre-flight green.** All pre-flight checks pass locally before you push (below).
4. **PR.** Open a pull request describing the change and the layer it touches.
5. **CI pre-flight green.** CI runs the same pre-flight gate; if it passes locally
   it must pass in CI. A divergence is a pipeline bug to fix, not to work around.
6. **Review gates.** The Orchestrator dispatches reviewers — always `qa`, plus
   `adversarial-reviewer`, plus `security` for anything that runs on a consumer's
   machine, touches MCP, or handles untrusted input. **`qa` can block**: no change
   is complete until `qa` approves. Do not bypass it.
7. **Merge to `main`.** Only after CI is green and the review gates pass, and only
   when you have authorized push/PR/merge. Never fabricate green checks.

## Pre-flight checks

These must pass before commit and again in CI (see the `pre-flight-checks` skill):

- **Markdown lint** — config in [`.markdownlint.jsonc`](.markdownlint.jsonc).
- **Frontmatter validation** — skill/agent YAML frontmatter parses and conforms.
- **Manifest schema validation** — JSON manifests validate against their schema.
- **Link integrity** — cross-links and relative paths resolve.
- **`shellcheck`** — every shell script passes, plus a dry run.

"Tests" in this repo are these checks **plus skill/agent triggering evals** — they
must genuinely exercise behavior, not trivially pass. See the `kit-validation`
skill. No fakes: no placeholder content, stub descriptions, `TODO`s, invented
frontmatter fields, or example commands that were never run.

## Adding a new skill

Skills are procedural playbooks under `.claude/skills/<name>/SKILL.md`. Ask the
Orchestrator to author one; it delegates to the **`skill-author`** agent, which is
driven by the **`writing-skills`** and **`description-engineering`** skills. The
shape it will produce:

- Directory `.claude/skills/<name>/`, file `SKILL.md`. The `name` frontmatter field
  is kebab-case and **equals the directory name** (lowercase/hyphens, never contains
  "claude" or "anthropic").
- A front-loaded, third-person `description` with a concrete "Use when…" trigger —
  this is the #1 lever for the skill firing.
- A tight `SKILL.md` (target < 500 lines) with progressive disclosure; depth pushed
  into a `reference/` subdir (knowledge) or `scripts/` subdir (executables), linked
  one level deep.
- Triggering evals so the skill provably activates at the right moment.

Then add the skill to the manifest in [`AGENTS.md`](AGENTS.md) under the right
category, and to any agent that should preload it.

## Adding a new agent

Subagents live at `.claude/agents/<name>.md`. Ask the Orchestrator; it delegates to
the **`agent-author`** agent, driven by **`writing-subagents`** and
**`description-engineering`**. The shape:

- File `.claude/agents/<name>.md`; the `name` frontmatter field is kebab-case and
  **equals the filename** without `.md`.
- A trigger-based `description` that tells the Orchestrator *when* to delegate.
- **Least-privilege `tools`.** Authoring agents omit `tools` entirely (they inherit
  all). Read-only reviewers get a non-mutating set and **never** `Write`/`Edit`.
- Single responsibility; procedures live in preloaded skills, not the agent body.

Then register it in the roster in [`AGENTS.md`](AGENTS.md).

## AGENTS.md is canonical; do not edit CLAUDE.md for orchestrator guidance

[`AGENTS.md`](AGENTS.md) is the single source of truth for the orchestrator
definition. [`CLAUDE.md`](CLAUDE.md) imports it via `@AGENTS.md` and adds only
Claude-Code-specific notes below the import. Cursor, GitHub Copilot, and Kiro read
`AGENTS.md` directly; Claude Code reads `CLAUDE.md`.

**Edit operating guidance in `AGENTS.md`, not in `CLAUDE.md` or any duplicated
copy.** Put a note in `CLAUDE.md` only when it is genuinely Claude-Code-only. This
decision is recorded in
[ADR-0001](docs/decisions/0001-canonical-agents-md-with-claude-md-import.md).

## Cross-platform: preserve the single source of truth

This kit is Claude-Code-first but degrades gracefully to Copilot, Kiro, Cursor, and
any `AGENTS.md` reader. The `.claude/agents/` definitions are also consumed by
GitHub Copilot, and the `SKILL.md` format is shared with Kiro — the same assets
serve multiple tools with minimal duplication.

**Never break the single-source-of-truth model.** Do not fork `AGENTS.md` into
tool-specific copies, and do not introduce a Windows/CI-fragile mechanism (such as a
symlink) where an import or shared file works. Before adding any tool-specific file,
read the `cross-platform-config` skill.

## Recording decisions

Significant architectural or process decisions are captured as MADR-style ADRs in
[`docs/decisions/`](docs/decisions/). See that directory's
[README](docs/decisions/README.md) and the `adr-authoring` skill. Ask the
Orchestrator to delegate ADR drafting to the **`adr-author`** agent.
