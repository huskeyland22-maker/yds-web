/**
 * 추천 종목 섹터 집중도 — 상위 추천 테마 비중·등급
 */

/** @typedef {import("./ydsStockPickModel.js").StockPickView} StockPickView */

/** @typedef {'healthy' | 'caution' | 'overheat'} SectorConcentrationGradeId */

/**
 * @typedef {{
 *   sector: string
 *   count: number
 *   pct: number
 * }} SectorWeight
 */

/**
 * @typedef {{
 *   id: SectorConcentrationGradeId
 *   label: string
 *   tone: string
 * }} SectorConcentrationGrade
 */

/**
 * @typedef {{
 *   total: number
 *   weights: SectorWeight[]
 *   topSector: string | null
 *   topPct: number
 *   grade: SectorConcentrationGrade
 *   summary: string
 * }} SectorConcentrationView
 */

/** @type {Record<string, string>} */
const THEME_TO_SECTOR = {
  반도체: "반도체",
  HBM: "반도체",
  "반도체 장비": "반도체",
  AI: "AI",
  전력: "전력",
  변압기: "전력",
  원전: "원전",
  냉각: "냉각",
  광통신: "광통신",
  방산: "방산",
  로봇: "로봇",
  인프라: "인프라",
}

/** @type {Record<string, string>} */
const SECTOR_ID_TO_LABEL = {
  semi: "반도체",
  ai: "AI",
  power: "전력",
  nuclear: "원전",
  defense: "방산",
  robot: "로봇",
  infra: "인프라",
}

/**
 * @param {StockPickView} stock
 * @returns {string}
 */
export function classifyStockSectorGroup(stock) {
  const themes = stock.investThemes ?? []
  for (const theme of themes) {
    const mapped = THEME_TO_SECTOR[theme]
    if (mapped) return mapped
  }

  const sectorId = String(stock.sector ?? "").toLowerCase()
  if (SECTOR_ID_TO_LABEL[sectorId]) return SECTOR_ID_TO_LABEL[sectorId]

  return "기타"
}

/**
 * @param {number} topPct
 * @param {number} top2Pct
 * @returns {SectorConcentrationGrade}
 */
function resolveConcentrationGrade(topPct, top2Pct) {
  if (topPct >= 50 || top2Pct >= 75) {
    return { id: "overheat", label: "과열", tone: "red" }
  }
  if (topPct >= 35 || top2Pct >= 60) {
    return { id: "caution", label: "주의", tone: "amber" }
  }
  return { id: "healthy", label: "양호", tone: "green" }
}

/**
 * @param {StockPickView[]} stocks
 * @param {number} [limit]
 * @returns {SectorConcentrationView | null}
 */
export function buildSectorConcentration(stocks, limit = 10) {
  const pool = stocks.filter((s) => s.dataSource === "live").slice(0, limit)
  if (!pool.length) return null

  /** @type {Record<string, number>} */
  const counts = {}
  for (const stock of pool) {
    const group = classifyStockSectorGroup(stock)
    counts[group] = (counts[group] ?? 0) + 1
  }

  const total = pool.length
  const weights = Object.entries(counts)
    .map(([sector, count]) => ({
      sector,
      count,
      pct: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.pct - a.pct || b.count - a.count)

  const top = weights[0] ?? null
  const second = weights[1] ?? null
  const top2Pct = (top?.pct ?? 0) + (second?.pct ?? 0)
  const grade = resolveConcentrationGrade(top?.pct ?? 0, top2Pct)

  const parts = weights.slice(0, 4).map((w) => `${w.sector} ${w.pct}%`)
  const restPct = 100 - weights.slice(0, 4).reduce((s, w) => s + w.pct, 0)
  if (restPct > 0 && weights.length > 4) parts.push(`기타 ${restPct}%`)

  return {
    total,
    weights,
    topSector: top?.sector ?? null,
    topPct: top?.pct ?? 0,
    grade,
    summary: parts.join(" · "),
  }
}
