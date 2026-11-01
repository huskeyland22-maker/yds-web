/**
 * DBB chart quality v3 — per-component validity (research only).
 * Recomputes v1 part details from OHLCV through the signal day only.
 * Does not change v1/v2 files, weights, or buy thresholds.
 * Methods are fixed before reading outcome relationships.
 */
import {
  HORIZONS as V1_HORIZONS,
  MARKET_BENCHMARK,
  SCORE_RULE,
  SECTOR_BENCHMARK,
  scoreChartAtSignal,
} from "./dbb-chart-quality-v1.mjs"
import { SAME_DAY_RULE, bootstrapGapMedian, pickTopTied } from "./dbb-chart-quality-v2.mjs"

export const CHART_QUALITY_V3 = 3
export const HORIZONS = V1_HORIZONS
export const PRIMARY_HORIZON = 60
export const COMPONENTS = ["A", "B", "C", "D", "E"]

/** Fixed before reading component–outcome relationships. */
export const COMPONENT_RULE = {
  source: "v1 SCORE_RULE과 scoreChartAtSignal을 그대로 쓴다. 가중치·산식·방향을 결과에 맞춰 바꾸지 않는다.",
  raw:
    "v1 JSON에는 항목 점수만 있으므로 신호일 종가까지의 OHLCV로 세부값을 다시 계산하고, 항목 점수가 저장된 v1 값과 같은지 확인한다.",
  assumedDirection: "항목 점수가 높을수록 이후 성과가 낫다는 가설을 두되, 실제 부호가 반대면 그대로 보고한다.",
  tertile: "항목 점수가 있는 신호를 점수 내림차순으로 나눠 상위·중간·하위 약 1/3로 비교한다. 경계 동점은 같은 점수를 모두 포함한다.",
  sameDay:
    "v2와 같이 같은 신호일만 묶는다. 해당 항목 점수가 있는 종목만 순위에 넣고, 2개 미만이면 비교에서 뺀다. 최고점 동점은 모두 상위이며 상위 성과는 평균, 나머지는 중앙값이다.",
  split: "v1에 고정된 학습·검증 신호일 경계를 그대로 쓴다.",
  correlation: "스피어만 상관은 기술 통계이며 원인·예측력을 주장하지 않는다. 여러 항목·기간을 동시에 보면 우연한 상관이 날 수 있다.",
  bootstrap: "동일 신호일 그룹 단위 재표본은 비교 가능 그룹 30개 이상일 때만 한다.",
  incomplete: "미완료 수익률은 제외하고 0으로 채우지 않는다. 결측 항목 점수는 0점으로 두지 않는다.",
  smallSample: 30,
}

/** Continuous raw fields taken from v1 score detail objects. */
export const COMPONENT_METRICS = {
  A: [
    { id: "score", label: "A 점수", path: ["score"] },
    { id: "vs200", label: "종가 대비 SMA200(%)", path: ["detail", "vs200"] },
    { id: "vs60", label: "종가 대비 SMA60(%)", path: ["detail", "vs60"] },
    { id: "slope60", label: "SMA60 20일 기울기(%)", path: ["detail", "slope60"] },
    { id: "slope200", label: "SMA200 20일 기울기(%)", path: ["detail", "slope200"] },
  ],
  B: [
    { id: "score", label: "B 점수", path: ["score"] },
    { id: "lowChange", label: "저점 변화(%)", path: ["detail", "lowChange"] },
    { id: "drawdown", label: "60일 고점 대비(%)", path: ["detail", "drawdown"] },
    { id: "ret20", label: "20일 수익률(%)", path: ["detail", "ret20"] },
    { id: "ret60", label: "60일 수익률(%)", path: ["detail", "ret60"] },
    { id: "distLow", label: "60일 저점 거리(%)", path: ["detail", "distLow"] },
  ],
  C: [
    { id: "score", label: "C 점수", path: ["score"] },
    { id: "excessQqq20", label: "QQQ 대비 20일(%p)", path: ["detail", "excessQqq20"] },
    { id: "excessQqq60", label: "QQQ 대비 60일(%p)", path: ["detail", "excessQqq60"] },
    { id: "excessSector20", label: "업종 대비 20일(%p)", path: ["detail", "excessSector20"] },
    { id: "excessSector60", label: "업종 대비 60일(%p)", path: ["detail", "excessSector60"] },
  ],
  D: [
    { id: "score", label: "D 점수", path: ["score"] },
    { id: "ratio", label: "거래량/20일평균", path: ["detail", "ratio"] },
    { id: "volumeSkew", label: "상승/하락 거래량비", path: ["detail", "volumeSkew"] },
  ],
  E: [
    { id: "score", label: "E 점수", path: ["score"] },
    { id: "ret3", label: "3일 수익률(%)", path: ["detail", "ret3"] },
    { id: "recovered", label: "10일 저점 회복(%)", path: ["detail", "recovered"] },
  ],
}

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

