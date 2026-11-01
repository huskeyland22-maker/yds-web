/**
 * ETF DBB actual-signal tracker v1 (research only).
 *
 * Reads the frozen production evaluator. Does not change thresholds,
 * stage rules, trade records, or the screen episode store.
 */
import {
  DAILY_BOTTOM_BUY_ETFS,
  DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1,
  DAILY_BOTTOM_BUY_WATCHLIST,
  DAILY_BOTTOM_THRESHOLDS,
  evaluateBars,
  rsiWilderSeries,
  stageFromCount,
} from "../../api/_lib/dailyBottomBuyEngine.js"

export {
  DAILY_BOTTOM_BUY_ETFS,
  DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1,
  DAILY_BOTTOM_BUY_WATCHLIST,
  DAILY_BOTTOM_THRESHOLDS,
  evaluateBars,
  stageFromCount,
}

export const TRACK_VERSION = 1
export const HORIZONS = [20, 60, 120]
export const SIGNAL_MIN_COUNT = 3

export const TRACK_BASIS = {
  universe:
    "ETF 제품 관찰 목록 6개(SMH·GRID·IGV·BOTZ·CIBR·VOO). 과거 매도·검증 연구 유니버스 9개는 DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1로 동결. 개별주식 연구 대상 31개는 바꾸지 않는다.",
  signal:
    "종목별로 매수 조건 3개 이상을 처음 충족한 거래일을 신호 발생일로 기록한다. 연속으로 3개 이상이 유지되면 같은 에피소드이고, 3개 미만으로 내려간 뒤 다시 3개 이상이 되면 새 에피소드다.",
  entry: "진입 가격은 신호 발생 다음 거래일의 시가다. 그 시가를 아직 확인할 수 없으면 미확정이다.",
  priceReturn:
    "가격 수익률은 진입 시가 대비 20·60·120거래일 뒤 종가다. 평가 기간이 지나지 않았으면 미완료이며 0%로 두지 않는다.",
  drawdown: "최대 하락폭은 그 기간의 일중 저가 가운데 진입 시가 대비 가장 큰 하락이다.",
  recovery: "진입 가격 회복은 진입일 이후 종가가 진입 시가 이상이 되기까지 걸린 거래일 수다. 아직 회복하지 않았으면 0일로 두지 않는다.",
  totalReturn: "총수익률은 분배금을 포함한 수익률이다. 분배금 데이터가 없으면 추정하지 않고 산출 불가다.",
  missing: "데이터가 없거나 조회에 실패했거나 지표가 빠지면 신호로 기록하지 않고 0/4로 간주하지 않는다.",
}

function round1(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 10) / 10
}

function round3(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 1000) / 1000
}

function round2(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 100) / 100
}

function pct(fraction) {
  if (fraction == null || !Number.isFinite(fraction)) return null
  return round2(fraction * 100)
}

function barComplete(bar) {
  if (!bar || typeof bar.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(bar.date)) return false
  for (const key of ["open", "high", "low", "close"]) {
    const n = Number(bar[key])
    if (!Number.isFinite(n) || !(n > 0)) return false
  }
  return true
}

function smaOfNullable(values, period) {
  const out = new Array(values.length).fill(null)
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0
    let ok = true
    for (let j = i - period + 1; j <= i; j++) {
      if (values[j] == null || !Number.isFinite(values[j])) {
        ok = false
        break
      }
      sum += values[j]
    }
    if (ok) out[i] = sum / period
  }
  return out
}

function stochasticKSeries(bars, kPeriod = 14, kSmooth = 3) {
  const n = bars.length
  const rawK = new Array(n).fill(null)
  for (let i = kPeriod - 1; i < n; i++) {
    let hh = -Infinity
    let ll = Infinity
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (bars[j].high > hh) hh = bars[j].high
      if (bars[j].low < ll) ll = bars[j].low
    }
    const range = hh - ll
    rawK[i] = range <= 0 ? 50 : ((bars[i].close - ll) / range) * 100
  }
  return smaOfNullable(rawK, kSmooth)
}

function bollingerPctBSeries(closes, period = 20, mult = 2) {
  const out = new Array(closes.length).fill(null)
  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += closes[j]
    const mean = sum / period
    let varSum = 0
    for (let j = i - period + 1; j <= i; j++) {
      const d = closes[j] - mean
      varSum += d * d
    }
    const std = Math.sqrt(varSum / period)
    const upper = mean + mult * std
    const lower = mean - mult * std
    const width = upper - lower
    if (width <= 0) out[i] = 0.5
    else out[i] = (closes[i] - lower) / width
  }
  return out
}

