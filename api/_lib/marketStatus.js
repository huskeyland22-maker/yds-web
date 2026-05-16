import { supabaseRest } from "./supabaseRest.js"

export async function fetchMarketStatusRows(opts = {}) {
  const market = opts.market ? String(opts.market) : ""
  let q = "market_status?select=*&order=updated_at.desc"
  if (market) q += `&market=eq.${encodeURIComponent(market)}`
  const rows = await supabaseRest(q, { method: "GET" })
  return Array.isArray(rows) ? rows : []
}
