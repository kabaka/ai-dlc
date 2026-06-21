# Changelog

All notable changes to the AI-DLC deliverable product are documented here. The
format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Design-system lens for UI-bearing work** (ADR 0010): the new `design-system`
  skill — the **visual** layer for any unit of work that renders a visible
  interface. It is stack-neutral and produces a testable visual contract:
  - **DTCG design tokens** (W3C Design Tokens Community Group format, `$value` /
    `$type`) in three tiers (primitive / semantic / component) — the stack-neutral
    visual vocabulary.
  - A **UI-element inventory with full state matrices**
    (default / hover / active / focus / disabled / loading / selected / error) so
    no element ships unstyled or half-styled.
  - Global **empty / loading / error** state patterns applied app-wide.
  - A **ban-defaults aesthetic brief** — a committed typography / color / motion
    direction, so the UI is intentionally styled rather than left on framework
    defaults. The human arbiter judges whether it looks good; the skill never
    self-certifies aesthetics.
- **`ui_bearing` Unit-of-Work contract field**: units of work now carry an
  agent-proposed `ui_bearing` flag, **arbiter-confirmed at the existing Gate 1**
  (Inception → Construction sign-off). It marks which units render a human-facing
  surface and therefore route through the `ux-design` and `design-system` lenses.
  No new gate — the four arbiter gates are unchanged.
- **`ux-design` and `design-system` preloaded** on `requirements-analyst` and
  `architect`, so a UI-bearing unit carries the interaction and visual-design
  lenses through Inception and Construction's Gate-2 design fork without an extra
  hop.
- **Off-token linter** (`product/scripts/off-token-lint.mjs`): a deterministic,
  CI-runnable design-QA tool that statically scans source files for hardcoded
  design values that should be tokens (raw hex / `rgb()` / `hsl()` colors, raw
  `px` / `rem` / `em` spacing, hardcoded `font-family` names). Pure static
  analysis — no RCE surface — and stack-pluggable via an optional repo-local
  `.ai-dlc/stack-binding.json`. Its exit-code contract treats `SKIPPED` as
  evidence-incomplete, never as a pass.
- Architecture Decision Record 0010 (the design-system lens, the `ui_bearing`
  contract field, and the off-token linter as the operationalization of the
  existing Gate-2 design fork).
- **`spec-conformance` skill** (ADR 0011): the layer-2 whole-unit completeness
  convention — an enumerated acceptance checklist over the **native**
  `acceptance_criteria` / `non_goals` / `dependencies` unit-of-work primitives,
  covering **requirement coverage**, **end-to-end reachability** (every capability
  has a named user-reachable path — no orphans), **companion freshness** (docs,
  tests, and `CHANGELOG` updated in the same effort), a **converge / anti-deferral
  diff** (promised vs. delivered, so dropped scope is surfaced), and **"show, don't
  assert" evidence**. It mirrors — does not fork — the layer-1 `definition-of-done`.
- **Vertical-slice and walking-skeleton discipline** woven into
  `requirements-elaboration` (units are sliced as thin end-to-end increments) and
  `implementation-planning` (a walking skeleton wires the seam first), so end-to-end
  reachability holds **by construction** and orphan features are largely never built.
- **Run-the-app "show, don't assert" evidence** woven into `testing-strategy`: a
  unit is demonstrated by exercising its user-reachable path, not merely claimed
  done.

### Changed

- **`code-review` now applies the `spec-conformance` convention** and folds the
  result into its **existing** enumerated verdict (`APPROVE` / `REQUEST_CHANGES` /
  `ESCALATE_SECURITY` / `BLOCK`) at the **existing Gate 3** (merge) — unmet or
  silently deferred items become `REQUEST_CHANGES`. **No new gate, verdict,
  ceremony, or agent** is added.
- **`spec-conformance` preloaded on the `code-reviewer` agent** (via `skills:`
  frontmatter), so the completeness convention is always loaded at the pre-merge
  gate.
- Architecture Decision Record 0011 (the layer-2 spec-completeness convention,
  applied by `code-reviewer` at the existing verdict/gate; deterministic visual-QA
  and patch-coverage tooling plus stack auto-binding are an explicitly later slice).
