---
name: orchestration-workflow
description: The canonical multi-agent workflow the Orchestrator (main session) follows for every request in this kit-builder repo — plan, dual-plan, adversarial plan review, validate, author + validate, review, validate, deliver. Use at the start of and throughout handling any user request to coordinate the specialist subagent team.
---

# Orchestration Workflow

This is the loop the Orchestrator (the main Claude Code session) runs for every
request. The Orchestrator **coordinates and judges — it does not author.** All
authoring, design, validation, review, and non-trivial research is delegated to
the specialist subagents in `.claude/agents/`. See `delegation-patterns` for how
to write good task briefs and dispatch in parallel.

Treat yourself as the integrator. Even though nested subagents now exist, every
dispatch and every hand-off of context between agents flows through you — you own
synthesis, judging feedback, and the final report.

## The loop

Copy this checklist into your working notes for non-trivial requests and track it:

```text
Request progress:
- [ ] 1. Plan (brainstorm if complex)
- [ ] 2. Dual planning (two planners)        ← skip only if trivially simple
- [ ] 3. Adversarial plan review (two reviewers)
- [ ] 4. Validate feedback → revise → re-review, or proceed
- [ ] 5. Author + validate (specialists)
- [ ] 6. Review the deliverables (qa + adversarial + security/...)
- [ ] 7. Validate feedback → fix → re-review, or proceed
- [ ] 8. Deliver & report (push/PR/merge only if asked)
```

### Step 1 — Plan

Understand the request fully. Restate the goal and the explicit requirements to
yourself. Do brief read-only orientation only if you genuinely need it (prefer a
read-only specialist over reading large files yourself).

- **If the request is complex, ambiguous, or multi-step**, dispatch the
  **`brainstorm`** agent to refine it into a sharp problem statement with options
  and risks before planning.
- If a requirement is genuinely unclear or contradictory, ask the user now —
  don't guess and don't silently narrow scope.

### Step 2 — Dual planning

Dispatch **two `planner` agents in parallel** with the same brief. Independent
plans surface more of the design space and expose assumptions. Give each the
goal, the requirements, the brainstorm brief (if any), and relevant file paths
(e.g. the target `SKILL.md`/agent files, `AGENTS.md`, sibling skills).

- **Skip this step only for trivially simple requests** (e.g. a one-line copy fix,
  a typo, a tiny obvious wording change). When in doubt, don't skip.

### Step 3 — Adversarial plan review

Dispatch **two `adversarial-reviewer` agents in parallel** to attack the plans —
looking for unmet requirements, inaccurate or outdated claims, descriptions that
won't trigger, broken cross-platform assumptions, missing validation, missing
components, and wrong sequencing. They critique; they don't fix. See
`adversarial-review`.

### Step 4 — Validate feedback, then iterate or proceed

**You are the judge.** For each finding, decide whether it is actionable and
correct — validate it against the deliverables and the priority order
(correctness & faithfulness → reliable triggering & orchestration → cross-platform
integrity → reusability & updatability → clarity/ergonomics/scope). Don't
rubber-stamp, and don't thrash on noise.

- If there is actionable, correct feedback: synthesize the two plans into one
  improved plan (folding in valid critiques) and **return to step 3**.
- Otherwise, lock the plan and continue. Record the key decisions and why.

### Step 5 — Author + validate

Assign the work to the relevant specialists, often **in parallel** where pieces
are independent. Bundle the full validation set into this step — authoring
without validation is incomplete:

- Authoring SMEs per the plan: `skill-author` (SKILL.md), `agent-author`
  (subagent definitions), `orchestration-designer` (`AGENTS.md`/`CLAUDE.md`),
  `prompt-engineer` (descriptions + triggering eval loops).
- Product & domain specialists where relevant: `aidlc-methodologist`,
  `cross-platform-integrator`, `distribution-engineer`.
- `tooling-engineer`/`devops` for installer + validation scripts, CI, and the
  skill/agent eval harness.
- **Validation analog (the "tests" of this repo)** ships in the same effort:
  frontmatter validation, markdown lint, manifest schema validation, link
  integrity, `shellcheck`, and skill/agent **triggering evals**. See the
  `kit-validation` and `pre-flight-checks` skills. Validation must genuinely
  exercise behavior — a triggering eval that always passes is a fake.
- Pull in `adr-author` for significant decisions and `documentation` for
  README/usage/contributor docs as the change warrants.

Hand each agent the plan slice it owns, the file paths, decisions already made,
and the outputs of any agent it depends on.

### Step 6 — Review the deliverables

Dispatch **two or more reviewers in parallel**:

- **`qa`** — always (it can block). Enforces standards via `kit-review` and
  `pre-flight-checks`.
- **`adversarial-reviewer`** — always (red-team the deliverables and the diff).
- **`security`** — whenever the change touches an installer or shell script, the
  plugin/marketplace supply chain, MCP configuration, or any untrusted input.
- `researcher` — when a correctness claim about fast-moving tool behavior needs
  to be re-verified against current docs.
- Others (`cross-platform-integrator`, `aidlc-methodologist`) when relevant to
  the change.

### Step 7 — Validate feedback, then iterate or proceed

Judge the findings as in step 4. If there is actionable, correct feedback, route
specific fixes back to the authoring specialist and **return to step 5**, then
re-review. Otherwise continue. **`qa` must approve before you proceed.**

### Step 8 — Deliver & report

- Verify the delivery rules hold: every requirement met, no fakes, frontmatter
  parses and conforms, links resolve, manifests validate, `shellcheck` clean,
  triggering evals genuinely pass, pre-flight green (have `devops`/`qa` confirm).
  Report honestly if not.
- Commit with Conventional Commits (`conventional-commits` skill) on a feature
  branch.
- **Default delivery is PR-based:** push the branch, open a PR, let CI run the
  checks, and merge to `main` once green and the team's review gates have passed.
  `main` stays releasable. Versioning is the team's job (Semantic Versioning,
  automated — the product owner never hand-edits versions).
- Push/PR/merge **only when the user has authorized it.** Never fabricate green
  checks.
- Report back to the user: what changed, how it was verified, and any decisions.

## Judgment notes

- **Scale the process to the request.** A typo fix may go straight from step 1 to
  a commit. A new skill or agent uses the whole loop. The dual/adversarial
  structure exists to catch expensive mistakes early — use it whenever the change
  is more than trivial.
- **Loop, but converge.** Each iteration must address concrete findings. If
  reviewers keep raising only nits, you're done.
- **Protect your context window.** Keep raw output in the subagents; have them
  return summaries and file paths. Don't read large files yourself when an agent
  can.
- **Dogfood.** When we author a skill or agent, we use our own authoring skills to
  do it. The kit is built by the methodology it teaches.
- **Never let scope quietly shrink.** If meeting a requirement is hard, add
  specialists and iterate — don't accept a deferral, scaffold, or fake from any
  agent.
