import { formatMetric } from "./ydsHistoricalEventTypes.js"
import { buildPrecursorDashboardBetaReport } from "./ydsPrecursorEnginePhase12.js"
import { buildPrecursorEnginePhase6Report } from "./ydsPrecursorEnginePhase6.js"
import { buildSectorRadarFromPrecursorContext } from "./ydsPrecursorEnginePhase25.js"
import { loadPrecursorValidationLog } from "./ydsPrecursorValidationLogStorage.js"
import {
  getTradingZonePositions,
  TRADING_STAGE_META,
} from "./tacticalTradingZoneData.js"

export const PRECURSOR_ENGINE_PHASE26_LABEL = "Stock Radar — Phase 26"

export const STOCK_RADAR_SCORE_WEIGHTS = {
  marketFit: 0.4,
  sectorStrength: 0.25,
  technicalTrend: 0.2,
  volume: 0.15,
}

/** @typedef {'us' | 'kr'} StockRadarMarketId */
/** @typedef {'semi' | 'ai' | 'power' | 'defense' | 'robot' | 'cosmetics'} StockRadarFilterId */
/** @typedef {'strong' | 'dip' | 'breakout' | 'watch'} StockRadarStatusId */

export const STOCK_RADAR_STATUS = {
  strong: { id: "strong", emoji: "🔥", label: "강세" },
  dip: { id: "dip", emoji: "⚠️", label: "눌림" },
  breakout: { id: "breakout", emoji: "🚀", label: "돌파" },
  watch: { id: "watch", emoji: "❄️", label: "관찰" },
}

/** @type {{ market: StockRadarMarketId; filters: { id: StockRadarFilterId; label: string }[] }} */
export const STOCK_RADAR_MARKET_FILTERS = {
  us: {
    market: "us",
    filters: [
      { id: "semi", label: "반도체" },
      { id: "ai", label: "AI" },
      { id: "power", label: "전력" },
      { id: "defense", label: "방산" },
    ],
  },
  kr: {
    market: "kr",
    filters: [
      { id: "semi", label: "반도체" },
      { id: "power", label: "전력" },
      { id: "robot", label: "로봇" },
      { id: "cosmetics", label: "화장품" },
      { id: "ai", label: "AI" },
    ],
  },
}

/** 향후 자동 종목 업데이트 · 매매 후보 · 트레이딩 로그 연결 */
export const STOCK_RADAR_PIPELINE = [
  {
    id: "stock-radar",
    label: "Stock Radar",
    status: "active",
    outputKey: "topBuys",
  },
  {
    id: "trade-candidates",
    label: "매매 후보",
    status: "active",
    consumes: "stockRadar.topBuys",
    outputKey: "candidates",
  },
  {
    id: "trading-log",
    label: "트레이딩 로그",
    status: "planned",
    consumes: "tradeCandidates.executed",
  },
  {
    id: "returns-disclosure",
    label: "실제 수익 공개",
    status: "planned",
    consumes: "tradingLog.returns",
  },
]

/**
 * @typedef {{
 *   id: string
 *   name: string
 *   symbol: string
 *   code?: string
 *   market: StockRadarMarketId
 *   filterTags: StockRadarFilterId[]
 *   sectorRadarId: string
 *   tier: number
 * }} StockRadarUniverseEntry
 */

