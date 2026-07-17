# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Internal kit-builder orchestration layer: canonical `AGENTS.md` orchestrator
  with `CLAUDE.md` import, the specialist subagent roster (`.claude/agents/`), and
  the skill library (`.claude/skills/`) used to build the AI-DLC kit.
- Repository scaffolding: license, contribution guide, markdown/frontmatter
  linting, and a CI pre-flight workflow.
- CI workflow to publish the installer to npm as the public scoped package
  `@kabaka/ai-dlc` on a release, plus `actionlint` over the GitHub Actions
  workflows in pre-flight/CI.
- Seed Architecture Decision Records for the canonical-doc strategy and the
  distribution model.
- **Deliverable AI-DLC product (layer 2)** under `product/`, installable into a
  consumer's repo:
  - The consumer **Orchestrator** (`product/AGENTS.md` canonical + `CLAUDE.md`
    import) and a roster of **12 specialist lifecycle agents** spanning Inception,
    Construction, and Operations.
  - **14 on-demand skills** — methodology, workflow, and per-phase playbooks
    (`aidlc-methodology`, `aidlc-workflow`, `requirements-elaboration`,
    `research-method`, `citation-verification`, `architecture-design`,
    `implementation-planning`, `testing-strategy`, `code-review`,
    `rca-investigation`, `delivery-operations`, `security-review`, `writing-docs`,
    `conventional-commits`).
  - The **five baked-in mechanisms** (ADR-0005): the arbiter blocking gate
    enforced by a real installed hook, complexity-triage tiers, phase-handoff
    output contracts, the hardened citation-verification gate, and the
    don't-edit-the-oracle independent-verifier split.
  - **Installer + plugin/marketplace packaging**: `npx @kabaka/ai-dlc init` / `update`
    (primary) lands the cross-platform top-level files, agents, skills, artifact
    templates, and the arbiter-gate hook with idempotent, version-stamped,
    drift-aware updates and consumer-file preservation; a Claude Code plugin and
    marketplace entry provide the secondary, Claude-native discovery channel.
  - **Cross-platform steering** for GitHub Copilot, Cursor, Kiro, and other
    `AGENTS.md` readers, with an honest per-tool degradation contract
    (`product/docs/cross-platform.md`).
  - **Methodology artifact templates** under `product/templates/artifacts/`
    (decision-record, unit-of-work, phase-handoff, citation-ledger).
  - Consumer-facing documentation: `product/README.md`, a quickstart, and a usage
    guide.
- Architecture Decision Records 0003–0006: deliverable repository layout and
  packaging, the consumer agent roster and security/documentation hybrid, the five
  baked-in mechanisms and two-tier eval strategy, and installer idempotent merge
  and consumer-file preservation.
- Pre-flight validators extended to cover the layer-2 product surface, plus the
  two-tier eval suite (a deterministic CI-runnable eval-record linter and manual
  model-in-the-loop triggering/behavior evals).
- **Two consumer lifecycle agents**: `observability` (Operations-phase SRE for
  measurement — what to measure, SLIs/SLOs/error budgets, OpenTelemetry
  instrumentation, instrumented from Construction) and `kit-extender` (on-demand
  authoring capability the arbiter invokes to assess the repo and propose
  repo-tailored skills/agents to the kit's standards behind a propose-for-approval
  gate). The consumer roster grows to 14 agents.
- **New consumer skills**: `observability-practice` (instrument-as-you-build,
  SLO/error-budget, OpenTelemetry); `extending-the-kit` (the `kit-extender`
  playbook — default-to-skills, staging, validation, propose-for-approval);
  `dependency-compliance` (license compatibility and SBOM/SPDX checks as a
  recommended, non-blocking item in the deploy checklist and supply-chain lens —
  not legal advice); and `ux-design` (interaction, IA, usability, and WCAG
  accessibility, bounded to UI-bearing work). All framed as recommended guidance,
  never new arbiter gates — the four gates are unchanged.
- **`testing-strategy` extended** with methodology selection — TDD by default
  (red-green-refactor) with ATDD/spec-by-example, exploratory spikes, and
  property-based testing chosen by the unit's requirement clarity, risk, and
  output shape.
- **Consumer-side kit-artifact validator** (`validate-kit-artifact.mjs`, shipped
  with the `extending-the-kit` skill): a deterministic frontmatter / tool-hygiene /
  `skills:` cross-reference / eval-record check the generator runs on every draft.
  It verifies an artifact is well-formed; triggering behavior is verified manually
  in a fresh session (no eval-runner harness ships).
- Architecture Decision Records 0007 (consumer kit self-extension via a
  propose-for-approval generator) and 0008 (the `observability` agent and
  practice/domain guidance skills).
- **Spec-completeness mechanism (layer 1)** that makes "every requirement met"
  falsifiable:
  - New `definition-of-done` skill — the canonical home for an enumerated,
    arbiter-confirmed acceptance checklist covering requirement coverage,
    end-to-end reachability (every capability has a named user-reachable path),
    and companion docs/tests/changelog freshness, scaled to the change.
  - Layer-1 eval coverage: `scripts/validate-evals.mjs` now also scans a new
    top-level `evals/` directory, seeded with `evals/definition-of-done.jsonl`.
  - Architecture Decision Record 0009 (definition-of-done spec completeness).

### Changed

- The `orchestration-workflow` gains two beats — enumerate and arbiter-confirm
  the acceptance checklist up front, and a spec-conformance gate before deliver —
  and `delegation-patterns` adds a no-unilateral-descope plus seam-ownership rule
  (see ADR 0009).
- `kit-review` and the `qa` agent now run a completeness scan against the
  acceptance checklist, with `definition-of-done` preloaded on `qa`.
- Established `definition-of-done` as the canonical home for the no-deferral rule
  and cross-linked the existing role-specific reinforcements to it (the
  declarations are kept in place by design, not removed).

### Fixed

- Corrected the eval-record schema documentation in `kit-validation` to match the
  records the validator actually checks.
- Corrected the stale eval-record schema documentation in `skill-evaluation` to
  match the validator schema (companion to the `kit-validation` fix above).
- Pre-flight markdownlint now skips the release-please-owned
  `product/installer/CHANGELOG.md`, whose machine-generated format (asterisk
  bullets plus a double blank line after each version header, re-emitted every
  release) cannot be kept lint-clean by hand. This unblocks the `pre-flight`
  workflow, which failed on the `0.2.0` release commit. Hand-maintained
  CHANGELOGs remain linted.
