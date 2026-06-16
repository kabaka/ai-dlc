#!/usr/bin/env bash
# AI-DLC arbiter-gate hook (Claude Code PreToolUse).
#
# WHAT THIS ENFORCES
#   Before a *phase-transition action* runs, this hook checks that the human
#   arbiter has recorded an APPROVE Decision Record for that transition. If no
#   such record is present, the action is DENIED (permissionDecision: deny) with
#   an explicit reason. This is the deterministic enforcement the prose alone
#   cannot give: the model cannot talk its way past a missing human decision.
#
#   Phase-transition actions are recognized by matching the Bash command against
#   a configurable pattern list (default: merge / push to a protected branch /
#   deploy / release / tag) — i.e. the Gate 3 (merge) and Gate 4 (deploy/release)
#   transitions that take the concrete form of a shell command.
#
# WHAT THIS CANNOT ENFORCE (read honestly)
#   - Gate 1 (Inception->Construction) and Gate 2 (design fork) are *conceptual*
#     transitions, not single tool calls — no deterministic command marks them.
#     Those gates rely on the "strongly instructed" orchestrator prose, labeled
#     as best-effort, never as enforcement.
#   - Pattern matching is heuristic: a transition phrased to avoid the patterns
#     (an unusual deploy wrapper, a renamed script) will not be caught. Tune
#     AIDLC_GATE_PATTERNS for your project.
#   - The hook only checks that a record EXISTS and says approve; it cannot judge
#     whether the human's decision was wise. The human remains the sole arbiter.
#   - It guards the Bash tool. Transitions performed through other tools or
#     outside Claude Code are out of scope.
#
# CONTRACT (Claude Code PreToolUse hook)
#   stdin : JSON with .tool_name and .tool_input.command
#   deny  : exit 0 + {"hookSpecificOutput":{...,"permissionDecision":"deny",...}}
#   allow : exit 0 with no decision (normal permission flow proceeds)
#   We never use exit 2 here: a non-transition command must flow normally, and a
#   denied transition needs the structured reason that exit-0 JSON carries.
#
# DEPENDENCIES: bash + grep. jq is used when present (robust JSON parsing) and a
#   pure-bash fallback is used otherwise, so the hook works on a bare machine.

set -u

# --- Configuration (override via environment) -------------------------------

# Directory (relative to the project root) where approve Decision Records live.
RECORDS_DIR="${AIDLC_RECORDS_DIR:-.ai-dlc/records}"

# Extended-regex patterns identifying a phase-transition Bash command. Override
# AIDLC_GATE_PATTERNS with a single ERE to fit your project's deploy tooling.
GATE_PATTERNS="${AIDLC_GATE_PATTERNS:-(git[[:space:]]+merge)|(git[[:space:]]+push([[:space:]]|$))|(gh[[:space:]]+pr[[:space:]]+merge)|(git[[:space:]]+tag)|(npm[[:space:]]+publish)|(deploy)|(release)}"

# Project root: Claude Code exports CLAUDE_PROJECT_DIR; fall back to cwd.
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# --- Read hook input --------------------------------------------------------

input="$(cat)"

tool_name=""
command_str=""
if command -v jq >/dev/null 2>&1; then
  tool_name="$(printf '%s' "$input" | jq -r '.tool_name // empty' 2>/dev/null || true)"
  command_str="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null || true)"
else
  # Minimal fallback: pull tool_name and the command string without jq. This is
  # best-effort; a project that runs the hook should install jq for robustness.
  tool_name="$(printf '%s' "$input" \
    | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' \
    | head -n1 | sed 's/.*"tool_name"[[:space:]]*:[[:space:]]*"//; s/"$//' || true)"
  command_str="$(printf '%s' "$input" \
    | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' \
    | head -n1 | sed 's/.*"command"[[:space:]]*:[[:space:]]*"//; s/"$//' || true)"
fi

# Only gate the Bash tool; anything else flows normally.
if [ "$tool_name" != "Bash" ]; then
  exit 0
fi

# Not a phase-transition command -> no opinion, proceed.
if ! printf '%s' "$command_str" | grep -Eq "$GATE_PATTERNS"; then
  exit 0
fi

# --- Check for a present, valid APPROVE Decision Record ---------------------

records_path="$PROJECT_DIR/$RECORDS_DIR"
approved=0
if [ -d "$records_path" ]; then
  # An "approve" record is any file under the records dir whose chosen_option
  # line contains "approve" (case-insensitive). Matches the Decision Record
  # template field `chosen_option` (e.g. "approve plan A").
  while IFS= read -r f; do
    if grep -Eiq 'chosen_option.*approve' "$f" 2>/dev/null; then
      approved=1
      break
    fi
  done <<EOF
$(find "$records_path" -type f \( -name '*.md' -o -name '*.yaml' -o -name '*.yml' -o -name '*.json' \) 2>/dev/null)
EOF
fi

if [ "$approved" -eq 1 ]; then
  # A recorded human approval exists; let the transition proceed.
  exit 0
fi

# --- Deny: no approve Decision Record for this transition -------------------

reason="AI-DLC arbiter gate: this looks like a phase-transition action (matched the gate pattern), but no approved Decision Record was found in '$RECORDS_DIR'. The human arbiter must record an approve decision before this transition. Copy .ai-dlc/templates/artifacts/decision-record.md, set chosen_option to an approval, and save it under '$RECORDS_DIR/'. (Override detection with AIDLC_GATE_PATTERNS / AIDLC_RECORDS_DIR.)"

if command -v jq >/dev/null 2>&1; then
  jq -n --arg r "$reason" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $r
    }
  }'
else
  # Pure-bash JSON: escape backslashes and double quotes in the reason.
  esc="${reason//\\/\\\\}"
  esc="${esc//\"/\\\"}"
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$esc"
fi
exit 0
