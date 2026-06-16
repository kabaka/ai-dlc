---
name: kit-validation
description: What "real tests" mean for AI-DLC — the test-strategy analog for a Markdown/config kit. Use when planning how to validate a skill/agent/manifest/installer, building or running the eval harness, or deciding whether a change is genuinely verified. Covers two tiers: static validation (lint/frontmatter/schema/link/shellcheck) and triggering-and-behavior evals for skills and agents.
---

# Kit Validation

"Tests" for this repo are not unit tests over application code — they are checks
that the kit's guidance is correct and that skills/agents actually fire and behave.
Think of it as a test pyramid with two tiers: a broad base of **static
validation** and a focused layer of **triggering & behavior evals**. A change is
not done until both tiers that apply to it pass — authoring without validation is
incomplete.

## Tier 1 — Static validation (the broad base)

The deterministic, fast checks. These are exactly the `pre-flight-checks` set;
run them on every change:

- **Markdown lint** against `.markdownlint.jsonc`.
- **Frontmatter validation** — YAML parses; `name`/`description` present;
  skill `name` == directory, agent `name` == filename; read-only agents declare
  no `Write`/`Edit`.
- **JSON manifest schema validation** — plugin/marketplace manifests conform and
  referenced paths exist (when present).
- **Link integrity** — intra-repo links and skill/agent cross-references resolve.
- **shellcheck** — any shell script is clean and dry-run-safe.

These catch the mechanical defects that would otherwise break invocation or CI.
They do **not** tell you whether a skill fires on the right request — that is
Tier 2.

## Tier 2 — Triggering & behavior evals (the focused layer)

A skill or agent whose value depends on activating at the right moment must be
proven to do so. Treat triggering as a correctness property and verify it the way
`skill-evaluation` prescribes:

1. **Write the evals before the docs.** Author ≥ 3 evals per skill/agent — at
   minimum one positive (should fire), one near-miss negative (a plausible
   request that should *not* fire it), and one behavior eval (once fired, does it
   produce correct guidance/output). Vary phrasing and keywords across realistic
   prompts.
2. **Baseline first.** Run the evals against the current state to establish a
   pass rate before changing the description or body. Without a baseline you
   cannot tell whether an edit helped.
3. **Separate author and tester.** Use the "Claude A authors / Claude B tests"
   split so the evaluator does not see the authoring rationale — this is why the
   `prompt-engineer` runs eval loops independently of the authoring SME.
4. **Iterate on the description.** Triggering is driven by the `description`
   (see `description-engineering`); adjust it, re-run, compare to baseline.
5. **Skills are probabilistic.** Triggering is a likelihood, not a guarantee. For
   behavior that *must* run every time, do not rely on a skill firing — enforce
   it with a hook (or other deterministic mechanism) instead of a probabilistic
   trigger.

### Eval record shape

Each eval is a small record the harness can execute and score:

```json
{
  "skills": ["kit-review"],
  "query": "can you check this PR before I merge it?",
  "files": ["path/to/changed/skill/SKILL.md"],
  "expected_behavior": "kit-review fires; applies the severity rubric; flags the missing CHANGELOG entry as Major"
}
```

`skills` lists the skill(s)/agent(s) the eval targets; `query` is the realistic
prompt; `files` is any context to seed; `expected_behavior` is the pass criterion
the evaluator judges against.

## Running the harness

Tier-1 static validation exists today: run `bash scripts/preflight.sh` (markdown
lint, frontmatter validation, link integrity, `shellcheck`). See `pre-flight-checks`.

The Tier-2 eval harness does **not** exist yet — it is deferred to the tooling
phase and owned by the `tooling-engineer`. The intended shape: a `scripts/`
runner that loads a skill's eval set, scores pass/fail per record, and reports the
rate against baseline. Until it is built, run triggering/behavior evals manually
with the `skill-evaluation` method (an authoring session plus a fresh tester
session). Do not document a concrete harness command until the script exists.

## What "done" requires

- The applicable Tier 1 checks pass (always).
- For any skill/agent whose worth depends on triggering, its Tier 2 evals exist,
  ran, and meet or beat baseline.
- Must-run behavior is enforced deterministically (hook), not left to a
  probabilistic trigger.

Report results honestly with pass rates and the harness output. See
`pre-flight-checks` for Tier 1 mechanics and `skill-evaluation` for the eval
methodology in depth.
