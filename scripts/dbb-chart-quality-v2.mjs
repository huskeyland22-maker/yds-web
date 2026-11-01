/**
 * Build same-day chart-quality comparison JSON from frozen v1 rows.
 * node scripts/dbb-chart-quality-v2.mjs
 * Does not modify v1 files.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { analyzeSameDayComparison } from "./lib/dbb-chart-quality-v2.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const v1Path = join(root, "vite-project", "public", "data", "dbb-chart-quality-v1.json")
const outPath = join(root, "vite-project", "public", "data", "dbb-chart-quality-v2.json")

const v1 = JSON.parse(readFileSync(v1Path, "utf8"))
const report = analyzeSameDayComparison(v1)
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(report)}\n`, "utf8")
console.log(
  JSON.stringify(
    {
      outPath,
      asOf: report.asOf,
      counts: report.counts,
      overall60: report.overall.topVsRest["60"],
      validation60: report.validation.topVsRest["60"],
    },
    null,
    2,
  ),
)
