/**
 * DBB signal-strength v8 — 3-of-4 vs 4-of-4 (research only).
 * Uses frozen v1 rows' signalCount. Does not change v1~v7, engine, or trades.
 * Judgment rules are fixed before reading outcomes.
 */
import { bootstrapGapMedian } from "./dbb-chart-quality-v2.mjs"
import { HORIZONS, PRIMARY_HORIZON } from "./dbb-chart-quality-v3.mjs"
import { FROZEN_THRESHOLDS } from "./daily-bottom-split-buy-sim.mjs"
import { conditionFlags } from "./daily-bottom-buy-validation-core.mjs"
import { enrichBarsWithIndicators } from "./daily-bottom-indicators.mjs"

export const CHART_QUALITY_V8 = 8
export { HORIZONS, PRIMARY_HORIZON }

/** Fixed before reading 3-vs-4 outcomes. */
export const STRENGTH_RULE = {
  purpose:
    "DBB 네 조건 중 3개 충족과 4개 충족 신호의 성공률·수익·위험 차이를 본다. 매수 기준·자동매매는 바꾸지 않는다.",
  thresholds: FROZEN_THRESHOLDS,
  groups:
    "주요 비교는 signalCount=3 vs signalCount=4. 0~2는 기존 매수 신호가 아니며, 복원 가능할 때만 참고로 둔다.",
  source:
    "v1 행의 signalCount를 사용한다. OHLCV로 조건 개수를 재계산해 v1과 일치하는지 표본 검증한다.",
  entry: "진입은 신호 다음 거래일 시가(v1 entryDate/entryPrice).",
  success: "기간 수익률 > 0%만 성공. 정확히 0%는 성공이 아니며 별도 집계. 미완성은 분모에서 제외.",
  mae: "MAE는 v1 horizon maxDrawdownPct(진입 후 기간 저가 기준). 수익률과 혼동하지 않는다.",
  split: "v1/v7 학습·검증 신호일 경계를 그대로 쓴다. 같은 날짜는 한쪽에만.",
  bootstrap: "날짜 그룹 단위로 성공률·중앙값 차이 재표본. 그룹 30개 미만이면 유보. CI가 0을 포함하면 확실한 개선으로 말하지 않는다.",
  incomplete: "미완성 수익률을 0%나 실패로 채우지 않는다.",
  noOptimize: "검증 결과를 보고 분류·임계값을 바꾸지 않는다.",
  smallSample: 30,
}

export const VERDICT_LEVELS = ["추가 효용 가능성", "효용 미입증", "위험 증가 가능성", "판정 보류"]

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

function percentile(values, p) {
  const xs = (values || []).filter(finite).map(Number).sort((a, b) => a - b)
  if (!xs.length) return null
  const idx = Math.min(xs.length - 1, Math.max(0, Math.floor((p / 100) * xs.length)))
  return xs[idx]
}

/** Wilson score interval for a proportion, returned as percent points. */
export function wilsonSuccessCi(wins, n, z = 1.96) {
  if (!n || n < 1) return { lo: null, hi: null }
  const p = wins / n
  const z2 = z * z
  const denom = 1 + z2 / n
  const center = p + z2 / (2 * n)
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)
  return {
    lo: round2(((center - margin) / denom) * 100),
    hi: round2(((center + margin) / denom) * 100),
  }
}

/**
 * Count how many of the four frozen DBB conditions are met on a bar-like object.
 * @param {{rsi14?:number|null, stochK?:number|null, bbPctB?:number|null, ma20DevPct?:number|null}} bar
 * @param {typeof FROZEN_THRESHOLDS} [th]
 */
export function countMetConditions(bar, th = FROZEN_THRESHOLDS) {
  return conditionFlags(bar, th)
}

export function classifyStrengthGroup(count) {
  if (count == null || count === "") return "unclassified"
  const n = Number(count)
  if (!Number.isFinite(n) || n < 0) return "unclassified"
  if (n <= 2) return "below_signal"
  if (n === 3) return "three"
  if (n === 4) return "four"
  return "unclassified"
}

function horizonOf(row, days) {
  return row?.horizons?.[String(days)] ?? row?.horizons?.[days] ?? null
}

