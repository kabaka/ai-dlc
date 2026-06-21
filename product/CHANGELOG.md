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
