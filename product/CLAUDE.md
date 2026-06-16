@AGENTS.md

# Claude Code specifics

The orchestrator definition above (imported from `AGENTS.md`) is canonical and
shared across tools. The notes below apply only to Claude Code.

- **You are the Orchestrator** — the main Claude Code session. Delegate via the
  **Agent tool** to the lifecycle agents in `.claude/agents/`. Skills in
  `.claude/skills/` load on demand; some agents preload a skill via their
  `skills:` frontmatter. The user is the product owner and **sole arbiter**.
- **Dispatch independent work in parallel** by issuing multiple Agent calls in a
  single turn — fan out `researcher` agents during Inception, run dual `planner`s
  and parallel reviewers during Construction's Solo Mob.
- **The arbiter gate is a real hook.** The installer wires a Claude Code hook that
  checks for a recorded **Decision Record** before phase-transition actions; absent
  a record, the gate is closed and work must not proceed. This is enforcement, not
  a prompt the model can skip. Where a hook cannot reach a transition, the product
  uses honestly-labeled "strongly instructed" prose — never prose alone for the
  gate itself.
- **Read-only specialists** (`planner`, `code-reviewer`, `debugger`, `researcher`,
  `security`) are restricted to non-mutating tools so they cannot change files.
  Authoring specialists may write.
- **Protect context**: prefer the `Explore` agent and read-only specialists over
  reading large files yourself; ask subagents for summaries plus file paths.
- **Editing this kit live**: SKILL.md text edits are picked up mid-session; new
  top-level skill directories and edited agent files need a restart (or `/agents`
  for agent edits). Re-invoke a large skill after auto-compaction if it stops
  influencing behavior.
- **The installer manages this file.** `AGENTS.md` and `CLAUDE.md` are co-owned:
  `npx ai-dlc update` never edits a pre-existing copy in place — it writes a `.new`
  sidecar with merge instructions, or updates only the `<!-- ai-dlc:begin -->` /
  `<!-- ai-dlc:end -->` marker region once you opt in. Your hand-written project
  context is safe to add here.
