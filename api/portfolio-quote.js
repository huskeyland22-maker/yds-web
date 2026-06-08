/**
 * POST /api/portfolio-quote
 * Body: { items: [{ ticker: string, country: 'us'|'kr', lotId?: string }] }
 */
import {
  fetchUsdKrwRate,
  portfolioQuoteKey,
  resolvePortfolioQuote,
} from "./_lib/portfolioQuoteProviders.js"

function readItems(req) {
  if (req.method === "POST" && req.body?.items) {
    return Array.isArray(req.body.items) ? req.body.items : []
  }

  const raw = typeof req.query?.items === "string" ? req.query.items : ""
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST")
    return res.status(405).json({ error: "method_not_allowed" })
  }

  const items = readItems(req)
    .map((item) => ({
      lotId: item?.lotId ? String(item.lotId) : null,
      ticker: String(item?.ticker ?? "").trim(),
      country: item?.country === "kr" ? "kr" : "us",
    }))
    .filter((item) => item.ticker)

  if (!items.length) {
    return res.status(400).json({ error: "items_required" })
  }

  const unique = new Map()
  for (const item of items) {
    const key = portfolioQuoteKey(item.country, item.ticker)
    if (!unique.has(key)) unique.set(key, item)
  }

  const usdkrw = await fetchUsdKrwRate()

  const settled = await Promise.allSettled(
    Array.from(unique.values()).map(async (item) => {
      const quote = await resolvePortfolioQuote(item.country, item.ticker)
      const key = portfolioQuoteKey(item.country, item.ticker)
      return { key, quote, lotId: item.lotId }
    }),
  )

  /** @type {Record<string, object>} */
  const quotes = {}
  /** @type {Record<string, object>} */
  const byLotId = {}

  for (const entry of settled) {
    if (entry.status !== "fulfilled") continue
    const { key, quote, lotId } = entry.value
    quotes[key] = quote
    if (lotId) byLotId[lotId] = quote
  }

  return res.status(200).json({
    quotes,
    byLotId,
    usdkrw,
    fetchedAt: new Date().toISOString(),
  })
}
