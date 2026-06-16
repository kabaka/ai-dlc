---
name: adr-authoring
description: Write Architecture Decision Records for AI-DLC using the MADR style. Use when documenting a significant technical or process decision — canonical-doc strategy, distribution/packaging model, cross-platform sync approach, orchestration design, schema/versioning choices. ADRs live in docs/decisions/ as numbered files. The adr-author agent's playbook.
---

# ADR Authoring (MADR)

Architecture Decision Records capture significant decisions and their rationale
so future contributors (human and agent) understand *why*, not just *what*. This
is the `adr-author` agent's playbook.

## Location & naming

ADRs live in `docs/decisions/`, sequentially numbered:
`docs/decisions/NNNN-kebab-case-title.md` (e.g.
`0001-canonical-doc-strategy.md`). Use the template at
`docs/decisions/` (the project's MADR template) and the next free number. One
decision per file.

## Template

```markdown
# NNNN — Title

## Status
Proposed | Accepted | Deprecated | Superseded by [NNNN](NNNN-title.md)

## Context
The issue and the forces at play: constraints, requirements, and the
alternatives actually considered. Tie these to the repo's priority order —
correctness/faithfulness → reliable triggering → cross-platform integrity →
reusability/updatability → clarity/ergonomics (see `AGENTS.md`).

## Decision
What was decided, and the reasoning that follows directly from the context.

## Consequences

### Positive
- ...

### Negative
- ...

### Neutral
- ...
```

## When to write one

- The canonical-document strategy (`AGENTS.md` canonical, `CLAUDE.md` import) and
  the cross-platform single-source-of-truth model.
- The distribution and packaging model (plugin vs marketplace vs installer) and
  the versioning/update strategy.
- Orchestration design: the workflow loop, dual planning, the agent roster shape.
- A schema, frontmatter convention, or manifest format the kit standardizes on.
- Any new runtime dependency, MCP integration, or major restructure.

## Quality standards

- **Context** captures the *real* constraints and the alternatives actually
  weighed — not generic boilerplate. Tie trade-offs to the priority order.
- **Decision** is justified directly from the context.
- **Consequences** honestly include the downsides and the trade-offs accepted.
- Reference related ADRs; link to research, prior art, or upstream docs when the
  decision rests on platform behavior (route uncertain claims to `researcher`).
- One decision per ADR. **Supersede** rather than rewrite history when a decision
  changes — set the old ADR's status to *Superseded by [NNNN]* and write a new one.
