/**
 * Display order for an already computed n/4 count.
 * Missing scores stay below scored rows and are not treated as 0/4.
 * Equal counts keep the incoming order.
 */

export function scoredCountRank(ok, count) {
  const n = Number(count)
  if (ok === true && Number.isFinite(n)) return { scored: true, count: n }
  return { scored: false, count: null }
}

export function sortByBuyConditionCount(items, rankOf) {
  const list = items || []
  return list
    .map((item, index) => {
      const rank = rankOf(item) || { scored: false, count: null }
      const count = Number(rank.count)
      const scored = rank.scored === true && Number.isFinite(count)
      return { item, index, scored, count: scored ? count : null }
    })
    .sort((a, b) => {
      if (a.scored !== b.scored) return a.scored ? -1 : 1
      if (a.scored && a.count !== b.count) return b.count - a.count
      return a.index - b.index
    })
    .map((row) => row.item)
}
