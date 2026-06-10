/**
 * GET /api/stock-batch?codes=AAPL,MSFT,...
 * 미국·해외 종목 일괄 조회 (서버 1회 호출 · Yahoo 병렬 fetch)
 */
import stockIndicators from "./stock-indicators.js"

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "method not allowed" })
  }

  return stockIndicators(
    {
      ...req,
      query: { ...req.query, batch: "us" },
    },
    res,
  )
}
