#!/usr/bin/env node
/**
 * Build local license-safe CCI snapshot JSON from .cache/credit-cycle.
 * Does NOT write to Staging/Production DB. Does NOT export HY/BBB values.
 *
 *   node scripts/credit-cycle-build-license-safe-snapshots.mjs
 */
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { buildLicenseSafeSnapshotsFromCache } from "../src/credit-cycle/licenseSafeSnapshotBuilder.js"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const CACHE = path.join(ROOT, ".cache", "credit-cycle")
const OUT_DIR = path.join(ROOT, "vite-project", "public", "credit-cycle")
const OUT_FILE = path.join(OUT_DIR, "license-safe-snapshots.json")

const bundle = await buildLicenseSafeSnapshotsFromCache(CACHE, { from: "2018-01-01" })

// Slim public artifact: keep latest + compact path (no HY/BBB numerics)
const pathSlim = (bundle.snapshots || []).map((s) => ({
  asOf: s.as_of_date,
  cci: s.cci_score,
  coverage: s.coverage,
  confidence: s.confidence_status,
  regime: s.regime,
  pitStatus: s.pit_status,
  holdReason: s.hold_reason,
  calculationVersion: s.calculation_version,
  dataMode: s.data_mode,
}))

const out = {
  meta: bundle.meta,
  latest: bundle.latest,
  cciPath: pathSlim,
  // Full snapshots retained for future Staging seed approval (local file only)
  snapshots: bundle.snapshots,
}

await mkdir(OUT_DIR, { recursive: true })
await writeFile(OUT_FILE, JSON.stringify(out), "utf8")

const latest = bundle.latest
console.log(
  JSON.stringify(
    {
      ok: true,
      outFile: "vite-project/public/credit-cycle/license-safe-snapshots.json",
      feedStatus: bundle.meta.feedStatus,
      snapshotCount: bundle.meta.snapshotCount,
      latestAsOf: bundle.meta.latestAsOf,
      latestCci: latest?.cci_score ?? null,
      coverage: latest?.coverage ?? null,
      pitStatus: latest?.pit_status || null,
      hyBbbNumericInLatest: Array.isArray(latest?.indicator_scores)
        ? latest.indicator_scores.some(
            (r) =>
              ["hy", "bbb"].includes(String(r.indicator_code).toLowerCase()) &&
              (r.raw_value != null || r.indicator_score != null),
          )
        : false,
      stagingDbWrite: false,
      insufficientSources: bundle.meta.insufficientSources,
    },
    null,
    2,
  ),
)