/** @type {StockRadarUniverseEntry[]} */
export const STOCK_RADAR_UNIVERSE = [
  { id: "us-nvda", name: "엔비디아", symbol: "NVDA", market: "us", filterTags: ["semi", "ai"], sectorRadarId: "semi", tier: 5 },
  { id: "us-avgo", name: "브로드컴", symbol: "AVGO", market: "us", filterTags: ["semi", "ai"], sectorRadarId: "semi", tier: 5 },
  { id: "us-amd", name: "AMD", symbol: "AMD", market: "us", filterTags: ["semi"], sectorRadarId: "semi", tier: 4 },
  { id: "us-smh", name: "반도체 ETF", symbol: "SMH", market: "us", filterTags: ["semi"], sectorRadarId: "semi", tier: 3 },
  { id: "us-meta", name: "메타", symbol: "META", market: "us", filterTags: ["ai"], sectorRadarId: "physicalAi", tier: 4 },
  { id: "us-pltr", name: "팔란티어", symbol: "PLTR", market: "us", filterTags: ["ai"], sectorRadarId: "physicalAi", tier: 4 },
  { id: "us-tsm", name: "TSMC", symbol: "TSM", market: "us", filterTags: ["semi"], sectorRadarId: "semi", tier: 4 },
  { id: "us-vrt", name: "버티브", symbol: "VRT", market: "us", filterTags: ["power"], sectorRadarId: "power", tier: 3 },
  { id: "us-etn", name: "이튼", symbol: "ETN", market: "us", filterTags: ["power"], sectorRadarId: "power", tier: 3 },
  { id: "us-lmt", name: "록히드", symbol: "LMT", market: "us", filterTags: ["defense"], sectorRadarId: "defense", tier: 3 },
  { id: "us-rtx", name: "RTX", symbol: "RTX", market: "us", filterTags: ["defense"], sectorRadarId: "defense", tier: 3 },
  { id: "kr-hynix", name: "SK하이닉스", symbol: "000660", code: "000660", market: "kr", filterTags: ["semi", "ai"], sectorRadarId: "semi", tier: 5 },
  { id: "kr-sec", name: "삼성전자", symbol: "005930", code: "005930", market: "kr", filterTags: ["semi"], sectorRadarId: "semi", tier: 5 },
  { id: "kr-techwing", name: "테크윙", symbol: "089030", code: "089030", market: "kr", filterTags: ["semi"], sectorRadarId: "semi", tier: 5 },
  { id: "kr-hanmi", name: "한미반도체", symbol: "042700", code: "042700", market: "kr", filterTags: ["semi"], sectorRadarId: "semi", tier: 4 },
  { id: "kr-rino", name: "리노공업", symbol: "058470", code: "058470", market: "kr", filterTags: ["semi"], sectorRadarId: "semi", tier: 4 },
  { id: "kr-silicon", name: "실리콘투", symbol: "257720", code: "257720", market: "kr", filterTags: ["semi", "cosmetics"], sectorRadarId: "semi", tier: 5 },
  { id: "kr-hde", name: "HD현대일렉트릭", symbol: "267260", code: "267260", market: "kr", filterTags: ["power"], sectorRadarId: "power", tier: 4 },
  { id: "kr-ls", name: "LS ELECTRIC", symbol: "010120", code: "010120", market: "kr", filterTags: ["power"], sectorRadarId: "power", tier: 4 },
  { id: "kr-hyosung", name: "효성중공업", symbol: "298040", code: "298040", market: "kr", filterTags: ["power"], sectorRadarId: "power", tier: 4 },
  { id: "kr-spg", name: "에스피지", symbol: "058610", code: "058610", market: "kr", filterTags: ["robot"], sectorRadarId: "physicalAi", tier: 5 },
  { id: "kr-rainbow", name: "레인보우로보틱스", symbol: "277810", code: "277810", market: "kr", filterTags: ["robot", "ai"], sectorRadarId: "physicalAi", tier: 4 },
  { id: "kr-doosan", name: "두산로보틱스", symbol: "454910", code: "454910", market: "kr", filterTags: ["robot"], sectorRadarId: "physicalAi", tier: 4 },
  { id: "kr-lgcns", name: "LG CNS", symbol: "064400", code: "064400", market: "kr", filterTags: ["ai"], sectorRadarId: "physicalAi", tier: 3 },
  { id: "kr-hanwha", name: "한화에어로스페이스", symbol: "012450", code: "012450", market: "kr", filterTags: ["defense"], sectorRadarId: "defense", tier: 4 },
  { id: "kr-lig", name: "LIG넥스원", symbol: "079550", code: "079550", market: "kr", filterTags: ["defense"], sectorRadarId: "defense", tier: 3 },
]

/** @type {Record<string, number>} */
const RADAR_ALERT_MARKET = {
  normal: 8,
  caution: 2,
  danger: -6,
  critical: -12,
}

/** @type {Record<string, number>} */
const REGIME_MARKET = {
  stable: 10,
  transition: 6,
  risk: -4,
  panic: 2,
  unknown: 0,
}

/** @type {Record<string, number>} */
const STAGE_MARKET = {
  overheated: -6,
  neutral: 10,
  interest: 6,
  dca: 12,
  panicBuy: 14,
}

/** @type {Record<string, number>} */
const TRADING_STAGE_TECH = {
  trend: 88,
  pullback: 72,
  interest: 58,
  takeProfit: 52,
  risk: 38,
}

/**
 * @param {number} raw
 */
function clampScore(raw) {
  return Math.max(42, Math.min(98, Math.round(raw)))
}

/**
 * @param {string} seed
 */
function seededNoise(seed) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return (Math.abs(h) % 13) - 6
}

/**
 * @param {{
 *   totalScore: number
 *   tradingStage?: string | null
 *   stageId?: string | null
 *   sectorRank: number
 * }} input
 * @returns {typeof STOCK_RADAR_STATUS[keyof typeof STOCK_RADAR_STATUS]}
 */
