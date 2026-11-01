/**
 * DBB practical utility v10 — signal vs matched non-signal controls (research only).
 * Matching rules are fixed before reading outcomes. Does not modify v1~v9, engine, or trades.
 */
import { buildRegimeByDate, REGIME_LABEL, REGIME_ORDER, REGIME_RULE } from "../../vite-project/src/content/etfSignalRegimeV3.js"
import { bootstrapGapMedian } from "./dbb-chart-quality-v2.mjs"
import { conditionFlags } from "./daily-bottom-buy-validation-core.mjs"
import { enrichBarsWithIndicators } from "./daily-bottom-indicators.mjs"
import { FROZEN_THRESHOLDS, buildSplitBuyEpisodes } from "./daily-bottom-split-buy-sim.mjs"
import {
  HORIZONS,
  MARKET_BENCHMARK,
  TRAIN_FRACTION,
  benchmarkHorizonReturns,
  measureNextOpenEntry,
} from "./dbb-chart-quality-v1.mjs"

export const CHART_QUALITY_V10 = 10
export { HORIZONS, REGIME_ORDER, REGIME_LABEL, REGIME_RULE }
export const PRIMARY_HORIZON = 60

/**
 * Fixed before reading matched outcomes.
 * Covariates use close-as-of candidate date only (no future returns / MAE / recovery).
 */
export const MATCH_RULE = {
  purpose:
    "동일 종목·유사 국면·유사 사전 하락·변동성·QQQ 추세의 비신호일과 DBB 신호일을 비교한다. 매수 규칙은 바꾸지 않는다.",
  signal:
    "기존 rising-edge count≥3 에피소드. 진입은 다음 거래일 시가. 임계값은 FROZEN_THRESHOLDS.",
  controlEligible:
    "같은 종목에서 당일 condition count < 3 인 날. 신호 에피소드 시작일(±5거래일)은 제외.",
  regime: "QQQ 국면(ETF 신호 국면 v3) 완전 일치. 신호일·대조일 모두 종가만 사용.",
  covariates: {
    dd20: "당일 종가 / 최근 20거래일 최고가 − 1 (%). 사전 하락.",
    vol20: "최근 20거래일 일수익률 표준편차 ×100.",
    qqqRet20: "QQQ 20거래일 수익률 (%), 후보일 종가까지.",
  },
  distance: "표준화 유클리드: ((Δdd20/s_dd)^2 + (Δvol20/s_vol)^2 + (Δqqq/s_qqq)^2)^0.5. 표준편차는 학습 풀에서만 산출해 고정.",
  calipers: {
    dd20MaxAbsPp: 5,
    vol20MaxAbsPp: 2,
    qqqRet20MaxAbsPp: 5,
  },
  exclusionTradingDays: 5,
  matching:
    "학습/검증 풀을 분리한 1:1 탐욕 최근접(신호일 시간순). 대조일 재사용 없음. 캘리퍼 밖이면 미매칭.",
  noOutcomeInMatch: "미래 수익률·MAE·회복을 거리·선택에 쓰지 않는다.",
  split: "v1 trainEndDate / validationStartDate를 그대로 사용. 매칭 규칙을 검증 후 바꾸지 않는다.",
  bootstrap: "매칭 쌍을 신호일 날짜 그룹으로 묶어 중앙값 차이를 재표본. CI가 0을 포함하면 확정하지 않는다.",
  incomplete: "미완성 수익률을 0%나 실패로 채우지 않는다.",
  smallSample: 30,
  noCherryPick: "보조 분석(3/4개·국면) 중 유리한 것만 골라 핵심 결론으로 쓰지 않는다.",
}

export const VERDICT_LEVELS = ["효용 가능성", "효용 미입증", "위험 개선과 수익 개선 불일치", "판정 보류"]

function finite(value) {
  return value != null && Number.isFinite(Number(value))
}

function round2(value) {
  if (!finite(value)) return null
  return Math.round(Number(value) * 100) / 100
}

function mean(values) {
  const xs = (values || []).filter(finite).map(Number)
  if (!xs.length) return null
  return round2(xs.reduce((sum, value) => sum + value, 0) / xs.length)
}

function median(values) {
  const xs = (values || []).filter(finite).map(Number).sort((a, b) => a - b)
  if (!xs.length) return null
  const mid = Math.floor(xs.length / 2)
  if (xs.length % 2) return xs[mid]
  return round2((xs[mid - 1] + xs[mid]) / 2)
}

