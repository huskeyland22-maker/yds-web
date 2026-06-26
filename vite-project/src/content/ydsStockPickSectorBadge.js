/**
 * 추천종목 카드 — 종목명 아래 단일 섹터 배지
 */

/** @type {Record<string, string>} */
const SECTOR_BADGE_LABELS = {
  AI: "AI",
  HBM: "Semiconductor",
  반도체: "Semiconductor",
  "반도체 장비": "Semiconductor",
  전력: "Power",
  변압기: "Power",
  원전: "Power",
  방산: "Defense",
  로봇: "Robotics",
  인프라: "Infra",
  빅테크: "Big Tech",
  소비주: "Consumer",
}

/**
 * @param {{ investThemes?: string[]; sectorLabel?: string; sector?: string }} stock
 * @returns {string | null}
 */
export function resolveStockPickSectorBadge(stock) {
  const theme = stock.investThemes?.[0]
  if (theme) {
    const primary = String(theme).split("·")[0].trim()
    return SECTOR_BADGE_LABELS[primary] ?? primary
  }

  const sector = stock.sectorLabel ?? stock.sector
  if (!sector) return null
  return SECTOR_BADGE_LABELS[sector] ?? sector
}
