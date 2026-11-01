/**
 * DBB chart quality v6 — C/D selection-effect experiment (research only).
 * Reads frozen v1 rows. Does not change v1~v5, weights, or buy rules.
 * Selection and judgment rules are fixed before reading outcomes.
 */
import { SAME_DAY_RULE, bootstrapGapMedian } from "./dbb-chart-quality-v2.mjs"
import { HORIZONS, PRIMARY_HORIZON, tertileBands } from "./dbb-chart-quality-v3.mjs"

export const CHART_QUALITY_V6 = 6
export { HORIZONS, PRIMARY_HORIZON }

/** Fixed before reading selection-effect outcomes. */
export const SELECT_RULE = {
  purpose:
    "기존 DBB 신호 안에서 C·D가 추가 선별 가치가 있는지 본다. C·D를 결합한 전략은 만들지 않는다. 가중치·매수 규칙을 바꾸지 않는다.",
  baseline: "기준군 A는 v1 DBB 신호를 그대로 쓴다. C·D로 제외·순위 변경을 하지 않는다.",
  cArm:
    "C 비교군은 신호일 종가까지로 계산된 C 점수가 있는 신호만 대상으로, 전체 표본에서 상위 약 1/3을 고른다. 경계 동점은 같은 점수를 모두 포함한다.",
  dArm:
    "D 비교군은 같은 방식으로 D 점수 상위 약 1/3을 고른다. 경계 동점은 같은 점수를 모두 포함한다.",
  sameDay:
    "같은 신호일만 묶는다. 해당 항목 점수가 있는 종목이 2개 미만이면 제외한다. 그날 상위 약 1/3(경계 동점 포함)의 수익 평균을, 같은 날·같은 점수 가능 집합의 중앙값과 비교한다. 전원이 동점이거나 상위·하위치가 겹치면 그 날은 제외한다.",
  matched:
    "비교군 표본이 기준군보다 적으면, 같은 날·점수 가능 종목만의 기준(매칭 기준)과 전체 기준군을 구분해서 차이를 공개한다.",
  split: "v1 학습·검증 신호일 경계를 그대로 쓴다. 같은 날짜는 한쪽에만 둔다.",
  incomplete: "미완료 수익률·불리 움직임은 제외하고 0으로 채우지 않는다.",
  bootstrap:
    "동일 신호일 그룹 단위로 수익·불리 차이 중앙값을 1000회 재표본한다. 그룹 30개 미만이면 유보한다. CI가 0을 포함하면 확실한 개선으로 말하지 않는다.",
  noOptimize: "검증 결과를 보고 상위 비율·산식·방향을 바꾸지 않는다.",
  smallSample: 30,
  topShare: "약 1/3",
}

/** Fixed before reading verdicts. */
export const VERDICT_RULE = {
  levels: ["선별 효과 미입증", "판단 유보"],
  promisingNeeds: [
    "검증 구간 60일 수익률 중앙값이 기준군보다 높아야 한다.",
    "최대 불리 움직임 악화 여부를 별도로 확인한다(수익과 합산하지 않음).",
    "동일 신호일 비교에서도 수익 차이 방향이 대체로 양수여야 한다.",
    "특정 종목 하나를 제외했을 때 결론이 완전히 뒤집히지 않아야 한다.",
    "표본 수와 불확실성(재표본 CI·소표본)이 해석을 허용해야 한다.",
  ],
  note:
    "위 조건을 모두 충족하지 못하면 선별 효과 미입증 또는 판단 유보로 둔다. 유의하지 않은 결과를 유효하다고 단정하지 않는다. 실전적용완료 같은 단정 표현은 쓰지 않는다.",
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

function partScore(row, component) {
  if (finite(row?.parts?.[component])) return Number(row.parts[component])
  return null
}

function hasPartScore(row, component) {
  return finite(partScore(row, component))
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
    excessSectorMedian: median(excessS),
    excessSectorCount: excessS.filter(finite).length,
  }
}

