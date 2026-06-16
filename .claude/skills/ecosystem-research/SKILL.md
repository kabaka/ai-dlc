---
name: ecosystem-research
description: How to research the fast-moving Claude Code / agent ecosystem and keep AI-DLC's guidance current. Use when verifying a platform claim, schema, flag, or feature before standardizing on it, when a documented behavior seems stale, or before authoring guidance that depends on current tool behavior. Combines official docs with unofficial sources and cross-verifies. The researcher agent's playbook.
---

# Ecosystem Research

The Claude Code / agent ecosystem moves fast — schemas, flags, frontmatter
fields, and platform behaviors change on the scale of weeks. Guidance that was
true last quarter can be wrong now, and a wrong claim in a skill is a correctness
defect (priority #1 in `AGENTS.md`). This skill is how you check, and how you keep
the kit current. It is the `researcher` agent's playbook.

Investigate and report — return findings, sources, and a confidence level to the
Orchestrator; do not author the guidance yourself.

## Sources

Use both, and weight them by what you need:

**Official (primary — prefer for schemas, flags, and exact behavior):**

- `code.claude.com/docs` — Claude Code docs (skills, agents, plugins, settings).
- `platform.claude.com/docs` — platform/agent-and-tools docs and best practices.
- `anthropic.com/engineering` — engineering posts on agents, skills, evals.
- The relevant official repos (e.g. `github.com/anthropics/skills`).

**Unofficial (signal on what's changing, real-world usage, gotchas):**

- Engineering blogs and Substacks; Reddit `r/ClaudeAI`; Hacker News; X/Twitter
  threads from practitioners; `awesome-*` repos curating tools and patterns.

Official docs are authoritative for *what the schema/flag is*. Unofficial sources
are valuable for *what changed, what's flaky, and how people actually use it* —
but treat them as leads to verify, not facts.

## Method

1. **Frame the claim.** State precisely what you need to confirm — a field name,
   a flag, whether a behavior exists, when it changed.
2. **Check the primary source first** for anything schema- or flag-shaped.
3. **Cross-verify** with at least one independent source, ideally one official +
   one unofficial. Platform behavior shifts: e.g. nested-subagent support and
   `AGENTS.md` adoption both moved through 2025–2026 — never rely on a single
   stale page.
4. **Date everything.** Note when a source was published/updated and when you
   checked it. A confident-sounding blog post can predate a breaking change.
5. **Cite sources** in the finding (URL + the date you verified).
6. **Flag uncertainty explicitly.** If sources conflict or you cannot confirm,
   say "verify" or "unconfirmed as of <date>" rather than asserting. It is better
   to surface a gap than to standardize on a guess.

## When to trigger a refresh

- **Before standardizing** a schema, frontmatter field, manifest key, or flag in
  a skill/agent/doc — confirm it is real and current first.
- **When a claim seems stale** — a documented behavior contradicts what you
  observe, or a source is months old in a fast-moving area.
- **Before an ADR** that rests on platform behavior (see `adr-authoring`).
- **When a triggering or install failure** points at a platform change (the
  `rca-investigation` skill may hand off a "verify current behavior" question).

## Output

A research finding: the **claim**, the **answer** (confirmed / contradicted /
unconfirmed), the **sources** (URL + verification date), and a **confidence
level**. Where the answer changes existing kit guidance, name the file(s) and the
specialist who should update them. Feed this to the Orchestrator; it routes the
edit.
