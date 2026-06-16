---
name: security-review
description: Security review for the AI-DLC kit's attack surface. Use when a change adds or edits a shell/installer script, pulls in or bumps a dependency, configures an MCP server, or has a skill/agent ingest untrusted content. Covers installer/shell risk on consumer machines, supply chain, MCP config and credentials, and prompt-injection — outputs prioritized findings by severity. The security agent's playbook (review only).
---

# Security Review

AI-DLC ships guidance plus an installer and (later) packaging that **run on other
people's machines and inside their agents**. The risk does not live in
game/runtime code — it lives in four surfaces: the installer/shell scripts, the
supply chain, MCP configuration, and the prompt-injection surface of skills and
agents. Review only — report prioritized findings and hand remediation back to the
Orchestrator; do not edit. This is the `security` agent's playbook.

Required whenever a change adds/edits a script, adds/bumps a dependency, touches
MCP config, or makes a skill/agent process untrusted input.

## Review areas

### Installer & shell scripts (primary risk)

The installer scaffolds and updates files on a consumer's repo, often via
`npx`/`curl`. Review for:

- **`curl | bash` exposure** — document and prefer pinned, verifiable downloads;
  flag piping remote scripts straight into a shell without a checksum/ref pin.
- **Path traversal & clobbering** — writes must stay inside the target repo;
  reject `..` and absolute escapes; never silently overwrite a consumer's
  existing `AGENTS.md`/`CLAUDE.md`/config — merge or version-stamp and prompt.
- **Idempotency & destructive ops** — re-running must not corrupt or duplicate;
  no unguarded `rm -rf`, no writing outside expected paths.
- **Privilege** — never require or invoke `sudo`; operate as the invoking user.
- **Injection** — quote variables; no `eval` of derived strings; `shellcheck`
  clean is a precondition (see `pre-flight-checks`) but not sufficient.

### Supply chain

- **Dependencies** — vet new npm packages (maintenance, footprint, known
  advisories); keep runtime deps minimal. `npm audit` (high/critical) must be
  clean for anything shipped.
- **Pinning** — pin marketplace sources and any fetched refs to a tag or commit
  SHA, not a moving branch; verify the source is the intended upstream.
- **Manifest sources** — a `marketplace.json` pointing at an untrusted or
  unpinned source is a supply-chain hole; review additions and changes to it.

### MCP configuration

- **Untrusted servers** — an MCP server is third-party code/IO the agent trusts;
  flag adding servers from unverified sources.
- **Credential handling** — secrets come from env/`userConfig`, never hardcoded
  in committed config or examples; mark sensitive fields with `sensitive` in
  `userConfig` so they are not echoed; never log credentials.
- **Scope** — request the least the server needs; document what each server can
  reach.

### Prompt-injection surface

Skills and agents that ingest untrusted content (web pages, imported files, issue
text, MCP tool output) can be hijacked by instructions embedded in that content.
Review for:

- **Instruction hijacking** — does the skill/agent treat ingested content as
  *data*, or could embedded text redirect it (exfiltrate, run commands, alter
  output)? Untrusted content must never be followed as instructions.
- **Tool exposure under untrusted input** — an agent that reads untrusted content
  should not also hold broad write/exec tools; least-privilege limits blast
  radius (cross-check against the agent's `tools`).
- **Output trust** — content derived from untrusted input that is later written
  to repo files or commits is itself untrusted; validate before persisting.

## Output

A findings list ordered by severity (Blocker / Major / Minor), each with the file
path, the concrete risk, and a recommended remediation. Anything that executes on
a consumer's machine, leaks a credential, or lets untrusted content drive the
agent is a Blocker. State plainly if no issues were found and what surfaces you
reviewed.
