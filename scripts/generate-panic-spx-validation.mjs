#!/usr/bin/env node
/**
 * Panic × SPX 검증 시계열 재생성
 *
 *   node scripts/generate-panic-spx-validation.mjs           # 기존 rows 재사용 + bottoms 재주석
 *   node scripts/generate-panic-spx-validation.mjs --fetch   # Yahoo/CNN/Cboe 재계산
 *   node scripts/generate-panic-spx-validation.mjs --dry-run
 *
 * 고정: V2 0.45/0.35/0.20 · VALIDATION_BOTTOMS · threshold/비중 변경 금지
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  VALIDATION_BOTTOMS,
  buildValidationSeriesDocument,
  panicScoreV2,
} from "./lib/panic-spx-validation-core.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const OUT = path.join(
  ROOT,
  "vite-project",
  "public",
  "data",
  "panic-spx-validation-series.json",
)
const CACHE = path.join(ROOT, "scripts", ".cache")
const CNN_CACHE = path.join(CACHE, "cnn-fear-greed-daily.json")
const PC_CACHE = path.join(CACHE, "cboe-total-pc-daily.json")
const START = "2023-01-01"

const args = new Set(process.argv.slice(2))
const fetchMode = args.has("--fetch")
const dryRun = args.has("--dry-run")

function ensureCacheDir() {
  fs.mkdirSync(CACHE, { recursive: true })
}

async function fetchYahooDaily(symbol, start = START) {
  const period1 = Math.floor(new Date(`${start}T00:00:00Z`).getTime() / 1000)
  const period2 = Math.floor(Date.now() / 1000)
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${period1}&period2=${period2}&interval=1d&events=history`
  const res = await fetch(url, {
    headers: { "User-Agent": "yds-panic-validation/1.0" },
  })
  if (!res.ok) throw new Error(`Yahoo ${symbol} HTTP ${res.status}`)
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  const ts = result?.timestamp ?? []
  const closes = result?.indicators?.quote?.[0]?.close ?? []
  /** @type {Record<string, number>} */
  const out = {}
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i]
    if (c == null || !Number.isFinite(c) || c <= 0) continue
    const d = new Date(ts[i] * 1000).toISOString().slice(0, 10)
    out[d] = Math.round(c * 100) / 100
  }
  return out
}

async function loadCnn() {
  ensureCacheDir()
  if (fs.existsSync(CNN_CACHE)) {
    const raw = JSON.parse(fs.readFileSync(CNN_CACHE, "utf8"))
    return raw.prices ?? raw
  }
  const legacy = path.join(ROOT, "scripts", ".cache", "cnn-fear-greed-daily.json")
  if (fs.existsSync(legacy)) {
    const raw = JSON.parse(fs.readFileSync(legacy, "utf8"))
    return raw.prices ?? raw
  }
  const url =
    "https://raw.githubusercontent.com/whit3rabbit/fear-greed-data/main/fear-greed.csv"
  const res = await fetch(url)
  if (!res.ok) throw new Error(`CNN CSV HTTP ${res.status}`)
  const text = await res.text()
  /** @type {Record<string, number>} */
  const prices = {}
  for (const line of text.trim().split("\n").slice(1)) {
    const [d, v] = line.split(",", 2)
    const n = Number(v)
    if (d && Number.isFinite(n)) prices[d] = n
  }
  fs.writeFileSync(CNN_CACHE, JSON.stringify({ source: url, prices }, null, 2), "utf8")
  return prices
}

async function loadPutCall() {
  ensureCacheDir()
  if (fs.existsSync(PC_CACHE)) {
    const raw = JSON.parse(fs.readFileSync(PC_CACHE, "utf8"))
    return raw.prices ?? raw
  }
  const tempPc = path.join(
    process.env.TEMP || process.env.TMP || "/tmp",
    "yds-cboe-totalpc-cache.json",
  )
  if (fs.existsSync(tempPc)) {
    const raw = JSON.parse(fs.readFileSync(tempPc, "utf8"))
    const prices = raw.prices ?? raw
    fs.writeFileSync(
      PC_CACHE,
      JSON.stringify({ source: "temp-cache-copy", prices }, null, 2),
      "utf8",
    )
    return prices
  }
  throw new Error(
    "Cboe Total P/C cache missing. Place scripts/.cache/cboe-total-pc-daily.json (or use default reuse mode).",
  )
}

function loadExistingRows() {
  if (!fs.existsSync(OUT)) throw new Error(`Existing series not found: ${OUT}`)
  const doc = JSON.parse(fs.readFileSync(OUT, "utf8"))
  if (!Array.isArray(doc.rows) || !doc.rows.length) {
    throw new Error("Existing series has empty rows")
  }
  return doc.rows.map((r) => ({
    date: r.date,
    spx: r.spx,
    panic: r.panic == null ? null : r.panic,
  }))
}

async function buildRowsFromMarket() {
  console.log("Fetching ^GSPC / ^VIX …")
  const [spx, vix] = await Promise.all([
    fetchYahooDaily("^GSPC"),
    fetchYahooDaily("^VIX"),
  ])
  console.log("Loading CNN Fear & Greed …")
  const cnn = await loadCnn()
  console.log("Loading Cboe Total Put/Call …")
  const pc = await loadPutCall()

  const dates = Object.keys(spx)
    .filter((d) => d >= START)
    .sort()
  /** @type {{ date: string, spx: number, panic: number | null }[]} */
  const rows = []
  for (const d of dates) {
    const panic = panicScoreV2(vix[d], cnn[d], pc[d])
    rows.push({ date: d, spx: spx[d], panic: panic == null ? null : panic })
  }
  return rows
}

async function main() {
  console.log("VALIDATION_BOTTOMS:", VALIDATION_BOTTOMS.join(", "))

  const rows = fetchMode ? await buildRowsFromMarket() : loadExistingRows()
  if (!fetchMode) {
    console.log("Mode: reuse existing rows + re-annotate bottoms (deterministic)")
  }

  const doc = buildValidationSeriesDocument(rows, VALIDATION_BOTTOMS)
  const text = `${JSON.stringify(doc)}\n`

  console.log("span:", doc.span.join(" → "))
  console.log("summary:", doc.summary)
  console.log(
    "bottoms hits:",
    doc.bottoms
      .map((b) => `${b.d0} 50=${b.hit50} 60=${b.hit60} 70=${b.hit70}`)
      .join(" | "),
  )

  if (dryRun) {
    console.log("dry-run: not writing", OUT)
    return
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, text, "utf8")
  console.log("wrote", OUT)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
