# AGENTS.md — the open cross-tool standard

The canonical, tool-agnostic instruction file for coding agents. In AI-DLC it
holds the Orchestrator definition and all shared guidance.

## Format & location

- **Location:** repository root (`AGENTS.md`).
- **Format:** plain, freeform Markdown. **No required fields or schema** — you pick
  the headings that matter (build commands, code style, testing, conventions,
  orchestration). Anything you'd put in a README aimed at an agent rather than a
  human belongs here.
- **Precedence in monorepos:** nest `AGENTS.md` files in subpackages. The **closest
  `AGENTS.md` to the edited file wins**, so each subproject can tailor guidance. An
  explicit instruction in the chat prompt overrides any file.

## Who reads it (verified mid-2026)

Read natively by Cursor, GitHub Copilot (coding agent, since Aug 2025), Kiro,
OpenAI Codex, Google Jules, Windsurf, Zed, Aider, VS Code, Factory, Devin,
JetBrains Junie, Warp, goose, opencode, Gemini CLI, and 20+ others — the list at
https://agents.md is the live source of truth.

**The notable exception is Claude Code**, which reads only `CLAUDE.md`. AI-DLC
bridges that gap (see `claude-code.md`): `CLAUDE.md` is `@AGENTS.md` plus optional
Claude-only notes, so `AGENTS.md` stays the single canonical document.

## Why it is canonical for AI-DLC

- One file satisfies the majority of the ecosystem with zero per-tool work.
- Freeform Markdown matches the repo's concise, progressive-disclosure authoring
  voice — no schema to fight.
- Tools that want more (file-scoped rules, custom agents) layer on top without
  pulling content out of `AGENTS.md`.

## Source

- https://agents.md
