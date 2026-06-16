---
name: writing-subagents
description: Best practices for authoring Claude Code subagent definitions — frontmatter fields, tool least-privilege, model tiering, single-responsibility bodies, and routing/dispatch reliability. Use when writing or revising a subagent, a `.claude/agents/<name>.md` file, choosing an agent's `tools` allowlist or `model`, deciding what goes in the body vs a preloaded skill, or fixing an agent that over-grants tools or never gets delegated to (the agent-author agent's playbook).
---

# Writing Subagents

A subagent is a Markdown file with YAML frontmatter under `.claude/agents/`. The
body becomes the agent's **system prompt**. Claude Code runs it in a **fresh,
isolated context window**: the subagent sees only its system prompt, the
delegation message you pass it, `CLAUDE.md`, and git status — *not* the parent
conversation or files the parent read. Whatever it needs, restate in the body or
the dispatch.

Two jobs as author: make it route reliably (the `description` — see the
`description-engineering` skill) and give it exactly the tools and instructions
for one responsibility, no more.

Sources, verified mid-2026 — cite inline where useful:

- https://code.claude.com/docs/en/sub-agents
- https://claude.com/blog/subagents-in-claude-code
- https://www.tembo.io/blog/claude-code-subagents
- https://claudefa.st/blog/guide/agents/agent-patterns

## Frontmatter

```yaml
---
name: code-reviewer            # identity comes from THIS field, not the filename
description: <routing signal — see below>
tools: Read, Grep, Glob, Bash  # OMIT to inherit ALL tools (incl. MCP) — see below
model: inherit                 # default; sonnet/opus/haiku/fable/full-id
---
```

- **`name`** (required) is the agent's identity and the `@name` handle. The
  filename is not the identity, but keep `name` == filename to avoid confusion (the
  repo accuracy bar requires it).
- **`description`** (required) is the routing/dispatch signal. Describe *when* to
  delegate, not what the agent is. Details below.
- **`tools`** (optional but consequential). **Omitting it inherits ALL tools,
  including every MCP tool** — this is the key default to understand. A specialized
  agent with no `tools` line is silently over-granted. List an allowlist for
  least privilege.
- **`model`** defaults to `inherit` (same model as the parent). Set a tier when the
  job warrants it (below).

Full field-by-field reference — `disallowedTools`, `permissionMode`, `maxTurns`,
`skills`, `mcpServers`, `hooks`, `memory`, `background`, `effort`,
`isolation`, `color` — is in `reference/frontmatter.md`. Read it before using any
field beyond the four above.

## Routing — the description does the work

Auto-delegation is keyed off the description. Write it as a *when to delegate*
signal:

- "Reviews code for security issues before commits" routes far better than
  "security expert".
- Add an imperative push for agents that should auto-fire: "**Use PROACTIVELY**
  for…" / "**MUST BE USED when**…".

