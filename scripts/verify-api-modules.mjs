/**
 * Vercel 배포 전 api/_lib 모듈 resolve 검증.
 * 사용: node scripts/verify-api-modules.mjs
 */
import { pathToFileURL } from "node:url"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

const modules = [
  "api/_lib/yahooChartPick.js",
  "api/_lib/stockPriceSummary.js",
  "api/_lib/kisClient.js",
  "api/_lib/chartSessionMeta.js",
  "api/stock-indicators.js",
  "api/stock.js",
]

let failed = 0
for (const rel of modules) {
  const abs = join(root, rel)
  try {
    await import(pathToFileURL(abs).href)
    console.log("OK", rel)
  } catch (e) {
    failed += 1
    console.error("FAIL", rel, e?.message || e)
  }
}

if (failed > 0) {
  process.exit(1)
}
console.log("All API modules resolved.")
