#!/usr/bin/env node
/**
 * 40/27/33 읽기 전용 검증 (콘솔 표)
 *
 *   node scripts/validate-panic-402733.mjs
 *
 * 입력: vite-project/public/data/panic-spx-validation-series.json
 * 고정: <50 대기 · 50→40 · 60→+27 · 70→+33 · D−20~D0 최초 도달만
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  VALIDATION_BOTTOMS,
  simulate402733ForBottom,
} from "./lib/panic-spx-validation-core.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const SERIES = path.join(
  ROOT,
  "vite-project",
  "public",
  "data",
  "panic-spx-validation-series.json",
)

function pad(s, n) {
  const t = String(s ?? "—")
  return t.length >= n ? t.slice(0, n) : t + " ".repeat(n - t.length)
}

function main() {
  const doc = JSON.parse(fs.readFileSync(SERIES, "utf8"))
  const cases = VALIDATION_BOTTOMS.map((d0) => simulate402733ForBottom(doc.rows, d0))

  console.log("Panic 40/27/33 validation (capital=100, D-20..D0 first reach)")
  console.log(
    [
      pad("d0", 12),
      pad("bucket", 12),
      pad("invest", 7),
      pad("cash", 6),
      pad("D0%", 7),
      pad("MAE%", 7),
      pad("D+5", 7),
      pad("D+10", 7),
      pad("D+20", 7),
      pad("50→D0", 8),
      pad("60→D0", 8),
      pad("70→D0", 8),
      "firstBuy",
    ].join(" "),
  )

  for (const c of cases) {
    console.log(
      [
        pad(c.d0, 12),
        pad(c.bucket, 12),
        pad(c.deployed, 7),
        pad(c.cash, 6),
        pad(c.retD0, 7),
        pad(c.mae, 7),
        pad(c.retD5, 7),
        pad(c.retD10, 7),
        pad(c.retD20, 7),
        pad(c.extraAfterEntry["50"], 8),
        pad(c.extraAfterEntry["60"], 8),
        pad(c.extraAfterEntry["70"], 8),
        c.firstBuy ?? "—",
      ].join(" "),
    )
  }

  const full3 = cases.filter((c) => c.bucket === "full3").length
  const stage1 = cases.filter((c) => c.bucket === "stage1_only").length
  const none = cases.filter((c) => c.bucket === "none").length
  console.log("")
  console.log(`n=${cases.length} full3=${full3} stage1_only=${stage1} none=${none}`)

  const apr = cases.find((c) => c.d0 === "2025-04-08")
  if (apr) {
    const sameDay6070 =
      apr.fills.some((f) => f.tag === "60") &&
      apr.fills.some((f) => f.tag === "70") &&
      apr.fills.find((f) => f.tag === "60")?.date ===
        apr.fills.find((f) => f.tag === "70")?.date
    console.log(
      `2025-04-08: 60/70 same-day=${sameDay6070} D0=${apr.retD0}% fills=${JSON.stringify(apr.fills)}`,
    )
  }
}

main()
