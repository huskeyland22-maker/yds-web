/**
 * AI Track Record — 영구 추천 이력 기반 성과 검증 (저장소 변경 없음)
 */

import { findValidationPickById } from "./ydsPickValidationDetailEngine.js"
import {
  buildHubHistoryViewRows,
  buildRecommendPerfSummaryCards,
  formatHubHistoryDateDot,
} from "./ydsHubHistoryViewEngine.js"
import { formatRecommendProfitLabel } from "./ydsRecommendProfitResolver.js"
import { resolvePickLifecycleView } from "./ydsPickLifecycleEngine.js"
import { summarizeLockedReturns } from "./ydsPickReturnStats.js"
import { SCORE_BUCKETS } from "./ydsPickScoreCorrelation.js"
import { PANIC_BUCKETS, panicBucketForIntensity } from "./ydsPickSuccessPatternEngine.js"
import { getRecommendSnapshot } from "./ydsValidationRecommendSnapshot.js"

/** @typedef {'all' | 'kr' | 'us' | 'active' | 'ended' | 'profit' | 'loss' | 'best'} TrackRecordFilterId */

/** @type {ReadonlyArray<{ id: TrackRecordFilterId; label: string }>} */
export const TRACK_RECORD_FILTERS = [
  { id: "all", label: "전체" },
  { id: "kr", label: "KR" },
  { id: "us", label: "US" },
  { id: "active", label: "진행중" },
  { id: "ended", label: "종료" },
  { id: "profit", label: "수익중" },
  { id: "loss", label: "손실중" },
  { id: "best", label: "AI Best Pick" },
]

/**
 * @typedef {{
 *   id: string
 *   label: string
 *   count: number
 *   winRate: number | null
 *   avgReturn: number | null
 * }} TrackRecordGroupStat
 */

/**
 * @param {ReturnType<typeof buildHubHistoryViewRows>[number][]} rows
 * @param {TrackRecordFilterId} filterId
 */
export function filterTrackRecordRows(rows, filterId) {
  if (filterId === "all") return rows
  if (filterId === "kr") return rows.filter((r) => r.country === "KR")
  if (filterId === "us") return rows.filter((r) => r.country === "US")
  if (filterId === "active") return rows.filter((r) => r.lifecycleId === "active")
  if (filterId === "ended") return rows.filter((r) => r.lifecycleId !== "active")
  if (filterId === "profit") {
    return rows.filter((r) => r.returnPct != null && r.returnPct > 0)
  }
  if (filterId === "loss") {
    return rows.filter((r) => r.returnPct != null && r.returnPct < 0)
  }
  if (filterId === "best") return rows.filter((r) => r.isAiBestPick)
  return rows
}

/**
 * @param {ReturnType<typeof buildHubHistoryViewRows>[number][]} rows
 * @param {(row: ReturnType<typeof buildHubHistoryViewRows>[number]) => string | null} keyFn
 * @param {(key: string) => string} labelFn
 */
function groupRowsByWinRate(rows, keyFn, labelFn) {
  /** @type {Map<string, { id: string; label: string; returns: number[] }>} */
  const groups = new Map()

  for (const row of rows) {
    const key = keyFn(row)
    if (!key) continue
    const ret = row.returnPct
    if (ret == null || !Number.isFinite(ret)) continue
    const bucket = groups.get(key) ?? { id: key, label: labelFn(key), returns: [] }
    bucket.returns.push(ret)
    groups.set(key, bucket)
  }

  return [...groups.values()]
    .map((g) => {
      const stats = summarizeLockedReturns(g.returns)
      return /** @type {TrackRecordGroupStat} */ ({
        id: g.id,
        label: g.label,
        count: stats.count,
        winRate: stats.winRate,
        avgReturn: stats.avgReturn,
      })
    })
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
}

/**
 * @param {ReturnType<typeof buildHubHistoryViewRows>[number][]} rows
 */
export function buildTrackRecordScoreAnalysis(rows) {
  return SCORE_BUCKETS.map((bucket) => {
    const subset = rows.filter((row) => {
      if (row.aiScore == null) return false
      if (bucket.max == null) return row.aiScore >= bucket.min
      return row.aiScore >= bucket.min && row.aiScore <= bucket.max
    })
    const returns = subset
      .map((r) => r.returnPct)
      .filter((v) => v != null && Number.isFinite(v))
      .map(Number)
    const stats = summarizeLockedReturns(returns)
    return {
      id: bucket.id,
      label: `AI 점수 ${bucket.label}`,
      ...stats,
    }
  }).filter((s) => s.count > 0)
}

/**
 * @param {ReturnType<typeof buildHubHistoryViewRows>[number][]} rows
 */
export function buildTrackRecordMarketStateAnalysis(rows) {
  return groupRowsByWinRate(
    rows,
    (row) => {
      const label =
        row.marketLedger?.marketStateLabel ??
        row.marketLedger?.strategyLabel ??
        null
      return label && label !== "—" ? label : null
    },
    (key) => key,
  )
}

/**
 * @param {ReturnType<typeof buildHubHistoryViewRows>[number][]} rows
 */
export function buildTrackRecordPanicAnalysis(rows) {
  return PANIC_BUCKETS.map((bucket) => {
    const subset = rows.filter((row) => {
      const intensity =
        row.marketLedger?.panicIntensity ??
        row.pickPanicIntensity ??
        null
      if (intensity == null || !Number.isFinite(intensity)) return false
      return panicBucketForIntensity(intensity)?.id === bucket.id
    })
    const returns = subset
      .map((r) => r.returnPct)
      .filter((v) => v != null && Number.isFinite(v))
      .map(Number)
    const stats = summarizeLockedReturns(returns)
    return {
      id: bucket.id,
      label: `패닉 ${bucket.label}`,
      ...stats,
    }
  }).filter((s) => s.count > 0)
}

