/**
 * DBB chart quality analysis v1 (research only).
 * Scores use signal-day closes only. Entry is the next session open.
 * Rules are fixed before reading outcomes. Do not retune after results.
 */
import { enrichBarsWithIndicators, smaSeries } from "./daily-bottom-indicators.mjs"
import { conditionFlags } from "./daily-bottom-buy-validation-core.mjs"
import { FROZEN_THRESHOLDS, buildSplitBuyEpisodes } from "./daily-bottom-split-buy-sim.mjs"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./equity-sell-research-universe.mjs"
import { EQUITY_CANDIDATES } from "./daily-bottom-buy-cross-asset-validation.mjs"

export const CHART_QUALITY_VERSION = 1
export const HORIZONS = [20, 60, 120]
export const TRAIN_FRACTION = 0.7
export const SMALL_SAMPLE = 30
export const MIN_WEIGHT_PCT = 70

/** Fixed before reading outcomes. Sector map uses only confirmed ETF caches. */
export const SECTOR_BENCHMARK = {
  AMZN: "XLK",
  AAPL: "XLK",
  AMAT: "SMH",
  ASML: "SMH",
  AVGO: "SMH",
  CEG: "GRID",
  ETN: "GRID",
  FCX: null,
  FTNT: "CIBR",
  GOOGL: "XLK",
  LRCX: "SMH",
  LLY: "XLV",
  MU: "SMH",
  NVDA: "SMH",
  ORCL: "XLK",
  PANW: "CIBR",
  PLTR: "IGV",
  TSLA: "XLY",
  TSM: "SMH",
  VST: "GRID",
  KLAC: "SMH",
  ANET: "XLK",
  VRT: "GRID",
  PWR: "GRID",
  V: "XLF",
  MSFT: "XLK",
  GEV: "GRID",
  ISRG: "XLV",
  SNPS: "IGV",
  AMD: "SMH",
  CRWD: "CIBR",
}

export const MARKET_BENCHMARK = "QQQ"

export const SCORE_RULE = {
  A: {
    weight: 30,
    label: "장기 추세",
    detail:
      "종가>SMA200 8점, SMA200 대비 −5% 이내 4점. 종가>SMA60 5점, −5% 이내 2점. SMA60 20일 기울기>0 5점, ≥−1% 2점. SMA200 20일 기울기>0 6점, ≥−1% 3점. SMA20>SMA60>SMA120>SMA200이면 6점, 연속 쌍 3개면 3점. SMA200이 없으면 A는 계산 불가.",
  },
  B: {
    weight: 25,
    label: "하락 구조와 지지",
    detail:
      "최근 60일 저점이 직전 60일 저점보다 높거나 2% 이내면 8점. 60일 고점 대비 하락 −10%~−25%면 8점, −5%~−10% 또는 −25%~−35%면 4점, 그 밖이면 1점. 20일 하락이 60일 하락보다 완만하면 5점. 종가가 60일 저점 3% 이내면 4점, 8% 이내면 2점.",
  },
  C: {
    weight: 25,
    label: "상대강도",
    detail:
      "같은 종료일의 종가 기준. QQQ 대비 20일 초과수익>0 6점, >−3%p 3점. 60일 초과수익>0 7점, >−5%p 3점. 업종 ETF가 있으면 같은 방식으로 20일 6점·60일 6점. 업종 ETF를 정할 수 없으면 해당 세부 점수는 비교 불가이며 추정하지 않는다.",
  },
  D: {
    weight: 10,
    label: "거래량 변화",
    detail:
      "거래량/20일 평균 >1.2면 4점, >0.8면 2점. 최근 20거래일 상승일 평균 거래량이 하락일 이상이면 6점, 10% 이내 열세면 2점. 거래량이 없으면 D는 계산 불가.",
  },
  E: {
    weight: 10,
    label: "반등 확인",
    detail:
      "신호일까지. 종가>SMA5면 4점. 최근 3일 수익률>0이면 3점. 최근 10일 저점 대비 회복 비율 ≥50%면 3점, ≥25%면 1점. 이후 반등은 쓰지 않는다.",
  },
  total:
    "A·B·E와 QQQ 상대강도가 있으면 유효 항목만 합산하고 유효 가중치 비율을 표시한다. A 또는 B가 없으면 총점은 계산 불가. 결측을 0점으로 채우지 않는다.",
  entry: "진입가는 신호일 다음 거래일 시가. 없으면 미확정이며 성과는 미완료다.",
  outcome:
    "가격 수익률은 진입 시가 대비 20·60·120거래일 뒤 종가. 최대 불리 움직임은 그 기간 저가 기준. 총수익률은 adjClose가 있을 때만 계산하고 없으면 추정하지 않는다.",
  split:
    "신호일을 시간순으로 묶어 70% 학습·30% 검증. 같은 날짜의 신호는 한쪽에만 둔다. 점수 규칙은 성과를 보기 전에 고정한다.",
}

