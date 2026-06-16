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
  - **Installer + plugin/marketplace packaging**: `npx ai-dlc init` / `update`
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
