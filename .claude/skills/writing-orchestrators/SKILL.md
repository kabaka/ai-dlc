---
name: writing-orchestrators
description: How to author an AGENTS.md/CLAUDE.md orchestrator — the document that configures the main session as a coordinator of a specialist agent team. Use when writing or revising AGENTS.md or CLAUDE.md, setting up the orchestrator for a kit, defining core principles, delivery rules, the workflow loop, rules of engagement, the agent roster and skill index, or wiring the cross-platform AGENTS.md/CLAUDE.md bridge (the orchestration-designer agent's playbook).
---

# Writing Orchestrators

An orchestrator document configures the **main session** — the single point of
contact for the user — to coordinate a team of specialist subagents instead of
doing the work itself. In this kit that document is `AGENTS.md` (canonical) plus a
thin `CLAUDE.md` that imports it. This skill is about authoring *that* document.

Keep one distinction sharp: the orchestrator doc holds **standing facts and
rules** — who the team is, what the priorities are, what's non-negotiable.
**Procedures belong in skills** (the workflow loop lives in
`orchestration-workflow`; delegation mechanics in `delegation-patterns`). The doc
*points at* the procedure; it does not inline it. This keeps the always-loaded
context lean.

## The required sections

Author these, in this order. Each earns its place.

### 1. Project framing

Two or three sentences: what this repo is, what operating model it uses, and any
layering the reader must not conflate (e.g. the kit-builder layer vs the
deliverable product). This is the orientation every agent inherits.

### 2. "You are the Orchestrator"

State the role plainly: the main session talks to the user, breaks work down,
delegates to subagents, adversarially reviews results, reports back — **and does
not implement itself.** Name the user's role (product owner / reviewer, not
implementer). This framing is load-bearing; it stops the main session from
grabbing the keyboard.

### 3. Core principles (priority-ordered)

A numbered list, **highest priority first**, used to resolve conflicts when goals
compete. The ordering is the point — when correctness and ergonomics collide, the
reader needs to know which wins. Keep it short (4–6 principles); each should be a
named tie-breaker, not a platitude. Example shape: correctness → reliable
triggering → cross-platform integrity → reusability → ergonomics.

### 4. Non-negotiable delivery rules

The rules that bind **every agent on every task** — they govern *how* work is
done, independent of the task. Typical members: meet every requirement fully; no
fakes/stubs/TODOs; real validation; faithful to current behavior; decompose rather
than cut scope; report honestly. These are absolute, not weighted — distinct from
the priority-ordered principles above.

### 5. The canonical workflow loop

A short summary of the loop the main session runs for every request, with a
pointer to the full playbook skill. Do **not** inline the whole procedure — name
the steps (plan → dual-plan → adversarial review → validate → author+validate →
review → validate → deliver) and say "load and follow `orchestration-workflow`".

### 6. Rules of engagement

The standing coordination rules: delegate everything substantive; protect the
context window (delegate over reading; have agents return summaries + paths); all
coordination flows through the main session; run independent work in parallel;
resolve disagreements via the priority order; which gate can block; dogfood.

### 7. Agent roster + skill index

A scannable table of the specialist subagents (name · one-line role), grouped by
function, plus an index of the skills grouped by theme. This is how the main
session knows who to delegate to and which playbook to load. Point to
`.claude/agents/` and `.claude/skills/` for the definitions.

### 8. Standards and quality gates

Repo standards (canonical source, authoring conventions, commits, versioning) and
the quality gates that must pass before anything is finalized (the blocking
reviewer, pre-flight checks, triggering evals, security review for anything that
runs on a consumer's machine). Reference the skills that own each
(`pre-flight-checks`, `kit-validation`, `security-review`, `conventional-commits`).

## The cross-platform bridge

This is the part authors most often get wrong. Different tools read different
files:

| Tool | Reads |
| --- | --- |
| Claude Code | **`CLAUDE.md` only** |
| Cursor, GitHub Copilot, Kiro | **`AGENTS.md`** |

Make **`AGENTS.md` the single canonical source**, and make `CLAUDE.md` a thin
file that imports it with an `@AGENTS.md` import, adding only Claude-Code-specific
notes:

```markdown
<!-- CLAUDE.md -->
@AGENTS.md

## Claude-Code-specific notes
- <only the handful of things unique to Claude Code go here>
```

Because Claude Code reads only `CLAUDE.md`, the `@AGENTS.md` import is what pulls
the canonical content in. Edit guidance in `AGENTS.md`, never in a duplicated copy
inside `CLAUDE.md` — duplication drifts and the platforms diverge. The mapping,
tool-by-tool sync strategy, and what to do when formats don't overlap live in the
`cross-platform-config` skill; reference it from the standards section.

## Style

- Concise and imperative. Assume an Opus-class reader; encode the
  project-specific, not the generic.
- The doc is **always in context** for the main session — every line is a
  permanent token cost. Cut anything that isn't a standing fact or rule.
- Cross-reference sibling skills/agents by backticked name.
- No fakes: every named agent, skill, command, and field must be real.

## Anti-patterns

- **Inlining procedures.** A full workflow or delegation procedure pasted into the
  doc instead of a pointer to its skill — bloats permanent context and drifts from
  the skill. Keep procedures in skills.
- **Unordered principles.** A flat bullet list of "values" with no priority — gives
  the reader no tie-breaker when goals conflict. Order them.
- **Duplicating `AGENTS.md` into `CLAUDE.md`.** Two copies that drift. Use the
  `@AGENTS.md` import.
- **Putting guidance only in `CLAUDE.md`.** Cursor/Copilot/Kiro never see it — they
  read `AGENTS.md`. Canonical content goes in `AGENTS.md`.
- **A "do the work yourself" orchestrator.** A doc that doesn't firmly establish
  delegation, so the main session implements instead of coordinating.
- **Stale roster.** Listing agents/skills that don't exist, or omitting ones that
  do — the main session can't delegate to a phantom and won't delegate to an
  unlisted specialist.
- **Mixing absolutes with weighted goals.** Conflating the non-negotiable delivery
  rules (absolute) with the priority-ordered principles (tie-breakers). Keep the
  two lists separate.

## Validate

Confirm every agent/skill named in the roster exists; confirm the `@AGENTS.md`
import resolves and `CLAUDE.md` is thin; confirm the priority list is ordered and
the delivery rules are absolute. Run the `pre-flight-checks` gate (link integrity
catches phantom references).
