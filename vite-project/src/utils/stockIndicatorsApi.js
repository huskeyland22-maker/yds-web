/**
 * Phase-1 stock engine: GET /api/stock-indicators
 * (KIS 일봉 우선, 미설정 시 Yahoo 일봉 폴백 → RSI·MACD·이평 등).
 */
export async function fetchStockIndicators({ code, name }) {
  if (!code) throw new Error("missing code")
  const qs = new URLSearchParams()
  qs.set("code", String(code).replace(/\D/g, "").padStart(6, "0"))
  if (name) qs.set("name", String(name))
  const res = await fetch(`/api/stock-indicators?${qs.toString()}`, {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "application/json" },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = body.message || body.error || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return body
}
