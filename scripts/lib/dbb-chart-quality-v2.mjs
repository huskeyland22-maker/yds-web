/**
 * DBB chart quality v2 — same-signal-day comparison (research only).
 * Reads frozen v1 rows. Does not change scores, thresholds, or v1 files.
 * Rules are fixed before reading outcome gaps.
 */

export const CHART_QUALITY_V2 = 2
export const HORIZONS = [20, 60, 120]
export const PRIMARY_HORIZON = 60

/** Fixed before reading same-day outcome gaps. */
export const SAME_DAY_RULE = {
  minScoredForCompare: 2,
  minScoredForQuartile: 4,
  smallSampleGroups: 30,
  bootstrapReps: 1000,
  bootstrapSeed: 20261016,
  scored:
    "차트 품질 총점이 유한한 종목만 순위 비교에 넣는다. 계산 불가는 0점으로 두지 않고 그룹 안에서도 순위 밖으로 둔다.",
  topTie:
    "그룹 최고점과 같은 점수의 종목을 모두 상위로 둔다. 상위 성과는 동점 상위 종목의 동일가중 평균이며, 나머지는 그 밖의 점수 산출 종목 중앙값과 비교한다. 전원이 동점이면 그 그룹은 상위 대 나머지 비교에서 제외한다.",
  quartile:
    "점수 산출 종목이 4개 이상인 그룹만 상위·하위 25%를 나눈다. 경계 점수가 같으면 같은 점수를 모두 포함한다. 상위·하위가 겹치면 그 그룹은 사분위 비교에서 제외한다. 티커 순으로 순위를 정하지 않는다.",
  incomplete: "미완료 수익률·불리 움직임은 차이 계산에서 빼고 0으로 채우지 않는다.",
  split: "v1에 고정된 학습·검증 신호일 경계를 그대로 쓴다. 같은 날짜 그룹은 한쪽에만 속한다.",
  bootstrap:
    "비교 가능 그룹이 30개 이상일 때만 신호일 그룹 단위로 1000회 재표본한다. 종목 행이 아니라 그룹을 뽑는다. 구간이 0을 포함하거나 표본이 부족하면 유의하다고 말하지 않는다.",
  bias: "같은 신호일로 날짜 효과는 일부 줄어들지만 업종 편향과 종목 간 상관은 남는다.",
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

export function isScoredRow(row) {
  return finite(row?.totalScore)
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

/**
 * Competition-style ranking by score. Equal scores share the same rank.
 * Does not break ties by ticker.
 */
export function rankByScore(scoredRows) {
  const sorted = [...(scoredRows || [])].sort((a, b) => Number(b.totalScore) - Number(a.totalScore))
  const ranks = new Map()
  let index = 0
  while (index < sorted.length) {
    let end = index + 1
    while (end < sorted.length && Number(sorted[end].totalScore) === Number(sorted[index].totalScore)) end += 1
    const rank = index + 1
    for (let i = index; i < end; i++) ranks.set(sorted[i].id, rank)
    index = end
  }
  return { sorted, ranks }
}

export function pickTopTied(scoredRows) {
  const list = (scoredRows || []).filter(isScoredRow)
  if (!list.length) return { tops: [], rest: [], maxScore: null, allTied: false }
  const maxScore = Math.max(...list.map((row) => Number(row.totalScore)))
  const tops = list.filter((row) => Number(row.totalScore) === maxScore)
  const rest = list.filter((row) => Number(row.totalScore) < maxScore)
  return { tops, rest, maxScore, allTied: rest.length === 0 }
}

export function pickScoreQuartileBands(scoredRows) {
  const list = (scoredRows || []).filter(isScoredRow)
  if (list.length < SAME_DAY_RULE.minScoredForQuartile) {
    return { eligible: false, reason: "표본 부족", top: [], bottom: [] }
  }
  const sorted = [...list].sort((a, b) => Number(b.totalScore) - Number(a.totalScore))
  const n = sorted.length
  const topCount = Math.max(1, Math.floor(n * 0.25))
  const bottomCount = Math.max(1, Math.floor(n * 0.25))
  const topCutoff = Number(sorted[topCount - 1].totalScore)
  const bottomCutoff = Number(sorted[n - bottomCount].totalScore)
  const top = sorted.filter((row) => Number(row.totalScore) >= topCutoff)
  const bottom = sorted.filter((row) => Number(row.totalScore) <= bottomCutoff)
  const topIds = new Set(top.map((row) => row.id))
  if (bottom.some((row) => topIds.has(row.id))) {
    return { eligible: false, reason: "상위·하위 겹침", top: [], bottom: [] }
  }
  return { eligible: true, reason: null, top, bottom, topCutoff, bottomCutoff }
}

function memberStats(members, days) {
  const returns = members.map((row) => completeReturn(row, days))
  const drawdowns = members.map((row) => completeDrawdown(row, days))
  return {
    n: members.length,
    returnComplete: returns.filter(finite).length,
    returnMean: mean(returns),
    returnMedian: median(returns),
    drawdownComplete: drawdowns.filter(finite).length,
    drawdownMean: mean(drawdowns),
    drawdownMedian: median(drawdowns),
  }
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
    topReturnComplete: topReturns.length,
    restReturnComplete: restReturns.length,
    usable: finite(topReturn) && finite(restReturn),
  }
}

export function buildSameDayGroups(rows) {
  const byDate = new Map()
  for (const row of rows || []) {
    if (!row?.signalDate) continue
    const list = byDate.get(row.signalDate) || []
    list.push(row)
    byDate.set(row.signalDate, list)
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([signalDate, members]) => {
      const scored = members.filter(isScoredRow)
      const unscored = members.filter((row) => !isScoredRow(row))
      const { sorted, ranks } = rankByScore(scored)
      const topPick = pickTopTied(scored)
      const quartile = pickScoreQuartileBands(scored)
      const comparable = scored.length >= SAME_DAY_RULE.minScoredForCompare
      const topVsRest = {}
      const quartileCompare = {}
      for (const days of HORIZONS) {
        topVsRest[String(days)] = comparable && !topPick.allTied
          ? compareBands(topPick.tops, topPick.rest, days)
          : { usable: false, gapReturn: null, gapDrawdown: null, topReturn: null, restReturn: null, topDrawdown: null, restDrawdown: null, topReturnComplete: 0, restReturnComplete: 0 }
        quartileCompare[String(days)] = quartile.eligible
          ? compareBands(quartile.top, quartile.bottom, days)
          : { usable: false, gapReturn: null, gapDrawdown: null, topReturn: null, restReturn: null, topDrawdown: null, restDrawdown: null, topReturnComplete: 0, restReturnComplete: 0 }
      }
      const sectorCounts = new Map()
      for (const row of scored) {
        const key = row.sectorBenchmark || "unavailable"
        sectorCounts.set(key, (sectorCounts.get(key) || 0) + 1)
      }
      const sameSectorPairs = [...sectorCounts.entries()]
        .filter(([key, count]) => key !== "unavailable" && count >= 2)
        .map(([sector, count]) => ({ sector, count }))
      return {
        signalDate,
        memberCount: members.length,
        scoredCount: scored.length,
        unscoredCount: unscored.length,
        comparable,
        allTied: topPick.allTied,
        quartileEligible: quartile.eligible,
        quartileReason: quartile.reason,
        topSymbols: topPick.tops.map((row) => row.symbol),
        topScore: topPick.maxScore,
        topTiedCount: topPick.tops.length,
        restCount: topPick.rest.length,
        ranks: Object.fromEntries([...ranks.entries()]),
        members: sorted.map((row) => ({
          id: row.id,
          symbol: row.symbol,
          name: row.name,
          totalScore: row.totalScore,
          rank: ranks.get(row.id),
          sectorBenchmark: row.sectorBenchmark || null,
          entryDate: row.entryDate,
          entryPrice: row.entryPrice,
          returns: Object.fromEntries(HORIZONS.map((days) => [String(days), completeReturn(row, days)])),
          drawdowns: Object.fromEntries(HORIZONS.map((days) => [String(days), completeDrawdown(row, days)])),
        })),
        unscoredSymbols: unscored.map((row) => row.symbol),
        topVsRest,
        quartileCompare,
        sameSectorPairs,
        summary60: {
          top: memberStats(topPick.tops, 60),
          rest: memberStats(topPick.rest, 60),
          gap: topVsRest["60"],
        },
      }
    })
}

function summarizeGaps(groups, days, mode = "topVsRest") {
  const key = String(days)
  const usable = []
  for (const group of groups || []) {
    const block = mode === "quartile" ? group.quartileCompare?.[key] : group.topVsRest?.[key]
    if (block?.usable && finite(block.gapReturn)) usable.push(block)
  }
  const gaps = usable.map((block) => block.gapReturn)
  const ddGaps = usable.map((block) => block.gapDrawdown).filter(finite)
  const topReturns = usable.map((block) => block.topReturn)
  const restReturns = usable.map((block) => block.restReturn)
  const topDd = usable.map((block) => block.topDrawdown).filter(finite)
  const restDd = usable.map((block) => block.restDrawdown).filter(finite)
  return {
    groups: (groups || []).length,
    usableGroups: usable.length,
    missingOutcome: (groups || []).length - usable.length,
    topReturnMedian: median(topReturns),
    restReturnMedian: median(restReturns),
    gapMean: mean(gaps),
    gapMedian: median(gaps),
    gapPositiveRate: positiveRate(gaps),
    topDrawdownMedian: median(topDd),
    restDrawdownMedian: median(restDd),
    gapDrawdownMedian: median(ddGaps),
    smallSample: usable.length < SAME_DAY_RULE.smallSampleGroups,
  }
}

function spearman(pairs) {
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
  const rho = 1 - (6 * sum) / (n * (n * n - 1))
  return { n, rho: round2(rho), status: "ok" }
}

function rankOutcomePairs(groups, days, field) {
  const pairs = []
  for (const group of groups || []) {
    if (!group.comparable) continue
    for (const member of group.members || []) {
      const y = field === "drawdown" ? member.drawdowns?.[String(days)] : member.returns?.[String(days)]
      if (!finite(y) || !finite(member.rank)) continue
      pairs.push({ x: member.rank, y: Number(y) })
    }
  }
  return spearman(pairs)
}

export function mulberry32(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function bootstrapGapMedian(gaps, reps = SAME_DAY_RULE.bootstrapReps, seed = SAME_DAY_RULE.bootstrapSeed) {
  const xs = (gaps || []).filter(finite).map(Number)
  if (xs.length < SAME_DAY_RULE.smallSampleGroups) {
    return { n: xs.length, status: "표본 부족", mean: null, lo: null, hi: null, excludesZero: false }
  }
  const rng = mulberry32(seed)
  const samples = []
  for (let rep = 0; rep < reps; rep++) {
    const drawn = []
    for (let i = 0; i < xs.length; i++) drawn.push(xs[Math.floor(rng() * xs.length)])
    samples.push(median(drawn))
  }
  const ordered = samples.filter(finite).sort((a, b) => a - b)
  const lo = ordered[Math.floor(0.025 * (ordered.length - 1))]
  const hi = ordered[Math.floor(0.975 * (ordered.length - 1))]
  return {
    n: xs.length,
    status: "ok",
    mean: mean(samples),
    lo: round2(lo),
    hi: round2(hi),
    excludesZero: finite(lo) && finite(hi) && ((lo > 0 && hi > 0) || (lo < 0 && hi < 0)),
  }
}

function topSectorDistribution(groups) {
  const counts = new Map()
  let n = 0
  for (const group of groups || []) {
    if (!group.comparable || group.allTied) continue
    for (const member of group.members || []) {
      if (!group.topSymbols.includes(member.symbol)) continue
      const key = member.sectorBenchmark || "unavailable"
      counts.set(key, (counts.get(key) || 0) + 1)
      n += 1
    }
  }
  return [...counts.entries()]
    .map(([sector, count]) => ({ sector, count, sharePct: n ? round2((count / n) * 100) : null }))
    .sort((a, b) => b.count - a.count || a.sector.localeCompare(b.sector))
}

function sameSectorSubgroups(rows) {
  const groups = buildSameDayGroups(rows)
  const out = []
  for (const group of groups) {
    const bySector = new Map()
    for (const row of (rows || []).filter((item) => item.signalDate === group.signalDate && isScoredRow(item))) {
      if (!row.sectorBenchmark) continue
      const list = bySector.get(row.sectorBenchmark) || []
      list.push(row)
      bySector.set(row.sectorBenchmark, list)
    }
    for (const [sector, list] of bySector) {
      if (list.length < 2) continue
      const topPick = pickTopTied(list)
      if (topPick.allTied) continue
      out.push({
        signalDate: group.signalDate,
        sector,
        scoredCount: list.length,
        topVsRest: Object.fromEntries(HORIZONS.map((days) => [String(days), compareBands(topPick.tops, topPick.rest, days)])),
      })
    }
  }
  return out
}

function leaveOneOutSensitivity(rows, baseline) {
  const symbols = [...new Set((rows || []).map((row) => row.symbol).filter(Boolean))].sort()
  return symbols.map((symbol) => {
    const filtered = (rows || []).filter((row) => row.symbol !== symbol)
    const groups = buildSameDayGroups(filtered).filter((group) => group.comparable && !group.allTied)
    const summary = summarizeGaps(groups, PRIMARY_HORIZON, "topVsRest")
    return {
      symbol,
      groupsWithSymbol: (rows || []).filter((row) => row.symbol === symbol && isScoredRow(row)).length,
      usableGroups: summary.usableGroups,
      gapMedian: summary.gapMedian,
      gapPositiveRate: summary.gapPositiveRate,
      deltaGapMedian: finite(summary.gapMedian) && finite(baseline.gapMedian)
        ? round2(summary.gapMedian - baseline.gapMedian)
        : null,
      deltaGapPositiveRate: finite(summary.gapPositiveRate) && finite(baseline.gapPositiveRate)
        ? round2(summary.gapPositiveRate - baseline.gapPositiveRate)
        : null,
    }
  }).sort((a, b) => Math.abs(b.deltaGapMedian || 0) - Math.abs(a.deltaGapMedian || 0) || a.symbol.localeCompare(b.symbol))
}

function sliceBySplit(groups, split, side) {
  if (!split?.trainEndDate || !split?.validationStartDate) return groups
  if (side === "train") return groups.filter((group) => group.signalDate <= split.trainEndDate)
  if (side === "validation") return groups.filter((group) => group.signalDate >= split.validationStartDate)
  return groups
}

function packSide(groups) {
  const comparable = groups.filter((group) => group.comparable)
  const topReady = comparable.filter((group) => !group.allTied)
  const quartileReady = comparable.filter((group) => group.quartileEligible)
  const topSummary = Object.fromEntries(HORIZONS.map((days) => [String(days), summarizeGaps(topReady, days, "topVsRest")]))
  const quartileSummary = Object.fromEntries(HORIZONS.map((days) => [String(days), summarizeGaps(quartileReady, days, "quartile")]))
  const gaps60 = topReady.map((group) => group.topVsRest["60"]).filter((block) => block?.usable).map((block) => block.gapReturn)
  return {
    groupCount: groups.length,
    comparableGroups: comparable.length,
    singleOrUnscoredGroups: groups.length - comparable.length,
    allTiedGroups: comparable.filter((group) => group.allTied).length,
    quartileGroups: quartileReady.length,
    topVsRest: topSummary,
    quartile: quartileSummary,
    rankReturn60: rankOutcomePairs(comparable, 60, "return"),
    rankDrawdown60: rankOutcomePairs(comparable, 60, "drawdown"),
    bootstrap60: bootstrapGapMedian(gaps60),
    topSectorDistribution: topSectorDistribution(topReady),
  }
}

/**
 * @param {{ rows?: object[], asOf?: string, split?: object, counts?: object, universe?: string[] }} v1Report
 */
export function analyzeSameDayComparison(v1Report) {
  const rows = Array.isArray(v1Report?.rows) ? v1Report.rows : []
  const groups = buildSameDayGroups(rows)
  const comparable = groups.filter((group) => group.comparable)
  const topReady = comparable.filter((group) => !group.allTied)
  const overall = packSide(groups)
  const train = packSide(sliceBySplit(groups, v1Report?.split, "train"))
  const validation = packSide(sliceBySplit(groups, v1Report?.split, "validation"))
  const baseline60 = overall.topVsRest["60"]
  const sectorGroups = sameSectorSubgroups(rows)
  const sectorReady = sectorGroups.filter((group) => group.topVsRest?.["60"]?.usable)
  const missingScore = rows.filter((row) => !isScoredRow(row)).length
  const missingOutcome60 = topReady.filter((group) => !group.topVsRest["60"]?.usable).length

  const tableA = topReady.map((group) => ({
    signalDate: group.signalDate,
    scoredCount: group.scoredCount,
    topSymbols: group.topSymbols,
    topScore: group.topScore,
    topTiedCount: group.topTiedCount,
    topReturn60: group.topVsRest["60"].topReturn,
    restReturn60: group.topVsRest["60"].restReturn,
    gapReturn60: group.topVsRest["60"].gapReturn,
    gapDrawdown60: group.topVsRest["60"].gapDrawdown,
    usable60: group.topVsRest["60"].usable,
  }))

  const sectorSummary60 = (() => {
    const usable = sectorReady.map((group) => group.topVsRest["60"])
    const gaps = usable.map((block) => block.gapReturn)
    return {
      groups: sectorReady.length,
      usableGroups: usable.length,
      topReturnMedian: median(usable.map((block) => block.topReturn)),
      restReturnMedian: median(usable.map((block) => block.restReturn)),
      gapMedian: median(gaps),
      gapPositiveRate: positiveRate(gaps),
      gapDrawdownMedian: median(usable.map((block) => block.gapDrawdown)),
      smallSample: usable.length < SAME_DAY_RULE.smallSampleGroups,
    }
  })()

  return {
    version: CHART_QUALITY_V2,
    researchOnly: true,
    source: "dbb_chart_quality_v1_rows",
    asOf: v1Report?.asOf ?? null,
    rule: SAME_DAY_RULE,
    split: v1Report?.split ?? null,
    counts: {
      signals: rows.length,
      groups: groups.length,
      comparableGroups: comparable.length,
      nonComparableGroups: groups.length - comparable.length,
      singleMemberGroups: groups.filter((group) => group.memberCount === 1).length,
      scoredBelowTwoGroups: groups.filter((group) => group.scoredCount < 2).length,
      missingScore,
      missingOutcome60,
      quartileEligibleGroups: comparable.filter((group) => group.quartileEligible).length,
      sameSectorComparableGroups: sectorReady.length,
    },
    overall,
    train,
    validation,
    sectorSameDay: sectorSummary60,
    sensitivity: leaveOneOutSensitivity(rows, baseline60),
    tableA,
    // Full group payloads stay out of the saved JSON; tests can rebuild from rows.
    groupCount: groups.length,
  }
}
