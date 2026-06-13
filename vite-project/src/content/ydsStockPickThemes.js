/**
 * 종목추천 투자 테마 배지
 */

/** @type {Record<string, string[]>} */
export const STOCK_PICK_THEMES_BY_TICKER = {
  NVDA: ["AI"],
  AVGO: ["AI", "반도체"],
  META: ["AI"],
  TSM: ["반도체"],
  GEV: ["전력"],
  "012450": ["방산"],
  PLTR: ["AI"],
  "298040": ["전력", "변압기"],
  MSFT: ["AI"],
  "010120": ["전력"],
  NFLX: ["AI"],
  "267260": ["전력", "변압기"],
  AMD: ["AI", "반도체"],
  AMZN: ["AI"],
  "000660": ["HBM", "반도체"],
  GOOGL: ["AI"],
  "064350": ["방산"],
  VRT: ["전력", "AI"],
  "005930": ["HBM", "반도체"],
  "042700": ["반도체 장비"],
  CEG: ["원전", "전력"],
  "034020": ["원전"],
  LMT: ["방산"],
  CRM: ["AI"],
  "089030": ["HBM", "반도체 장비"],
  ETN: ["전력", "변압기"],
  RTX: ["방산"],
  "058470": ["반도체 장비"],
  VST: ["원전", "전력"],
  "277810": ["로봇"],
  "058610": ["로봇"],
  "454910": ["로봇"],
  ISRG: ["로봇"],
  "052690": ["원전"],
  "079550": ["방산"],
  CAT: ["인프라"],
  UNP: ["인프라"],
  "375500": ["인프라"],
  "028260": ["인프라"],
  "257720": ["반도체"],
  INTC: ["반도체"],
  MU: ["HBM", "반도체"],
  SMCI: ["AI"],
  PWR: ["전력", "인프라"],
  DE: ["인프라"],
  "005380": ["인프라"],
  "000270": ["인프라"],
  "042660": ["방산"],
  "009540": ["방산"],
}

/** @type {Record<string, string[]>} */
export const STOCK_PICK_THEMES_BY_SECTOR = {
  ai: ["AI"],
  power: ["전력"],
  defense: ["방산"],
  semi: ["반도체"],
  robot: ["로봇"],
  nuclear: ["원전"],
  infra: ["인프라"],
}

/**
 * @param {{ ticker?: string; sector?: string; comment?: string }} stock
 * @returns {string[]}
 */
export function resolveStockPickThemes(stock) {
  const ticker = String(stock?.ticker ?? "").toUpperCase()
  const fromTicker = STOCK_PICK_THEMES_BY_TICKER[ticker]
  if (fromTicker?.length) return fromTicker

  const sector = stock?.sector
  const fromSector = sector ? STOCK_PICK_THEMES_BY_SECTOR[sector] : null
  if (fromSector?.length) return fromSector

  return sector ? [sector] : []
}
