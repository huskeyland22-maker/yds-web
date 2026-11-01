/**
 * DBB signal-strength v9 — concentration, regime, excess QQQ (research only).
 * Reuses v8 baselines. Does not modify v1~v8, engine, or trades.
 * Judgment rules are fixed before reading outcomes.
 */
import { buildRegimeByDate, REGIME_LABEL, REGIME_ORDER, REGIME_RULE } from "../../vite-project/src/content/etfSignalRegimeV3.js"
import { bootstrapGapMedian } from "./dbb-chart-quality-v2.mjs"
import { HORIZONS, PRIMARY_HORIZON } from "./dbb-chart-quality-v3.mjs"
import {
  analyzeSignalStrength,
  sameDayStrengthGaps,
  summarizeGroup,
  STRENGTH_RULE as V8_STRENGTH_RULE,
} from "./dbb-chart-quality-v8.mjs"

export const CHART_QUALITY_V9 = 9
export { HORIZONS, PRIMARY_HORIZON, REGIME_ORDER, REGIME_LABEL, REGIME_RULE }

/** Fixed before reading A/B/C/D outcomes. */
export const ROBUSTNESS_RULE = {
  purpose:
    "v8에서 관찰된 4개 충족 우위가 종목 편중·국면·시장 초과수익·날짜 상관에 얼마나 의존하는지 본다. 매수 기준은 바꾸지 않는다.",
  reuse:
    "유니버스·임계값·rising-edge 에피소드·다음 시가 진입·학습/검증 분할·20/60/120일을 v8과 동일하게 쓴다.",
  studyA: "종목별 건수·성과·기여도와 leave-one-ticker-out. 제외 후 좋아졌다는 이유로 유니버스에서 제거하지 않는다.",
  studyB:
    "국면은 ETF 신호 국면 v3 / classifyTrendRegime과 동일한 QQQ MA50/MA200/기울기 규칙. 신호일 종가만 사용.",
  studyC: "초과수익 = 종목 기간수익률 − 동일 기간 QQQ. v8 전체 60일 초과차 ≈ −0.21%p 재현 여부를 확인한다.",
  studyD: "동일일 중앙값 차이와 날짜 단위 부트스트랩을 v8과 같은 방식으로 재사용한다. CI가 0을 포함하면 판정을 바꾸지 않는다.",
  noCherryPick: "검증·국면·종목 결과를 보고 유리한 구간만 선택하지 않는다.",
  incomplete: "미완성 수익률을 0%나 실패로 채우지 않는다.",
  smallSample: 30,
  exploratorySample: 15,
  v8ExcessOverall60Expected: -0.21,
  v8ExcessTolerancePp: 0.05,
}

export const VERDICT_LEVELS = ["효용 가능성", "효용 미입증", "국면 제한 가능성", "판정 보류"]

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

