/**
 * 패닉 V1 · V2(절대) · V2(동적) 백테스트
 * 사용: node scripts/backtest-panic-v2.mjs [history.json]
 */
import { readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { computePanicV2 } from "../src/panic-v2/computePanicV2.js"
import { buildPanicV2DynamicSeries } from "../src/panic-v2/panicV2Dynamic.js"
import { panicV1ScoreForRow } from "../src/panic-v2/panicV1History.js"
import { getFinalScore } from "../src/utils/tradingScores.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")

const SCENARIO_FIXTURES = [
  {
    label: "2020-03 COVID 피크",
    year: 2020,
    row: {
      date: "2020-03-16",
      vix: 82,
      vxn: 70,
      highYield: 10.8,
      move: 164,
      putCall: 1.15,
      fearGreed: 12,
      skew: 142,
      bofa: 1.5,
      gsBullBear: 18,
    },
  },
  {
    label: "2022-10 금리·신용",
    year: 2022,
    row: {
      date: "2022-10-14",
      vix: 32,
      vxn: 35,
      highYield: 5.8,
      move: 125,
      putCall: 0.88,
      fearGreed: 22,
      skew: 138,
      bofa: 2.8,
      gsBullBear: 28,
    },
  },
  {
    label: "2025-04 관세·변동",
    year: 2025,
    row: {
      date: "2025-04-07",
      vix: 46,
      vxn: 42,
      highYield: 4.8,
      move: 118,
      putCall: 0.95,
      fearGreed: 18,
      skew: 145,
      bofa: 2.2,
      gsBullBear: 22,
    },
  },
  {
    label: "안정 벤치",
    year: 2025,
    row: {
      date: "2025-05-20",
      vix: 16.76,
      vxn: 20,
      highYield: 3.2,
      move: 82,
      putCall: 0.68,
      fearGreed: 55,
      skew: 126,
      bofa: 5.0,
      gsBullBear: 48,
    },
  },
]

/** @param {object} endRow @param {number} days */
function buildSyntheticPath(endRow, days = 80) {
  const baseDate = new Date(`${endRow.date}T12:00:00Z`)
  const keys = ["vix", "vxn", "highYield", "move", "putCall", "fearGreed", "skew", "bofa", "gsBullBear"]
  const rows = []
  for (let i = 0; i < days; i++) {
    const d = new Date(baseDate)
    d.setUTCDate(d.getUTCDate() - (days - 1 - i))
    const date = d.toISOString().slice(0, 10)
    const t = i / Math.max(1, days - 1)
    const row = { date }
    for (const k of keys) {
      const end = Number(endRow[k])
      const start = end * (0.55 + 0.25 * Math.sin(i * 0.4))
      const wave = Math.sin(i * 0.55 + k.length) * 0.06
      const v = start + (end - start) * t + end * wave
      row[k] = Math.max(0.01, Number(v.toFixed(k === "putCall" ? 2 : 1)))
    }
    rows.push(row)
  }
  rows[rows.length - 1] = { ...endRow }
  return rows
}

function rowToPanicData(row) {
  return {
    vix: row.vix,
    vxn: row.vxn,
    highYield: row.highYield,
    move: row.move,
    putCall: row.putCall,
    fearGreed: row.fearGreed,
    skew: row.skew,
    bofa: row.bofa,
    gsBullBear: row.gsBullBear,
  }
}

function scoreSnapshot(row) {
  const data = rowToPanicData(row)
  const v1 = getFinalScore(data)
  const v2Level = computePanicV2(data).score
  return { v1, v2Level }
}

function scorePath(path) {
  const dynamic = buildPanicV2DynamicSeries(path)
  const scores = dynamic.map((p) => p.score).filter((s) => s != null)
  const last = scores.length ? scores[scores.length - 1] : null
  const tail = scores.slice(-6)
  const spread =
    scores.length > 1 ? Math.max(...scores) - Math.min(...scores) : 0
  return { last, tail, spread, n: scores.length }
}

function loadHistory(path) {
  if (!existsSync(path)) return []
  const raw = JSON.parse(readFileSync(path, "utf8"))
  return (Array.isArray(raw) ? raw : raw.rows ?? raw.data ?? []).filter((r) => r?.date)
}

function printTable(title, rows) {
  console.log(`\n=== ${title} ===`)
  console.log("label              | V1  | V2절대 | V2동적 | 동적tail(6)        | spread")
  console.log("-------------------|-----|--------|--------|--------------------|-------")
  for (const r of rows) {
    const tail = r.dynamicTail.join(" ")
    console.log(
      `${r.label.padEnd(18)} | ${String(r.v1).padStart(3)} | ${String(r.v2Level).padStart(6)} | ${String(r.v2Dynamic).padStart(6)} | ${tail.padEnd(18)} | ${r.spread}`,
    )
  }
}

const historyPath = process.argv[2] || join(root, "public", "cycle-metrics-history.json")
const historyRows = loadHistory(historyPath)

console.log("[panic V1 / V2 backtest]")

const fixtureResults = SCENARIO_FIXTURES.map((f) => {
  const snap = scoreSnapshot(f.row)
  const path = buildSyntheticPath(f.row, 80)
  const dyn = scorePath(path)
  return {
    label: f.label,
    year: f.year,
    v1: snap.v1,
    v2Level: snap.v2Level,
    v2Dynamic: dyn.last,
    dynamicTail: dyn.tail,
    spread: dyn.spread,
  }
})

printTable("시나리오 (2020·2022·2025)", fixtureResults)

if (historyRows.length >= 20) {
  const dyn = scorePath(historyRows)
  console.log("\n=== 실제 히스토리 ===")
  console.log(`행 ${historyRows.length} · V2동적 최근6: ${dyn.tail.join(" ")} · spread ${dyn.spread}`)
} else {
  console.log("\n히스토리 JSON 비어 있음 — 시나리오 경로로 동적 차트 검증됨")
}

console.log("\n[완료] V2 차트=변화율+z-score · V1=getFinalScore · 절대 V2=computePanicV2")
