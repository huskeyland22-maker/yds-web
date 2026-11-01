/**
 * Generate DBB chart quality v5 judgment JSON from frozen v1~v4.
 * node scripts/dbb-chart-quality-v5.mjs
 * Does not modify v1~v4 files.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { synthesizeChartQualityJudgment } from "./lib/dbb-chart-quality-v5.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dataDir = join(root, "vite-project", "public", "data")
const outPath = join(dataDir, "dbb-chart-quality-v5.json")

const v1 = JSON.parse(readFileSync(join(dataDir, "dbb-chart-quality-v1.json"), "utf8"))
const v2 = JSON.parse(readFileSync(join(dataDir, "dbb-chart-quality-v2.json"), "utf8"))
const v3 = JSON.parse(readFileSync(join(dataDir, "dbb-chart-quality-v3.json"), "utf8"))
const v4 = JSON.parse(readFileSync(join(dataDir, "dbb-chart-quality-v4.json"), "utf8"))

const report = synthesizeChartQualityJudgment({ v1, v2, v3, v4 })
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(report)}\n`, "utf8")

console.log(
  JSON.stringify(
    {
      outPath,
      asOf: report.asOf,
      counts: report.counts,
      levels: Object.fromEntries(
        Object.entries(report.judgments).map(([key, row]) => [key, { level: row.evidenceLevel, practical: row.practical }]),
      ),
      overall: report.tableD.overallScoreSystem.verdict,
    },
    null,
    2,
  ),
)
