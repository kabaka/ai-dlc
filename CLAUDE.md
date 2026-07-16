@AGENTS.md

# Claude Code specifics

The orchestrator definition above (imported from `AGENTS.md`) is canonical and
shared across tools. The notes below apply only to Claude Code.

- **You are the Orchestrator** — the main Claude Code session. Delegate via the
  **Agent tool** to the subagents in `.claude/agents/`. Skills in
  `.claude/skills/` load on demand; some subagents preload a skill via their
  `skills:` frontmatter.
- **Dispatch independent work in parallel** by issuing multiple Agent calls in a
  single turn (two `planner`s, two `adversarial-reviewer`s, unrelated specialists).
- **Read-only specialists** (`brainstorm`, `planner`, `adversarial-reviewer`,
  `qa`, `security`, `rca-analyst`, `researcher`) are restricted to non-mutating
  tools so they cannot change files. Authoring specialists may write.
- **Protect context**: prefer the `Explore` agent and read-only specialists over
  reading large files yourself; ask subagents for summaries plus file paths.
- **Editing this kit live**: SKILL.md text edits are picked up mid-session; new
  top-level skill directories and edited agent files need a restart (or `/agents`
  for agent edits). Re-invoke a large skill after auto-compaction if it stops
  influencing behavior.
- **Do not put project context in a plugin-root `CLAUDE.md`** when we ship the
  product — Claude Code does not load it. Plugins contribute via skills/agents/
  hooks (see the `plugin-packaging` skill).

## rtk dogfood (opt-in, Claude Code web only)

This repo can use `rtk` (output compression) in its own Claude Code **web**
sessions. It is **opt-in and inert by default** — nothing happens unless a
contributor turns it on. Claude Code **web only**; local sessions are unaffected.

- **Enable it**: set `AIDLC_ENABLE_RTK=1` in your Claude Code web environment
  config, and point that environment's **setup script** at
  `scripts/setup/rtk-dogfood-setup.sh` (which installs `rtk` only when the flag
  is set, then exits cleanly otherwise).
- **How it stays inert**: the committed `PreToolUse` hook in `.claude/settings.json`
  runs the canonical wrapper `product/templates/hooks/rtk-wrap.sh`, which self-gates
  on `AIDLC_ENABLE_RTK` and fails open — so for any contributor who has not set the
  flag, the hook does nothing.
- Rationale and the full decision are in
  [ADR 0013](docs/decisions/0013-opt-in-rtk-output-compression.md).
