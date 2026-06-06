/**
 * YDS Cycle Validation Study — read-only research script
 * Engine / weights / zone thresholds NOT modified.
 *
 * Usage: node scripts/yds-cycle-validation-study.mjs [--spy scripts/.cache/gspc-daily.json]
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { resolveMacroV1Status, MACRO_V1_STATUS_BANDS } from "../vite-project/src/panic-v2/panicMacroV1Status.js"
import { panicDataFromCycleRow } from "../vite-project/src/utils/cycleHistoryUtils.js"
import { getFinalScore } from "../vite-project/src/utils/tradingScores.js"
import { PANIC_VALIDATION_EXTENDED_HISTORY } from "../vite-project/src/trading-zone/panicValidationExtendedHistory.js"
import {
  calcForwardReturnMap,
  mergeYdsSourceHistory,
  pickYdsWeeklySteps,
} from "../vite-project/src/trading-zone/ydsSignalHistory.js"
import { analyzeYdsScoreDistributionWindows } from "../vite-project/src/utils/ydsScoreValidation.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

const STAGE_ORDER = ["overheated", "neutral", "interest", "dca", "panicBuy"]
const STAGE_LABEL = Object.fromEntries(MACRO_V1_STATUS_BANDS.map((b) => [b.id, b.label]))
const HORIZONS = [
  { key: "m1", label: "1개월", days: 30 },
  { key: "m3", label: "3개월", days: 90 },
  { key: "m6", label: "6개월", days: 180 },
  { key: "m12", label: "12개월", days: 365 },
]

function rowDateKey(row) {
  return String(row?.date ?? row?.ts ?? "").slice(0, 10)
}

function scoreRow(row) {
  const panic = panicDataFromCycleRow(row)
  if (!panic) return null
  const score = getFinalScore(panic)
  if (!Number.isFinite(score)) return null
  const stage = resolveMacroV1Status(score)
  if (!stage) return null
  return { score: Math.round(score), stageId: stage.id, stageLabel: stage.label }
}

/** Calendar-day weighted dwell between sparse anchors */
function analyzeDwellByCalendarDays(sortedAsc) {
  /** @type {Record<string, number>} */
  const days = Object.fromEntries(STAGE_ORDER.map((id) => [id, 0]))
  let totalDays = 0

  for (let i = 0; i < sortedAsc.length - 1; i++) {
    const cur = sortedAsc[i]
    const next = sortedAsc[i + 1]
    const d0 = rowDateKey(cur)
    const d1 = rowDateKey(next)
    const s = scoreRow(cur)
    if (!s) continue
    const span =
      (new Date(`${d1}T12:00:00`).getTime() - new Date(`${d0}T12:00:00`).getTime()) / 86_400_000
    if (span <= 0) continue
    days[s.stageId] += span
    totalDays += span
  }

  const pct = Object.fromEntries(
    STAGE_ORDER.map((id) => [id, totalDays > 0 ? (days[id] / totalDays) * 100 : 0]),
  )
  return { days, totalDays, pct }
}

/** Zone entry events (stage transition) */
function findZoneEntries(steps) {
  /** @type {Array<{ date: string; stageId: string; score: number; idx: number }>} */
  const entries = []
  let prevStage = null
  for (let i = 0; i < steps.length; i++) {
    const s = scoreRow(steps[i])
    if (!s) continue
    if (s.stageId !== prevStage) {
      entries.push({
        date: rowDateKey(steps[i]),
        stageId: s.stageId,
        score: s.score,
        idx: i,
      })
      prevStage = s.stageId
    }
  }
  return entries
}

function avg(nums) {
  const v = nums.filter(Number.isFinite)
  if (!v.length) return null
  return v.reduce((a, b) => a + b, 0) / v.length
}

function analyzeForwardReturnsProxy(steps, entries) {
  /** @type {Record<string, { m1: number[]; m3: number[]; m6: number[]; m12: number[]; count: number }>} */
  const byStage = Object.fromEntries(
    STAGE_ORDER.map((id) => [id, { m1: [], m3: [], m6: [], m12: [], count: 0 }]),
  )

  for (const e of entries) {
    const fwd = calcForwardReturnMap(steps, e.idx)
    const bucket = byStage[e.stageId]
    if (!bucket) continue
    bucket.count++
    for (const h of HORIZONS) {
      if (fwd[h.key] != null) bucket[h.key].push(fwd[h.key])
    }
  }

  return Object.fromEntries(
    STAGE_ORDER.map((id) => {
      const b = byStage[id]
      return [
        id,
        {
          entryCount: b.count,
          m1: avg(b.m1),
          m3: avg(b.m3),
          m6: avg(b.m6),
          m12: avg(b.m12),
          samples: { m1: b.m1.length, m3: b.m3.length, m6: b.m6.length, m12: b.m12.length },
        },
      ]
    }),
  )
}

