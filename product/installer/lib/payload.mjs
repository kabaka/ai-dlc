// Payload model for the AI-DLC installer.
//
// The payload is the set of files the installer lands in the consumer's repo,
// each tagged with an OWNERSHIP tier that decides how updates are applied
// (ADR-0006):
//
//   - "kit"      : the kit fully owns the file. Whole-file stamping; on update an
//                  undrifted file is overwritten cleanly, a drifted file is NOT
//                  clobbered (a `.new` sidecar is written instead).
//   - "co-owned" : the consumer co-owns the file (AGENTS.md, CLAUDE.md). NEVER
//                  edited in place once it pre-exists without our marker. First
//                  touch on a pre-existing marker-less file -> `.new` sidecar +
//                  printed merge instructions. If the file does not pre-exist, we
//                  create it (then we own that copy and stamp it).
//   - "executable": like "kit" but the installed file gets mode 0o755.
//
// Source resolution keeps a SINGLE SOURCE OF TRUTH (ADR-0003): when the installer
// runs from inside this repo, its payload is `product/`. When published to npm,
// the build copies the same files into `installer/payload/`. resolvePayloadRoot()
// picks whichever exists.

import { existsSync, statSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)); // installer/lib
const INSTALLER_ROOT = resolve(HERE, "..");           // installer/

/**
 * Resolve the directory that holds the payload source files.
 * Preference order:
 *   1. AIDLC_PAYLOAD_ROOT env override (tests / custom builds).
 *   2. installer/payload/        (the published npm-package layout).
 *   3. installer/../             (= product/, the in-repo single source).
 */
export function resolvePayloadRoot() {
  const override = process.env.AIDLC_PAYLOAD_ROOT;
  if (override) return resolve(override);

  const bundled = join(INSTALLER_ROOT, "payload");
  if (existsSync(join(bundled, "AGENTS.md"))) return bundled;

  const product = resolve(INSTALLER_ROOT, ".."); // product/
  if (existsSync(join(product, "AGENTS.md"))) return product;

  throw new Error(
    "Could not locate the AI-DLC payload. Expected installer/payload/ " +
      "(published) or product/ (in-repo). Set AIDLC_PAYLOAD_ROOT to override."
  );
}

/** Recursively list files under `dir`, returned as paths relative to `dir`. */
function listFilesRel(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  const walk = (abs) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const childAbs = join(abs, entry.name);
      if (entry.isDirectory()) walk(childAbs);
      else if (entry.isFile()) out.push(relative(dir, childAbs));
    }
  };
  if (statSync(dir).isDirectory()) walk(dir);
  return out;
}

/**
 * Build the full payload plan: an array of entries
 *   { src: <abs source path>, dest: <repo-relative dest path>, tier }
 *
 * Directory trees that may be absent at build time (the cross-platform steering
 * templates authored in parallel) are included only if present — the installer
 * skips them CLEANLY when missing, per the task contract.
 */