function resolveStockStatus(input) {
  const { totalScore, tradingStage, stageId, sectorRank } = input
  if (tradingStage === "trend" && totalScore >= 82) return STOCK_RADAR_STATUS.breakout
  if (tradingStage === "pullback" || stageId === "dca" || stageId === "panicBuy") {
    if (sectorRank <= 3 && totalScore >= 70) return STOCK_RADAR_STATUS.dip
  }
  if (totalScore >= 78 && sectorRank <= 2) return STOCK_RADAR_STATUS.strong
  if (totalScore >= 74) return STOCK_RADAR_STATUS.strong
  return STOCK_RADAR_STATUS.watch
}

/**
 * @param {ReturnType<typeof buildSectorRadarFromPrecursorContext>} sectorRadar
 */
function sectorScoreById(sectorRadar) {
  /** @type {Map<string, { score: number; rank: number }>} */
  const map = new Map()
  for (const s of sectorRadar.topSectors ?? []) {
    map.set(s.id, { score: s.score, rank: s.rank })
  }
  return map
}

/**
 * @param {ReturnType<typeof buildSectorRadarFromPrecursorContext>} sectorRadar
 * @returns {Set<string>}
 */
function activeSectorIds(sectorRadar) {
  const ids = new Set((sectorRadar.topSectors ?? []).map((s) => s.id))
  if (ids.has("physicalAi")) {
    ids.add("semi")
  }
  return ids
}

/**
 * @param {{
 *   dashboard: ReturnType<typeof buildPrecursorDashboardBetaReport>
 *   phase6: ReturnType<typeof buildPrecursorEnginePhase6Report>
 *   sectorRadar: ReturnType<typeof buildSectorRadarFromPrecursorContext>
 * }} ctx
 */
