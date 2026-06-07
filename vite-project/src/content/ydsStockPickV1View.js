/**
 * YDS Phase 2-1 — 종목추천 UI (표시 전용 · 평가 로직 없음)
 */

/** @typedef {'trend' | 'dip' | 'interest' | 'overheat'} StockPickStatusId */
/** @typedef {'ai' | 'power' | 'defense' | 'semi' | 'robot'} StockPickSectorId */

export const STOCK_PICK_V1_STATUS = {
  trend: { id: "trend", emoji: "🟢", label: "추세" },
  dip: { id: "dip", emoji: "🟡", label: "눌림" },
  interest: { id: "interest", emoji: "🟠", label: "관심" },
  overheat: { id: "overheat", emoji: "🔴", label: "과열" },
}

export const STOCK_PICK_STAR_TIERS = {
  5: { stars: "★★★★★", label: "최우선" },
  4: { stars: "★★★★☆", label: "" },
  3: { stars: "★★★☆☆", label: "" },
}

export const STOCK_PICK_SECTOR_GROUPS = [
  { id: "ai", label: "AI" },
  { id: "power", label: "전력" },
  { id: "defense", label: "방산" },
  { id: "semi", label: "반도체" },
  { id: "robot", label: "로봇" },
]

/**
 * @typedef {{
 *   id: string
 *   name: string
 *   starTier: 3 | 4 | 5
 *   stars: string
 *   status: typeof STOCK_PICK_V1_STATUS[keyof typeof STOCK_PICK_V1_STATUS]
 *   sectorId: StockPickSectorId
 * }} StockPickUiEntry
 */

/** @type {StockPickUiEntry[]} */
const STOCK_PICK_UI_CATALOG = [
  { id: "us-nvda", name: "엔비디아", starTier: 5, stars: STOCK_PICK_STAR_TIERS[5].stars, status: STOCK_PICK_V1_STATUS.trend, sectorId: "ai" },
  { id: "us-avgo", name: "브로드컴", starTier: 5, stars: STOCK_PICK_STAR_TIERS[5].stars, status: STOCK_PICK_V1_STATUS.trend, sectorId: "semi" },
  { id: "us-tsm", name: "TSMC", starTier: 5, stars: STOCK_PICK_STAR_TIERS[5].stars, status: STOCK_PICK_V1_STATUS.interest, sectorId: "semi" },
  { id: "us-gev", name: "GE Vernova", starTier: 4, stars: STOCK_PICK_STAR_TIERS[4].stars, status: STOCK_PICK_V1_STATUS.interest, sectorId: "power" },
  { id: "kr-ls", name: "LS ELECTRIC", starTier: 4, stars: STOCK_PICK_STAR_TIERS[4].stars, status: STOCK_PICK_V1_STATUS.trend, sectorId: "power" },
  { id: "kr-hyosung", name: "효성중공업", starTier: 4, stars: STOCK_PICK_STAR_TIERS[4].stars, status: STOCK_PICK_V1_STATUS.dip, sectorId: "power" },
  { id: "kr-techwing", name: "테크윙", starTier: 3, stars: STOCK_PICK_STAR_TIERS[3].stars, status: STOCK_PICK_V1_STATUS.dip, sectorId: "semi" },
  { id: "kr-spg", name: "에스피지", starTier: 3, stars: STOCK_PICK_STAR_TIERS[3].stars, status: STOCK_PICK_V1_STATUS.interest, sectorId: "robot" },
  { id: "kr-silicon", name: "실리콘투", starTier: 3, stars: STOCK_PICK_STAR_TIERS[3].stars, status: STOCK_PICK_V1_STATUS.overheat, sectorId: "semi" },
  { id: "us-meta", name: "메타", starTier: 4, stars: STOCK_PICK_STAR_TIERS[4].stars, status: STOCK_PICK_V1_STATUS.trend, sectorId: "ai" },
  { id: "us-pltr", name: "팔란티어", starTier: 4, stars: STOCK_PICK_STAR_TIERS[4].stars, status: STOCK_PICK_V1_STATUS.interest, sectorId: "ai" },
  { id: "us-lmt", name: "록히드", starTier: 3, stars: STOCK_PICK_STAR_TIERS[3].stars, status: STOCK_PICK_V1_STATUS.trend, sectorId: "defense" },
  { id: "kr-hanwha", name: "한화에어로", starTier: 4, stars: STOCK_PICK_STAR_TIERS[4].stars, status: STOCK_PICK_V1_STATUS.trend, sectorId: "defense" },
  { id: "kr-rainbow", name: "레인보우로보틱스", starTier: 4, stars: STOCK_PICK_STAR_TIERS[4].stars, status: STOCK_PICK_V1_STATUS.interest, sectorId: "robot" },
]

/** @type {Record<number, string[]>} */
const TODAY_PICK_IDS = {
  5: ["us-nvda", "us-avgo", "us-tsm"],
  4: ["us-gev", "kr-ls", "kr-hyosung"],
  3: ["kr-techwing", "kr-spg", "kr-silicon"],
}

/** @type {Map<string, StockPickUiEntry>} */
const catalogById = new Map(STOCK_PICK_UI_CATALOG.map((entry) => [entry.id, entry]))

/**
 * Phase 2-1 UI 전용 — 자동 평가·시장 연동 없음
 * @returns {{
 *   starGroups: { tier: number; stars: string; label: string; picks: StockPickUiEntry[] }[]
 *   sectorGroups: { id: StockPickSectorId; label: string; picks: StockPickUiEntry[] }[]
 *   hasData: boolean
 * }}
 */
export function resolveStockPickV1View() {
  const starGroups = [5, 4, 3]
    .map((tier) => {
      const picks = (TODAY_PICK_IDS[tier] ?? [])
        .map((id) => catalogById.get(id))
        .filter(Boolean)
      if (!picks.length) return null
      return {
        tier,
        stars: STOCK_PICK_STAR_TIERS[tier].stars,
        label: STOCK_PICK_STAR_TIERS[tier].label,
        picks,
      }
    })
    .filter(Boolean)

  const sectorGroups = STOCK_PICK_SECTOR_GROUPS.map((sector) => ({
    ...sector,
    picks: STOCK_PICK_UI_CATALOG.filter((p) => p.sectorId === sector.id),
  })).filter((g) => g.picks.length > 0)

  return {
    starGroups,
    sectorGroups,
    hasData: starGroups.length > 0,
  }
}
