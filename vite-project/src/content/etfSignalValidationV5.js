/**
 * ETF signal chronological validation v5 (research only).
 * The 70/30 date cut is fixed before reading returns.
 * Same-day signals stay in one side. Later prices do not move the cut.
 */
import { summarizeSymbol } from "./etfSignalCompare.js"
import { REGIME_ORDER, REGIME_RULE, buildRegimeByDate } from "./etfSignalRegimeV3.js"

export { REGIME_ORDER, REGIME_RULE }

/** Fixed before reading the 905-signal split. */
export const VALIDATION_RULE = {
  trainFraction: 0.7,
  primaryHorizon: 60,
  smallSampleComplete: 30,
  medianGapPct: 5,
  concentrationShare: 0.5,
  environmentGapPct: 10,
  split:
    "신호일을 시간순으로 묶고, 같은 날짜의 신호는 한 구간에만 둔다. 학습 목표 건수는 날짜가 있는 신호 수의 70%를 반올림한 값이다. 다음 날짜를 더하면 그 목표를 넘는 지점에서 학습을 멈추고, 그 다음 날짜부터 검증 구간이다. 첫 날짜 하나만 목표를 넘으면 그 날짜는 나누지 않고 학습에 둔다.",
  boundary: "구간 경계는 신호일만으로 정한다. 수익률, 이후 가격, 검증 구간 성과는 경계와 국면 기준에 쓰지 않는다.",
  regime: "시장 국면은 v3에 고정한 QQQ 규칙을 신호일 당일까지의 종가에만 적용한다.",
  independence:
    "같은 날의 ETF 신호는 서로 독립인 표본으로 보지 않는다. 과거 신호가 많다는 사실만으로 이후 성과를 보장하지 않는다.",
  compare:
    "60거래일 중앙값 차이가 5%p 이상이고 양쪽 완료 건수가 모두 30건 이상일 때만 차이로 표시한다. 그보다 적으면 비교 불가다.",
  environment: "학습 구간과 검증 구간의 국면 비중 차이가 10%p 이상이면 시장 환경이 다르다고 표시한다.",
  limit: "완료 30건 미만인 결과는 그 구간 밖으로 일반화하지 않는다. 검증 결과를 보고 매수 기준이나 국면 기준을 바꾸지 않는다.",
}

