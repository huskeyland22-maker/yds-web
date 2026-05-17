/**
 * 9대 패닉 지표 → 종합 위험 점수 → 시장 행동 가이드
 * 점수: 공포 쪽 +, 탐욕·과열 쪽 −
 */

/** @typedef {"extreme_fear" | "fear" | "neutral" | "greed" | "extreme_greed"} MarketRegime */

/**
 * @typedef {{
 *   totalScore: number
 *   metricCount: number
 *   regime: MarketRegime
 *   regimeLabel: string
 *   actionMode: "Risk-on" | "Risk-off" | "Neutral"
 *   actionHeadline: string
 *   shortTerm: string
 *   midTerm: string
 *   longTerm: string
 *   sectors: string[]
 *   breakdown: { key: string; label: string; value: number | null; score: number }[]
 * }} MarketActionGuide
 */

function num(x) {
  const n = Number(x)
  return Number.isFinite(n) ? n : null
}

/** @param {number} v — 높을수록 공포(+), 낮을수록 낙관(−) */
function scoreVix(v) {
  if (v >= 30) return 2
  if (v >= 20) return 1
  if (v > 15) return -1
  return -2
}

/** @param {number} v */
function scoreFearGreed(v) {
  if (v >= 75) return -2
  if (v >= 60) return -1
  if (v >= 40) return 0
  if (v > 25) return 1
  return 2
}

/** @param {number} v */
function scorePutCall(v) {
  if (v <= 0.5) return -2
  if (v < 0.8) return 0
  return 2
}

/** @param {number} v */
function scoreHighYield(v) {
  if (v < 3) return -1
  if (v < 5) return 0
  if (v < 6.5) return 1
  return 2
}

/** @param {number} v */
function scoreMove(v) {
  if (v < 90) return -1
  if (v < 110) return 0
  if (v < 120) return 1
  return 2
}

/** @param {number} v */
function scoreSkew(v) {
  if (v < 125) return -1
  if (v < 140) return 0
  return 1
}

/** @param {number} v */
function scoreBofa(v) {
  if (v <= 2) return 2
  if (v <= 4) return 1
  if (v <= 6) return 0
  if (v < 8) return -1
  return -2
}

/** @param {number} v */
function scoreGsBullBear(v) {
  if (v <= 25) return 2
  if (v <= 40) return 1
  if (v <= 60) return 0
  if (v < 75) return -1
  return -2
}

/** @param {number} v */
function scoreVxn(v) {
  if (v >= 28) return 2
  if (v >= 20) return 1
  if (v > 15) return -1
  return -2
}

const METRIC_SCORERS = [
  { key: "vix", label: "VIX", score: scoreVix },
  { key: "fearGreed", label: "공포탐욕", score: scoreFearGreed },
  { key: "putCall", label: "P/C", score: scorePutCall },
  { key: "highYield", label: "HY OAS", score: scoreHighYield },
  { key: "move", label: "MOVE", score: scoreMove },
  { key: "skew", label: "SKEW", score: scoreSkew },
  { key: "bofa", label: "BofA", score: scoreBofa },
  { key: "gsBullBear", label: "GS B/B", score: scoreGsBullBear },
  { key: "vxn", label: "VXN", score: scoreVxn },
]

/** @param {object | null | undefined} panicData */
function pickMetricValue(panicData, key) {
  if (!panicData) return null
  if (key === "highYield") return num(panicData.highYield ?? panicData.hyOas)
  if (key === "gsBullBear") return num(panicData.gsBullBear ?? panicData.gsSentiment)
  return num(panicData[key])
}

/** @param {number} total */
function resolveRegime(total) {
  if (total >= 10) return { regime: "extreme_fear", regimeLabel: "극도 공포" }
  if (total >= 4) return { regime: "fear", regimeLabel: "공포" }
  if (total >= -3) return { regime: "neutral", regimeLabel: "중립" }
  if (total >= -9) return { regime: "greed", regimeLabel: "탐욕" }
  return { regime: "extreme_greed", regimeLabel: "극도 과열" }
}

