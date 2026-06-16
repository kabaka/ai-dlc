#!/bin/sh
# Pre-flight checks for the AI-DLC repo (internal kit-builder layer).
#
# Runs, in order:
#   1. markdownlint-cli2 over all Markdown (skipped gracefully if unavailable)
#   2. node scripts/validate-frontmatter.mjs
#   3. node scripts/validate-links.mjs
#   4. shellcheck on scripts/*.sh (skipped gracefully if shellcheck absent)
#
# Aggregates results and exits non-zero if any check FAILED. A check that is
# SKIPPED (tool not installed) does not fail the run, but is reported clearly.
#
# Usage:  bash scripts/preflight.sh
set -eu

# Resolve the repo root from this script's location so it works from any cwd.
SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH='' cd -- "$SCRIPT_DIR/.." && pwd)
cd "$REPO_ROOT"

FAILED=""
SKIPPED=""
PASSED=""

section() {
  printf '\n=== %s ===\n' "$1"
}

mark_pass() { PASSED="$PASSED $1"; }
mark_fail() { FAILED="$FAILED $1"; }
mark_skip() { SKIPPED="$SKIPPED $1"; }

# --- 1. Markdown lint ------------------------------------------------------
section "markdownlint"
if command -v npx >/dev/null 2>&1; then
  # markdownlint-cli2 takes globs; "#node_modules" excludes that tree.
  if npx --yes markdownlint-cli2 "**/*.md" "#node_modules"; then
    echo "markdownlint: PASS"
    mark_pass markdownlint
  else
    echo "markdownlint: FAIL"
    mark_fail markdownlint
  fi
else
  echo "markdownlint: SKIPPED (npx not available; install Node.js/npm)"
  mark_skip markdownlint
fi

# --- 2. Frontmatter validation ---------------------------------------------
section "frontmatter validation"
if node scripts/validate-frontmatter.mjs; then
  mark_pass frontmatter
else
  mark_fail frontmatter
fi

# --- 3. Link validation ----------------------------------------------------
section "link validation"
if node scripts/validate-links.mjs; then
  mark_pass links
else
  mark_fail links
fi

# --- 4. shellcheck ---------------------------------------------------------
section "shellcheck"
if command -v shellcheck >/dev/null 2>&1; then
  SH_FILES=$(find scripts -type f -name '*.sh' 2>/dev/null | sort)
  if [ -z "$SH_FILES" ]; then
    echo "shellcheck: no scripts/*.sh found"
    mark_pass shellcheck
  else
    # Word-splitting of the file list is intended here.
    # shellcheck disable=SC2086
    if shellcheck $SH_FILES; then
      echo "shellcheck: PASS"
      mark_pass shellcheck
    else
      echo "shellcheck: FAIL"
      mark_fail shellcheck
    fi
  fi
else
  echo "shellcheck: SKIPPED (shellcheck not installed)"
  mark_skip shellcheck
fi

# --- Summary ---------------------------------------------------------------
section "pre-flight summary"
[ -n "$PASSED" ] && echo "PASSED: $PASSED"
[ -n "$SKIPPED" ] && echo "SKIPPED:$SKIPPED"
[ -n "$FAILED" ] && echo "FAILED: $FAILED"

if [ -n "$FAILED" ]; then
  echo "Pre-flight FAILED."
  exit 1
fi
echo "Pre-flight PASSED."
exit 0