function stdev(values) {
  const xs = (values || []).filter(finite).map(Number)
  if (xs.length < 2) return null
  const avg = xs.reduce((sum, value) => sum + value, 0) / xs.length
  const varSum = xs.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (xs.length - 1)
  return Math.sqrt(varSum)
}

function percentile(values, p) {
  const xs = (values || []).filter(finite).map(Number).sort((a, b) => a - b)
  if (!xs.length) return null
  const idx = Math.min(xs.length - 1, Math.max(0, Math.floor((p / 100) * xs.length)))
  return xs[idx]
}

function maxHigh(bars, endIdx, window) {
  let hi = -Infinity
  const start = Math.max(0, endIdx - window + 1)
  for (let i = start; i <= endIdx; i++) {
    const high = Number(bars[i]?.high)
    if (finite(high) && high > hi) hi = high
  }
  return hi > 0 && Number.isFinite(hi) ? hi : null
}

/** Pre-observable features at bar index (inclusive). */
export function featureAt(bars, idx, qqqByDate, regimeByDate) {
  if (idx < 19 || idx >= bars.length) return null
  const close = Number(bars[idx].close)
  if (!finite(close) || !(close > 0)) return null
  const hi20 = maxHigh(bars, idx, 20)
  if (!finite(hi20) || !(hi20 > 0)) return null
  const dd20 = ((close / hi20) - 1) * 100

  const rets = []
  for (let i = idx - 19; i <= idx; i++) {
    const c0 = Number(bars[i - 1]?.close)
    const c1 = Number(bars[i]?.close)
    if (!finite(c0) || !finite(c1) || !(c0 > 0)) return null
    rets.push((c1 / c0 - 1) * 100)
  }
  const vol20 = stdev(rets)
  if (!finite(vol20)) return null

  const date = bars[idx].date
  const qqqClose = qqqByDate.get(date)
  // find QQQ close 20 trading days earlier via sorted dates map helper
  const qqqRet20 = qqqRetThrough(qqqByDate, date, 20)
  if (!finite(qqqRet20)) return null

  const regime = regimeByDate.get(date) || "unclassified"
  const flags = conditionFlags(bars[idx], FROZEN_THRESHOLDS)
  return {
    date,
    idx,
    dd20: round2(dd20),
    vol20: round2(vol20),
    qqqRet20: round2(qqqRet20),
    regime,
    count: flags.count,
    qqqClose: finite(qqqClose) ? qqqClose : null,
  }
}

/**
 * QQQ return over `days` trading steps ending on `date` (close-to-close).
 * Uses only dates <= date present in the map.
 */
export function qqqRetThrough(qqqByDate, date, days = 20) {
  if (!qqqByDate?.size || !date) return null
  const dates = [...qqqByDate.keys()].filter((d) => d <= date).sort()
  if (dates.length < days + 1) return null
  const endDate = dates[dates.length - 1]
  if (endDate !== date) return null
  const startDate = dates[dates.length - 1 - days]
  const c0 = qqqByDate.get(startDate)
  const c1 = qqqByDate.get(endDate)
  if (!finite(c0) || !finite(c1) || !(c0 > 0)) return null
  return ((c1 / c0) - 1) * 100
}

export function matchDistance(signalFeat, controlFeat, scales) {
  if (!signalFeat || !controlFeat) return null
  if (signalFeat.regime !== controlFeat.regime) return null
  const dDd = Math.abs(signalFeat.dd20 - controlFeat.dd20)
  const dVol = Math.abs(signalFeat.vol20 - controlFeat.vol20)
  const dQ = Math.abs(signalFeat.qqqRet20 - controlFeat.qqqRet20)
  const cap = MATCH_RULE.calipers
  if (dDd > cap.dd20MaxAbsPp || dVol > cap.vol20MaxAbsPp || dQ > cap.qqqRet20MaxAbsPp) return null
  const sDd = scales.dd20 > 0 ? scales.dd20 : 1
  const sVol = scales.vol20 > 0 ? scales.vol20 : 1
  const sQ = scales.qqqRet20 > 0 ? scales.qqqRet20 : 1
  return Math.sqrt((dDd / sDd) ** 2 + (dVol / sVol) ** 2 + (dQ / sQ) ** 2)
}

