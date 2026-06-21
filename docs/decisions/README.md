# Architecture Decision Records

This directory holds the **Architecture Decision Records (ADRs)** for AI-DLC. An
ADR captures a single significant architectural or process decision, the context
that forced it, the options considered, and the consequences of the choice. We use
the [MADR 4.0](https://adr.github.io/madr/) format (see
[`adr-template.md`](./adr-template.md)) and the `adr-authoring` skill.

## Index

| ADR                                                                 | Title                                                  | Status   |
| ------------------------------------------------------------------- | ------------------------------------------------------ | -------- |
| [0001](./0001-canonical-agents-md-with-claude-md-import.md)         | Canonical AGENTS.md with CLAUDE.md `@AGENTS.md` import | Accepted |
| [0002](./0002-installer-primary-plugin-secondary-distribution.md)   | Installer-primary, plugin-secondary distribution       | Accepted |
| [0003](./0003-deliverable-repository-layout-and-packaging.md)       | Deliverable repository layout and packaging            | Accepted |
| [0004](./0004-consumer-agent-roster-and-security-documentation-hybrid.md) | Consumer agent roster and the security/documentation hybrid | Accepted (amended by 0007) |
| [0005](./0005-baked-in-mechanisms-and-two-tier-eval-strategy.md)    | The five baked-in mechanisms and the two-tier eval strategy | Accepted |
| [0006](./0006-installer-idempotent-merge-and-consumer-file-preservation.md) | Installer idempotent merge and consumer-file preservation | Accepted |
| [0007](./0007-consumer-kit-self-extension-via-propose-for-approval-generator.md) | Consumer kit self-extension via a propose-for-approval generator | Accepted |
| [0008](./0008-observability-agent-and-practice-domain-guidance-skills.md) | Observability agent and practice/domain guidance skills | Accepted |
| [0009](./0009-definition-of-done-spec-completeness.md) | Operationalizing spec-completeness with a Definition of Done | Accepted |
| [0010](./0010-layer2-design-system-and-ui-bearing-completeness.md) | Skill-first design-system lens and a `ui_bearing` unit-of-work contract | Accepted |
| [0011](./0011-layer2-spec-completeness-convention.md) | The layer-2 spec-completeness convention (`spec-conformance`) over native unit-of-work primitives | Accepted |

## Statuses

An ADR moves through these statuses:

- **Proposed** — drafted and under review; not yet adopted.
- **Accepted** — adopted; the decision is in force.
- **Rejected** — considered and explicitly declined.
- **Deprecated** — no longer recommended, but not yet replaced.
- **Superseded by ADR-XXXX** — replaced by a later decision (link it).

## How to add an ADR

Ask the Orchestrator to draft the ADR; it delegates to the `adr-author` agent. The
shape:

1. Copy [`adr-template.md`](./adr-template.md) to a new file.
2. Name it `NNNN-short-kebab-title.md`, where `NNNN` is the next zero-padded
   sequential number (the next free number is **0012**). Numbers are never reused,
   even if an ADR is later rejected or superseded.
3. Fill in every section of the template. Keep the title line consistent:
   `# NNNN — Title`.
4. Set the status and open it for review through the standard delivery flow
   (feature branch → PR → review). See [CONTRIBUTING.md](../../CONTRIBUTING.md).
5. Add a row to the **Index** table above.
6. When a decision changes, do not edit history destructively: add a new ADR and
   mark the old one **Superseded by ADR-XXXX**.

## Numbering convention

- Four-digit, zero-padded, strictly increasing: `0001`, `0002`, …
- One decision per ADR. If a decision splits, supersede rather than rewrite.
