/**
 * 종목 엔진 — 실데이터 기반 점수·단계·진입 근거·가격 영역
 */

import { computeStockSignal } from "../utils/stockSignalEngine.js"
import { stageToDisplayBucket } from "./tacticalTradingZoneData.js"
import { resolvePositionApiCode } from "./tradingZonePositionRegistry.js"

/** @typedef {import("./tacticalTradingZoneData.js").TradingZonePosition} TradingZonePosition */
/** @typedef {import("./tacticalTradingZoneData.js").TradingStageId} TradingStageId */

/** @typedef {{
 *   positionId: string
 *   dataReady: boolean
 *   tacticalScore: number
 *   confidence: number
 *   signalId: string
 *   signalLabel: string
 *   suggestedStage: TradingStageId
 *   entryRationale: string[]
 *   priceZones: {
 *     current: number | null
 *     entry: string
 *     stop: string
 *     target: string
 *     stopNum: number | null
 *     targetNum: number | null
 *   } | null
 *   fetchedAt: string
 *   error?: string
 * }} TradingZoneStockEvaluation */

const STAGE_LADDER = /** @type {const} */ (["interest", "pullback", "trend", "takeProfit"])

/** @param {unknown} v */
function toNum(v) {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** @param {number} price @param {'us' | 'kr'} market */
function formatPrice(price, market) {
  if (!Number.isFinite(price)) return "—"
  if (market === "kr") return Math.round(price).toLocaleString("ko-KR")
  if (price >= 1000) return Math.round(price).toLocaleString("en-US")
  if (price >= 100) return price.toFixed(1)
  return price.toFixed(2)
}

/**
 * @param {number} price
 * @param {'us' | 'kr'} market
 * @param {number} [bandPct]
 */
function formatEntryBand(price, market, bandPct = 0.015) {
  const low = price * (1 - bandPct)
  const high = price * (1 + bandPct)
  return `${formatPrice(low, market)} ~ ${formatPrice(high, market)}`
}

/**
 * @param {object} apiBody — /api/stock 응답
 */
export function extractStockEvalInputs(apiBody) {
  const sig = apiBody?.stockSignal ?? {}
  const ma = apiBody?.movingAverage ?? {}
  const price = toNum(sig.price ?? apiBody?.price ?? apiBody?.close)
  const ma10 = toNum(sig.ma10 ?? ma.ma10)
  const ma20 = toNum(sig.ma20 ?? ma.ma20)
  const ma60 = toNum(sig.ma60 ?? ma.ma60)
  const rsi14 = toNum(sig.rsi14 ?? apiBody?.rsi14)
  const position52w = toNum(sig.position52w)
  const volumeChangePct = toNum(sig.volumeChangePct ?? apiBody?.volumeChangePct)
  const volumeRatio =
    volumeChangePct != null ? 1 + volumeChangePct / 100 : toNum(apiBody?.volumeRatio)

  return { price, ma10, ma20, ma60, rsi14, position52w, volumeChangePct, volumeRatio, sig }
}

/**
 * @param {string} signalId
 * @param {{ price?: number | null; ma20?: number | null; position52w?: number | null; targetNum?: number | null }} ctx
 * @returns {TradingStageId}
 */
export function mapSignalToTradingStage(signalId, ctx = {}) {
  const price = toNum(ctx.price)
  const ma20 = toNum(ctx.ma20)
  const pos52 = toNum(ctx.position52w)
  const targetNum = toNum(ctx.targetNum)

  if (signalId === "overheat") {
    if (targetNum != null && price != null && price >= targetNum * 0.97) return "takeProfit"
    if (pos52 != null && pos52 >= 88) return "takeProfit"
    return "pullback"
  }
  if (signalId === "trend") return "trend"
  if (signalId === "pullback") return "pullback"
  return "interest"
}

/**
 * @param {ReturnType<typeof extractStockEvalInputs>} inputs
 * @param {object | null} panicData
 */
export function computeTacticalStockScore(inputs, panicData = null) {
  const signal = computeStockSignal({
    price: inputs.price,
    ma10: inputs.ma10,
    ma20: inputs.ma20,
    rsi14: inputs.rsi14,
    position52w: inputs.position52w,
    volumeChangePct: inputs.volumeChangePct,
    volumeRatio: inputs.volumeRatio,
  })
  const baseBySignal = { trend: 78, pullback: 72, watch: 58, overheat: 46 }
  let score = baseBySignal[signal.id] ?? 55

  const price = inputs.price
  const ma20 = inputs.ma20
  if (price != null && ma20 != null) {
    if (price > ma20) score += 6
    else if (price < ma20 * 0.97) score -= 8
    if (Math.abs(price - ma20) / ma20 <= 0.02) score += 5
  }
  if (inputs.rsi14 != null) {
    if (inputs.rsi14 >= 40 && inputs.rsi14 <= 55) score += 6
    if (inputs.rsi14 > 72) score -= 10
    if (inputs.rsi14 < 32) score -= 4
  }
  if (inputs.volumeRatio != null && inputs.volumeRatio >= 1.35) score += 7
  if (inputs.position52w != null && inputs.position52w > 80) score -= 4

  const vix = toNum(panicData?.vix)
  const fg = toNum(panicData?.fearGreed)
  if (vix != null && vix < 22) score += 3
  if (fg != null && fg >= 35 && fg <= 68) score += 2
  if (vix != null && vix >= 28) score -= 6

  return Math.max(35, Math.min(99, Math.round(score)))
}

/**
 * @param {ReturnType<typeof extractStockEvalInputs>} inputs
 */
export function buildEntryRationale(inputs) {
  /** @type {string[]} */
  const lines = []
  const price = inputs.price
  const ma20 = inputs.ma20
  const ma10 = inputs.ma10
  const rsi = inputs.rsi14
  const vol = inputs.volumeChangePct

  if (price != null && ma20 != null) {
    const near = Math.abs(price - ma20) / Math.abs(ma20) <= 0.025
    if (near) lines.push("20MA 지지")
    else if (price > ma20) lines.push("20MA 상회")
    else lines.push("20MA 하회")
  }
  if (price != null && ma10 != null) {
    if (price > ma10 && !lines.some((l) => l.includes("10MA"))) lines.push("10MA 상회")
  }
  if (vol != null) {
    if (vol >= 15) lines.push("거래량 증가")
    else if (vol <= -12) lines.push("거래량 감소")
  } else if (inputs.volumeRatio != null && inputs.volumeRatio >= 1.3) {
    lines.push("거래량 증가")
  }
  if (rsi != null) lines.push(`RSI ${Math.round(rsi)}`)
  if (inputs.position52w != null && inputs.position52w >= 75) lines.push("52주 상단권")
  return lines.slice(0, 4)
}

/**
 * @param {TradingZonePosition} position
 * @param {ReturnType<typeof extractStockEvalInputs>} inputs
 */
export function computeAutoPriceZones(position, inputs) {
  const price = inputs.price ?? toNum(position.currentPrice)
  if (price == null) return null

  const ma20 = inputs.ma20
  const ma60 = inputs.ma60
  const market = position.market

  const stopNum = ma20 != null ? Math.round(ma20 * 0.965) : Math.round(price * 0.94)
  const targetNum =
    ma60 != null && ma60 > price
      ? Math.round(ma60 * 1.02)
      : Math.round(price * (position.stage === "trend" ? 1.14 : 1.1))

  return {
    current: price,
    entry: formatEntryBand(price, market),
    stop: formatPrice(stopNum, market),
    target: formatPrice(targetNum, market),
    stopNum,
    targetNum,
  }
}

/**
 * @param {TradingZonePosition} position
 * @param {object | null} apiBody
 * @param {object | null} [panicData]
 * @returns {TradingZoneStockEvaluation}
 */
export function evaluateStockFromApi(position, apiBody, panicData = null) {
  const fetchedAt = new Date().toISOString()
  if (!apiBody || apiBody.error) {
    return {
      positionId: position.id,
      dataReady: false,
      tacticalScore: 0,
      confidence: 0,
      signalId: "watch",
      signalLabel: "관망",
      suggestedStage: position.stage,
      entryRationale: [],
      priceZones: null,
      fetchedAt,
      error: apiBody?.message ?? "no data",
    }
  }

  const inputs = extractStockEvalInputs(apiBody)
  if (inputs.price == null) {
    return {
      positionId: position.id,
      dataReady: false,
      tacticalScore: 0,
      confidence: 0,
      signalId: "watch",
      signalLabel: "관망",
      suggestedStage: position.stage,
      entryRationale: [],
      priceZones: null,
      fetchedAt,
      error: "missing price",
    }
  }

  const signal = computeStockSignal({
    price: inputs.price,
    ma10: inputs.ma10,
    ma20: inputs.ma20,
    rsi14: inputs.rsi14,
    position52w: inputs.position52w,
    volumeChangePct: inputs.volumeChangePct,
    volumeRatio: inputs.volumeRatio,
  })

  const priceZones = computeAutoPriceZones(position, inputs)
  const tacticalScore = computeTacticalStockScore(inputs, panicData)
  const targetNum = priceZones?.targetNum ?? toNum(position.targetNum)
  const suggestedStage = mapSignalToTradingStage(signal.id, {
    price: inputs.price,
    ma20: inputs.ma20,
    position52w: inputs.position52w,
    targetNum,
  })
  const entryRationale = buildEntryRationale(inputs)
  const confidence = Math.max(40, Math.min(99, Math.round(tacticalScore * 0.92 + (inputs.ma20 != null ? 5 : 0))))

  return {
    positionId: position.id,
    dataReady: true,
    tacticalScore,
    confidence,
    signalId: signal.id,
    signalLabel: signal.status,
    suggestedStage,
    entryRationale,
    priceZones,
    fetchedAt,
  }
}

/**
 * @param {TradingStageId} current
 * @param {TradingStageId} suggested
 * @param {number} score
 * @param {{ reduceTrend?: boolean; increasePullbackWait?: boolean } | null} macroBehavior
 */
export function resolveEvaluatedStage(current, suggested, score, macroBehavior = null) {
  if (current === "risk") return current

  let target = suggested
  if (macroBehavior?.reduceTrend && target === "trend") target = "pullback"
  if (macroBehavior?.increasePullbackWait && target === "trend" && score < 78) target = "pullback"

  const curBucket = stageToDisplayBucket(current)
  const nextBucket = stageToDisplayBucket(target)
  if (!curBucket || !nextBucket) return current

  if (current === "takeProfit") {
    if (target === "interest" || target === "pullback") return current
    return target === "takeProfit" ? current : "takeProfit"
  }

  const ci = STAGE_LADDER.indexOf(curBucket)
  const ni = STAGE_LADDER.indexOf(nextBucket)
  if (ci < 0 || ni < 0) return current

  if (ni > ci + 1) {
    if (score >= 85) return STAGE_LADDER[ni]
    return STAGE_LADDER[ci + 1]
  }
  if (ni < ci - 1) {
    if (score < 42) return STAGE_LADDER[Math.max(0, ci - 1)]
    return current
  }
  if (ni > ci && score < 62) return current
  return /** @type {TradingStageId} */ (nextBucket)
}

/**
 * @param {TradingZonePosition} position
 * @param {TradingZoneStockEvaluation} evaluation
 * @param {string} at
 * @param {{ reduceTrend?: boolean; increasePullbackWait?: boolean } | null} macroBehavior
 */
function mergeEvaluationIntoPosition(position, evaluation, at, macroBehavior) {
  if (!evaluation.dataReady) return position

  const nextStage = resolveEvaluatedStage(
    position.stage,
    evaluation.suggestedStage,
    evaluation.tacticalScore,
    macroBehavior,
  )

  const zones = evaluation.priceZones
  /** @type {TradingZonePosition} */
  let next = {
    ...position,
    currentPrice: zones?.current ?? position.currentPrice,
    entry: zones?.entry ?? position.entry,
    stop: zones?.stop ?? position.stop,
    target: zones?.target ?? position.target,
    stopNum: zones?.stopNum ?? position.stopNum,
    targetNum: zones?.targetNum ?? position.targetNum,
  }

  if (nextStage !== position.stage) {
    next = {
      ...next,
      stage: nextStage,
      stageHistory: [
        ...(position.stageHistory ?? []),
        { stage: nextStage, at, price: zones?.current ?? undefined, score: evaluation.tacticalScore },
      ],
    }
  } else if ((position.stageHistory?.length ?? 0) > 0) {
    const hist = [...(position.stageHistory ?? [])]
    const last = hist[hist.length - 1]
    if (last?.stage === nextStage && evaluation.tacticalScore) {
      hist[hist.length - 1] = { ...last, score: evaluation.tacticalScore, price: zones?.current ?? last.price }
      next = { ...next, stageHistory: hist }
    }
  }

  return next
}

/**
 * @param {TradingZonePosition[]} positions
 * @param {Record<string, TradingZoneStockEvaluation>} evalMap
 * @param {{ date?: string; macroBehavior?: object | null; enableAutoStage?: boolean }} [opts]
 */
export function applyStockEvaluationsToPositions(positions, evalMap, opts = {}) {
  const at = String(opts.date ?? new Date().toISOString().slice(0, 10)).slice(0, 10)
  const macroBehavior = opts.macroBehavior ?? null
  const enableAutoStage = opts.enableAutoStage !== false

  return positions.map((p) => {
    const ev = evalMap[p.id]
    if (!ev?.dataReady) return p
    if (!enableAutoStage) {
      const zones = ev.priceZones
      if (!zones) return p
      return {
        ...p,
        currentPrice: zones.current ?? p.currentPrice,
        entry: zones.entry ?? p.entry,
        stop: zones.stop ?? p.stop,
        target: zones.target ?? p.target,
        stopNum: zones.stopNum ?? p.stopNum,
        targetNum: zones.targetNum ?? p.targetNum,
      }
    }
    return mergeEvaluationIntoPosition(p, ev, at, macroBehavior)
  })
}

export { resolvePositionApiCode }