function buildQqqCloseMap(qqqBars) {
  const map = new Map()
  for (const bar of qqqBars || []) {
    const close = Number(bar?.close)
    if (typeof bar?.date === "string" && finite(close) && close > 0) map.set(bar.date, close)
  }
  return map
}

function episodeStartIdxSet(enriched) {
  const episodes = buildSplitBuyEpisodes(enriched, FROZEN_THRESHOLDS, { fromIdx: 0, toIdx: enriched.length })
  const set = new Set()
  for (const ep of episodes) {
    if (Number.isFinite(ep.openIdx)) set.add(ep.openIdx)
  }
  return set
}

function nearEpisode(idx, episodeIdxs, window) {
  for (const epIdx of episodeIdxs) {
    if (Math.abs(epIdx - idx) <= window) return true
  }
  return false
}

/**
 * Build control candidates for one symbol.
 */
export function buildControlCandidates(enriched, qqqByDate, regimeByDate) {
  const episodeIdxs = [...episodeStartIdxSet(enriched)]
  const window = MATCH_RULE.exclusionTradingDays
  const candidates = []
  for (let i = 20; i < enriched.length - 1; i++) {
    const feat = featureAt(enriched, i, qqqByDate, regimeByDate)
    if (!feat) continue
    if (feat.count >= 3) continue
    if (nearEpisode(i, episodeIdxs, window)) continue
    candidates.push(feat)
  }
  return { candidates, episodeIdxs, episodeCount: episodeIdxs.length }
}

function summarizeCovariates(features) {
  const pick = (key) => (features || []).map((f) => f?.[key]).filter(finite)
  return {
    n: features?.length ?? 0,
    dd20: { mean: mean(pick("dd20")), median: median(pick("dd20")) },
    vol20: { mean: mean(pick("vol20")), median: median(pick("vol20")) },
    qqqRet20: { mean: mean(pick("qqqRet20")), median: median(pick("qqqRet20")) },
  }
}

function outcomeSummary(rows, days = PRIMARY_HORIZON, side = "signal") {
  const list = rows || []
  const key = side === "signal" ? "signalHorizons" : "controlHorizons"
  const returns = []
  const mae = []
  const excess = []
  let incomplete = 0
  for (const row of list) {
    const h = row?.[key]?.[String(days)]
    if (h?.priceReturnStatus !== "complete" || !finite(h.priceReturnPct)) {
      incomplete += 1
      continue
    }
    returns.push(Number(h.priceReturnPct))
    if (h?.maxDrawdownStatus === "complete" && finite(h.maxDrawdownPct)) mae.push(Number(h.maxDrawdownPct))
    if (finite(h.excessQqqPct)) excess.push(Number(h.excessQqqPct))
  }
  const wins = returns.filter((value) => value > 0)
  const losses = returns.filter((value) => value < 0)
  const zeros = returns.filter((value) => value === 0)
  return {
    n: list.length,
    complete: returns.length,
    incomplete,
    successRate: returns.length ? round2((wins.length / returns.length) * 100) : null,
    successCount: wins.length,
    lossCount: losses.length,
    zeroCount: zeros.length,
    priceMean: mean(returns),
    priceMedian: median(returns),
    p10: percentile(returns, 10),
    p25: percentile(returns, 25),
    p75: percentile(returns, 75),
    maeMedian: median(mae),
    deepLoss10Rate: returns.length
      ? round2((returns.filter((value) => value <= -10).length / returns.length) * 100)
      : null,
    excessQqqMedian: median(excess),
  }
}

