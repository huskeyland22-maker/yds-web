/**
 * Phase 3 — 기술점수 (0~10) + 체크리스트
 * 종합점수와 분리 · 품질 vs 타이밍 구조의 타이밍 보조 지표
 */

import { clampScore } from "./ydsStockScoreEngine.js"

/** @typedef {{ id: string; label: string; pass: boolean; points: number; maxPoints: number }} TechnicalCheckItem */

/**
 * @typedef {{
 *   score: number
 *   max: number
 *   checks: TechnicalCheckItem[]
 *   display: string
 * }} TechnicalScoreResult
 */

const CHECK_DEFS = [
  { id: "ma20", label: "20일선 위", points: 2 },
  { id: "ma60", label: "60일선 위", points: 2 },
  { id: "ma120", label: "120일선 위", points: 1 },
  { id: "volume", label: "거래량 증가", points: 2 },
  { id: "high52", label: "신고가 근접", points: 2 },
  { id: "rsi", label: "RSI 과열", points: 1 },
]

/**
 * @param {import("./ydsStockScoreEngine.js").StockPriceSnapshot | null | undefined} snapshot
 * @param {{ rsi14?: number | null }} [extras]
 * @returns {TechnicalScoreResult}
 */
export function computeTechnicalScore(snapshot, extras = {}) {
  if (!snapshot) {
    return {
      score: 0,
      max: 10,
      checks: CHECK_DEFS.map((d) => ({
        id: d.id,
        label: d.label,
        pass: false,
        points: 0,
        maxPoints: d.points,
      })),
      display: "0/10",
    }
  }

  const close = snapshot.close
  const volRatio =
    snapshot.volumeAvg20 > 0 ? snapshot.volumeToday / snapshot.volumeAvg20 : 0
  const high52Ratio =
    snapshot.high52w > 0 ? close / snapshot.high52w : 0
  const rsi14 = Number(extras.rsi14)

  const passById = {
    ma20: close >= snapshot.ma20,
    ma60: close >= snapshot.ma60,
    ma120: close >= snapshot.ma120,
    volume: volRatio >= 1.1,
    high52: high52Ratio >= 0.95,
    rsi: !(Number.isFinite(rsi14) && rsi14 > 70),
  }

  /** @type {TechnicalCheckItem[]} */
  const checks = CHECK_DEFS.map((d) => {
    const pass = Boolean(passById[d.id])
    return {
      id: d.id,
      label: d.label,
      pass,
      points: pass ? d.points : 0,
      maxPoints: d.points,
    }
  })

  const score = clampScore(
    checks.reduce((sum, c) => sum + c.points, 0),
    0,
    10,
  )

  return {
    score,
    max: 10,
    checks,
    display: `${score}/10`,
  }
}