function positiveRate(values) {
  const xs = (values || []).filter(finite).map(Number)
  if (!xs.length) return null
  return round2((xs.filter((value) => value > 0).length / xs.length) * 100)
}

function getPath(object, path) {
  let cur = object
  for (const key of path) {
    if (cur == null) return null
    cur = cur[key]
  }
  return cur
}

function horizonOf(row, days) {
  return row?.horizons?.[String(days)] ?? row?.horizons?.[days] ?? null
}

function completeReturn(row, days) {
  const horizon = horizonOf(row, days)
  if (horizon?.priceReturnStatus !== "complete" || !finite(horizon.priceReturnPct)) return null
  return Number(horizon.priceReturnPct)
}

function completeDrawdown(row, days) {
  const horizon = horizonOf(row, days)
  if (horizon?.maxDrawdownStatus !== "complete" || !finite(horizon.maxDrawdownPct)) return null
  return Number(horizon.maxDrawdownPct)
}

function completeExcessQqq(row, days) {
  const horizon = horizonOf(row, days)
  if (horizon?.priceReturnStatus !== "complete" || !finite(horizon.excessQqqPct)) return null
  return Number(horizon.excessQqqPct)
}

function completeExcessSector(row, days) {
  const horizon = horizonOf(row, days)
  if (horizon?.priceReturnStatus !== "complete" || !finite(horizon.excessSectorPct)) return null
  return Number(horizon.excessSectorPct)
}

function buildCloseMap(bars) {
  const map = new Map()
  for (const bar of bars || []) {
    const close = Number(bar?.close)
    if (typeof bar?.date !== "string" || !finite(close) || !(close > 0)) continue
    map.set(bar.date, close)
  }
  return map
}

export function spearman(pairs) {
  const clean = (pairs || []).filter((pair) => finite(pair.x) && finite(pair.y))
  const n = clean.length
  if (n < 5) return { n, rho: null, status: "표본 부족" }
  const rank = (values) => {
    const ordered = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value)
    const out = new Array(values.length)
    let i = 0
    while (i < ordered.length) {
      let j = i + 1
      while (j < ordered.length && ordered[j].value === ordered[i].value) j += 1
      const avg = (i + j - 1) / 2 + 1
      for (let k = i; k < j; k++) out[ordered[k].index] = avg
      i = j
    }
    return out
  }
  const rx = rank(clean.map((pair) => Number(pair.x)))
  const ry = rank(clean.map((pair) => Number(pair.y)))
  let sum = 0
  for (let i = 0; i < n; i++) {
    const d = rx[i] - ry[i]
    sum += d * d
  }
  return { n, rho: round2(1 - (6 * sum) / (n * (n * n - 1))), status: "ok" }
}

function outcomeSummary(rows, days = PRIMARY_HORIZON) {
  const list = rows || []
  const price = list.map((row) => completeReturn(row, days))
  const drawdown = list.map((row) => completeDrawdown(row, days))
  const excessQ = list.map((row) => completeExcessQqq(row, days))
  const excessS = list.map((row) => completeExcessSector(row, days))
  return {
    signals: list.length,
    complete: price.filter(finite).length,
    incomplete: list.length - price.filter(finite).length,
    priceMean: mean(price),
    priceMedian: median(price),
    positiveRate: positiveRate(price),
    drawdownMean: mean(drawdown),
    drawdownMedian: median(drawdown),
    excessQqqMedian: median(excessQ),
    excessQqqPositiveRate: positiveRate(excessQ),
    excessSectorMedian: median(excessS),
    excessSectorCount: excessS.filter(finite).length,
  }
}