function pairedDiffs(pairs, days = PRIMARY_HORIZON) {
  const returnGaps = []
  const successGaps = []
  const maeGaps = []
  const excessGaps = []
  let completePairs = 0
  for (const pair of pairs || []) {
    const s = pair.signalHorizons?.[String(days)]
    const c = pair.controlHorizons?.[String(days)]
    if (s?.priceReturnStatus !== "complete" || c?.priceReturnStatus !== "complete") continue
    if (!finite(s.priceReturnPct) || !finite(c.priceReturnPct)) continue
    completePairs += 1
    returnGaps.push(round2(Number(s.priceReturnPct) - Number(c.priceReturnPct)))
    const sWin = Number(s.priceReturnPct) > 0 ? 1 : 0
    const cWin = Number(c.priceReturnPct) > 0 ? 1 : 0
    successGaps.push(sWin - cWin)
    if (s.maxDrawdownStatus === "complete" && c.maxDrawdownStatus === "complete" && finite(s.maxDrawdownPct) && finite(c.maxDrawdownPct)) {
      maeGaps.push(round2(Number(s.maxDrawdownPct) - Number(c.maxDrawdownPct)))
    }
    if (finite(s.excessQqqPct) && finite(c.excessQqqPct)) {
      excessGaps.push(round2(Number(s.excessQqqPct) - Number(c.excessQqqPct)))
    }
  }
  return {
    completePairs,
    returnMean: mean(returnGaps),
    returnMedian: median(returnGaps),
    successRatePp:
      completePairs > 0
        ? round2(
            ((pairs.filter((p) => {
              const s = p.signalHorizons?.[String(days)]
              return s?.priceReturnStatus === "complete" && Number(s.priceReturnPct) > 0
            }).length /
              completePairs) *
              100) -
              ((pairs.filter((p) => {
                const c = p.controlHorizons?.[String(days)]
                return c?.priceReturnStatus === "complete" && Number(c.priceReturnPct) > 0
              }).length /
                completePairs) *
                100),
          )
        : null,
    maeMedian: median(maeGaps),
    excessMedian: median(excessGaps),
  }
}

/**
 * Date-clustered bootstrap on paired return gaps (signalDate groups).
 */
