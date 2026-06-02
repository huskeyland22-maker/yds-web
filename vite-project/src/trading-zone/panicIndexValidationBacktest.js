import { cycleRowToPanicData } from "../home-v5/homeV5StrategyValidation.js"
import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { sortHistoryRowsAsc } from "../utils/panicHistoryDesk.js"
import { panicDataFromCycleRow } from "../utils/cycleHistoryUtils.js"
import { getFinalScore } from "../utils/tradingScores.js"
import { resolveMacroStageAllocation } from "./macroStageAllocation.js"
import { PANIC_VALIDATION_EXTENDED_HISTORY } from "./panicValidationExtendedHistory.js"

const MIN_YEARS = 5
const CASH_WEEKLY_DRIFT = 0.00012

/** @type {string[]} */
export const PANIC_VALIDATION_DISPLAY_YEARS = ["2022", "2023", "2024", "2025", "2026"]

/** @param {object} row */
function rowDateKey(row) {
  return String(row?.date ?? row?.ts ?? "").slice(0, 10)
}

/**
 * @param {object[]} rows
 */
export function mergePanicValidationHistory(rows) {
  const byDate = new Map()
  for (const r of [...PANIC_VALIDATION_EXTENDED_HISTORY, ...(rows ?? [])]) {
    const d = rowDateKey(r)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue
    byDate.set(d, { ...byDate.get(d), ...r, date: d, ts: `${d}T12:00:00.000Z` })
  }
  return sortHistoryRowsAsc([...byDate.values()])
}

/**
 * @param {object} prev
 * @param {object} cur
 */
function estimateMarketPeriodReturn(prev, cur) {
  const fg0 = Number(prev?.fearGreed)
  const fg1 = Number(cur?.fearGreed)
  const vix0 = Number(prev?.vix)
  const vix1 = Number(cur?.vix)
  let ret = 0
  if (Number.isFinite(fg0) && Number.isFinite(fg1)) ret += (fg1 - fg0) / 400
  if (Number.isFinite(vix0) && Number.isFinite(vix1) && vix0 > 0) ret += (vix0 - vix1) / (vix0 * 8)
  return ret
}

/**
 * @param {object[]} sortedAsc
 */
function pickWeeklySteps(sortedAsc) {
  if (!sortedAsc.length) return []
  const out = [sortedAsc[0]]
  let last = rowDateKey(sortedAsc[0])
  for (let i = 1; i < sortedAsc.length; i++) {
    const row = sortedAsc[i]
    const d = rowDateKey(row)
    if (!d) continue
    const ms =
      (new Date(`${d}T12:00:00`).getTime() - new Date(`${last}T12:00:00`).getTime()) / 86_400_000
    if (ms >= 5) {
      out.push(row)
      last = d
    }
  }
  const tail = sortedAsc[sortedAsc.length - 1]
  if (rowDateKey(tail) !== rowDateKey(out[out.length - 1])) out.push(tail)
  return out
}

/**
 * @param {object[]} historyRows
 */
