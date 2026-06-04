import { resolveYdsStage, formatMetric } from "./ydsHistoricalEventTypes.js"
import { resolveMacroStageAllocation } from "./macroStageAllocation.js"
import { MACRO_V1_STATUS_BANDS } from "../panic-v2/panicMacroV1Status.js"

export const PRECURSOR_ENGINE_PHASE23_LABEL = "Portfolio Engine — Phase 23"

/** @typedef {import("../panic-v2/panicMacroV1Status.js").MacroV1StatusId} MacroV1StatusId */

export const PORTFOLIO_STAGE_DESCRIPTIONS = {
  overheated: "과열 구간. 현금 확보 우선.",
  neutral: "기본 포지션 유지. 추가 기회를 위한 현금 확보.",
  interest: "조정 가능성 증가. 우량주 선별 매수 시작.",
  dca: "공포 확대. 분할매수 적극 진행.",
  panicBuy: "역사적 패닉 구간. 계획된 현금 최대 투입.",
}

/**
 * @param {MacroV1StatusId | string | null | undefined} stageId
 */
export function resolvePortfolioStageMeta(stageId) {
  const band = MACRO_V1_STATUS_BANDS.find((s) => s.id === stageId)
  if (!band) return null
  const shortLabel =
    band.id === "overheated"
      ? "과열"
      : band.id === "neutral"
        ? "중립"
        : band.id === "interest"
          ? "관심"
          : band.id === "dca"
            ? "분할매수"
            : "패닉매수"
  return {
    id: band.id,
    emoji: band.emoji,
    label: band.label,
    shortLabel,
    color: band.color,
  }
}

/**
 * @param {number | null | undefined} ydsScore
 */
export function buildPortfolioRecommendation(ydsScore) {
  const stage = resolveYdsStage(ydsScore)
  const stageId = stage?.id ?? null
  const allocation = resolveMacroStageAllocation(stageId)
  const meta = resolvePortfolioStageMeta(stageId)

  if (!stage || !allocation || !meta) {
    return {
      title: "권장 포트폴리오",
      available: false,
      stage: null,
      allocation: null,
      description: "YDS 점수가 없어 권장 비중을 산출할 수 없습니다.",
    }
  }

  return {
    title: "권장 포트폴리오",
    available: true,
    stage: {
      id: meta.id,
      emoji: meta.emoji,
      shortLabel: meta.shortLabel,
      label: meta.label,
      color: meta.color,
      ydsScore: ydsScore != null && Number.isFinite(ydsScore) ? Math.round(ydsScore) : null,
    },
    allocation: {
      stockPct: allocation.stockPct,
      cashPct: allocation.cashPct,
      stockLabel: allocation.stockLabel,
      cashLabel: allocation.cashLabel,
      summary: `${allocation.stockLabel} · ${allocation.cashLabel}`,
    },
    description:
      PORTFOLIO_STAGE_DESCRIPTIONS[/** @type {MacroV1StatusId} */ (stageId)] ??
      allocation.note ??
      "현재 YDS 단계에 맞춘 권장 비중입니다.",
  }
}

/**
 * @param {number | null | undefined} ydsScore
 */
export function buildPrecursorEnginePhase23Report(ydsScore) {
  const recommendation = buildPortfolioRecommendation(ydsScore)

  return {
    label: PRECURSOR_ENGINE_PHASE23_LABEL,
    recommendation,
    stageTable: MACRO_V1_STATUS_BANDS.map((band) => {
      const alloc = resolveMacroStageAllocation(band.id)
      const meta = resolvePortfolioStageMeta(band.id)
      return {
        stageId: band.id,
        emoji: band.emoji,
        shortLabel: meta?.shortLabel ?? band.label,
        stockPct: alloc?.stockPct ?? null,
        cashPct: alloc?.cashPct ?? null,
        description: PORTFOLIO_STAGE_DESCRIPTIONS[band.id] ?? "",
      }
    }),
    notes: [
      "YDS 거시 V1 단계 → 주식·현금 비중 매핑 (검증·표시 전용)",
      "macroStageAllocation.js 읽기 전용 · 프로덕션 엔진 미수정",
    ],
  }
}

export function formatPortfolioPct(value) {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${formatMetric(value)}%`
}
