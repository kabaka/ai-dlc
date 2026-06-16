---
name: documentation-style
description: How human-facing docs in AI-DLC are written — README, usage guides, contributor docs, quickstarts. Use when writing or revising documentation for human readers (not agent/skill instructions), drafting a README or install guide, or deciding what belongs in docs vs in a skill. Audience-first, progressive disclosure for readers, concrete examples, link don't duplicate. The documentation agent's playbook.
---

# Documentation Style

Docs in this repo are written **for humans** — the product owner, contributors,
and consumers installing the kit. This is distinct from skill/agent authoring,
which targets a model: there you compress for an Opus-class reader and front-load
triggers; here you orient a person who may be new to the project. This is the
`documentation` agent's playbook.

Know which you are writing. If the reader is Claude (a `SKILL.md`, an agent body,
`AGENTS.md`), use `writing-skills` / `writing-subagents` / `writing-orchestrators`
instead. This skill governs `README.md`, `docs/` guides, and contributor docs.

## Principles

1. **Audience-first.** Lead with what the reader is trying to do, not how the
   system is built internally. A consumer wants "install and use it"; a
   contributor wants "set up, run the checks, open a PR." Write to that goal.
2. **Progressive disclosure for readers.** Top of the doc: the shortest path to
   value (quickstart). Push depth — full option reference, edge cases,
   architecture — lower or into linked pages. Don't make a reader wade through
   rationale to run the first command.
3. **Concrete examples over abstraction.** Show the actual command, the actual
   file path, the actual expected output. Examples must be real and runnable —
   no invented flags or unrun commands (same accuracy bar as the rest of the kit).
4. **Accurate to current behavior.** Document what the tool does *now*. When
   platform behavior is fast-moving or uncertain, verify it (see
   `ecosystem-research`) rather than guessing; stale docs mislead.
5. **Link, don't duplicate.** Point to the canonical source instead of copying
   it. The orchestrator definition lives in `AGENTS.md`; procedures live in
   skills; decisions live in ADRs (`docs/decisions/`). Docs reference these so
   there is one place to update.

## Conventions

- American English; prose wraps at ~80 columns; Markdown lints clean against
  `.markdownlint.jsonc` (see `pre-flight-checks`).
- No marketing fluff, no emoji. Plain, direct, skimmable: headings, short
  paragraphs, tables and fenced code where they help.
- **Changelog & versioning.** User-facing changes are recorded in `CHANGELOG.md`
  in [Keep a Changelog](https://keepachangelog.com/) format under `[Unreleased]`;
  the project follows [Semantic Versioning](https://semver.org/). The version is
  team-owned and derived from commits — docs reference SemVer/Keep a Changelog,
  they don't hand-assign version numbers (see `conventional-commits`).
- Reference sibling material by name/link: the `README.md` quickstart, the
  install guide, the contributor guide, ADRs, and the relevant skills.

## Structure cues

- **README**: one-line what-it-is → quickstart (install + first use) → the
  two-layer model (kit-builder vs deliverable) at a glance → links to deeper
  docs. Keep it short; it is the front door, not the manual.
- **Usage guide**: task-oriented sections ("Install", "Update", "Add a skill"),
  each a short procedure with a real example.
- **Contributor doc**: setup → run pre-flight (`pre-flight-checks`) → author with
  the relevant SME skills → commit (`conventional-commits`) → open a PR.

## Quality bar

A doc is done when a reader in its target audience can reach their goal without
asking a follow-up the doc should have answered, every command/path is real and
current, and nothing duplicates a canonical source it could have linked instead.
