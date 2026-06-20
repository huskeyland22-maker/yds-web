/**
 * YDS Score Explain + Slope — 가중·지표·임계값 (하드코딩 UI 금지, 여기서만 조정)
 */
import { pickMetricValue } from "./panicMarketActionEngine.js"

/** @typedef {'short'|'mid'|'long'} ExplainHorizon */

/** @typedef {'volatility'|'fear'|'ratio'|'spread'|'sentiment'|'rate'|'level'} SlopeKind */

/**
 * @typedef {{
 *   key: string
 *   label: string
 *   kind: SlopeKind
 *   score: (v: number) => number
 *   status: (v: number | null) => string
 *   weight?: number
 * }} MetricDriverDef
 */

/** 절대값 / 기울기 블렌드 (판정 합산용) */
export const SCORE_BLEND = Object.freeze({
  absolute: 0.7,
  slope: 0.3,
})

/** 기울기 4단계 */
export const SLOPE_STATE_LABEL = Object.freeze({
  stable: "안정",
  rise: "상승",
  surge: "급등",
  shock: "쇼크",
})

/** @type {Record<SlopeKind, { stable5: number; surge5: number; shock5: number }>} */
export const SLOPE_THRESHOLDS = Object.freeze({
  volatility: { stable5: 4, surge5: 12, shock5: 22 },
  fear: { stable5: 5, surge5: 14, shock5: 24 },
  ratio: { stable5: 6, surge5: 15, shock5: 28 },
  spread: { stable5: 0.08, surge5: 0.22, shock5: 0.4 },
  sentiment: { stable5: 6, surge5: 14, shock5: 26 },
  rate: { stable5: 0.06, surge5: 0.14, shock5: 0.28 },
  level: { stable5: 0.8, surge5: 2, shock5: 3.5 },
})

/** @param {number} score @returns {number} */
export function absoluteContributionPoints(score) {
  return Math.round((score - 50) * SCORE_BLEND.absolute * 0.54)
}

/** @param {'stable'|'rise'|'surge'|'shock'} state @returns {number} */
export function slopeContributionPoints(state) {
  const map = { stable: 0, rise: -2, surge: -5, shock: -8 }
  return Math.round((map[state] ?? 0) * SCORE_BLEND.slope * 3.2)
}

/** ——— 점수 함수 (panicMarketTimingEngine 과 동기) ——— */

/** @param {number} v */
export function scoreShortVix(v) {
  if (v <= 14) return 72
  if (v <= 18) return 88
  if (v <= 22) return 74
  if (v <= 26) return 52
  if (v <= 32) return 34
  return 18
}

/** @param {number} v */
export function scoreShortVxn(v) {
  if (v >= 28) return 18
  if (v >= 20) return 34
  if (v >= 15) return 52
  if (v <= 12) return 88
  return 72
}

/** @param {number} v */
export function scoreShortPutCall(v) {
  if (v <= 0.52) return 28
  if (v <= 0.65) return 48
  if (v <= 0.82) return 78
  if (v <= 0.95) return 58
  return 42
}

/** @param {number} v */
export function scoreShortFearGreed(v) {
  if (v <= 22) return 38
  if (v <= 35) return 52
  if (v <= 48) return 72
  if (v <= 62) return 82
  if (v <= 72) return 68
  if (v <= 82) return 42
  return 22
}

/** @param {number} v */
export function scoreMidHy(v) {
  if (v < 3) return 82
  if (v < 4.2) return 72
  if (v < 5.5) return 55
  if (v < 7) return 35
  return 18
}

/** @param {number} v */
export function scoreLongHy(v) {
  if (v < 2.5) return 90
  if (v < 3.2) return 86
  if (v < 4) return 76
  if (v < 5.2) return 62
  if (v < 6.5) return 45
  if (v < 8) return 30
  return 18
}

/** @param {number} v */
export function scoreLongMove(v) {
  if (v < 78) return 82
  if (v < 95) return 76
  if (v < 112) return 64
  if (v < 125) return 48
  return 28
}

/** @param {number} v */
export function scoreLongBofa(v) {
  if (v <= 2.5) return 38
  if (v <= 4) return 52
  if (v <= 6.5) return 66
  if (v <= 7.5) return 62
  if (v < 8.5) return 52
  return 32
}

