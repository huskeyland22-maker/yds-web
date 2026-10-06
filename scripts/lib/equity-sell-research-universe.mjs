/**
 * Frozen 31-name universe for a future US single-stock sell study.
 * This is not the equity screen scan list and not a sell rule.
 * Do not add or remove a name after seeing results.
 * A name with thin data stays in the list and is marked sample-insufficient.
 */

export const EQUITY_SELL_RESEARCH_SELECTED_STRATEGY = null

export const EQUITY_SELL_RESEARCH_UNIVERSE = [
  { symbol: "AMZN", name: "Amazon", role: "CORE" },
  { symbol: "AAPL", name: "Apple", role: "WATCH" },
  { symbol: "AMAT", name: "Applied Materials", role: "WATCH" },
  { symbol: "ASML", name: "ASML", role: "WATCH" },
  { symbol: "AVGO", name: "Broadcom", role: "CORE" },
  { symbol: "CEG", name: "Constellation Energy", role: "CORE" },
  { symbol: "ETN", name: "Eaton", role: "WATCH" },
  { symbol: "FCX", name: "Freeport-McMoRan", role: "CORE" },
  { symbol: "FTNT", name: "Fortinet", role: "CORE" },
  { symbol: "GOOGL", name: "Alphabet", role: "WATCH" },
  { symbol: "LRCX", name: "Lam Research", role: "CORE" },
  { symbol: "LLY", name: "Eli Lilly", role: "WATCH" },
  { symbol: "MU", name: "Micron", role: "CORE" },
  { symbol: "NVDA", name: "NVIDIA", role: "CORE" },
  { symbol: "ORCL", name: "Oracle", role: "WATCH" },
  { symbol: "PANW", name: "Palo Alto Networks", role: "CORE" },
  { symbol: "PLTR", name: "Palantir", role: "WATCH" },
  { symbol: "TSLA", name: "Tesla", role: "WATCH" },
  { symbol: "TSM", name: "TSMC", role: "WATCH" },
  { symbol: "VST", name: "Vistra", role: "CORE" },
  { symbol: "KLAC", name: "KLA Corp", role: "CORE" },
  { symbol: "ANET", name: "Arista Networks", role: "CORE" },
  { symbol: "VRT", name: "Vertiv", role: "CORE" },
  { symbol: "PWR", name: "Quanta Services", role: "CORE" },
  { symbol: "V", name: "Visa", role: "CORE" },
  { symbol: "MSFT", name: "Microsoft", role: "CORE" },
  { symbol: "GEV", name: "GE Vernova", role: "CORE" },
  { symbol: "ISRG", name: "Intuitive Surgical", role: "CORE" },
  { symbol: "SNPS", name: "Synopsys", role: "CORE" },
  { symbol: "AMD", name: "AMD", role: "CORE" },
  { symbol: "CRWD", name: "CrowdStrike", role: "CORE" },
]

export const EQUITY_SELL_RESEARCH_ORIGINAL = EQUITY_SELL_RESEARCH_UNIVERSE.slice(0, 20)
export const EQUITY_SELL_RESEARCH_ADDED = EQUITY_SELL_RESEARCH_UNIVERSE.slice(20)
