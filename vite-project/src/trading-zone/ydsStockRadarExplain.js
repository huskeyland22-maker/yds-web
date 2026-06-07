import { SECTOR_RADAR_CATALOG } from "./ydsPrecursorEnginePhase25.js"
import { resolvePortfolioStageMeta } from "./ydsPrecursorEnginePhase23.js"
import { STOCK_RADAR_SCORE_WEIGHTS } from "./ydsPrecursorEnginePhase26.js"

/** @typedef {'strategy' | 'live_market'} ScoreConfidenceId */

export const STOCK_RADAR_CONFIDENCE = {
  strategy: {
    id: "strategy",
    label: "전략 기반",
    short: "전략",
    description: "YDS·섹터·Trading Zone 단계 등 보유 지표로 산출. 실시간 시세·RSI·거래량 원시 데이터 미연동.",
  },
  live_market: {
    id: "live_market",
    label: "실시간 데이터 기반",
    short: "실시간",
    description: "Phase 26.1 예정 — Yahoo/Finnhub/KIS 시세·거래량·기술지표 연동 후 적용.",
    planned: true,
  },
}

const BREAKDOWN_LABELS = {
  marketFit: "시장 적합도",
  sectorStrength: "섹터 강도",
  technicalTrend: "기술적 추세",
  volume: "거래량 점수",
}

/** @type {Record<string, string>} */
const STAGE_FIT_LABEL = {
  overheated: "과열 구간 — 신규 추격 자제",
  neutral: "중립 구간 적합",
  interest: "관심 구간 적합",
  dca: "분할매수 구간 적합",
  panicBuy: "인생 타점 구간 검토",
}

/** @type {Record<string, string>} */
const STATUS_STAGE_LABEL = {
  strong: "강세 상태",
  dip: "눌림목 상태",
  breakout: "돌파 상태",
  watch: "관찰 상태",
}

/**
 * @param {number} score
 * @param {number} avg
 */
function vsAvg(score, avg) {
  if (score >= avg + 6) return "high"
  if (score <= avg - 6) return "low"
  return "mid"
}

/**
 * @param {{
 *   stock: {
 *     id: string
 *     name: string
 *     score: number
 *     status: { id: string; label: string }
 *     scoreBreakdown: { marketFit: number; sectorStrength: number; technicalTrend: number; volume: number }
 *     tradingStage?: string | null
 *     sectorRadarId: string
 *   }
 *   inputs: {
 *     priA?: number | null
 *     priB?: number | null
 *     regimeLabel?: string | null
 *     radarAlertLabel?: string | null
 *     dominantPattern?: string | null
 *   }
 *   stageId: string | null
 *   sectorRank: number | null
 *   sectorScore: number | null
 * }} ctx
 */
