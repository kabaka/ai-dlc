---
name: delegation-patterns
description: How the Orchestrator writes effective subagent task briefs, dispatches agents in parallel, passes context between agents, and protects its own context window. Use when delegating authoring/review/research work to specialist subagents or coordinating multi-agent steps.
---

# Delegation Patterns

The Orchestrator gets work done through subagents. Each subagent starts with a
**fresh, isolated context window** — it does not see the conversation, the files
you've read, or other agents' outputs. Whatever it needs, you must put in the
brief. Nested subagents now exist, but treat the **Orchestrator as the
integrator**: you own synthesis and the hand-off of context between agents.

## Anatomy of a good task brief

Give every dispatched agent:

1. **Goal** — the specific outcome you want from *this* agent.
2. **Context** — the relevant background, decisions already made, and the
   priority that matters here (e.g. "correctness & faithfulness first: every
   frontmatter field and command must be true to current tool behavior").
3. **Inputs** — exact file paths, the plan slice, and any prior agent's output it
   depends on (paste the relevant part — it can't see it otherwise).
4. **Expected output** — be explicit: a `SKILL.md`? a subagent definition? a plan?
   a review with severities? an RCA report? a set of triggering evals? Name the
   format and where to write it.
5. **Constraints & done criteria** — the delivery rules (all requirements, no
   fakes, real validation) and how the agent should know it's finished.
6. **Checklist slice** — the relevant slice of the acceptance checklist (see
   `definition-of-done`) that *this* agent owns, so it knows exactly which items
   it is on the hook for.
7. **Seam / integration point** — the named user-reachable path or companion this
   agent is responsible for wiring (the `/command`, the caller, the doc/eval/
   changelog entry), so its output is reachable and its companions stay fresh —
   not an orphan feature or a stale doc.

Vague briefs produce vague work. Be concrete.

**No unilateral descope.** A subagent may **not** drop, defer, or narrow a
checklist item on its own. If it believes an item is infeasible or contradictory,
it **escalates to the Orchestrator** (who takes it to the arbiter) — it never
silently shrinks the brief. This is the fix for the context-loss that produces
orphan features and stale companions. See `definition-of-done`.

## Parallel vs sequential

- **Dispatch independent work in parallel** in a single turn: the two `planner`s,
  the two `adversarial-reviewer`s, and unrelated specialists (e.g.
  `cross-platform-integrator` and `aidlc-methodologist` early in a feature).
  Issue the calls together.
- **Sequence dependent work**: brainstorm → plan → author → validate → review.
  Wait for the upstream result, then pass the relevant part downstream. A
  description engineered by `prompt-engineer` feeds the triggering evals;
  authored files feed `qa` and `security`.

## Passing context between agents

You are the integration point. When agent B needs agent A's result:

- Summarize or quote A's relevant output into B's brief — don't assume B can see
  it.
- Translate between roles: turn a `brainstorm` problem statement into a concrete
  planning brief; turn a `researcher` finding into accuracy constraints for an
  author; turn an `rca-analyst` report into a fix brief for the owning specialist;
  turn reviewer findings into specific fix instructions with file paths.

## Protect your context window

- Prefer delegation over reading large files yourself. Use read-only specialists
  (`researcher`, `qa`, `adversarial-reviewer`) for search and analysis.
- Ask agents to **return concise summaries plus file paths/line numbers**, not
  raw dumps of files, logs, or full validation output.
- Push verbose operations (running the full pre-flight gate, link checks, the
  triggering eval harness, large greps) into subagents so the noise stays in
  their context, not yours.

## Choosing the right agent

- Match the task to the specialist's domain (see the `AGENTS.md` roster). For
  authoring, route by artifact: SKILL.md → `skill-author`; subagent definition →
  `agent-author`; `AGENTS.md`/`CLAUDE.md` → `orchestration-designer`; description
  or trigger tuning → `prompt-engineer`; methodology content →
  `aidlc-methodologist`; cross-platform config → `cross-platform-integrator`;
  packaging/installer/marketplace → `distribution-engineer`; validation tooling →
  `tooling-engineer`.
- Use the **read-only** agents (`brainstorm`, `planner`, `adversarial-reviewer`,
  `qa`, `security`, `rca-analyst`, `researcher`) for thinking, planning, review,
  and research; use the authoring SMEs to actually write files.
- When a change spans domains, dispatch several and integrate. Err toward
  involving more specialists than fewer on non-trivial work.

## Verifying returned work

When an agent reports back, check that it actually addressed the brief and met the
delivery rules before moving on. Confirm frontmatter parses, claims are accurate,
descriptions are trigger-ready, cross-platform assumptions hold, and validation
genuinely ran. If it deferred a checklist item (see `definition-of-done`), faked
something, invented a frontmatter field or schema key, or missed a requirement,
send it back with specifics — don't paper over it yourself. **`qa` can block; no
deliverable is final until it approves.**
