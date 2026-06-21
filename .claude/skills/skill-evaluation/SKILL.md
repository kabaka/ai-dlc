---
name: skill-evaluation
description: Eval-driven authoring for skills and agents — write evals before the docs, baseline behavior without the skill, write minimal instructions to close the gap, and iterate against varied realistic prompts. Use when building or revising a skill or agent and you need to verify it triggers and behaves, when a skill fires on the wrong prompts or not at all, when designing triggering vs behavior evals, or when running the "Claude A authors / Claude B tests" loop (the prompt-engineer agent's playbook).
---

# Skill Evaluation

Skills and agents are **probabilistic**: whether they fire and what they produce
varies. You cannot tell by reading whether a description triggers reliably or a
body produces the right output — you have to test. This skill is the eval-driven
loop for authoring them, in the spirit of the `skill-creator` skill
(https://github.com/anthropics/skills). Use it together with
`description-engineering` (what to write) and `writing-skills` /
`writing-subagents` (how to structure).

## The core discipline: evals before docs

Write at least **three evals before you write the skill body.** This forces you to
define success concretely and prevents writing to a vague target. The loop:

```text
- [ ] 1. Write ≥3 evals: realistic prompts + expected behavior
- [ ] 2. Baseline WITHOUT the skill — see what Claude does unaided
- [ ] 3. Write the MINIMAL instructions that close the gap
- [ ] 4. Run the evals; compare to baseline and expected
- [ ] 5. Iterate: fix the description (triggering) or body (behavior); re-run
```

The baseline matters: if Claude already does the right thing unaided, the skill is
unnecessary or should be smaller. Write **minimal** instructions — only enough to
close the observed gap. Over-instruction bloats context for no gain.

## Two things to test — keep them separate

A skill can fail in two independent ways. Test each:

### (a) Triggering — does the right skill/agent fire?

Does it activate on varied **realistic** prompts — the way a real user would phrase
the request — and *not* fire on adjacent prompts it shouldn't handle?

- **Never test with "trigger my skill" or the skill's own name.** That proves
  nothing; real users don't phrase requests that way. Use the natural language a
  user would actually type.
- Test a spread: the canonical phrasing, paraphrases, adjacent-but-in-scope
  scenarios (should fire), and adjacent-but-out-of-scope scenarios (should NOT
  fire — this catches keyword-stuffing and overfitting).
- A triggering failure is almost always a `description` problem — fix it there (see
  `description-engineering`), not in the body.

### (b) Behavior — does it produce the right output?

Once fired, does it do the right thing — correct format, complete, faithful? A
behavior failure is a *body* problem: the procedure is unclear, missing a step, or
gives the wrong degrees of freedom (see `writing-skills`).

Diagnosing which layer failed tells you which file to edit. Don't rewrite the body
to fix a triggering miss, or the description to fix a wrong output.

## The "Claude A authors / Claude B tests" loop

Author and grader should be **separate sessions**. Claude A writes the skill;
Claude B — a fresh session with no memory of the authoring — runs each eval prompt
and reports what happened. This removes the author's bias (A "knows" what the skill
means and unconsciously triggers it). B's fresh-context run is the honest signal.
In this repo that maps onto the Orchestrator dispatching a separate agent to run
the evals while the authoring agent stays out of the grading.

## Eval record shape

Capture each eval as a structured record so the suite is repeatable. The
**canonical record schema** — the `{id, target, prompt, expectation, kind}`
fields, the `kind` enum (`positive` / `near-miss-negative` / `behavior`), and the
`scripts/validate-evals.mjs` linter that enforces it — lives in the
`kit-validation` skill (its "Eval record shape" section). Author records to that
schema; don't duplicate it here, so there is one source of truth.

Each record names the realistic `prompt` to run and the `expectation` the run is
graded against. A run grades each record on both axes (triggered? behaved?) and
you iterate until the suite passes across the varied prompts.

## Probabilistic by design — when you need a guarantee

Evals raise the *probability* a skill fires and behaves; they do not make it
certain. **For behavior that MUST run every time** (a mandatory format check, a
required pre-commit step), do not rely on a skill triggering — use a **hook**,
which the harness executes deterministically regardless of model judgement. Reach
for a skill when probabilistic activation is acceptable; reach for a hook when it
is not. (Configuring hooks is the `update-config` / settings-json domain.)

## The harness

The mechanics of running the suite in this repo — fixtures, the runner, how
triggering and behavior are scored, how evals fit the validation gate — live in
the `kit-validation` skill. This skill is the *method*; `kit-validation` is the
*harness*. Triggering evals are a first-class correctness gate here (see
`AGENTS.md` quality gates), not an optional extra.

## Anti-patterns

- Writing the skill first and bolting evals on after (you write to a vague target).
- Testing with "trigger my skill" / the skill name instead of realistic prompts.
- Only testing positive cases — never checking it *stays quiet* on out-of-scope
  prompts (misses keyword-stuffing/overfitting).
- Author grades their own skill in the same session (bias).
- Conflating a triggering failure with a behavior failure and editing the wrong
  file.
- Using a probabilistic skill where the requirement is "must always run" — that
  needs a hook.
- Evals that trivially pass (asserting the obvious) instead of genuinely exercising
  triggering and behavior — a fake test under the repo's delivery rules.
