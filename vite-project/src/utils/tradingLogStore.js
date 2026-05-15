const STORAGE_KEY = "yds-trading-log-v1"

export const TRADE_TAGS = ["추세", "눌림", "돌파", "과열", "관망", "분할매수"]

export const POSITION_STATUS_TAGS = ["보유중", "관망", "축소검토", "청산대기", "핵심"]

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function num(v) {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function emptyState() {
  return {
    version: 1,
    initialCapital: 100_000_000,
    cash: 100_000_000,
    positions: [],
    buys: [],
    sells: [],
  }
}

export function loadTradingLog() {
  if (typeof window === "undefined") return emptyState()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw)
    return {
      ...emptyState(),
      ...parsed,
      positions: Array.isArray(parsed.positions) ? parsed.positions : [],
      buys: Array.isArray(parsed.buys) ? parsed.buys : [],
      sells: Array.isArray(parsed.sells) ? parsed.sells : [],
    }
  } catch {
    return emptyState()
  }
}

export function saveTradingLog(state) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function addBuy(state, entry) {
  const row = {
    id: uid(),
    date: entry.date || new Date().toISOString().slice(0, 10),
    symbol: String(entry.symbol || "").trim(),
    name: String(entry.name || entry.symbol || "").trim(),
    price: num(entry.price),
    weightPct: num(entry.weightPct),
    tags: Array.isArray(entry.tags) ? entry.tags.filter((t) => TRADE_TAGS.includes(t)) : [],
    memo: String(entry.memo || "").trim(),
  }
  return { ...state, buys: [row, ...state.buys] }
}

export function addSell(state, entry) {
  const buyPrice = num(entry.buyPrice)
  const sellPrice = num(entry.sellPrice)
  let returnPct = num(entry.returnPct)
  if (returnPct == null && buyPrice != null && sellPrice != null && buyPrice > 0) {
    returnPct = ((sellPrice - buyPrice) / buyPrice) * 100
  }
  const row = {
    id: uid(),
    date: entry.date || new Date().toISOString().slice(0, 10),
    symbol: String(entry.symbol || "").trim(),
    name: String(entry.name || entry.symbol || "").trim(),
    buyPrice,
    sellPrice,
    returnPct,
    weightPct: num(entry.weightPct),
    tags: Array.isArray(entry.tags) ? entry.tags.filter((t) => TRADE_TAGS.includes(t)) : [],
    reason: String(entry.reason || "").trim(),
    reviewMemo: String(entry.reviewMemo || "").trim(),
  }
  return { ...state, sells: [row, ...state.sells] }
}

export function upsertPosition(state, entry) {
  const id = entry.id || uid()
  const row = {
    id,
    symbol: String(entry.symbol || "").trim(),
    name: String(entry.name || entry.symbol || "").trim(),
    avgPrice: num(entry.avgPrice),
    quantity: num(entry.quantity) ?? 0,
    currentPrice: num(entry.currentPrice),
    weightPct: num(entry.weightPct),
    reason: String(entry.reason || "").trim(),
    statusTags: Array.isArray(entry.statusTags)
      ? entry.statusTags.filter((t) => typeof t === "string" && t.length > 0)
      : ["보유중"],
  }
  const rest = state.positions.filter((p) => p.id !== id)
  return { ...state, positions: [row, ...rest] }
}

export function removePosition(state, id) {
  return { ...state, positions: state.positions.filter((p) => p.id !== id) }
}

export function deleteBuy(state, id) {
  return { ...state, buys: state.buys.filter((b) => b.id !== id) }
}

export function deleteSell(state, id) {
  return { ...state, sells: state.sells.filter((s) => s.id !== id) }
}

function positionValue(p) {
  const price = p.currentPrice ?? p.avgPrice
  if (price == null || p.quantity == null) return 0
  return price * p.quantity
}