/** @param {number} v */
export function scoreLongSkew(v) {
  if (v < 125) return 72
  if (v < 140) return 58
  if (v < 155) return 48
  return 38
}

/** @param {ExplainHorizon} horizon @returns {MetricDriverDef[]} */
export function driversForHorizon(horizon) {
  switch (horizon) {
    case "short":
      return [
        {
          key: "vix",
          label: "VIX",
          kind: "volatility",
          score: scoreShortVix,
          status: (v) => statusVix(v),
        },
        {
          key: "vxn",
          label: "VXN",
          kind: "volatility",
          score: scoreShortVxn,
          status: (v) => statusVxn(v),
        },
        {
          key: "putCall",
          label: "P/C",
          kind: "ratio",
          score: scoreShortPutCall,
          status: (v) => statusPutCall(v),
        },
      ]
    case "mid":
      return [
        {
          key: "vix",
          label: "VIX",
          kind: "volatility",
          score: scoreShortVix,
          status: (v) => statusVix(v),
        },
        {
          key: "fearGreed",
          label: "CNN",
          kind: "fear",
          score: scoreShortFearGreed,
          status: (v) => statusFearGreed(v),
        },
        {
          key: "putCall",
          label: "P/C",
          kind: "ratio",
          score: scoreShortPutCall,
          status: (v) => statusPutCall(v),
        },
      ]
    case "long":
      return [
        {
          key: "highYield",
          label: "HY",
          kind: "spread",
          score: scoreLongHy,
          weight: 0.3,
          status: (v) => statusHy(v),
        },
        {
          key: "move",
          label: "MOVE",
          kind: "volatility",
          score: scoreLongMove,
          weight: 0.1,
          status: (v) => statusMove(v),
        },
        {
          key: "bofa",
          label: "BofA",
          kind: "sentiment",
          score: scoreLongBofa,
          weight: 0.25,
          status: (v) => statusBofa(v),
        },
        {
          key: "skew",
          label: "SKEW",
          kind: "level",
          score: scoreLongSkew,
          status: (v) => statusSkew(v),
        },
      ]
    default:
      return []
  }
}

/** 채권·유동성 — 보조 표시만 (판정 제외) */
export const BOND_AUX_KEYS = Object.freeze([
  { key: "US10Y", label: "10Y", kind: "rate" },
  { key: "US30Y", label: "30Y", kind: "rate" },
  { key: "DXY", label: "DXY", kind: "level" },
])

/** @param {number|null} v */
function statusVix(v) {
  if (v == null) return "—"
  if (v <= 18) return "VIX 안정"
  if (v >= 26) return "VIX 상승"
  return "VIX 중립"
}

/** @param {number|null} v */
function statusVxn(v) {
  if (v == null) return "—"
  if (v <= 18) return "VXN 안정"
  if (v >= 24) return "VXN 상승"
  return "VXN 중립"
}

/** @param {number|null} v */
function statusPutCall(v) {
  if (v == null) return "—"
  if (v >= 0.88) return "P/C 헤지"
  if (v <= 0.58) return "P/C 과열"
  return "P/C 중립"
}

/** @param {number|null} v */
function statusFearGreed(v) {
  if (v == null) return "—"
  if (v >= 72) return "CNN 과열"
  if (v <= 28) return "CNN 공포"
  return "CNN 중립"
}

/** @param {number|null} v */
function statusHy(v) {
  if (v == null) return "—"
  if (v < 3.5) return "HY 안정"
  if (v >= 6) return "HY 악화"
  return "HY 주의"
}

/** @param {number|null} v */
function statusMove(v) {
  if (v == null) return "—"
  if (v < 100) return "MOVE 안정"
  if (v >= 118) return "MOVE 부담"
  return "MOVE 중립"
}

/** @param {number|null} v */
function statusBofa(v) {
  if (v == null) return "—"
  if (v >= 7.5) return "BofA 과열"
  if (v <= 3) return "BofA 위축"
  return "BofA 중립"
}

/** @param {number|null} v */
function statusSkew(v) {
  if (v == null) return "—"
  if (v < 135) return "SKEW 안정"
  if (v >= 150) return "SKEW 경고"
  return "SKEW 중립"
}

/** @param {object | null} data @param {string} key */
export function readPanicMetric(data, key) {
  return pickMetricValue(data, key)
}
