/**
 * 패닉 V2 실전 엔진 — 레벨 점수 (DB·백필, 합 100)
 */
import { piecewiseNorm } from "./panicV2Piecewise.js"
import { resolvePanicV2Status } from "./panicV2Status.js"
import { pickPanicV2Raw } from "./panicV2DynamicCompute.js"

/** @type {Record<string, [number, number][]>} */
const PANIC_V2_KNOTS = {
  vix: [
    [12, 0],
    [18, 25],
    [25, 50],
    [35, 75],
    [45, 100],
  ],
  vvix: [
    [90, 0],
    [105, 30],
    [120, 55],
    [140, 80],
    [165, 100],
  ],
  vixTerm: [
    [-6, 0],
    [-1, 20],
    [0, 40],
    [5, 70],
    [12, 100],
  ],
  putCall: [
    [0.55, 0],
    [0.7, 30],
    [0.85, 55],
    [1.0, 80],
    [1.15, 100],
  ],
  ndxDistance: [
    [-12, 100],
    [-8, 80],
    [-5, 55],
    [-2, 30],
    [0, 10],
    [5, 0],
  ],
  soxxDistance: [
    [-12, 100],
    [-8, 80],
    [-5, 55],
    [-2, 30],
    [0, 10],
    [5, 0],
  ],
  dxy: [
    [98, 0],
    [102, 30],
    [105, 55],
    [108, 80],
    [112, 100],
  ],
  move: [
    [60, 0],
    [100, 45],
    [130, 75],
    [160, 100],
  ],
}

/** 백필·저장용 가중치 (합 100) */
export const PANIC_V2_BACKFILL_WEIGHTS = [
  { key: "vix", weight: 15 },
  { key: "vvix", weight: 10 },
  { key: "vixTerm", weight: 15 },
  { key: "putCall", weight: 20 },
  { key: "ndxDistance", weight: 15 },
  { key: "soxxDistance", weight: 10 },
  { key: "dxy", weight: 10 },
  { key: "move", weight: 5 },
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
    let normalized = normalizeMetric(key, raw)
    if (normalized == null) continue
    if (key === "putCall") {
      const vix = pickPanicV2Raw(data, "vix")
      if (vix != null && vix >= 22) normalized = Math.min(100, normalized * 1.08)
    }
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