function completeReturn(row, days) {
  const h = horizonOf(row, days)
  if (h?.priceReturnStatus !== "complete" || !finite(h.priceReturnPct)) return null
  return Number(h.priceReturnPct)
}

function completeMae(row, days) {
  const h = horizonOf(row, days)
  if (h?.maxDrawdownStatus !== "complete" || !finite(h.maxDrawdownPct)) return null
  return Number(h.maxDrawdownPct)
}

function completeExcessQqq(row, days) {
  const h = horizonOf(row, days)
  if (h?.priceReturnStatus !== "complete" || !finite(h.excessQqqPct)) return null
  return Number(h.excessQqqPct)
}

export function summarizeGroup(rows, days = PRIMARY_HORIZON) {
  const list = rows || []
  const returns = list.map((row) => completeReturn(row, days))
  const complete = returns.filter(finite)
  const mae = list.map((row) => completeMae(row, days)).filter(finite)
  const excess = list.map((row) => completeExcessQqq(row, days)).filter(finite)
  const wins = complete.filter((value) => value > 0)
  const losses = complete.filter((value) => value < 0)
  const zeros = complete.filter((value) => value === 0)
  const lossMags = losses.map((value) => Math.abs(value))
  const successCi = wilsonSuccessCi(wins.length, complete.length)
  return {
    signals: list.length,
    complete: complete.length,
    incomplete: list.length - complete.length,
    successCount: wins.length,
    lossCount: losses.length,
    zeroCount: zeros.length,
    successRate: complete.length ? round2((wins.length / complete.length) * 100) : null,
    successRateCi: successCi,
    priceMean: mean(complete),
    priceMedian: median(complete),
    p25: percentile(complete, 25),
    p75: percentile(complete, 75),
    p10: percentile(complete, 10),
    maeMean: mean(mae),
    maeMedian: median(mae),
    lossMedian: median(lossMags),
    deepLoss10Rate: complete.length
      ? round2((complete.filter((value) => value <= -10).length / complete.length) * 100)
      : null,
    excessQqqMedian: median(excess),
  }
}

function groupDiff(four, three) {
  return {
    successRatePp:
      finite(four.successRate) && finite(three.successRate) ? round2(four.successRate - three.successRate) : null,
    priceMedianPp:
      finite(four.priceMedian) && finite(three.priceMedian) ? round2(four.priceMedian - three.priceMedian) : null,
    priceMeanPp: finite(four.priceMean) && finite(three.priceMean) ? round2(four.priceMean - three.priceMean) : null,
    maeMedianPp: finite(four.maeMedian) && finite(three.maeMedian) ? round2(four.maeMedian - three.maeMedian) : null,
    excessQqqPp:
      finite(four.excessQqqMedian) && finite(three.excessQqqMedian)
        ? round2(four.excessQqqMedian - three.excessQqqMedian)
        : null,
    n3: three.complete,
    n4: four.complete,
  }
}

/**
 * Same-day: for dates with both groups present, gap = median4 - median3 (or success rate).
 * Also dates with only one group are counted but not in paired gaps.
 */
