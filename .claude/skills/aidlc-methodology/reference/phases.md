# AI-DLC phases in depth

The three phases form a loop that AI drives and humans arbitrate. Each phase has a
question it answers, the work AI proposes, and a ceremony where the team validates.

## Inception — WHAT / WHY

The phase that turns fuzzy business intent into a buildable plan.

- **AI's role:** transform business intent into detailed **requirements** and
  **user stories**, then decompose into **units of work** suitable for parallel
  development. AI surfaces the assumptions and open questions it needs answered.
- **Ceremony — Mob Elaboration:** the team validates AI's proposed requirements and
  answers its clarifying questions, collaboratively and in real time. This is where
  ambiguity gets resolved before anyone builds.
- **Output:** agreed requirements, stories, and units of work — the WHAT and WHY,
  signed off by humans.

## Construction — HOW

The phase that turns the agreed WHAT into working software.

- **AI's role:** propose **logical architecture**, **domain models**, **code**, and
  **tests** — including security and resilience concerns — plus **infrastructure as
  code (IaC)**. AI proposes; it does not unilaterally decide.
- **Ceremony — Mob Construction:** the team provides real-time clarification on
  technical decisions and validates AI's proposals as they're made.
- **Output:** implemented, tested units of work with their IaC, validated by humans.

## Operations — run it

- **AI's role:** manage **deployment**, **infrastructure**, and **monitoring**,
  applying accumulated project context, while the team keeps oversight.
- **No distinct mob ceremony** is named for Operations in the source material;
  human oversight remains the constant.

## Cadence

Phases run in **bolts** — intense work cycles measured in hours or days rather than
weeks (the AI-DLC rename of "sprint"). Units of work (the rename of "epic") are
sized to be parallelizable within a bolt. See `vocabulary.md`.

## Kiro spec-driven development as a tool-level implementation

Kiro structures a feature as `.kiro/specs/<feature>/` with `requirements.md`,
`design.md`, and `tasks.md`. That maps cleanly onto the methodology:

- `requirements.md` ≈ **Inception** output (WHAT/WHY)
- `design.md` ≈ **Construction** planning (HOW)
- `tasks.md` ≈ the units of work to execute

Kiro is therefore **one tool-level implementation of the AI-DLC methodology
layer** — useful as a concrete example, but the methodology is tool-agnostic and
larger than any single tool's encoding. See the `cross-platform-config` skill's
`reference/kiro.md` for the file mechanics.

## Sources

See `sources.md` — phase and ceremony definitions come from the AWS DevOps Blog
post and the `awslabs/aidlc-workflows` repository structure.