function ma20DevPctSeries(closes, period = 20) {
  const out = new Array(closes.length).fill(null)
  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += closes[j]
    const ma = sum / period
    if (!(ma > 0)) continue
    out[i] = ((closes[i] - ma) / ma) * 100
  }
  return out
}

function incompleteDay(index, date, reason) {
  return { index, date: date ?? null, ok: false, reason }
}

/**
 * Score every bar with the production indicator definitions.
 * A failed or incomplete day has no count.
 * @param {Array<{ date?: string, open: number, high: number, low: number, close: number }>} bars
 */
export function scoreBars(bars, thresholds = DAILY_BOTTOM_THRESHOLDS) {
  const series = bars || []
  const scored = series.map((bar, index) =>
    incompleteDay(index, typeof bar?.date === "string" ? bar.date : null, "missing_bar"),
  )
  let i = 0
  while (i < series.length) {
    if (!barComplete(series[i])) {
      scored[i] = incompleteDay(i, series[i]?.date ?? null, "missing_bar")
      i += 1
      continue
    }
    if (i > 0 && barComplete(series[i - 1]) && !(series[i].date > series[i - 1].date)) {
      scored[i] = incompleteDay(i, series[i].date, "duplicate_date")
      i += 1
      continue
    }
    let end = i + 1
    while (end < series.length && barComplete(series[end]) && series[end].date > series[end - 1].date) end += 1
    const part = scoreCompleteSegment(series.slice(i, end), thresholds)
    for (let k = 0; k < part.length; k++) scored[i + k] = { ...part[k], index: i + k }
    i = end
  }
  return scored
}

function scoreCompleteSegment(bars, thresholds) {
  const closes = bars.map((bar) => bar.close)
  const rsi = rsiWilderSeries(closes, 14)
  const stoch = stochasticKSeries(bars)
  const bb = bollingerPctBSeries(closes)
  const ma = ma20DevPctSeries(closes)
  return bars.map((bar, index) => {
    if (bars.length < 25 || index < 24) {
      return incompleteDay(index, bar.date, "insufficient_bars")
    }
    const raw = {
      rsi14: rsi[index],
      stochK: stoch[index],
      bbPctB: bb[index],
      ma20DevPct: ma[index],
    }
    if (Object.values(raw).some((value) => value == null || !Number.isFinite(value))) {
      return incompleteDay(index, bar.date, "missing_indicator")
    }
    const flags = {
      rsi: raw.rsi14 <= thresholds.rsiMax,
      stoch: raw.stochK <= thresholds.stochKMax,
      bb: raw.bbPctB <= thresholds.bbPctBMax,
      ma20: raw.ma20DevPct <= thresholds.ma20DevMax,
    }
    const count = [flags.rsi, flags.stoch, flags.bb, flags.ma20].filter(Boolean).length
    return {
      index,
      date: bar.date,
      ok: true,
      close: bar.close,
      count,
      flags,
      rsi14: round1(raw.rsi14),
      stochK: round1(raw.stochK),
      bbPctB: round3(raw.bbPctB),
      ma20DevPct: round1(raw.ma20DevPct),
    }
  })
}

function horizonShell(tradingDays, priceReturnStatus, maxDrawdownStatus) {
  const priceReturnPct = null
  const maxDrawdownPct = null
  return {
    tradingDays,
    status: priceReturnStatus === "complete" && maxDrawdownStatus === "complete" ? "complete" : "incomplete",
    priceReturnPct,
    priceReturnStatus,
    totalReturnPct: null,
    totalReturnStatus: "unavailable",
    maxDrawdownPct,
    maxDrawdownStatus,
    pnl: null,
  }
}

function pnlFromReturn(priceReturnPct) {
  if (priceReturnPct == null || !Number.isFinite(priceReturnPct)) return null
  if (priceReturnPct > 0) return "profit"
  if (priceReturnPct < 0) return "loss"
  return "flat"
}

