import { buildMetricRow } from "./displayMetrics.js"
import { changeTag, clampScore, nearRecentHigh, slopeArrow } from "./seriesMath.js"

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
  let score = 38
  let pts = 0

  if (us10?.change20D != null && us10.change20D > 0.3) {
    score += 22
    pts += 2
  } else if (us10?.change5D != null && us10.change5D > 0.15) {
    score += 12
    pts += 1
  }

  if (real?.change20D != null && real.change20D > 0.05) {
    score += 18
    pts += 2
  }

  if (move && nearRecentHigh(buildHistoryProxy(move))) {
    score += 16
    pts += 2
  } else if (move?.slope === "up") {
    score += 8
  }

  const lines = [
    {
      label: "10Y",
      text: `${slopeArrow(us10?.slope ?? "flat")} ${changeTag(us10?.change5D, us10?.slope ?? "flat")}`,
    },
    {
      label: "REAL",
      text: `${slopeArrow(real?.slope ?? "flat")} ${changeTag(real?.change20D, real?.slope ?? "flat")}`,
    },
    {
      label: "MOVE",
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
    metrics: [
      buildMetricRow(us10, "10Y", { format: "rate" }),
      buildMetricRow(raw.US2Y, "2Y", { format: "rate" }),
      buildMetricRow(real, "REAL", { format: "rate" }),
      buildMetricRow(move, "MOVE", { format: "index" }),
    ],
  }
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
    { label: "BEI", text: bei?.slope === "up" ? "상승" : "보합" },
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
    metrics: [
      buildMetricRow(bei, "BEI", { format: "rate" }),
      buildMetricRow(cpi, "CPI", { format: "rate" }),
      buildMetricRow(core, "Core", { format: "rate" }),
      buildMetricRow(pce, "PCE", { format: "rate" }),
    ],
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
    metrics: [
      buildMetricRow(dxy, "DXY", { format: "pct" }),
      buildMetricRow(qt, "QT", { format: "index" }),
      buildMetricRow(m2, "M2", { format: "pct" }),
      buildMetricRow(fed, "Fed", { format: "pct" }),
    ],
  }
}

/** @param {MetricSeries} series */
function buildHistoryProxy(series) {
  const base = series.current ?? 100
  const c20 = series.change20D ?? 0
  const arr = []
  for (let i = 0; i < 22; i += 1) {
    arr.push(base - c20 * ((21 - i) / 21))
  }
  return arr
}
