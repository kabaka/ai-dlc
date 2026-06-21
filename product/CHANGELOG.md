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
- **Slice-3 visual-QA suite** (ADR 0012): a seven-tool deterministic visual-QA
  suite plus the fail-closed gate for app/browser execution.
  - **Three exec-free deterministic checks** under `product/scripts/visual-qa/`:
    `contrast-check.mjs` (WCAG 2.x contrast on the binding's token pairs),
    `patch-coverage.mjs` (changed-line coverage from a caller-provided coverage
    artifact and diff — runs no tests, shells no `git`), and `changelog-check.mjs`
    (an `Unreleased` section reflects a caller-provided commit list — shells no
    `git`). Each follows the `0/1/2/3` contract where `SKIPPED` is
    evidence-incomplete, never a pass, and executes no process, shell, or browser.
  - **Four browser/app audit tools** under `product/scripts/visual-qa/`, each
    routed through the fail-closed harness and validated: `axe-audit.mjs` (WCAG 2
    A/AA via `@axe-core/playwright`), `responsive-check.mjs` (breakpoint overflow /
    off-viewport breaks), `pixel-diff.mjs` (screenshots diffed against repo-local
    committed baselines via `pixelmatch` / `pngjs`), and `reachability-runner.mjs`
    (every declared route renders). All follow the same `0/1/2/3` contract where
    `SKIPPED` is default-deny and never a pass, and resolve their runtime modules
    from the consumer's own `node_modules`.
  - **Fail-closed app-exec harness** (`lib/app-exec-harness.mjs`) and the
    **kit-owned loopback driver** (`visual-qa/browser-runner.mjs`,
    `visual-qa/browser-lib.mjs`, `visual-qa/static-server.mjs`): the shipped,
    tested gate through which the four browser tools route. The harness never
    launches on import; it defends with a shell-free argv `spawn`, an executable
    allowlist, validated args, a minimal child env, a wall-clock timeout with
    process-group tree-kill, a refusal to run as root, and **default-deny**
    confirmation bound to a SHA-256 over the full execution descriptor and
    re-hashed before spawn — so a changed or freshly pulled binding forces
    re-confirmation and never auto-runs. The execution model is **build → serve
    static → audit loopback**: the harness runs the consumer's build/export
    command to emit static files into a repo-local `static_dir`, the kit serves
    that on `127.0.0.1` at an ephemeral kit-chosen port, and the tools audit only
    that loopback origin. Validated locally by a 28-check Chromium smoke test
    (`test/browser-tools.smoke.mjs`, Tier-2 / local — **CI does not run Chromium**).
  - **Shared `lib/`** (`binding.mjs`, `contract.mjs`): the audited containment and
    exit-contract primitives every design-QA tool shares.
  - **Validation-only pinned toolchain** (`product/scripts/package.json`,
    `private: true`, `@ai-dlc/visual-qa-validation`): pins the toolchain this
    repo's own tests run against. It is **not shipped to consumers** — the
    installer fences only the validation-only scaffolding
    (`package.json`/`package-lock.json`/`node_modules/`/`test/`) out of the
    payload; the tool `.mjs` files ship to `.ai-dlc/scripts/`. Consumers install
    their own pinned toolchain and the tools resolve modules from the consumer
    repo's `node_modules`.
  - **`stack-binding` skill** and the **`architect` as stack-binding producer**:
    for a `ui_bearing` unit the `architect` proposes `.ai-dlc/stack-binding.json`
    inside the Gate-2 architecture handoff, arbiter-confirmed inside the existing
    Gate-2 Decision Record — no new gate, agent, or record-type.

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
- **`off-token-lint.mjs` refactored onto the shared `lib/`** (`binding.mjs`,
  `contract.mjs`) — behavior is **byte-identical** to the prior inline
  implementation.
- **New pinned dev/validation dependencies** for the visual-QA toolchain —
  `@axe-core/playwright` 4.11.3, `axe-core` 4.12.1, `pixelmatch` 7.2.0,
  `playwright` 1.56.1, `playwright-core` 1.56.1, `pngjs` 7.0.0 — are
  **validation-only** and **not shipped to consumers**.
- Architecture Decision Record 0012 (the Slice-3 visual-QA tooling and the
  `architect`-produced stack auto-binding confirmed at the existing Gate 2).

### Fixed

- **The installer now delivers the design-QA tools to consumer repos** at
  `.ai-dlc/scripts/` — the off-token linter (`off-token-lint.mjs`), the
  seven-tool visual-QA suite (`visual-qa/`), and the shared `lib/`. This closes
  the prior **reachability gap**: `off-token-lint.mjs` had been unreachable for
  consumers since Slice 1 because the installer never shipped it. The installer
  fences out **only** the validation-only scaffolding
  (`package.json`/`package-lock.json`/`node_modules/`/`test/`); consumers install
  their own pinned Playwright/axe toolchain and the tools resolve those modules
  from the consumer repo's `node_modules`.