/**
 * Rebuild part scores/details from bars through signalDate only.
 * Verifies each part score against the frozen v1 row.
 */
export function enrichRowsWithPartDetails(v1Rows, seriesBySymbol, benchmarkSeries = {}) {
  const qqqByDate = buildCloseMap(benchmarkSeries.QQQ || benchmarkSeries.qqq || [])
  const sectorMaps = new Map()
  for (const symbol of Object.values(SECTOR_BENCHMARK).filter(Boolean)) {
    if (benchmarkSeries[symbol]) sectorMaps.set(symbol, buildCloseMap(benchmarkSeries[symbol]))
  }
  let matched = 0
  let mismatched = 0
  let missingBars = 0
  const enriched = []
  for (const row of v1Rows || []) {
    const bars = seriesBySymbol?.[row.symbol]
    if (!Array.isArray(bars) || !row.signalDate) {
      missingBars += 1
      enriched.push({ ...row, partDetails: null, recomputeStatus: "missing_bars" })
      continue
    }
    const signalIdx = bars.findIndex((bar) => bar?.date === row.signalDate)
    if (signalIdx < 0) {
      missingBars += 1
      enriched.push({ ...row, partDetails: null, recomputeStatus: "missing_signal_bar" })
      continue
    }
    const sector = row.sectorBenchmark || SECTOR_BENCHMARK[row.symbol] || null
    const recomputed = scoreChartAtSignal(bars, signalIdx, {
      qqqByDate,
      sectorByDate: sector ? sectorMaps.get(sector) || null : null,
      sectorSymbol: sector,
    })
    let ok = true
    for (const key of COMPONENTS) {
      const stored = row.parts?.[key]
      const again = recomputed.parts?.[key]?.score
      if (stored == null && again == null) continue
      if (stored !== again) {
        ok = false
        break
      }
    }
    if (ok) matched += 1
    else mismatched += 1
    enriched.push({
      ...row,
      partDetails: {
        A: recomputed.parts.A,
        B: recomputed.parts.B,
        C: recomputed.parts.C,
        D: recomputed.parts.D,
        E: recomputed.parts.E,
      },
      recomputeStatus: ok ? "matched" : "mismatch",
    })
  }
  return {
    rows: enriched,
    verification: {
      total: (v1Rows || []).length,
      matched,
      mismatched,
      missingBars,
      ok: mismatched === 0 && missingBars === 0,
    },
  }
}

function partScore(row, component) {
  const fromDetail = row?.partDetails?.[component]?.score
  if (finite(fromDetail)) return Number(fromDetail)
  if (finite(row?.parts?.[component])) return Number(row.parts[component])
  return null
}

function hasPartScore(row, component) {
  return finite(partScore(row, component))
}

export function tertileBands(rows, component) {
  const scored = (rows || []).filter((row) => hasPartScore(row, component))
    .map((row) => ({ ...row, totalScore: partScore(row, component) }))
    .sort((a, b) => Number(b.totalScore) - Number(a.totalScore))
  const n = scored.length
  if (n < 3) return { eligible: false, top: [], mid: [], bottom: [] }
  const topCount = Math.max(1, Math.floor(n / 3))
  const bottomCount = Math.max(1, Math.floor(n / 3))
  const topCutoff = Number(scored[topCount - 1].totalScore)
  const bottomCutoff = Number(scored[n - bottomCount].totalScore)
  const top = scored.filter((row) => Number(row.totalScore) >= topCutoff)
  const bottom = scored.filter((row) => Number(row.totalScore) <= bottomCutoff)
  const topIds = new Set(top.map((row) => row.id))
  const bottomIds = new Set(bottom.map((row) => row.id))
  const mid = scored.filter((row) => !topIds.has(row.id) && !bottomIds.has(row.id))
  if (bottom.some((row) => topIds.has(row.id))) return { eligible: false, top: [], mid: [], bottom: [] }
  return { eligible: true, top, mid, bottom, topCutoff, bottomCutoff }
}

