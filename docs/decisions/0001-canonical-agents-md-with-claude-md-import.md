# 0001 — Canonical AGENTS.md with CLAUDE.md `@AGENTS.md` import

## Status

Accepted

- Date: 2026-06-16
- Deciders: Product owner (decision authority); Orchestrator +
  `orchestration-designer`, `cross-platform-integrator`

## Context and Problem Statement

AI-DLC is a Claude-Code-first kit that must also serve Cursor, GitHub Copilot, and
Kiro. The orchestrator definition — the operating instructions that configure the
main session and every contributor's mental model — must live in exactly one place,
yet be readable by every supported tool. The constraint that forces the decision is
a discovery-file split: **Claude Code reads only `CLAUDE.md`**, while Cursor, GitHub
Copilot, and Kiro read the [`AGENTS.md`](https://agents.md) standard. We need one
canonical document that all of these tools pick up, without maintaining duplicate
copies that drift.

## Decision Drivers

- **Single source of truth.** One canonical orchestrator doc; no hand-maintained
  duplicate to drift out of sync.
- **Cross-platform reach.** Cursor, Copilot, and Kiro must read the canonical
  content natively, and Claude Code must read it too.
- **Room for Claude-only notes.** Claude Code has specifics (the Agent tool, skill
  preloading, live-edit behavior) that do not belong in the shared doc.
- **Windows / CI safety.** The mechanism must be robust on Windows checkouts and in
  CI — no fragile filesystem tricks.

## Considered Options

- **(a)** `AGENTS.md` canonical; `CLAUDE.md` imports it via `@AGENTS.md` and adds
  Claude-only notes below the import.
- **(b)** `CLAUDE.md` primary; a maintained `AGENTS.md` mirror generated or copied
  from it for the other tools.
- **(c)** Symlink `CLAUDE.md` → `AGENTS.md`.

## Decision Outcome

Chosen option: **(a) `AGENTS.md` canonical with a `CLAUDE.md` `@AGENTS.md`
import**, because it is the only option that gives a single canonical document read
by every supported tool while still leaving a clean place for Claude-only notes, and
without a Windows/CI-fragile mechanism. The full orchestrator definition lives in
`AGENTS.md`; `CLAUDE.md` is two parts — `@AGENTS.md` on the first line, then a short
"Claude Code specifics" section.

### Consequences

- Good, because there is **one canonical doc** (`AGENTS.md`), read directly by
  Cursor/Copilot/Kiro and, through the import, by Claude Code — no mirror to drift.
- Good, because **Claude-only notes** have a natural home below the import in
  `CLAUDE.md` without polluting the cross-platform content.
- Bad, because it **relies on Claude Code's `@import` support**; if that mechanism
  changed, the import line would need to be revisited.
- Neutral, because **contributors must edit `AGENTS.md`, not `CLAUDE.md`**, for
  orchestrator guidance — a rule that must be taught (see
  [CONTRIBUTING.md](../../CONTRIBUTING.md)) and enforced in review.

## Pros and Cons of the Options

### (a) AGENTS.md canonical + CLAUDE.md `@AGENTS.md` import

- Good, because one canonical document is read by all four tools; no mirror to
  maintain or drift.
- Good, because Claude-specific notes sit cleanly below the import.
- Good, because it is a plain-text import — no symlink, robust on Windows and in CI.
- Bad, because it depends on Claude Code honoring `@import`.

### (b) CLAUDE.md primary + maintained AGENTS.md mirror

- Good, because Claude Code reads its primary file directly with no indirection.
- Bad, because the `AGENTS.md` mirror is a second copy that drifts unless a
  generation/sync step is built and policed — exactly the duplication we want to
  avoid.

### (c) Symlink CLAUDE.md → AGENTS.md

- Good, because both names resolve to one byte-identical file.
- Bad, because symlinks are fragile on Windows checkouts and across some CI/zip
  distribution paths, and a symlink leaves no place for Claude-only notes — the two
  files would be forced to be identical.

## More Information

- [`AGENTS.md`](../../AGENTS.md) — the canonical orchestrator definition.
- [`CLAUDE.md`](../../CLAUDE.md) — the `@AGENTS.md` import plus Claude-only notes.
- [CONTRIBUTING.md](../../CONTRIBUTING.md) — "AGENTS.md is canonical" contributor rule.
- Skills: `cross-platform-config` (tool/discovery-file mapping and sync strategy),
  `writing-orchestrators` (how the orchestrator doc is authored).
- The AGENTS.md standard: <https://agents.md>.
- **Revisit when:** Claude Code changes or drops `@import` support, or a supported
  tool changes which discovery file it reads.
