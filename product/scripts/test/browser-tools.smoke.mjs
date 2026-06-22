#!/usr/bin/env node
// browser-tools.smoke.mjs — REAL chromium smoke test for the four browser/app
// visual-QA tools. This is a LOCAL / Tier-2 gate: it requires a managed chromium
// (`npx playwright install chromium`) and the pinned validation toolchain, which
// CI does NOT provide. It is NEVER part of run-all.mjs (the Tier-1 suite CI runs)
// and is run explicitly by a human/operator locally. An honest label, not a
// fabricated CI green.
//
// It builds real temp-repo fixtures whose binding `command` is `node build.mjs`
// (an allowlisted launcher running REAL consumer code that emits static HTML),
// supplies the matching confirmation token, and asserts:
//   * PASS(0)     on a clean fixture (axe/responsive/reachability),
//   * FINDINGS(1) on a fixture with a real contrast + overflow violation,
//   * FINDINGS(1) for pixel-diff against a deliberately-mismatched baseline,
//   * SKIPPED(3)  for pixel-diff when NO baselines are committed,
//   * SKIPPED(3)  when confirmation is WITHHELD (fail-closed),
//   * SKIPPED(3)  when the browser is absent (simulated), with the
//     `npx playwright install chromium` remediation echoed,
//   * ERROR(2)/refusal for the browser-layer security cases (metadata IP,
//     protocol-relative path, file:// — proven with a sink server recording
//     ZERO external hits — and a malicious repo playwright.config.js never
//     loaded).
//
// Run:  node product/scripts/test/browser-tools.smoke.mjs

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readdirSync, readFileSync,
  createReadStream,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { canonicalize } from '../lib/binding.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VQ = join(__dirname, '..', 'visual-qa');
const TOOLS = {
  axe: join(VQ, 'axe-audit.mjs'),
  responsive: join(VQ, 'responsive-check.mjs'),
  pixel: join(VQ, 'pixel-diff.mjs'),
  reach: join(VQ, 'reachability-runner.mjs'),
};

