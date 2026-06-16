---
name: kit-review
description: Review standards for AI-DLC's deliverables — skills, agents, orchestrator docs, manifests, installer, and docs. Use when reviewing a change before merge, evaluating an authored skill/agent/doc, or performing QA — checks requirements met, no fakes, faithfulness to current tool behavior, reliable triggering, progressive disclosure, least-privilege tools, cross-platform integrity, and resolving cross-references. The qa agent's playbook; qa can block.
---

# Kit Review

Review AI-DLC deliverables against the repo's quality bar. The deliverables here
are **Markdown and config**, not application code: `SKILL.md` files, agent
definitions, `AGENTS.md`/`CLAUDE.md`, JSON manifests, the shell installer, and
docs. Review only — critique against this checklist and hand fixes back to the
Orchestrator; do not edit. This is the `qa` agent's playbook, and `qa` can block.

## Review checklist

### Delivery rules (blocking)

- [ ] Every requirement from the original request is met — no deferrals, no
      "good enough for now"
- [ ] No fakes: no placeholder skills/agents, stub descriptions, `TODO` content,
      invented frontmatter fields, fabricated schema keys, or example commands
      that were never run
- [ ] Validation actually ran and passed (pre-flight set + any triggering evals),
      not trivially-passing checks. See `pre-flight-checks` and `kit-validation`

### Accuracy & faithfulness (blocking)

- [ ] Every frontmatter field, schema key, flag, command, and claim is true to
      **current** tool behavior — no invented fields or flags
- [ ] Where platform behavior is uncertain or fast-moving, the text says "verify"
      or cites a source rather than asserting (route to `researcher` if needed)
- [ ] Bundled scripts referenced actually exist and are described as run-vs-read

### Triggering & routing

- [ ] Skill/agent `description` is third person, front-loads the trigger in the
      first ~100 chars, and names concrete scenarios + literal keywords — it will
      plausibly fire/route on a realistic request (see `description-engineering`)
- [ ] No two skills/agents have colliding or ambiguous triggers
- [ ] For agents meant to auto-delegate, the description carries the routing cue

### Progressive disclosure & structure

- [ ] `SKILL.md` is tight (target < ~400–500 lines); depth pushed to `reference/`
      or `scripts/`, linked **one level deep**
- [ ] One recommended default approach (with an escape hatch), not a menu
- [ ] Consistent terminology throughout; second person for agent bodies, third
      person for descriptions

### Least-privilege & cross-platform

- [ ] Agents use least-privilege `tools`; read-only reviewers have **no**
      `Write`/`Edit`; authoring agents omit `tools` to inherit all
- [ ] Single responsibility per agent
- [ ] `AGENTS.md` stays canonical and unbroken; `CLAUDE.md` import intact; no
      tool-specific divergence that breaks the single-source-of-truth model
      (see `cross-platform-config`)

### Cross-references & docs

- [ ] Every backticked skill/agent name and every intra-repo link resolves
- [ ] User-facing change reflected in `CHANGELOG.md` (Keep a Changelog); docs
      updated if behavior or usage changed
- [ ] Significant decisions captured as ADRs (see `adr-authoring`)

### Security (flag to `security` if any apply)

- [ ] Change adds/edits a shell script, a dependency, or MCP config
- [ ] Skill/agent ingests untrusted content (prompt-injection surface)

## Issue severity

| Severity    | Definition                                                                                                                 | Action                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **Blocker** | Unmet requirement, fake/placeholder, inaccurate claim or invented field, security issue, a skill/agent that cannot trigger | Must fix before merge |
| **Major**   | Significant quality gap: missing validation, broken cross-reference, least-privilege violation, cross-platform regression  | Must fix before merge |
| **Minor**   | Style inconsistency, over-long `SKILL.md`, non-critical improvement                                                        | Should fix, can defer |
| **Nit**     | Cosmetic preference                                                                                                        | Optional              |

## Output

A findings list grouped by severity, each with the file path (and line where
useful), the problem, and a concrete remediation. State plainly whether the
change passes QA or is blocked, and on what.