export function buildStockPickExplainability(ctx) {
  const { stock, inputs, stageId, sectorRank, sectorScore } = ctx
  const b = stock.scoreBreakdown
  const avg =
    (b.marketFit + b.sectorStrength + b.technicalTrend + b.volume) / 4

  const sectorLabel =
    SECTOR_RADAR_CATALOG.find((s) => s.id === stock.sectorRadarId)?.label ?? stock.sectorRadarId

  /** @type {string[]} */
  const recommendReasons = []
  if (sectorRank != null && sectorRank <= 3) {
    recommendReasons.push(`${sectorLabel} 섹터 ${sectorRank}위 (점수 ${sectorScore ?? "—"})`)
  } else if (sectorRank != null) {
    recommendReasons.push(`${sectorLabel} 섹터 포함 (순위 ${sectorRank}위)`)
  }
  if (stageId && STAGE_FIT_LABEL[stageId]) {
    recommendReasons.push(STAGE_FIT_LABEL[stageId])
  }
  const stageMeta = stageId ? resolvePortfolioStageMeta(stageId) : null
  if (stageMeta && !recommendReasons.some((r) => r.includes(stageMeta.shortLabel))) {
    recommendReasons.push(`YDS ${stageMeta.emoji} ${stageMeta.shortLabel}`)
  }
  if (stock.tradingStage) {
    recommendReasons.push(`매매 단계 · ${stock.tradingStage}`)
  } else if (STATUS_STAGE_LABEL[stock.status.id]) {
    recommendReasons.push(STATUS_STAGE_LABEL[stock.status.id])
  }
  const priB = inputs.priB ?? null
  if (priB != null) {
    if (priB < 35) recommendReasons.push("PRI-B 안정 (충격 낮음)")
    else if (priB >= 50) recommendReasons.push("PRI-B 상승 — 변동성 주의")
    else recommendReasons.push(`PRI-B ${Math.round(priB)} (보통)`)
  }
  if (inputs.priA != null && inputs.priA >= 40) {
    recommendReasons.push(`조기경보 PRI-A ${Math.round(inputs.priA)}`)
  }
  if (inputs.dominantPattern) {
    recommendReasons.push(`우세 패턴 · ${inputs.dominantPattern}`)
  }
  if (b.technicalTrend >= 85) recommendReasons.push("기술 추세 점수 우수")
  if (b.marketFit >= 80) recommendReasons.push("시장 적합도 양호")

  /** @type {string[]} */
  const warnings = []
  if (stageId === "overheated") warnings.push("과열 위험 존재 — 추격매수 주의")
  if (inputs.radarAlertId === "danger" || inputs.radarAlertId === "critical") {
    warnings.push(`충격감지 ${inputs.radarAlertLabel ?? "경고"} — 비중 축소 검토`)
  } else if (inputs.radarAlertId === "caution") {
    warnings.push("Radar 주의 — 거래량·변동성 확인 필요")
  }
  if (b.volume < 65) warnings.push("거래량 점수 낮음 — 실거래량 확인 필요 (V1: 추정치)")
  if (stock.status.id === "breakout") warnings.push("돌파 구간 — 추격매수 주의")
  if (priB != null && priB >= 50) warnings.push("PRI-B 고구간 — 급락 리스크 점검")

  /** @type {{ label: string; detail: string }[]} */
  const strengths = []
  /** @type {{ label: string; detail: string }[]} */
  const weaknesses = []

  const pushStrength = (key, label, detail) => {
    if (vsAvg(b[key], avg) === "high") strengths.push({ label, detail })
  }
  const pushWeakness = (key, label, detail) => {
    if (vsAvg(b[key], avg) === "low") weaknesses.push({ label, detail })
  }

  pushStrength("marketFit", BREAKDOWN_LABELS.marketFit, `점수 ${b.marketFit} · 시장 단계·국면 반영`)
  pushStrength("sectorStrength", BREAKDOWN_LABELS.sectorStrength, `점수 ${b.sectorStrength} · ${sectorLabel} 강도`)
  pushStrength("technicalTrend", BREAKDOWN_LABELS.technicalTrend, `점수 ${b.technicalTrend} · Trading Zone 단계`)
  pushStrength("volume", BREAKDOWN_LABELS.volume, `점수 ${b.volume} · PRI-B·단계 기반 추정`)

  pushWeakness("marketFit", BREAKDOWN_LABELS.marketFit, `점수 ${b.marketFit} · 시장 국면과 괴리 가능`)
  pushWeakness("sectorStrength", BREAKDOWN_LABELS.sectorStrength, `점수 ${b.sectorStrength} · 섹터 순위 하락 시 재점검`)
  pushWeakness("technicalTrend", BREAKDOWN_LABELS.technicalTrend, `점수 ${b.technicalTrend} · 추세 약화`)
  pushWeakness("volume", BREAKDOWN_LABELS.volume, `점수 ${b.volume} · 유동성·거래량 확인 필요`)

  if (strengths.length < 2) {
    const sorted = [
      ["marketFit", b.marketFit],
      ["sectorStrength", b.sectorStrength],
      ["technicalTrend", b.technicalTrend],
      ["volume", b.volume],
    ].sort((a, c) => c[1] - a[1])
    for (const [key, val] of sorted) {
      if (strengths.length >= 2) break
      if (strengths.some((s) => s.label === BREAKDOWN_LABELS[key])) continue
      strengths.push({
        label: BREAKDOWN_LABELS[key],
        detail: `상대 강점 · 점수 ${val}`,
      })
    }
  }
  if (weaknesses.length < 1) {
    const sorted = [
      ["marketFit", b.marketFit],
      ["sectorStrength", b.sectorStrength],
      ["technicalTrend", b.technicalTrend],
      ["volume", b.volume],
    ].sort((a, c) => a[1] - c[1])
    const [key, val] = sorted[0]
    weaknesses.push({
      label: BREAKDOWN_LABELS[key],
      detail: `상대 약점 · 점수 ${val}`,
    })
  }

  const breakdownRows = [
    { key: "marketFit", label: BREAKDOWN_LABELS.marketFit, score: b.marketFit, weight: STOCK_RADAR_SCORE_WEIGHTS.marketFit },
    { key: "sectorStrength", label: BREAKDOWN_LABELS.sectorStrength, score: b.sectorStrength, weight: STOCK_RADAR_SCORE_WEIGHTS.sectorStrength },
    { key: "technicalTrend", label: BREAKDOWN_LABELS.technicalTrend, score: b.technicalTrend, weight: STOCK_RADAR_SCORE_WEIGHTS.technicalTrend },
    { key: "volume", label: BREAKDOWN_LABELS.volume, score: b.volume, weight: STOCK_RADAR_SCORE_WEIGHTS.volume },
  ]

  return {
    confidence: STOCK_RADAR_CONFIDENCE.strategy,
    confidenceNote: STOCK_RADAR_CONFIDENCE.strategy.description,
    breakdownRows,
    recommendReasons: recommendReasons.slice(0, 6),
    warnings: warnings.slice(0, 4),
    strengths: strengths.slice(0, 2),
    weaknesses: weaknesses.slice(0, 1),
    formulaSummary:
      "종합 = 0.4×시장적합 + 0.25×섹터 + 0.2×추세 + 0.15×거래량점수 (각 42~98 clamp)",
  }
}