export function runPanicIndexAllocationBacktest(historyRows) {
  const merged = mergePanicValidationHistory(historyRows)
  const first = rowDateKey(merged[0])
  const last = rowDateKey(merged[merged.length - 1])
  const spanYears =
    first && last
      ? (new Date(`${last}T12:00:00`).getTime() - new Date(`${first}T12:00:00`).getTime()) /
        (365.25 * 86_400_000)
      : 0

  const steps = pickWeeklySteps(merged)
  if (steps.length < 24) {
    return {
      ok: false,
      reason: "insufficient_data",
      spanYears,
      sampleWeeks: steps.length,
      yearlyReturns: [],
      yearlyComparison: [],
      avgReturnPct: null,
      mddPct: null,
      winRatePct: null,
      totalReturnPct: null,
      benchmarkReturnPct: null,
      benchmarkMddPct: null,
      benchmarkWinRatePct: null,
      usesExtendedHistory: true,
    }
  }

  let equity = 100
  let bench = 100
  let peak = 100
  let benchPeak = 100
  let mdd = 0
  let benchMdd = 0
  let wins = 0
  let benchWins = 0
  let periods = 0

  /** @type {Record<string, { start: number; end: number }>} */
  const yearEquity = {}
  /** @type {Record<string, { start: number; end: number }>} */
  const yearBench = {}

  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1]
    const cur = steps[i]
    const eqBefore = equity
    const benchBefore = bench
    const panic = cycleRowToPanicData(prev) ?? panicDataFromCycleRow(prev)
    const score = panic ? getFinalScore(panic) : null
    const regime = resolveMacroV1Status(score)
    const alloc = resolveMacroStageAllocation(regime?.id) ?? resolveMacroStageAllocation("neutral")
    const stockW = (alloc?.stockPct ?? 70) / 100
    const cashW = (alloc?.cashPct ?? 30) / 100

    const marketRet = estimateMarketPeriodReturn(prev, cur)
    const portRet = marketRet * stockW + CASH_WEEKLY_DRIFT * cashW
    const benchRet = marketRet

    equity *= 1 + portRet
    bench *= 1 + benchRet
    peak = Math.max(peak, equity)
    benchPeak = Math.max(benchPeak, bench)
    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0
    const benchDd = benchPeak > 0 ? ((benchPeak - bench) / benchPeak) * 100 : 0
    mdd = Math.max(mdd, dd)
    benchMdd = Math.max(benchMdd, benchDd)
    if (portRet > 0) wins++
    if (benchRet > 0) benchWins++
    periods++

    const y = rowDateKey(cur).slice(0, 4)
    if (!yearEquity[y]) yearEquity[y] = { start: eqBefore, end: equity }
    else yearEquity[y].end = equity
    if (!yearBench[y]) yearBench[y] = { start: benchBefore, end: bench }
    else yearBench[y].end = bench
  }

  const yearlyReturns = Object.keys(yearEquity)
    .sort()
    .map((year) => {
      const { start, end } = yearEquity[year]
      const ret = start > 0 ? ((end - start) / start) * 100 : 0
      return { year, returnPct: ret }
    })

  const yearlyComparison = PANIC_VALIDATION_DISPLAY_YEARS.map((year) => {
    const strat = yearEquity[year]
    const spy = yearBench[year]
    const strategyPct =
      strat && strat.start > 0 ? ((strat.end - strat.start) / strat.start) * 100 : null
    const spyPct = spy && spy.start > 0 ? ((spy.end - spy.start) / spy.start) * 100 : null
    return { year, strategyPct, spyPct }
  })

  const avgReturnPct = yearlyReturns.length
    ? yearlyReturns.reduce((s, y) => s + y.returnPct, 0) / yearlyReturns.length
    : null

  const totalReturnPct = ((equity - 100) / 100) * 100
  const benchmarkReturnPct = ((bench - 100) / 100) * 100
  const winRatePct = periods ? (wins / periods) * 100 : null

  return {
    ok: spanYears >= MIN_YEARS - 0.1,
    reason: spanYears >= MIN_YEARS - 0.1 ? "ok" : "short_span",
    spanYears,
    sampleWeeks: periods,
    yearlyReturns,
    yearlyComparison,
    avgReturnPct,
    mddPct: mdd,
    winRatePct,
    totalReturnPct,
    benchmarkReturnPct,
    benchmarkMddPct: benchMdd,
    benchmarkWinRatePct: periods ? (benchWins / periods) * 100 : null,
    usesExtendedHistory: true,
    periodStart: first,
    periodEnd: last,
  }
}

/**
 * 패닉매수(panicBuy) 시점 이후 시장 프록시 수익률.
 * @param {object[]} historyRows
 * @param {number} [maxEvents]
 */
export function buildPanicBuyForwardReturns(historyRows, maxEvents = 10) {
  const merged = mergePanicValidationHistory(historyRows)
  const steps = pickWeeklySteps(merged)
  if (steps.length < 8) return []

  const horizons = [
    { key: "m1", minDays: 30 },
    { key: "m3", minDays: 90 },
    { key: "m6", minDays: 180 },
    { key: "m12", minDays: 365 },
  ]

  /** @type {Array<{ date: string; score: number; returns: Record<string, number | null> }>} */
  const out = []

  for (let i = 0; i < steps.length - 1; i++) {
    const entry = steps[i]
    const panic = cycleRowToPanicData(entry) ?? panicDataFromCycleRow(entry)
    const score = panic ? getFinalScore(panic) : null
    const regime = resolveMacroV1Status(score)
    if (regime?.id !== "panicBuy") continue

    const entryDate = rowDateKey(entry)
    if (!entryDate) continue
    const entryTs = new Date(`${entryDate}T12:00:00`).getTime()

    /** @type {Record<string, number | null>} */
    const returns = { m1: null, m3: null, m6: null, m12: null }
    for (const h of horizons) {
      let growth = 1
      let found = false
      for (let j = i + 1; j < steps.length; j++) {
        const prev = steps[j - 1]
        const cur = steps[j]
        const d = rowDateKey(cur)
        if (!d) continue
        const curTs = new Date(`${d}T12:00:00`).getTime()
        growth *= 1 + estimateMarketPeriodReturn(prev, cur)
        if ((curTs - entryTs) / 86_400_000 >= h.minDays) {
          returns[h.key] = (growth - 1) * 100
          found = true
          break
        }
      }
      if (!found) returns[h.key] = null
    }

    out.push({
      date: entryDate,
      score: Number.isFinite(score) ? Math.round(Number(score)) : 0,
      returns,
    })
    if (out.length >= maxEvents) break
  }

  return out
}
