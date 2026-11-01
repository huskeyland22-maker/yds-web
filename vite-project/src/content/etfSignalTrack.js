/**
 * Display helpers for the ETF signal tracker.
 * Does not read or write trade records or screen episodes.
 */

export const SIGNAL_TRACK_PATH = "/data/etf-signal-track-v1.json"
export const SIGNAL_MIN_COUNT = 3

function incompleteHorizon(tradingDays) {
  return {
    tradingDays,
    status: "incomplete",
    priceReturnPct: null,
    priceReturnStatus: "incomplete",
    totalReturnPct: null,
    totalReturnStatus: "unavailable",
    maxDrawdownPct: null,
    maxDrawdownStatus: "incomplete",
    pnl: null,
  }
}

function finiteIndicator(value) {
  return value != null && Number.isFinite(Number(value))
}

/**
 * A live card can add a signal that is not already in the research file.
 * Failed cards and scores below 3/4 produce nothing.
 * @param {object | null | undefined} card
 * @param {Array<{ id?: string, symbol?: string, closed?: boolean }>} episodes
 */
export function provisionalFromCard(card, episodes = []) {
  if (!card?.ok || !card.symbol || !card.asOfDate) return null
  const count = Number(card.count)
  if (!Number.isFinite(count) || count < SIGNAL_MIN_COUNT) return null
  if (![card.rsi14, card.stochK, card.bbPctB, card.ma20DevPct].every(finiteIndicator)) return null
  const symbol = String(card.symbol).toUpperCase()
  const id = `${symbol}:${card.asOfDate}`
  if ((episodes || []).some((episode) => episode?.id === id)) return null
  if ((episodes || []).some((episode) => episode?.symbol === symbol && episode?.closed === false)) return null
  return {
    id,
    symbol,
    theme: card.theme || symbol,
    themeShort: card.themeShort || card.theme || symbol,
    role: card.role || null,
    origin: "new",
    provisional: true,
    closed: false,
    closedDate: null,
    signalDate: card.asOfDate,
    asOfDate: card.asOfDate,
    close: Number(card.close),
    count,
    stageId: card.stage?.id || (count >= 4 ? "strong" : "primary"),
    stageLabel: card.stage?.label || (count >= 4 ? "강한 저점" : "1차 매수"),
    rsi14: Number(card.rsi14),
    stochK: Number(card.stochK),
    bbPctB: Number(card.bbPctB),
    ma20DevPct: Number(card.ma20DevPct),
    flags: card.flags || null,
    entryStatus: "pending",
    entryDate: null,
    entryPrice: null,
    horizons: {
      20: incompleteHorizon(20),
      60: incompleteHorizon(60),
      120: incompleteHorizon(120),
    },
    recovery: { status: "unavailable", tradingDays: null },
  }
}

export function provisionalSignals(cards, episodes = []) {
  const acc = [...(episodes || [])]
  const added = []
  for (const card of cards || []) {
    const row = provisionalFromCard(card, acc)
    if (!row) continue
    acc.push(row)
    added.push(row)
  }
  return added
}