/**
 * @param {ReturnType<typeof import("./ydsPrecursorEnginePhase26.js").buildStockRadarFromPrecursorContext>} stockRadar
 * @param {Map<string, { score: number; rank: number }>} sectorMap
 */
export function enrichStockRadarPicks(stockRadar, sectorMap) {
  const inputs = stockRadar.inputs ?? {}
  const stageId = stockRadar.exportForTradeCandidates?.stageId ?? inputs.sectorRadarExport?.stageId ?? null

  const enrich = (pick) => {
    const sectorRow = sectorMap.get(pick.sectorRadarId)
    return {
      ...pick,
      explain: buildStockPickExplainability({
        stock: pick,
        inputs: {
          priA: inputs.priA,
          priB: inputs.priB,
          regimeLabel: inputs.regimeLabel,
          radarAlertLabel: inputs.radarAlertLabel,
          radarAlertId: inputs.radarAlertId,
          dominantPattern: inputs.dominantPattern,
        },
        stageId,
        sectorRank: sectorRow?.rank ?? null,
        sectorScore: sectorRow?.score ?? null,
      }),
    }
  }

  return {
    ...stockRadar,
    explainabilityVersion: 2,
    scoringDocPath: "/glossary#stock-radar",
    topBuys: (stockRadar.topBuys ?? []).map(enrich),
    byMarket: {
      us: (stockRadar.byMarket?.us ?? []).map(enrich),
      kr: (stockRadar.byMarket?.kr ?? []).map(enrich),
    },
  }
}