/**
 * @param {ReturnType<typeof buildHubHistoryViewRows>[number][]} rows
 */
export function buildTrackRecordSectorAnalysis(rows) {
  return groupRowsByWinRate(
    rows,
    (row) => (row.sectorLabel && row.sectorLabel !== "—" ? row.sectorLabel : "미분류"),
    (key) => key,
  ).slice(0, 12)
}

/**
 * @param {ReturnType<typeof buildHubHistoryViewRows>[number][]} rows
 */
export function buildTrackRecordCountryAnalysis(rows) {
  return groupRowsByWinRate(
    rows,
    (row) => row.country ?? null,
    (key) => (key === "KR" ? "한국 (KR)" : key === "US" ? "미국 (US)" : key),
  )
}

/**
 * @param {string} pickId
 * @param {import("./ydsStockPickModel.js").StockPickView[]} [stocks]
 */
export function buildTrackRecordDetail(pickId, stocks = []) {
  const pick = findValidationPickById(pickId)
  if (!pick) return { visible: false }

  const hubRows = buildHubHistoryViewRows(stocks)
  const hubRow = hubRows.find((r) => r.pickId === pick.id) ?? null
  const country = pick.country === "KR" ? "KR" : "US"
  const lifecycle = resolvePickLifecycleView(pick.lifecycleId ?? "active")
  const snap = getRecommendSnapshot(pick)
  const ledger = pick.marketLedger

  const marketState =
    ledger?.marketStateLabel ??
    snap?.unifiedMarketStateLabel ??
    snap?.marketStateLabel ??
    pick.strategyLabel ??
    "—"
  const panicIntensity =
    ledger?.panicIntensity ?? snap?.panicIntensity ?? null
  const panicLabel = ledger?.panicLabel ?? snap?.panicLabel ?? "—"
  const cycleLabel = ledger?.cycleLabel ?? "—"

  const formatMetric = (v) =>
    v != null && Number.isFinite(Number(v)) ? String(Math.round(Number(v) * 10) / 10) : "—"

  return {
    visible: true,
    pickId: pick.id,
    name: hubRow?.name ?? pick.name ?? pick.ticker,
    ticker: pick.ticker,
    country,
    recommendedAtLabel: hubRow?.recommendedAtLabel ?? formatHubHistoryDateDot(pick.recommendedAt),
    recommendedAtIso:
      pick.recommendedAtIso ??
      pick.lockedRecommendedAtIso ??
      formatHubHistoryDateDot(pick.recommendedAt),
    recommendedPriceLabel: hubRow?.recommendedPriceLabel ?? "—",
    currentPriceLabel: hubRow?.currentPriceLabel ?? "—",
    returnLabel: hubRow?.returnLabel ?? formatRecommendProfitLabel(pick.returnPct),
    returnTone: hubRow?.returnTone ?? "muted",
    maxReturnLabel: hubRow?.maxReturnLabel ?? formatRecommendProfitLabel(pick.maxReturnPct),
    minReturnLabel: hubRow?.minReturnLabel ?? formatRecommendProfitLabel(pick.minReturnPct),
    elapsedLabel: hubRow?.elapsedLabel ?? "—",
    statusLabel: hubRow?.statusLabel ?? `${lifecycle.emoji} ${lifecycle.label}`,
    ledgerState: pick.ledgerState ?? (pick.lifecycleId === "active" ? "active" : "ended"),
    aiScoreLabel: hubRow?.aiScoreLabel ?? "—",
    aiGradeLabel: pick.recommendGrade ?? hubRow?.aiGradeLabel ?? "—",
    reasonLine: pick.recommendReason ?? hubRow?.reasonLine ?? "—",
    marketState,
    panicIntensityLabel: panicIntensity != null ? String(Math.round(panicIntensity)) : "—",
    panicLabel,
    cycleLabel,
    vixLabel: formatMetric(ledger?.vix),
    cnnLabel: formatMetric(ledger?.cnn),
    bofaLabel: formatMetric(ledger?.bofa),
    sectorLabel: hubRow?.sectorLabel ?? "—",
    badges: hubRow?.badges ?? [],
    detailLink: `/performance-validation/pick/${encodeURIComponent(pick.id)}`,
  }
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView[]} [stocks]
 */
export function buildAiTrackRecordReport(stocks = []) {
  const rows = buildHubHistoryViewRows(stocks).map((row) => {
    const pick = findValidationPickById(row.pickId)
    const snap = pick ? getRecommendSnapshot(pick) : null
    return {
      ...row,
      pickPanicIntensity: snap?.panicIntensity ?? pick?.marketLedger?.panicIntensity ?? null,
    }
  })

  if (!rows.length) {
    return { visible: false, title: "AI Track Record", rows: [], summary: null, analysis: null }
  }

  const summary = buildRecommendPerfSummaryCards(undefined, stocks)
  const analysis = {
    byScore: buildTrackRecordScoreAnalysis(rows),
    byMarketState: buildTrackRecordMarketStateAnalysis(rows),
    byPanic: buildTrackRecordPanicAnalysis(rows),
    bySector: buildTrackRecordSectorAnalysis(rows),
    byCountry: buildTrackRecordCountryAnalysis(rows),
  }

  return {
    visible: true,
    title: "AI Track Record",
    subtitle: "AI가 언제·어떤 근거로 추천했고, 실제로 얼마나 맞았는지 검증합니다.",
    rows,
    summary,
    analysis,
  }
}