export function buildStockRadarFromPrecursorContext(ctx) {
  const { dashboard, phase6, sectorRadar } = ctx
  const ydsScore = dashboard.cards.yds.value
  const stageId = sectorRadar.exportForStockRadar?.stageId ?? null
  const regimeId = dashboard.cards.regime.regimeId ?? "unknown"
  const radarAlertId = phase6.radarAlert?.id ?? "normal"
  const priA = dashboard.cards.priA.value ?? 0
  const priB = dashboard.cards.priB.value ?? 0
  const topPattern = phase6.top3[0] ?? null

  const sectorMap = sectorScoreById(sectorRadar)
  const activeSectors = activeSectorIds(sectorRadar)

  const positions = getTradingZonePositions()
  /** @type {Map<string, import("./tacticalTradingZoneData.js").TradingZonePosition>} */
  const posBySymbol = new Map()
  for (const p of positions) {
    posBySymbol.set(p.symbol, p)
    if (p.symbol.length <= 6) posBySymbol.set(p.symbol.toUpperCase(), p)
  }

  const marketBase =
    52 +
    (STAGE_MARKET[/** @type {string} */ (stageId)] ?? 0) +
    (REGIME_MARKET[regimeId] ?? 0) +
    (RADAR_ALERT_MARKET[radarAlertId] ?? 0) +
    (ydsScore != null && ydsScore >= 60 ? 4 : 0) +
    (priA >= 40 ? -3 : 2) +
    (priB >= 45 ? -2 : 3)

  /** @type {typeof STOCK_RADAR_UNIVERSE[number][]} */
  const pool = STOCK_RADAR_UNIVERSE.filter((stock) => activeSectors.has(stock.sectorRadarId))

  const scored = pool.map((stock) => {
    const sectorRow = sectorMap.get(stock.sectorRadarId)
    const sectorRank = sectorRow?.rank ?? 8
    const sectorPts = sectorRow?.score ?? 50

    const pos = posBySymbol.get(stock.name) ?? posBySymbol.get(stock.symbol) ?? null
    const tradingStage = pos?.stage ?? null

    const marketFit = clampScore(marketBase + stock.tier * 2 + seededNoise(stock.id))
    const sectorStrength = clampScore(
      sectorPts * 0.65 + Math.max(0, (6 - sectorRank) * 5) + stock.tier * 2,
    )
    const technicalTrend = clampScore(
      (tradingStage ? TRADING_STAGE_TECH[tradingStage] ?? 60 : 58) +
        (topPattern?.similarity && topPattern.similarity >= 60 ? 4 : 0) +
        seededNoise(`${stock.id}-tech`),
    )
    const volume = clampScore(
      62 +
        (priB < 35 ? 8 : priB > 50 ? -6 : 0) +
        (tradingStage === "trend" ? 10 : tradingStage === "pullback" ? 4 : 0) +
        seededNoise(`${stock.id}-vol`),
    )

    const totalScore = clampScore(
      marketFit * STOCK_RADAR_SCORE_WEIGHTS.marketFit +
        sectorStrength * STOCK_RADAR_SCORE_WEIGHTS.sectorStrength +
        technicalTrend * STOCK_RADAR_SCORE_WEIGHTS.technicalTrend +
        volume * STOCK_RADAR_SCORE_WEIGHTS.volume,
    )

    const status = resolveStockStatus({
      totalScore,
      tradingStage,
      stageId,
      sectorRank,
    })

    return {
      id: stock.id,
      name: stock.name,
      symbol: stock.symbol,
      code: stock.code ?? null,
      market: stock.market,
      marketLabel: stock.market === "us" ? "미국" : "한국",
      filterTags: stock.filterTags,
      sectorRadarId: stock.sectorRadarId,
      rank: 0,
      score: totalScore,
      status: {
        id: status.id,
        emoji: status.emoji,
        label: status.label,
        display: `${status.emoji} ${status.label}`,
      },
      scoreBreakdown: {
        marketFit,
        sectorStrength,
        technicalTrend,
        volume,
        weights: STOCK_RADAR_SCORE_WEIGHTS,
      },
      tradingStage: tradingStage
        ? (TRADING_STAGE_META[/** @type {keyof typeof TRADING_STAGE_META} */ (tradingStage)]?.label ??
          tradingStage)
        : null,
      reasons: [
        sectorRow ? `섹터 ${sectorRank}위` : null,
        stageId ? `YDS ${sectorRadar.currentMarket.shortLabel}` : null,
        topPattern?.patternLabel ? `패턴 ${topPattern.patternLabel}` : null,
      ].filter(Boolean),
    }
  })

  const ranked = scored
    .sort((a, b) => b.score - a.score)
    .map((row, i) => ({ ...row, rank: i + 1 }))

  const topBuys = ranked.slice(0, 10)

  const byMarket = {
    us: ranked.filter((r) => r.market === "us").slice(0, 10),
    kr: ranked.filter((r) => r.market === "kr").slice(0, 10),
  }

  return {
    label: PRECURSOR_ENGINE_PHASE26_LABEL,
    available: sectorRadar.available && topBuys.length > 0,
    asOf: sectorRadar.asOf ?? dashboard.asOf,
    scoreWeights: STOCK_RADAR_SCORE_WEIGHTS,
    scoreWeightsDisplay: "시장 적합도 40% · 섹터 강도 25% · 기술적 추세 20% · 거래량 15%",
    marketFilters: STOCK_RADAR_MARKET_FILTERS,
    topBuys,
    byMarket,
    pipeline: STOCK_RADAR_PIPELINE,
    inputs: {
      ydsScore,
      ydsDisplay: dashboard.cards.yds.display,
      priA: dashboard.cards.priA.value,
      priB: dashboard.cards.priB.value,
      priADisplay: dashboard.cards.priA.display,
      priBDisplay: dashboard.cards.priB.display,
      regimeId,
      regimeLabel: dashboard.cards.regime.label,
      radarAlertId,
      radarAlertLabel: phase6.radarAlert?.label ?? "—",
      dominantPattern: topPattern?.patternLabel ?? null,
      sectorRadarExport: sectorRadar.exportForStockRadar,
    },
    exportForTradeCandidates: {
      version: 1,
      asOf: sectorRadar.asOf ?? dashboard.asOf,
      stageId,
      picks: topBuys.map((s) => ({
        id: s.id,
        name: s.name,
        symbol: s.symbol,
        code: s.code,
        market: s.market,
        score: s.score,
        statusId: s.status.id,
        sectorRadarId: s.sectorRadarId,
      })),
    },
    notes: [
      "Sector Radar(Phase 25) + Phase 12·6 읽기 전용 · YDS 엔진 미수정",
      "exportForTradeCandidates → 향후 매매 후보·트레이딩 로그 입력",
      "종목 유니버스는 STOCK_RADAR_UNIVERSE에서 버전 관리·자동 갱신 가능",
    ],
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null; extraRows?: object[] }} [options]
 */
export function buildPrecursorEnginePhase26Report(events, options = {}) {
  const engineOptions = {
    latestSnapshot: options.latestSnapshot ?? null,
    extraRows: options.extraRows ?? [],
    log: loadPrecursorValidationLog(),
  }
  const dashboard = buildPrecursorDashboardBetaReport(events, engineOptions)
  const phase6 = buildPrecursorEnginePhase6Report(events, engineOptions)
  const sectorRadar = buildSectorRadarFromPrecursorContext({
    dashboard,
    phase6,
    latestSnapshot: options.latestSnapshot ?? null,
  })
  return buildStockRadarFromPrecursorContext({ dashboard, phase6, sectorRadar })
}

export function formatStockRadarScore(value) {
  if (value == null || !Number.isFinite(value)) return "—"
  return formatMetric(value, 0)
}
