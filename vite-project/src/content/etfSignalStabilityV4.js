/**
 * ETF signal stability v4 (research only).
 * Reuses stored v1 returns and the fixed v3 QQQ regime rule.
 * Time buckets are the signal date's calendar year, chosen before the results.
 */
import { mean, median, positiveRate, sortBy60DayMedian, summarizeSymbol } from "./etfSignalCompare.js"
import { REGIME_ORDER, REGIME_RULE, buildRegimeByDate } from "./etfSignalRegimeV3.js"

export { REGIME_ORDER, REGIME_RULE }

/** Fixed before reading the 905-signal split. */
export const STABILITY_RULE = {
  period: "신호 발생일의 달력 연도. 수익률이나 이후 가격으로 구간을 나누지 않는다.",
  primaryHorizon: 60,
  smallSampleComplete: 30,
  concentrationShare: 0.5,
  outlierGapPct: 5,
  cluster:
    "같은 신호일은 하나의 군집이다. 군집 수익률은 그날 평가가 완료된 종목의 동일가중 평균이다. 완료된 종목이 없으면 산출하지 않는다.",
  independence: "같은 날의 ETF 신호는 서로 독립인 표본으로 보지 않는다.",
  outlier:
    "국면 안에서 어떤 연도의 60거래일 중앙값이 나머지 연도보다 5%p 이상 다르고, 양쪽 완료 건수가 모두 30건 이상일 때만 차이 큼으로 표시한다.",
  limit: "완료 30건 미만인 구간이나 종목 결과는 그 구간 밖으로 일반화하지 않는다.",
}

export function yearOf(signalDate) {
  if (typeof signalDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(signalDate)) return null
  return signalDate.slice(0, 4)
}

function horizonRow(episode, tradingDays) {
  return episode?.horizons?.[String(tradingDays)] ?? episode?.horizons?.[tradingDays] ?? null
}

function finiteComplete(row, statusKey, valueKey) {
  return row?.[statusKey] === "complete" && Number.isFinite(row?.[valueKey])
}

/**
 * @param {object} periodSummary
 * @param {object} restSummary
 */
export function comparePeriodMedian(periodSummary, restSummary) {
  const period = periodSummary?.horizons?.["60"]
  const rest = restSummary?.horizons?.["60"]
  const periodComplete = period?.complete || 0
  const restComplete = rest?.complete || 0
  if (periodComplete < STABILITY_RULE.smallSampleComplete || restComplete < STABILITY_RULE.smallSampleComplete) {
    return { status: "비교 불가", gapPct: null }
  }
  if (!Number.isFinite(period?.priceMedian) || !Number.isFinite(rest?.priceMedian)) {
    return { status: "비교 불가", gapPct: null }
  }
  const gapPct = Math.round((period.priceMedian - rest.priceMedian) * 100) / 100
  if (Math.abs(gapPct) >= STABILITY_RULE.outlierGapPct) {
    return { status: gapPct > 0 ? "이 구간이 더 높음" : "이 구간이 더 낮음", gapPct }
  }
  return { status: "비슷함", gapPct }
}

function metasFromReport(report) {
  const episodes = Array.isArray(report?.episodes) ? report.episodes : []
  const universe = Array.isArray(report?.universe) && report.universe.length
    ? report.universe
    : [...new Set(episodes.map((episode) => episode?.symbol).filter(Boolean))]
  return universe.map((symbol) => {
    const sample = episodes.find((episode) => episode?.symbol === symbol)
    return { symbol, themeShort: sample?.themeShort || symbol }
  })
}

export function dateClusters(episodes, tradingDays = 60) {
  const groups = new Map()
  const undated = []
  for (const episode of episodes || []) {
    if (!episode?.signalDate) {
      undated.push(episode)
      continue
    }
    const list = groups.get(episode.signalDate) || []
    list.push(episode)
    groups.set(episode.signalDate, list)
  }
  const clusters = [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, members]) => {
      const price = []
      const drawdown = []
      for (const member of members) {
        const row = horizonRow(member, tradingDays)
        if (finiteComplete(row, "priceReturnStatus", "priceReturnPct")) price.push(row.priceReturnPct)
        if (finiteComplete(row, "maxDrawdownStatus", "maxDrawdownPct")) drawdown.push(row.maxDrawdownPct)
      }
      return {
        date,
        symbols: members.map((member) => member.symbol),
        members: members.length,
        complete: price.length,
        incomplete: members.length - price.length,
        partial: price.length > 0 && price.length < members.length,
        priceMean: mean(price),
        drawdownMean: mean(drawdown),
      }
    })
  const usable = clusters.filter((cluster) => Number.isFinite(cluster.priceMean))
  const drawdownUsable = clusters.filter((cluster) => Number.isFinite(cluster.drawdownMean))
  const multi = clusters.filter((cluster) => cluster.members >= 2)
  const multiSignals = multi.reduce((sum, cluster) => sum + cluster.members, 0)
  const largest = clusters.reduce((best, cluster) => (cluster.members > (best?.members || 0) ? cluster : best), null)
  const totalSignals = (episodes || []).length
  return {
    tradingDays,
    dates: clusters.length,
    undated: undated.length,
    multiDates: multi.length,
    multiSignals,
    multiSharePct: totalSignals ? Math.round((multiSignals / totalSignals) * 10000) / 100 : null,
    largest,
    clusters,
    priceMean: mean(usable.map((cluster) => cluster.priceMean)),
    priceMedian: median(usable.map((cluster) => cluster.priceMean)),
    positiveRate: positiveRate(usable.map((cluster) => cluster.priceMean)),
    drawdownMean: mean(drawdownUsable.map((cluster) => cluster.drawdownMean)),
    drawdownMedian: median(drawdownUsable.map((cluster) => cluster.drawdownMean)),
    usableClusters: usable.length,
    incompleteClusters: clusters.length - usable.length,
  }
}

