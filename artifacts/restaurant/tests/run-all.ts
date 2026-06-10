/**
 * Single-command runner for the La Playita POS browser e2e suite.
 *
 * Each scenario in artifacts/restaurant/tests/test-plans.ts has a matching
 * Playwright spec under artifacts/restaurant/tests/specs/ that drives the
 * real UI through the same login -> order -> kitchen -> POS -> daily-close
 * flow described in the plan. This script:
 *
 *   1. Verifies that every plan in ALL_TESTS has a Playwright test of the
 *      same name (the runner and plans can't silently drift apart).
 *   2. Invokes `playwright test` with the JSON reporter.
 *   3. Prints PASS/FAIL per scenario with the offending scenario name and
 *      the path to any screenshot Playwright captured on failure.
 *
 * It is wired into pnpm via `test:e2e` and registered as the `e2e`
 * validation step so the flow is exercised on every change.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ALL_TESTS } from "./test-plans";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const REPORT_PATH = join(
  REPO_ROOT,
  ".local",
  "state",
  "restaurant-e2e-report.json",
);

interface PwAttachment {
  name: string;
  path?: string;
  contentType?: string;
}

interface PwResult {
  status: "passed" | "failed" | "timedOut" | "skipped" | "interrupted";
  duration: number;
  attachments?: PwAttachment[];
  errors?: Array<{ message?: string; stack?: string }>;
  error?: { message?: string };
}

interface PwTest {
  title: string;
  results: PwResult[];
}

interface PwSpec {
  title: string;
  file?: string;
  tests: PwTest[];
}

interface PwSuite {
  title?: string;
  file?: string;
  specs?: PwSpec[];
  suites?: PwSuite[];
}

interface PwReport {
  suites: PwSuite[];
  stats?: { expected: number; unexpected: number; flaky: number; skipped: number };
}

function flattenSpecs(suites: PwSuite[] | undefined): PwSpec[] {
  if (!suites) return [];
  const out: PwSpec[] = [];
  for (const s of suites) {
    if (s.specs) out.push(...s.specs);
    if (s.suites) out.push(...flattenSpecs(s.suites));
  }
  return out;
}

function ensureSpecsCoverPlans(): void {
  const specsDir = join(__dirname, "specs");
  if (!existsSync(specsDir)) {
    console.error(`[run-all] Missing specs directory: ${specsDir}`);
    process.exit(2);
  }
  // Statically scan specs/ for `test("<name>", ...)` titles and require that
  // every entry in ALL_TESTS has a matching spec. This catches drift before
  // we spin up Chromium (the JSON reporter check after the run is a backstop
  // for cases where a spec exists but is filtered out at runtime).
  const titleRe = /\btest\(\s*(['"`])([^'"`]+)\1/g;
  const found = new Set<string>();
  for (const file of readdirSync(specsDir)) {
    if (!file.endsWith(".spec.ts")) continue;
    const src = readFileSync(join(specsDir, file), "utf8");
    for (const m of src.matchAll(titleRe)) {
      found.add(m[2]!);
    }
  }
  const missing = ALL_TESTS.map((t) => t.name).filter((n) => !found.has(n));
  if (missing.length > 0) {
    console.error("[run-all] No Playwright spec found for plan(s):");
    for (const m of missing) console.error(`  - ${m}`);
    console.error(
      `[run-all] Add a test("${missing[0]}", ...) entry under tests/specs/ ` +
        `or remove the plan from test-plans.ts.`,
    );
    process.exit(2);
  }
}

function preflight(): void {
  // Be helpful when workflows are not running. Playwright's own error message
  // for connection failures is opaque.
  const base =
    process.env.E2E_BASE_URL ||
    (process.env.REPLIT_DOMAINS
      ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]!.trim()}`
      : process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : "http://localhost:5000");
  console.log(`[run-all] Base URL: ${base}`);
  console.log(
    `[run-all] ${ALL_TESTS.length} scenarios:\n  - ${ALL_TESTS.map((t) => t.name).join("\n  - ")}\n`,
  );
}

function fmtMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function resetDemoData(): boolean {
  if (process.env.E2E_SKIP_RESET === "1") {
    console.log("[run-all] E2E_SKIP_RESET=1 — skipping demo data reset.");
    return true;
  }
  console.log("[run-all] Resetting demo database to a clean seeded state...");
  const result = spawnSync(
    "pnpm",
    ["--filter", "@workspace/scripts", "run", "reset:demo"],
    {
      cwd: REPO_ROOT,
      stdio: ["ignore", "inherit", "inherit"],
      env: process.env,
    },
  );
  if (result.error) {
    console.error("[run-all] Failed to launch reset:demo:", result.error);
    return false;
  }
  if ((result.status ?? 1) !== 0) {
    console.error(
      `[run-all] reset:demo exited with status ${result.status}. Aborting.`,
    );
    return false;
  }
  return true;
}

function runPlaywright(): number {
  const playwrightConfig = join(__dirname, "playwright.config.ts");
  const result = spawnSync(
    "pnpm",
    ["exec", "playwright", "test", "--config", playwrightConfig],
    {
      cwd: join(__dirname, ".."),
      stdio: ["ignore", "inherit", "inherit"],
      env: process.env,
    },
  );
  if (result.error) {
    console.error("[run-all] Failed to launch Playwright:", result.error);
    return 1;
  }
  return result.status ?? 1;
}

function reportFromJson(): { ok: boolean; printed: boolean } {
  if (!existsSync(REPORT_PATH)) {
    console.error(`[run-all] No JSON report at ${REPORT_PATH}`);
    return { ok: false, printed: false };
  }
  const report = JSON.parse(readFileSync(REPORT_PATH, "utf8")) as PwReport;
  const specs = flattenSpecs(report.suites);

  const declared = new Set(ALL_TESTS.map((t) => t.name));
  const seen = new Set<string>();
  const failures: Array<{
    name: string;
    error: string;
    screenshot?: string;
    trace?: string;
  }> = [];
  let passed = 0;

  console.log("");
  for (const spec of specs) {
    for (const t of spec.tests) {
      const name = spec.title; // playwright spec.title === test() name
      seen.add(name);
      const last = t.results[t.results.length - 1];
      const dur = fmtMs(last?.duration ?? 0);
      if (last?.status === "passed") {
        passed += 1;
        console.log(`▶  ${name} ... PASS (${dur})`);
      } else {
        const err =
          last?.errors?.[0]?.message ??
          last?.error?.message ??
          `status=${last?.status ?? "unknown"}`;
        const screenshot = last?.attachments?.find(
          (a) => a.name === "screenshot" && a.path,
        )?.path;
        const trace = last?.attachments?.find(
          (a) => a.name === "trace" && a.path,
        )?.path;
        failures.push({ name, error: err, screenshot, trace });
        console.log(`▶  ${name} ... FAIL (${dur})`);
        console.log(`     ↳ ${err.split("\n")[0]}`);
        if (screenshot) console.log(`     ↳ screenshot: ${screenshot}`);
        if (trace) console.log(`     ↳ trace:      ${trace}`);
      }
    }
  }

  const undeclared = [...seen].filter((n) => !declared.has(n));
  const missing = [...declared].filter((n) => !seen.has(n));
  if (undeclared.length > 0) {
    console.warn(
      `[run-all] WARNING: Playwright ran spec(s) not declared in test-plans.ts: ${undeclared.join(", ")}`,
    );
  }
  if (missing.length > 0) {
    console.error(
      `[run-all] ERROR: declared plan(s) had no matching Playwright test: ${missing.join(", ")}`,
    );
  }

  console.log("");
  console.log(`[run-all] ${passed}/${seen.size} scenarios passed`);
  if (failures.length > 0) {
    console.log("[run-all] Failed scenarios:");
    for (const f of failures) {
      console.log(`  - ${f.name}: ${f.error.split("\n")[0]}`);
      if (f.screenshot) console.log(`    screenshot: ${f.screenshot}`);
      if (f.trace) console.log(`    trace:      ${f.trace}`);
    }
  }

  const ok = failures.length === 0 && missing.length === 0;
  return { ok, printed: true };
}

function main(): never {
  ensureSpecsCoverPlans();
  preflight();
  if (!resetDemoData()) {
    process.exit(1);
  }
  const exitCode = runPlaywright();
  const { ok, printed } = reportFromJson();
  if (!printed) {
    process.exit(exitCode || 1);
  }
  process.exit(ok ? 0 : 1);
}

main();
