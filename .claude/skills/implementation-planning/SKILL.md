---
name: implementation-planning
description: How to produce a detailed, sequenced authoring plan for a kit change — scope, deliverables mapped to specialists, ordered steps, the full validation plan (frontmatter/lint/schema/links/shellcheck/triggering evals), risks, and done criteria. Use when planning a skill, agent, orchestrator, config, or tooling change before authoring (the planner agent's playbook).
---

# Implementation Planning

A good plan lets a specialist author the deliverable without redesigning the
approach. Ground it in the real repo (read the target files, sibling skills,
`AGENTS.md`, and the roster before you plan) and make it concrete and sequenced.

The deliverables are authoring artifacts — skills, subagent definitions,
orchestrator docs, cross-platform config, distribution tooling, methodology
content — and their validation, not application code.

## Plan template

```markdown
## Objective & scope
What is being authored or changed; explicit in-scope and out-of-scope boundaries.

## Deliverables
For each file: what it is, what changes, and which specialist owns it
(skill-author / agent-author / orchestration-designer / prompt-engineer /
aidlc-methodologist / cross-platform-integrator / distribution-engineer /
tooling-engineer / devops / documentation / adr-author). Note new vs edited and
whether a reference/ or scripts/ subdir is warranted.

## Sequenced steps
1. <step> — deliverable — owner — depends on [...] — [parallel-ok?]
2. ...

## Validation plan (the "tests" of this repo)
- Frontmatter: parses as YAML; name == directory/filename; only allowed fields.
- Markdown lint: passes the repo linter.
- Manifest schema: marketplace.json / plugin manifest validates against schema.
- Link integrity: all cross-references and reference/ links resolve.
- Shell: any script passes `shellcheck` and a dry run.
- Triggering evals: prompts that SHOULD fire the skill/agent do, and adjacent
  prompts that should NOT don't. See `kit-validation` and `pre-flight-checks`.

## Risks & mitigations
Especially: inaccurate/outdated tool claims, weak descriptions that won't trigger,
cross-platform breakage, roster/skill overlap, packaging/versioning gotchas.

## Done criteria
How we will know every requirement is met (no deferrals, no fakes, validation
genuinely passes).
```

## Principles

- **Cover every requirement, fully.** Each stated requirement maps to concrete
  steps and real validation. No "phase 2," no stub descriptions or placeholder
  content standing in for the real thing.
- **Respect the architecture.** Canonical orchestrator guidance lives in
  `AGENTS.md`; `CLAUDE.md` imports it. Skills follow progressive disclosure
  (tight `SKILL.md`, depth in `reference/`); agents follow least-privilege tools
  and single responsibility. Plan changes to fit this model, not around it. See
  `cross-platform-config` before adding tool-specific files.
- **Simplest sufficient design.** Prefer the least complex approach that fully
  meets the requirements — reuse an existing skill or agent over inventing a new
  one when it fits, and avoid roster overlap.
- **Sequence for safety and parallelism.** Order steps by dependency; mark what
  can run in parallel; do risky/uncertain pieces early. When a claim about
  fast-moving tool behavior is load-bearing, schedule a `researcher` verification
  before authoring depends on it.
- **Make trade-offs explicit** so adversarial reviewers and the Orchestrator can
  judge them. Flag anything that warrants an ADR (`adr-authoring`).

## Planning checklist

- [ ] Is every claim (frontmatter field, command, flag, schema key) accurate to
      current tool behavior, or flagged for `researcher` verification?
- [ ] Does each new/changed skill or agent have a front-loaded, third-person
      "Use when…" description, and a triggering eval in the plan?
- [ ] Does the deliverable degrade gracefully cross-platform (Claude Code first,
      then Copilot/Kiro/Cursor/AGENTS.md readers) without breaking
      single-source-of-truth?
- [ ] Is the `SKILL.md` budget respected (under ~400–500 lines), with depth pushed
      to `reference/`/`scripts/` only where genuinely warranted?
- [ ] Does anything run on a consumer machine (installer/script), touch MCP, or
      process untrusted input — and is `security` review scheduled if so?
- [ ] Is the validation plan real (genuine checks and triggering evals, not ones
      that trivially pass)?
