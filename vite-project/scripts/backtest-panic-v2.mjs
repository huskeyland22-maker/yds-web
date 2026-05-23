/**
 * 패닉지수 V1 vs V2 백테스트
 * 사용: node scripts/backtest-panic-v2.mjs [history.json]
 */
import { readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { computePanicV2 } from "../src/panic-v2/computePanicV2.js"
import { getFinalScore } from "../src/utils/tradingScores.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")

/** 역사적·시나리오 스냅샷 (연도별 검증용) */
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
    label: "2020-11 백신 랠리",
    year: 2020,
    row: {
      date: "2020-11-09",
      vix: 25,
      vxn: 28,
      highYield: 4.2,
      move: 95,
      putCall: 0.72,
      fearGreed: 58,
      skew: 128,
      bofa: 5.2,
      gsBullBear: 55,
    },
  },
  {
    label: "2022-10 금리·신용 스트레스",
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
    label: "2023-07 AI 랠리·저변동",
    year: 2023,
    row: {
      date: "2023-07-18",
      vix: 14,
      vxn: 18,
      highYield: 3.6,
      move: 88,
      putCall: 0.62,
      fearGreed: 72,
      skew: 122,
      bofa: 6.5,
      gsBullBear: 62,
    },
  },
  {
    label: "2025-04 관세·변동성",
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
    label: "안정 벤치마크",
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

function rowToPanicData(row) {
  return {
    vix: row.vix,
    vxn: row.vxn,
    highYield: row.highYield ?? row.hyOas,
    move: row.move,
    putCall: row.putCall,
    fearGreed: row.fearGreed,
    skew: row.skew,
    bofa: row.bofa,
    gsBullBear: row.gsBullBear ?? row.gsSentiment,
  }
}

function scoreRow(row) {
  const data = rowToPanicData(row)
  const v2 = computePanicV2(data)
  const v1 = getFinalScore(data)
  return {
    date: row.date,
    v1,
    v2: v2.score,
    v2Status: v2.status?.label ?? "—",
    delta: v2.score != null ? v2.score - v1 : null,
    completeness: v2.completenessPct,
  }
}

function loadHistory(path) {
  if (!existsSync(path)) return []
  const raw = JSON.parse(readFileSync(path, "utf8"))
  const rows = Array.isArray(raw) ? raw : raw.rows ?? raw.data ?? []
  return rows.filter((r) => r?.date)
}

function summarizeByYear(rows) {
  /** @type {Record<string, { n: number; v1: number[]; v2: number[]; delta: number[] }>} */
  const byYear = {}
  for (const r of rows) {
    const y = String(r.date).slice(0, 4)
    if (!byYear[y]) byYear[y] = { n: 0, v1: [], v2: [], delta: [] }
    byYear[y].n++
    byYear[y].v1.push(r.v1)
    if (r.v2 != null) byYear[y].v2.push(r.v2)
    if (r.delta != null) byYear[y].delta.push(r.delta)
  }
  return byYear
}

function avg(arr) {
  if (!arr.length) return null
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
}

function printTable(title, rows) {
  console.log(`\n=== ${title} ===`)
  console.log("date       | V1  | V2  | Δ   | V2상태 | 완전%")
  console.log("-----------|-----|-----|-----|--------|------")
  for (const r of rows) {
    const d = r.delta != null ? (r.delta >= 0 ? `+${r.delta}` : String(r.delta)) : "—"
    console.log(
      `${r.date} | ${String(r.v1).padStart(3)} | ${String(r.v2 ?? "—").padStart(3)} | ${d.padStart(4)} | ${(r.v2Status ?? "—").padEnd(6)} | ${r.completeness}%`,
    )
  }
}

const historyPath = process.argv[2] || join(root, "public", "cycle-metrics-history.json")
const historyRows = loadHistory(historyPath)

console.log("[panic-v2 backtest]")
console.log("history file:", historyPath, "→", historyRows.length, "rows")

const fixtureScores = SCENARIO_FIXTURES.map((f) => ({
  ...scoreRow(f.row),
  label: f.label,
  year: f.year,
}))

printTable("시나리오 픽스처 (2020·2022·2023·2025)", fixtureScores)

for (const f of fixtureScores) {
  console.log(`  · ${f.label}: V2=${f.v2} (${f.v2Status}) vs V1=${f.v1}`)
}

if (historyRows.length) {
  const scored = historyRows.map(scoreRow).filter((r) => r.v2 != null)
  const byYear = summarizeByYear(scored)
  console.log("\n=== 히스토리 연도별 평균 ===")
  for (const year of ["2020", "2022", "2023", "2025"]) {
    const y = byYear[year]
    if (!y?.n) {
      console.log(`${year}: (데이터 없음)`)
      continue
    }
    console.log(
      `${year}: n=${y.n}  avgV1=${avg(y.v1)}  avgV2=${avg(y.v2)}  avgΔ=${avg(y.delta)}`,
    )
  }
} else {
  console.log("\n히스토리 JSON이 비어 있습니다. 배포 후 cycle-metrics-history로 재실행하세요.")
}

console.log("\n[완료] V2는 panic-v2/computePanicV2 — 기존 getFinalScore는 변경 없음.")
