/**
 * ETF signal comparison v2 (research only).
 * Aggregates stored v1 episode results. Does not recompute returns.
 */

export const COMPARE_HORIZONS = [20, 60, 120]
export const COMPARE_SORT_HORIZON = 60

export const COMPARE_BASIS = {
  source: "v1에 저장된 신호 ID, 신호일, 진입가, 평가 기간, 가격 수익률, 최대 하락폭, 총수익률을 그대로 집계한다.",
  sample:
    "완료된 신호만 평균, 중앙값, 양수 비율에 넣는다. 미완료와 결측은 건수로만 세고 0으로 바꾸지 않는다.",
  size: "종목별 신호 건수와 기간별 완료 건수가 표본 크기다. 완료 건수가 적으면 평균과 중앙값이 쉽게 흔들린다.",
  overlap:
    "ETF마다 신호 발생일이 겹칠 수 있다. 이 표는 종목별 기록의 요약이며, 여러 ETF의 신호를 서로 독립인 표본으로 합산하지 않는다.",
  sort: "기본 정렬은 60거래일 가격 수익률 중앙값이다. 완료 건수가 0이면 표본 없음으로 두고 뒤쪽에 둔다.",
}

function round2(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

export function mean(values) {
  const xs = (values || []).filter((value) => Number.isFinite(value))
  if (!xs.length) return null
  return round2(xs.reduce((sum, value) => sum + value, 0) / xs.length)
}

export function median(values) {
  const xs = (values || []).filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  if (!xs.length) return null
  const mid = Math.floor(xs.length / 2)
  if (xs.length % 2) return xs[mid]
  return round2((xs[mid - 1] + xs[mid]) / 2)
}

/** Share of strictly positive numbers, in percent. An empty sample stays null. */
export function positiveRate(values) {
  const xs = (values || []).filter((value) => Number.isFinite(value))
  if (!xs.length) return null
  return round2((xs.filter((value) => value > 0).length / xs.length) * 100)
}

function horizonOf(episode, tradingDays) {
  return episode?.horizons?.[String(tradingDays)] ?? episode?.horizons?.[tradingDays] ?? null
}

function finiteComplete(row, statusKey, valueKey) {
  return row?.[statusKey] === "complete" && Number.isFinite(row?.[valueKey])
}

export function summarizeSymbol(meta, episodes) {
  const list = episodes || []
  const horizons = {}
  for (const tradingDays of COMPARE_HORIZONS) {
    const rows = list.map((episode) => horizonOf(episode, tradingDays))
    const price = rows.filter((row) => finiteComplete(row, "priceReturnStatus", "priceReturnPct"))
    const drawdown = rows.filter((row) => finiteComplete(row, "maxDrawdownStatus", "maxDrawdownPct"))
    const total = rows.filter((row) => finiteComplete(row, "totalReturnStatus", "totalReturnPct"))
    const priceValues = price.map((row) => row.priceReturnPct)
    horizons[String(tradingDays)] = {
      complete: price.length,
      incomplete: list.length - price.length,
      priceMean: mean(priceValues),
      priceMedian: median(priceValues),
      positiveRate: positiveRate(priceValues),
      drawdownCount: drawdown.length,
      drawdownMean: mean(drawdown.map((row) => row.maxDrawdownPct)),
      drawdownMedian: median(drawdown.map((row) => row.maxDrawdownPct)),
      totalCount: total.length,
      totalMean: mean(total.map((row) => row.totalReturnPct)),
      totalMedian: median(total.map((row) => row.totalReturnPct)),
    }
  }
  const recovered = list.filter(
    (episode) => episode?.recovery?.status === "recovered" && Number.isFinite(episode.recovery.tradingDays),
  )
  return {
    symbol: meta.symbol,
    themeShort: meta.themeShort || meta.symbol,
    signals: list.length,
    horizons,
    recoveryCount: recovered.length,
    recoveryMedian: median(recovered.map((episode) => episode.recovery.tradingDays)),
  }
}

export function sortBy60DayMedian(rows) {
  return [...(rows || [])].sort((a, b) => {
    const left = a.horizons?.["60"]?.priceMedian
    const right = b.horizons?.["60"]?.priceMedian
    const leftOk = Number.isFinite(left)
    const rightOk = Number.isFinite(right)
    if (leftOk !== rightOk) return leftOk ? -1 : 1
    if (leftOk && left !== right) return right - left
    const leftCount = a.horizons?.["60"]?.complete || 0
    const rightCount = b.horizons?.["60"]?.complete || 0
    if (leftCount !== rightCount) return rightCount - leftCount
    return String(a.symbol).localeCompare(String(b.symbol))
  })
}

/**
 * @param {{ universe?: string[], episodes?: object[] }} report v1 research file
 */
export function compareSignalReport(report) {
  const episodes = Array.isArray(report?.episodes) ? report.episodes : []
  const bySymbol = new Map()
  for (const episode of episodes) {
    const symbol = episode?.symbol
    if (!symbol) continue
    const list = bySymbol.get(symbol) || []
    list.push(episode)
    bySymbol.set(symbol, list)
  }
  const universe = Array.isArray(report?.universe) && report.universe.length
    ? report.universe
    : [...bySymbol.keys()]
  const metas = universe.map((symbol) => {
    const sample = (bySymbol.get(symbol) || [])[0]
    return { symbol, themeShort: sample?.themeShort || symbol }
  })
  const known = new Set(universe)
  for (const symbol of bySymbol.keys()) {
    if (!known.has(symbol)) metas.push({ symbol, themeShort: symbol })
  }
  const rows = sortBy60DayMedian(metas.map((meta) => summarizeSymbol(meta, bySymbol.get(meta.symbol) || [])))
  return {
    version: 2,
    researchOnly: true,
    source: "etf_signal_track_v1",
    independentSamples: false,
    basis: COMPARE_BASIS,
    episodes: episodes.length,
    rows,
  }
}
