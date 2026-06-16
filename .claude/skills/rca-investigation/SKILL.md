---
name: rca-investigation
description: Structured root-cause analysis for failures in the AI-DLC kit. Use when investigating why something broke before fixing it — a skill that won't trigger, a broken cross-reference, a CI or validation failure, a manifest that won't install, or a regression after an edit. Reproduce, isolate, diagnose, recommend a fix and its owner. Investigate only — does not apply the fix. The rca-analyst agent's playbook.
---

# RCA Investigation

Find the *root cause*, not the symptom. Investigate only — diagnose precisely and
recommend the fix and its owning specialist; do not apply it. This is the
`rca-analyst` agent's playbook.

## Method

```text
- [ ] 1. Reproduce (capture exact conditions: command, file, prompt, env)
- [ ] 2. Isolate (narrow to the responsible file / field / interaction)
- [ ] 3. Diagnose (the true cause — why it happens, not just what failed)
- [ ] 4. Recommend (the fix approach and the owning agent)
- [ ] 5. Prevent (the check or eval that would have caught it)
```

### 1. Reproduce

Confirm the failure and the minimal conditions that trigger it. Capture the exact
input: the failing command and its output, the file and frontmatter involved, or —
for a triggering failure — the **literal prompt(s)** that did or did not fire the
skill/agent. A reproducible case is the most valuable evidence; a triggering bug
is only "real" once you have a prompt that demonstrably fails.

### 2. Isolate

Bisect the surface using read-only diagnostics — `git log`/`git diff` to find the
introducing change, `grep`/`glob` to locate the reference, re-running a single
pre-flight check, parsing one frontmatter block. Narrow to the specific file,
frontmatter field, link, manifest key, or description that owns the failure.

### 3. Diagnose

State the underlying cause precisely, distinct from the symptom. Examples:
"the skill never fires" is a symptom; "the description leads with *what* and never
states a *Use when* trigger, so it doesn't match the request" is a cause.
"install fails" is a symptom; "`marketplace.json` references a path that the
package layout doesn't ship" is a cause.

### 4. Recommend

Propose the fix approach and name the specialist who should implement it
(`skill-author`, `agent-author`, `orchestration-designer`, `prompt-engineer`,
`tooling-engineer`, `devops`, `distribution-engineer`, `documentation`, …).

### 5. Prevent

Recommend the specific check or eval that would catch a recurrence — a frontmatter
rule or link check in `pre-flight-checks`, or a triggering/behavior eval in
`kit-validation`. A triggering regression usually warrants a new negative-or-
positive eval record.

## Common AI-DLC failure classes

- **Skill/agent won't trigger** — description leads with *what* not *when*, lacks
  the keywords a request carries, or collides with a sibling's trigger; the
  request routes elsewhere or nowhere.
- **Broken cross-reference / link** — a backticked skill/agent name or relative
  link points at a renamed or missing target; a `reference/` path drifted.
- **CI / validation failure** — markdown lint, frontmatter (name≠dir, missing
  field, read-only agent with `Write`), schema, or `shellcheck` failure; or a
  local-vs-CI mismatch where the invocation differs.
- **Manifest won't install** — `plugin.json`/`marketplace.json` schema invalid,
  unpinned/wrong source, or a referenced path the package doesn't ship.
- **Regression after an edit** — a previously-working trigger, link, or check
  broke; `git diff` against the last good state isolates it.

## Output

An RCA report: **Issue · Reproduction · Root Cause · Contributing Factors ·
Recommended Fix (and owner) · Prevention**. Include the exact failing
command/output or the triggering prompt(s) as evidence.
