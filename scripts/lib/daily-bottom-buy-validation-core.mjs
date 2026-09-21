/**
 * Daily Bottom Buy validation core — research only.
 *
 * 「일상 저점」정의 (고정 문서화, 결과 맞추기용 튜닝 금지):
 * 1) Confirmed swing low: close[i] = min(close[i-L .. i+L]), L=10 거래일
 * 2) Meaningful correction: drawdown from prior 60-day peak to trough >= 5%
 * 3) Rebound: within 20 trading days after trough, max(close) recovers
 *    at least 50% of the peak→trough drop (or +3% absolute from trough, whichever larger)
 *
 * 임계값은 저점일 지표 분포(분위수)에서 탐색용으로만 제안하며,
 * 미래 수익 극대화를 위한 반복 튜닝을 하지 않는다.
 *
 * Panic Index와 완전 분리.
 */

import { enrichBarsWithIndicators } from "./daily-bottom-indicators.mjs"

/** V1 검증 대상 — 임의 추가/삭제 금지 */
export const DAILY_BOTTOM_BUY_ETFS = [
  { symbol: "SMH", theme: "반도체 / AI 칩", group: "ai" },
  { symbol: "XLK", theme: "기술 / 빅테크 / AI 플랫폼", group: "ai" },
  { symbol: "GRID", theme: "전력망 / 스마트그리드 / AI 인프라", group: "ai" },
  { symbol: "URA", theme: "우라늄 / 원전", group: "ai" },
  { symbol: "BOTZ", theme: "로봇 / 자동화 / Physical AI", group: "ai" },
  { symbol: "CIBR", theme: "사이버보안", group: "ai" },
  { symbol: "ITA", theme: "방산 / 항공우주", group: "ai" },
  { symbol: "XLF", theme: "금융", group: "cycle" },
  { symbol: "XLY", theme: "경기소비재", group: "cycle" },
  { symbol: "XLV", theme: "헬스케어", group: "cycle" },
]

export const DIP_DEF = {
  swingHalfWindow: 10,
  lookbackPeakDays: 60,
  minDrawdownPct: 5,
  reboundWindow: 20,
  reboundFracOfDrop: 0.5,
  reboundMinAbsPct: 3,
  description:
    "Confirmed 10d swing low + ≥5% from 60d peak + rebound (≥50% of drop or +3%) within 20d",
}

export const FORWARD_HORIZONS = [5, 10, 20]

/**
 * Exploratory candidate thresholds — derived AFTER trough distribution analysis.
 * Defaults here are placeholders; study overwrites from pooled trough percentiles.
 * Used only for frequency / combo probes — NOT final product rules.
 */
export const EXPLORATORY_DEFAULTS = {
  rsiMax: 35,
  stochKMax: 25,
  bbPctBMax: 0.15,
  ma20DevMax: -4,
}

/**
 * V1 full-sample trough p25–p75 reference bands (documentation only).
 * Train/Test study may land near these; they are NOT locked product rules.
 */
export const V1_REFERENCE_BANDS = {
  rsi: { lo: 32, hi: 41 },
  stochK: { lo: 9, hi: 25 },
  bbPctB: { lo: -0.1, hi: 0.12 },
  ma20DevPct: { lo: -6.1, hi: -3.2 },
}

export const TRAIN_RATIO = 0.7

/**
 * Chronological split — never shuffle.
 * @param {{date:string}[]} bars
 * @param {number} [trainRatio]
 */
export function timeSplitBars(bars, trainRatio = TRAIN_RATIO) {
  if (!bars?.length) {
    return { splitIdx: 0, splitDate: null, trainBarCount: 0, testBarCount: 0 }
  }
  const splitIdx = Math.max(1, Math.min(bars.length - 1, Math.floor(bars.length * trainRatio)))
  return {
    splitIdx,
    splitDate: bars[splitIdx]?.date ?? null,
    trainLastDate: bars[splitIdx - 1]?.date ?? null,
    testFirstDate: bars[splitIdx]?.date ?? null,
    dataStart: bars[0].date,
    dataEnd: bars[bars.length - 1].date,
    trainBarCount: splitIdx,
    testBarCount: bars.length - splitIdx,
    trainRatio,
  }
}