/** Real S&P500 forward returns from daily price map */
function loadSpyPrices(path) {
  if (!path || !existsSync(path)) return null
  const raw = JSON.parse(readFileSync(path, "utf8"))
  return raw?.prices ?? raw
}

function spyForwardReturn(prices, entryDate, horizonDays) {
  if (!prices || !prices[entryDate]) return null
  const entry = prices[entryDate]
  const entryTs = new Date(`${entryDate}T12:00:00`).getTime()
  const dates = Object.keys(prices).sort()
  let target = null
  for (const d of dates) {
    const ts = new Date(`${d}T12:00:00`).getTime()
    if ((ts - entryTs) / 86_400_000 >= horizonDays) {
      target = prices[d]
      break
    }
  }
  if (target == null || !Number.isFinite(entry) || entry <= 0) return null
  return ((target - entry) / entry) * 100
}

function nearestSpyDate(prices, date) {
  const dates = Object.keys(prices).sort()
  if (prices[date]) return date
  for (const d of dates) {
    if (d >= date) return d
  }
  return dates[dates.length - 1] ?? null
}

function analyzeForwardReturnsSpy(prices, entries) {
  if (!prices) return null
  /** @type {Record<string, { m1: number[]; m3: number[]; m6: number[]; m12: number[]; count: number }>} */
  const byStage = Object.fromEntries(
    STAGE_ORDER.map((id) => [id, { m1: [], m3: [], m6: [], m12: [], count: 0 }]),
  )

  for (const e of entries) {
    const d = nearestSpyDate(prices, e.date)
    if (!d) continue
    const bucket = byStage[e.stageId]
    if (!bucket) continue
    bucket.count++
    for (const h of HORIZONS) {
      const r = spyForwardReturn(prices, d, h.days)
      if (r != null) bucket[h.key].push(r)
    }
  }

  return Object.fromEntries(
    STAGE_ORDER.map((id) => {
      const b = byStage[id]
      return [
        id,
        {
          entryCount: b.count,
          m1: avg(b.m1),
          m3: avg(b.m3),
          m6: avg(b.m6),
          m12: avg(b.m12),
          samples: { m1: b.m1.length, m3: b.m3.length, m6: b.m6.length, m12: b.m12.length },
        },
      ]
    }),
  )
}