function completeQqqReturn(row, days) {
  const h = horizonOf(row, days)
  if (h?.priceReturnStatus !== "complete" || !finite(h.qqqReturnPct)) return null
  return Number(h.qqqReturnPct)
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

function summarizeExcess(rows, days = PRIMARY_HORIZON) {
  const list = rows || []
  const excess = list.map((row) => completeExcessQqq(row, days)).filter(finite)
  const abs = list.map((row) => completeReturn(row, days)).filter(finite)
  const qqq = list.map((row) => completeQqqReturn(row, days)).filter(finite)
  const missingExcess = list.filter((row) => {
    const h = horizonOf(row, days)
    return h?.priceReturnStatus === "complete" && !finite(h.excessQqqPct)
  }).length
  return {
    signals: list.length,
    completeAbs: abs.length,
    completeExcess: excess.length,
    missingExcess,
    absMedian: median(abs),
    absMean: mean(abs),
    qqqMedian: median(qqq),
    excessMedian: median(excess),
    excessMean: mean(excess),
    excessPositiveRate: excess.length
      ? round2((excess.filter((value) => value > 0).length / excess.length) * 100)
      : null,
  }
}

/**
 * Same-day excess gaps (median4 − median3) with date-cluster bootstrap.
 */
export function sameDayExcessGaps(rows3, rows4, days = PRIMARY_HORIZON) {
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

  const pairedGaps = []
  let only3 = 0
  let only4 = 0
  let paired = 0
  for (const [, bucket] of [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const e3 = bucket.three.map((row) => completeExcessQqq(row, days)).filter(finite)
    const e4 = bucket.four.map((row) => completeExcessQqq(row, days)).filter(finite)
    if (e3.length && e4.length) {
      paired += 1
      pairedGaps.push(round2(median(e4) - median(e3)))
    } else if (e3.length) only3 += 1
    else if (e4.length) only4 += 1
  }

  return {
    dates: byDate.size,
    pairedDates: paired,
    only3Dates: only3,
    only4Dates: only4,
    excessGapMedian: median(pairedGaps),
    excessGapPositiveRate: pairedGaps.length
      ? round2((pairedGaps.filter((value) => value > 0).length / pairedGaps.length) * 100)
      : null,
    bootstrapExcess: bootstrapGapMedian(pairedGaps),
    smallSample: paired < ROBUSTNESS_RULE.smallSample,
  }
}

function symbolStats(rows, days = PRIMARY_HORIZON) {
  const bySymbol = new Map()
  for (const row of rows || []) {
    if (!row.symbol) continue
    if (!bySymbol.has(row.symbol)) bySymbol.set(row.symbol, [])
    bySymbol.get(row.symbol).push(row)
  }
  const pooled = summarizeGroup(rows, days)
  const pooledReturns = (rows || []).map((row) => completeReturn(row, days)).filter(finite)
  const pooledSum = pooledReturns.reduce((sum, value) => sum + value, 0)

  return [...bySymbol.entries()]
    .map(([symbol, list]) => {
      const summary = summarizeGroup(list, days)
      const returns = list.map((row) => completeReturn(row, days)).filter(finite)
      const sum = returns.reduce((acc, value) => acc + value, 0)
      const contributionPct =
        pooledReturns.length && Number.isFinite(pooledSum) && Math.abs(pooledSum) > 1e-9
          ? round2((sum / pooledSum) * 100)
          : null
      return {
        symbol,
        signals: list.length,
        complete: summary.complete,
        incomplete: summary.incomplete,
        successRate: summary.successRate,
        priceMedian: summary.priceMedian,
        priceMean: summary.priceMean,
        maeMedian: summary.maeMedian,
        excessQqqMedian: summary.excessQqqMedian,
        contributionPct,
        sharePct: pooled.signals ? round2((list.length / pooled.signals) * 100) : null,
      }
    })
    .sort((a, b) => b.signals - a.signals || a.symbol.localeCompare(b.symbol))
}

/**
 * Leave-one-ticker-out for 3-vs-4 gaps.
 */
export function leaveOneTickerOut(rows3, rows4, days = PRIMARY_HORIZON) {
  const symbols = [...new Set([...(rows3 || []), ...(rows4 || [])].map((row) => row.symbol).filter(Boolean))].sort()
  const base3 = summarizeGroup(rows3, days)
  const base4 = summarizeGroup(rows4, days)
  const baseDiff = groupDiff(base4, base3)
  const rows = symbols.map((symbol) => {
    const t3 = (rows3 || []).filter((row) => row.symbol !== symbol)
    const t4 = (rows4 || []).filter((row) => row.symbol !== symbol)
    const diff = groupDiff(summarizeGroup(t4, days), summarizeGroup(t3, days))
    const flipMedian =
      finite(baseDiff.priceMedianPp) &&
      finite(diff.priceMedianPp) &&
      Math.sign(baseDiff.priceMedianPp) !== 0 &&
      Math.sign(diff.priceMedianPp) !== 0 &&
      Math.sign(baseDiff.priceMedianPp) !== Math.sign(diff.priceMedianPp)
    const flipSuccess =
      finite(baseDiff.successRatePp) &&
      finite(diff.successRatePp) &&
      Math.sign(baseDiff.successRatePp) !== 0 &&
      Math.sign(diff.successRatePp) !== 0 &&
      Math.sign(baseDiff.successRatePp) !== Math.sign(diff.successRatePp)
    return {
      symbol,
      removedSignals3: (rows3 || []).filter((row) => row.symbol === symbol).length,
      removedSignals4: (rows4 || []).filter((row) => row.symbol === symbol).length,
      ...diff,
      flipMedian,
      flipSuccess,
      deltaVsBaselineMedianPp:
        finite(diff.priceMedianPp) && finite(baseDiff.priceMedianPp)
          ? round2(diff.priceMedianPp - baseDiff.priceMedianPp)
          : null,
    }
  })

  const medianGaps = rows.map((row) => row.priceMedianPp).filter(finite)
  const successGaps = rows.map((row) => row.successRatePp).filter(finite)
  return {
    baseline: baseDiff,
    symbols: rows.sort(
      (a, b) =>
        Number(b.flipMedian) - Number(a.flipMedian) ||
        Number(b.flipSuccess) - Number(a.flipSuccess) ||
        Math.abs(b.deltaVsBaselineMedianPp || 0) - Math.abs(a.deltaVsBaselineMedianPp || 0),
    ),
    summary: {
      symbolCount: symbols.length,
      priceMedianPpMin: medianGaps.length ? Math.min(...medianGaps) : null,
      priceMedianPpMax: medianGaps.length ? Math.max(...medianGaps) : null,
      successRatePpMin: successGaps.length ? Math.min(...successGaps) : null,
      successRatePpMax: successGaps.length ? Math.max(...successGaps) : null,
      flipMedianCount: rows.filter((row) => row.flipMedian).length,
      flipSuccessCount: rows.filter((row) => row.flipSuccess).length,
    },
  }
}

function topContributorImpact(rows3, rows4, symbolStatsFour, days = PRIMARY_HORIZON, topN = 3) {
  const top = (symbolStatsFour || []).slice().sort((a, b) => (b.contributionPct || 0) - (a.contributionPct || 0)).slice(0, topN)
  const drop = new Set(top.map((row) => row.symbol))
  const t3 = (rows3 || []).filter((row) => !drop.has(row.symbol))
  const t4 = (rows4 || []).filter((row) => !drop.has(row.symbol))
  const base = groupDiff(summarizeGroup(rows4, days), summarizeGroup(rows3, days))
  const after = groupDiff(summarizeGroup(t4, days), summarizeGroup(t3, days))
  return {
    dropped: top.map((row) => row.symbol),
    baseline: base,
    afterDrop: after,
    stillPositiveMedian: finite(after.priceMedianPp) ? after.priceMedianPp > 0 : null,
    stillPositiveSuccess: finite(after.successRatePp) ? after.successRatePp > 0 : null,
  }
}

function analyzeSlice(rows3, rows4, label) {
  const byHorizon = Object.fromEntries(
    HORIZONS.map((days) => {
      const three = summarizeGroup(rows3, days)
      const four = summarizeGroup(rows4, days)
      const threeExcess = summarizeExcess(rows3, days)
      const fourExcess = summarizeExcess(rows4, days)
      return [
        String(days),
        {
          three,
          four,
          diff: groupDiff(four, three),
          excess: {
            three: threeExcess,
            four: fourExcess,
            diffPp:
              finite(fourExcess.excessMedian) && finite(threeExcess.excessMedian)
                ? round2(fourExcess.excessMedian - threeExcess.excessMedian)
                : null,
          },
          sameDay: sameDayStrengthGaps(rows3, rows4, days),
          sameDayExcess: sameDayExcessGaps(rows3, rows4, days),
        },
      ]
    }),
  )
  return { label, n3: rows3.length, n4: rows4.length, byHorizon }
}

/**
 * Attach QQQ regime at signal date (no future closes).
 */
export function attachRegimes(rows, qqqBars) {
  const byDate = buildRegimeByDate(qqqBars || [])
  let missing = 0
  const attached = (rows || []).map((row) => {
    const regime = byDate.get(row.signalDate) || "unclassified"
    if (regime === "unclassified") missing += 1
    return { ...row, regime }
  })
  return { rows: attached, missing, byDateSize: byDate.size }
}

/**
 * Ensure regime at date D ignores closes after D.
 */
export function regimeUsesOnlyPast(qqqBars, signalDate) {
  const all = buildRegimeByDate(qqqBars)
  const clipped = (qqqBars || []).filter((bar) => bar.date <= signalDate)
  const clippedMap = buildRegimeByDate(clipped)
  return {
    signalDate,
    full: all.get(signalDate) || "unclassified",
    clipped: clippedMap.get(signalDate) || "unclassified",
    match: (all.get(signalDate) || "unclassified") === (clippedMap.get(signalDate) || "unclassified"),
  }
}

/**
 * Compare frozen v8 JSON key metrics to a fresh recompute from v1.
 */
export function compareToV8(v8Report, recomputed) {
  const checks = []
  const push = (id, ok, detail, expected, actual) => checks.push({ id, ok, detail, expected, actual })

  push(
    "counts",
    v8Report?.counts?.three === recomputed?.counts?.three && v8Report?.counts?.four === recomputed?.counts?.four,
    "3/4 신호 건수",
    { three: v8Report?.counts?.three, four: v8Report?.counts?.four },
    { three: recomputed?.counts?.three, four: recomputed?.counts?.four },
  )

  const e8 = v8Report?.tableC?.["60"]?.excessQqqPp
  const eR = recomputed?.tableC?.["60"]?.excessQqqPp
  push(
    "excess60",
    finite(e8) && finite(eR) && Math.abs(e8 - eR) <= ROBUSTNESS_RULE.v8ExcessTolerancePp,
    "전체 60일 초과수익 차이",
    e8,
    eR,
  )

  const m8 = v8Report?.tableC?.["60"]?.priceMedianPp
  const mR = recomputed?.tableC?.["60"]?.priceMedianPp
  push(
    "median60",
    finite(m8) && finite(mR) && Math.abs(m8 - mR) <= ROBUSTNESS_RULE.v8ExcessTolerancePp,
    "전체 60일 중앙값 차이",
    m8,
    mR,
  )

  const s8 = v8Report?.tableC?.["60"]?.successRatePp
  const sR = recomputed?.tableC?.["60"]?.successRatePp
  push(
    "success60",
    finite(s8) && finite(sR) && Math.abs(s8 - sR) <= ROBUSTNESS_RULE.v8ExcessTolerancePp,
    "전체 60일 성공률 차이",
    s8,
    sR,
  )

  push(
    "split",
    v8Report?.split?.trainEndDate === recomputed?.split?.trainEndDate &&
      v8Report?.split?.validationStartDate === recomputed?.split?.validationStartDate,
    "학습·검증 경계",
    {
      trainEndDate: v8Report?.split?.trainEndDate,
      validationStartDate: v8Report?.split?.validationStartDate,
    },
    {
      trainEndDate: recomputed?.split?.trainEndDate,
      validationStartDate: recomputed?.split?.validationStartDate,
    },
  )

  push("verdict", v8Report?.verdict?.level === recomputed?.verdict?.level, "v8 판정", v8Report?.verdict?.level, recomputed?.verdict?.level)

  const nearExpected =
    finite(eR) && Math.abs(eR - ROBUSTNESS_RULE.v8ExcessOverall60Expected) <= ROBUSTNESS_RULE.v8ExcessTolerancePp
  push("v8PublishedExcess", nearExpected, "게시된 전체 초과차 ≈ −0.21%p", ROBUSTNESS_RULE.v8ExcessOverall60Expected, eR)

  return {
    ok: checks.every((check) => check.ok),
    checks,
  }
}

function judgeRobustness({
  v8Match,
  validation,
  leaveOut,
  regimes,
  overallExcess,
  validationExcess,
  sameDay,
  sameDayExcess,
}) {
  const checks = []
  if (!v8Match?.ok) {
    return {
      level: "판정 보류",
      reason: "v8 재현 불일치 — 원인 확인 전 결론을 내리지 않음",
      checks: [{ id: "v8", ok: false, detail: "v8 키 지표 불일치" }],
    }
  }

  const valDiff = validation?.byHorizon?.["60"]?.diff
  const n3 = valDiff?.n3 ?? 0
  const n4 = valDiff?.n4 ?? 0
  const sampleOk = n3 >= ROBUSTNESS_RULE.smallSample && n4 >= ROBUSTNESS_RULE.smallSample
  checks.push({ id: "sample", ok: sampleOk, detail: `검증 완성 3개=${n3} · 4개=${n4}` })

  const betterReturn = finite(valDiff?.priceMedianPp) && valDiff.priceMedianPp > 0
  const betterSuccess = finite(valDiff?.successRatePp) && valDiff.successRatePp > 0
  checks.push({
    id: "validation",
    ok: betterReturn && betterSuccess,
    detail: `검증 중앙값 ${fmtPp(valDiff?.priceMedianPp)} · 성공률 ${fmtPp(valDiff?.successRatePp)}`,
  })

  const flips = leaveOut?.summary?.flipMedianCount ?? 0
  const concentrationOk = flips === 0
  checks.push({
    id: "concentration",
    ok: concentrationOk,
    detail: `leave-one-out 중앙값 부호반전 ${flips}종목 / 범위 ${fmtPp(leaveOut?.summary?.priceMedianPpMin)}~${fmtPp(
      leaveOut?.summary?.priceMedianPpMax,
    )}`,
  })

  const excessVal = validationExcess?.diffPp
  const excessAll = overallExcess?.diffPp
  const marketOk = finite(excessVal) && excessVal > 0
  checks.push({
    id: "excess",
    ok: marketOk,
    detail: `초과수익 차이 전체 ${fmtPp(excessAll)} · 검증 ${fmtPp(excessVal)}`,
  })

  const boot = sameDay?.bootstrapReturn
  const dateOk = boot?.status === "ok" && boot.excludesZero && boot.lo > 0
  checks.push({
    id: "sameDay",
    ok: Boolean(dateOk),
    detail: `동일일 중앙값차 ${fmtPct(sameDay?.returnGapMedian)} · CI ${
      boot?.status === "ok" ? `${fmtPct(boot.lo)}~${fmtPct(boot.hi)}` : "유보"
    }`,
  })

  const excessBoot = sameDayExcess?.bootstrapExcess
  const excessDateOk = excessBoot?.status === "ok" && excessBoot.excludesZero && excessBoot.lo > 0
  checks.push({
    id: "sameDayExcess",
    ok: Boolean(excessDateOk),
    detail: `동일일 초과차 ${fmtPct(sameDayExcess?.excessGapMedian)} · CI ${
      excessBoot?.status === "ok" ? `${fmtPct(excessBoot.lo)}~${fmtPct(excessBoot.hi)}` : "유보"
    }`,
  })

  const regimeKeys = ["bull", "bear", "sideways"]
  const regimeDiffs = regimeKeys.map((key) => ({
    key,
    completeEnough:
      (regimes?.[key]?.byHorizon?.["60"]?.diff?.n3 ?? 0) >= ROBUSTNESS_RULE.exploratorySample &&
      (regimes?.[key]?.byHorizon?.["60"]?.diff?.n4 ?? 0) >= ROBUSTNESS_RULE.exploratorySample,
    positive:
      finite(regimes?.[key]?.byHorizon?.["60"]?.diff?.priceMedianPp) &&
      regimes[key].byHorizon["60"].diff.priceMedianPp > 0,
    medianPp: regimes?.[key]?.byHorizon?.["60"]?.diff?.priceMedianPp ?? null,
  }))
  const usableRegimes = regimeDiffs.filter((row) => row.completeEnough)
  const positiveRegimes = usableRegimes.filter((row) => row.positive)
  const allRegimesPositive = usableRegimes.length >= 2 && positiveRegimes.length === usableRegimes.length
  const someOnly = usableRegimes.length >= 2 && positiveRegimes.length >= 1 && positiveRegimes.length < usableRegimes.length
  checks.push({
    id: "regimes",
    ok: allRegimesPositive,
    detail: usableRegimes
      .map((row) => `${REGIME_LABEL[row.key]} ${fmtPp(row.medianPp)}${row.completeEnough ? "" : "(탐색)"}`)
      .join(" · "),
  })

  if (!sampleOk) {
    return { level: "판정 보류", reason: "검증 표본 부족", checks }
  }
  if (someOnly && !(dateOk && marketOk && concentrationOk)) {
    return {
      level: "국면 제한 가능성",
      reason: "사전 정의 국면 중 일부에서만 중앙값 우위가 관찰됨(별도 검증 후보)",
      checks,
      regimeDetail: regimeDiffs,
    }
  }
  if (betterReturn && betterSuccess && concentrationOk && marketOk && dateOk && excessDateOk && allRegimesPositive) {
    return {
      level: "효용 가능성",
      reason: "검증·편중·초과수익·날짜 CI·국면이 함께 뒷받침(채택·자동규칙은 적용하지 않음)",
      checks,
      regimeDetail: regimeDiffs,
    }
  }
  return {
    level: "효용 미입증",
    reason: "개선 방향이 있어도 날짜 CI·시장 대비·편중·국면 조건을 함께 충족하지 못함",
    checks,
    regimeDetail: regimeDiffs,
  }
}

/**
 * @param {object} v1Report
 * @param {object} v8Report frozen v8 JSON
 * @param {object[]} qqqBars
 */
export function analyzeRobustness(v1Report, v8Report, qqqBars = []) {
  const split = v1Report?.split
  if (!split?.trainEndDate || !split?.validationStartDate) throw new Error("v1 split required")
  if (!v8Report?.counts) throw new Error("v8 report required")

  const recomputedV8 = analyzeSignalStrength(v1Report)
  const v8Match = compareToV8(v8Report, recomputedV8)
  if (!v8Match.ok) {
    return {
      version: CHART_QUALITY_V9,
      researchOnly: true,
      asOf: v1Report?.asOf ?? null,
      rule: ROBUSTNESS_RULE,
      verdictLevels: VERDICT_LEVELS,
      v8Match,
      verdict: {
        level: "판정 보류",
        reason: "v8 재현 불일치 — 분석을 중단하고 원인을 보고함",
        checks: v8Match.checks,
      },
      aborted: true,
    }
  }

  const rows = (v1Report?.rows || []).filter((row) => row?.signalDate && [3, 4].includes(Number(row.signalCount)))
  const rows3 = rows.filter((row) => Number(row.signalCount) === 3)
  const rows4 = rows.filter((row) => Number(row.signalCount) === 4)
  const train3 = rows3.filter((row) => row.signalDate <= split.trainEndDate)
  const train4 = rows4.filter((row) => row.signalDate <= split.trainEndDate)
  const val3 = rows3.filter((row) => row.signalDate >= split.validationStartDate)
  const val4 = rows4.filter((row) => row.signalDate >= split.validationStartDate)

  const overall = analyzeSlice(rows3, rows4, "전체")
  const train = analyzeSlice(train3, train4, "학습")
  const validation = analyzeSlice(val3, val4, "검증")

  // Study A
  const bySymbol = {
    three: Object.fromEntries(HORIZONS.map((days) => [String(days), symbolStats(rows3, days)])),
    four: Object.fromEntries(HORIZONS.map((days) => [String(days), symbolStats(rows4, days)])),
  }
  const leaveOutOverall = leaveOneTickerOut(rows3, rows4, PRIMARY_HORIZON)
  const leaveOutValidation = leaveOneTickerOut(val3, val4, PRIMARY_HORIZON)
  const dropTop3 = topContributorImpact(rows3, rows4, bySymbol.four["60"], PRIMARY_HORIZON, 3)

  // Study B — regimes from QQQ as-of signal date
  const attached = attachRegimes(rows, qqqBars)
  const regimes = Object.fromEntries(
    REGIME_ORDER.map((key) => {
      const r3 = attached.rows.filter((row) => row.regime === key && Number(row.signalCount) === 3)
      const r4 = attached.rows.filter((row) => row.regime === key && Number(row.signalCount) === 4)
      const slice = analyzeSlice(r3, r4, REGIME_LABEL[key] || key)
      const nComplete60 = (slice.byHorizon["60"].diff.n3 || 0) + (slice.byHorizon["60"].diff.n4 || 0)
      return [
        key,
        {
          ...slice,
          exploratory: nComplete60 < ROBUSTNESS_RULE.smallSample * 2,
          label: REGIME_LABEL[key] || key,
        },
      ]
    }),
  )

  const leakCheckDates = [...new Set(rows.map((row) => row.signalDate))].sort().slice(0, 5)
  const leakChecks = leakCheckDates.map((date) => regimeUsesOnlyPast(qqqBars, date))

  // Study C / D already in slices
  const verdict = judgeRobustness({
    v8Match,
    validation,
    leaveOut: leaveOutValidation,
    regimes,
    overallExcess: overall.byHorizon["60"].excess,
    validationExcess: validation.byHorizon["60"].excess,
    sameDay: validation.byHorizon["60"].sameDay,
    sameDayExcess: validation.byHorizon["60"].sameDayExcess,
  })

  return {
    version: CHART_QUALITY_V9,
    researchOnly: true,
    source: "dbb_chart_quality_v1_plus_v8_robustness",
    asOf: v1Report?.asOf ?? null,
    rule: { ...ROBUSTNESS_RULE, v8: V8_STRENGTH_RULE.purpose, regime: REGIME_RULE },
    verdictLevels: VERDICT_LEVELS,
    split,
    v8Match,
    aborted: false,
    counts: {
      signals: rows.length,
      three: rows3.length,
      four: rows4.length,
      trainThree: train3.length,
      trainFour: train4.length,
      validationThree: val3.length,
      validationFour: val4.length,
      regimeMissing: attached.missing,
      qqqRegimeDates: attached.byDateSize,
      incompleteByHorizon: Object.fromEntries(
        HORIZONS.map((days) => [
          String(days),
          rows.filter((row) => completeReturn(row, days) == null).length,
        ]),
      ),
      missingExcessByHorizon: Object.fromEntries(
        HORIZONS.map((days) => [
          String(days),
          rows.filter((row) => {
            const h = horizonOf(row, days)
            return h?.priceReturnStatus === "complete" && !finite(h.excessQqqPct)
          }).length,
        ]),
      ),
    },
    studyA: {
      bySymbol60: {
        three: bySymbol.three["60"],
        four: bySymbol.four["60"],
      },
      leaveOutOverall,
      leaveOutValidation,
      dropTop3Contributors: dropTop3,
    },
    studyB: {
      definition: REGIME_RULE,
      labels: REGIME_LABEL,
      leakChecks,
      regimes,
    },
    studyC: {
      overall60: overall.byHorizon["60"].excess,
      train60: train.byHorizon["60"].excess,
      validation60: validation.byHorizon["60"].excess,
      v8PublishedExcessDiffPp: ROBUSTNESS_RULE.v8ExcessOverall60Expected,
      reproducedExcessDiffPp: overall.byHorizon["60"].excess.diffPp,
      sameDayExcess: {
        overall: overall.byHorizon["60"].sameDayExcess,
        train: train.byHorizon["60"].sameDayExcess,
        validation: validation.byHorizon["60"].sameDayExcess,
      },
    },
    studyD: {
      overall: overall.byHorizon["60"].sameDay,
      train: train.byHorizon["60"].sameDay,
      validation: validation.byHorizon["60"].sameDay,
      method:
        "날짜별 중앙값(또는 성공률) 차이 벡터를 날짜 단위로 재표본. 개별 종목 신호를 독립 추출하지 않음.",
    },
    overall,
    train,
    validation,
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
