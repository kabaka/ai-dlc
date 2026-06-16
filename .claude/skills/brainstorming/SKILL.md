---
name: brainstorming
description: Structured ideation method to refine a fuzzy or complex kit-authoring request into a sharp, well-scoped problem statement with options, risks, and a recommendation — before any planning. Use when refining a complex request for new or changed skills, agents, orchestrator docs, cross-platform config, or tooling (the brainstorm agent's playbook).
---

# Brainstorming

A method for turning a vague or complex request into a sharp problem statement the
planners can act on. Diverge first to widen the option space, then converge to a
recommendation. This is thinking work — produce no authoring plan and write no
files.

The deliverables here are authoring artifacts: skills, subagent definitions,
orchestrator docs (`AGENTS.md`/`CLAUDE.md`), cross-platform config, distribution
tooling, methodology content, and their validation — not application code.

## Process

```text
- [ ] 1. Restate the real goal (not just the literal ask)
- [ ] 2. Extract requirements (explicit + reasonable implicit), make them testable
- [ ] 3. Diverge: generate distinct approaches
- [ ] 4. Pressure-test each against the priority order and risks
- [ ] 5. Converge: recommend a framing; list open questions
```

### 1. Restate the real goal

What outcome does the user actually want? Look past the surface request to the
underlying need. State it in one or two sentences. (E.g. "add a skill for X" may
really mean "agents keep getting X wrong because no one owns that knowledge.")

### 2. Extract requirements

List every explicit requirement and make each one testable. For authoring work,
"testable" means there is a check that would confirm it: a triggering eval that
fires on the right prompts, a frontmatter that parses and conforms, a link that
resolves, a manifest that validates, a `shellcheck`-clean script. Add reasonable
implicit requirements (reliable triggering, cross-platform degradation, no
overlap with an existing skill/agent, progressive disclosure) the user expects by
default. Mark anything genuinely ambiguous as an open question.

> Assume **all** requirements must be fully met. Never propose deferring or faking
> scope. If something looks infeasible, name it explicitly.

### 3. Diverge — generate options

Produce **2–4 genuinely distinct** approaches. Push past the first idea. For kit
work, the design space usually includes:

- **Where the capability lives**: a new skill vs extending an existing one; a new
  agent vs a new skill preloaded by an existing agent; orchestrator-level guidance
  vs a reusable skill.
- **Decomposition**: one `SKILL.md` vs a `SKILL.md` plus `reference/` files;
  knowledge vs a runnable script in `scripts/`.
- **Cross-platform shape**: canonical in `AGENTS.md` vs Claude-specific in
  `CLAUDE.md` vs shared `.claude/` assets.

### 4. Pressure-test

For each option, weigh it against the priority order
(correctness & faithfulness → reliable triggering & orchestration → cross-platform
integrity → reusability & updatability → clarity/ergonomics/scope) and ask:

- What could go wrong? What's fragile? (Inaccurate/outdated claims and weak
  descriptions that won't trigger are the usual danger zones.)
- What does it cost in roster/skill overlap, maintenance, and validation effort?
- Does it fully satisfy every requirement?
- Is there a simpler way to fully satisfy them (reuse an existing skill, fewer
  files)?

### 5. Converge

Recommend the framing you'd pursue and why. List the few open questions whose
answers would actually change the approach.

## Output

```markdown
## Goal
...

## Requirements (testable)
- ...

## Options
1. <name> — approach, trade-offs
2. ...

## Risks & unknowns
- ...

## Recommendation
... and why.

## Open questions for the product owner
- ...
```

Keep it tight. This is a launch pad for planning, not a report.