**Community caveat (don't architect around it):** auto-routing is unreliable. The
dependable triggers are explicit — `@agent-name` in a prompt, or `--agent` on the
CLI. Write strong descriptions to *help* auto-delegation, but design your workflow
so the important hand-offs are explicit (in this repo, the Orchestrator dispatches
by name — see `orchestration-workflow`). Full routing craft is in the
`description-engineering` skill.

## Body — job-description style

The body is a system prompt. Keep it high-level and short; push multi-step
procedures into a `skills:` entry (which preloads the full skill content at
startup) rather than inlining them. The canonical reviewer body is ~80 words.

Structure:

```markdown
# <Title>

<1–2 sentence identity: who this agent is and its single responsibility.>

## Identity
- Scope; what it does and explicitly does NOT do ("reviews only; never edits").

## <Domain section(s)>
- What to focus on, standards it enforces, the order to work in
  ("When invoked, do X, then Y, then Z").

## Output format
- The exact shape of what it returns.

## Collaboration
- How its output feeds other agents; that it returns summaries + file paths.
```

Principles:

- **Single responsibility.** One agent, one job. A reviewer reviews; an author
  authors. Sprawling agents route ambiguously and overlap.
- **Restate needed context.** The agent has no memory of the conversation. If it
  needs a constraint, an interface, or a prior decision, put it in the body (if
  always-true) or the dispatch (if task-specific).
- **High-level body, procedure in a skill.** A long step-by-step body is a smell —
  move it to a skill and reference it via `skills:`. The body says *what role*; the
  skill says *how*.

## Tools — least privilege

Grant the minimum. The default (omit `tools` → inherit everything including MCP) is
generous; narrow it for specialized agents.

- **Read-only reviewers** get `Read, Grep, Glob` — and `Bash` only for read-only
  diagnostics like `git diff`. **Never** give a reviewer `Write` or `Edit`. A
  reviewer that can edit will edit instead of reporting.
- For an "inherit minus a few" shape, use **`disallowedTools`** (denylist) rather
  than re-listing the whole allowlist.
- `bypassPermissions` / `permissionMode: bypassPermissions` only in throwaway,
  isolated environments — never as a default convenience.
- For parallel **mutating** agents, set `isolation: worktree` so they don't stomp
  each other's working tree.

Some tools are **never available to subagents**: `AskUserQuestion`,
`EnterPlanMode` / `ExitPlanMode` (unless `permissionMode: plan`), and
`ScheduleWakeup`. Don't list them; don't design an agent that needs to ask the user
mid-run — return a question to the parent instead.

## Model tiering

Tiers (mid-2026): **Fable 5**, **Opus 4.8**, **Sonnet 4.6**, **Haiku 4.5**. Default
is `inherit`. Pick deliberately:

| Tier | Use for |
| --- | --- |
| **Haiku** | High-volume search / extraction / mechanical fan-out. (The built-in Explore agent runs on Haiku.) |
| **Sonnet** | Default for code review, refactor, test authoring. |
| **Opus** | Subtle reasoning — security analysis, architecture, tricky correctness. |
| **Fable** | Longest-horizon autonomous work. |

**Downshift mechanical fan-out workers** to Haiku — running twenty extraction
agents on Opus wastes money and time for no quality gain. Upshift only where
reasoning depth pays off.

## Context isolation

- Each subagent gets a fresh window; its result returns to the parent. Subagents
  are best used as **context-collectors**: they do heavy reading/searching in their
  own window and **summarize aggressively** back to the parent. Returning raw dumps
  defeats the purpose.
- **Nesting is allowed to depth 5** (since v2.1.172, June 2026). The old "subagents
  can't spawn subagents" rule is **stale** — do not repeat it. But nesting is for
  *context management*, not parallelism; in this repo the Orchestrator stays the
  integrator (see `orchestration-workflow`, `delegation-patterns`).

## Precedence and plugin caveats

When the same agent name is defined in multiple places, resolution order is:
**managed > `--agents` flag > project `.claude/agents/` > user `~/.claude/agents/`
> plugin agents.** Note: **plugin-provided subagents IGNORE `hooks`, `mcpServers`,
and `permissionMode`** — don't rely on those fields in an agent you ship in a
plugin. See the `plugin-packaging` skill.

## Anti-patterns

Full catalog with fixes in `reference/anti-patterns.md`. Headlines:

- Omitting `tools` on a specialized agent (silently over-grants all tools + MCP).
- Giving a read-only reviewer `Write`/`Edit`.
- Vague "what it is" descriptions instead of "when to delegate".
- Designing around silent auto-delegation instead of explicit dispatch.
- Sprawling, overlapping rosters; long procedural bodies that belong in a skill.
- Assuming inherited context the agent cannot see.
- Repeating the stale "subagents can't nest" rule.

## Validate before shipping

Frontmatter must parse; `name` must equal the filename. Test that the agent routes
on varied realistic prompts and produces the right output — write evals first and
iterate (the `skill-evaluation` skill). Run the `pre-flight-checks` gate.
