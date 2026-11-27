/**
 * YDS 위치 게이지 — 표시용 모델만.
 * 구간·점수는 기존 Credit Cycle / Panic 엔진 기준을 재사용한다. 합산 금지.
 */
import { REGIME_SCORE_BANDS_HYPOTHESIS } from "../../../src/credit-cycle/config.js"
import { REGIME_GUIDE } from "../credit-cycle/creditCycleContent.js"
import {
  getPanicScoreV2,
  PANIC_INDEX_STAGE_BANDS,
  resolvePanicIndexStatus,
} from "../utils/tradingScores.js"
import { resolveHomeRegimeLabel } from "./ydsHomeSummaryEngine.js"

/** 기존 REGIME_SCORE_BANDS_HYPOTHESIS 구간에 대응하는 표시색 (임계값은 변경하지 않음). */
const CREDIT_BAND_COLORS = Object.freeze({
  low: "#22c55e",
  below_avg: "#84cc16",
  watch: "#eab308",
  elevated: "#f97316",
  extreme: "#ef4444",
})

const CREDIT_BAND_LABELS = Object.freeze({
  low: "낮음",
  below_avg: "평균↓",
  watch: "주시",
  elevated: "상승",
  extreme: "극단",
})

/**
 * @param {number | null | undefined} score
 * @param {Array<{ id: string, min: number, max: number }>} bands
 */
export function resolveScoreBand(score, bands) {
  if (score == null || !Number.isFinite(Number(score))) return null
  const s = Math.max(0, Math.min(100, Number(score)))
  for (const band of bands) {
    if (s <= band.max) return band
  }
  return bands[bands.length - 1] ?? null
}

/**
 * @param {number | null | undefined} score
 */
export function scoreToGaugeDeg(score) {
  if (score == null || !Number.isFinite(Number(score))) return null
  const s = Math.max(0, Math.min(100, Number(score)))
  return Math.round((s / 100) * 180)
}

/**
 * Credit Cycle CCI 위치 게이지 모델.
 * @param {{
 *   cci?: number | null
 *   cciDisplay?: string
 *   regime?: string | null
 *   asOf?: string | null
 *   hold?: boolean
 *   loading?: boolean
 *   testSeedOnly?: boolean
 *   pitLabel?: string | null
 *   staleNames?: string[]
 *   statusLabel?: string | null
 * } | null | undefined} credit
 */
export function buildCreditPositionGaugeModel(credit) {
  if (!credit || credit.loading) {
    return {
      axis: "credit",
      ready: false,
      loading: true,
      emptyLabel: "데이터 연결 대기",
      emptyHint: "신용 사이클 License-safe 관측을 불러오는 중입니다.",
      score: null,
      scoreDisplay: "—",
      unit: "CCI",
      deg: null,
      stageLabel: null,
      stageColor: null,
      stageBlurb: null,
      asOf: null,
      bands: enrichCreditBands(),
      footnotes: [],
    }
  }

  if (credit.testSeedOnly) {
    return {
      axis: "credit",
      ready: false,
      loading: false,
      emptyLabel: "데이터 연결 대기",
      emptyHint: "테스트 시드만 있어 시장 관측으로 표시하지 않습니다.",
      score: null,
      scoreDisplay: "—",
      unit: "CCI",
      deg: null,
      stageLabel: null,
      stageColor: null,
      stageBlurb: null,
      asOf: null,
      bands: enrichCreditBands(),
      footnotes: [],
    }
  }

  const cci =
    credit.cci != null && Number.isFinite(Number(credit.cci)) ? Number(credit.cci) : null
  if (cci == null) {
    return {
      axis: "credit",
      ready: false,
      loading: false,
      emptyLabel: "데이터 연결 대기",
      emptyHint: "License-safe CCI가 없어 신용 위치를 확정하지 않습니다.",
      score: null,
      scoreDisplay: "—",
      unit: "CCI",
      deg: null,
      stageLabel: null,
      stageColor: null,
      stageBlurb: null,
      asOf: credit.asOf || null,
      bands: enrichCreditBands(),
      footnotes: [],
    }
  }

  const regimeId = resolveHomeRegimeLabel(credit.regime)
  const guide = REGIME_GUIDE.find((g) => g.id === regimeId) || null
  const band = resolveScoreBand(cci, REGIME_SCORE_BANDS_HYPOTHESIS)
  const stageColor = band ? CREDIT_BAND_COLORS[band.id] || "#8b7cf6" : "#8b7cf6"
  /** @type {string[]} */
  const footnotes = []
  if (credit.pitLabel) footnotes.push(String(credit.pitLabel))
  if (credit.staleNames?.length) {
    footnotes.push(`STALE · ${credit.staleNames.slice(0, 2).join(", ")}`)
  }
  if (credit.hold) footnotes.push("해석 보류")
  footnotes.push("Panic과 합산하지 않음")

  return {
    axis: "credit",
    ready: true,
    loading: false,
    emptyLabel: null,
    emptyHint: null,
    score: Math.round(cci),
    scoreDisplay: credit.cciDisplay || String(Math.round(cci)),
    unit: "CCI",
    deg: scoreToGaugeDeg(cci),
    stageLabel: regimeId || guide?.title || "국면 미확정",
    stageColor,
    stageBlurb: guide?.meaning || "엔진 국면 판정을 확인하세요. 매수·매도 신호가 아닙니다.",
    asOf: credit.asOf || null,
    bands: enrichCreditBands(),
    footnotes,
  }
}

/**
 * Panic Index 위치 게이지 모델 (VIX·CNN·Put/Call만).
 * @param {object | null | undefined} panicData
 * @param {string | null | undefined} asOf
 */
export function buildPanicPositionGaugeModel(panicData, asOf = null) {
  const score = getPanicScoreV2(panicData)
  const status = resolvePanicIndexStatus(score)

  if (score == null || !status) {
    return {
      axis: "panic",
      ready: false,
      loading: false,
      emptyLabel: "판단 유보",
      emptyHint: "VIX · CNN · Put/Call이 모두 있어야 Panic Index를 표시합니다.",
      score: null,
      scoreDisplay: "—",
      unit: "/100",
      deg: null,
      stageLabel: null,
      stageColor: null,
      stageBlurb: null,
      asOf: asOf || null,
      bands: enrichPanicBands(),
      footnotes: ["신용 사이클과 합산하지 않음"],
    }
  }

  return {
    axis: "panic",
    ready: true,
    loading: false,
    emptyLabel: null,
    emptyHint: null,
    score,
    scoreDisplay: String(score),
    unit: "/100",
    deg: scoreToGaugeDeg(score),
    stageLabel: status.label,
    stageColor: status.color,
    stageBlurb: status.blurb || status.lifeView || null,
    asOf: asOf || null,
    bands: enrichPanicBands(),
    footnotes: ["VIX · CNN · Put/Call만 · 신용과 합산 없음"],
  }
}

function enrichCreditBands() {
  return REGIME_SCORE_BANDS_HYPOTHESIS.map((band) => ({
    id: band.id,
    min: band.min,
    max: band.max,
    label: CREDIT_BAND_LABELS[band.id] || band.id,
    color: CREDIT_BAND_COLORS[band.id] || "#64748b",
  }))
}

function enrichPanicBands() {
  return PANIC_INDEX_STAGE_BANDS.map((band) => ({
    id: band.id,
    min: band.min,
    max: band.max,
    label: band.label,
    color: band.color,
  }))
}
