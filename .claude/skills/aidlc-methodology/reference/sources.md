# AI-DLC sources

Primary sources for the methodology, and what each substantiates. The methodology
is young and evolving — re-verify against these before asserting changed details.

## Primary

- **AWS DevOps Blog — "AI-Driven Development Life Cycle" (Raja SP, Jul 31, 2025)**
  https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle
  Substantiates: creator/date; the three phases (Inception / Construction /
  Operations) and their WHAT/HOW/run framing; the ceremonies **Mob Elaboration**
  and **Mob Construction**; the renamed vocabulary (**bolt** = sprint, **unit of
  work** = epic); the human-as-arbiter pattern ("AI creates plans, seeks
  clarification, & implements plans, while humans make critical decisions").

- **`awslabs/aidlc-workflows` (GitHub, MIT-0, open-sourced Nov 2025)**
  https://github.com/awslabs/aidlc-workflows
  Substantiates: open-sourcing and license; the directory encoding
  (`inception/`, `construction/`, `operations/`, `common/`, `extensions/`);
  tool-agnostic steering for Kiro, Amazon Q, Cursor, Cline, Claude Code, GitHub
  Copilot, and OpenAI Codex.

- **AWS Industries Blog — "AI-Driven Development Lifecycle for Financial Services"**
  https://aws.amazon.com/blogs/industries/ai-driven-development-lifecycle-for-financial-services/
  Substantiates: the values framing (Human-AI Collaboration over Isolated
  Solutions; Collective Intelligence over Individual Brilliance; Rapid Informed
  Decisions over Analysis Paralysis; Business Impact over Development Velocity) and
  the two dimensions (AI-powered execution with human oversight; dynamic team
  collaboration); domain application of the methodology.

## Disambiguation

AWS's **Machine Learning Development Lifecycle** (Well-Architected ML Lens) is a
**different** thing — it concerns building ML models, not the
software-development methodology described here. Do not cite ML Lens material as
AI-DLC.

## Verification note

Terms, phase names, and the ceremony set may shift as `aidlc-workflows` evolves.
When uncertain, route to the `researcher` agent and confirm against the URLs above
rather than asserting from memory.
