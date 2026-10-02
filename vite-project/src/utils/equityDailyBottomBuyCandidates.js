const TYPE_COPY = {
  A: { id: "A", title: "A · 저위험 3/4", detail: "RSI + Stoch + BB", scoreText: "3/4" },
  B: { id: "B", title: "B · 고변동 3/4", detail: "MA20 포함", scoreText: "3/4" },
  C: { id: "C", title: "4/4 · 전체 조건", detail: "RSI + Stoch + BB + MA20", scoreText: "4/4" },
}

function conditionPasses(input) {
  if (Array.isArray(input?.conditions)) {
    const pass = Object.fromEntries(input.conditions.map((row) => [row.id, Boolean(row.pass)]))
    return { rsi: pass.rsi, stoch: pass.stoch, bb: pass.bb, ma: pass.ma20, count: input.score }
  }
  if (input && typeof input === "object" && "count" in input) {
    return { rsi: Boolean(input.rsi), stoch: Boolean(input.stoch), bb: Boolean(input.bb), ma: Boolean(input.ma), count: input.count }
  }
  return null
}

/**
 * Candidate character from the existing four condition flags. Not a buy rank.
 * Accepts a conditionFlags result or a view whose conditions already came from it.
 * @param {{ count?: number, rsi?: boolean, stoch?: boolean, bb?: boolean, ma?: boolean, score?: number, conditions?: Array<{ id: string, pass?: boolean }> } | null} input
 */
export function equityCandidateConditionType(input) {
  const flags = conditionPasses(input)
  if (!flags) return null
  if (flags.count === 4 && flags.rsi && flags.stoch && flags.bb && flags.ma) return TYPE_COPY.C
  if (flags.count === 3 && flags.rsi && flags.stoch && flags.bb && !flags.ma) return TYPE_COPY.A
  if (flags.count === 3 && flags.ma && [flags.rsi, flags.stoch, flags.bb].filter(Boolean).length === 2) return TYPE_COPY.B
  return null
}

/**
 * Display filter only. Score is already computed by equityDailyBottomBuy.
 * 4/4 first, then 3/4. Same score keeps the universe order.
 * @param {Array<{ ok?: boolean, symbol?: string, score?: number | null } | null>} views
 * @param {string[]} universeSymbols
 */
export function selectEquityBuyCandidates(views, universeSymbols) {
  const order = new Map(universeSymbols.map((symbol, index) => [symbol, index]))
  return views
    .filter((view) => view?.ok && (view.score === 3 || view.score === 4))
    .slice()
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return (order.get(a.symbol) ?? 0) - (order.get(b.symbol) ?? 0)
    })
}