export function sameDayPairedGaps(pairs, days = PRIMARY_HORIZON) {
  const byDate = new Map()
  for (const pair of pairs || []) {
    if (!pair.signalDate) continue
    if (!byDate.has(pair.signalDate)) byDate.set(pair.signalDate, [])
    byDate.get(pair.signalDate).push(pair)
  }
  const dateGaps = []
  let pairedDates = 0
  for (const [, group] of [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const gaps = []
    for (const pair of group) {
      const s = pair.signalHorizons?.[String(days)]
      const c = pair.controlHorizons?.[String(days)]
      if (s?.priceReturnStatus === "complete" && c?.priceReturnStatus === "complete" && finite(s.priceReturnPct) && finite(c.priceReturnPct)) {
        gaps.push(Number(s.priceReturnPct) - Number(c.priceReturnPct))
      }
    }
    if (!gaps.length) continue
    pairedDates += 1
    dateGaps.push(round2(median(gaps)))
  }
  return {
    dates: byDate.size,
    pairedDates,
    gapMedian: median(dateGaps),
    bootstrap: bootstrapGapMedian(dateGaps),
    smallSample: pairedDates < MATCH_RULE.smallSample,
  }
}

function attachExcess(horizons, qqqByDate, entryDate) {
  const out = {}
  for (const days of HORIZONS) {
    const key = String(days)
    const h = { ...(horizons?.[key] || {}) }
    if (h.priceReturnStatus === "complete" && entryDate && h.endDate) {
      const qqqRet = benchmarkHorizonReturns(qqqByDate, entryDate, h.endDate)
      h.qqqReturnPct = finite(qqqRet) ? round2(qqqRet) : null
      h.excessQqqPct =
        finite(h.priceReturnPct) && finite(qqqRet) ? round2(Number(h.priceReturnPct) - Number(qqqRet)) : null
    } else {
      h.qqqReturnPct = null
      h.excessQqqPct = null
    }
    out[key] = h
  }
  return out
}

/**
 * Greedy 1:1 matching within a pool. Signals ordered by date then symbol.
 */
export function matchPairs(signalFeats, controlFeats, scales) {
  const signals = [...(signalFeats || [])].sort(
    (a, b) => a.date.localeCompare(b.date) || String(a.symbol).localeCompare(String(b.symbol)),
  )
  const available = new Map()
  for (const feat of controlFeats || []) {
    const key = `${feat.symbol}|${feat.date}`
    available.set(key, feat)
  }
  const pairs = []
  const unmatched = []
  const controlUseCount = new Map()

  for (const signal of signals) {
    let best = null
    let bestDist = Infinity
    let bestKey = null
    for (const [key, control] of available) {
      if (control.symbol !== signal.symbol) continue
      if (control.date === signal.date) continue
      const dist = matchDistance(signal, control, scales)
      if (dist == null) continue
      if (dist < bestDist || (dist === bestDist && control.date.localeCompare(best?.date || "9999") < 0)) {
        best = control
        bestDist = dist
        bestKey = key
      }
    }
    if (!best || bestKey == null) {
      unmatched.push({ symbol: signal.symbol, signalDate: signal.date, reason: "no_caliper_match" })
      continue
    }
    available.delete(bestKey)
    controlUseCount.set(bestKey, (controlUseCount.get(bestKey) || 0) + 1)
    pairs.push({
      symbol: signal.symbol,
      signalDate: signal.date,
      controlDate: best.date,
      signalCount: signal.signalCount ?? null,
      distance: round2(bestDist),
      signalFeat: signal,
      controlFeat: best,
      rowId: signal.rowId ?? null,
    })
  }

  return {
    pairs,
    unmatched,
    reusedControls: [...controlUseCount.values()].filter((n) => n > 1).length,
    uniqueControlsUsed: controlUseCount.size,
  }
}

function computeScales(features) {
  return {
    dd20: stdev(features.map((f) => f.dd20)) || 1,
    vol20: stdev(features.map((f) => f.vol20)) || 1,
    qqqRet20: stdev(features.map((f) => f.qqqRet20)) || 1,
  }
}

function judgeControlStudy({ validationPairs, validationDiff, sameDay, matchRate, balanceOk }) {
  const checks = []
  const n = validationDiff?.completePairs ?? 0
  const sampleOk = n >= MATCH_RULE.smallSample
  checks.push({ id: "sample", ok: sampleOk, detail: `검증 완성 쌍 ${n}` })
  checks.push({
    id: "matchRate",
    ok: matchRate >= 0.5,
    detail: `전체 매칭률 ${round2(matchRate * 100)}%`,
  })
  checks.push({ id: "balance", ok: balanceOk, detail: balanceOk ? "캘리퍼 내 매칭" : "균형 진단 실패" })

  const betterReturn = finite(validationDiff?.returnMedian) && validationDiff.returnMedian > 0
  const betterSuccess = finite(validationDiff?.successRatePp) && validationDiff.successRatePp > 0
  checks.push({
    id: "validationReturn",
    ok: betterReturn,
    detail: `검증 수익률 중앙값 차이 ${fmtPct(validationDiff?.returnMedian)}`,
  })
  checks.push({
    id: "validationSuccess",
    ok: betterSuccess,
    detail: `검증 성공률 차이 ${fmtPp(validationDiff?.successRatePp)}`,
  })

  const maeBetter = finite(validationDiff?.maeMedian) && validationDiff.maeMedian < 0
  const maeWorse = finite(validationDiff?.maeMedian) && validationDiff.maeMedian > 0
  checks.push({
    id: "mae",
    ok: !maeWorse,
    detail: `검증 MAE 차이 ${fmtPp(validationDiff?.maeMedian)} (음수면 신호군 불리 감소)`,
  })

  const boot = sameDay?.bootstrap
  const ciOk = boot?.status === "ok" && boot.excludesZero && boot.lo > 0
  checks.push({
    id: "sameDay",
    ok: Boolean(ciOk),
    detail: `날짜 중앙값차 ${fmtPct(sameDay?.gapMedian)} · 쌍일 ${sameDay?.pairedDates ?? 0} · CI ${
      boot?.status === "ok" ? `${fmtPct(boot.lo)}~${fmtPct(boot.hi)}` : "유보"
    }`,
  })

  if (!sampleOk || matchRate < 0.3) {
    return { level: "판정 보류", reason: "매칭 표본·품질이 결론을 제한", checks }
  }
  const returnImproved = betterReturn || betterSuccess
  if (returnImproved && maeWorse) {
    return {
      level: "위험 개선과 수익 개선 불일치",
      reason: "검증에서 수익/성공은 유리하나 MAE는 악화",
      checks,
    }
  }
  if (!returnImproved && maeBetter) {
    return {
      level: "위험 개선과 수익 개선 불일치",
      reason: "검증에서 MAE만 개선되고 수익·성공률 우위는 없음",
      checks,
    }
  }
  if (betterReturn && betterSuccess && ciOk && !maeWorse) {
    return {
      level: "효용 가능성",
      reason: "검증·날짜 CI가 신호군 우위를 뒷받침(채택·자동규칙은 적용하지 않음)",
      checks,
    }
  }
  return {
    level: "효용 미입증",
    reason: "차이가 작거나 CI가 0을 포함하거나 검증 재현이 부족",
    checks,
  }
}

function fmtPct(value) {
  if (value == null || !Number.isFinite(Number(value))) return "표본 없음"
  const number = Number(value)
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`
}

function fmtPp(value) {
  if (value == null || !Number.isFinite(Number(value))) return "표본 없음"
  const number = Number(value)
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%p`
}

/**
 * Verify v1 signal dates match rebuilt episodes for a sample of symbols.
 */
export function verifySignalsAgainstEngine(v1Rows, seriesBySymbol, sampleLimit = 5) {
  const bySymbol = new Map()
  for (const row of v1Rows || []) {
    if (!bySymbol.has(row.symbol)) bySymbol.set(row.symbol, [])
    bySymbol.get(row.symbol).push(row.signalDate)
  }
  const symbols = [...bySymbol.keys()].sort().slice(0, sampleLimit)
  let matched = 0
  let mismatched = 0
  const details = []
  for (const symbol of symbols) {
    const bars = seriesBySymbol[symbol]
    if (!bars?.length) {
      details.push({ symbol, status: "missing_bars" })
      mismatched += 1
      continue
    }
    const enriched = enrichBarsWithIndicators(bars)
    const episodes = buildSplitBuyEpisodes(enriched, FROZEN_THRESHOLDS, { fromIdx: 0, toIdx: enriched.length })
    const rebuilt = new Set(episodes.map((ep) => enriched[ep.openIdx]?.date).filter(Boolean))
    const stored = new Set(bySymbol.get(symbol))
    let ok = true
    for (const date of stored) {
      if (!rebuilt.has(date)) ok = false
    }
    if (ok) matched += 1
    else {
      mismatched += 1
      details.push({
        symbol,
        status: "mismatch",
        stored: stored.size,
        rebuilt: rebuilt.size,
      })
    }
  }
  return { sampledSymbols: symbols.length, matched, mismatched, ok: mismatched === 0, details }
}

/**
 * @param {object} v1Report
 * @param {Record<string, object[]>} seriesBySymbol
 * @param {object[]} qqqBars
 */
export function analyzeSignalVsControl(v1Report, seriesBySymbol, qqqBars) {
  const split = v1Report?.split
  if (!split?.trainEndDate || !split?.validationStartDate) throw new Error("v1 split required")

  const qqqByDate = buildQqqCloseMap(qqqBars)
  const regimeByDate = buildRegimeByDate(qqqBars)
  const verification = verifySignalsAgainstEngine(v1Report.rows, seriesBySymbol)

  const signalRows = (v1Report.rows || []).filter((row) => row?.signalDate && row.entryStatus === "confirmed")
  const prepared = []
  const controlPoolTrain = []
  const controlPoolVal = []
  let symbolsMissing = 0
  let symbolsUsed = 0

  for (const meta of Object.keys(seriesBySymbol).sort()) {
    const bars = seriesBySymbol[meta]
    if (!bars?.length) {
      symbolsMissing += 1
      continue
    }
    symbolsUsed += 1
    const enriched = enrichBarsWithIndicators(bars)
    const { candidates } = buildControlCandidates(enriched, qqqByDate, regimeByDate)
    for (const feat of candidates) {
      const item = { ...feat, symbol: meta }
      if (feat.date <= split.trainEndDate) controlPoolTrain.push(item)
      else if (feat.date >= split.validationStartDate) controlPoolVal.push(item)
    }

    const dateToIdx = new Map(enriched.map((bar, idx) => [bar.date, idx]))
    for (const row of signalRows.filter((r) => r.symbol === meta)) {
      const idx = dateToIdx.get(row.signalDate)
      if (idx == null) continue
      const feat = featureAt(enriched, idx, qqqByDate, regimeByDate)
      if (!feat) continue
      prepared.push({
        ...feat,
        symbol: meta,
        signalCount: row.signalCount,
        rowId: row.id,
        signalHorizons: row.horizons,
        signalEntryDate: row.entryDate,
        signalEntryPrice: row.entryPrice,
        barsRef: enriched,
        signalIdx: idx,
      })
    }
  }

  const trainSignals = prepared.filter((row) => row.date <= split.trainEndDate)
  const valSignals = prepared.filter((row) => row.date >= split.validationStartDate)

  const scalePool = [...trainSignals, ...controlPoolTrain]
  const scales = computeScales(scalePool)

  function matchPrepared(signalList, controlList) {
    const raw = matchPairs(signalList, controlList, scales)
    const hydrated = []
    for (const pair of raw.pairs) {
      const signal = signalList.find((s) => s.symbol === pair.symbol && s.date === pair.signalDate)
      const controlBars = signal?.barsRef
      if (!signal || !controlBars) continue
      const controlIdx = controlBars.findIndex((bar) => bar.date === pair.controlDate)
      if (controlIdx < 0) continue
      const controlEntry = measureNextOpenEntry(controlBars, controlIdx)
      const controlHorizons = attachExcess(controlEntry.horizons, qqqByDate, controlEntry.entryDate)
      const signalHorizons = attachExcess(signal.signalHorizons, qqqByDate, signal.signalEntryDate)
      hydrated.push({
        symbol: pair.symbol,
        signalDate: pair.signalDate,
        controlDate: pair.controlDate,
        signalCount: signal.signalCount,
        distance: pair.distance,
        signalFeat: {
          dd20: signal.dd20,
          vol20: signal.vol20,
          qqqRet20: signal.qqqRet20,
          regime: signal.regime,
          count: signal.count,
        },
        controlFeat: {
          dd20: pair.controlFeat.dd20,
          vol20: pair.controlFeat.vol20,
          qqqRet20: pair.controlFeat.qqqRet20,
          regime: pair.controlFeat.regime,
          count: pair.controlFeat.count,
        },
        signalEntryDate: signal.signalEntryDate,
        controlEntryDate: controlEntry.entryDate,
        controlEntryStatus: controlEntry.entryStatus,
        signalHorizons,
        controlHorizons,
      })
    }
    return {
      pairs: hydrated,
      unmatched: raw.unmatched,
      reusedControls: raw.reusedControls,
      uniqueControlsUsed: raw.uniqueControlsUsed,
      attempted: signalList.length,
    }
  }

  const trainHydrated = matchPrepared(trainSignals, controlPoolTrain)
  const valHydrated = matchPrepared(valSignals, controlPoolVal)
  const allPairs = [...trainHydrated.pairs, ...valHydrated.pairs]

  const balanceBefore = {
    signal: summarizeCovariates(prepared),
    controlPool: summarizeCovariates([...controlPoolTrain, ...controlPoolVal]),
  }
  const balanceAfter = {
    signal: summarizeCovariates(allPairs.map((p) => p.signalFeat)),
    control: summarizeCovariates(allPairs.map((p) => p.controlFeat)),
    meanAbsGap: {
      dd20: mean(allPairs.map((p) => Math.abs(p.signalFeat.dd20 - p.controlFeat.dd20))),
      vol20: mean(allPairs.map((p) => Math.abs(p.signalFeat.vol20 - p.controlFeat.vol20))),
      qqqRet20: mean(allPairs.map((p) => Math.abs(p.signalFeat.qqqRet20 - p.controlFeat.qqqRet20))),
    },
  }

  const overallDiff = Object.fromEntries(HORIZONS.map((days) => [String(days), pairedDiffs(allPairs, days)]))
  const trainDiff = Object.fromEntries(HORIZONS.map((days) => [String(days), pairedDiffs(trainHydrated.pairs, days)]))
  const valDiff = Object.fromEntries(HORIZONS.map((days) => [String(days), pairedDiffs(valHydrated.pairs, days)]))

  const tables = Object.fromEntries(
    HORIZONS.map((days) => {
      const key = String(days)
      return [
        key,
        {
          signal: outcomeSummary(allPairs, days, "signal"),
          control: outcomeSummary(allPairs, days, "control"),
          diff: overallDiff[key],
          sameDay: sameDayPairedGaps(allPairs, days),
        },
      ]
    }),
  )

  // Auxiliary: 3 vs control, 4 vs control
  const pairs3 = allPairs.filter((p) => Number(p.signalCount) === 3)
  const pairs4 = allPairs.filter((p) => Number(p.signalCount) === 4)
  const auxStrength = {
    three: {
      n: pairs3.length,
      diff60: pairedDiffs(pairs3, 60),
      sameDay60: sameDayPairedGaps(pairs3, 60),
    },
    four: {
      n: pairs4.length,
      diff60: pairedDiffs(pairs4, 60),
      sameDay60: sameDayPairedGaps(pairs4, 60),
    },
  }

  const auxRegime = Object.fromEntries(
    REGIME_ORDER.map((key) => {
      const subset = allPairs.filter((p) => p.signalFeat.regime === key)
      return [
        key,
        {
          label: REGIME_LABEL[key] || key,
          n: subset.length,
          exploratory: subset.length < MATCH_RULE.smallSample,
          diff60: pairedDiffs(subset, 60),
          sameDay60: sameDayPairedGaps(subset, 60),
        },
      ]
    }),
  )

  const attempted = trainHydrated.attempted + valHydrated.attempted
  const matched = allPairs.length
  const matchRate = attempted > 0 ? matched / attempted : 0
  const sameDayVal = sameDayPairedGaps(valHydrated.pairs, PRIMARY_HORIZON)

  const verdict = judgeControlStudy({
    validationPairs: valHydrated.pairs,
    validationDiff: valDiff["60"],
    sameDay: sameDayVal,
    matchRate,
    balanceOk: finite(balanceAfter.meanAbsGap.dd20) && balanceAfter.meanAbsGap.dd20 <= MATCH_RULE.calipers.dd20MaxAbsPp,
  })

  return {
    version: CHART_QUALITY_V10,
    researchOnly: true,
    source: "dbb_signal_vs_matched_nonsignal_v10",
    asOf: v1Report?.asOf ?? null,
    marketBenchmark: MARKET_BENCHMARK,
    trainFraction: TRAIN_FRACTION,
    rule: MATCH_RULE,
    thresholds: FROZEN_THRESHOLDS,
    verdictLevels: VERDICT_LEVELS,
    split,
    scales: {
      dd20: round2(scales.dd20),
      vol20: round2(scales.vol20),
      qqqRet20: round2(scales.qqqRet20),
      note: "학습 신호+학습 대조 후보 풀에서 고정",
    },
    verification,
    counts: {
      signalsAttempted: attempted,
      matched,
      unmatched: trainHydrated.unmatched.length + valHydrated.unmatched.length,
      matchRatePct: round2(matchRate * 100),
      trainMatched: trainHydrated.pairs.length,
      validationMatched: valHydrated.pairs.length,
      trainUnmatched: trainHydrated.unmatched.length,
      validationUnmatched: valHydrated.unmatched.length,
      controlPoolTrain: controlPoolTrain.length,
      controlPoolValidation: controlPoolVal.length,
      reusedControls: trainHydrated.reusedControls + valHydrated.reusedControls,
      symbolsUsed,
      symbolsMissing,
      signalRowsConfirmed: signalRows.length,
    },
    balance: { before: balanceBefore, after: balanceAfter },
    tables,
    train: {
      n: trainHydrated.pairs.length,
      byHorizon: trainDiff,
      sameDay60: sameDayPairedGaps(trainHydrated.pairs, 60),
      signal: outcomeSummary(trainHydrated.pairs, 60, "signal"),
      control: outcomeSummary(trainHydrated.pairs, 60, "control"),
    },
    validation: {
      n: valHydrated.pairs.length,
      byHorizon: valDiff,
      sameDay60: sameDayVal,
      signal: outcomeSummary(valHydrated.pairs, 60, "signal"),
      control: outcomeSummary(valHydrated.pairs, 60, "control"),
    },
    auxiliary: {
      strength: auxStrength,
      regimes: auxRegime,
    },
    distance: {
      median: median(allPairs.map((p) => p.distance)),
      mean: mean(allPairs.map((p) => p.distance)),
      p90: percentile(allPairs.map((p) => p.distance), 90),
    },
    verdict,
    // Keep a compact sample of pairs for QA (not full dump)
    pairSample: allPairs.slice(0, 12).map((p) => ({
      symbol: p.symbol,
      signalDate: p.signalDate,
      controlDate: p.controlDate,
      distance: p.distance,
      regime: p.signalFeat.regime,
      ret60Signal: p.signalHorizons?.["60"]?.priceReturnPct ?? null,
      ret60Control: p.controlHorizons?.["60"]?.priceReturnPct ?? null,
    })),
  }
}