function multiHorizon(rows) {
  return Object.fromEntries(HORIZONS.map((days) => [String(days), outcomeSummary(rows, days)]))
}

function diffSummaries(selected, baseline, days = PRIMARY_HORIZON) {
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
    deltaExcessSector:
      finite(sel.excessSectorMedian) && finite(base.excessSectorMedian)
        ? round2(sel.excessSectorMedian - base.excessSectorMedian)
        : null,
  }
}

/**
 * Within-day top ~1/3 by component score. Boundary ties included.
 * Returns null members when ineligible (too few / all tied overlap).
 */
export function pickDayTopThird(members, component) {
  const scored = (members || [])
    .filter((row) => hasPartScore(row, component))
    .map((row) => ({ ...row, totalScore: partScore(row, component) }))
    .sort((a, b) => Number(b.totalScore) - Number(a.totalScore))
  const n = scored.length
  if (n < SAME_DAY_RULE.minScoredForCompare) {
    return { eligible: false, reason: "표본 부족", selected: [], matched: scored, topCutoff: null }
  }
  if (n < 3) {
    // With exactly 2 names: highest score(s) are selected; if tied, ineligible.
    const maxScore = Number(scored[0].totalScore)
    const selected = scored.filter((row) => Number(row.totalScore) === maxScore)
    if (selected.length === n) {
      return { eligible: false, reason: "전원 동점", selected: [], matched: scored, topCutoff: maxScore }
    }
    return { eligible: true, reason: null, selected, matched: scored, topCutoff: maxScore }
  }
  const topCount = Math.max(1, Math.floor(n / 3))
  const topCutoff = Number(scored[topCount - 1].totalScore)
  const selected = scored.filter((row) => Number(row.totalScore) >= topCutoff)
  if (selected.length === n) {
    return { eligible: false, reason: "전원 동점/경계 중첩", selected: [], matched: scored, topCutoff }
  }
  return { eligible: true, reason: null, selected, matched: scored, topCutoff }
}

function dayOutcome(rows, days) {
  const returns = (rows || []).map((row) => completeReturn(row, days)).filter(finite)
  const drawdowns = (rows || []).map((row) => completeDrawdown(row, days)).filter(finite)
  return {
    returnMean: mean(returns),
    returnMedian: median(returns),
    drawdownMedian: median(drawdowns),
    usableReturn: returns.length > 0,
    usableDrawdown: drawdowns.length > 0,
  }
}

/**
 * Same-day gaps: selected top-third vs matched same-day scored pool, and vs full-day baseline.
 */
