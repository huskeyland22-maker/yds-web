/**
 * US single-stock correction-path study v1 (research only).
 *
 * Episode start, +10% arm, prior peak, T0, and the 60-session window
 * are the ETF v1–v6 definitions. Only the price series changes.
 * No sell rule is selected.
 */

import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./equity-sell-research-universe.mjs"
import { FORWARD_DAYS, buildSellEvents, median } from "./etf-sell-backtest.mjs"
import { describeCorrection, locateProfitCorrection } from "./etf-sell-backtest-v6.mjs"

export { FORWARD_DAYS, EQUITY_SELL_RESEARCH_UNIVERSE }

export const SELECTED_STRATEGY = null
export const PROFIT_ARM = 0.1
export const CORRECTION_DEPTHS = [0.05, 0.07, 0.1, 0.15, 0.2]
export const SMALL_SAMPLE = 10
export const NO_CONCLUSION_N = 5

export const EQUITY_SELL_RESEARCH_THEMES = [
  { id: "ai_semi", label: "AI/반도체", symbols: ["NVDA", "AMD", "AVGO", "MU", "TSM", "AMAT", "ASML", "LRCX", "KLAC", "SNPS"] },
  { id: "cloud_software", label: "클라우드/소프트웨어", symbols: ["MSFT", "AMZN", "GOOGL", "ORCL", "PLTR"] },
  { id: "datacenter_network", label: "데이터센터/네트워크", symbols: ["ANET", "VRT"] },
  { id: "power_infra", label: "전력/인프라", symbols: ["CEG", "VST", "ETN", "GEV", "PWR", "FCX"] },
  { id: "cyber", label: "사이버보안", symbols: ["PANW", "FTNT", "CRWD"] },
  { id: "robotics", label: "로봇/자동화", symbols: ["TSLA", "ISRG"] },
  { id: "healthcare", label: "헬스케어", symbols: ["LLY", "ISRG"] },
  { id: "payments", label: "금융/결제", symbols: ["V"] },
  { id: "consumer", label: "소비자/플랫폼", symbols: ["AAPL"] },
]

const THEME_BY_SYMBOL = new Map()
for (const theme of EQUITY_SELL_RESEARCH_THEMES) {
  for (const symbol of theme.symbols) {
    const labels = THEME_BY_SYMBOL.get(symbol) ?? []
    labels.push(theme.label)
    THEME_BY_SYMBOL.set(symbol, labels)
  }
}

export function themesFor(symbol) {
  return THEME_BY_SYMBOL.get(symbol) ?? []
}

export function sampleJudgment(n) {
  if (n < NO_CONCLUSION_N) return "no_conclusion"
  if (n < SMALL_SAMPLE) return "withhold"
  return "limited"
}