function round2(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

export function targetTrainCount(count, fraction = VALIDATION_RULE.trainFraction) {
  if (!Number.isFinite(count) || count <= 0) return 0
  return Math.round(count * fraction)
}

function datedSignal(episode) {
  return typeof episode?.signalDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(episode.signalDate)
}

/**
 * Chronological date-level split. Returns are not read.
 * @param {object[]} episodes
 * @param {number} fraction
 */
export function splitBySignalDate(episodes, fraction = VALIDATION_RULE.trainFraction) {
  const dated = []
  const undated = []
  for (const episode of episodes || []) {
    if (datedSignal(episode)) dated.push(episode)
    else undated.push(episode)
  }
  const ordered = [...dated].sort(
    (a, b) => a.signalDate.localeCompare(b.signalDate) || String(a.symbol).localeCompare(String(b.symbol)) || String(a.id).localeCompare(String(b.id)),
  )
  const groups = []
  for (const episode of ordered) {
    const last = groups.at(-1)
    if (last && last.date === episode.signalDate) last.episodes.push(episode)
    else groups.push({ date: episode.signalDate, episodes: [episode] })
  }
  const target = targetTrainCount(ordered.length, fraction)
  const train = []
  let index = 0
  while (index < groups.length && train.length + groups[index].episodes.length <= target) {
    train.push(...groups[index].episodes)
    index += 1
  }
  if (!train.length && groups.length) {
    train.push(...groups[0].episodes)
    index = 1
  }
  const validation = groups.slice(index).flatMap((group) => group.episodes)
  return {
    fraction,
    target,
    train,
    validation,
    undated,
    trainEndDate: train.length ? train[train.length - 1].signalDate : null,
    validationStartDate: validation.length ? validation[0].signalDate : null,
  }
}

/**
 * Validation median minus train median, on the 60-day price return.
 * @param {object} trainSummary
 * @param {object} validationSummary
 */
export function compareSplitMedian(trainSummary, validationSummary) {
  const train = trainSummary?.horizons?.["60"]
  const validation = validationSummary?.horizons?.["60"]
  if ((train?.complete || 0) < VALIDATION_RULE.smallSampleComplete || (validation?.complete || 0) < VALIDATION_RULE.smallSampleComplete) {
    return { status: "비교 불가", gapPct: null }
  }
  if (!Number.isFinite(train?.priceMedian) || !Number.isFinite(validation?.priceMedian)) {
    return { status: "비교 불가", gapPct: null }
  }
  const gapPct = round2(validation.priceMedian - train.priceMedian)
  if (Math.abs(gapPct) >= VALIDATION_RULE.medianGapPct) {
    return { status: gapPct > 0 ? "검증 구간이 더 높음" : "검증 구간이 더 낮음", gapPct }
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

function tagEpisodes(episodes, byDate) {
  return episodes.map((episode) => ({
    ...episode,
    year: datedSignal(episode) ? episode.signalDate.slice(0, 4) : null,
    regime: episode?.signalDate && byDate.has(episode.signalDate) ? byDate.get(episode.signalDate) : "unclassified",
  }))
}

function leader(episodes, keyOf) {
  const counts = new Map()
  for (const episode of episodes) {
    const key = keyOf(episode)
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  let best = null
  for (const [key, count] of counts) {
    if (!best || count > best.count || (count === best.count && String(key) < String(best.key))) best = { key, count }
  }
  const sharePct = episodes.length && best ? round2((best.count / episodes.length) * 100) : null
  return {
    key: best?.key ?? null,
    count: best?.count ?? 0,
    sharePct,
    concentrated: Boolean(episodes.length && best && best.count / episodes.length >= VALIDATION_RULE.concentrationShare),
  }
}

function yearRows(episodes) {
  const years = [...new Set(episodes.map((episode) => episode.year).filter(Boolean))].sort()
  return years.map((year) => {
    const list = episodes.filter((episode) => episode.year === year)
    const summary = summarizeSymbol({ symbol: year, themeShort: year }, list)
    return {
      year,
      signals: list.length,
      sharePct: episodes.length ? round2((list.length / episodes.length) * 100) : null,
      summary,
      smallSample: summary.horizons["60"].complete < VALIDATION_RULE.smallSampleComplete,
    }
  })
}

function describeSplit(episodes, metas) {
  const bySymbol = new Map()
  for (const episode of episodes) {
    if (!episode?.symbol) continue
    const list = bySymbol.get(episode.symbol) || []
    list.push(episode)
    bySymbol.set(episode.symbol, list)
  }
  const regimes = {}
  for (const regime of REGIME_ORDER) {
    regimes[regime] = summarizeSymbol(
      { symbol: regime, themeShort: regime },
      episodes.filter((episode) => episode.regime === regime),
    )
  }
  const dates = new Set(episodes.map((episode) => episode.signalDate).filter(Boolean))
  return {
    signals: episodes.length,
    dates: dates.size,
    startDate: episodes.length ? episodes[0].signalDate : null,
    endDate: episodes.length ? episodes[episodes.length - 1].signalDate : null,
    summary: summarizeSymbol({ symbol: "전체", themeShort: "전체" }, episodes),
    symbols: metas.map((meta) => summarizeSymbol(meta, bySymbol.get(meta.symbol) || [])),
    regimes,
    years: yearRows(episodes),
    yearLeader: leader(episodes, (episode) => episode.year),
    etfLeader: leader(episodes, (episode) => episode.symbol),
  }
}

function environmentGap(train, validation) {
  const gaps = REGIME_ORDER.map((regime) => {
    const trainShare = train.signals ? round2((train.regimes[regime].signals / train.signals) * 100) : null
    const validationShare = validation.signals ? round2((validation.regimes[regime].signals / validation.signals) * 100) : null
    if (trainShare == null || validationShare == null) return { regime, trainShare, validationShare, gapPct: null, different: false }
    const gapPct = round2(validationShare - trainShare)
    return {
      regime,
      trainShare,
      validationShare,
      gapPct,
      different: Math.abs(gapPct) >= VALIDATION_RULE.environmentGapPct,
    }
  })
  return { different: gaps.some((row) => row.different), gaps }
}

/**
 * @param {{ universe?: string[], episodes?: object[] }} report
 * @param {Array<{ date: string, close: number }>} qqqBars
 */
export function analyzeValidation(report, qqqBars) {
  const episodes = Array.isArray(report?.episodes) ? report.episodes : []
  const split = splitBySignalDate(episodes)
  const byDate = buildRegimeByDate(qqqBars)
  const metas = metasFromReport(report)
  const train = describeSplit(tagEpisodes(split.train, byDate), metas)
  const validation = describeSplit(tagEpisodes(split.validation, byDate), metas)
  const qqqDates = [...byDate.keys()]
  return {
    version: 5,
    researchOnly: true,
    source: "etf_signal_track_v1",
    independentSamples: false,
    guaranteesFuture: false,
    rule: VALIDATION_RULE,
    regimeRule: REGIME_RULE,
    qqqAsOf: qqqDates.length ? qqqDates[qqqDates.length - 1] : null,
    target: split.target,
    trainEndDate: split.trainEndDate,
    validationStartDate: split.validationStartDate,
    undated: split.undated.length,
    counts: {
      total: episodes.length,
      train: train.signals,
      validation: validation.signals,
      assigned: train.signals + validation.signals + split.undated.length,
    },
    train,
    validation,
    verdict: compareSplitMedian(train.summary, validation.summary),
    environment: environmentGap(train, validation),
  }
}