export function sameDayStrengthGaps(rows3, rows4, days = PRIMARY_HORIZON) {
  const byDate = new Map()
  for (const row of rows3 || []) {
    if (!row.signalDate) continue
    const bucket = byDate.get(row.signalDate) || { three: [], four: [] }
    bucket.three.push(row)
    byDate.set(row.signalDate, bucket)
  }
  for (const row of rows4 || []) {
    if (!row.signalDate) continue
    const bucket = byDate.get(row.signalDate) || { three: [], four: [] }
    bucket.four.push(row)
    byDate.set(row.signalDate, bucket)
  }

  const pairedReturnGaps = []
  const pairedSuccessGaps = []
  const pairedMaeGaps = []
  let only3 = 0
  let only4 = 0
  let paired = 0

  for (const [, bucket] of [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const r3 = bucket.three.map((row) => completeReturn(row, days)).filter(finite)
    const r4 = bucket.four.map((row) => completeReturn(row, days)).filter(finite)
    const m3 = bucket.three.map((row) => completeMae(row, days)).filter(finite)
    const m4 = bucket.four.map((row) => completeMae(row, days)).filter(finite)
    if (r3.length && r4.length) {
      paired += 1
      const med3 = median(r3)
      const med4 = median(r4)
      pairedReturnGaps.push(round2(med4 - med3))
      const sr3 = (r3.filter((value) => value > 0).length / r3.length) * 100
      const sr4 = (r4.filter((value) => value > 0).length / r4.length) * 100
      pairedSuccessGaps.push(round2(sr4 - sr3))
      if (m3.length && m4.length) pairedMaeGaps.push(round2(median(m4) - median(m3)))
    } else if (r3.length) only3 += 1
    else if (r4.length) only4 += 1
  }

  return {
    dates: byDate.size,
    pairedDates: paired,
    only3Dates: only3,
    only4Dates: only4,
    returnGapMedian: median(pairedReturnGaps),
    returnGapPositiveRate: pairedReturnGaps.length
      ? round2((pairedReturnGaps.filter((value) => value > 0).length / pairedReturnGaps.length) * 100)
      : null,
    successGapMedian: median(pairedSuccessGaps),
    maeGapMedian: median(pairedMaeGaps),
    bootstrapReturn: bootstrapGapMedian(pairedReturnGaps),
    bootstrapSuccess: bootstrapGapMedian(pairedSuccessGaps),
    smallSample: paired < STRENGTH_RULE.smallSample,
  }
}

function leaveOneSymbol(rows3, rows4, days = PRIMARY_HORIZON) {
  const symbols = [...new Set([...(rows3 || []), ...(rows4 || [])].map((row) => row.symbol).filter(Boolean))].sort()
  const base3 = summarizeGroup(rows3, days)
  const base4 = summarizeGroup(rows4, days)
  const baseDiff = groupDiff(base4, base3)
  return symbols
    .map((symbol) => {
      const t3 = (rows3 || []).filter((row) => row.symbol !== symbol)
      const t4 = (rows4 || []).filter((row) => row.symbol !== symbol)
      const diff = groupDiff(summarizeGroup(t4, days), summarizeGroup(t3, days))
      const flipped =
        finite(baseDiff.priceMedianPp) &&
        finite(diff.priceMedianPp) &&
        Math.sign(baseDiff.priceMedianPp) !== 0 &&
        Math.sign(diff.priceMedianPp) !== 0 &&
        Math.sign(baseDiff.priceMedianPp) !== Math.sign(diff.priceMedianPp)
      return {
        symbol,
        priceMedianPp: diff.priceMedianPp,
        successRatePp: diff.successRatePp,
        baselinePriceMedianPp: baseDiff.priceMedianPp,
        flipped,
      }
    })
    .sort(
      (a, b) =>
        Number(b.flipped) - Number(a.flipped) ||
        Math.abs(b.priceMedianPp || 0) - Math.abs(a.priceMedianPp || 0),
    )
    .slice(0, 10)
}

function directionMatch(a, b) {
  if (!finite(a) || !finite(b)) return { status: "비교 불가", match: null }
  if (Math.abs(a) < 0.02 || Math.abs(b) < 0.02) return { status: "비교 불가", match: null }
  return {
    status: Math.sign(a) === Math.sign(b) ? "일치" : "불일치",
    match: Math.sign(a) === Math.sign(b),
  }
}

function judgeStrength({ validationDiff, sameDay60, trainDiff, n3, n4 }) {
  const checks = []
  const sampleOk = n3 >= STRENGTH_RULE.smallSample && n4 >= STRENGTH_RULE.smallSample
  checks.push({
    id: "sample",
    ok: sampleOk,
    detail: `검증 완성 3개=${n3} · 4개=${n4}`,
  })

  const betterReturn = finite(validationDiff?.priceMedianPp) && validationDiff.priceMedianPp > 0
  const betterSuccess = finite(validationDiff?.successRatePp) && validationDiff.successRatePp > 0
  checks.push({
    id: "validationReturn",
    ok: betterReturn,
    detail: `검증 중앙값 차이 ${fmtPct(validationDiff?.priceMedianPp)}`,
  })
  checks.push({
    id: "validationSuccess",
    ok: betterSuccess,
    detail: `검증 성공률 차이 ${fmtPp(validationDiff?.successRatePp)}`,
  })

  const worseMae = finite(validationDiff?.maeMedianPp) && validationDiff.maeMedianPp > 0
  checks.push({
    id: "mae",
    ok: !worseMae,
    detail: `검증 MAE 차이 ${fmtPp(validationDiff?.maeMedianPp)} (양수면 4개가 더 큰 불리)`,
    worsened: worseMae,
  })

  const sameOk = finite(sameDay60?.returnGapMedian) && sameDay60.returnGapMedian > 0
  const boot = sameDay60?.bootstrapReturn
  const ciOk = boot?.status === "ok" && boot.excludesZero && boot.lo > 0
  checks.push({
    id: "sameDay",
    ok: sameOk && Boolean(ciOk),
    detail: `동일일 중앙값차 ${fmtPct(sameDay60?.returnGapMedian)} · 쌍 ${sameDay60?.pairedDates ?? 0} · CI ${
      boot?.status === "ok" ? `${fmtPct(boot.lo)}~${fmtPct(boot.hi)}` : "유보"
    }`,
  })

  const repro = directionMatch(trainDiff?.priceMedianPp, validationDiff?.priceMedianPp)
  checks.push({ id: "repro", ok: repro.match === true, detail: `학습·검증 중앙값 방향 ${repro.status}` })

  if (!sampleOk || (sameDay60?.pairedDates ?? 0) < 10) {
    return { level: "판정 보류", reason: "표본 또는 동일일 쌍이 부족", checks }
  }
  if ((betterReturn || betterSuccess) && worseMae) {
    return { level: "위험 증가 가능성", reason: "검증 수익/성공률은 유리하나 MAE가 악화", checks }
  }
  if (betterReturn && betterSuccess && sameOk && ciOk && repro.match && !worseMae) {
    return {
      level: "추가 효용 가능성",
      reason: "검증·동일일·CI·재현이 뒷받침(채택·자동규칙은 적용하지 않음)",
      checks,
    }
  }
  return { level: "효용 미입증", reason: "검증·동일일·불확실성 조건을 함께 충족하지 못함", checks }
}

/**
 * Recompute condition count at signal date from bars; compare to v1.signalCount.
 */
export function verifySignalCounts(rows, seriesBySymbol, sampleLimit = 80) {
  const sample = (rows || []).filter((row) => row.signalDate && finite(row.signalCount)).slice(0, sampleLimit)
  let matched = 0
  let mismatched = 0
  let missingBars = 0
  const mismatches = []
  for (const row of sample) {
    const bars = seriesBySymbol[row.symbol]
    if (!bars?.length) {
      missingBars += 1
      continue
    }
    const enriched = enrichBarsWithIndicators(bars)
    const idx = enriched.findIndex((bar) => bar.date === row.signalDate)
    if (idx < 0) {
      missingBars += 1
      continue
    }
    const flags = conditionFlags(enriched[idx], FROZEN_THRESHOLDS)
    if (flags.count === Number(row.signalCount)) matched += 1
    else {
      mismatched += 1
      if (mismatches.length < 8) {
        mismatches.push({
          id: row.id,
          stored: row.signalCount,
          recomputed: flags.count,
          flags: { rsi: flags.rsi, stoch: flags.stoch, bb: flags.bb, ma: flags.ma },
        })
      }
    }
  }
  return {
    sampled: sample.length,
    matched,
    mismatched,
    missingBars,
    ok: mismatched === 0 && matched > 0,
    mismatches,
    thresholds: FROZEN_THRESHOLDS,
  }
}

function analyzeSlice(rows3, rows4, label) {
  const byHorizon = Object.fromEntries(
    HORIZONS.map((days) => {
      const three = summarizeGroup(rows3, days)
      const four = summarizeGroup(rows4, days)
      return [
        String(days),
        {
          three,
          four,
          diff: groupDiff(four, three),
          sameDay: sameDayStrengthGaps(rows3, rows4, days),
        },
      ]
    }),
  )
  return { label, n3: rows3.length, n4: rows4.length, byHorizon }
}

/**
 * @param {object} v1Report
 * @param {Record<string, object[]>} [seriesBySymbol] optional for verification
 */
export function analyzeSignalStrength(v1Report, seriesBySymbol = {}) {
  const split = v1Report?.split
  if (!split?.trainEndDate || !split?.validationStartDate) throw new Error("v1 split required")
  const rows = (v1Report?.rows || []).filter((row) => row?.signalDate)
  const unclassified = rows.filter((row) => ![3, 4].includes(Number(row.signalCount)))
  const rows3 = rows.filter((row) => Number(row.signalCount) === 3)
  const rows4 = rows.filter((row) => Number(row.signalCount) === 4)

  const verification =
    seriesBySymbol && Object.keys(seriesBySymbol).length
      ? verifySignalCounts(rows, seriesBySymbol)
      : { sampled: 0, matched: 0, mismatched: 0, missingBars: 0, ok: null, note: "OHLCV 미제공 — 건수 재검증 생략" }

  const train3 = rows3.filter((row) => row.signalDate <= split.trainEndDate)
  const train4 = rows4.filter((row) => row.signalDate <= split.trainEndDate)
  const val3 = rows3.filter((row) => row.signalDate >= split.validationStartDate)
  const val4 = rows4.filter((row) => row.signalDate >= split.validationStartDate)

  const overall = analyzeSlice(rows3, rows4, "전체")
  const train = analyzeSlice(train3, train4, "학습")
  const validation = analyzeSlice(val3, val4, "검증")

  const tableA = {
    three: { signals: rows3.length, sharePct: rows.length ? round2((rows3.length / rows.length) * 100) : null },
    four: { signals: rows4.length, sharePct: rows.length ? round2((rows4.length / rows.length) * 100) : null },
    unclassified: unclassified.length,
    total: rows.length,
  }

  const tableB = HORIZONS.flatMap((days) => {
    const key = String(days)
    const block = overall.byHorizon[key]
    return [
      { horizon: days, group: 3, ...block.three },
      { horizon: days, group: 4, ...block.four },
    ]
  })

  const tableC = Object.fromEntries(
    HORIZONS.map((days) => {
      const key = String(days)
      const block = overall.byHorizon[key]
      return [
        key,
        {
          ...block.diff,
          sameDay: block.sameDay,
          bootstrapReturn: block.sameDay.bootstrapReturn,
        },
      ]
    }),
  )

  const verdict = judgeStrength({
    validationDiff: validation.byHorizon["60"].diff,
    sameDay60: validation.byHorizon["60"].sameDay,
    trainDiff: train.byHorizon["60"].diff,
    n3: validation.byHorizon["60"].three.complete,
    n4: validation.byHorizon["60"].four.complete,
  })

  return {
    version: CHART_QUALITY_V8,
    researchOnly: true,
    source: "dbb_chart_quality_v1_signalCount_3_vs_4",
    asOf: v1Report?.asOf ?? null,
    rule: STRENGTH_RULE,
    verdictLevels: VERDICT_LEVELS,
    split,
    verification,
    counts: {
      signals: rows.length,
      three: rows3.length,
      four: rows4.length,
      unclassified: unclassified.length,
      trainThree: train3.length,
      trainFour: train4.length,
      validationThree: val3.length,
      validationFour: val4.length,
      incompleteByHorizon: Object.fromEntries(
        HORIZONS.map((days) => {
          const key = String(days)
          return [key, rows.filter((row) => completeReturn(row, days) == null).length]
        }),
      ),
    },
    tableA,
    tableB,
    tableC,
    overall,
    train,
    validation,
    sensitivity: leaveOneSymbol(val3, val4, PRIMARY_HORIZON),
    direction: {
      priceMedian: directionMatch(train.byHorizon["60"].diff.priceMedianPp, validation.byHorizon["60"].diff.priceMedianPp),
      successRate: directionMatch(
        train.byHorizon["60"].diff.successRatePp,
        validation.byHorizon["60"].diff.successRatePp,
      ),
    },
    verdict,
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
