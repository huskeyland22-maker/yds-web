import { resolveYdsStage, formatMetric } from "./ydsHistoricalEventTypes.js"
import { buildPrecursorDashboardBetaReport } from "./ydsPrecursorEnginePhase12.js"
import { buildPrecursorEnginePhase6Report } from "./ydsPrecursorEnginePhase6.js"
import { resolvePortfolioStageMeta } from "./ydsPrecursorEnginePhase23.js"
import { buildSectorRotation } from "../utils/buildSectorRotation.js"
import { panicDataFromCycleRow } from "../utils/cycleHistoryUtils.js"
import { loadPrecursorValidationLog } from "./ydsPrecursorValidationLogStorage.js"
import { MACRO_V1_STATUS_BANDS } from "../panic-v2/panicMacroV1Status.js"

export const PRECURSOR_ENGINE_PHASE25_LABEL = "Sector Radar — Phase 25"

/** @typedef {import("../panic-v2/panicMacroV1Status.js").MacroV1StatusId} MacroV1StatusId */

/** 향후 종목 Radar · 매매 후보 리스트 연결 스텁 */
export const SECTOR_RADAR_PIPELINE = [
  {
    id: "sector-radar",
    label: "Sector Radar",
    status: "active",
    outputKey: "topSectors",
  },
  {
    id: "stock-radar",
    label: "종목 Radar",
    status: "active",
    consumes: "sectorRadar.topSectors",
    outputKey: "stockPicks",
  },
  {
    id: "trade-candidates",
    label: "매매 후보 리스트",
    status: "planned",
    consumes: "stockRadar.stockPicks",
    outputKey: "candidates",
  },
]

/** @type {{ id: string; label: string; rotationId?: string; koreaSectorId?: string }[]} */
export const SECTOR_RADAR_CATALOG = [
  { id: "semi", label: "반도체", rotationId: "semi", koreaSectorId: "ai-semiconductor" },
  { id: "power", label: "전력인프라", rotationId: "power", koreaSectorId: "power-infra" },
  { id: "physicalAi", label: "피지컬AI", rotationId: "ai", koreaSectorId: "ai-semiconductor" },
  { id: "defense", label: "방산", rotationId: "defense", koreaSectorId: "defense-space" },
  { id: "bio", label: "바이오", rotationId: "bio", koreaSectorId: "bio-healthcare" },
  { id: "ship", label: "조선", rotationId: "ship", koreaSectorId: "shipbuilding" },
  { id: "battery", label: "2차전지", rotationId: "battery", koreaSectorId: "battery-materials" },
  { id: "value", label: "가치·대형", rotationId: "value" },
  { id: "cash", label: "현금·방어", rotationId: "cash" },
]

/** @type {{ id: string; label: string }[]} */
export const SECTOR_RADAR_WEAK_CATALOG = [
  { id: "consumer", label: "소비재" },
  { id: "reits", label: "리츠" },
]

/** @type {Record<MacroV1StatusId, { hint: string; boosts: Record<string, number> }>} */
export const STAGE_SECTOR_POLICY = {
  overheated: {
    hint: "방어주 우선",
    boosts: { cash: 18, value: 12, defense: 8, semi: -8, physicalAi: -6 },
  },
  neutral: {
    hint: "성장주 우선",
    boosts: { semi: 14, physicalAi: 12, power: 10, bio: 6 },
  },
  interest: {
    hint: "리더주 추적",
    boosts: { semi: 10, physicalAi: 10, power: 8, defense: 6, ship: 5 },
  },
  dca: {
    hint: "핵심 섹터 집중",
    boosts: { semi: 12, power: 10, physicalAi: 10, bio: 8, defense: 6 },
  },
  panicBuy: {
    hint: "최고 확신 섹터 집중",
    boosts: { semi: 16, physicalAi: 14, power: 12, bio: 10, defense: 8 },
  },
}

/** @type {Record<string, Record<string, number>>} */
const REGIME_SECTOR_BOOSTS = {
  stable: { semi: 6, physicalAi: 5, power: 4 },
  transition: { power: 6, defense: 5, value: 4 },
  risk: { defense: 8, cash: 10, value: 6, semi: 4 },
  panic: { semi: 10, physicalAi: 8, bio: 8, cash: 6 },
  unknown: {},
}

/** @type {Record<string, Record<string, number>>} */
const PATTERN_SECTOR_BOOSTS = {
  tariff: { semi: 12, physicalAi: 8 },
  lehman: { value: 10, cash: 12, defense: 6 },
  svb: { cash: 10, value: 8, bio: 4 },
  covid: { bio: 14, cash: 8 },
  yen_carry: { defense: 6, value: 5 },
  bull: { semi: 10, physicalAi: 12, power: 8 },
}

