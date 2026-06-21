// Installer test runner. Runs each *.test.mjs in this directory as a child
// process and aggregates exit codes. Zero dependencies (Node built-ins only).
//
//   node test/run-all.mjs   (== `npm test` from product/installer)

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const suites = readdirSync(HERE)
  .filter((f) => f.endsWith(".test.mjs"))
  .sort();

let failed = 0;
for (const suite of suites) {
  console.log(`\n=== ${suite} ===`);
  const res = spawnSync(process.execPath, [join(HERE, suite)], {
    stdio: "inherit",
  });
  if (res.status !== 0) failed++;
}

console.log(
  `\ninstaller tests: ${suites.length - failed}/${suites.length} suite(s) passed`
);
process.exit(failed ? 1 : 0);