/** @param {MarketRegime} regime */
function buildActionCopy(regime) {
  switch (regime) {
    case "extreme_fear":
      return {
        actionMode: "Risk-off",
        actionHeadline: "방어 우선 — 현금·헤지 비중 확대",
        shortTerm: "급락·변동성 확대 대비, 추격 매수 자제",
        midTerm: "분할 매수는 지표 안정 후 검토",
        longTerm: "역사적 공포 구간 — 장기 분할은 가능하나 유동성 우선",
        sectors: ["방어주", "현금", "채권", "필수소비재"],
      }
    case "fear":
      return {
        actionMode: "Risk-off",
        actionHeadline: "선별적 방어 — 리스크 축소",
        shortTerm: "눌림은 소액·분할만, 레버리지 축소",
        midTerm: "실적·현금흐름 우량 대형주 위주",
        longTerm: "과열 아님 — 점진적 비중 회복 여지",
        sectors: ["방어주", "현금", "대형주", "배당"],
      }
    case "greed":
      return {
        actionMode: "Risk-on",
        actionHeadline: "위험 선호 — 성장·사이클 우위",
        shortTerm: "눌림 매수 가능",
        midTerm: "비중 확대 가능",
        longTerm: "과열 전 — 추세 추종 유효",
        sectors: ["AI", "반도체", "성장주", "사이클"],
      }
    case "extreme_greed":
      return {
        actionMode: "Risk-on",
        actionHeadline: "과열 경계 — 이익 실현·비중 조절",
        shortTerm: "추격 매수 자제, 변동성 확대 대비",
        midTerm: "수익 일부 실현 후 핵심만 유지",
        longTerm: "과열 구간 — 신규 비중 확대는 보수적으로",
        sectors: ["대형주", "ETF", "현금", "방어 섹터 일부"],
      }
    default:
      return {
        actionMode: "Neutral",
        actionHeadline: "균형 유지 — 이벤트 대응형",
        shortTerm: "추세·역추세 혼재, 포지션 크기 제한",
        midTerm: "섹터 로테이션·대형주 중심",
        longTerm: "극단 심리 아님 — 범위 매매",
        sectors: ["대형주", "ETF", "핵심 섹터 분산"],
      }
  }
}

/** @param {object | null | undefined} panicData @returns {MarketActionGuide | null} */
export function computeMarketAction(panicData) {
  const breakdown = []
  let totalScore = 0

  for (const { key, label, score: scoreFn } of METRIC_SCORERS) {
    const value = pickMetricValue(panicData, key)
    if (value == null) {
      breakdown.push({ key, label, value: null, score: 0 })
      continue
    }
    const s = scoreFn(value)
    totalScore += s
    breakdown.push({ key, label, value, score: s })
  }

  const scored = breakdown.filter((b) => b.value != null)
  if (scored.length < 3) return null

  const { regime, regimeLabel } = resolveRegime(totalScore)
  const copy = buildActionCopy(regime)

  return {
    totalScore,
    metricCount: scored.length,
    regime,
    regimeLabel,
    ...copy,
    breakdown,
  }
}

/** @param {MarketRegime} regime */
export function regimeToneClass(regime) {
  switch (regime) {
    case "extreme_fear":
    case "fear":
      return "text-rose-300"
    case "greed":
      return "text-cyan-300"
    case "extreme_greed":
      return "text-orange-300"
    default:
      return "text-slate-200"
  }
}

/** @param {"Risk-on" | "Risk-off" | "Neutral"} mode */
export function actionModeBadgeClass(mode) {
  switch (mode) {
    case "Risk-on":
      return "border-cyan-500/35 bg-cyan-500/10 text-cyan-200"
    case "Risk-off":
      return "border-rose-500/35 bg-rose-500/10 text-rose-200"
    default:
      return "border-slate-500/30 bg-white/[0.04] text-slate-300"
  }
}
