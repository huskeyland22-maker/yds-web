/**
 * 패닉 → 코리아 밸류체인 섹터 URL · 종목 프리뷰
 */

/** @type {Record<string, string>} */
export const SECTOR_QUERY_ALIASES = {
  ai: "ai-semiconductor",
  semiconductor: "ai-semiconductor",
  "ai-semiconductor": "ai-semiconductor",
  power: "power-infra",
  "power-infra": "power-infra",
  robot: "robot-automation",
  "robot-automation": "robot-automation",
  ship: "shipbuilding",
  shipbuilding: "shipbuilding",
  bio: "bio-healthcare",
  "bio-healthcare": "bio-healthcare",
  battery: "battery-materials",
  "battery-materials": "battery-materials",
  defense: "defense-space",
  "defense-space": "defense-space",
  nuclear: "nuclear-energy",
  "nuclear-energy": "nuclear-energy",
}

/** @type {Record<string, { name: string; code: string }[]>} */
export const SECTOR_FLOW_STOCKS = {
  "ai-semiconductor": [
    { name: "SK하이닉스", code: "000660" },
    { name: "삼성전자", code: "005930" },
    { name: "한미반도체", code: "042700" },
    { name: "리노공업", code: "058470" },
  ],
  "power-infra": [
    { name: "효성중공업", code: "298040" },
    { name: "LS ELECTRIC", code: "010120" },
  ],
  shipbuilding: [
    { name: "HD현대중공업", code: "329180" },
    { name: "한화오션", code: "042660" },
  ],
  "robot-automation": [
    { name: "레인보우로보틱스", code: "277810" },
    { name: "두산로보틱스", code: "454910" },
  ],
  "bio-healthcare": [
    { name: "삼성바이오로직스", code: "207940" },
    { name: "셀트리온", code: "068270" },
  ],
  "battery-materials": [
    { name: "LG에너지솔루션", code: "373220" },
    { name: "포스코퓨처엠", code: "003670" },
  ],
  "defense-space": [
    { name: "한화에어로스페이스", code: "012450" },
    { name: "LIG넥스원", code: "079550" },
  ],
}

/** URL 쿼리용 짧은 키 */
export const SECTOR_TO_QUERY_KEY = {
  "ai-semiconductor": "ai",
  "power-infra": "power",
  "robot-automation": "robot",
  shipbuilding: "ship",
  "bio-healthcare": "bio",
  "battery-materials": "battery",
  "defense-space": "defense",
  "nuclear-energy": "nuclear",
}

/**
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
export function resolveGrowthSectorIdFromQuery(raw) {
  if (!raw || typeof raw !== "string") return null
  const key = raw.trim().toLowerCase()
  return SECTOR_QUERY_ALIASES[key] ?? null
}

/**
 * @param {string} sectorId
 * @param {{ stockCode?: string }} [opts]
 */
export function buildValueChainSectorUrl(sectorId, opts = {}) {
  const queryKey = SECTOR_TO_QUERY_KEY[sectorId] ?? sectorId
  const params = new URLSearchParams()
  params.set("sector", queryKey)
  if (opts.stockCode) params.set("code", String(opts.stockCode))
  return `/value-chain?${params.toString()}`
}

/** @param {string} sectorId */
export function sectorFlowStocks(sectorId) {
  return SECTOR_FLOW_STOCKS[sectorId] ?? []
}
