/**
 * V4 — 타이밍 점수 (0~25) + 체크리스트
 */

import { clampScore } from "./ydsStockScoreEngine.js"

export const TIMING_SCORE_MAX = 25

/** @typedef {{ id: string; label: string; shortLabel: string; pass: boolean; points: number; maxPoints: number }} TimingCheckItem */

/**
 * @typedef {{
 *   score: number
 *   max: number
 *   checks: TimingCheckItem[]
 *   rsiPenalty: number
 *   display: string
 *   debug: Record<string, unknown>
 * }} TimingScoreResult
 */

const CHECK_DEFS = [
  { id: "ma20", label: "20일선 위", shortLabel: "20일선", points: 5 },
  { id: "ma60", label: "60일선 위", shortLabel: "60일선", points: 4 },
  { id: "ma120", label: "120일선 위", shortLabel: "120일선", points: 3 },
  { id: "volume", label: "거래량 증가", shortLabel: "거래량 증가", points: 4 },
  { id: "highBreak", label: "신고가 돌파", shortLabel: "신고가 돌파", points: 4 },
  { id: "pullback", label: "눌림 형성", shortLabel: "눌림 형성", points: 3 },
]

/**
 * @param {import("./ydsStockScoreEngine.js").StockPriceSnapshot | null | undefined} snapshot
 * @param {{ rsi14?: number | null }} [extras]
 * @param {{ drawdownPct?: number }} [scoreMeta]
 * @returns {TimingScoreResult}
 */
export function computeTimingScore(snapshot, extras = {}, scoreMeta = {}) {
  if (!snapshot) {
    return emptyTimingScore()
  }

  const close = snapshot.close
  const volRatio =
    snapshot.volumeAvg20 > 0 ? snapshot.volumeToday / snapshot.volumeAvg20 : 0
  const drawdownPct = Number(scoreMeta.drawdownPct) || 0
  const recentHigh = snapshot.recentHigh
  const highBreak =
    Number.isFinite(recentHigh) && recentHigh > 0 && close >= recentHigh * 0.995
  const rsi14 = Number(extras.rsi14)
  const rsiOverheat = Number.isFinite(rsi14) && rsi14 > 70

  const passById = {
    ma20: close >= snapshot.ma20,
    ma60: close >= snapshot.ma60,
    ma120: close >= snapshot.ma120,
    volume: volRatio >= 1.1,
    highBreak,
    pullback: drawdownPct >= 5 && drawdownPct <= 15,
  }

  /** @type {TimingCheckItem[]} */
  const checks = CHECK_DEFS.map((d) => {
    const pass = Boolean(passById[d.id])
    return {
      id: d.id,
      label: d.label,
      shortLabel: d.shortLabel,
      pass,
      points: pass ? d.points : 0,
      maxPoints: d.points,
    }
  })

  if (rsiOverheat) {
    checks.push({
      id: "rsi",
      label: "RSI 과열",
      shortLabel: "RSI 과열",
      pass: false,
      points: 0,
      maxPoints: 0,
    })
  } else {
    checks.push({
      id: "rsi",
      label: "RSI 과열",
      shortLabel: "RSI 과열",
      pass: true,
      points: 0,
      maxPoints: 0,
    })
  }

  const rawPoints = checks.reduce((sum, c) => sum + c.points, 0)
  const rsiPenalty = rsiOverheat ? 3 : 0
  const score = clampScore(rawPoints - rsiPenalty, 0, TIMING_SCORE_MAX)

  return {
    score,
    max: TIMING_SCORE_MAX,
    checks,
    rsiPenalty,
    display: `${score}/${TIMING_SCORE_MAX}`,
    debug: {
      volRatio,
      drawdownPct,
      highBreak,
      rsi14: Number.isFinite(rsi14) ? rsi14 : null,
      rsiOverheat,
      rawPoints,
      rsiPenalty,
    },
  }
}

/** @returns {TimingScoreResult} */
function emptyTimingScore() {
  return {
    score: 0,
    max: TIMING_SCORE_MAX,
    checks: CHECK_DEFS.map((d) => ({
      id: d.id,
      label: d.label,
      shortLabel: d.shortLabel,
      pass: false,
      points: 0,
      maxPoints: d.points,
    })),
    rsiPenalty: 0,
    display: `0/${TIMING_SCORE_MAX}`,
    debug: {},
  }
}
