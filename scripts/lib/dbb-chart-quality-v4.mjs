/**
 * DBB chart quality v4 — C relative strength & E bounce risk check (research only).
 * Reuses v1 formulas and v3 recomputed part details. Does not retune weights.
 * Methods are fixed before reading return/risk relationships.
 */
import { SCORE_RULE } from "./dbb-chart-quality-v1.mjs"
import { SAME_DAY_RULE, bootstrapGapMedian, pickTopTied } from "./dbb-chart-quality-v2.mjs"
import {
  COMPONENT_RULE,
  HORIZONS,
  PRIMARY_HORIZON,
  enrichRowsWithPartDetails,
  tertileBands,
} from "./dbb-chart-quality-v3.mjs"

export const CHART_QUALITY_V4 = 4
export { HORIZONS, PRIMARY_HORIZON }

/** Fixed before reading C/E return–risk outcomes. */
export const RISK_RULE = {
  focus: "C 상대강도와 E 반등 확인만 본다. 가중치를 바꾸거나 새 매수 규칙을 만들지 않는다.",
  cBands:
    "C 점수가 있는 신호를 점수 내림차순으로 상위·중간·하위 약 1/3로 나눈다. 경계 동점은 같은 점수를 모두 포함한다. 원시 excessQqq60도 같은 방식으로 삼분한다.",
  eScores:
    "E 점수는 이산값이므로 점수값별 표본을 먼저 본다. 표본 30건 미만 구간은 세분화하지 않고 주의로 표시한다.",
  correlation:
    "상관은 동점 평균순위 뒤 피어슨(스피어만)으로 계산한다. 동점이 많은 E처럼 간이 1-6Σd² 식은 쓰지 않는다.",
  risk: "수익률과 최대 불리 움직임을 따로 보고 하나로 합치지 않는다. 수익이 좋아도 위험이 커지면 그대로 표시한다.",
  sameDay:
    "같은 신호일만 묶는다. 해당 항목 점수가 있는 종목만 순위에 넣고 2개 미만이면 제외한다. 최고점 동점은 모두 상위(평균) vs 나머지(중앙값). 20·60·120일을 각각 계산한다.",
  joint:
    "C·E 점수의 중앙값(동점 포함)으로 각각 고·저를 나눈 2×2 표를 만든다. 네 칸 모두 30건 이상일 때만 표를 제공한다. 유리한 칸을 고르지 않는다.",
  split: "v1 학습·검증 신호일 경계를 그대로 쓴다.",
  bootstrap: "동일 신호일 그룹 단위로 수익 차이·불리 차이 중앙값을 1000회 재표본한다. 그룹 30개 미만이면 유보한다.",
  incomplete: "미완료 수익률·불리 움직임은 제외하고 0으로 채우지 않는다.",
  smallSample: 30,
  assumedC: "C가 높을수록 이후 수익은 높고 불리 움직임은 작다는 가설을 두되, 실제 부호가 다르면 그대로 보고한다.",
  assumedE: "E가 높을수록 수익이 낫다는 가설을 두되, 불리 움직임이 함께 커지는지 반드시 함께 본다.",
}

function finite(value) {
  return value != null && Number.isFinite(Number(value))
}

function round2(value) {
  if (!finite(value)) return null
  return Math.round(Number(value) * 100) / 100
}

