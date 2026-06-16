# GitHub Copilot config (VS Code)

Copilot reads `AGENTS.md` and `CLAUDE.md` natively, plus its own instruction and
agent files. The standout is that it reads Claude's `.claude/agents/` directory
directly — so AI-DLC's subagents are reusable in Copilot for free.

## Instruction files

- **`.github/copilot-instructions.md`** — always-on, applies workspace-wide to
  every chat request. The Copilot analog of always-on guidance.
- **`.github/instructions/*.instructions.md`** — file-scoped instructions with
  optional YAML frontmatter. The `applyTo:` field takes a glob (relative to the
  workspace root) defining which files the instructions auto-apply to:

  ```markdown
  ---
  applyTo: "src/**/*.ts"
  ---
  Use strict null checks and prefer readonly arrays.
  ```

- **`AGENTS.md`** (root, nested supported) and **`CLAUDE.md`** — both read
  automatically and combined into chat context alongside the above.

When multiple instruction files apply, VS Code combines them into context.

## Custom agents — `*.agent.md`

Copilot custom agents use the `*.agent.md` extension (Markdown + YAML frontmatter).
Searched locations:

- `.github/agents/` (workspace)
- `~/.copilot/agents/` (user profile)
- **`.claude/agents/`** — VS Code detects files here following the **Claude
  sub-agents format**. This is the major interop win: AI-DLC's `.claude/agents/`
  subagents work in Copilot with zero duplication.
- Additional paths via the `chat.agentFilesLocations` setting.

Agent frontmatter fields include `name`, `description`, `tools`, `model`, `agents`
(subagents), `handoffs`, `user-invocable`, `hooks`, and `mcp-servers`. Author the
shared roster in `.claude/agents/` (per `writing-subagents`); reach for
`*.agent.md` only for Copilot-specific agents the Claude format can't express.

## Prompt files

`*.prompt.md` — reusable prompt snippets invoked on demand. Out of scope for the
shared kit; mention only if a Copilot-specific workflow needs one.

## Strategy for AI-DLC

Shared subagents live in `.claude/agents/`. Generate `.instructions.md` with
`applyTo:` only when you need file-scoped behavior, and generate via `rulesync`
rather than by hand (see `sync-strategy.md`).

## Sources

- https://code.visualstudio.com/docs/agent-customization/custom-instructions
- https://code.visualstudio.com/docs/copilot/customization/custom-agents
