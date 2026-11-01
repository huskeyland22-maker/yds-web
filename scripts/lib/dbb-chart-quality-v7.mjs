/**
 * DBB practical utility v7 — selection (A) + post-entry risk (B).
 * Research only. Does not change v1~v6, buy engine, or trade records.
 * Rules and candidate parameters are fixed before reading outcomes.
 */
import { SAME_DAY_RULE, bootstrapGapMedian } from "./dbb-chart-quality-v2.mjs"
import { HORIZONS, PRIMARY_HORIZON, tertileBands } from "./dbb-chart-quality-v3.mjs"
import {
  SELECT_RULE as V6_SELECT,
  outcomeSummary as v6OutcomeSummary,
  pickDayTopThird,
  sameDaySelectionGaps,
} from "./dbb-chart-quality-v6.mjs"

export const CHART_QUALITY_V7 = 7
export { HORIZONS, PRIMARY_HORIZON }

/** Fixed before reading Study A / Study B outcomes. */
export const UTILITY_RULE = {
  purpose:
    "종목 선택(연구 A)과 매수 후 위험관리(연구 B)의 실전 효용을 본다. 기존 DBB 신호·매수 조건·자동매매는 바꾸지 않는다.",
  split: "v1/v6 학습·검증 신호일 경계를 그대로 쓴다. 같은 날짜는 한쪽에만 둔다.",
  topShare: V6_SELECT.topShare,
  selection:
    "연구 A: 기준은 전체 DBB 신호 동일가중. A·B·C·D는 v6과 같이 점수 가능 신호 상위 약 1/3(경계 동점 포함). E는 비0점이 희소하면 순위 전략으로 평가하지 않고 참고만 한다.",
  sameDay: V6_SELECT.sameDay,
  entry: "진입은 신호 다음 거래일 시가(v1 entryDate/entryPrice). 점수는 신호일 종가까지만.",
  incomplete: "미완성 20·60·120일 관측은 제외하고 0%로 채우지 않는다.",
  stopCandidates:
    "고정 손실 한도 후보(검증 전 고정): −8%, −12%, −16%. SOXL 규칙을 그대로 쓰지 않는다. 검증 보고 한도를 고르지 않는다.",
  stopFill:
    "주결과(보수): 시가≤손절가→갭 청산(시가), 저가≤손절가→손절가 체결. 대안(참고): 터치 시 당일 저가 체결(더 불리한 가정). 같은 날 다른 규칙과 충돌하면 손절 우선. 장중 순서는 일봉으로 알 수 없음.",
  trendExit:
    "추세 청산(검증 전 고정): 진입 이후 종가 < SMA20이면 청산 신호. 주결과는 다음 거래일 시가 청산. 당일 종가 청산은 참고만.",
  combine: "손절과 추세 중 먼저 촉발된 규칙으로 청산. 같은 날이면 손절 우선.",
  costs:
    "실제 수수료 자료 없음. 왕복 비용 가정 0 / 0.10% / 0.20% 민감도만 제시하며, 비용을 관측값처럼 말하지 않는다.",
  bootstrap: V6_SELECT.bootstrap,
  noOptimize: "검증 결과를 보고 상위 비율·손절 한도·추세 조건을 다시 고르지 않는다.",
  smallSample: 30,
  stopPcts: [-8, -12, -16],
  trendMa: 20,
  costAssumptionsPct: [0, 0.1, 0.2],
}

export const VERDICT_LEVELS = ["효용 가능성 있음", "효용 미입증", "위험 증가 가능성", "판정 보류"]

function finite(value) {
  return value != null && Number.isFinite(Number(value))
}

function round2(value) {
  if (!finite(value)) return null
  return Math.round(Number(value) * 100) / 100
}

