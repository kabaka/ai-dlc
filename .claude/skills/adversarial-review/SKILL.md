---
name: adversarial-review
description: Red-team review methodology for attacking a plan (before authoring) or a deliverable (before merge) to surface unmet requirements, inaccurate or outdated claims, weak descriptions that won't trigger, broken cross-platform assumptions, fakes/placeholders, and missing validation. Use when adversarially reviewing a plan or authored files (the adversarial-reviewer agent's playbook).
---

# Adversarial Review

Assume there is a flaw and go find it. Your value is catching problems before they
cost real work or ship to consumers. Be ruthless about substance and honest about
severity — every finding must be real and evidenced, never a manufactured nitpick.

## Mindset

- **Disprove the claim**, don't confirm it. "This is correct/complete/will
  trigger" is the hypothesis you're trying to break.
- **Evidence over assertion.** Cite file:line, the exact plan step that's wrong,
  the official-doc fact that contradicts a claim, or the concrete prompt that
  would (or wouldn't) fire a skill. Run read-only diagnostics (frontmatter parse,
  markdown lint, schema validation, link check, `shellcheck`, grep) to back
  findings.
- **Severity discipline.** Separate blockers from nice-to-haves so the
  Orchestrator can act. Don't pad the list.

## Attack checklist

### Requirements & honesty (blocking)

- [ ] Is **every** stated requirement actually satisfied? Map each to evidence.
- [ ] Any deferral, scaffold, stub, placeholder, `TODO`, or "phase 2"? → blocker.
- [ ] Any invented frontmatter field, fabricated schema key, or example command
      that was never run? → blocker.
- [ ] Any validation/triggering eval that passes trivially instead of genuinely
      exercising the behavior it claims to check? → blocker.

### Correctness & faithfulness

- [ ] Is every frontmatter field, command, flag, file path, and schema key true to
      *current* tool behavior? Anything outdated or guessed is a defect.
- [ ] Does the content contradict `AGENTS.md`, the priority order, the roster, or a
      sibling skill? Are cross-referenced skill/agent names spelled exactly right
      and do they exist?
- [ ] Frontmatter parses as YAML; skill `name` == directory, agent `name` ==
      filename; only allowed fields present.

### Reliable triggering & orchestration

- [ ] Is the `description` third-person, front-loaded with "Use when…", and rich
      in the literal keywords a real request would contain? Would it fire on the
      intended prompts and stay quiet on adjacent ones?
- [ ] Do two skills/agents overlap so much that neither reliably wins routing?
- [ ] For an agent: least-privilege tools (no `Write`/`Edit` on a read-only
      reviewer), single responsibility, procedures pushed to a skill not the body?
- [ ] Does the orchestration guidance converge, or can it thrash/loop forever?

### Cross-platform integrity

- [ ] Does this break the single-source-of-truth model (`AGENTS.md` canonical,
      `CLAUDE.md` imports it, shared `.claude/` assets)?
- [ ] Does it assume Claude-Code-only behavior where Copilot/Kiro/Cursor/AGENTS.md
      readers need graceful degradation? Tool-specific files in the wrong place?

### Reusability, validation & security

- [ ] Missing validation: no triggering eval, no link/schema/lint/`shellcheck`
      coverage for what was added?
- [ ] Packaging/versioning gotchas (manifest schema, top-level files a plugin
      can't ship, version-bump propagation)?
- [ ] Anything that runs on a consumer machine (installer/script), touches MCP, or
      processes untrusted input without `security` review? → flag for `security`.

### Plan-specific (when reviewing a plan)

- [ ] Hidden dependencies or wrong step ordering?
- [ ] Missing deliverables/specialists; underestimated risk; no verification step
      for a load-bearing claim about fast-moving tool behavior?
- [ ] A materially simpler approach (reuse an existing skill/agent) that fully
      meets the requirements?

## Output

```markdown
## Verdict
Blocker(s) found / Only minor issues / Looks sound

## Findings
- [BLOCKER] <problem> — <where: file:line or plan step> — <why it matters> — <fix>
- [MAJOR]   ...
- [MINOR]   ...
- [NIT]     ...
```

Order findings by severity. If you genuinely find nothing blocking after a real
attempt, say so plainly — a clean review is a valid result, but only after you've
actually tried to break it.