function fmtPct(n) {
  if (n == null || !Number.isFinite(n)) return "—"
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`
}

function recommend(dwell, fwdSpy, fwdProxy) {
  const oppStages = ["interest", "dca", "panicBuy"]
  const oppDwell = oppStages.reduce((s, id) => s + (dwell.pct[id] ?? 0), 0)
  const panicDwell = dwell.pct.panicBuy ?? 0
  const dcaDwell = dwell.pct.dca ?? 0
  const interestDwell = dwell.pct.interest ?? 0

  const spyM12 = fwdSpy ?? fwdProxy
  const interestM12 = spyM12?.interest?.m12
  const dcaM12 = spyM12?.dca?.m12
  const panicM12 = spyM12?.panicBuy?.m12

  if (panicDwell < 1 && dcaDwell >= 5) {
    return {
      code: "C",
      label: "분할매수 확대 (UI·가이드)",
      rationale:
        "7년간 패닉매수(80+) 구간 체류 0% — 엔진은 패닉 탐지기가 아니라 분할매수·관심 중심. COVID(VIX 83)도 75점(분할). UI·철학을 「분할=핵심·패닉=보너스」로 정렬.",
    }
  }
  if (panicDwell < 3 && oppDwell > 25 && (interestM12 ?? 0) > 5) {
    return {
      code: "B",
      label: "관심구간 확대 (UI·가이드)",
      rationale:
        "투자 기회 구간(관심+분할) 체류·진입 빈도는 있으나 패닉 체류는 희소. 성과는 관심·분할 진입에서 주로 발생 — UI를 패닉 중심에서 관심·준비 중심으로 재정렬.",
    }
  }
  if (dcaDwell < 8 && (dcaM12 ?? 0) > (panicM12 ?? 0)) {
    return {
      code: "C",
      label: "분할매수 확대 (UI·가이드)",
      rationale:
        "분할매수 구간 진입 후 중기 수익률이 패닉매수와 유사·우수하나 체류·진입 횟수는 적음 — 핵심 매집 구간으로 UI·행동 가이드 강조.",
    }
  }
  if (panicDwell >= 5 && (panicM12 ?? 0) >= 15) {
    return {
      code: "D",
      label: "패닉 기준 유지",
      rationale:
        "패닉매수 구간은 드물지만 진입 후 장기 수익률이 가장 높음 — 엔진 기준(80+) 유지, 보너스 구간으로 포지셔닝.",
    }
  }
  return {
    code: "A",
    label: "현재 구조 유지",
    rationale:
      "구간 분포·수익률 프로파일이 YDS 사이클 엔진 설계와 대체로 일치. V1은 UI·철학 정렬 우선, 엔진·구간 경계는 유지.",
  }
}

// --- main ---
const spyArg = process.argv.find((a) => a.startsWith("--spy="))?.split("=")[1]
const spyPath = spyArg ?? join(__dirname, ".cache", "gspc-daily.json")

const merged = mergeYdsSourceHistory([])
const steps = pickYdsWeeklySteps(merged)
const first = rowDateKey(merged[0])
const last = rowDateKey(merged[merged.length - 1])
const spanYears =
  first && last
    ? (new Date(`${last}T12:00:00`).getTime() - new Date(`${first}T12:00:00`).getTime()) /
      (365.25 * 86_400_000)
    : 0

const dwellCalendar = analyzeDwellByCalendarDays(merged)
const distribution = analyzeYdsScoreDistributionWindows(merged)
const entries = findZoneEntries(steps)
const fwdProxy = analyzeForwardReturnsProxy(steps, entries)
const spyPrices = loadSpyPrices(spyPath)
const fwdSpy = analyzeForwardReturnsSpy(spyPrices, entries)
const rec = recommend(dwellCalendar, fwdSpy, fwdProxy)

/** Per-anchor scores for audit table */
const anchorScores = merged.map((row) => {
  const s = scoreRow(row)
  return { date: rowDateKey(row), score: s?.score ?? null, stage: s?.stageId ?? null }
})

const opportunityEntries = entries.filter((e) =>
  ["interest", "dca", "panicBuy"].includes(e.stageId),
)

const result = {
  generatedAt: new Date().toISOString(),
  methodology: {
    engine: "getFinalScore (legacy, unmodified)",
    zones: MACRO_V1_STATUS_BANDS.map((b) => ({ id: b.id, min: b.min, max: b.max, label: b.label })),
    dataSource: "PANIC_VALIDATION_EXTENDED_HISTORY (monthly anchors 2019–2026)",
    anchorCount: merged.length,
    weeklySteps: steps.length,
    spanYears: Math.round(spanYears * 10) / 10,
    period: { first, last },
    dwellMethod: "calendar-day weight between consecutive anchors",
    forwardReturnMethods: {
      proxy: "estimateYdsMarketPeriodReturn (VIX/F&G proxy, same as validation page)",
      spy: spyPrices ? `^GSPC daily (${Object.keys(spyPrices).length} days from ${spyPath})` : "not loaded",
    },
    limitations: [
      "Monthly anchors (~35 points) — not full daily Supabase history",
      "Dwell % is interpolated between anchors, not exchange-calendar trading days",
      "Zone entry = stage transition on weekly steps",
      "Supabase daily export would refine all figures",
    ],
  },
  dwellPct: dwellCalendar.pct,
  dwellDays: dwellCalendar.days,
  distributionAll: distribution.all.stageStats,
  zoneEntries: entries,
  opportunityEntryCount: opportunityEntries.length,
  forwardReturnsProxy: fwdProxy,
  forwardReturnsSpy: fwdSpy,
  anchorScores,
  recommendation: rec,
}

mkdirSync(join(ROOT, "docs"), { recursive: true })
mkdirSync(join(__dirname, ".cache"), { recursive: true })
const outJson = join(__dirname, ".cache", "yds-cycle-validation-result.json")
writeFileSync(outJson, JSON.stringify(result, null, 2))

console.log("YDS Cycle Validation Study")
console.log("Period:", first, "→", last, `(${spanYears.toFixed(1)}y, ${merged.length} anchors)`)
console.log("\n--- Zone dwell (calendar-day weighted) ---")
for (const id of STAGE_ORDER) {
  console.log(`${STAGE_LABEL[id]}: ${dwellCalendar.pct[id].toFixed(1)}%`)
}
console.log("\n--- Forward returns on zone ENTRY (proxy) ---")
for (const id of ["interest", "dca", "panicBuy"]) {
  const f = fwdProxy[id]
  console.log(
    `${STAGE_LABEL[id]}: entries=${f.entryCount} | 1M ${fmtPct(f.m1)} | 3M ${fmtPct(f.m3)} | 6M ${fmtPct(f.m6)} | 12M ${fmtPct(f.m12)}`,
  )
}
if (fwdSpy) {
  console.log("\n--- Forward returns on zone ENTRY (^GSPC) ---")
  for (const id of ["interest", "dca", "panicBuy"]) {
    const f = fwdSpy[id]
    console.log(
      `${STAGE_LABEL[id]}: entries=${f.entryCount} | 1M ${fmtPct(f.m1)} | 3M ${fmtPct(f.m3)} | 6M ${fmtPct(f.m6)} | 12M ${fmtPct(f.m12)}`,
    )
  }
}
console.log(`\nRecommendation: ${rec.code}. ${rec.label}`)
console.log(`JSON: ${outJson}`)