function round4(value) {
  if (!finite(value)) return null
  return Math.round(Number(value) * 10000) / 10000
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

function percentile(values, p) {
  const xs = (values || []).filter(finite).map(Number).sort((a, b) => a - b)
  if (!xs.length) return null
  const idx = Math.min(xs.length - 1, Math.max(0, Math.floor((p / 100) * xs.length)))
  return xs[idx]
}

function positiveRate(values) {
  const xs = (values || []).filter(finite).map(Number)
  if (!xs.length) return null
  return round2((xs.filter((value) => value > 0).length / xs.length) * 100)
}

function partScore(row, component) {
  return finite(row?.parts?.[component]) ? Number(row.parts[component]) : null
}

function hasPartScore(row, component) {
  return finite(partScore(row, component))
}

function outcomeSummary(rows, days = PRIMARY_HORIZON) {
  return v6OutcomeSummary(rows, days)
}

function multiHorizon(rows) {
  return Object.fromEntries(HORIZONS.map((days) => [String(days), outcomeSummary(rows, days)]))
}

function diffMedians(selected, baseline, days = PRIMARY_HORIZON) {
  const sel = outcomeSummary(selected, days)
  const base = outcomeSummary(baseline, days)
  return {
    selected: sel,
    baseline: base,
    deltaPriceMedian:
      finite(sel.priceMedian) && finite(base.priceMedian) ? round2(sel.priceMedian - base.priceMedian) : null,
    deltaPositiveRate:
      finite(sel.positiveRate) && finite(base.positiveRate) ? round2(sel.positiveRate - base.positiveRate) : null,
    deltaDrawdownMedian:
      finite(sel.drawdownMedian) && finite(base.drawdownMedian)
        ? round2(sel.drawdownMedian - base.drawdownMedian)
        : null,
    deltaExcessQqq:
      finite(sel.excessQqqMedian) && finite(base.excessQqqMedian)
        ? round2(sel.excessQqqMedian - base.excessQqqMedian)
        : null,
  }
}

function directionMatch(a, b) {
  if (!finite(a) || !finite(b)) return { status: "비교 불가", match: null }
  if (Math.abs(a) < 0.02 || Math.abs(b) < 0.02) return { status: "비교 불가", match: null }
  return {
    status: Math.sign(a) === Math.sign(b) ? "일치" : "불일치",
    match: Math.sign(a) === Math.sign(b),
  }
}

function eSparsity(rows) {
  const scores = (rows || []).map((row) => partScore(row, "E")).filter(finite)
  const zero = scores.filter((value) => value === 0).length
  const nonzero = scores.length - zero
  return {
    available: scores.length,
    zero,
    nonzero,
    rankEligible: nonzero >= UTILITY_RULE.smallSample,
    note:
      nonzero < UTILITY_RULE.smallSample
        ? "E 비0점 표본이 부족해 순위 전략으로 평가하지 않고 참고만 한다."
        : "E 순위 평가 가능",
  }
}

function analyzeSelectionArm(rows, component, split) {
  const baseline = rows
  const bands = tertileBands(rows, component)
  const selected = bands.eligible ? bands.top : []
  const trainRows = rows.filter((row) => row.signalDate <= split.trainEndDate)
  const validationRows = rows.filter((row) => row.signalDate >= split.validationStartDate)
  const trainBands = tertileBands(trainRows, component)
  const validationBands = tertileBands(validationRows, component)
  const trainSelected = trainBands.eligible ? trainBands.top : []
  const validationSelected = validationBands.eligible ? validationBands.top : []
  const sameDay = sameDaySelectionGaps(rows, component)
  const trainSameDay = sameDaySelectionGaps(trainRows, component)
  const validationSameDay = sameDaySelectionGaps(validationRows, component)
  const trainDiff = diffMedians(trainSelected, trainRows)
  const validationDiff = diffMedians(validationSelected, validationRows)

  const lossRate = (list, days = PRIMARY_HORIZON) => {
    const rets = (list || [])
      .map((row) => {
        const h = row?.horizons?.[String(days)]
        if (h?.priceReturnStatus !== "complete" || !finite(h.priceReturnPct)) return null
        return Number(h.priceReturnPct)
      })
      .filter(finite)
    if (!rets.length) return null
    return round2((rets.filter((value) => value < 0).length / rets.length) * 100)
  }

  const verdict = judgeSelection({
    component,
    eligible: bands.eligible,
    validationDiff,
    sameDay60: sameDay.horizons["60"],
    trainDiff,
  })

  const sensitivity = leaveOneSymbolValidation(rows, component, split, validationDiff.deltaPriceMedian)

  return {
    component,
    eligible: bands.eligible,
    selectedN: selected.length,
    scoredN: rows.filter((row) => hasPartScore(row, component)).length,
    missing: rows.length - rows.filter((row) => hasPartScore(row, component)).length,
    pooled: {
      selected: multiHorizon(selected),
      baseline: multiHorizon(baseline),
      vsBaseline: Object.fromEntries(HORIZONS.map((days) => [String(days), diffMedians(selected, baseline, days)])),
      selectedLossRate60: lossRate(selected),
      baselineLossRate60: lossRate(baseline),
    },
    train: { selectedN: trainSelected.length, diff60: trainDiff },
    validation: { selectedN: validationSelected.length, diff60: validationDiff },
    sameDay,
    direction: {
      pooled: directionMatch(trainDiff.deltaPriceMedian, validationDiff.deltaPriceMedian),
      sameDay: directionMatch(
        trainSameDay.horizons["60"].gapVsMatchedMedian,
        validationSameDay.horizons["60"].gapVsMatchedMedian,
      ),
    },
    sensitivity,
    verdict,
  }
}

function leaveOneSymbolValidation(rows, component, split, baselineDelta) {
  const validationRows = (rows || []).filter((row) => row.signalDate >= split.validationStartDate)
  const symbols = [...new Set(validationRows.map((row) => row.symbol).filter(Boolean))].sort()
  return symbols
    .map((symbol) => {
      const filtered = validationRows.filter((row) => row.symbol !== symbol)
      const bands = tertileBands(filtered, component)
      const selected = bands.eligible ? bands.top : []
      const diff = diffMedians(selected, filtered)
      const flipped =
        finite(baselineDelta) &&
        finite(diff.deltaPriceMedian) &&
        Math.sign(baselineDelta) !== 0 &&
        Math.sign(diff.deltaPriceMedian) !== 0 &&
        Math.sign(baselineDelta) !== Math.sign(diff.deltaPriceMedian)
      return {
        symbol,
        deltaPriceMedian: diff.deltaPriceMedian,
        baselineDelta,
        flipped,
        selectedN: selected.length,
      }
    })
    .sort(
      (a, b) =>
        Number(b.flipped) - Number(a.flipped) ||
        Math.abs(b.deltaPriceMedian || 0) - Math.abs(a.deltaPriceMedian || 0),
    )
    .slice(0, 8)
}

function judgeSelection({ component, eligible, validationDiff, sameDay60, trainDiff }) {
  if (!eligible) {
    return {
      level: "판정 보류",
      reason: `${component} 상위 1/3 구분이 불가(동점·표본).`,
      checks: [],
    }
  }
  const valBetter = finite(validationDiff?.deltaPriceMedian) && validationDiff.deltaPriceMedian > 0
  const ddWorse = finite(validationDiff?.deltaDrawdownMedian) && validationDiff.deltaDrawdownMedian > 0
  const sameOk = finite(sameDay60?.gapVsMatchedMedian) && sameDay60.gapVsMatchedMedian > 0
  const boot = sameDay60?.bootstrapVsMatched
  const ciOk = boot?.status === "ok" && boot.excludesZero && boot.lo > 0
  const sampleOk = (sameDay60?.usableGroups || 0) >= UTILITY_RULE.smallSample
  const repro = directionMatch(trainDiff?.deltaPriceMedian, validationDiff?.deltaPriceMedian)

  const checks = [
    { id: "validationReturn", ok: valBetter, detail: `검증 수익차 ${fmtPct(validationDiff?.deltaPriceMedian)}` },
    { id: "drawdown", ok: !ddWorse, detail: `검증 불리차 ${fmt(validationDiff?.deltaDrawdownMedian)}%p`, worsened: ddWorse },
    { id: "sameDay", ok: sameOk, detail: `동일일 매칭차 ${fmtPct(sameDay60?.gapVsMatchedMedian)}` },
    {
      id: "uncertainty",
      ok: sampleOk && Boolean(ciOk),
      detail: `동일일 ${sameDay60?.usableGroups ?? 0} · CI ${
        boot?.status === "ok" ? `${fmtPct(boot.lo)}~${fmtPct(boot.hi)}` : "유보"
      }`,
    },
    { id: "repro", ok: repro.match === true, detail: `학습·검증 풀드 방향 ${repro.status}` },
  ]

  if (!sampleOk) {
    return { level: "판정 보류", reason: "동일일 표본 부족", checks }
  }
  if (valBetter && ddWorse) {
    return { level: "위험 증가 가능성", reason: "검증 수익은 낫지만 불리 움직임이 악화", checks }
  }
  if (valBetter && sameOk && ciOk && repro.match && !ddWorse) {
    return { level: "효용 가능성 있음", reason: "검증·동일일·CI·재현이 함께 뒷받침(채택·자동규칙은 적용하지 않음)", checks }
  }
  return { level: "효용 미입증", reason: "검증·동일일·불확실성 조건을 함께 충족하지 못함", checks }
}

/* ───────── Study B: risk management on bars ───────── */

function sma(closes, endIdx, period) {
  if (endIdx + 1 < period) return null
  let sum = 0
  for (let i = endIdx - period + 1; i <= endIdx; i++) {
    const value = Number(closes[i])
    if (!finite(value)) return null
    sum += value
  }
  return sum / period
}

/**
 * Stop fill on daily OHLC.
 * mode 'conservative' (primary): gap→open, touch→stopPrice
 * mode 'adverseTouch' (reference): gap→open, touch→day low (worse fill)
 */
export function evaluateStopOnBar(bar, stopPrice, mode = "conservative") {
  if (!bar || !finite(stopPrice)) return { hit: false, exitPrice: null, kind: null }
  const open = Number(bar.open)
  const low = Number(bar.low)
  if (finite(open) && open <= stopPrice) {
    return { hit: true, exitPrice: open, kind: "gap" }
  }
  if (finite(low) && low <= stopPrice) {
    const fill = mode === "adverseTouch" && finite(low) ? low : stopPrice
    return { hit: true, exitPrice: fill, kind: "touch" }
  }
  return { hit: false, exitPrice: null, kind: null }
}

/**
 * Simulate one trade path. Rules fixed before outcomes.
 * @param {object[]} bars
 * @param {number} entryIdx index of entry open bar
 * @param {number} horizonDays
 * @param {{ stopPct?: number|null, trendMa?: number|null, trendExitMode?: 'nextOpen'|'sameClose' }} rules
 */
export function simulateRiskTrade(bars, entryIdx, horizonDays, rules = {}) {
  if (!Array.isArray(bars) || !finite(entryIdx) || entryIdx < 0 || entryIdx >= bars.length) {
    return { status: "unavailable", reason: "진입 바 없음" }
  }
  const entryPrice = Number(bars[entryIdx]?.open)
  if (!finite(entryPrice) || !(entryPrice > 0)) {
    return { status: "unavailable", reason: "진입가 없음" }
  }
  const lastIdx = entryIdx + horizonDays
  if (lastIdx >= bars.length) {
    return { status: "incomplete", reason: "보유 기간 미완성", entryPrice, entryDate: bars[entryIdx].date }
  }

  const stopPct = finite(rules.stopPct) ? Number(rules.stopPct) : null
  const stopPrice = stopPct != null && stopPct < 0 ? entryPrice * (1 + stopPct / 100) : null
  const stopFillMode = rules.stopFillMode === "adverseTouch" ? "adverseTouch" : "conservative"
  const trendMa = finite(rules.trendMa) ? Number(rules.trendMa) : null
  const trendExitMode = rules.trendExitMode === "sameClose" ? "sameClose" : "nextOpen"

  const closes = bars.map((bar) => Number(bar.close))
  let maxAdverse = 0
  let exitIdx = lastIdx
  let exitPrice = Number(bars[lastIdx].close)
  let exitReason = "horizon"
  let stopKind = null
  let trendSignalIdx = null

  for (let i = entryIdx; i <= lastIdx; i++) {
    const bar = bars[i]
    const low = Number(bar.low)
    if (finite(low)) {
      const adverse = Math.max(0, (entryPrice - low) / entryPrice)
      if (adverse > maxAdverse) maxAdverse = adverse
    }

    // Stop has priority same day.
    if (stopPrice != null && i > entryIdx) {
      const stop = evaluateStopOnBar(bar, stopPrice, stopFillMode)
      if (stop.hit) {
        exitIdx = i
        exitPrice = stop.exitPrice
        exitReason = "stop"
        stopKind = stop.kind
        break
      }
    }

    if (trendMa != null && i >= entryIdx) {
      const ma = sma(closes, i, trendMa)
      const close = Number(bar.close)
      if (finite(ma) && finite(close) && close < ma) {
        trendSignalIdx = i
        if (trendExitMode === "sameClose") {
          exitIdx = i
          exitPrice = close
          exitReason = "trend_same_close"
          break
        }
        // next open
        if (i + 1 <= lastIdx && i + 1 < bars.length) {
          exitIdx = i + 1
          exitPrice = Number(bars[i + 1].open)
          exitReason = "trend_next_open"
          // If stop also hits on exit day, stop wins (conservative).
          if (stopPrice != null) {
            const stop = evaluateStopOnBar(bars[exitIdx], stopPrice, stopFillMode)
            if (stop.hit) {
              exitPrice = stop.exitPrice
              exitReason = "stop"
              stopKind = stop.kind
            }
          }
          break
        }
      }
    }
  }

  if (!finite(exitPrice) || !(exitPrice > 0)) {
    return { status: "unavailable", reason: "청산가 없음", entryPrice }
  }

  const grossReturnPct = round2(((exitPrice - entryPrice) / entryPrice) * 100)
  const holdDays = exitIdx - entryIdx
  const recoveryAfter =
    exitReason !== "horizon" && exitIdx < lastIdx
      ? round2(((Number(bars[lastIdx].close) - exitPrice) / exitPrice) * 100)
      : null

  return {
    status: "complete",
    entryDate: bars[entryIdx].date,
    entryPrice: round4(entryPrice),
    exitDate: bars[exitIdx].date,
    exitPrice: round4(exitPrice),
    exitReason,
    stopKind,
    trendSignalIdx,
    holdDays,
    grossReturnPct,
    maxAdversePct: round2(maxAdverse * 100),
    recoveryToHorizonPct: recoveryAfter,
    horizonEndDate: bars[lastIdx].date,
    horizonEndClose: round4(Number(bars[lastIdx].close)),
  }
}

function applyCost(grossReturnPct, roundTripCostPct) {
  if (!finite(grossReturnPct)) return null
  if (!finite(roundTripCostPct)) return grossReturnPct
  return round2(grossReturnPct - Number(roundTripCostPct))
}

function summarizeTradeReturns(trades, costPct = 0) {
  const complete = (trades || []).filter((trade) => trade?.status === "complete")
  const returns = complete.map((trade) => applyCost(trade.grossReturnPct, costPct))
  const adverse = complete.map((trade) => trade.maxAdversePct)
  const losses = returns.filter((value) => finite(value) && value < 0)
  const exitCounts = {}
  for (const trade of complete) {
    exitCounts[trade.exitReason] = (exitCounts[trade.exitReason] || 0) + 1
  }
  return {
    n: (trades || []).length,
    complete: complete.length,
    incomplete: (trades || []).filter((trade) => trade?.status === "incomplete").length,
    unavailable: (trades || []).filter((trade) => trade?.status === "unavailable").length,
    priceMean: mean(returns),
    priceMedian: median(returns),
    positiveRate: positiveRate(returns),
    lossRate: returns.length ? round2((losses.length / returns.length) * 100) : null,
    avgLoss: mean(losses),
    p10Return: percentile(returns, 10),
    drawdownMean: mean(adverse),
    drawdownMedian: median(adverse),
    avgHoldDays: mean(complete.map((trade) => trade.holdDays)),
    exitCounts,
    earlyExitCount: complete.filter((trade) => trade.exitReason !== "horizon").length,
    // Recovery after early exit is reference only — does not justify the exit.
    recoveryRef: (() => {
      const xs = complete.map((trade) => trade.recoveryToHorizonPct).filter(finite)
      if (!xs.length) return { n: 0, median: null, positiveRate: null, note: "조기청산 후 회복 참고 없음" }
      return {
        n: xs.length,
        median: median(xs),
        positiveRate: positiveRate(xs),
        note: "청산 후 원래 보유 종료일까지 가격 경로 참고. 과거 청산 정당화에 쓰지 않음.",
      }
    })(),
    costPct,
  }
}

function findEntryIdx(bars, entryDate) {
  if (!entryDate || !Array.isArray(bars)) return null
  const idx = bars.findIndex((bar) => bar.date === entryDate)
  return idx >= 0 ? idx : null
}

function runRiskForHorizon(rows, seriesBySymbol, horizonDays, rules) {
  const trades = []
  for (const row of rows || []) {
    if (row.entryStatus && row.entryStatus !== "filled" && row.entryStatus !== "ok") {
      // v1 uses entryStatus like "filled" or similar — accept any with entryDate
    }
    if (!row.entryDate || !finite(row.entryPrice)) {
      trades.push({ id: row.id, status: "unavailable", reason: "진입 미확정" })
      continue
    }
    const bars = seriesBySymbol[row.symbol]
    if (!bars?.length) {
      trades.push({ id: row.id, symbol: row.symbol, status: "unavailable", reason: "OHLCV 없음" })
      continue
    }
    const entryIdx = findEntryIdx(bars, row.entryDate)
    if (entryIdx == null) {
      trades.push({ id: row.id, symbol: row.symbol, status: "unavailable", reason: "진입일 바 없음" })
      continue
    }
    const sim = simulateRiskTrade(bars, entryIdx, horizonDays, rules)
    trades.push({ id: row.id, symbol: row.symbol, signalDate: row.signalDate, ...sim })
  }
  return trades
}

function riskArmSummary(rows, seriesBySymbol, split, label, rules) {
  const byHorizon = {}
  for (const days of HORIZONS) {
    const allTrades = runRiskForHorizon(rows, seriesBySymbol, days, rules)
    const trainRows = rows.filter((row) => row.signalDate <= split.trainEndDate)
    const validationRows = rows.filter((row) => row.signalDate >= split.validationStartDate)
    const trainTrades = runRiskForHorizon(trainRows, seriesBySymbol, days, rules)
    const validationTrades = runRiskForHorizon(validationRows, seriesBySymbol, days, rules)
    byHorizon[String(days)] = {
      all: summarizeTradeReturns(allTrades, 0),
      train: summarizeTradeReturns(trainTrades, 0),
      validation: summarizeTradeReturns(validationTrades, 0),
      costSensitivity: UTILITY_RULE.costAssumptionsPct.map((cost) => ({
        costPct: cost,
        all: summarizeTradeReturns(allTrades, cost),
        validation: summarizeTradeReturns(validationTrades, cost),
      })),
      // Keep a small sample of incomplete reasons, not full trades (JSON size).
      incompleteSample: allTrades.filter((trade) => trade.status !== "complete").slice(0, 5),
    }
  }
  return { label, rules, byHorizon }
}

function judgeRisk(holdArm, candidateArm, horizon = "60") {
  const hold = holdArm.byHorizon[horizon].validation
  const cand = candidateArm.byHorizon[horizon].validation
  if ((cand.complete || 0) < UTILITY_RULE.smallSample || (hold.complete || 0) < UTILITY_RULE.smallSample) {
    return {
      level: "판정 보류",
      reason: "검증 완성 표본 부족",
      deltaMedian:
        finite(cand.priceMedian) && finite(hold.priceMedian) ? round2(cand.priceMedian - hold.priceMedian) : null,
      deltaDd:
        finite(cand.drawdownMedian) && finite(hold.drawdownMedian)
          ? round2(cand.drawdownMedian - hold.drawdownMedian)
          : null,
    }
  }
  const deltaMedian = round2(cand.priceMedian - hold.priceMedian)
  const deltaDd = round2(cand.drawdownMedian - hold.drawdownMedian)
  const deltaP10 =
    finite(cand.p10Return) && finite(hold.p10Return) ? round2(cand.p10Return - hold.p10Return) : null
  const betterReturn = finite(deltaMedian) && deltaMedian > 0
  const worseRisk =
    (finite(deltaDd) && deltaDd > 0) || (finite(deltaP10) && deltaP10 < 0)
  const betterRisk = finite(deltaDd) && deltaDd < 0

  if (betterReturn && worseRisk) {
    return {
      level: "위험 증가 가능성",
      reason: "검증 수익 중앙값은 개선이나 불리/하위수익률이 악화",
      deltaMedian,
      deltaDd,
      deltaP10,
    }
  }
  if (betterReturn && betterRisk) {
    // Still require not cherry-picking; single horizon positive ≠ adopt.
    return {
      level: "효용 가능성 있음",
      reason: "검증에서 수익·불리 동시 개선 관찰(비용·체결 가정 한계 유지, 규칙 채택 안 함)",
      deltaMedian,
      deltaDd,
      deltaP10,
    }
  }
  return {
    level: "효용 미입증",
    reason: "검증에서 기준(무위험관리 보유) 대비 명확한 개선이 재현되지 않음",
    deltaMedian,
    deltaDd,
    deltaP10,
  }
}

/**
 * @param {object} v1Report
 * @param {Record<string, object[]>} seriesBySymbol
 */
export function analyzePracticalUtility(v1Report, seriesBySymbol = {}) {
  const split = v1Report?.split
  if (!split?.trainEndDate || !split?.validationStartDate) throw new Error("v1 split required")
  const rows = (v1Report?.rows || []).filter((row) => row?.signalDate)
  const entered = rows.filter((row) => row.entryDate && finite(row.entryPrice))

  const eInfo = eSparsity(rows)
  const components = ["A", "B", "C", "D"]
  const selection = {
    baseline: {
      n: rows.length,
      entered: entered.length,
      horizons: multiHorizon(rows),
      train: multiHorizon(rows.filter((row) => row.signalDate <= split.trainEndDate)),
      validation: multiHorizon(rows.filter((row) => row.signalDate >= split.validationStartDate)),
    },
    arms: Object.fromEntries(components.map((key) => [key, analyzeSelectionArm(rows, key, split)])),
    eReference: eInfo,
  }

  // Study B — only rows with confirmed entry.
  const hold = riskArmSummary(entered, seriesBySymbol, split, "무위험관리 보유", {
    stopPct: null,
    trendMa: null,
  })
  const stopArms = UTILITY_RULE.stopPcts.map((stopPct) =>
    riskArmSummary(entered, seriesBySymbol, split, `고정손절 ${stopPct}%`, {
      stopPct,
      trendMa: null,
    }),
  )
  const trendNext = riskArmSummary(entered, seriesBySymbol, split, "추세청산 SMA20 다음날시가", {
    stopPct: null,
    trendMa: UTILITY_RULE.trendMa,
    trendExitMode: "nextOpen",
  })
  const trendCloseRef = riskArmSummary(entered, seriesBySymbol, split, "추세청산 SMA20 당일종가(참고)", {
    stopPct: null,
    trendMa: UTILITY_RULE.trendMa,
    trendExitMode: "sameClose",
  })
  // Combined uses middle stop candidate fixed before results (−12%), not chosen after val.
  const combined = riskArmSummary(entered, seriesBySymbol, split, "손절−12% + 추세SMA20(다음날시가)", {
    stopPct: -12,
    trendMa: UTILITY_RULE.trendMa,
    trendExitMode: "nextOpen",
  })
  // Alternative touch fill for fixed −12% only (reference; not used to pick a limit).
  const stopAltTouch = riskArmSummary(entered, seriesBySymbol, split, "고정손절 -12% 대안터치(저가·참고)", {
    stopPct: -12,
    trendMa: null,
    stopFillMode: "adverseTouch",
  })

  const riskJudgments = {
    stops: stopArms.map((arm) => ({ label: arm.label, ...judgeRisk(hold, arm) })),
    trendNextOpen: { label: trendNext.label, ...judgeRisk(hold, trendNext) },
    trendSameCloseRef: {
      label: trendCloseRef.label,
      note: "참고 결과(당일 종가 청산). 주판정에 쓰지 않음.",
      ...judgeRisk(hold, trendCloseRef),
    },
    combined: { label: combined.label, ...judgeRisk(hold, combined) },
    stopAltTouchRef: {
      label: stopAltTouch.label,
      note: "터치 시 당일 저가 체결 대안. 한도 선택에 쓰지 않음.",
      ...judgeRisk(hold, stopAltTouch),
    },
  }

  const barsCoverage = {
    symbolsNeeded: [...new Set(entered.map((row) => row.symbol))].length,
    symbolsWithBars: [...new Set(entered.map((row) => row.symbol))].filter((symbol) => seriesBySymbol[symbol]?.length)
      .length,
  }

  return {
    version: CHART_QUALITY_V7,
    researchOnly: true,
    source: "dbb_chart_quality_v1_rows_plus_eq_ohlcv_risk_paths",
    asOf: v1Report?.asOf ?? null,
    rule: UTILITY_RULE,
    verdictLevels: VERDICT_LEVELS,
    split,
    counts: {
      signals: rows.length,
      entered: entered.length,
      uniqueDates: new Set(rows.map((row) => row.signalDate)).size,
      trainSignals: split.trainCount,
      validationSignals: split.validationCount,
      incompleteByHorizon: Object.fromEntries(
        HORIZONS.map((days) => {
          const key = String(days)
          const n = rows.filter((row) => row.horizons?.[key]?.priceReturnStatus !== "complete").length
          return [key, n]
        }),
      ),
      barsCoverage,
      e: eInfo,
    },
    studyA: selection,
    studyB: {
      hold,
      stopArms,
      trendNextOpen: trendNext,
      trendSameCloseRef: trendCloseRef,
      combined,
      stopAltTouchRef: stopAltTouch,
      judgments: riskJudgments,
    },
    overall: {
      studyA: summarizeStudyA(selection),
      studyB: summarizeStudyB(riskJudgments),
      note: "효용이 입증되지 않으면 규칙을 채택·자동적용하지 않는다. 부정 결과도 유효한 연구 결과다.",
    },
  }
}

function summarizeStudyA(selection) {
  const levels = Object.values(selection.arms).map((arm) => arm.verdict.level)
  if (levels.includes("효용 가능성 있음")) {
    return {
      level: "효용 가능성 있음",
      detail: "일부 항목에서 가능성 신호가 있으나 자동 채택하지 않음",
      byComponent: Object.fromEntries(Object.entries(selection.arms).map(([k, arm]) => [k, arm.verdict.level])),
    }
  }
  if (levels.every((level) => level === "판정 보류")) {
    return { level: "판정 보류", detail: "선택 전략 판정 보류", byComponent: Object.fromEntries(Object.entries(selection.arms).map(([k, arm]) => [k, arm.verdict.level])) }
  }
  if (levels.includes("위험 증가 가능성") && !levels.includes("효용 가능성 있음")) {
    return {
      level: "위험 증가 가능성",
      detail: "수익 개선이 있어도 위험 지표 악화 사례 있음",
      byComponent: Object.fromEntries(Object.entries(selection.arms).map(([k, arm]) => [k, arm.verdict.level])),
    }
  }
  return {
    level: "효용 미입증",
    detail: "A~D 상위 1/3 선택이 검증·동일일 기준으로 실전 선별 효용을 입증하지 못함",
    byComponent: Object.fromEntries(Object.entries(selection.arms).map(([k, arm]) => [k, arm.verdict.level])),
  }
}

function summarizeStudyB(judgments) {
  const list = [...judgments.stops, judgments.trendNextOpen, judgments.combined]
  const levels = list.map((row) => row.level)
  if (levels.includes("효용 가능성 있음")) {
    return { level: "효용 가능성 있음", detail: "일부 위험관리 후보에서 가능성 관찰(채택 안 함)", arms: list }
  }
  if (levels.includes("위험 증가 가능성")) {
    return { level: "위험 증가 가능성", detail: "일부 후보에서 위험 악화", arms: list }
  }
  if (levels.every((level) => level === "판정 보류")) {
    return { level: "판정 보류", detail: "표본·데이터 한계", arms: list }
  }
  return { level: "효용 미입증", detail: "고정손절·추세·결합이 검증에서 보유 대비 효용 미입증", arms: list }
}

function fmt(value) {
  if (value == null || !Number.isFinite(Number(value))) return "표본 없음"
  return String(Number(value))
}

function fmtPct(value) {
  if (value == null || !Number.isFinite(Number(value))) return "표본 없음"
  const number = Number(value)
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`
}

export { pickDayTopThird, outcomeSummary }