export function sameDaySelectionGaps(rows, component) {
  const byDate = new Map()
  for (const row of rows || []) {
    if (!row?.signalDate) continue
    const list = byDate.get(row.signalDate) || []
    list.push(row)
    byDate.set(row.signalDate, list)
  }

  const groups = []
  let belowTwo = 0
  let allTied = 0
  let noScore = 0

  for (const [signalDate, members] of [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const pick = pickDayTopThird(members, component)
    if (!pick.matched.length) {
      noScore += 1
      continue
    }
    if (!pick.eligible) {
      if (pick.reason === "표본 부족") belowTwo += 1
      else allTied += 1
      continue
    }
    const byHorizon = {}
    for (const days of HORIZONS) {
      const selected = dayOutcome(pick.selected, days)
      const matched = dayOutcome(pick.matched, days)
      const full = dayOutcome(members, days)
      byHorizon[String(days)] = {
        selectedReturn: selected.returnMean,
        matchedReturn: matched.returnMedian,
        fullReturn: full.returnMedian,
        gapVsMatched:
          finite(selected.returnMean) && finite(matched.returnMedian)
            ? round2(selected.returnMean - matched.returnMedian)
            : null,
        gapVsFull:
          finite(selected.returnMean) && finite(full.returnMedian)
            ? round2(selected.returnMean - full.returnMedian)
            : null,
        selectedDrawdown: selected.drawdownMedian,
        matchedDrawdown: matched.drawdownMedian,
        gapDrawdownVsMatched:
          finite(selected.drawdownMedian) && finite(matched.drawdownMedian)
            ? round2(selected.drawdownMedian - matched.drawdownMedian)
            : null,
        usable: finite(selected.returnMean) && finite(matched.returnMedian),
        usableDrawdown: finite(selected.drawdownMedian) && finite(matched.drawdownMedian),
        selectedCount: pick.selected.length,
        matchedCount: pick.matched.length,
        fullCount: members.length,
      }
    }
    groups.push({
      signalDate,
      selectedSymbols: pick.selected.map((row) => row.symbol),
      topCutoff: pick.topCutoff,
      byHorizon,
    })
  }

  const summarize = (days) => {
    const key = String(days)
    const usable = groups.filter((group) => group.byHorizon[key]?.usable)
    const usableDd = groups.filter((group) => group.byHorizon[key]?.usableDrawdown)
    const gapsMatched = usable.map((group) => group.byHorizon[key].gapVsMatched)
    const gapsFull = usable.map((group) => group.byHorizon[key].gapVsFull)
    const ddGaps = usableDd.map((group) => group.byHorizon[key].gapDrawdownVsMatched)
    return {
      comparableGroups: groups.length,
      belowTwoGroups: belowTwo,
      allTiedGroups: allTied,
      noScoreGroups: noScore,
      usableGroups: usable.length,
      missingOutcome: groups.length - usable.length,
      gapVsMatchedMedian: median(gapsMatched),
      gapVsMatchedPositiveRate: positiveRate(gapsMatched),
      gapVsFullMedian: median(gapsFull),
      gapVsFullPositiveRate: positiveRate(gapsFull),
      gapDrawdownMedian: median(ddGaps),
      bootstrapVsMatched: bootstrapGapMedian(gapsMatched),
      bootstrapVsFull: bootstrapGapMedian(gapsFull),
      bootstrapDrawdown: bootstrapGapMedian(ddGaps),
      smallSample: usable.length < SELECT_RULE.smallSample,
      avgSelectedCount: mean(usable.map((group) => group.byHorizon[key].selectedCount)),
      avgMatchedCount: mean(usable.map((group) => group.byHorizon[key].matchedCount)),
      avgFullCount: mean(usable.map((group) => group.byHorizon[key].fullCount)),
    }
  }

  return {
    groupDates: byDate.size,
    comparableGroups: groups.length,
    belowTwoGroups: belowTwo,
    allTiedGroups: allTied,
    noScoreGroups: noScore,
    horizons: Object.fromEntries(HORIZONS.map((days) => [String(days), summarize(days)])),
  }
}

function sectorShare(rows) {
  const counts = new Map()
  for (const row of rows || []) {
    const key = row.sectorBenchmark || "unavailable"
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const n = (rows || []).length
  return [...counts.entries()]
    .map(([sector, count]) => ({ sector, count, sharePct: n ? round2((count / n) * 100) : null }))
    .sort((a, b) => b.count - a.count || a.sector.localeCompare(b.sector))
}

function leaveOneOutFlip(rows, component, baselineRows, split) {
  const symbols = [...new Set((rows || []).map((row) => row.symbol).filter(Boolean))].sort()
  const validationBase = (baselineRows || []).filter((row) => row.signalDate >= split.validationStartDate)
  const validationAll = (rows || []).filter((row) => row.signalDate >= split.validationStartDate)
  const baseBands = tertileBands(validationAll, component)
  const baseSelected = baseBands.eligible ? baseBands.top : []
  const baseDiff = diffSummaries(baseSelected, validationBase, PRIMARY_HORIZON)
  const baseDelta = baseDiff.deltaPriceMedian

  return symbols
    .map((symbol) => {
      const filteredAll = validationAll.filter((row) => row.symbol !== symbol)
      const filteredBase = validationBase.filter((row) => row.symbol !== symbol)
      const bands = tertileBands(filteredAll, component)
      const selected = bands.eligible ? bands.top : []
      const diff = diffSummaries(selected, filteredBase, PRIMARY_HORIZON)
      const flipped =
        finite(baseDelta) &&
        finite(diff.deltaPriceMedian) &&
        Math.sign(baseDelta) !== 0 &&
        Math.sign(diff.deltaPriceMedian) !== 0 &&
        Math.sign(baseDelta) !== Math.sign(diff.deltaPriceMedian)
      return {
        symbol,
        deltaPriceMedian: diff.deltaPriceMedian,
        baselineDelta: baseDelta,
        flipped,
        selectedN: selected.length,
      }
    })
    .sort((a, b) => Number(b.flipped) - Number(a.flipped) || Math.abs(b.deltaPriceMedian || 0) - Math.abs(a.deltaPriceMedian || 0))
    .slice(0, 10)
}

function directionMatch(trainValue, validationValue) {
  if (!finite(trainValue) || !finite(validationValue)) return { status: "비교 불가", match: null }
  if (Math.abs(trainValue) < 0.02 || Math.abs(validationValue) < 0.02) {
    return { status: "비교 불가", match: null }
  }
  return {
    status: Math.sign(trainValue) === Math.sign(validationValue) ? "일치" : "불일치",
    match: Math.sign(trainValue) === Math.sign(validationValue),
  }
}

function judgeArm({ component, pooled, sameDay, sensitivity, trainDiff, validationDiff }) {
  const checks = []
  const valDelta = validationDiff?.deltaPriceMedian
  const valBetter = finite(valDelta) && valDelta > 0
  checks.push({
    id: "validationReturn",
    ok: valBetter,
    detail: `검증 60일 수익 중앙값 차이 ${fmtPct(valDelta)} (기준 대비)`,
  })

  const valDd = validationDiff?.deltaDrawdownMedian
  const ddWorsened = finite(valDd) && valDd > 0
  checks.push({
    id: "drawdownCheck",
    ok: finite(valDd),
    detail: `검증 불리 차이 ${fmt(valDd)}%p (양수면 비교군 불리 악화)`,
    worsened: ddWorsened,
  })

  const sameGap = sameDay?.horizons?.["60"]?.gapVsMatchedMedian
  const sameOk = finite(sameGap) && sameGap > 0
  checks.push({
    id: "sameDayDirection",
    ok: sameOk,
    detail: `동일일 수익차(매칭) 중앙값 ${fmtPct(sameGap)}`,
  })

  const flips = (sensitivity || []).filter((row) => row.flipped)
  const sensOk = flips.length === 0
  checks.push({
    id: "sensitivity",
    ok: sensOk,
    detail: flips.length
      ? `검증 부호 반전 종목 제외 예: ${flips
          .slice(0, 3)
          .map((row) => row.symbol)
          .join(", ")}`
      : "상위 민감 종목 제외 시 검증 수익차 부호 유지",
  })

  const usable = sameDay?.horizons?.["60"]?.usableGroups ?? 0
  const boot = sameDay?.horizons?.["60"]?.bootstrapVsMatched
  const sampleOk = usable >= SELECT_RULE.smallSample && pooled?.selected?.["60"]?.complete >= SELECT_RULE.smallSample
  const ciExcludesZero = boot?.status === "ok" && boot?.excludesZero === true && finite(boot.lo) && boot.lo > 0
  checks.push({
    id: "sampleUncertainty",
    ok: sampleOk,
    detail: `동일일 사용 ${usable} · 비교군 완성 ${pooled?.selected?.["60"]?.complete ?? "없음"} · 재표본 ${
      boot?.status === "ok"
        ? `${fmtPct(boot.lo)}~${fmtPct(boot.hi)}${boot.excludesZero ? " (0 제외)" : " (0 포함)"}`
        : boot?.status || "유보"
    }`,
    ciSupports: ciExcludesZero,
  })

  const trainDelta = trainDiff?.deltaPriceMedian
  const repro = directionMatch(trainDelta, valDelta)

  const allCore =
    checks.find((c) => c.id === "validationReturn")?.ok &&
    checks.find((c) => c.id === "sameDayDirection")?.ok &&
    checks.find((c) => c.id === "sensitivity")?.ok &&
    checks.find((c) => c.id === "sampleUncertainty")?.ok &&
    ciExcludesZero &&
    !ddWorsened

  let verdict = "선별 효과 미입증"
  let reason =
    "검증 수익 우위·동일일 방향·민감도·표본/불확실성 조건을 함께 충족하지 못했다. 결과를 보고 규칙을 바꾸지 않는다."

  if (!sampleOk || usable < 10) {
    verdict = "판단 유보"
    reason = "동일일 또는 검증 표본이 해석에 충분하다고 보기 어렵다."
  } else if (allCore) {
    // Still do not claim practical validity — user forbids "실전 유효".
    // Meeting all bars still stays as research-only; we only avoid claiming proven.
    // Per rules: if conditions met we could note research-promising, but levels are only two:
    // 선별 효과 미입증 | 판단 유보. So even if all met, we cannot invent a third level.
    // User: "이 조건을 충족하지 못하면 선별 효과 미입증 또는 판단 유보"
    // Implies if they ARE met we still shouldn't say proven. Keep 선별 효과 미입증 with note,
    // OR we report "조건 일부 충족" under 선별 효과 미입증.
    verdict = "선별 효과 미입증"
    reason =
      "사전 조건 점검상 일부는 긍정이나, 이 연구만으로 실전 선별 개선을 입증했다고 보지 않는다(판정 등급에 '입증' 없음)."
  }

  if (valBetter && sameOk && sampleOk && !ciExcludesZero) {
    verdict = "선별 효과 미입증"
    reason =
      "검증·동일일에서 양의 방향이 있어도 재표본 CI가 0을 포함하거나 불리/민감도 조건이 남아 선별 효과를 입증하지 못한다."
  }

  return {
    component,
    verdict,
    reason,
    checks,
    reproducibility: repro,
    drawdownWorsenedOnValidation: ddWorsened,
  }
}

function analyzeComponent(rows, component, split) {
  const baseline = rows
  const scored = rows.filter((row) => hasPartScore(row, component))
  const bands = tertileBands(rows, component)
  const selected = bands.eligible ? bands.top : []
  const trainRows = rows.filter((row) => row.signalDate <= split.trainEndDate)
  const validationRows = rows.filter((row) => row.signalDate >= split.validationStartDate)
  const trainBands = tertileBands(trainRows, component)
  const validationBands = tertileBands(validationRows, component)
  const trainSelected = trainBands.eligible ? trainBands.top : []
  const validationSelected = validationBands.eligible ? validationBands.top : []

  const pooled = {
    eligible: bands.eligible,
    topCutoff: bands.topCutoff ?? null,
    baselineN: baseline.length,
    scoredN: scored.length,
    selectedN: selected.length,
    missingScore: rows.length - scored.length,
    selected: multiHorizon(selected),
    baseline: multiHorizon(baseline),
    scoredPool: multiHorizon(scored),
    vsBaseline: Object.fromEntries(HORIZONS.map((days) => [String(days), diffSummaries(selected, baseline, days)])),
    vsScoredPool: Object.fromEntries(HORIZONS.map((days) => [String(days), diffSummaries(selected, scored, days)])),
  }

  const trainDiff = diffSummaries(
    trainSelected,
    trainRows.filter((row) => row.signalDate <= split.trainEndDate),
    PRIMARY_HORIZON,
  )
  const validationDiff = diffSummaries(validationSelected, validationRows, PRIMARY_HORIZON)

  const sameDay = sameDaySelectionGaps(rows, component)
  const trainSameDay = sameDaySelectionGaps(trainRows, component)
  const validationSameDay = sameDaySelectionGaps(validationRows, component)

  const sensitivity = leaveOneOutFlip(rows, component, baseline, split)
  const judgment = judgeArm({
    component,
    pooled,
    sameDay,
    sensitivity,
    trainDiff,
    validationDiff,
  })

  return {
    component,
    label: component === "C" ? "상대강도" : "거래량 변화",
    eligible: bands.eligible,
    pooled,
    train: {
      available: trainRows.length,
      selectedN: trainSelected.length,
      diff60: trainDiff,
      sameDay60: trainSameDay.horizons["60"],
    },
    validation: {
      available: validationRows.length,
      selectedN: validationSelected.length,
      diff60: validationDiff,
      sameDay60: validationSameDay.horizons["60"],
    },
    sameDay,
    sectorsSelected: sectorShare(selected).slice(0, 8),
    sectorsBaseline: sectorShare(baseline).slice(0, 8),
    sensitivity,
    judgment,
    direction: {
      pooledReturn: directionMatch(trainDiff.deltaPriceMedian, validationDiff.deltaPriceMedian),
      sameDayGap: directionMatch(
        trainSameDay.horizons["60"].gapVsMatchedMedian,
        validationSameDay.horizons["60"].gapVsMatchedMedian,
      ),
    },
  }
}

/**
 * @param {object} v1Report
 */
export function analyzeSelectionEffect(v1Report) {
  const split = v1Report?.split
  if (!split?.trainEndDate || !split?.validationStartDate) throw new Error("v1 split boundaries are required")
  const rows = v1Report?.rows || []
  const baseline = {
    label: "기준군 (전체 DBB 신호)",
    n: rows.length,
    horizons: multiHorizon(rows),
    train: multiHorizon(rows.filter((row) => row.signalDate <= split.trainEndDate)),
    validation: multiHorizon(rows.filter((row) => row.signalDate >= split.validationStartDate)),
  }

  const c = analyzeComponent(rows, "C", split)
  const d = analyzeComponent(rows, "D", split)

  const incomplete = Object.fromEntries(
    HORIZONS.map((days) => {
      const incompleteCount = rows.filter((row) => completeReturn(row, days) == null).length
      return [String(days), incompleteCount]
    }),
  )

  return {
    version: CHART_QUALITY_V6,
    researchOnly: true,
    source: "dbb_chart_quality_v1_rows_selection_experiment",
    asOf: v1Report?.asOf ?? null,
    rule: SELECT_RULE,
    verdictRule: VERDICT_RULE,
    split,
    counts: {
      signals: rows.length,
      uniqueDates: new Set(rows.map((row) => row.signalDate).filter(Boolean)).size,
      trainSignals: split.trainCount,
      validationSignals: split.validationCount,
      cAvailable: rows.filter((row) => hasPartScore(row, "C")).length,
      cMissing: rows.filter((row) => !hasPartScore(row, "C")).length,
      dAvailable: rows.filter((row) => hasPartScore(row, "D")).length,
      dMissing: rows.filter((row) => !hasPartScore(row, "D")).length,
      incompleteByHorizon: incomplete,
      cSelected: c.pooled.selectedN,
      dSelected: d.pooled.selectedN,
    },
    baseline,
    c,
    d,
    tableA: {
      baseline: baseline.horizons,
      c: c.pooled,
      d: d.pooled,
    },
    tableB: {
      cSameDay: c.sameDay.horizons,
      dSameDay: d.sameDay.horizons,
    },
    tableC: {
      cTrain: c.train,
      cValidation: c.validation,
      dTrain: d.train,
      dValidation: d.validation,
      cDirection: c.direction,
      dDirection: d.direction,
    },
    tableD: {
      cSectors: c.sectorsSelected,
      dSectors: d.sectorsSelected,
      cSensitivity: c.sensitivity,
      dSensitivity: d.sensitivity,
    },
    tableE: {
      c: c.judgment,
      d: d.judgment,
      overall: {
        verdict:
          c.judgment.verdict === "판단 유보" && d.judgment.verdict === "판단 유보"
            ? "판단 유보"
            : "선별 효과 미입증",
        reason:
          "C·D 단독 선별이 사전 고정 판정 조건을 충족해 실전 개선을 입증하지 못하면 전체도 같은 한계로 둔다. 가중치 변경·자동 매수는 하지 않는다.",
        cVerdict: c.judgment.verdict,
        dVerdict: d.judgment.verdict,
      },
    },
  }
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