/** @type {Record<string, number>} */
const RADAR_ALERT_SECTOR = {
  normal: 0,
  caution: -4,
  danger: -8,
  critical: -12,
}

/**
 * @param {number} raw
 */
function clampScore(raw) {
  return Math.max(35, Math.min(98, Math.round(raw)))
}

/**
 * @param {Record<string, number>} boosts
 * @param {Record<string, number>} map
 * @param {number} scale
 */
function applyBoostMap(boosts, map, scale = 1) {
  for (const [id, pts] of Object.entries(map)) {
    boosts[id] = (boosts[id] ?? 0) + pts * scale
  }
}

/**
 * @param {{
 *   dashboard: ReturnType<typeof buildPrecursorDashboardBetaReport>
 *   phase6: ReturnType<typeof buildPrecursorEnginePhase6Report>
 *   latestSnapshot?: Record<string, unknown> | null
 * }} ctx
 */
export function buildSectorRadarFromPrecursorContext(ctx) {
  const { dashboard, phase6, latestSnapshot = null } = ctx
  const ydsScore = dashboard.cards.yds.value
  const stage = resolveYdsStage(ydsScore)
  const stageId = /** @type {MacroV1StatusId | null} */ (stage?.id ?? null)
  const stageMeta = resolvePortfolioStageMeta(stageId)

  const regimeId = dashboard.cards.regime.regimeId ?? "unknown"
  const radarAlertId = phase6.radarAlert?.id ?? "normal"
  const topPattern = phase6.top3[0] ?? null

  let panicData = null
  let cycleScore = null
  if (latestSnapshot) {
    const panic = panicDataFromCycleRow(latestSnapshot)
    panicData = panic ?? latestSnapshot
    const cs = latestSnapshot.cycleScore ?? latestSnapshot.score
    cycleScore = cs != null && Number.isFinite(Number(cs)) ? Number(cs) : null
  }
  const rotation = buildSectorRotation({ panicData, cycleScore })

  /** @type {Record<string, number>} */
  const boosts = Object.fromEntries(SECTOR_RADAR_CATALOG.map((s) => [s.id, 52]))

  if (stageId && STAGE_SECTOR_POLICY[stageId]) {
    applyBoostMap(boosts, STAGE_SECTOR_POLICY[stageId].boosts)
  }
  applyBoostMap(boosts, REGIME_SECTOR_BOOSTS[regimeId] ?? {})

  const alertAdj = RADAR_ALERT_SECTOR[radarAlertId] ?? 0
  for (const id of Object.keys(boosts)) boosts[id] += alertAdj

  for (const row of phase6.patternSimilarity ?? []) {
    const patternBoost = PATTERN_SECTOR_BOOSTS[row.patternId]
    if (!patternBoost || row.similarity == null) continue
    const scale = Math.max(0, Math.min(1, row.similarity / 100))
    applyBoostMap(boosts, patternBoost, scale)
  }

  if (rotation.ready) {
    for (const def of SECTOR_RADAR_CATALOG) {
      if (!def.rotationId) continue
      const rot = rotation.sectors.find((s) => s.id === def.rotationId)
      if (!rot) continue
      const rotPts =
        rot.state === "watch" ? 14 : rot.state === "neutral" ? 4 : rot.state === "caution" ? -6 : -10
      boosts[def.id] = (boosts[def.id] ?? 52) + rotPts + rot.score * 2
    }
  }

  /** @type {{ id: string; label: string; score: number; rank: number; reasons: string[]; koreaSectorId?: string }[]} */
  const ranked = SECTOR_RADAR_CATALOG.map((def) => {
    const reasons = []
    if (stageId && STAGE_SECTOR_POLICY[stageId]?.boosts[def.id]) {
      reasons.push(`YDS ${stageMeta?.shortLabel ?? stageId}`)
    }
    if (REGIME_SECTOR_BOOSTS[regimeId]?.[def.id]) reasons.push(`국면 ${dashboard.cards.regime.label}`)
    if (topPattern?.patternId && PATTERN_SECTOR_BOOSTS[topPattern.patternId]?.[def.id]) {
      reasons.push(`패턴 ${topPattern.patternLabel}`)
    }
    if (rotation.ready && def.rotationId) {
      const rot = rotation.sectors.find((s) => s.id === def.rotationId)
      if (rot?.state === "watch") reasons.push("섹터 로테이션 관심")
    }
    return {
      id: def.id,
      label: def.label,
      score: clampScore(boosts[def.id] ?? 52),
      rank: 0,
      reasons: reasons.slice(0, 3),
      koreaSectorId: def.koreaSectorId,
    }
  })
    .sort((a, b) => b.score - a.score)
    .map((row, i) => ({ ...row, rank: i + 1 }))

  const topSectors = ranked.slice(0, 5)

  /** @type {Record<string, number>} */
  const weakBoosts = { consumer: 48, reits: 45 }
  if (stageId === "overheated") {
    weakBoosts.consumer -= 12
    weakBoosts.reits -= 14
  }
  if (regimeId === "stable" || regimeId === "transition") {
    weakBoosts.consumer += 4
  }
  if (regimeId === "risk" || regimeId === "panic") {
    weakBoosts.reits -= 8
    weakBoosts.consumer -= 6
  }
  if (rotation.ready && rotation.sectors.some((s) => s.id === "cash" && s.state === "watch")) {
    weakBoosts.consumer -= 6
    weakBoosts.reits -= 8
  }

  const weakSectors = SECTOR_RADAR_WEAK_CATALOG.map((def) => ({
    id: def.id,
    label: def.label,
    score: clampScore(weakBoosts[def.id] ?? 50),
  })).sort((a, b) => a.score - b.score)

  const strongLabels = ranked
    .filter((r) => r.score >= 68)
    .slice(0, 4)
    .map((r) => r.label)
  const weakLabels = weakSectors.map((w) => w.label)

  const stagePolicyTable = MACRO_V1_STATUS_BANDS.map((band) => {
    const meta = resolvePortfolioStageMeta(band.id)
    const policy = STAGE_SECTOR_POLICY[band.id]
    return {
      stageId: band.id,
      emoji: band.emoji,
      shortLabel: meta?.shortLabel ?? band.label,
      hint: policy?.hint ?? "—",
      active: stageId === band.id,
    }
  })

  return {
    label: PRECURSOR_ENGINE_PHASE25_LABEL,
    available: stage != null,
    asOf: dashboard.asOf,
    currentMarket: stageMeta
      ? {
          emoji: stageMeta.emoji,
          shortLabel: stageMeta.shortLabel,
          label: stageMeta.label,
          display: `${stageMeta.emoji} ${stageMeta.shortLabel}`,
        }
      : { emoji: "⚪", shortLabel: "—", label: "—", display: "—" },
    stagePolicy: stageId && STAGE_SECTOR_POLICY[stageId]
      ? {
          stageId,
          hint: STAGE_SECTOR_POLICY[stageId].hint,
          display: `${stageMeta?.emoji ?? ""} ${stageMeta?.shortLabel ?? ""} · ${STAGE_SECTOR_POLICY[stageId].hint}`.trim(),
        }
      : null,
    topSectors,
    sectorStatus: {
      strong: {
        emoji: "🔥",
        title: "강세",
        labels: strongLabels.length ? strongLabels : topSectors.slice(0, 3).map((s) => s.label),
      },
      weak: {
        emoji: "⚠️",
        title: "약세",
        labels: weakLabels,
      },
    },
    stagePolicyTable,
    pipeline: SECTOR_RADAR_PIPELINE,
    inputs: {
      ydsScore,
      regimeId,
      regimeLabel: dashboard.cards.regime.label,
      radarAlertId,
      rotationReady: rotation.ready,
      dominantPattern: topPattern?.patternLabel ?? null,
    },
    exportForStockRadar: {
      version: 1,
      asOf: dashboard.asOf,
      stageId,
      sectorIds: topSectors.map((s) => s.id),
      koreaSectorIds: topSectors.map((s) => s.koreaSectorId).filter(Boolean),
    },
    notes: [
      "Phase 12·6·10·23·buildSectorRotation 읽기 전용 집약",
      "프로덕션 Precursor·패닉 엔진 미수정",
      "exportForStockRadar → 향후 종목 Radar 입력 스키마",
    ],
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null; extraRows?: object[] }} [options]
 */
export function buildPrecursorEnginePhase25Report(events, options = {}) {
  const engineOptions = {
    latestSnapshot: options.latestSnapshot ?? null,
    extraRows: options.extraRows ?? [],
    log: loadPrecursorValidationLog(),
  }
  const dashboard = buildPrecursorDashboardBetaReport(events, engineOptions)
  const phase6 = buildPrecursorEnginePhase6Report(events, engineOptions)
  return buildSectorRadarFromPrecursorContext({
    dashboard,
    phase6,
    latestSnapshot: options.latestSnapshot ?? null,
  })
}

export function formatSectorRadarScore(value) {
  if (value == null || !Number.isFinite(value)) return "—"
  return formatMetric(value, 0)
}
