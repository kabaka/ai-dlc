# Subagent anti-pattern catalog

Symptom → why it hurts → fix. Verified against
https://code.claude.com/docs/en/sub-agents and field guidance (mid-2026).

## Contents

- [Tool/security anti-patterns](#toolsecurity-anti-patterns)
- [Routing anti-patterns](#routing-anti-patterns)
- [Body anti-patterns](#body-anti-patterns)
- [Architecture anti-patterns](#architecture-anti-patterns)
- [Stale-knowledge anti-patterns](#stale-knowledge-anti-patterns)

## Tool/security anti-patterns

### Omitting `tools` on a specialized agent

- Symptom: a focused agent (e.g. a reviewer) has no `tools` line.
- Why it hurts: omission inherits **all** tools including every MCP tool. The agent
  is silently over-granted and can take actions far outside its role.
- Fix: list a least-privilege allowlist. For "inherit minus a few", use
  `disallowedTools`.

### Editable reviewer

- Symptom: a read-only reviewer's `tools` includes `Write` or `Edit`.
- Why it hurts: the agent will fix things itself instead of reporting, bypassing
  the review/integration loop and the Orchestrator's judgement.
- Fix: `Read, Grep, Glob` plus `Bash` only for read-only diagnostics. State "review
  only; never edits" in the body.

### Casual `bypassPermissions`

- Symptom: `permissionMode: bypassPermissions` on a routine agent.
- Why it hurts: removes the safety prompt for destructive actions in a real repo.
- Fix: only in throwaway/isolated envs; prefer `isolation: worktree` for parallel
  mutators.

## Routing anti-patterns

### "What it is" description

- Symptom: `description: A security expert.`
- Why it hurts: gives the router nothing to match a request against; the agent
  rarely gets delegated to.
- Fix: describe *when* — "Reviews code for security issues before commits. MUST BE
  USED when reviewing diffs that touch auth, input parsing, or installers." See the
  `description-engineering` skill.

### Designing around silent auto-delegation

- Symptom: a workflow that assumes the right agent auto-fires from prose alone.
- Why it hurts: auto-routing is unreliable; hand-offs silently don't happen.
- Fix: make important dispatches explicit (`@agent-name` / `--agent` / the
  Orchestrator dispatching by name). Use strong descriptions to *assist*, not to
  *guarantee*, auto-delegation.

## Body anti-patterns

### Long procedural body

- Symptom: a 200-line step-by-step procedure inlined in the agent body.
- Why it hurts: bloats the system prompt; duplicates content that belongs in a
  reusable skill.
- Fix: move the procedure to a skill and preload it via `skills:`. Keep the body a
  high-level job description.

### Assuming inherited context

- Symptom: the body references "the file we discussed" or "the plan above".
- Why it hurts: the agent's window is fresh — it sees none of the parent
  conversation. The reference resolves to nothing.
- Fix: restate always-true context in the body; pass task-specific context in the
  dispatch (see `delegation-patterns`).

## Architecture anti-patterns

### Sprawling, overlapping roster

- Symptom: three agents whose descriptions all plausibly match "review this".
- Why it hurts: ambiguous routing; the wrong one fires; maintenance burden.
- Fix: single responsibility per agent, non-overlapping scopes. Consolidate or
  sharpen descriptions.

### Multi-job agent

- Symptom: one agent that plans, implements, and reviews.
- Why it hurts: no clean review boundary; can't be safely tool-restricted; routes
  ambiguously.
- Fix: split into single-responsibility agents.

## Stale-knowledge anti-patterns

### "Subagents can't spawn subagents"

- Symptom: an agent body or doc stating subagents cannot nest.
- Why it hurts: **stale** since v2.1.172 (June 2026) — nesting is allowed to depth
  5. Repeating it misleads downstream authors.
- Fix: drop the claim. If you need to constrain nesting, do it as a design choice
  (keep the Orchestrator the integrator), not as a false capability statement.

### Listing unavailable tools

- Symptom: `tools` includes `AskUserQuestion` or `ExitPlanMode`.
- Why it hurts: those are never available to subagents (plan-mode tools only under
  `permissionMode: plan`); the listing is a no-op or a design error.
- Fix: remove them; return questions to the parent instead of asking the user.