/**
 * @param {{ universe?: string[], episodes?: object[] }} report
 * @param {Array<{ date: string, close: number }>} qqqBars
 */
export function analyzeStability(report, qqqBars) {
  const episodes = Array.isArray(report?.episodes) ? report.episodes : []
  const byDate = buildRegimeByDate(qqqBars)
  const tagged = episodes.map((episode) => ({
    ...episode,
    year: yearOf(episode?.signalDate),
    regime: episode?.signalDate && byDate.has(episode.signalDate) ? byDate.get(episode.signalDate) : "unclassified",
  }))
  const years = [...new Set(tagged.map((episode) => episode.year).filter(Boolean))].sort()
  const periods = years.map((year) => {
    const list = tagged.filter((episode) => episode.year === year)
    const summary = summarizeSymbol({ symbol: year, themeShort: year }, list)
    return {
      year,
      summary,
      smallSample: summary.horizons["60"].complete < STABILITY_RULE.smallSampleComplete,
    }
  })
  const undated = tagged.filter((episode) => !episode.year)
  if (undated.length) {
    const summary = summarizeSymbol({ symbol: "날짜 없음", themeShort: "날짜 없음" }, undated)
    periods.push({
      year: "날짜 없음",
      summary,
      smallSample: summary.horizons["60"].complete < STABILITY_RULE.smallSampleComplete,
    })
  }
  const regimes = {}
  for (const regime of REGIME_ORDER) {
    const list = tagged.filter((episode) => episode.regime === regime)
    const yearRows = years.map((year) => {
      const subset = list.filter((episode) => episode.year === year)
      const rest = list.filter((episode) => episode.year !== year)
      const summary = summarizeSymbol({ symbol: year, themeShort: year }, subset)
      const restSummary = summarizeSymbol({ symbol: "나머지", themeShort: "나머지" }, rest)
      const sharePct = list.length ? Math.round((subset.length / list.length) * 10000) / 100 : null
      return {
        year,
        summary,
        sharePct,
        concentrated: list.length > 0 && subset.length / list.length >= STABILITY_RULE.concentrationShare,
        smallSample: summary.horizons["60"].complete < STABILITY_RULE.smallSampleComplete,
        verdict: comparePeriodMedian(summary, restSummary),
      }
    }).filter((row) => row.summary.signals > 0)
    regimes[regime] = {
      total: summarizeSymbol({ symbol: "전체", themeShort: "전체" }, list),
      years: yearRows,
    }
  }
  const metas = metasFromReport(report)
  const bySymbol = new Map()
  for (const episode of tagged) {
    if (!episode?.symbol) continue
    const list = bySymbol.get(episode.symbol) || []
    list.push(episode)
    bySymbol.set(episode.symbol, list)
  }
  const symbols = sortBy60DayMedian(metas.map((meta) => summarizeSymbol(meta, bySymbol.get(meta.symbol) || [])))
  const overlap = dateClusters(tagged, STABILITY_RULE.primaryHorizon)
  const single = tagged.filter((episode) => {
    if (!episode.signalDate) return false
    return tagged.filter((other) => other.signalDate === episode.signalDate).length === 1
  })
  const singleSummary = summarizeSymbol({ symbol: "단독 날짜", themeShort: "단독 날짜" }, single)
  const signalSummary = summarizeSymbol({ symbol: "전체", themeShort: "전체" }, tagged)
  const series = (qqqBars || []).filter((bar) => typeof bar?.date === "string" && Number(bar.close) > 0)
  return {
    version: 4,
    researchOnly: true,
    source: "etf_signal_track_v1",
    independentSamples: false,
    rule: STABILITY_RULE,
    regimeRule: REGIME_RULE,
    qqqAsOf: series.length ? series[series.length - 1].date : null,
    counts: {
      total: tagged.length,
      periods: periods.reduce((sum, period) => sum + period.summary.signals, 0),
      regimes: REGIME_ORDER.reduce((sum, regime) => sum + regimes[regime].total.signals, 0),
    },
    signalSummary,
    periods,
    regimes,
    symbols,
    overlap,
    singleSummary,
  }
}
