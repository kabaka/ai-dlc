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
   sequential number (the next free number is **0003**). Numbers are never reused,
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