function compareBands(topMembers, restMembers, days) {
  const topReturns = topMembers.map((row) => completeReturn(row, days)).filter(finite)
  const restReturns = restMembers.map((row) => completeReturn(row, days)).filter(finite)
  const topDrawdowns = topMembers.map((row) => completeDrawdown(row, days)).filter(finite)
  const restDrawdowns = restMembers.map((row) => completeDrawdown(row, days)).filter(finite)
  const topReturn = mean(topReturns)
  const restReturn = median(restReturns)
  const topDrawdown = mean(topDrawdowns)
  const restDrawdown = median(restDrawdowns)
  return {
    topReturn,
    restReturn,
    gapReturn: finite(topReturn) && finite(restReturn) ? round2(topReturn - restReturn) : null,
    topDrawdown,
    restDrawdown,
    gapDrawdown: finite(topDrawdown) && finite(restDrawdown) ? round2(topDrawdown - restDrawdown) : null,
    usable: finite(topReturn) && finite(restReturn),
  }
}

export function sameDayComponentGaps(rows, component) {
  const byDate = new Map()
  for (const row of rows || []) {
    if (!row?.signalDate || !hasPartScore(row, component)) continue
    const list = byDate.get(row.signalDate) || []
    list.push({ ...row, totalScore: partScore(row, component) })
    byDate.set(row.signalDate, list)
  }
  const groups = []
  for (const [signalDate, members] of [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (members.length < SAME_DAY_RULE.minScoredForCompare) continue
    const pick = pickTopTied(members)
    if (pick.allTied) continue
    const block = compareBands(pick.tops, pick.rest, PRIMARY_HORIZON)
    groups.push({
      signalDate,
      scoredCount: members.length,
      topSymbols: pick.tops.map((row) => row.symbol),
      topScore: pick.maxScore,
      ...block,
    })
  }
  const usable = groups.filter((group) => group.usable)
  const gaps = usable.map((group) => group.gapReturn)
  const ddGaps = usable.map((group) => group.gapDrawdown)
  return {
    comparableGroups: groups.length,
    usableGroups: usable.length,
    missingOutcome: groups.length - usable.length,
    gapMedian: median(gaps),
    gapPositiveRate: positiveRate(gaps),
    gapDrawdownMedian: median(ddGaps),
    topReturnMedian: median(usable.map((group) => group.topReturn)),
    restReturnMedian: median(usable.map((group) => group.restReturn)),
    bootstrap: bootstrapGapMedian(gaps),
    smallSample: usable.length < COMPONENT_RULE.smallSample,
  }
}

function metricCorrelations(rows, component) {
  const metrics = COMPONENT_METRICS[component] || []
  return metrics.map((metric) => {
    const pairsReturn = []
    const pairsDd = []
    const pairsExcess = []
    for (const row of rows || []) {
      const part = row.partDetails?.[component]
      if (!part) continue
      const x = getPath(part, metric.path)
      if (!finite(x)) continue
      const yRet = completeReturn(row, PRIMARY_HORIZON)
      const yDd = completeDrawdown(row, PRIMARY_HORIZON)
      const yEx = completeExcessQqq(row, PRIMARY_HORIZON)
      if (finite(yRet)) pairsReturn.push({ x: Number(x), y: yRet })
      if (finite(yDd)) pairsDd.push({ x: Number(x), y: yDd })
      if (finite(yEx)) pairsExcess.push({ x: Number(x), y: yEx })
    }
    return {
      id: metric.id,
      label: metric.label,
      return60: spearman(pairsReturn),
      drawdown60: spearman(pairsDd),
      excessQqq60: spearman(pairsExcess),
    }
  })
}

function directionLabel(value) {
  if (!finite(value) || value === 0) return "없음"
  return value > 0 ? "양" : "음"
}

function directionMatch(trainValue, validationValue) {
  if (!finite(trainValue) || !finite(validationValue) || trainValue === 0 || validationValue === 0) {
    return { status: "비교 불가", match: null }
  }
  const match = Math.sign(trainValue) === Math.sign(validationValue)
  return { status: match ? "일치" : "불일치", match }
}

function topSectorShare(rows, component) {
  const bands = tertileBands(rows, component)
  if (!bands.eligible) return []
  const counts = new Map()
  for (const row of bands.top) {
    const key = row.sectorBenchmark || "unavailable"
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const n = bands.top.length
  return [...counts.entries()]
    .map(([sector, count]) => ({ sector, count, sharePct: n ? round2((count / n) * 100) : null }))
    .sort((a, b) => b.count - a.count || a.sector.localeCompare(b.sector))
}

function leaveOneOutComponent(rows, component, baselineGapMedian) {
  const symbols = [...new Set((rows || []).map((row) => row.symbol).filter(Boolean))].sort()
  return symbols.map((symbol) => {
    const filtered = (rows || []).filter((row) => row.symbol !== symbol)
    const sameDay = sameDayComponentGaps(filtered, component)
    return {
      symbol,
      usableGroups: sameDay.usableGroups,
      gapMedian: sameDay.gapMedian,
      gapPositiveRate: sameDay.gapPositiveRate,
      deltaGapMedian: finite(sameDay.gapMedian) && finite(baselineGapMedian)
        ? round2(sameDay.gapMedian - baselineGapMedian)
        : null,
    }
  }).sort((a, b) => Math.abs(b.deltaGapMedian || 0) - Math.abs(a.deltaGapMedian || 0) || a.symbol.localeCompare(b.symbol))
}

function analyzeComponent(rows, component, split) {
  const available = (rows || []).filter((row) => hasPartScore(row, component))
  const missing = (rows || []).length - available.length
  const trainRows = available.filter((row) => row.signalDate <= split.trainEndDate)
  const validationRows = available.filter((row) => row.signalDate >= split.validationStartDate)
  const bands = tertileBands(available, component)
  const trainBands = tertileBands(trainRows, component)
  const validationBands = tertileBands(validationRows, component)
  const sameDay = sameDayComponentGaps(available, component)
  const trainSameDay = sameDayComponentGaps(trainRows, component)
  const validationSameDay = sameDayComponentGaps(validationRows, component)
  const scoreCorr = metricCorrelations(available, component).find((item) => item.id === "score")
  const trainCorr = metricCorrelations(trainRows, component).find((item) => item.id === "score")
  const validationCorr = metricCorrelations(validationRows, component).find((item) => item.id === "score")
  const trainGap = trainSameDay.gapMedian
  const validationGap = validationSameDay.gapMedian
  const corrMatch = directionMatch(trainCorr?.return60?.rho, validationCorr?.return60?.rho)
  const gapMatch = directionMatch(trainGap, validationGap)
  return {
    component,
    label: SCORE_RULE[component]?.label || component,
    weight: SCORE_RULE[component]?.weight || null,
    detail: SCORE_RULE[component]?.detail || null,
    available: available.length,
    missing,
    overall: {
      all: outcomeSummary(available),
      top: bands.eligible ? outcomeSummary(bands.top) : outcomeSummary([]),
      mid: bands.eligible ? outcomeSummary(bands.mid) : outcomeSummary([]),
      bottom: bands.eligible ? outcomeSummary(bands.bottom) : outcomeSummary([]),
      tertileEligible: bands.eligible,
    },
    correlations: metricCorrelations(available, component),
    sameDay,
    train: {
      available: trainRows.length,
      overall: outcomeSummary(trainRows),
      top: trainBands.eligible ? outcomeSummary(trainBands.top) : outcomeSummary([]),
      bottom: trainBands.eligible ? outcomeSummary(trainBands.bottom) : outcomeSummary([]),
      scoreReturnRho: trainCorr?.return60 || null,
      sameDay: trainSameDay,
    },
    validation: {
      available: validationRows.length,
      overall: outcomeSummary(validationRows),
      top: validationBands.eligible ? outcomeSummary(validationBands.top) : outcomeSummary([]),
      bottom: validationBands.eligible ? outcomeSummary(validationBands.bottom) : outcomeSummary([]),
      scoreReturnRho: validationCorr?.return60 || null,
      sameDay: validationSameDay,
    },
    direction: {
      correlation: corrMatch,
      sameDayGap: gapMatch,
      trainReturnRho: trainCorr?.return60?.rho ?? null,
      validationReturnRho: validationCorr?.return60?.rho ?? null,
      trainGapMedian: trainGap,
      validationGapMedian: validationGap,
    },
    topSectors: topSectorShare(available, component),
    sensitivity: leaveOneOutComponent(available, component, sameDay.gapMedian).slice(0, 10),
  }
}

/**
 * @param {object} v1Report frozen v1 JSON
 * @param {Record<string, object[]>} seriesBySymbol
 * @param {Record<string, object[]>} benchmarkSeries
 */
export function analyzeComponentValidity(v1Report, seriesBySymbol, benchmarkSeries = {}) {
  const split = v1Report?.split
  if (!split?.trainEndDate || !split?.validationStartDate) {
    throw new Error("v1 split boundaries are required")
  }
  const enriched = enrichRowsWithPartDetails(v1Report?.rows || [], seriesBySymbol, benchmarkSeries)
  const components = {}
  for (const key of COMPONENTS) {
    components[key] = analyzeComponent(enriched.rows, key, split)
  }
  const dates = new Set((v1Report?.rows || []).map((row) => row.signalDate).filter(Boolean))
  return {
    version: CHART_QUALITY_V3,
    researchOnly: true,
    source: "dbb_chart_quality_v1_rows_plus_ohlcv_recompute",
    asOf: v1Report?.asOf ?? null,
    marketBenchmark: MARKET_BENCHMARK,
    rule: COMPONENT_RULE,
    scoreRule: SCORE_RULE,
    split,
    verification: enriched.verification,
    counts: {
      signals: (v1Report?.rows || []).length,
      uniqueDates: dates.size,
      trainSignals: split.trainCount,
      validationSignals: split.validationCount,
      components: Object.fromEntries(
        COMPONENTS.map((key) => [
          key,
          { available: components[key].available, missing: components[key].missing },
        ]),
      ),
    },
    components,
    tableA: COMPONENTS.map((key) => {
      const block = components[key]
      const top = block.overall.top
      return {
        component: key,
        label: block.label,
        available: block.available,
        missing: block.missing,
        scoreReturnRho: block.correlations.find((item) => item.id === "score")?.return60?.rho ?? null,
        topMedian60: top.priceMedian,
        topPositive60: top.positiveRate,
        topDrawdown60: top.drawdownMedian,
        topExcessQqq60: top.excessQqqMedian,
        allMedian60: block.overall.all.priceMedian,
        bottomMedian60: block.overall.bottom.priceMedian,
      }
    }),
    tableB: COMPONENTS.map((key) => {
      const sameDay = components[key].sameDay
      return {
        component: key,
        label: components[key].label,
        usableGroups: sameDay.usableGroups,
        gapMedian60: sameDay.gapMedian,
        gapPositiveRate: sameDay.gapPositiveRate,
        gapDrawdownMedian60: sameDay.gapDrawdownMedian,
        bootstrapExcludesZero: sameDay.bootstrap?.excludesZero ?? false,
        bootstrapLo: sameDay.bootstrap?.lo ?? null,
        bootstrapHi: sameDay.bootstrap?.hi ?? null,
        smallSample: sameDay.smallSample,
      }
    }),
    tableC: COMPONENTS.map((key) => {
      const block = components[key]
      return {
        component: key,
        label: block.label,
        trainAvailable: block.train.available,
        validationAvailable: block.validation.available,
        trainReturnRho: block.direction.trainReturnRho,
        validationReturnRho: block.direction.validationReturnRho,
        correlationMatch: block.direction.correlation.status,
        trainGapMedian: block.direction.trainGapMedian,
        validationGapMedian: block.direction.validationGapMedian,
        sameDayMatch: block.direction.sameDayGap.status,
      }
    }),
    tableD: Object.fromEntries(COMPONENTS.map((key) => [key, components[key].sensitivity])),
  }
}