/**
 * Train troughs must be fully confirmed inside train (no rebound peek into test).
 * @param {Array<{index:number}>} events
 * @param {number} splitIdx
 * @param {number} [reboundWindow]
 */
export function partitionEventsBySplit(events, splitIdx, reboundWindow = DIP_DEF.reboundWindow) {
  const train = []
  const test = []
  for (const e of events) {
    if (e.index + reboundWindow < splitIdx) train.push(e)
    else if (e.index >= splitIdx) test.push(e)
    // boundary-straddling troughs excluded from both (avoids leakage)
  }
  return { train, test }
}

/**
 * @param {import('./daily-bottom-indicators.mjs').Bar[]} bars
 * @param {typeof DIP_DEF} [def]
 */
export function findDailyBottomEvents(bars, def = DIP_DEF) {
  const enriched = enrichBarsWithIndicators(bars)
  const n = enriched.length
  const L = def.swingHalfWindow
  const events = []

  for (let i = L; i < n - L; i++) {
    const c = enriched[i].close
    let isMin = true
    for (let j = i - L; j <= i + L; j++) {
      if (j === i) continue
      if (enriched[j].close < c) {
        isMin = false
        break
      }
    }
    if (!isMin) continue

    const peakStart = Math.max(0, i - def.lookbackPeakDays)
    let peak = -Infinity
    let peakIdx = peakStart
    for (let j = peakStart; j < i; j++) {
      if (enriched[j].close > peak) {
        peak = enriched[j].close
        peakIdx = j
      }
    }
    if (!(peak > 0) || peak <= c) continue
    const drawdownPct = ((peak - c) / peak) * 100
    if (drawdownPct < def.minDrawdownPct) continue

    const dropAbs = peak - c
    const needAbs = Math.max(
      dropAbs * def.reboundFracOfDrop,
      c * (def.reboundMinAbsPct / 100),
    )
    let maxAfter = c
    let reboundDay = null
    const end = Math.min(n - 1, i + def.reboundWindow)
    for (let j = i + 1; j <= end; j++) {
      if (enriched[j].close > maxAfter) maxAfter = enriched[j].close
      if (enriched[j].close >= c + needAbs) {
        reboundDay = j - i
        break
      }
    }
    if (reboundDay == null) continue

    // max further drawdown AFTER trough within rebound window (should be ~0 by def, but check)
    let minAfter = c
    for (let j = i + 1; j <= end; j++) {
      if (enriched[j].close < minAfter) minAfter = enriched[j].close
    }
    const furtherDdPct = ((c - minAfter) / c) * 100

    events.push({
      index: i,
      date: enriched[i].date,
      close: c,
      peakDate: enriched[peakIdx].date,
      peakClose: peak,
      drawdownPct: round1(drawdownPct),
      reboundDays: reboundDay,
      furtherDdPct: round1(furtherDdPct),
      rsi14: numOrNull(enriched[i].rsi14),
      stochK: numOrNull(enriched[i].stochK),
      stochD: numOrNull(enriched[i].stochD),
      bbPctB: numOrNull(enriched[i].bbPctB),
      ma20DevPct: numOrNull(enriched[i].ma20DevPct),
      forward: forwardReturns(enriched, i, FORWARD_HORIZONS),
    })
  }

  return { enriched, events }
}

/**
 * @param {ReturnType<typeof enrichBarsWithIndicators>} rows
 * @param {number} i
 * @param {number[]} horizons
 */
export function forwardReturns(rows, i, horizons = FORWARD_HORIZONS) {
  const base = rows[i].close
  /** @type {Record<string, number|null>} */
  const out = {}
  for (const h of horizons) {
    const j = i + h
    if (j >= rows.length || !(base > 0)) {
      out[`d${h}`] = null
      continue
    }
    out[`d${h}`] = round2(((rows[j].close - base) / base) * 100)
  }
  // max adverse excursion within 20d
  let mae = 0
  const end = Math.min(rows.length - 1, i + 20)
  for (let j = i + 1; j <= end; j++) {
    const dd = ((base - rows[j].close) / base) * 100
    if (dd > mae) mae = dd
  }
  out.mae20 = round2(mae)
  return out
}

