/**
 * Generate DBB chart quality v6 selection-effect JSON from frozen v1.
 * node scripts/dbb-chart-quality-v6.mjs
 * Does not modify v1~v5 files.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { analyzeSelectionEffect } from "./lib/dbb-chart-quality-v6.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dataDir = join(root, "vite-project", "public", "data")
const outPath = join(dataDir, "dbb-chart-quality-v6.json")

const v1 = JSON.parse(readFileSync(join(dataDir, "dbb-chart-quality-v1.json"), "utf8"))
const report = analyzeSelectionEffect(v1)
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(report)}\n`, "utf8")

console.log(
  JSON.stringify(
    {
      outPath,
      asOf: report.asOf,
      counts: report.counts,
      baseline60: report.baseline.horizons["60"],
      cSelected60: report.c.pooled.selected["60"],
      cVsBase60: report.c.pooled.vsBaseline["60"],
      dSelected60: report.d.pooled.selected["60"],
      dVsBase60: report.d.pooled.vsBaseline["60"],
      cSameDay60: report.tableB.cSameDay["60"],
      dSameDay60: report.tableB.dSameDay["60"],
      cVal: report.c.validation.diff60,
      dVal: report.d.validation.diff60,
      cVerdict: report.c.judgment,
      dVerdict: report.d.judgment,
      overall: report.tableE.overall,
    },
    null,
    2,
  ),
)