function totalReturnPct(bars, entryIdx, endIdx, entryPrice) {
  const entry = bars[entryIdx]
  const end = bars[endIdx]
  const entryAdj = Number(entry?.adjClose)
  const endAdj = Number(end?.adjClose)
  const entryClose = Number(entry?.close)
  if (![entryAdj, endAdj, entryClose, entryPrice].every((value) => Number.isFinite(value) && value > 0)) {
    return { totalReturnPct: null, totalReturnStatus: "unavailable" }
  }
  const adjustedEntry = entryPrice * (entryAdj / entryClose)
  if (!(adjustedEntry > 0)) return { totalReturnPct: null, totalReturnStatus: "unavailable" }
  return {
    totalReturnPct: pct((endAdj - adjustedEntry) / adjustedEntry),
    totalReturnStatus: "complete",
  }
}

/**
 * Price path after a confirmed entry. Incomplete horizons stay null.
 * @param {Array<{ open: number, high: number, low: number, close: number, adjClose?: number }>} bars
 */
export function measureEntry(bars, entryIdx, entryPrice) {
  const horizons = {}
  for (const tradingDays of HORIZONS) {
    const endIdx = entryIdx + tradingDays
    if (!Number.isFinite(entryPrice) || !(entryPrice > 0) || endIdx >= bars.length) {
      horizons[String(tradingDays)] = horizonShell(tradingDays, "incomplete", "incomplete")
      continue
    }
    const end = bars[endIdx]
    const endClose = Number(end?.close)
    const priceOk = Number.isFinite(endClose) && endClose > 0
    let lowOk = true
    let minLow = Infinity
    for (let j = entryIdx; j <= endIdx; j++) {
      const low = Number(bars[j]?.low)
      if (!Number.isFinite(low) || !(low > 0)) {
        lowOk = false
        break
      }
      if (low < minLow) minLow = low
    }
    const priceReturnPct = priceOk ? pct((endClose - entryPrice) / entryPrice) : null
    const maxDrawdownPct = lowOk ? pct(Math.max(0, (entryPrice - minLow) / entryPrice)) : null
    const total = totalReturnPct(bars, entryIdx, endIdx, entryPrice)
    horizons[String(tradingDays)] = {
      tradingDays,
      status: priceOk && lowOk ? "complete" : "incomplete",
      priceReturnPct,
      priceReturnStatus: priceOk ? "complete" : "incomplete",
      totalReturnPct: total.totalReturnPct,
      totalReturnStatus: total.totalReturnStatus,
      maxDrawdownPct,
      maxDrawdownStatus: lowOk ? "complete" : "incomplete",
      pnl: pnlFromReturn(priceReturnPct),
    }
  }
  return { horizons, recovery: measureRecovery(bars, entryIdx, entryPrice) }
}

function measureRecovery(bars, entryIdx, entryPrice) {
  if (!Number.isFinite(entryPrice) || !(entryPrice > 0) || entryIdx < 0 || entryIdx >= bars.length) {
    return { status: "unavailable", tradingDays: null }
  }
  for (let j = entryIdx; j < bars.length; j++) {
    const close = Number(bars[j]?.close)
    if (!Number.isFinite(close) || !(close > 0)) {
      return { status: "incomplete", tradingDays: null }
    }
    if (close + 1e-9 >= entryPrice) {
      return { status: "recovered", tradingDays: j - entryIdx }
    }
  }
  return { status: "open", tradingDays: null }
}

function pendingMeasurement() {
  const measured = measureEntry([], 0, null)
  return {
    horizons: measured.horizons,
    recovery: { status: "unavailable", tradingDays: null },
  }
}

function materialize(meta, bars, scored, signalIdx, closed, closedDate) {
  const day = scored[signalIdx]
  const stage = stageFromCount(day.count)
  const next = bars[signalIdx + 1]
  const entryOk = barComplete(next)
  const measured = entryOk ? measureEntry(bars, signalIdx + 1, Number(next.open)) : pendingMeasurement()
  const lastOk = [...scored].reverse().find((row) => row.ok)
  return {
    id: `${meta.symbol}:${day.date}`,
    symbol: meta.symbol,
    theme: meta.theme,
    themeShort: meta.themeShort || meta.theme,
    role: meta.role || null,
    origin: lastOk && day.date === lastOk.date ? "new" : "historical",
    provisional: false,
    closed,
    closedDate: closed ? closedDate : null,
    signalDate: day.date,
    asOfDate: day.date,
    close: day.close,
    count: day.count,
    stageId: stage.id,
    stageLabel: stage.label,
    rsi14: day.rsi14,
    stochK: day.stochK,
    bbPctB: day.bbPctB,
    ma20DevPct: day.ma20DevPct,
    flags: day.flags,
    entryStatus: entryOk ? "confirmed" : "pending",
    entryDate: entryOk ? next.date : null,
    entryPrice: entryOk ? Number(next.open) : null,
    horizons: measured.horizons,
    recovery: measured.recovery,
  }
}