function round2(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

function pct(fraction) {
  if (fraction == null || !Number.isFinite(fraction)) return null
  return round2(fraction * 100)
}

function mean(values) {
  const xs = values.filter((value) => Number.isFinite(value))
  if (!xs.length) return null
  return xs.reduce((sum, value) => sum + value, 0) / xs.length
}

function stdev(values) {
  const xs = values.filter((value) => Number.isFinite(value))
  if (xs.length < 2) return null
  const avg = mean(xs)
  const variance = xs.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (xs.length - 1)
  return Math.sqrt(variance)
}

function share(flags) {
  if (!flags.length) return null
  return (flags.filter(Boolean).length / flags.length) * 100
}

function depthKey(depth) {
  return `d${Math.round(depth * 100)}`
}

function point(described, key) {
  const quote = described.horizons?.[key]
  if (!quote) return null
  return { vsEntry: quote.vsEntry, vsT0: quote.vsT0 }
}

export function correctionRecord({ symbol, themes, rows, event, depth, described }) {
  if (!described?.event) return null
  const dateAt = (index) => (index == null ? null : rows[index]?.date ?? null)
  return {
    ticker: symbol,
    themes,
    episodeStart: event.signalDate,
    entryPrice: event.entryPrice,
    plus10Date: dateAt(described.armIdx),
    priorHighDate: dateAt(described.peakIdx),
    priorHighClose: described.peak,
    t0Date: dateAt(described.t0),
    t0Close: described.t0Price,
    correctionDepth: depth,
    t0Return: described.t0VsEntry,
    t5: point(described, "t5"),
    t10: point(described, "t10"),
    t20: point(described, "t20"),
    t40: point(described, "t40"),
    windowEnd: point(described, "windowEnd"),
    entryRecovered: described.recoveredEntry === true,
    peakRecovered: described.peakRecovered === true,
    additionalDrawdown: described.hasAfter ? described.additionalDrawdown : null,
    maxDrawdown: described.maxDrawdownFromPeak,
  }
}

function horizonStats(records, key) {
  const present = records.filter((row) => row[key])
  const vsEntry = present.map((row) => row[key].vsEntry)
  const vsT0 = present.map((row) => row[key].vsT0)
  return {
    n: present.length,
    avgVsEntry: pct(mean(vsEntry)),
    medianVsEntry: pct(median(vsEntry)),
    avgVsT0: pct(mean(vsT0)),
    medianVsT0: pct(median(vsT0)),
    winRate: round2(share(vsEntry.map((value) => value > 0))),
    stdevVsEntry: pct(stdev(vsEntry)),
    judgment: sampleJudgment(present.length),
  }
}

export function summarizeCorrections(records) {
  const rows = records.filter(Boolean)
  const extra = rows.map((row) => row.additionalDrawdown).filter((value) => Number.isFinite(value))
  const t0 = rows.map((row) => row.t0Return)
  return {
    n: rows.length,
    judgment: sampleJudgment(rows.length),
    t0Avg: pct(mean(t0)),
    t0Median: pct(median(t0)),
    t5: horizonStats(rows, "t5"),
    t10: horizonStats(rows, "t10"),
    t20: horizonStats(rows, "t20"),
    t40: horizonStats(rows, "t40"),
    windowEnd: horizonStats(rows, "windowEnd"),
    entryRecoveryRate: round2(share(rows.map((row) => row.entryRecovered))),
    peakRecoveryRate: round2(share(rows.map((row) => row.peakRecovered))),
    avgAdditionalDrawdown: pct(mean(extra)),
    medianAdditionalDrawdown: pct(median(extra)),
    maxAdditionalDrawdown: pct(extra.length ? Math.max(...extra) : null),
    windowEndStdev: pct(stdev(rows.map((row) => row.windowEnd?.vsEntry).filter((value) => Number.isFinite(value)))),
  }
}

export function analyzeEquityPath(symbol, rows, themes = themesFor(symbol)) {
  const safeRows = Array.isArray(rows) ? rows : []
  const built = safeRows.length ? buildSellEvents(safeRows, FORWARD_DAYS) : { episodes: [], events: [], incomplete: 0 }
  const closes = safeRows.map((row) => row.close)
  const corrections = {}
  for (const depth of CORRECTION_DEPTHS) {
    const records = []
    for (const event of built.events) {
      const located = locateProfitCorrection(closes, event.entryIdx, FORWARD_DAYS, PROFIT_ARM, depth)
      const record = correctionRecord({
        symbol,
        themes,
        rows: safeRows,
        event,
        depth,
        described: describeCorrection(closes, located),
      })
      if (record) records.push(record)
    }
    corrections[depthKey(depth)] = records
  }
  const reached10 = built.events.filter((event) => event.hit10).length
  return {
    symbol,
    name: EQUITY_SELL_RESEARCH_UNIVERSE.find((row) => row.symbol === symbol)?.name ?? null,
    themes,
    dataStart: safeRows[0]?.date ?? null,
    dataEnd: safeRows.at(-1)?.date ?? null,
    bars: safeRows.length,
    episodeStarts: built.episodes.length,
    fullWindowEpisodes: built.events.length,
    incompleteEpisodes: built.incomplete,
    reached10,
    depthCounts: Object.fromEntries(CORRECTION_DEPTHS.map((depth) => [depthKey(depth), corrections[depthKey(depth)].length])),
    corrections,
  }
}

export function poolEquityPaths(parts) {
  const pooled = {}
  for (const depth of CORRECTION_DEPTHS) {
    const key = depthKey(depth)
    pooled[key] = summarizeCorrections(parts.flatMap((part) => part.corrections[key]))
  }
  return pooled
}

export function summarizeThemes(parts, depth = 0.1) {
  const key = depthKey(depth)
  const records = parts.flatMap((part) => part.corrections[key])
  return EQUITY_SELL_RESEARCH_THEMES.map((theme) => {
    const allowed = new Set(theme.symbols)
    const mine = records.filter((row) => allowed.has(row.ticker))
    return {
      id: theme.id,
      label: theme.label,
      symbols: theme.symbols,
      ...summarizeCorrections(mine),
    }
  })
}

export function uniqueEventCount(records) {
  return new Set(records.map((row) => `${row.ticker}|${row.episodeStart}|${row.t0Date}|${row.correctionDepth}`)).size
}
