// Unit test for browser-lib's R13 audit-path validation (normalizeAuditPath).
//
// Regression guard for the CodeQL "overly permissive regular expression range"
// alert: the control-char / whitespace reject used to embed RAW non-printable
// bytes in its character class ([<NUL>-<0x1F><0x7F>\s]), which is unreadable and
// unverifiable in source. It is now spelled explicitly as /[\s\x00-\x1f\x7f]/.
// These assertions pin the exact intended behavior across the full byte range so
// the readable spelling can never silently drift from what it must match:
//   - every C0 control char (0x00-0x1F), DEL (0x7F), and all whitespace  -> REJECT
//   - ordinary path chars, crucially the hyphen, and Unicode letters     -> ALLOW

import assert from "node:assert/strict";
import {
  normalizeAuditPath,
} from "../../scripts/visual-qa/browser-lib.mjs";
import { ToolError } from "../../scripts/lib/binding.mjs";

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

function rejects(path) {
  try {
    normalizeAuditPath(path, "test");
    return false;
  } catch (e) {
    assert.ok(e instanceof ToolError, `expected ToolError, got ${e}`);
    return true;
  }
}

// Every C0 control char and DEL must be rejected.
test("rejects all C0 control chars (0x00-0x1F) and DEL (0x7F)", () => {
  for (const c of [0x00, 0x01, 0x08, 0x1f, 0x7f]) {
    const ch = String.fromCharCode(c);
    assert.equal(
      rejects("/a" + ch + "b"),
      true,
      `byte 0x${c.toString(16)} should be rejected`
    );
  }
});

// All whitespace forms must be rejected (space, tab, newline, CR, FF, VT).
test("rejects whitespace (space, tab, \\n, \\r, \\f, \\v)", () => {
  for (const ch of [" ", "\t", "\n", "\r", "\f", "\v"]) {
    assert.equal(rejects("/a" + ch + "b"), true, `whitespace ${JSON.stringify(ch)} should be rejected`);
  }
});

// The bug the raw-byte range masked when mis-read: legitimate hyphenated paths
// must be ALLOWED, never rejected as "whitespace or a control character".
test("allows a hyphenated path (regression: hyphen is not whitespace)", () => {
  assert.equal(rejects("/foo-bar/baz-qux"), false);
  assert.equal(normalizeAuditPath("/foo-bar", "test"), "/foo-bar");
});

// Ordinary paths (and a Unicode letter) pass and are normalized to absolute.
test("allows ordinary and Unicode-letter paths, normalizing to absolute", () => {
  assert.equal(normalizeAuditPath("/about", "test"), "/about");
  assert.equal(normalizeAuditPath("about", "test"), "/about"); // made absolute
  assert.equal(normalizeAuditPath("/café", "test"), "/café"); // é is a letter, not control/space
});

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed++;
    console.error(`FAIL  ${name}\n        ${e.message.split("\n").join("\n        ")}`);
  }
}
console.log(`\nbrowser-lib-path.test.mjs: ${tests.length - failed}/${tests.length} passed`);
if (failed) process.exit(1);