const results = [];
function check(name, cond, detail) {
  results.push({ name, ok: !!cond, detail });
  process.stdout.write(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : `\n        ${detail || ''}`}\n`);
}

// The confirmation hash covers the WHOLE binding (must mirror execHash in
// app-exec-harness.mjs, which hashes the entire canonicalized binding object —
// not a subset of fields). Any change to any binding field re-prompts.
function execHashOf(binding) {
  return createHash('sha256').update(canonicalize(binding), 'utf8').digest('hex');
}

function runTool(tool, repo, { confirm = true, extraArgs = [], env } = {}) {
  const bindingPath = join(repo, '.ai-dlc', 'stack-binding.json');
  const binding = JSON.parse(readFileSync(bindingPath, 'utf8'));
  const args = [tool, '--repo', repo, ...extraArgs];
  if (confirm) args.push('--confirm-exec', execHashOf(binding));
  const r = spawnSync(process.execPath, args, {
    encoding: 'utf8', timeout: 120000,
    env: env || { ...process.env },
    // run from an unrelated cwd to prove the tools use --repo, not cwd
    cwd: tmpdir(),
  });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '', signal: r.signal };
}

const BUILD = (pages, outDir) => `import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
const OUT = ${JSON.stringify(outDir)};
const pages = ${JSON.stringify(pages)};
mkdirSync(OUT, { recursive: true });
for (const [rel, html] of Object.entries(pages)) {
  const full = join(OUT, rel); mkdirSync(dirname(full), { recursive: true }); writeFileSync(full, html);
}
process.exit(0);
`;

const CLEAN_INDEX = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Home</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;font-family:sans-serif;color:#111;background:#fff}main{max-width:600px;margin:0 auto;padding:1rem}a{color:#0645ad}</style>
</head><body><main><h1>Welcome</h1><p>Accessible page that fits the viewport.</p><nav><a href="/about.html">About</a></nav></main></body></html>`;
const CLEAN_ABOUT = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>About</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;font-family:sans-serif;color:#111;background:#fff}main{max-width:600px;margin:0 auto;padding:1rem}</style>
</head><body><main><h1>About</h1><p>About this site.</p></main></body></html>`;
const BROKEN_INDEX = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Broken</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;font-family:sans-serif;background:#fff}.lc{color:#cccccc;background:#fff}.wide{width:3000px;height:20px;background:#eee}</style>
</head><body><main><h1 class="lc">Hard to read</h1><p class="lc">Grey on white fails WCAG AA contrast.</p><div class="wide">overflow</div></main></body></html>`;

function makeRepo(name, { pages, binding }) {
  const root = mkdtempSync(join(tmpdir(), `aidlc-smoke-${name}-`));
  const outDir = join(root, 'build');
  writeFileSync(join(root, 'build.mjs'), BUILD(pages, outDir));
  mkdirSync(join(root, '.ai-dlc', 'visual-qa-out'), { recursive: true });
  writeFileSync(join(root, '.ai-dlc', 'stack-binding.json'), JSON.stringify(binding, null, 2));
  return { root, outDir };
}

const cleanup = [];
function track(root) { cleanup.push(root); return root; }

async function main() {
  process.stdout.write('=== browser-tools REAL chromium smoke test ===\n');
  process.stdout.write(`chromium: ${chromium.executablePath()}\n\n`);

  // ---------- PASS fixtures ----------
  const passBinding = {
    surface: 'web', command: 'node', args: ['build.mjs'], static_dir: 'build',
    output_dir: '.ai-dlc/visual-qa-out',
    audit_paths: ['/', '/about.html'], routes: ['/', '/about.html'],
    baseline_dir: '.ai-dlc/visual-baselines',
    breakpoints: [{ label: 'mobile', width: 375, height: 667 }, { label: 'desktop', width: 1280, height: 800 }],
  };
  const pass = makeRepo('pass', { pages: { 'index.html': CLEAN_INDEX, 'about.html': CLEAN_ABOUT }, binding: passBinding });
  track(pass.root);

  // axe-audit PASS
  {
    const r = runTool(TOOLS.axe, pass.root);
    check('axe-audit: clean fixture → PASS(0)', r.code === 0, `code=${r.code}\n${r.stdout}\n${r.stderr}`);
    check('axe-audit: PASS line printed', /PASS:/.test(r.stdout), r.stdout);
  }
  // responsive PASS
  {
    const r = runTool(TOOLS.responsive, pass.root);
    check('responsive-check: clean fixture → PASS(0)', r.code === 0, `code=${r.code}\n${r.stdout}\n${r.stderr}`);
  }
  // reachability PASS
  {
    const r = runTool(TOOLS.reach, pass.root);
    check('reachability-runner: all routes render → PASS(0)', r.code === 0, `code=${r.code}\n${r.stdout}\n${r.stderr}`);
  }

  // ---------- FINDINGS fixtures ----------
  const broken = makeRepo('broken', {
    pages: { 'index.html': BROKEN_INDEX },
    binding: {
      surface: 'web', command: 'node', args: ['build.mjs'], static_dir: 'build',
      output_dir: '.ai-dlc/visual-qa-out', audit_paths: ['/'], routes: ['/'],
      breakpoints: [{ label: 'mobile', width: 375, height: 667 }],
    },
  });
  track(broken.root);
  {
    const r = runTool(TOOLS.axe, broken.root);
    check('axe-audit: contrast violation → FINDINGS(1)', r.code === 1, `code=${r.code}\n${r.stdout}\n${r.stderr}`);
    check('axe-audit: reports color-contrast', /color-contrast/.test(r.stdout), r.stdout);
  }
  {
    const r = runTool(TOOLS.responsive, broken.root);
    check('responsive-check: 3000px block → FINDINGS(1)', r.code === 1, `code=${r.code}\n${r.stdout}\n${r.stderr}`);
    check('responsive-check: reports horizontal overflow', /horizontal overflow/.test(r.stdout), r.stdout);
  }

  // ---------- pixel-diff: SKIP (no baselines) ----------
  {
    // pass fixture has baseline_dir declared but EMPTY (no PNGs) → SKIP.
    const r = runTool(TOOLS.pixel, pass.root);
    check('pixel-diff: no committed baselines → SKIPPED(3)', r.code === 3, `code=${r.code}\n${r.stdout}\n${r.stderr}`);
    check('pixel-diff: SKIP explains missing baselines', /no committed baselines/.test(r.stdout), r.stdout);
  }

  // ---------- pixel-diff: FINDINGS (mismatched baseline) ----------
  {
    // Seed a baseline that is the WRONG image but the RIGHT dimensions, so the
    // diff exceeds tolerance → FINDINGS. We first capture the real screenshot
    // size by running the build + a quick screenshot, then write a solid-magenta
    // baseline of that exact size.
    const blDir = join(pass.root, '.ai-dlc', 'visual-baselines');
    mkdirSync(blDir, { recursive: true });
    // Build the static dir (run the same consumer build) so we can screenshot.
    spawnSync(process.execPath, [join(pass.root, 'build.mjs')], { timeout: 30000 });
    const srv = await serveDir(pass.outDir);
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    await page.goto(`${srv.base}/`, { waitUntil: 'domcontentloaded' });
    const realShot = await page.screenshot({ fullPage: true });
    const realPng = PNG.sync.read(realShot);
    await browser.close(); await srv.close();
    // magenta baseline of identical size → guaranteed large diff
    const bl = new PNG({ width: realPng.width, height: realPng.height });
    for (let i = 0; i < realPng.width * realPng.height; i++) {
      bl.data[i * 4] = 255; bl.data[i * 4 + 1] = 0; bl.data[i * 4 + 2] = 255; bl.data[i * 4 + 3] = 255;
    }
    writeFileSync(join(blDir, 'root.png'), PNG.sync.write(bl));
    const r = runTool(TOOLS.pixel, pass.root, { extraArgs: ['--tolerance', '0.001'] });
    check('pixel-diff: mismatched baseline → FINDINGS(1)', r.code === 1, `code=${r.code}\n${r.stdout}\n${r.stderr}`);
    check('pixel-diff: reports px differ', /px differ/.test(r.stdout), r.stdout);
  }

  // ---------- pixel-diff: PASS (identical baseline) ----------
  {
    // Re-seed the baseline from the actual current screenshot → should PASS.
    const blDir = join(pass.root, '.ai-dlc', 'visual-baselines');
    spawnSync(process.execPath, [join(pass.root, 'build.mjs')], { timeout: 30000 });
    const srv = await serveDir(pass.outDir);
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    await page.goto(`${srv.base}/`, { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: join(blDir, 'root.png'), fullPage: true });
    // also seed about.html baseline so we exercise the multi-path path
    await page.goto(`${srv.base}/about.html`, { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: join(blDir, 'about.html.png'), fullPage: true });
    await browser.close(); await srv.close();
    const r = runTool(TOOLS.pixel, pass.root, { extraArgs: ['--tolerance', '0.02'] });
    check('pixel-diff: identical baseline → PASS(0)', r.code === 0, `code=${r.code}\n${r.stdout}\n${r.stderr}`);
  }

  // ---------- SKIPPED: confirmation WITHHELD ----------
  {
    const r = runTool(TOOLS.axe, pass.root, { confirm: false });
    check('axe-audit: no confirmation → SKIPPED(3)', r.code === 3, `code=${r.code}\n${r.stdout}\n${r.stderr}`);
    check('axe-audit: SKIP says not confirmed', /not confirmed/.test(r.stdout), r.stdout);
  }

  // ---------- SKIPPED: browser absent (simulated) ----------
  {
    // Point PLAYWRIGHT_BROWSERS_PATH at an empty dir so chromium.executablePath()
    // resolves to a missing binary → loadChromium() throws BrowserAbsentError →
    // SKIPPED(3) with the install remediation. (Env passed to the TOOL process;
    // the harness's child env is unaffected — this only changes browser resolution
    // in the audit hook, which runs in the tool process.)
    const empty = track(mkdtempSync(join(tmpdir(), 'aidlc-nobrowser-')));
    const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: empty };
    const r = runTool(TOOLS.axe, pass.root, { env });
    check('axe-audit: browser absent → SKIPPED(3)', r.code === 3, `code=${r.code}\n${r.stdout}\n${r.stderr}`);
    check('axe-audit: echoes `npx playwright install chromium`', /npx playwright install chromium/.test(r.stdout), r.stdout);
  }

  // ---------- SECURITY: off-loopback static_dir is impossible (URL rejected) ----------
  {
    const evil = makeRepo('evilstatic', {
      pages: { 'index.html': CLEAN_INDEX },
      binding: {
        surface: 'web', command: 'node', args: ['build.mjs'],
        static_dir: 'http://169.254.169.254/', output_dir: '.ai-dlc/visual-qa-out',
        audit_paths: ['/'],
      },
    });
    track(evil.root);
    const r = runTool(TOOLS.axe, evil.root);
    check('security: static_dir as a URL → ERROR(2)', r.code === 2, `code=${r.code}\n${r.stdout}\n${r.stderr}`);
    check('security: refuses URL static_dir', /must be a REPO-LOCAL path, not a URL/.test(r.stderr + r.stdout), r.stderr + r.stdout);
  }

  // ---------- SECURITY: malicious audit_paths refused + ZERO external hits ----------
  {
    // A sink server records ANY connection. If a tool ever navigated off-loopback
    // it would hit this. We assert ZERO hits across all malicious-path runs.
    const sink = await makeSink();
    const cases = [
      { label: 'metadata IP', audit_paths: [`http://169.254.169.254/latest/meta-data/`] },
      { label: 'protocol-relative', audit_paths: ['//evil.example.com/'] },
      { label: 'file scheme', audit_paths: ['file:///etc/passwd'] },
      { label: 'traversal', audit_paths: ['/../../../../etc/passwd'] },
      { label: 'sink host as path', audit_paths: [`http://127.0.0.1:${sink.port}/pwn`] },
    ];
    for (const c of cases) {
      const evil = makeRepo('evilpath', {
        pages: { 'index.html': CLEAN_INDEX },
        binding: {
          surface: 'web', command: 'node', args: ['build.mjs'], static_dir: 'build',
          output_dir: '.ai-dlc/visual-qa-out', audit_paths: c.audit_paths,
        },
      });
      track(evil.root);
      const r = runTool(TOOLS.axe, evil.root);
      check(`security: audit_path ${c.label} → ERROR(2) refusal`, r.code === 2, `code=${r.code}\n${r.stdout}\n${r.stderr}`);
    }
    await new Promise((res) => setTimeout(res, 300));
    check('security: sink server recorded ZERO external hits', sink.hits.length === 0, `hits=${JSON.stringify(sink.hits)}`);
    await sink.close();
  }

  // ---------- SECURITY: repo playwright.config.js with malicious globalSetup never loaded ----------
  {
    const sentinel = join(tmpdir(), `aidlc-PWNED-globalsetup-${process.pid}`);
    try { rmSync(sentinel, { force: true }); } catch { /* */ }
    const evil = makeRepo('evilconfig', {
      pages: { 'index.html': CLEAN_INDEX },
      binding: {
        surface: 'web', command: 'node', args: ['build.mjs'], static_dir: 'build',
        output_dir: '.ai-dlc/visual-qa-out', audit_paths: ['/'],
        // attacker tries to name a config/globalSetup via the binding — our tools
        // never read these keys.
        config: 'playwright.config.js', globalSetup: './evil-setup.js',
        reporter: './evil-reporter.js', channel: 'chrome', executablePath: '/bin/false',
      },
    });
    track(evil.root);
    // Plant a malicious repo playwright.config.js + globalSetup that would write
    // the sentinel IF Playwright ever auto-loaded it.
    writeFileSync(join(evil.root, 'playwright.config.js'),
      `const fs=require('fs');fs.writeFileSync(${JSON.stringify(sentinel)},'pwned');module.exports={globalSetup:require.resolve('./evil-setup.js')};`);
    writeFileSync(join(evil.root, 'evil-setup.js'),
      `const fs=require('fs');module.exports=async()=>{fs.writeFileSync(${JSON.stringify(sentinel)},'pwned-setup');};`);
    const r = runTool(TOOLS.axe, evil.root);
    // The run should PASS (clean page) or otherwise complete WITHOUT ever creating
    // the sentinel — proving no repo config/globalSetup was honored.
    check('security: repo playwright.config.js never loaded (no sentinel)', !existsSync(sentinel),
      `sentinel exists=${existsSync(sentinel)} code=${r.code}`);
    check('security: binding config/channel/executablePath ignored (run still completed)',
      r.code === 0 || r.code === 1 || r.code === 3, `code=${r.code}\n${r.stdout}\n${r.stderr}`);
    try { rmSync(sentinel, { force: true }); } catch { /* */ }
  }

  // ---------- SECURITY: output confined to a fresh kit-owned subdir ----------
  {
    const outRoot = join(pass.root, '.ai-dlc', 'visual-qa-out');
    const before = existsSync(outRoot) ? readdirSync(outRoot).length : 0;
    runTool(TOOLS.pixel, pass.root, { extraArgs: ['--tolerance', '0.02'] });
    const after = existsSync(outRoot) ? readdirSync(outRoot) : [];
    check('security: pixel-diff wrote into a fresh run-* subdir under the kit output root',
      after.some((d) => d.startsWith('run-')) && after.length >= before, `entries=${JSON.stringify(after)}`);
  }

  // ---------- report ----------
  const failed = results.filter((r) => !r.ok);
  process.stdout.write('\n==================================================\n');
  process.stdout.write(`${results.length - failed.length}/${results.length} checks passed\n`);
  if (failed.length) {
    process.stdout.write(`${failed.length} FAILED:\n`);
    for (const f of failed) process.stdout.write(`  - ${f.name}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write('ALL GREEN (local Tier-2 smoke)\n');
  }
}

// A minimal loopback static server for the test's own baseline-seeding (NOT the
// tool's server; this is test scaffolding).
function serveDir(dir) {
  return new Promise((res) => {
    const server = createServer((req, rq) => {
      let p = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
      if (p === '/' || p.endsWith('/')) p += 'index.html';
      const full = join(dir, p.replace(/^\/+/, ''));
      if (!existsSync(full)) { rq.writeHead(404); rq.end(); return; }
      rq.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
      createReadStream(full).pipe(rq);
    });
    server.listen(0, '127.0.0.1', () => {
      res({ base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}

// A sink that records every connection (proves no off-loopback request landed).
function makeSink() {
  const hits = [];
  return new Promise((res) => {
    const server = createServer((req, rq) => { hits.push(req.url); rq.writeHead(200); rq.end('sink'); });
    server.listen(0, '127.0.0.1', () => {
      res({ port: server.address().port, hits, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}

await main();
for (const root of cleanup) { try { rmSync(root, { recursive: true, force: true }); } catch { /* */ } }