/** Spearman via Pearson of average ranks — valid with heavy ties (unlike 1−6Σd²). */
export function spearmanTied(pairs) {
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
  const meanX = rx.reduce((sum, value) => sum + value, 0) / n
  const meanY = ry.reduce((sum, value) => sum + value, 0) / n
  let num = 0
  let denX = 0
  let denY = 0
  for (let i = 0; i < n; i++) {
    const dx = rx[i] - meanX
    const dy = ry[i] - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  if (denX === 0 || denY === 0) return { n, rho: null, status: "변동 없음" }
  return { n, rho: round2(num / Math.sqrt(denX * denY)), status: "ok" }
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

function partScore(row, component) {
  const fromDetail = row?.partDetails?.[component]?.score
  if (finite(fromDetail)) return Number(fromDetail)
  if (finite(row?.parts?.[component])) return Number(row.parts[component])
  return null
}

function hasPartScore(row, component) {
  return finite(partScore(row, component))
}

function detailValue(row, component, key) {
  const value = row?.partDetails?.[component]?.detail?.[key]
  return finite(value) ? Number(value) : null
}

export function outcomeSummary(rows, days = PRIMARY_HORIZON) {
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

function multiHorizonSummary(rows) {
  return Object.fromEntries(HORIZONS.map((days) => [String(days), outcomeSummary(rows, days)]))
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
    usableDrawdown: finite(topDrawdown) && finite(restDrawdown),
  }
}

/**
 * Same-day top-vs-rest for one component across 20/60/120.
 */
export function sameDayComponentMulti(rows, component) {
  const byDate = new Map()
  for (const row of rows || []) {
    if (!row?.signalDate || !hasPartScore(row, component)) continue
    const list = byDate.get(row.signalDate) || []
    list.push({ ...row, totalScore: partScore(row, component) })
    byDate.set(row.signalDate, list)
  }
  const groups = []
  let belowTwo = 0
  let allTied = 0
  for (const [signalDate, members] of [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (members.length < SAME_DAY_RULE.minScoredForCompare) {
      belowTwo += 1
      continue
    }
    const pick = pickTopTied(members)
    if (pick.allTied) {
      allTied += 1
      continue
    }
    const byHorizon = {}
    for (const days of HORIZONS) {
      byHorizon[String(days)] = compareBands(pick.tops, pick.rest, days)
    }
    groups.push({
      signalDate,
      scoredCount: members.length,
      topSymbols: pick.tops.map((row) => row.symbol),
      topScore: pick.maxScore,
      byHorizon,
    })
  }
  const summarize = (days) => {
    const key = String(days)
    const usable = groups.filter((group) => group.byHorizon[key]?.usable)
    const usableDd = groups.filter((group) => group.byHorizon[key]?.usableDrawdown)
    const gaps = usable.map((group) => group.byHorizon[key].gapReturn)
    const ddGaps = usableDd.map((group) => group.byHorizon[key].gapDrawdown)
    return {
      comparableGroups: groups.length,
      belowTwoGroups: belowTwo,
      allTiedGroups: allTied,
      usableGroups: usable.length,
      missingOutcome: groups.length - usable.length,
      gapMedian: median(gaps),
      gapPositiveRate: positiveRate(gaps),
      gapDrawdownMedian: median(ddGaps),
      topReturnMedian: median(usable.map((group) => group.byHorizon[key].topReturn)),
      restReturnMedian: median(usable.map((group) => group.byHorizon[key].restReturn)),
      topDrawdownMedian: median(usableDd.map((group) => group.byHorizon[key].topDrawdown)),
      restDrawdownMedian: median(usableDd.map((group) => group.byHorizon[key].restDrawdown)),
      bootstrapReturn: bootstrapGapMedian(gaps),
      bootstrapDrawdown: bootstrapGapMedian(ddGaps),
      smallSample: usable.length < RISK_RULE.smallSample,
    }
  }
  return {
    groupDates: byDate.size,
    comparableGroups: groups.length,
    belowTwoGroups: belowTwo,
    allTiedGroups: allTied,
    horizons: Object.fromEntries(HORIZONS.map((days) => [String(days), summarize(days)])),
  }
}

function sameSectorSameDay(rows, component) {
  const byKey = new Map()
  for (const row of rows || []) {
    if (!row?.signalDate || !hasPartScore(row, component) || !row.sectorBenchmark) continue
    const key = `${row.signalDate}|${row.sectorBenchmark}`
    const list = byKey.get(key) || []
    list.push({ ...row, totalScore: partScore(row, component) })
    byKey.set(key, list)
  }
  const usable = []
  for (const [key, members] of byKey) {
    if (members.length < 2) continue
    const pick = pickTopTied(members)
    if (pick.allTied) continue
    const block = compareBands(pick.tops, pick.rest, PRIMARY_HORIZON)
    if (!block.usable) continue
    const [signalDate, sector] = key.split("|")
    usable.push({ signalDate, sector, scoredCount: members.length, ...block })
  }
  return {
    usableGroups: usable.length,
    gapMedian: median(usable.map((row) => row.gapReturn)),
    gapPositiveRate: positiveRate(usable.map((row) => row.gapReturn)),
    gapDrawdownMedian: median(usable.map((row) => row.gapDrawdown).filter(finite)),
    smallSample: usable.length < RISK_RULE.smallSample,
  }
}

function scoreCorrelations(rows, component) {
  const pairsReturn = []
  const pairsDd = []
  const pairsExcess = []
  for (const row of rows || []) {
    const score = partScore(row, component)
    if (!finite(score)) continue
    const yRet = completeReturn(row, PRIMARY_HORIZON)
    const yDd = completeDrawdown(row, PRIMARY_HORIZON)
    const yEx = completeExcessQqq(row, PRIMARY_HORIZON)
    if (finite(yRet)) pairsReturn.push({ x: score, y: yRet })
    if (finite(yDd)) pairsDd.push({ x: score, y: yDd })
    if (finite(yEx)) pairsExcess.push({ x: score, y: yEx })
  }
  return {
    return60: spearmanTied(pairsReturn),
    drawdown60: spearmanTied(pairsDd),
    excessQqq60: spearmanTied(pairsExcess),
  }
}

function rawMetricCorrelations(rows, component, metricKey) {
  const pairsReturn = []
  const pairsDd = []
  for (const row of rows || []) {
    const x = detailValue(row, component, metricKey)
    if (!finite(x)) continue
    const yRet = completeReturn(row, PRIMARY_HORIZON)
    const yDd = completeDrawdown(row, PRIMARY_HORIZON)
    if (finite(yRet)) pairsReturn.push({ x, y: yRet })
    if (finite(yDd)) pairsDd.push({ x, y: yDd })
  }
  return { return60: spearmanTied(pairsReturn), drawdown60: spearmanTied(pairsDd) }
}

function tertileByNumeric(rows, valueOf) {
  const scored = (rows || [])
    .map((row) => ({ row, value: valueOf(row) }))
    .filter((item) => finite(item.value))
    .sort((a, b) => Number(b.value) - Number(a.value))
  const n = scored.length
  if (n < 3) return { eligible: false, top: [], mid: [], bottom: [] }
  const topCount = Math.max(1, Math.floor(n / 3))
  const bottomCount = Math.max(1, Math.floor(n / 3))
  const topCutoff = Number(scored[topCount - 1].value)
  const bottomCutoff = Number(scored[n - bottomCount].value)
  const top = scored.filter((item) => Number(item.value) >= topCutoff).map((item) => item.row)
  const bottom = scored.filter((item) => Number(item.value) <= bottomCutoff).map((item) => item.row)
  const topIds = new Set(top.map((row) => row.id))
  if (bottom.some((row) => topIds.has(row.id))) return { eligible: false, top: [], mid: [], bottom: [] }
  const bottomIds = new Set(bottom.map((row) => row.id))
  const mid = scored.map((item) => item.row).filter((row) => !topIds.has(row.id) && !bottomIds.has(row.id))
  return { eligible: true, top, mid, bottom, topCutoff, bottomCutoff }
}

function eScoreBuckets(rows) {
  const counts = new Map()
  for (const row of rows || []) {
    const score = partScore(row, "E")
    if (!finite(score)) continue
    const key = String(score)
    const list = counts.get(key) || []
    list.push(row)
    counts.set(key, list)
  }
  return [...counts.entries()]
    .map(([score, list]) => ({
      score: Number(score),
      n: list.length,
      smallSample: list.length < RISK_RULE.smallSample,
      horizons: multiHorizonSummary(list),
    }))
    .sort((a, b) => a.score - b.score)
}

function directionMatch(trainValue, validationValue) {
  if (!finite(trainValue) || !finite(validationValue)) {
    return { status: "비교 불가", match: null }
  }
  // Near-zero correlations/gaps are not directional evidence.
  if (Math.abs(trainValue) < 0.02 || Math.abs(validationValue) < 0.02) {
    return { status: "비교 불가", match: null }
  }
  return {
    status: Math.sign(trainValue) === Math.sign(validationValue) ? "일치" : "불일치",
    match: Math.sign(trainValue) === Math.sign(validationValue),
  }
}

function medianSplit(rows, component) {
  const scores = (rows || []).map((row) => partScore(row, component)).filter(finite).sort((a, b) => a - b)
  if (scores.length < 2) return { median: null, high: [], low: [] }
  const mid = Math.floor(scores.length / 2)
  const cut = scores.length % 2 ? scores[mid] : (scores[mid - 1] + scores[mid]) / 2
  const high = []
  const low = []
  for (const row of rows || []) {
    const score = partScore(row, component)
    if (!finite(score)) continue
    if (score >= cut) high.push(row)
    else low.push(row)
  }
  return { median: round2(cut), high, low }
}

function jointCE(rows) {
  const both = (rows || []).filter((row) => hasPartScore(row, "C") && hasPartScore(row, "E"))
  const cSplit = medianSplit(both, "C")
  const eSplit = medianSplit(both, "E")
  const cells = {
    cHighEHigh: both.filter((row) => partScore(row, "C") >= cSplit.median && partScore(row, "E") >= eSplit.median),
    cHighELow: both.filter((row) => partScore(row, "C") >= cSplit.median && partScore(row, "E") < eSplit.median),
    cLowEHigh: both.filter((row) => partScore(row, "C") < cSplit.median && partScore(row, "E") >= eSplit.median),
    cLowELow: both.filter((row) => partScore(row, "C") < cSplit.median && partScore(row, "E") < eSplit.median),
  }
  const counts = Object.fromEntries(Object.entries(cells).map(([key, list]) => [key, list.length]))
  const enough = Object.values(counts).every((n) => n >= RISK_RULE.smallSample)
  return {
    both: both.length,
    cMedian: cSplit.median,
    eMedian: eSplit.median,
    enough,
    counts,
    cells: enough
      ? Object.fromEntries(Object.entries(cells).map(([key, list]) => [key, outcomeSummary(list, PRIMARY_HORIZON)]))
      : null,
  }
}

function ceCorrelation(rows) {
  const pairs = []
  for (const row of rows || []) {
    const c = partScore(row, "C")
    const e = partScore(row, "E")
    if (!finite(c) || !finite(e)) continue
    pairs.push({ x: c, y: e })
  }
  return spearmanTied(pairs)
}

function leaveOneOut(rows, component, baselineGapMedian, baselineDdMedian) {
  const symbols = [...new Set((rows || []).map((row) => row.symbol).filter(Boolean))].sort()
  return symbols
    .map((symbol) => {
      const filtered = (rows || []).filter((row) => row.symbol !== symbol)
      const sameDay = sameDayComponentMulti(filtered, component).horizons["60"]
      return {
        symbol,
        usableGroups: sameDay.usableGroups,
        gapMedian: sameDay.gapMedian,
        gapDrawdownMedian: sameDay.gapDrawdownMedian,
        deltaGapMedian: finite(sameDay.gapMedian) && finite(baselineGapMedian)
          ? round2(sameDay.gapMedian - baselineGapMedian)
          : null,
        deltaGapDrawdownMedian: finite(sameDay.gapDrawdownMedian) && finite(baselineDdMedian)
          ? round2(sameDay.gapDrawdownMedian - baselineDdMedian)
          : null,
      }
    })
    .sort((a, b) => Math.abs(b.deltaGapMedian || 0) - Math.abs(a.deltaGapMedian || 0) || a.symbol.localeCompare(b.symbol))
    .slice(0, 10)
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

function analyzeFocus(rows, component, split) {
  const available = (rows || []).filter((row) => hasPartScore(row, component))
  const missing = (rows || []).length - available.length
  const train = available.filter((row) => row.signalDate <= split.trainEndDate)
  const validation = available.filter((row) => row.signalDate >= split.validationStartDate)
  const bands = tertileBands(available, component)
  const trainBands = tertileBands(train, component)
  const validationBands = tertileBands(validation, component)
  const sameDay = sameDayComponentMulti(available, component)
  const trainSameDay = sameDayComponentMulti(train, component)
  const validationSameDay = sameDayComponentMulti(validation, component)
  const corr = scoreCorrelations(available, component)
  const trainCorr = scoreCorrelations(train, component)
  const validationCorr = scoreCorrelations(validation, component)
  return {
    component,
    label: SCORE_RULE[component]?.label || component,
    detail: SCORE_RULE[component]?.detail || null,
    available: available.length,
    missing,
    correlations: corr,
    tertile: {
      eligible: bands.eligible,
      top: bands.eligible ? multiHorizonSummary(bands.top) : null,
      mid: bands.eligible ? multiHorizonSummary(bands.mid) : null,
      bottom: bands.eligible ? multiHorizonSummary(bands.bottom) : null,
    },
    sameDay,
    sameSectorSameDay: sameSectorSameDay(available, component),
    topSectors: topSectorShare(available, component),
    train: {
      available: train.length,
      correlations: trainCorr,
      tertileTop60: trainBands.eligible ? outcomeSummary(trainBands.top) : null,
      tertileBottom60: trainBands.eligible ? outcomeSummary(trainBands.bottom) : null,
      sameDay60: trainSameDay.horizons["60"],
    },
    validation: {
      available: validation.length,
      correlations: validationCorr,
      tertileTop60: validationBands.eligible ? outcomeSummary(validationBands.top) : null,
      tertileBottom60: validationBands.eligible ? outcomeSummary(validationBands.bottom) : null,
      sameDay60: validationSameDay.horizons["60"],
    },
    direction: {
      returnRho: directionMatch(trainCorr.return60.rho, validationCorr.return60.rho),
      drawdownRho: directionMatch(trainCorr.drawdown60.rho, validationCorr.drawdown60.rho),
      sameDayReturnGap: directionMatch(trainSameDay.horizons["60"].gapMedian, validationSameDay.horizons["60"].gapMedian),
      sameDayDrawdownGap: directionMatch(
        trainSameDay.horizons["60"].gapDrawdownMedian,
        validationSameDay.horizons["60"].gapDrawdownMedian,
      ),
    },
    sensitivity: leaveOneOut(available, component, sameDay.horizons["60"].gapMedian, sameDay.horizons["60"].gapDrawdownMedian),
  }
}

/**
 * @param {object} v1Report
 * @param {Record<string, object[]>} seriesBySymbol
 * @param {Record<string, object[]>} benchmarkSeries
 */
export function analyzeRelativeBounceRisk(v1Report, seriesBySymbol, benchmarkSeries = {}) {
  const split = v1Report?.split
  if (!split?.trainEndDate || !split?.validationStartDate) throw new Error("v1 split boundaries are required")
  const enriched = enrichRowsWithPartDetails(v1Report?.rows || [], seriesBySymbol, benchmarkSeries)
  const rows = enriched.rows
  const c = analyzeFocus(rows, "C", split)
  const e = analyzeFocus(rows, "E", split)

  const cRawTertile = tertileByNumeric(rows, (row) => detailValue(row, "C", "excessQqq60"))
  const incomplete = Object.fromEntries(
    HORIZONS.map((days) => {
      const key = String(days)
      const incompleteCount = rows.filter((row) => completeReturn(row, days) == null).length
      return [key, incompleteCount]
    }),
  )

  const dates = new Set(rows.map((row) => row.signalDate).filter(Boolean))
  const joint = jointCE(rows)

  return {
    version: CHART_QUALITY_V4,
    researchOnly: true,
    source: "dbb_chart_quality_v1_rows_plus_ohlcv_recompute",
    asOf: v1Report?.asOf ?? null,
    rule: RISK_RULE,
    componentRuleNote: COMPONENT_RULE.source,
    scoreRule: { C: SCORE_RULE.C, E: SCORE_RULE.E },
    split,
    verification: enriched.verification,
    counts: {
      signals: rows.length,
      uniqueDates: dates.size,
      trainSignals: split.trainCount,
      validationSignals: split.validationCount,
      cAvailable: c.available,
      cMissing: c.missing,
      eAvailable: e.available,
      eMissing: e.missing,
      incompleteByHorizon: incomplete,
      cSameDayComparable: c.sameDay.comparableGroups,
      eSameDayComparable: e.sameDay.comparableGroups,
    },
    c,
    e,
    cRawExcessQqq60: {
      eligible: cRawTertile.eligible,
      top: cRawTertile.eligible ? multiHorizonSummary(cRawTertile.top) : null,
      mid: cRawTertile.eligible ? multiHorizonSummary(cRawTertile.mid) : null,
      bottom: cRawTertile.eligible ? multiHorizonSummary(cRawTertile.bottom) : null,
      correlations: rawMetricCorrelations(rows, "C", "excessQqq60"),
      also20: rawMetricCorrelations(rows, "C", "excessQqq20"),
      sector60: rawMetricCorrelations(rows, "C", "excessSector60"),
    },
    eBuckets: eScoreBuckets(rows),
    eConcentration: {
      note: "E 점수는 이산·희소할 수 있다. 0점 비중과 점수별 표본을 먼저 보고 상관만으로 판단하지 않는다.",
      zeroCount: (rows || []).filter((row) => partScore(row, "E") === 0).length,
      nonzeroCount: (rows || []).filter((row) => finite(partScore(row, "E")) && partScore(row, "E") !== 0).length,
    },
    ceCorrelation: ceCorrelation(rows),
    joint,
    tableA: {
      scoreTertile: c.tertile,
      rawExcessQqq60: {
        eligible: cRawTertile.eligible,
        top60: cRawTertile.eligible ? outcomeSummary(cRawTertile.top) : null,
        mid60: cRawTertile.eligible ? outcomeSummary(cRawTertile.mid) : null,
        bottom60: cRawTertile.eligible ? outcomeSummary(cRawTertile.bottom) : null,
      },
      correlations: c.correlations,
      rawCorrelations: {
        excessQqq20: rawMetricCorrelations(rows, "C", "excessQqq20"),
        excessQqq60: rawMetricCorrelations(rows, "C", "excessQqq60"),
        excessSector60: rawMetricCorrelations(rows, "C", "excessSector60"),
      },
    },
    tableB: {
      buckets: eScoreBuckets(rows),
      correlations: e.correlations,
      tertileEligible: e.tertile.eligible,
    },
    tableC: {
      c: c.sameDay.horizons,
      e: e.sameDay.horizons,
      cSameSector: c.sameSectorSameDay,
      eSameSector: e.sameSectorSameDay,
    },
    tableD: {
      c: c.direction,
      e: e.direction,
      cTrain: c.train,
      cValidation: c.validation,
      eTrain: e.train,
      eValidation: e.validation,
    },
    tableE: {
      ceCorrelation: ceCorrelation(rows),
      joint,
      cSensitivity: c.sensitivity,
      eSensitivity: e.sensitivity,
      cTopSectors: c.topSectors,
      eTopSectors: e.topSectors,
    },
  }
}
