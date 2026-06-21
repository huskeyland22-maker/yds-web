/**
 * 포트폴리오 localStorage 키 레지스트리 — 모바일·PC 동일 키, 기기별 저장소 분리
 */

export const PORTFOLIO_TRADES_KEY = "yds-portfolio-trades-v1"

/** @type {readonly string[]} — V1 이후 공식 키 (모바일·PC 동일) */
export const PORTFOLIO_CANONICAL_KEYS = [
  "yds-portfolio-trades-v1",
  "yds-portfolio-manual-v1",
  "yds-portfolio-positions-v1",
  "yds-portfolio-cash-balance-v1",
]

/**
 * @type {readonly string[]}
 * 과거/오타 후보 — 코드베이스에 없었으나 기기에 남아 있을 수 있음
 */
export const PORTFOLIO_LEGACY_ALIAS_KEYS = [
  "portfolio_holdings",
  "yds_portfolio",
  "portfolio_v1",
  "yds-portfolio-v1",
  "yds-portfolio-holdings-v1",
]

/** @type {readonly string[]} — holdings 후보 (trades·positions 형식) */
export const PORTFOLIO_HOLDINGS_SOURCE_KEYS = [
  PORTFOLIO_TRADES_KEY,
  "yds-portfolio-manual-v1",
  "yds-portfolio-positions-v1",
  ...PORTFOLIO_LEGACY_ALIAS_KEYS,
]

const PORTFOLIO_KEY_PATTERN = /portfolio|yds-pf|holdings|yds_portfolio/i

/**
 * @param {string | null | undefined} raw
 * @returns {{ count: number | null, parseOk: boolean }}
 */
export function countPortfolioKeyItems(raw) {
  if (raw == null) return { count: null, parseOk: true }
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return { count: parsed.length, parseOk: true }
    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.trades)) return { count: parsed.trades.length, parseOk: true }
      if (Array.isArray(parsed.holdings)) return { count: parsed.holdings.length, parseOk: true }
      return { count: Object.keys(parsed).length, parseOk: true }
    }
    return { count: null, parseOk: true }
  } catch {
    return { count: null, parseOk: false }
  }
}

/**
 * @typedef {{ key: string, count: number | null, bytes: number, parseOk: boolean }} PortfolioKeySnapshot
 */

/** @returns {PortfolioKeySnapshot[]} */
export function scanLocalPortfolioKeys() {
  /** @type {Map<string, PortfolioKeySnapshot>} */
  const map = new Map()

  const register = (/** @type {string} */ key) => {
    if (!key || map.has(key)) return
    let raw = null
    try {
      raw = localStorage.getItem(key)
    } catch {
      raw = null
    }
    if (raw == null) return
    const { count, parseOk } = countPortfolioKeyItems(raw)
    map.set(key, { key, count, bytes: raw.length, parseOk })
  }

  for (const key of PORTFOLIO_HOLDINGS_SOURCE_KEYS) register(key)
  for (const key of [
    "yds-portfolio-cash-ledger-v1",
    "yds-portfolio-cash-v1",
    "yds-portfolio-sync-meta-v1",
    "yds-validation-portfolio-v1",
    "yds-validation-portfolio-v2",
  ]) {
    register(key)
  }

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && PORTFOLIO_KEY_PATTERN.test(key)) register(key)
    }
  } catch {
    /* ignore */
  }

  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
}

/**
 * @param {PortfolioKeySnapshot[]} snapshots
 * @returns {string | null}
 */
export function pickRichestHoldingsKey(snapshots) {
  let best = null
  let bestCount = -1
  for (const snap of snapshots) {
    if (!PORTFOLIO_HOLDINGS_SOURCE_KEYS.includes(snap.key) && !PORTFOLIO_LEGACY_ALIAS_KEYS.includes(snap.key)) {
      continue
    }
    const c = snap.count ?? 0
    if (c > bestCount) {
      bestCount = c
      best = snap.key
    }
  }
  return bestCount > 0 ? best : null
}
