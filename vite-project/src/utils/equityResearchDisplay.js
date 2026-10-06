import { EQUITY_SELL_RESEARCH_UNIVERSE } from "../../../scripts/lib/equity-sell-research-universe.mjs"

/** Frozen research names, in list order. Not the 20-name screen scan. */
export function equityResearchDisplayList(scanRows = []) {
  const scan = new Map((scanRows || []).map((row) => [row.symbol, row]))
  return EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => {
    const known = scan.get(row.symbol)
    return {
      symbol: row.symbol,
      name: known?.name || row.name,
      group: known?.group || null,
      role: row.role,
    }
  })
}

/** Search and group filters only. Does not cap the list. */
export function visibleResearchStocks(rows, { group = "all", query = "" } = {}) {
  const q = String(query || "").trim().toLowerCase()
  return (rows || []).filter((row) => {
    if (group !== "all" && row.group !== group) return false
    if (!q) return true
    return row.symbol.toLowerCase().includes(q) || String(row.name || "").toLowerCase().includes(q)
  })
}