function round2(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

function pct(fraction) {
  if (fraction == null || !Number.isFinite(fraction)) return null
  return round2(fraction * 100)
}

function finite(value) {
  return value != null && Number.isFinite(Number(value))
}

function slopePct(series, index, lookback = 20) {
  if (index < lookback) return null
  const now = series[index]
  const prev = series[index - lookback]
  if (!finite(now) || !finite(prev) || !(prev > 0)) return null
  return ((now - prev) / prev) * 100
}

function returnPct(closes, endIdx, lookback) {
  if (endIdx < lookback) return null
  const end = closes[endIdx]
  const start = closes[endIdx - lookback]
  if (!finite(end) || !finite(start) || !(start > 0)) return null
  return ((end - start) / start) * 100
}

function minInRange(values, from, to) {
  let min = Infinity
  for (let i = from; i <= to; i++) {
    const value = values[i]
    if (!finite(value)) return null
    if (value < min) min = value
  }
  return Number.isFinite(min) ? min : null
}

function maxInRange(values, from, to) {
  let max = -Infinity
  for (let i = from; i <= to; i++) {
    const value = values[i]
    if (!finite(value)) return null
    if (value > max) max = value
  }
  return Number.isFinite(max) ? max : null
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

export function sectorBenchmarkFor(symbol) {
  const key = String(symbol || "").toUpperCase()
  if (!(key in SECTOR_BENCHMARK)) return { symbol: null, status: "unknown_symbol" }
  const sector = SECTOR_BENCHMARK[key]
  if (!sector) return { symbol: null, status: "unavailable" }
  return { symbol: sector, status: "ok" }
}

/**
 * Chart score at signalIdx. Reads bars[0..signalIdx] only.
 * @param {object[]} bars
 * @param {number} signalIdx
 * @param {{ qqqByDate?: Map, sectorByDate?: Map|null, sectorSymbol?: string|null }} benchmarks
 */
export function scoreChartAtSignal(bars, signalIdx, benchmarks = {}) {
  if (!Number.isInteger(signalIdx) || signalIdx < 0 || signalIdx >= (bars || []).length) {
    return unavailableScore("신호 인덱스 없음")
  }
  const prefix = bars.slice(0, signalIdx + 1)
  const closes = prefix.map((bar) => Number(bar.close))
  const volumes = prefix.map((bar) => Number(bar.volume))
  const lows = prefix.map((bar) => Number(bar.low))
  const high = prefix.map((bar) => Number(bar.high))
  const i = prefix.length - 1
  const close = closes[i]
  if (!finite(close) || !(close > 0)) return unavailableScore("종가 없음")

  const sma5 = smaSeries(closes, 5)
  const sma20 = smaSeries(closes, 20)
  const sma60 = smaSeries(closes, 60)
  const sma120 = smaSeries(closes, 120)
  const sma200 = smaSeries(closes, 200)

  const A = scoreTrend(close, sma20[i], sma60[i], sma120[i], sma200[i], slopePct(sma60, i), slopePct(sma200, i))
  const B = scoreStructure(closes, lows, high, i)
  const C = scoreRelative(closes, i, benchmarks, prefix[i].date)
  const D = scoreVolume(volumes, closes, i)
  const E = scoreBounce(closes, lows, high, sma5[i], i)

  const parts = { A, B, C, D, E }
  const available = Object.values(parts).filter((part) => part.score != null)
  const weightAvailable = available.reduce((sum, part) => sum + part.weight, 0)
  const scoreRaw = available.reduce((sum, part) => sum + part.score, 0)
  const requiredOk = A.score != null && B.score != null && C.qqqOk === true && E.score != null
  const weightPct = round2((weightAvailable / 100) * 100)
  let totalScore = null
  let totalStatus = "unavailable"
  if (requiredOk && weightAvailable > 0) {
    totalScore = round2(scoreRaw)
    totalStatus = weightPct >= MIN_WEIGHT_PCT ? "complete" : "partial"
  }

  return {
    totalScore,
    totalStatus,
    scoreRaw: round2(scoreRaw),
    weightAvailable,
    weightPct,
    parts,
    asOf: prefix[i].date,
  }
}

function unavailableScore(reason) {
  return {
    totalScore: null,
    totalStatus: "unavailable",
    scoreRaw: null,
    weightAvailable: 0,
    weightPct: 0,
    parts: {
      A: { score: null, weight: 30, status: "unavailable", reason },
      B: { score: null, weight: 25, status: "unavailable", reason },
      C: { score: null, weight: 25, status: "unavailable", reason, qqqOk: false },
      D: { score: null, weight: 10, status: "unavailable", reason },
      E: { score: null, weight: 10, status: "unavailable", reason },
    },
    asOf: null,
  }
}

function scoreTrend(close, s20, s60, s120, s200, slope60, slope200) {
  if (![s20, s60, s120, s200].every((value) => finite(value) && value > 0) || !finite(slope60) || !finite(slope200)) {
    return { score: null, weight: 30, status: "unavailable", detail: {} }
  }
  let score = 0
  const vs200 = ((close - s200) / s200) * 100
  if (close > s200) score += 8
  else if (vs200 >= -5) score += 4
  const vs60 = ((close - s60) / s60) * 100
  if (close > s60) score += 5
  else if (vs60 >= -5) score += 2
  if (slope60 > 0) score += 5
  else if (slope60 >= -1) score += 2
  if (slope200 > 0) score += 6
  else if (slope200 >= -1) score += 3
  const pairs = [s20 > s60, s60 > s120, s120 > s200]
  if (pairs.every(Boolean)) score += 6
  else if (pairs.filter(Boolean).length === 2 && pairs[0] && pairs[1]) score += 3
  else if (pairs.filter(Boolean).length === 2 && pairs[1] && pairs[2]) score += 3
  return {
    score,
    weight: 30,
    status: "complete",
    detail: { vs200: round2(vs200), vs60: round2(vs60), slope60: round2(slope60), slope200: round2(slope200) },
  }
}

function scoreStructure(closes, lows, highs, i) {
  if (i < 119) return { score: null, weight: 25, status: "unavailable", detail: {} }
  const recentLow = minInRange(lows, i - 59, i)
  const priorLow = minInRange(lows, i - 119, i - 60)
  const recentHigh = maxInRange(highs, i - 59, i)
  const ret20 = returnPct(closes, i, 20)
  const ret60 = returnPct(closes, i, 60)
  if (![recentLow, priorLow, recentHigh, ret20, ret60].every(finite) || !(recentHigh > 0)) {
    return { score: null, weight: 25, status: "unavailable", detail: {} }
  }
  let score = 0
  const lowChange = ((recentLow - priorLow) / priorLow) * 100
  if (recentLow >= priorLow || lowChange >= -2) score += 8
  const drawdown = ((closes[i] - recentHigh) / recentHigh) * 100
  if (drawdown <= -10 && drawdown >= -25) score += 8
  else if ((drawdown <= -5 && drawdown > -10) || (drawdown < -25 && drawdown >= -35)) score += 4
  else score += 1
  if (ret20 >= ret60) score += 5
  const distLow = ((closes[i] - recentLow) / recentLow) * 100
  if (distLow <= 3) score += 4
  else if (distLow <= 8) score += 2
  return {
    score,
    weight: 25,
    status: "complete",
    detail: { lowChange: round2(lowChange), drawdown: round2(drawdown), ret20: round2(ret20), ret60: round2(ret60), distLow: round2(distLow) },
  }
}

function scoreRelative(closes, i, benchmarks, date) {
  const ret20 = returnPct(closes, i, 20)
  const ret60 = returnPct(closes, i, 60)
  const qqqRet = benchmarkReturns(benchmarks.qqqByDate, date, [20, 60])
  const sectorRet = benchmarks.sectorByDate
    ? benchmarkReturns(benchmarks.sectorByDate, date, [20, 60])
    : { 20: null, 60: null, status: benchmarks.sectorSymbol ? "missing_bars" : "unavailable" }

  if (!finite(ret20) || !finite(ret60) || !finite(qqqRet[20]) || !finite(qqqRet[60])) {
    return {
      score: null,
      weight: 25,
      status: "unavailable",
      qqqOk: false,
      detail: { ret20: round2(ret20), ret60: round2(ret60), qqq: qqqRet, sector: sectorRet },
    }
  }

  let score = 0
  let weight = 13
  const excessQ20 = ret20 - qqqRet[20]
  const excessQ60 = ret60 - qqqRet[60]
  if (excessQ20 > 0) score += 6
  else if (excessQ20 > -3) score += 3
  if (excessQ60 > 0) score += 7
  else if (excessQ60 > -5) score += 3

  let sectorStatus = "unavailable"
  if (finite(sectorRet[20]) && finite(sectorRet[60])) {
    weight = 25
    sectorStatus = "complete"
    const excessS20 = ret20 - sectorRet[20]
    const excessS60 = ret60 - sectorRet[60]
    if (excessS20 > 0) score += 6
    else if (excessS20 > -3) score += 3
    if (excessS60 > 0) score += 6
    else if (excessS60 > -5) score += 3
  }

  return {
    score,
    weight,
    status: sectorStatus === "complete" ? "complete" : "partial",
    qqqOk: true,
    detail: {
      ret20: round2(ret20),
      ret60: round2(ret60),
      excessQqq20: round2(excessQ20),
      excessQqq60: round2(excessQ60),
      excessSector20: finite(sectorRet[20]) ? round2(ret20 - sectorRet[20]) : null,
      excessSector60: finite(sectorRet[60]) ? round2(ret60 - sectorRet[60]) : null,
      sectorSymbol: benchmarks.sectorSymbol || null,
      sectorStatus,
    },
  }
}

/**
 * Benchmark return ending on exact date. Needs lookback prior closes on that calendar.
 * Uses the map's ordered dates up to and including `date`.
 */
export function benchmarkReturns(byDate, date, lookbacks) {
  const out = { status: "unavailable" }
  for (const days of lookbacks) out[days] = null
  if (!byDate?.size || !date) return out
  const dates = [...byDate.keys()].filter((key) => key <= date).sort()
  if (!dates.length || dates[dates.length - 1] !== date) return out
  const closes = dates.map((key) => byDate.get(key))
  const end = closes.length - 1
  out.status = "ok"
  for (const days of lookbacks) {
    out[days] = returnPct(closes, end, days)
  }
  return out
}

function scoreVolume(volumes, closes, i) {
  if (i < 19) return { score: null, weight: 10, status: "unavailable", detail: {} }
  const window = volumes.slice(i - 19, i + 1)
  if (!window.every((value) => finite(value) && value >= 0) || !window.some((value) => value > 0)) {
    return { score: null, weight: 10, status: "unavailable", detail: {} }
  }
  const avg = window.reduce((sum, value) => sum + value, 0) / window.length
  if (!(avg > 0)) return { score: null, weight: 10, status: "unavailable", detail: {} }
  let score = 0
  const ratio = volumes[i] / avg
  if (ratio > 1.2) score += 4
  else if (ratio > 0.8) score += 2
  let upSum = 0
  let upN = 0
  let downSum = 0
  let downN = 0
  for (let j = i - 19; j <= i; j++) {
    if (j === 0) continue
    const change = closes[j] - closes[j - 1]
    if (!finite(change)) continue
    if (change > 0) {
      upSum += volumes[j]
      upN += 1
    } else if (change < 0) {
      downSum += volumes[j]
      downN += 1
    }
  }
  if (!upN || !downN) return { score: null, weight: 10, status: "unavailable", detail: { ratio: round2(ratio) } }
  const upAvg = upSum / upN
  const downAvg = downSum / downN
  const volumeSkew = downAvg > 0 ? upAvg / downAvg : null
  if (upAvg >= downAvg) score += 6
  else if (finite(volumeSkew) && volumeSkew >= 0.9) score += 2
  return {
    score,
    weight: 10,
    status: "complete",
    detail: { ratio: round2(ratio), volumeSkew: round2(volumeSkew) },
  }
}

function scoreBounce(closes, lows, highs, sma5, i) {
  if (i < 9 || !finite(sma5)) return { score: null, weight: 10, status: "unavailable", detail: {} }
  const ret3 = returnPct(closes, i, 3)
  if (!finite(ret3)) return { score: null, weight: 10, status: "unavailable", detail: {} }
  let score = 0
  if (closes[i] > sma5) score += 4
  if (ret3 > 0) score += 3
  const low10 = minInRange(lows, i - 9, i)
  const high10 = maxInRange(highs, i - 9, i)
  if (!finite(low10) || !finite(high10) || !(high10 > low10)) {
    return { score: null, weight: 10, status: "unavailable", detail: { ret3: round2(ret3) } }
  }
  const drop = high10 - low10
  const recovered = (closes[i] - low10) / drop
  if (recovered >= 0.5) score += 3
  else if (recovered >= 0.25) score += 1
  return {
    score,
    weight: 10,
    status: "complete",
    detail: { ret3: round2(ret3), recovered: round2(recovered * 100) },
  }
}

export function measureNextOpenEntry(bars, signalIdx) {
  const entryIdx = signalIdx + 1
  if (entryIdx >= bars.length) {
    return { entryStatus: "pending", entryIdx: null, entryDate: null, entryPrice: null, horizons: emptyHorizons() }
  }
  const entryPrice = Number(bars[entryIdx]?.open)
  if (!finite(entryPrice) || !(entryPrice > 0)) {
    return { entryStatus: "pending", entryIdx: null, entryDate: null, entryPrice: null, horizons: emptyHorizons() }
  }
  const horizons = {}
  for (const days of HORIZONS) {
    const endIdx = entryIdx + days
    if (endIdx >= bars.length) {
      horizons[String(days)] = incompleteHorizon(days)
      continue
    }
    const endClose = Number(bars[endIdx]?.close)
    let minLow = Infinity
    let lowOk = true
    for (let j = entryIdx; j <= endIdx; j++) {
      const low = Number(bars[j]?.low)
      if (!finite(low) || !(low > 0)) {
        lowOk = false
        break
      }
      if (low < minLow) minLow = low
    }
    const priceOk = finite(endClose) && endClose > 0
    const priceReturnPct = priceOk ? pct((endClose - entryPrice) / entryPrice) : null
    const maxDrawdownPct = lowOk ? pct(Math.max(0, (entryPrice - minLow) / entryPrice)) : null
    horizons[String(days)] = {
      tradingDays: days,
      priceReturnPct,
      priceReturnStatus: priceOk ? "complete" : "incomplete",
      maxDrawdownPct,
      maxDrawdownStatus: lowOk ? "complete" : "incomplete",
      totalReturnPct: null,
      totalReturnStatus: "unavailable",
      endDate: bars[endIdx]?.date ?? null,
    }
  }
  return {
    entryStatus: "confirmed",
    entryIdx,
    entryDate: bars[entryIdx].date,
    entryPrice: round2(entryPrice),
    horizons,
  }
}

function emptyHorizons() {
  return Object.fromEntries(HORIZONS.map((days) => [String(days), incompleteHorizon(days)]))
}

function incompleteHorizon(days) {
  return {
    tradingDays: days,
    priceReturnPct: null,
    priceReturnStatus: "incomplete",
    maxDrawdownPct: null,
    maxDrawdownStatus: "incomplete",
    totalReturnPct: null,
    totalReturnStatus: "unavailable",
    endDate: null,
  }
}

export function benchmarkHorizonReturns(byDate, entryDate, endDate) {
  if (!byDate?.size || !entryDate || !endDate) return null
  const entry = byDate.get(entryDate)
  const end = byDate.get(endDate)
  if (!finite(entry) || !finite(end) || !(entry > 0)) return null
  return pct((end - entry) / entry)
}

export function targetTrainCount(count, fraction = TRAIN_FRACTION) {
  if (!Number.isFinite(count) || count <= 0) return 0
  return Math.round(count * fraction)
}

export function splitBySignalDate(rows, fraction = TRAIN_FRACTION) {
  const dated = [...(rows || [])].filter((row) => typeof row?.signalDate === "string")
  const ordered = dated.sort(
    (a, b) => a.signalDate.localeCompare(b.signalDate) || String(a.symbol).localeCompare(String(b.symbol)) || String(a.id).localeCompare(String(b.id)),
  )
  const groups = []
  for (const row of ordered) {
    const last = groups.at(-1)
    if (last && last.date === row.signalDate) last.rows.push(row)
    else groups.push({ date: row.signalDate, rows: [row] })
  }
  const target = targetTrainCount(ordered.length, fraction)
  const train = []
  let index = 0
  while (index < groups.length && train.length + groups[index].rows.length <= target) {
    train.push(...groups[index].rows)
    index += 1
  }
  if (!train.length && groups.length) {
    train.push(...groups[0].rows)
    index = 1
  }
  const validation = groups.slice(index).flatMap((group) => group.rows)
  return {
    target,
    train,
    validation,
    trainEndDate: train.at(-1)?.signalDate ?? null,
    validationStartDate: validation[0]?.signalDate ?? null,
  }
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

export function summarizeOutcomes(rows, tradingDays = 60) {
  const key = String(tradingDays)
  const list = rows || []
  const price = []
  const drawdown = []
  const excessQqq = []
  const excessSector = []
  for (const row of list) {
    const horizon = row?.horizons?.[key]
    if (horizon?.priceReturnStatus === "complete" && finite(horizon.priceReturnPct)) price.push(horizon.priceReturnPct)
    if (horizon?.maxDrawdownStatus === "complete" && finite(horizon.maxDrawdownPct)) drawdown.push(horizon.maxDrawdownPct)
    if (finite(horizon?.excessQqqPct)) excessQqq.push(horizon.excessQqqPct)
    if (finite(horizon?.excessSectorPct)) excessSector.push(horizon.excessSectorPct)
  }
  return {
    signals: list.length,
    complete: price.length,
    incomplete: list.length - price.length,
    priceMean: mean(price),
    priceMedian: median(price),
    positiveRate: positiveRate(price),
    drawdownMean: mean(drawdown),
    drawdownMedian: median(drawdown),
    excessQqqMean: mean(excessQqq),
    excessQqqMedian: median(excessQqq),
    excessQqqPositiveRate: positiveRate(excessQqq),
    excessSectorMean: mean(excessSector),
    excessSectorMedian: median(excessSector),
    excessSectorPositiveRate: positiveRate(excessSector),
    excessSectorCount: excessSector.length,
  }
}

export function scoreQuartiles(rows) {
  const scored = (rows || [])
    .filter((row) => row?.totalStatus === "complete" && finite(row.totalScore))
    .slice()
    .sort((a, b) => b.totalScore - a.totalScore || a.signalDate.localeCompare(b.signalDate) || a.symbol.localeCompare(b.symbol))
  const n = scored.length
  if (n < 4) {
    return {
      n,
      insufficient: true,
      top: { label: "상위 25%", count: 0, scoreMin: null, scoreMax: null, summary: summarizeOutcomes([]) },
      mid: { label: "중간 50%", count: 0, scoreMin: null, scoreMax: null, summary: summarizeOutcomes([]) },
      bottom: { label: "하위 25%", count: 0, scoreMin: null, scoreMax: null, summary: summarizeOutcomes([]) },
    }
  }
  const topN = Math.floor(n * 0.25)
  const bottomN = Math.floor(n * 0.25)
  const top = scored.slice(0, Math.max(topN, 1))
  const bottom = scored.slice(Math.max(n - bottomN, top.length))
  const mid = scored.slice(top.length, Math.max(n - bottom.length, top.length))
  const band = (label, list) => ({
    label,
    count: list.length,
    scoreMin: list.length ? list[list.length - 1].totalScore : null,
    scoreMax: list.length ? list[0].totalScore : null,
    summary: summarizeOutcomes(list),
  })
  return {
    n,
    insufficient: n < SMALL_SAMPLE,
    top: band("상위 25%", top),
    mid: band("중간 50%", mid),
    bottom: band("하위 25%", bottom),
  }
}

function displayMeta(symbol) {
  const research = EQUITY_SELL_RESEARCH_UNIVERSE.find((row) => row.symbol === symbol)
  const study = EQUITY_CANDIDATES.find((row) => row.symbol === symbol)
  return {
    symbol,
    name: research?.name || symbol,
    group: study?.group || null,
    role: research?.role || null,
  }
}

/**
 * @param {Record<string, object[]>} seriesBySymbol equity OHLCV bars
 * @param {Record<string, object[]>} benchmarkSeries QQQ + sector ETFs
 */
export function analyzeChartQuality(seriesBySymbol, benchmarkSeries = {}) {
  const qqqBars = benchmarkSeries.QQQ || benchmarkSeries.qqq || []
  const qqqByDate = buildCloseMap(qqqBars)
  const rows = []
  const universe = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
  const missingData = []
  let asOf = null

  for (const symbol of universe) {
    const bars = seriesBySymbol[symbol]
    if (!Array.isArray(bars) || bars.length < 220) {
      missingData.push({ symbol, reason: "ohlcv_insufficient" })
      continue
    }
    const last = bars[bars.length - 1]?.date
    if (last && (!asOf || last > asOf)) asOf = last
    const enriched = enrichBarsWithIndicators(bars)
    const episodes = buildSplitBuyEpisodes(enriched, FROZEN_THRESHOLDS, { fromIdx: 0, toIdx: enriched.length })
    const sector = sectorBenchmarkFor(symbol)
    const sectorBars = sector.symbol ? benchmarkSeries[sector.symbol] : null
    const sectorByDate = sector.symbol && Array.isArray(sectorBars) ? buildCloseMap(sectorBars) : null
    for (const episode of episodes) {
      const signalIdx = episode.openIdx
      const signalDate = bars[signalIdx]?.date
      const flags = conditionFlags(enriched[signalIdx], FROZEN_THRESHOLDS)
      const score = scoreChartAtSignal(bars, signalIdx, {
        qqqByDate,
        sectorByDate,
        sectorSymbol: sector.symbol,
      })
      const entry = measureNextOpenEntry(bars, signalIdx)
      for (const days of HORIZONS) {
        const key = String(days)
        const horizon = entry.horizons[key]
        if (horizon?.priceReturnStatus === "complete" && entry.entryDate && horizon.endDate) {
          const qqqRet = benchmarkHorizonReturns(qqqByDate, entry.entryDate, horizon.endDate)
          horizon.qqqReturnPct = qqqRet
          horizon.excessQqqPct = finite(qqqRet) ? round2(horizon.priceReturnPct - qqqRet) : null
          if (sectorByDate) {
            const sectorRet = benchmarkHorizonReturns(sectorByDate, entry.entryDate, horizon.endDate)
            horizon.sectorSymbol = sector.symbol
            horizon.sectorReturnPct = sectorRet
            horizon.excessSectorPct = finite(sectorRet) ? round2(horizon.priceReturnPct - sectorRet) : null
          } else {
            horizon.sectorSymbol = null
            horizon.sectorReturnPct = null
            horizon.excessSectorPct = null
          }
        }
      }
      rows.push({
        id: `${symbol}:${signalDate}`,
        ...displayMeta(symbol),
        signalDate,
        signalCount: flags.count,
        entryStatus: entry.entryStatus,
        entryDate: entry.entryDate,
        entryPrice: entry.entryPrice,
        totalScore: score.totalScore,
        totalStatus: score.totalStatus,
        weightPct: score.weightPct,
        parts: {
          A: score.parts.A.score,
          B: score.parts.B.score,
          C: score.parts.C.score,
          D: score.parts.D.score,
          E: score.parts.E.score,
        },
        partStatus: {
          A: score.parts.A.status,
          B: score.parts.B.status,
          C: score.parts.C.status,
          D: score.parts.D.status,
          E: score.parts.E.status,
        },
        sectorBenchmark: sector.symbol,
        sectorStatus: sector.status,
        horizons: entry.horizons,
      })
    }
  }

  const split = splitBySignalDate(rows)
  const scored = rows.filter((row) => row.totalStatus === "complete" || row.totalStatus === "partial")
  const unavailable = rows.filter((row) => row.totalStatus === "unavailable")
  const dates = new Set(rows.map((row) => row.signalDate))
  const multiDates = [...dates].filter((date) => rows.filter((row) => row.signalDate === date).length >= 2)

  return {
    version: CHART_QUALITY_VERSION,
    researchOnly: true,
    source: "equity_eq_ohlcv_and_frozen_dbb_episodes",
    asOf,
    marketBenchmark: MARKET_BENCHMARK,
    rule: SCORE_RULE,
    thresholds: FROZEN_THRESHOLDS,
    universeCount: universe.length,
    universe,
    missingData,
    counts: {
      signals: rows.length,
      symbolsWithSignals: new Set(rows.map((row) => row.symbol)).size,
      scored: scored.length,
      unavailableScore: unavailable.length,
      uniqueDates: dates.size,
      multiSignalDates: multiDates.length,
      multiSignals: rows.filter((row) => multiDates.includes(row.signalDate)).length,
    },
    split: {
      target: split.target,
      trainEndDate: split.trainEndDate,
      validationStartDate: split.validationStartDate,
      trainCount: split.train.length,
      validationCount: split.validation.length,
    },
    overall: summarizeOutcomes(rows),
    train: {
      summary: summarizeOutcomes(split.train),
      quartiles: scoreQuartiles(split.train),
    },
    validation: {
      summary: summarizeOutcomes(split.validation),
      quartiles: scoreQuartiles(split.validation),
    },
    quartiles: scoreQuartiles(rows),
    bySymbol: universe.map((symbol) => {
      const list = rows.filter((row) => row.symbol === symbol)
      return {
        ...displayMeta(symbol),
        sectorBenchmark: sectorBenchmarkFor(symbol).symbol,
        signals: list.length,
        summary: summarizeOutcomes(list),
        scored: list.filter((row) => row.totalScore != null).length,
        scoreMedian: median(list.map((row) => row.totalScore)),
      }
    }),
    rows,
  }
}
