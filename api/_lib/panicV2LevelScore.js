/**
 * 패닉 V2 레벨 점수 — 일별 백필용 (가중치 합 100)
 */
import { piecewiseNorm } from "./panicV2Piecewise.js"
import { resolvePanicV2Status } from "./panicV2Status.js"
import { pickPanicV2Raw } from "./panicV2DynamicCompute.js"

/** @type {Record<string, [number, number][]>} */
const PANIC_V2_KNOTS = {
  vix: [
    [10, 0],
    [20, 30],
    [30, 60],
    [40, 100],
  ],
  highYield: [
    [2, 0],
    [4, 50],
    [6, 100],
  ],
  move: [
    [60, 0],
    [100, 50],
    [140, 100],
  ],
  vxn: [
    [15, 0],
    [25, 30],
    [35, 60],
    [50, 100],
  ],
  putCall: [
    [0.55, 0],
    [0.7, 30],
    [0.85, 60],
    [1.1, 100],
  ],
  fearGreed: [
    [80, 0],
    [60, 30],
    [40, 60],
    [15, 100],
  ],
  skew: [
    [118, 0],
    [130, 30],
    [140, 60],
    [155, 100],
  ],
  bofa: [
    [8, 0],
    [6, 25],
    [4, 50],
    [2, 80],
    [0, 100],
  ],
  gsBullBear: [
    [70, 0],
    [50, 30],
    [35, 60],
    [20, 100],
  ],
}

/** 백필·저장용 가중치 (합 100) */
export const PANIC_V2_BACKFILL_WEIGHTS = [
  { key: "vix", weight: 25 },
  { key: "vxn", weight: 20 },
  { key: "putCall", weight: 20 },
  { key: "highYield", weight: 15 },
  { key: "fearGreed", weight: 10 },
  { key: "move", weight: 5 },
  { key: "skew", weight: 3 },
  { key: "gsBullBear", weight: 2 },
]

function normalizeMetric(key, raw) {
  const knots = PANIC_V2_KNOTS[key]
  if (!knots) return null
  return piecewiseNorm(raw, knots)
}

/**
 * @param {object | null | undefined} data
 * @returns {{ score: number | null; status: ReturnType<typeof resolvePanicV2Status>; weightUsed: number }}
 */
export function computePanicV2LevelScore(data) {
  let scoreSum = 0
  let weightUsed = 0

  for (const { key, weight } of PANIC_V2_BACKFILL_WEIGHTS) {
    const raw = pickPanicV2Raw(data, key)
    const normalized = normalizeMetric(key, raw)
    if (normalized == null) continue
    scoreSum += (normalized * weight) / 100
    weightUsed += weight
  }

  if (weightUsed < 25) {
    return { score: null, status: null, weightUsed }
  }

  let score = Math.round(scoreSum)
  score = Math.max(0, Math.min(100, score))
  return { score, status: resolvePanicV2Status(score), weightUsed }
}
