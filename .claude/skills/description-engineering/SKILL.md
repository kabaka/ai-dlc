---
name: description-engineering
description: How to write skill and agent descriptions that trigger and route reliably — third person, front-loaded triggers, the "[what] + Use when [scenarios] + keywords" pattern, pushiness about adjacent scenarios, and avoiding overfitting or keyword-stuffing. Use when writing or fixing a skill `description` or an agent `description`, when a skill never fires or fires on the wrong prompts, when an agent never gets delegated to, or when tuning routing/triggering reliability (shared by the skill-author, agent-author, and prompt-engineer agents).
---

# Description Engineering

The `description` is the single highest-leverage field in a skill or agent. It is
the *only* content in context before the skill/agent activates, so it is what the
model matches a request against to decide whether to fire or delegate. A perfect
body behind a vague description is dead weight — it never runs. This skill is the
cross-cutting craft of writing descriptions that trigger and route, used by the
`writing-skills`, `writing-subagents`, and `writing-orchestrators` work.

## The non-negotiables

- **Third person.** "Reviews diffs for security issues…" — never "I review…" or
  "you can use this to…". First/second person breaks the routing convention.
- **Front-load the trigger.** Put the most distinctive trigger in the **first ~100
  characters**. Listings and `/doctor` truncate; the opening must stand alone.
- **State what it does, then when.** The pattern:

  ```text
  [what it does] + Use when [concrete scenarios] + [literal keywords a request contains]
  ```

  Example: "Best practices for authoring SKILL.md files… Use when writing or
  revising a skill, a SKILL.md, deciding what belongs in reference/ vs the body…".

- **Use literal keywords.** Include the actual words a real request would use —
  filenames (`SKILL.md`, `.claude/agents/`), nouns (`frontmatter`, `redline`,
  `migration`), and the verbs (`review`, `package`, `convert`). The match is against
  the user's wording, so mirror it.

## Be a little pushy

A description should claim the **adjacent** scenarios, not just the exact one.
List the variations and near-neighbors a user might phrase, so the skill fires on
the cluster of intents it can actually help with — not only the one canonical
phrasing. "Use when reviewing a contract, **or** when you need clause-by-clause
analysis, **or** when preparing a negotiation strategy" beats a single narrow
trigger. Err toward claiming a scenario you can handle over missing it.

But push toward *real* coverage, not noise (see anti-patterns).

## Skill vs agent — same craft, different verb

- **Skill descriptions** answer *"when should this knowledge/procedure load?"* —
  scenario- and keyword-driven.
- **Agent descriptions** answer *"when should I delegate to this specialist?"* —
  the same shape, but framed as a dispatch decision. For agents you want
  auto-delegated, add an imperative push: "**Use PROACTIVELY for…**" / "**MUST BE
  USED when…**". (Remember the caveat from `writing-subagents`: auto-routing is
  unreliable, so strong descriptions *assist* explicit dispatch rather than replace
  it.)

## Don't summarize the workflow

The description states *when to fire*, not *how the work proceeds*. Recounting the
internal steps ("first it lints, then validates, then checks links") spends the
trigger budget on internals the router doesn't need and crowds out the scenarios
and keywords that actually drive matching. Keep the procedure in the body.

## Avoid overfitting and keyword-stuffing

These are the two failure modes at the edges:

- **Overfitting** — the description fires only on the exact wording you tested
  ("trigger my skill", or one specific sentence). Real users phrase things
  differently and the skill silently misses. Fix: generalize to the intent; include
  synonyms and adjacent scenarios.
- **Keyword-stuffing** — cramming unrelated terms to "catch everything". The
  skill fires on prompts it can't help with, eroding trust and crowding real
  matches. Fix: include only keywords for scenarios the skill genuinely serves.

The test that separates them: would a *human reading only the description* expect
this skill/agent to be the right pick for that prompt? If not, the keyword doesn't
belong.

## Budgets and visibility (Claude Code)

- Skill `description`: ≤1024 chars. The skill **listing** truncates at 1536 chars
  per entry; `/doctor` shows a truncated form. The first sentence must be
  self-sufficient because that is often all the model (and the user) sees.
- Every description sits in context permanently across the whole roster. A
  bloated, stuffed description is a tax on *every* session, not just the one where
  it fires. Tight and specific beats long and vague.

## Method — test, don't guess

Descriptions are probabilistic triggers; you cannot eyeball reliability. Write
evals **before** finalizing the description and iterate against them — baseline
whether the right skill/agent fires on varied realistic prompts (NOT "trigger my
skill"), then tune. The full eval-driven loop, including the triggering-vs-behavior
split and the "Claude A authors / Claude B tests" method, is the
`skill-evaluation` skill. Use it; this skill gives you the *what to write*, that
one gives you the *how to verify*.

## Worked before/after

| Bad | Why | Better |
| --- | --- | --- |
| "Helps with PDFs." | Vague; no trigger, no keywords. | "Read, fill, merge, split, and OCR PDF files. Use when the user mentions a `.pdf`, wants to extract text/tables, combine or split PDFs, or fill a form." |
| "Security expert." | "What it is", not "when to delegate". | "Reviews code for security issues before commits. MUST BE USED when reviewing diffs touching auth, input parsing, or installers." |
| "I help you write skills." | First person; vague. | "Best practices for authoring SKILL.md files… Use when writing or revising a skill, a SKILL.md, or a `.claude/skills/<name>/` directory." |
| "skill writing authoring create build make scaffold generate edit modify…" | Keyword soup; fires on noise. | Keep the verbs that map to real scenarios; drop the rest. |

## Anti-patterns (summary)

- First/second person.
- Trigger buried after a long "what it is" preamble.
- Workflow recounted in the description.
- Overfitting to test phrasings; keyword-stuffing unrelated terms.
- No literal keywords (router has nothing to match).
- Description so long the front-loaded trigger is lost to truncation.
