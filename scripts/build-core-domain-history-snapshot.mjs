/**
 * Publish product-facing CORE domain history from research timeseries_10y.json.
 * Does not invent scores. Preserves null R_core / partial coverage.
 *
 * Usage: node scripts/build-core-domain-history-snapshot.mjs
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import crypto from "node:crypto"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const SRC = path.join(
  ROOT,
  "research/research10-credit-risk-model/output/timeseries_10y.json",
)
const OUT = path.join(
  ROOT,
  "vite-project/public/credit-cycle/core-domain-history.json",
)

function main() {
  if (!fs.existsSync(SRC)) {
    throw new Error(`missing source ${SRC}`)
  }
  const raw = JSON.parse(fs.readFileSync(SRC, "utf8"))
  if (!Array.isArray(raw)) throw new Error("timeseries must be array")

  const points = []
  let leftCensored = 0
  let partial = 0
  let full = 0

  for (const row of raw) {
    const asOf = String(row?.as_of || "").slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) continue

    const ds = numOrNull(row?.domain_scores?.supply)
    const dq = numOrNull(row?.domain_scores?.quantity)
    const dr = numOrNull(row?.domain_scores?.realized)
    const rCore = numOrNull(row?.R_core)
    const coverage =
      [ds, dq, dr].filter((v) => v != null).length === 3
        ? "FULL"
        : [ds, dq, dr].some((v) => v != null)
          ? "PARTIAL_COVERAGE"
          : "NO_DATA"

    if (coverage === "FULL") full += 1
    else if (coverage === "PARTIAL_COVERAGE") partial += 1
    else leftCensored += 1

    // Skip pure empty early rows to keep product payload lean, but keep
    // PARTIAL so LEFT_CENSORED / incomplete windows remain visible.
    if (coverage === "NO_DATA") continue

    points.push({
      as_of: asOf,
      observation_date: asOf,
      DS: ds,
      DQ: dq,
      DR: dr,
      R_core: rCore,
      r_status: row?.r_status || (rCore == null ? "INSUFFICIENT_DATA" : "OK"),
      coverage,
      pit_class: row?.confidence?.pit_class || row?.pit_mode || "NON_STRICT_PIT",
      conflict_flags: Array.isArray(row?.conflict_flags)
        ? row.conflict_flags.map((f) => f?.code || f).filter(Boolean)
        : [],
    })
  }

  // Dedupe by as_of (last wins)
  const map = new Map()
  for (const p of points) map.set(p.as_of, p)
  const series = [...map.values()].sort((a, b) => a.as_of.localeCompare(b.as_of))

  const tip = series.filter((p) => p.R_core != null).at(-1) || series.at(-1) || null
  const comparableNote =
    "Historical R_core points use the same Equal Domain candidate rules as the product tip, but WINDOW/GRADE remain NOT_CALIBRATED. Do not treat early partial windows as identical comparability."

  const payload = {
    schema_version: "core_domain_history-0.1.0",
    generated_at: new Date().toISOString(),
    source: {
      path: "research/research10-credit-risk-model/output/timeseries_10y.json",
      kind: "NON_STRICT_PIT_research_panel",
      rights: "RIGHTS_PASS_BOARD_PUBLIC",
    },
    quality: {
      pit_class: "NON_STRICT_PIT",
      left_censored_skipped_empty: leftCensored,
      partial_coverage_points: partial,
      full_domain_points: full,
      series_n: series.length,
      r_core_n: series.filter((p) => p.R_core != null).length,
    },
    tip: tip
      ? {
          as_of: tip.as_of,
          R_core: tip.R_core,
          DS: tip.DS,
          DQ: tip.DQ,
          DR: tip.DR,
        }
      : null,
    notes: [
      comparableNote,
      "Null domains are preserved — never coerced to 0.",
      "Product tip snapshot (core-r-core-snapshot.json) remains the live score authority.",
      "Liquidity / D_liquidity / CCI are not included in this series.",
    ],
    series,
  }

  const body = JSON.stringify(payload, null, 2)
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, body, "utf8")
  const hash = crypto.createHash("sha256").update(body).digest("hex").slice(0, 16)
  console.log(
    JSON.stringify(
      {
        out: path.relative(ROOT, OUT).replace(/\\/g, "/"),
        series_n: series.length,
        r_core_n: payload.quality.r_core_n,
        tip: payload.tip,
        content_hash16: hash,
      },
      null,
      2,
    ),
  )
}

function numOrNull(v) {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

main()
