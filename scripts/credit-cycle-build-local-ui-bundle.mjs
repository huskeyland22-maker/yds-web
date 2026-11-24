#!/usr/bin/env node
/**
 * Build browser-facing local history bundle from .cache/credit-cycle.
 * Read-only vs remote systems. Writes only under vite-project/public/credit-cycle/.
 * Does not export HY/BBB values. Does not change engine weights.
 *
 * Usage:
 *   node scripts/credit-cycle-build-local-ui-bundle.mjs
 */

import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { buildLocalHistoryUiBundle } from "../src/credit-cycle/localHistoryProvider.js"
import { assertNoHyBbbLeak, adaptLocalHistoryBundleToUi } from "../src/credit-cycle/uiAdapter.js"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const CACHE = path.join(ROOT, ".cache", "credit-cycle")
const OUT_DIR = path.join(ROOT, "vite-project", "public", "credit-cycle")
const OUT_FILE = path.join(OUT_DIR, "local-history-bundle.json")
const INVENTORY_DOC = path.join(ROOT, "docs", "credit-cycle-local-data-inventory.md")
const RESEARCH_SNAP = path.join(OUT_DIR, "research-snapshot.json")

async function loadResearchHistory() {
  try {
    const j = JSON.parse(await readFile(RESEARCH_SNAP, "utf8"))
    return j.history || null
  } catch {
    return null
  }
}

function inventoryMarkdown(inv, meta) {
  const rows = Object.values(inv.indicators || {})
  const lines = [
    "# Credit Cycle — Local Data Inventory (Phase 7)",
    "",
    `Scanned: \`${inv.scannedAt}\``,
    `Cache root: \`${inv.cacheRoot}\``,
    `Bundle: \`vite-project/public/credit-cycle/local-history-bundle.json\``,
    `Bundle asOf: \`${meta.asOf || "—"}\` · feedStatus: \`${meta.feedStatus}\` · pit: \`${meta.pitLabel}\``,
    "",
    "| Indicator | Series | Restricted | Count | First | Last | Frequency | PIT from this file |",
    "|---|---|---|---:|---|---|---|---|",
  ]
  for (const r of rows) {
    lines.push(
      `| ${r.label || r.id} | ${r.seriesId || "—"} | ${r.licenseRestricted ? "YES" : "no"} | ${r.count ?? 0} | ${r.firstObservationDate || "—"} | ${r.lastObservationDate || "—"} | ${r.frequency || "—"} | ${r.pitCapableFromThisFile ? "yes" : "no (NON_PIT current vintage)"} |`,
    )
  }
  lines.push(
    "",
    "## Notes",
    "",
    "- FRED `*.json` caches are **current vintage** → product path labeled **NON_PIT**.",
    "- ALFRED realtime panels may exist under `.cache/credit-cycle/alfred/` for research PIT; not the default UI feed.",
    "- HY/BBB counts listed for inventory only; **values are not exported** to the UI bundle.",
    "- FDIC industry aggregates supply Bank Soundness (release lag ≈ +60d documented estimate).",
    "- Warning thresholds remain `INSUFFICIENT_EVIDENCE` (Phase 4).",
    "",
  )
  return lines.join("\n")
}

async function main() {
  const researchHistory = await loadResearchHistory()
  const bundle = await buildLocalHistoryUiBundle(CACHE, { researchHistory })

  // Strip engine object internals that are huge / not needed; keep serializable latest summary
  const latest = bundle.latestEngine
  const latestSlim = latest
    ? {
        mode: "license_safe",
        dataAsOfDate: latest.dataAsOfDate,
        asOfDate: latest.dataAsOfDate,
        cci: latest.cci,
        coverage: latest.coverage,
        confidence: latest.confidence,
        status: latest.cciStatus || latest.status,
        cciStatus: latest.cciStatus,
        pitStatus: latest.pitStatus || latest.pitValidationStatus || "NON_PIT",
        regime: latest.regime,
        indicators: (latest.indicators || []).map((i) => ({
          id: i.id,
          score: i.score,
          quality: i.quality,
          lastObservationDate: i.lastObservationDate || null,
          lastValue: i.id === "hy" || i.id === "bbb" ? null : i.lastValue ?? null,
          detail:
            i.id === "hy" || i.id === "bbb"
              ? null
              : i.detail
                ? {
                    momentum: i.detail.momentum
                      ? { shortDelta: i.detail.momentum.shortDelta ?? null }
                      : null,
                  }
                : null,
          pitStatus: i.pitStatus || null,
        })),
      }
    : null

  const out = {
    meta: bundle.meta,
    inventory: bundle.inventory,
    priorCci: bundle.priorCci,
    latestEngine: latestSlim,
    cciPath: bundle.cciPath.map((p) => ({
      asOf: p.asOf,
      cci: p.cci,
      cciMomentum: p.cciMomentum,
      coverage: p.coverage,
      confidence: p.confidence,
      cciStatus: p.cciStatus,
      pit: p.pit,
      regime: p.regime,
    })),
    series: bundle.series,
    researchHistory: bundle.researchHistory,
  }

  // Safety: ensure no HY/BBB numeric leaks in series
  for (const id of ["hy", "bbb"]) {
    if (out.series[id]) {
      out.series[id].points = []
      out.series[id].lastValue = null
      out.series[id].priorValue = null
      out.series[id].delta = null
    }
  }

  const dto = adaptLocalHistoryBundleToUi(out)
  if (!assertNoHyBbbLeak(dto)) {
    throw new Error("HY/BBB leak detected in adapted DTO — abort write")
  }

  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(OUT_FILE, JSON.stringify(out), "utf8")
  await writeFile(INVENTORY_DOC, inventoryMarkdown(bundle.inventory, bundle.meta), "utf8")

  console.log(
    JSON.stringify(
      {
        ok: true,
        out: path.relative(ROOT, OUT_FILE).replace(/\\/g, "/"),
        inventoryDoc: path.relative(ROOT, INVENTORY_DOC).replace(/\\/g, "/"),
        asOf: bundle.meta.asOf,
        cci: latestSlim?.cci ?? null,
        coverage: latestSlim?.coverage ?? null,
        cciPathPoints: out.cciPath.length,
        feedStatus: bundle.meta.feedStatus,
        pitLabel: bundle.meta.pitLabel,
        hyBbbExported: false,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err?.message || err) }))
  process.exit(1)
})