/**
 * Percentile of numeric array (linear interpolation). p in [0,100]
 * @param {number[]} values
 * @param {number} p
 */
export function percentile(values, p) {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (!xs.length) return null
  if (xs.length === 1) return xs[0]
  const rank = (p / 100) * (xs.length - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  if (lo === hi) return xs[lo]
  const w = rank - lo
  return xs[lo] * (1 - w) + xs[hi] * w
}

/** @param {number[]} values */
export function summarizeNumeric(values) {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (!xs.length) {
    return { n: 0, mean: null, median: null, p10: null, p25: null, p75: null, p90: null, min: null, max: null }
  }
  const mean = xs.reduce((s, v) => s + v, 0) / xs.length
  return {
    n: xs.length,
    mean: round2(mean),
    median: round2(percentile(xs, 50)),
    p10: round2(percentile(xs, 10)),
    p25: round2(percentile(xs, 25)),
    p75: round2(percentile(xs, 75)),
    p90: round2(percentile(xs, 90)),
    min: round2(xs[0]),
    max: round2(xs[xs.length - 1]),
  }
}

/**
 * Build exploratory thresholds from trough-day indicator distributions.
 * Uses ~median of trough values (not optimized for forward return).
 * @param {Array<{rsi14:number|null, stochK:number|null, bbPctB:number|null, ma20DevPct:number|null}>} events
 */
export function proposeThresholdsFromTroughs(events) {
  const rsi = events.map((e) => e.rsi14).filter(Number.isFinite)
  const stoch = events.map((e) => e.stochK).filter(Number.isFinite)
  const bb = events.map((e) => e.bbPctB).filter(Number.isFinite)
  const ma = events.map((e) => e.ma20DevPct).filter(Number.isFinite)

  // At troughs, indicators are already "low" — use median as candidate ceiling
  // (signal fires when indicator <= this exploratory level)
  return {
    rsiMax: round1(percentile(rsi, 50) ?? EXPLORATORY_DEFAULTS.rsiMax),
    stochKMax: round1(percentile(stoch, 50) ?? EXPLORATORY_DEFAULTS.stochKMax),
    bbPctBMax: round2(percentile(bb, 50) ?? EXPLORATORY_DEFAULTS.bbPctBMax),
    ma20DevMax: round1(percentile(ma, 50) ?? EXPLORATORY_DEFAULTS.ma20DevMax),
    source: "median of confirmed daily-bottom trough indicator values",
    note: "Exploratory only — not final product thresholds. Not return-optimized.",
  }
}

/**
 * Per-day condition flags using exploratory thresholds.
 * @param {ReturnType<typeof enrichBarsWithIndicators>[number]} row
 * @param {{rsiMax:number, stochKMax:number, bbPctBMax:number, ma20DevMax:number}} th
 */
export function conditionFlags(row, th) {
  const rsi = row.rsi14 != null && row.rsi14 <= th.rsiMax
  const stoch = row.stochK != null && row.stochK <= th.stochKMax
  const bb = row.bbPctB != null && row.bbPctB <= th.bbPctBMax
  const ma = row.ma20DevPct != null && row.ma20DevPct <= th.ma20DevMax
  const count = [rsi, stoch, bb, ma].filter(Boolean).length
  return { rsi, stoch, bb, ma, count }
}

/**
 * Rising-edge signal days: first day a condition becomes true after being false.
 * @param {ReturnType<typeof enrichBarsWithIndicators>} rows
 * @param {(row: any) => boolean} pred
 */
export function risingEdgeSignals(rows, pred) {
  const idxs = []
  let prev = false
  for (let i = 0; i < rows.length; i++) {
    const ok = pred(rows[i])
    if (ok && !prev) idxs.push(i)
    prev = ok
  }
  return idxs
}

/**
 * Evaluate a set of signal indices for forward stats + distance to nearest trough.
 * @param {ReturnType<typeof enrichBarsWithIndicators>} rows
 * @param {number[]} signalIdxs
 * @param {Array<{index:number, date:string}>} events
 */
export function evaluateSignals(rows, signalIdxs, events) {
  const eventIdxs = events.map((e) => e.index)
  const samples = []
  for (const i of signalIdxs) {
    // skip last 20 bars (incomplete forward)
    if (i + 20 >= rows.length) continue
    const fwd = forwardReturns(rows, i)
    const nearest = nearestEventDistance(i, eventIdxs)
    samples.push({
      index: i,
      date: rows[i].date,
      close: rows[i].close,
      rsi14: numOrNull(rows[i].rsi14),
      stochK: numOrNull(rows[i].stochK),
      bbPctB: numOrNull(rows[i].bbPctB),
      ma20DevPct: numOrNull(rows[i].ma20DevPct),
      ...fwd,
      daysToNearestTrough: nearest.days,
      nearestTroughDate: nearest.date
        ? rows[nearest.idx]?.date ?? null
        : null,
      hitNearTrough: nearest.days != null && Math.abs(nearest.days) <= 5,
    })
  }

  const falseSignalRate =
    samples.length === 0
      ? null
      : round2(
          (samples.filter((s) => !s.hitNearTrough).length / samples.length) * 100,
        )

  return {
    n: samples.length,
    falseSignalPct: falseSignalRate,
    nearTroughPct:
      samples.length === 0
        ? null
        : round2((samples.filter((s) => s.hitNearTrough).length / samples.length) * 100),
    forward: {
      d5: summarizeNumeric(samples.map((s) => s.d5)),
      d10: summarizeNumeric(samples.map((s) => s.d10)),
      d20: summarizeNumeric(samples.map((s) => s.d20)),
      mae20: summarizeNumeric(samples.map((s) => s.mae20)),
    },
    // "신호가 발생했는데 이후 더 크게 하락" — MAE20 >= 5%
    deeperDropPct5:
      samples.length === 0
        ? null
        : round2((samples.filter((s) => (s.mae20 ?? 0) >= 5).length / samples.length) * 100),
    deeperDropPct8:
      samples.length === 0
        ? null
        : round2((samples.filter((s) => (s.mae20 ?? 0) >= 8).length / samples.length) * 100),
    samples: samples.slice(0, 30), // cap for report size
  }
}

/**
 * Evaluate rising-edge / combo signals restricted to [fromIdx, toIdx).
 * Rising edges computed on full series (avoids false edge at segment start).
 * Near-trough uses `eventsForNear` (typically same-segment confirmed troughs).
 *
 * @param {ReturnType<typeof enrichBarsWithIndicators>} enriched
 * @param {Array<{index:number, date:string}>} eventsForNear
 * @param {{rsiMax:number, stochKMax:number, bbPctBMax:number, ma20DevMax:number}} th
 * @param {{ fromIdx: number, toIdx: number }} range
 */
export function evaluateThresholdsOnRange(enriched, eventsForNear, th, range) {
  const { fromIdx, toIdx } = range
  const inRange = (i) => i >= fromIdx && i < toIdx

  const filterIdxs = (idxs) => idxs.filter(inRange)

  const tradingDays = Math.max(0, toIdx - fromIdx)
  const perIndicator = {
    rsi: {
      label: "RSI alone",
      ...withFreq(
        evaluateSignals(
          enriched,
          filterIdxs(
            risingEdgeSignals(enriched, (r) => r.rsi14 != null && r.rsi14 <= th.rsiMax),
          ),
          eventsForNear,
        ),
        tradingDays,
      ),
    },
    stoch: {
      label: "Stoch alone",
      ...withFreq(
        evaluateSignals(
          enriched,
          filterIdxs(
            risingEdgeSignals(enriched, (r) => r.stochK != null && r.stochK <= th.stochKMax),
          ),
          eventsForNear,
        ),
        tradingDays,
      ),
    },
    bb: {
      label: "BB alone",
      ...withFreq(
        evaluateSignals(
          enriched,
          filterIdxs(
            risingEdgeSignals(enriched, (r) => r.bbPctB != null && r.bbPctB <= th.bbPctBMax),
          ),
          eventsForNear,
        ),
        tradingDays,
      ),
    },
    ma20: {
      label: "MA20 alone",
      ...withFreq(
        evaluateSignals(
          enriched,
          filterIdxs(
            risingEdgeSignals(
              enriched,
              (r) => r.ma20DevPct != null && r.ma20DevPct <= th.ma20DevMax,
            ),
          ),
          eventsForNear,
        ),
        tradingDays,
      ),
    },
  }

  const combo = {}
  for (const band of [
    { key: "ge2", min: 2, max: 4, label: "2+ conditions" },
    { key: "ge3", min: 3, max: 4, label: "3+ conditions" },
    { key: "eq4", min: 4, max: 4, label: "4 conditions" },
    { key: "eq2", min: 2, max: 2, label: "exactly 2" },
    { key: "eq3", min: 3, max: 3, label: "exactly 3" },
  ]) {
    let prevIn = false
    const idxs = []
    for (let i = 0; i < enriched.length; i++) {
      const f = conditionFlags(enriched[i], th)
      const inBand = f.count >= band.min && f.count <= band.max
      if (inBand && !prevIn) idxs.push(i)
      prevIn = inBand
    }
    combo[band.key] = {
      label: band.label,
      ...withFreq(evaluateSignals(enriched, filterIdxs(idxs), eventsForNear), tradingDays),
    }
  }

  return { perIndicator, combo, tradingDays }
}

function withFreq(ev, tradingDays) {
  return {
    ...ev,
    signalsPerYear:
      tradingDays > 0 && ev.n != null ? round2((ev.n / tradingDays) * 252) : null,
  }
}

/**
 * Per-ETF train/test analysis. Thresholds must be frozen from train (caller supplies).
 * @param {{symbol:string, theme:string, group:string}} meta
 * @param {import('./daily-bottom-indicators.mjs').Bar[]} bars
 * @param {{rsiMax:number, stochKMax:number, bbPctBMax:number, ma20DevMax:number}} frozenTh
 * @param {number} [trainRatio]
 */
export function analyzeEtfTrainTest(meta, bars, frozenTh, trainRatio = TRAIN_RATIO) {
  const { enriched, events } = findDailyBottomEvents(bars)
  const split = timeSplitBars(enriched, trainRatio)
  const { train: trainEvents, test: testEvents } = partitionEventsBySplit(
    events,
    split.splitIdx,
  )

  const localTrainTh = proposeThresholdsFromTroughs(trainEvents)

  const trainEval = evaluateThresholdsOnRange(enriched, trainEvents, frozenTh, {
    fromIdx: 0,
    toIdx: split.splitIdx,
  })
  const testEval = evaluateThresholdsOnRange(enriched, testEvents, frozenTh, {
    fromIdx: split.splitIdx,
    toIdx: enriched.length,
  })

  return {
    symbol: meta.symbol,
    theme: meta.theme,
    group: meta.group,
    split,
    trainEventCount: trainEvents.length,
    testEventCount: testEvents.length,
    localTrainThresholds: localTrainTh,
    thresholdsFrozen: frozenTh,
    train: {
      troughDist: {
        rsi14: summarizeNumeric(trainEvents.map((e) => e.rsi14)),
        stochK: summarizeNumeric(trainEvents.map((e) => e.stochK)),
        bbPctB: summarizeNumeric(trainEvents.map((e) => e.bbPctB)),
        ma20DevPct: summarizeNumeric(trainEvents.map((e) => e.ma20DevPct)),
      },
      ...trainEval,
    },
    test: {
      troughDist: {
        rsi14: summarizeNumeric(testEvents.map((e) => e.rsi14)),
        stochK: summarizeNumeric(testEvents.map((e) => e.stochK)),
        bbPctB: summarizeNumeric(testEvents.map((e) => e.bbPctB)),
        ma20DevPct: summarizeNumeric(testEvents.map((e) => e.ma20DevPct)),
      },
      ...testEval,
    },
  }
}

/**
 * Pool train troughs → frozen shared thresholds (never touch test).
 * @param {Array<{rsi14:any, stochK:any, bbPctB:any, ma20DevPct:any}>} trainTroughs
 */
export function freezeThresholdsFromTrainTroughs(trainTroughs) {
  const th = proposeThresholdsFromTroughs(trainTroughs)
  return {
    ...th,
    source: "TRAIN-only median of confirmed trough indicators (time-split; no test retune)",
    note: "Frozen for Test. Not product-final. Not return-optimized.",
    v1ReferenceBands: V1_REFERENCE_BANDS,
  }
}

/**
 * Full per-ETF analysis.
 * @param {{symbol:string, theme:string, group:string}} meta
 * @param {import('./daily-bottom-indicators.mjs').Bar[]} bars
 * @param {{rsiMax:number, stochKMax:number, bbPctBMax:number, ma20DevMax:number}|null} [sharedTh]
 */
export function analyzeEtf(meta, bars, sharedTh = null) {
  const { enriched, events } = findDailyBottomEvents(bars)
  const start = enriched[0]?.date ?? null
  const end = enriched[enriched.length - 1]?.date ?? null

  const troughDist = {
    rsi14: summarizeNumeric(events.map((e) => e.rsi14)),
    stochK: summarizeNumeric(events.map((e) => e.stochK)),
    bbPctB: summarizeNumeric(events.map((e) => e.bbPctB)),
    ma20DevPct: summarizeNumeric(events.map((e) => e.ma20DevPct)),
    drawdownPct: summarizeNumeric(events.map((e) => e.drawdownPct)),
    reboundDays: summarizeNumeric(events.map((e) => e.reboundDays)),
    forwardD5: summarizeNumeric(events.map((e) => e.forward?.d5)),
    forwardD10: summarizeNumeric(events.map((e) => e.forward?.d10)),
    forwardD20: summarizeNumeric(events.map((e) => e.forward?.d20)),
  }

  const localTh = proposeThresholdsFromTroughs(events)
  const th = sharedTh
    ? { ...sharedTh, source: "shared_cross_etf", note: sharedTh.note }
    : localTh

  // Warmup: need indicators ready
  const ready = enriched.filter(
    (r) =>
      r.rsi14 != null &&
      r.stochK != null &&
      r.bbPctB != null &&
      r.ma20DevPct != null,
  )
  const tradingDays = ready.length

  const perIndicator = {
    rsi: evaluateSignals(
      enriched,
      risingEdgeSignals(enriched, (r) => r.rsi14 != null && r.rsi14 <= th.rsiMax),
      events,
    ),
    stoch: evaluateSignals(
      enriched,
      risingEdgeSignals(enriched, (r) => r.stochK != null && r.stochK <= th.stochKMax),
      events,
    ),
    bb: evaluateSignals(
      enriched,
      risingEdgeSignals(enriched, (r) => r.bbPctB != null && r.bbPctB <= th.bbPctBMax),
      events,
    ),
    ma20: evaluateSignals(
      enriched,
      risingEdgeSignals(
        enriched,
        (r) => r.ma20DevPct != null && r.ma20DevPct <= th.ma20DevMax,
      ),
      events,
    ),
  }

  // Combo by count on rising edge of count band
  const combo = {}
  for (const band of [
    { key: "ge2", min: 2, max: 4, label: "2+ conditions" },
    { key: "ge3", min: 3, max: 4, label: "3+ conditions" },
    { key: "eq4", min: 4, max: 4, label: "4 conditions" },
    { key: "eq2", min: 2, max: 2, label: "exactly 2" },
    { key: "eq3", min: 3, max: 3, label: "exactly 3" },
  ]) {
    let prevIn = false
    const idxs = []
    for (let i = 0; i < enriched.length; i++) {
      const f = conditionFlags(enriched[i], th)
      const inBand = f.count >= band.min && f.count <= band.max
      if (inBand && !prevIn) idxs.push(i)
      prevIn = inBand
    }
    combo[band.key] = {
      label: band.label,
      ...evaluateSignals(enriched, idxs, events),
      signalsPerYear:
        tradingDays > 0
          ? round2((idxs.filter((i) => i + 20 < enriched.length).length / tradingDays) * 252)
          : null,
    }
  }

  // Day-count frequency (not rising edge) for combo occupancy
  let daysGe3 = 0
  let daysEq4 = 0
  for (const r of ready) {
    const f = conditionFlags(r, th)
    if (f.count >= 3) daysGe3++
    if (f.count === 4) daysEq4++
  }

  const usefulness = rankIndicatorUsefulness(perIndicator, combo)

  return {
    symbol: meta.symbol,
    theme: meta.theme,
    group: meta.group,
    dataStart: start,
    dataEnd: end,
    barCount: enriched.length,
    tradingDaysReady: tradingDays,
    dipDefinition: DIP_DEF.description,
    adjustmentEventCount: events.length,
    eventsPerYear:
      tradingDays > 0 ? round2((events.length / Math.max(tradingDays, 1)) * 252) : null,
    troughIndicatorRanges: troughDist,
    thresholdsUsed: th,
    localThresholds: localTh,
    perIndicator,
    combo,
    occupancy: {
      daysGe3,
      daysEq4,
      pctGe3: tradingDays ? round2((daysGe3 / tradingDays) * 100) : null,
      pctEq4: tradingDays ? round2((daysEq4 / tradingDays) * 100) : null,
    },
    usefulnessNote: usefulness,
    troughSnapshots: events.map((e) => ({
      date: e.date,
      drawdownPct: e.drawdownPct,
      reboundDays: e.reboundDays,
      rsi14: e.rsi14,
      stochK: e.stochK,
      bbPctB: e.bbPctB,
      ma20DevPct: e.ma20DevPct,
      forward: e.forward,
    })),
    sampleEvents: events.slice(0, 12).map((e) => ({
      date: e.date,
      drawdownPct: e.drawdownPct,
      reboundDays: e.reboundDays,
      rsi14: e.rsi14,
      stochK: e.stochK,
      bbPctB: e.bbPctB,
      ma20DevPct: e.ma20DevPct,
      forward: e.forward,
    })),
  }
}

/**
 * @param {Record<string, ReturnType<typeof evaluateSignals>>} per
 * @param {Record<string, any>} combo
 */
function rankIndicatorUsefulness(per, combo) {
  const score = (ev) => {
    if (!ev || !ev.n) return -999
    const med20 = ev.forward?.d20?.median ?? -999
    const near = ev.nearTroughPct ?? 0
    const deep = ev.deeperDropPct5 ?? 100
    // Prefer: near troughs, positive median d20, fewer deep drops — exploratory rank only
    return near * 0.4 + med20 * 2 - deep * 0.3 + Math.min(ev.n, 40) * 0.05
  }
  const ranked = ["rsi", "stoch", "bb", "ma20"]
    .map((k) => ({ key: k, s: score(per[k]), n: per[k]?.n ?? 0, near: per[k]?.nearTroughPct, d20: per[k]?.forward?.d20?.median }))
    .sort((a, b) => b.s - a.s)

  return {
    rankedSingle: ranked.map((r) => r.key),
    bestSingle: ranked[0]?.key ?? null,
    note:
      `Exploratory usefulness (not optimized): near-trough%, median +20d, adverse drop. ` +
      `Best single≈${ranked[0]?.key}; 3+ combo n=${combo.ge3?.n ?? 0}, near=${combo.ge3?.nearTroughPct ?? "—"}%, d20med=${combo.ge3?.forward?.d20?.median ?? "—"}%.`,
  }
}

/**
 * Pool trough events across ETFs → shared exploratory thresholds.
 * @param {Array<ReturnType<typeof analyzeEtf>>} etfResults
 */
export function buildSharedThresholds(etfResults) {
  const all = []
  for (const r of etfResults) {
    for (const e of r.sampleEvents || []) {
      all.push(e)
    }
  }
  // Re-analyze needs full events — caller should pass pooled troughs separately.
  // This helper accepts pre-pooled troughs:
  return proposeThresholdsFromTroughs(all)
}

/**
 * @param {Array<{rsi14:any, stochK:any, bbPctB:any, ma20DevPct:any}>} pooledTroughs
 */
export function buildSharedThresholdsFromTroughs(pooledTroughs) {
  return proposeThresholdsFromTroughs(pooledTroughs)
}

function nearestEventDistance(i, eventIdxs) {
  if (!eventIdxs.length) return { days: null, idx: null, date: true }
  let best = Infinity
  let bestIdx = null
  for (const e of eventIdxs) {
    const d = e - i
    if (Math.abs(d) < Math.abs(best)) {
      best = d
      bestIdx = e
    }
  }
  return { days: best === Infinity ? null : best, idx: bestIdx, date: true }
}

function round1(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 10) / 10
}
function round2(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 100) / 100
}
function numOrNull(v) {
  return v == null || !Number.isFinite(v) ? null : round2(v)
}
