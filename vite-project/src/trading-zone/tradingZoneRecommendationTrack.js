/** @typedef {import("./tacticalTradingZoneData.js").TradingZonePosition} TradingZonePosition */

/** @type {import("./tacticalTradingZoneData.js").TradingStageId[]} */
const RECOMMEND_ENTRY_STAGES = ["interest", "pullback"]

/**
 * @param {string} iso
 * @returns {string}
 */
export function formatRecommendDateShort(iso) {
  const d = String(iso ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "—"
  const [, mm, dd] = d.split("-")
  return `${mm}/${dd}`
}

/**
 * @param {number | null | undefined} price
 * @param {"us" | "kr"} market
 */
export function formatRecommendPrice(price, market = "us") {
  if (!Number.isFinite(price)) return "—"
  if (market === "kr") return `${Math.round(price).toLocaleString("ko-KR")}원`
  if (price >= 100) return `${Math.round(price).toLocaleString("en-US")}달러`
  return `${price.toFixed(2)}달러`
}

/** 터미널 한 줄 표시 — 단위 생략 */
export function formatRecommendPriceCompact(price, market = "us") {
  if (!Number.isFinite(price)) return "—"
  if (market === "kr") return Math.round(price).toLocaleString("ko-KR")
  if (price >= 100) return Math.round(price).toLocaleString("en-US")
  return price.toFixed(2)
}

/**
 * @param {number | null | undefined} from
 * @param {number | null | undefined} to
 * @param {"us" | "kr"} market
 */
export function formatRecommendPriceRangeCompact(from, to, market = "us") {
  const a = formatRecommendPriceCompact(from, market)
  const b = formatRecommendPriceCompact(to, market)
  if (a === "—" && b === "—") return "—"
  return `${a} → ${b}`
}

/**
 * @param {number} recommended
 * @param {number} current
 */
export function calcRecommendReturnPct(recommended, current) {
  if (!Number.isFinite(recommended) || recommended <= 0 || !Number.isFinite(current)) return null
  return ((current - recommended) / recommended) * 100
}

/**
 * @param {TradingZonePosition} position
 * @param {{ livePrice?: number | null }} [opts]
 */
export function extractRecommendationAnchor(position, opts = {}) {
  const history = [...(position.stageHistory ?? [])].sort((a, b) =>
    String(a.at ?? "").localeCompare(String(b.at ?? "")),
  )
  const entry = history.find(
    (h) => RECOMMEND_ENTRY_STAGES.includes(h.stage) && Number.isFinite(Number(h.price)),
  )
  const fallback = history.find((h) => RECOMMEND_ENTRY_STAGES.includes(h.stage))
  const anchor = entry ?? fallback
  if (!anchor?.at) return null

  const recommendedPrice = Number.isFinite(Number(entry?.price))
    ? Number(entry.price)
    : Number.isFinite(Number(position.currentPrice))
      ? Number(position.currentPrice)
      : null

  const live = opts.livePrice
  const currentPrice = Number.isFinite(live)
    ? live
    : Number.isFinite(Number(position.currentPrice))
      ? Number(position.currentPrice)
      : recommendedPrice

  const returnPct = calcRecommendReturnPct(recommendedPrice, currentPrice)

  return {
    id: position.id,
    symbol: position.symbol,
    market: position.market,
    recommendedAt: String(anchor.at).slice(0, 10),
    recommendedPrice,
    currentPrice,
    returnPct,
    stage: anchor.stage,
  }
}

/**
 * @param {TradingZonePosition[]} positions
 * @param {string[]} priorityIds
 * @param {Record<string, { price?: number | null }>} [liveById]
 */
export function buildRecommendationTrackRows(positions, priorityIds = [], liveById = {}) {
  const prioritySet = new Set(priorityIds)
  const candidates = positions
    .map((p) =>
      extractRecommendationAnchor(p, {
        livePrice: liveById[p.id]?.price ?? null,
      }),
    )
    .filter(Boolean)

  candidates.sort((a, b) => {
    const aPri = prioritySet.has(a.id) ? 0 : 1
    const bPri = prioritySet.has(b.id) ? 0 : 1
    if (aPri !== bPri) return aPri - bPri
    const ra = a.returnPct ?? -999
    const rb = b.returnPct ?? -999
    return rb - ra
  })

  const seen = new Set()
  const out = []
  for (const row of candidates) {
    if (seen.has(row.symbol)) continue
    seen.add(row.symbol)
    out.push(row)
    if (out.length >= 16) break
  }
  return out
}
