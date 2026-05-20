import { metricDisplayLabel } from "./metricLabels.js"
import { changeTag, clampScore, slopeArrow } from "./seriesMath.js"

/**
 * @typedef {import('./rawLayer.js').MetricSeries} MetricSeries
 */

/**
 * @param {Record<string, MetricSeries>} raw
 */
export function scoreRatePressure(raw) {
  const us10 = raw.US10Y
  const real = raw.REAL_YIELD
  const move = raw.MOVE
  const us30 = raw.US30Y
  const bei = raw.BEI

  const us10Delta20 = Number(us10?.change20D)
  const realDelta20 = Number(real?.change20D)
  const moveDelta20 = Number(move?.change20D)
  const us30Delta20 = Number(us30?.change20D)
  const beiDelta20 = Number(bei?.change20D)

  const us10Add = rateBandPoints(us10Delta20, [
    { min: 0.3, points: 20 },
    { min: 0.2, points: 15 },
    { min: 0.1, points: 10 },
    { min: 0.0, points: 5 },
  ])
  const realAdd = rateBandPoints(realDelta20, [
    { min: 0.3, points: 20 },
    { min: 0.2, points: 15 },
    { min: 0.1, points: 10 },
  ])
  const moveAdd = rateBandPoints(moveDelta20, [
    { min: 40, points: 15 },
    { min: 20, points: 10 },
    { min: 0, points: 5 },
  ])

  const rateShockActive =
    us10Delta20 > 0.25 &&
    real?.slope === "up" &&
    move?.slope === "up"
  const rateShockExtreme = us10Delta20 >= 0.3 && realDelta20 >= 0.3 && moveDelta20 >= 40
  const rateShockAdd = rateShockActive ? (rateShockExtreme ? 20 : 15) : 0

  const longInflationExtreme = us30Delta20 >= 0.3 && beiDelta20 >= 0.2
  const extremeAll = us10Delta20 >= 0.3 && realDelta20 >= 0.3 && moveDelta20 >= 40 && longInflationExtreme

  let score = 35 + us10Add + realAdd + moveAdd + rateShockAdd
  if (longInflationExtreme) score += 10

  score = Math.min(score, extremeAll ? 100 : 85)
  const pts = [us10Add, realAdd, moveAdd, rateShockAdd, longInflationExtreme ? 10 : 0].filter((n) => n > 0).length

  const lines = [
    {
      label: metricDisplayLabel("US10Y"),
      text: `${slopeArrow(us10?.slope ?? "flat")} ${changeTag(us10?.change5D, us10?.slope ?? "flat")}`,
    },
    {
      label: metricDisplayLabel("US30Y"),
      text: `${slopeArrow(us30?.slope ?? "flat")} ${changeTag(us30?.change20D, us30?.slope ?? "flat")}`,
    },
    {
      label: metricDisplayLabel("REAL_YIELD"),
      text: `${slopeArrow(real?.slope ?? "flat")} ${changeTag(real?.change20D, real?.slope ?? "flat")}`,
    },
    {
      label: metricDisplayLabel("MOVE"),
      text: `${slopeArrow(move?.slope ?? "flat")} 변동확대`,
    },
  ]

  const status =
    pts >= 4 ? "성장주 압박" : pts >= 2 ? "단기 조정 위험" : us10?.slope === "up" ? "금리 상방 주의" : "금리 압력 완화"

  return {
    id: "rate",
    title: "금리 압력",
    score: clampScore(score),
    lines,
    status,
  }
}

/**
 * @param {number} value
 * @param {{ min: number; points: number }[]} bands
 */
function rateBandPoints(value, bands) {
  if (!Number.isFinite(value)) return 0
  for (const band of bands) {
    if (value >= band.min) return band.points
  }
  return 0
}

/**
 * @param {Record<string, MetricSeries>} raw
 */
export function scoreInflationPressure(raw) {
  const bei = raw.BEI
  const real = raw.REAL_YIELD
  const cpi = raw.CPI
  const core = raw.CORE_CPI
  const pce = raw.PCE

  let score = 32
  if (bei?.slope === "up" || (bei?.change20D != null && bei.change20D > 0.08)) score += 28
  if (real?.change20D != null && real.change20D > 0.04 && bei?.slope === "up") score += 14
  if (pce?.slope === "down" || (pce?.change20D != null && pce.change20D < -0.05)) score -= 8
  if (cpi?.slope === "down") score -= 4

  const lines = [
    { label: metricDisplayLabel("BEI"), text: bei?.slope === "up" ? "상승" : "보합" },
    { label: "Core", text: core?.slope === "up" ? "상승" : "유지" },
    { label: "PCE", text: pce?.slope === "down" ? "둔화" : "후행" },
  ]

  const status =
    score >= 60 ? "인플레 재가속 우려" : score >= 45 ? "기대인플 상방" : "인플레 둔화 국면"

  return {
    id: "inflation",
    title: "인플레 압력",
    score: clampScore(score),
    lines,
    status,
  }
}

/**
 * @param {Record<string, MetricSeries>} raw
 */
export function scoreLiquidity(raw) {
  const dxy = raw.DXY
  const qt = raw.QT
  const m2 = raw.M2
  const fed = raw.FED_BALANCE

  let score = 40
  if (dxy?.change20D != null && dxy.change20D > 0.5) score += 22
  else if (dxy?.slope === "up") score += 12
  if (qt?.current != null && qt.current >= 0.5) score += 18
  if (fed?.change20D != null && fed.change20D < -2) score += 20
  else if (m2?.change20D != null && m2.change20D < -1) score += 10

  const lines = [
    { label: "달러", text: dxy?.slope === "up" ? "강세" : "중립" },
    { label: "QT", text: qt?.current != null && qt.current >= 0.5 ? "진행" : "완화" },
    { label: "유동성", text: fed?.slope === "down" ? "축소" : "중립" },
  ]

  const status = score >= 65 ? "유동성 축소" : score >= 50 ? "달러·QT 압박" : "유동성 중립"

  return {
    id: "liquidity",
    title: "유동성",
    score: clampScore(score),
    lines,
    status,
  }
}

