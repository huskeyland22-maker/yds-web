import { useCallback, useEffect, useState } from "react"

const STORAGE_KEY = "yds-stock-pick-favorites"

/** @returns {Set<string>} */
function readFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return new Set()
    return new Set(list.map(String))
  } catch {
    return new Set()
  }
}

/** @param {Set<string>} set */
function writeFavorites(set) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
}

export function useStockPickFavorites() {
  const [favorites, setFavorites] = useState(() => readFavorites())
  const [favoritesOnly, setFavoritesOnly] = useState(false)

  useEffect(() => {
    writeFavorites(favorites)
  }, [favorites])

  const isFavorite = useCallback((ticker) => favorites.has(ticker), [favorites])

  const toggleFavorite = useCallback((ticker) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker)
      else next.add(ticker)
      return next
    })
  }, [])

  /** @param {import("../content/ydsStockPickModel.js").StockPickView[]} stocks */
  const applyFavoriteFilter = useCallback(
    (stocks) => {
      if (!favoritesOnly) return stocks
      return stocks.filter((s) => favorites.has(s.ticker))
    },
    [favorites, favoritesOnly],
  )

  return {
    favorites,
    favoritesOnly,
    setFavoritesOnly,
    isFavorite,
    toggleFavorite,
    applyFavoriteFilter,
    favoriteCount: favorites.size,
  }
}
