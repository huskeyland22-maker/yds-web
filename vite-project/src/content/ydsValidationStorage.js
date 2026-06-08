/**
 * Phase 7 — YDS 검증 레이어 저장소
 */

export const VALIDATION_PICKS_KEY = "yds-validation-picks-v1"
export const VALIDATION_PORTFOLIO_KEY = "yds-validation-portfolio-v1"

const MAX_PICKS = 400
const MAX_PORTFOLIO_SNAPSHOTS = 120

/**
 * @typedef {{
 *   id: string
 *   ticker: string
 *   name: string
 *   country: 'US' | 'KR'
 *   rank: number
 *   recommendedAt: string
 *   recommendedPrice: number
 *   currentPrice: number | null
 *   returnPct: number | null
 *   regimeId: string
 *   regimeLabel: string
 *   strategyLabel: string
 *   recordedAt: number
 *   lastUpdatedAt: number
 * }} ValidationPickRecord
 */

/**
 * @typedef {{
 *   date: string
 *   totalAssets: number
 *   totalPnl: number
 *   totalReturnPct: number | null
 *   cashPct: number
 *   realizedPnl: number
 *   unrealizedPnl: number
 *   recordedAt: number
 * }} ValidationPortfolioSnapshot
 */

/** @returns {ValidationPickRecord[]} */
export function loadValidationPicks() {
  try {
    const raw = localStorage.getItem(VALIDATION_PICKS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((r) => r && typeof r.id === "string")
  } catch {
    return []
  }
}

/** @param {ValidationPickRecord[]} picks */
export function saveValidationPicks(picks) {
  try {
    const trimmed = picks.slice(-MAX_PICKS)
    localStorage.setItem(VALIDATION_PICKS_KEY, JSON.stringify(trimmed))
  } catch {
    /* ignore */
  }
}

/** @returns {ValidationPortfolioSnapshot[]} */
export function loadValidationPortfolioSnapshots() {
  try {
    const raw = localStorage.getItem(VALIDATION_PORTFOLIO_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((s) => s && typeof s.date === "string")
  } catch {
    return []
  }
}

/** @param {ValidationPortfolioSnapshot[]} snapshots */
export function saveValidationPortfolioSnapshots(snapshots) {
  try {
    const trimmed = snapshots.slice(-MAX_PORTFOLIO_SNAPSHOTS)
    localStorage.setItem(VALIDATION_PORTFOLIO_KEY, JSON.stringify(trimmed))
  } catch {
    /* ignore */
  }
}