function positionPnlPct(p) {
  const cur = p.currentPrice ?? p.avgPrice
  if (cur == null || p.avgPrice == null || p.avgPrice <= 0) return null
  return ((cur - p.avgPrice) / p.avgPrice) * 100
}

/** @param {ReturnType<typeof loadTradingLog>} state */
export function computeTradingStats(state) {
  const initial = num(state.initialCapital) ?? 0
  const cash = num(state.cash) ?? 0
  const positions = state.positions.map((p) => ({
    ...p,
    marketValue: positionValue(p),
    pnlPct: positionPnlPct(p),
    pnlAmount:
      p.avgPrice != null && p.currentPrice != null && p.quantity != null
        ? (p.currentPrice - p.avgPrice) * p.quantity
        : null,
  }))

  const positionsValue = positions.reduce((s, p) => s + (p.marketValue || 0), 0)
  const totalEquity = cash + positionsValue

  const closed = state.sells.filter((s) => s.returnPct != null)
  const wins = closed.filter((s) => (s.returnPct ?? 0) > 0)
  const winRate = closed.length ? (wins.length / closed.length) * 100 : null

  const realizedPnl = state.sells.reduce((sum, s) => {
    if (s.returnPct == null || s.weightPct == null) return sum
    const notional = (initial * s.weightPct) / 100
    return sum + (notional * s.returnPct) / 100
  }, 0)

  const unrealizedPnl = positions.reduce((sum, p) => sum + (p.pnlAmount ?? 0), 0)

  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const monthSells = state.sells.filter((s) => String(s.date || "").startsWith(monthKey))
  const monthReturn =
    monthSells.length && initial > 0
      ? monthSells.reduce((sum, s) => sum + (s.returnPct ?? 0) * ((s.weightPct ?? 0) / 100), 0) * 100
      : null

  const tagStats = TRADE_TAGS.map((tag) => {
    const tagged = state.sells.filter((s) => s.tags?.includes(tag) && s.returnPct != null)
    const tagWins = tagged.filter((s) => (s.returnPct ?? 0) > 0)
    const avg =
      tagged.length > 0 ? tagged.reduce((a, s) => a + (s.returnPct ?? 0), 0) / tagged.length : null
    return {
      tag,
      count: tagged.length,
      winRate: tagged.length ? (tagWins.length / tagged.length) * 100 : null,
      avgReturnPct: avg,
    }
  })

  const bestSell =
    closed.length > 0
      ? [...closed].sort((a, b) => (b.returnPct ?? 0) - (a.returnPct ?? 0))[0]
      : null

  const lossSells = closed.filter((s) => (s.returnPct ?? 0) < 0)
  const mistakePatterns = []
  if (lossSells.filter((s) => s.tags?.includes("과열")).length >= 2) {
    mistakePatterns.push("과열 구간 진입 후 손실 빈도 높음")
  }
  if (lossSells.filter((s) => s.tags?.includes("돌파")).length >= 2) {
    mistakePatterns.push("돌파 추격 매매 실패 반복")
  }
  if (lossSells.filter((s) => !s.reviewMemo?.trim()).length >= 2) {
    mistakePatterns.push("손실 거래 복기 메모 누락")
  }
  if (!mistakePatterns.length && lossSells.length) {
    mistakePatterns.push("손실 거래 복기를 통해 패턴을 정리하세요")
  }

  return {
    totalEquity,
    realizedPnl,
    unrealizedPnl,
    winRate,
    monthReturnPct: monthReturn,
    positions,
    tagStats,
    bestSell,
    mistakePatterns,
    closedCount: closed.length,
  }
}

export function formatKrw(n) {
  if (n == null || !Number.isFinite(n)) return "—"
  const sign = n < 0 ? "-" : ""
  return `${sign}₩${Math.abs(Math.round(n)).toLocaleString("ko-KR")}`
}

export function formatPct(n, digits = 2) {
  if (n == null || !Number.isFinite(n)) return "—"
  const sign = n > 0 ? "+" : ""
  return `${sign}${n.toFixed(digits)}%`
}