/**
 * @param {{ symbol: string, theme: string, themeShort?: string, role?: string }} meta
 * @param {ReturnType<typeof scoreBars>} scored
 */
export function buildEpisodes(meta, bars, scored) {
  const episodes = []
  let signalIdx = null
  for (let i = 0; i < scored.length; i++) {
    const day = scored[i]
    if (!day?.ok) continue
    if (day.count >= SIGNAL_MIN_COUNT) {
      if (signalIdx == null) signalIdx = i
      continue
    }
    if (signalIdx != null) {
      episodes.push(materialize(meta, bars, scored, signalIdx, true, day.date))
      signalIdx = null
    }
  }
  if (signalIdx != null) episodes.push(materialize(meta, bars, scored, signalIdx, false, null))
  return episodes
}

export function trackSymbol(meta, bars, thresholds = DAILY_BOTTOM_THRESHOLDS) {
  if (!Array.isArray(bars) || bars.length === 0) {
    return { symbol: meta.symbol, ok: false, reason: "missing_series", asOfDate: null, episodes: [] }
  }
  const scored = scoreBars(bars, thresholds)
  const episodes = buildEpisodes(meta, bars, scored)
  const lastOk = [...scored].reverse().find((row) => row.ok)
  return {
    symbol: meta.symbol,
    ok: true,
    reason: null,
    bars: bars.length,
    asOfDate: lastOk?.date ?? null,
    episodes,
  }
}

export function median(values) {
  const xs = (values || []).filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  if (!xs.length) return null
  const mid = Math.floor(xs.length / 2)
  if (xs.length % 2) return xs[mid]
  return round2((xs[mid - 1] + xs[mid]) / 2)
}

export function summarizeEpisodes(episodes) {
  const list = episodes || []
  const horizons = {}
  for (const tradingDays of HORIZONS) {
    const rows = list.map((episode) => episode.horizons?.[String(tradingDays)]).filter(Boolean)
    const complete = rows.filter((row) => row.priceReturnStatus === "complete")
    horizons[String(tradingDays)] = {
      complete: complete.length,
      incomplete: rows.length - complete.length,
      medianPriceReturnPct: median(complete.map((row) => row.priceReturnPct)),
    }
  }
  return {
    episodes: list.length,
    historical: list.filter((episode) => episode.origin === "historical").length,
    newSignals: list.filter((episode) => episode.origin === "new").length,
    pendingEntry: list.filter((episode) => episode.entryStatus === "pending").length,
    horizons,
  }
}

/**
 * Keep the first copy of an episode id. A second pass adds nothing.
 */
export function mergeEpisodes(existing, incoming) {
  const seen = new Set()
  const episodes = []
  for (const episode of existing || []) {
    if (!episode?.id || seen.has(episode.id)) continue
    seen.add(episode.id)
    episodes.push(episode)
  }
  let added = 0
  for (const episode of incoming || []) {
    if (!episode?.id || seen.has(episode.id)) continue
    seen.add(episode.id)
    episodes.push(episode)
    added += 1
  }
  return { episodes, added }
}

export function buildTrackReport(watchlist, barsBySymbol, generatedAt = new Date().toISOString()) {
  const symbols = []
  const episodes = []
  for (const meta of watchlist) {
    const tracked = trackSymbol(meta, barsBySymbol?.[meta.symbol])
    symbols.push({
      symbol: meta.symbol,
      ok: tracked.ok,
      reason: tracked.reason,
      asOfDate: tracked.asOfDate,
      episodes: tracked.episodes.length,
    })
    episodes.push(...tracked.episodes)
  }
  return {
    version: TRACK_VERSION,
    researchOnly: true,
    system: "etf_signal_track_v1",
    storage: "derived_research_file",
    separateFromTradeRecords: true,
    generatedAt,
    thresholds: DAILY_BOTTOM_THRESHOLDS,
    basis: TRACK_BASIS,
    universe: watchlist.map((meta) => meta.symbol),
    researchUniverse: DAILY_BOTTOM_BUY_ETFS_RESEARCH_V1.map((meta) => meta.symbol),
    symbols,
    episodes,
    summary: summarizeEpisodes(episodes),
  }
}