export function buildPayload(payloadRoot) {
  const entries = [];
  const add = (src, dest, tier) => entries.push({ src, dest, tier });

  // --- Top-level co-owned orchestrator files (installer-only delivery) ------
  // AGENTS.md and CLAUDE.md are co-owned: preserve a pre-existing consumer copy.
  add(join(payloadRoot, "AGENTS.md"), "AGENTS.md", "co-owned");
  add(join(payloadRoot, "CLAUDE.md"), "CLAUDE.md", "co-owned");

  // --- Claude-native payload: agents + skills (kit-owned) -------------------
  for (const rel of listFilesRel(join(payloadRoot, ".claude", "agents"))) {
    add(join(payloadRoot, ".claude", "agents", rel), join(".claude/agents", rel), "kit");
  }
  for (const rel of listFilesRel(join(payloadRoot, ".claude", "skills"))) {
    add(join(payloadRoot, ".claude", "skills", rel), join(".claude/skills", rel), "kit");
  }

  // --- Methodology artifact templates (kit-owned), landed under .ai-dlc ------
  for (const rel of listFilesRel(join(payloadRoot, "templates", "artifacts"))) {
    add(
      join(payloadRoot, "templates", "artifacts", rel),
      join(".ai-dlc/templates/artifacts", rel),
      "kit"
    );
  }

  // --- Arbiter-gate hook (executable + its config) --------------------------
  const hookScript = join(payloadRoot, "templates", "hooks", "arbiter-gate.sh");
  if (existsSync(hookScript)) {
    add(hookScript, ".ai-dlc/hooks/arbiter-gate.sh", "executable");
  }
  // hooks.json is landed under .ai-dlc/hooks for reference; the installer also
  // MERGES its registration into the consumer's .claude/settings.json (see
  // settings.mjs) rather than relying on this copy alone.
  const hooksJson = join(payloadRoot, "templates", "hooks", "hooks.json");
  if (existsSync(hooksJson)) {
    add(hooksJson, ".ai-dlc/hooks/hooks.json", "kit");
  }

  // --- Design-QA tools (kit-owned), landed under .ai-dlc/scripts ------------
  // The skills/agents reference these tools by their consumer path
  // (.ai-dlc/scripts/...). They MUST ship or those references are orphaned.
  // They run via `node <path>` (no chmod+x) -> "kit" tier, matching how every
  // other kit file is written/preserved on update (ADR-0006).
  //
  // We SHIP first-party tool .mjs only, preserving the directory shape so the
  // tools' RELATIVE imports resolve unchanged under .ai-dlc/scripts/:
  //   - off-token-lint.mjs         imports ./lib/*.mjs
  //   - visual-qa/*.mjs            import  ../lib/*.mjs and ./<sibling>.mjs
  // We FENCE OUT the validation-only scaffolding (package.json, the lockfile,
  // node_modules/, and test/) — that toolchain pins THIS repo's own tests and
  // must never land on a consumer machine (consumers install their own pinned
  // Playwright/axe toolchain; "orchestrate, don't bundle"). See product/scripts/README.md.
  const scriptsSrc = join(payloadRoot, "scripts");

  // off-token-lint.mjs (Slice 1) — the single top-level tool.
  const offTokenLint = join(scriptsSrc, "off-token-lint.mjs");
  if (existsSync(offTokenLint)) {
    add(offTokenLint, ".ai-dlc/scripts/off-token-lint.mjs", "kit");
  }

  // lib/*.mjs — the shared, audited primitives every tool imports. Ship ONLY
  // first-party .mjs (no incidental non-.mjs file ever lands here).
  for (const rel of listFilesRel(join(scriptsSrc, "lib"))) {
    if (!rel.endsWith(".mjs")) continue;
    add(join(scriptsSrc, "lib", rel), join(".ai-dlc/scripts/lib", rel), "kit");
  }

  // visual-qa/*.mjs — the exec-free checks plus the harness-gated browser tools
  // and their drivers. Ship ONLY first-party .mjs.
  for (const rel of listFilesRel(join(scriptsSrc, "visual-qa"))) {
    if (!rel.endsWith(".mjs")) continue;
    add(
      join(scriptsSrc, "visual-qa", rel),
      join(".ai-dlc/scripts/visual-qa", rel),
      "kit"
    );
  }

  // Consumer-facing README for the shipped tools (consumer invocation paths,
  // fail-closed confirmation flow, `npx playwright install chromium`, T3 RCE
  // residual-risk note). This is a SEPARATE, trimmed doc authored for consumers
  // under installer/ — NOT the kit-internal product/scripts/README.md, which
  // references the validation-only toolchain and `product/scripts/...` paths.
  const consumerScriptsReadme = join(
    INSTALLER_ROOT,
    "payload-extra",
    "scripts-README.md"
  );
  if (existsSync(consumerScriptsReadme)) {
    add(consumerScriptsReadme, ".ai-dlc/scripts/README.md", "kit");
  }

  // --- Cross-platform steering templates (degraded coverage) ----------------
  // Authored in parallel under templates/{github,cursor,kiro}. Present -> land at
  // the documented repo-root locations. Absent -> skipped cleanly.
  const steering = [
    {
      from: join(payloadRoot, "templates", "github"),
      to: ".github",
    },
    {
      from: join(payloadRoot, "templates", "cursor"),
      to: ".cursor",
    },
    {
      from: join(payloadRoot, "templates", "kiro"),
      to: ".kiro",
    },
  ];
  for (const { from, to } of steering) {
    for (const rel of listFilesRel(from)) {
      add(join(from, rel), join(to, rel), "kit");
    }
  }

  return entries;
}
