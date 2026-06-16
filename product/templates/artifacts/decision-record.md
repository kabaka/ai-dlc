<!-- ai-dlc:link-check-ignore-file -->

# Decision Record — <short title>

The artifact the **human arbiter** produces at a phase-transition gate. A gate is
**open only when** a Decision Record exists for that transition with
`chosen_option` set to an approval. Absence of a record = closed gate = AI must not
proceed. The installed arbiter-gate hook checks for this record; it never makes the
decision for you.

Copy this file to your repo (the installer lands it under
`.ai-dlc/templates/artifacts/`), fill every field, and store the completed record
where your project keeps decisions (e.g. `docs/decisions/` or `.ai-dlc/records/`).

| Field          | Value |
| -------------- | ----- |
| `decision_id`  | <stable identifier, e.g. DR-0001> |
| `transition`   | <one of: inception-to-construction \| design-fork \| construction-to-merge \| to-operations> |
| `unit_of_work` | <id(s) of the unit(s) this decision covers> |
| `chosen_option`| <what you decided — e.g. "approve plan A", "request changes". A gate opens only on an **approve** decision.> |
| `rationale`    | <why — the business/technical reasoning you own as arbiter> |
| `approver`     | <the human arbiter (one human, the solo model)> |
| `date`         | <YYYY-MM-DD when recorded> |
| `risk_tier`    | <trivial \| standard \| high-risk — makes ceremony depth auditable> |

## High-risk addendum (required when `risk_tier: high-risk`)

For high-risk units, also record:

- **Alternatives considered** — the options weighed and why they lost.
- **Risk note** — the explicit risk being accepted and any mitigation.
- Consider promoting the decision to a full ADR (see your project's `docs/decisions/`).

## The four gates

1. **inception-to-construction** — requirements + units of work approved.
2. **design-fork** — architecture/plan approved, before implementation.
3. **construction-to-merge** — the implemented unit approved for integration.
4. **to-operations** — the change authorized for deploy/release.
