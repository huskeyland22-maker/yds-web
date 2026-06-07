import { useEffect, useMemo, useState } from "react"
import { buildEventScorecard } from "../content/ydsEventScorecard.js"
import { fetchSpyDailyPrices } from "../content/ydsSpyDailyLoader.js"

/**
 * @param {object[]} historyRows
 * @param {object | null | undefined} panicData
 */
export function useEventScorecard(historyRows, panicData) {
  const [prices, setPrices] = useState(/** @type {Record<string, number> | null} */ (null))

  useEffect(() => {
    let cancelled = false
    fetchSpyDailyPrices().then((p) => {
      if (!cancelled) setPrices(p)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const scorecard = useMemo(() => {
    if (!prices) return null
    return buildEventScorecard(historyRows, panicData, prices)
  }, [historyRows, panicData, prices])

  return {
    scorecard,
    loading: prices == null,
    byType: scorecard?.byType ?? null,
    rows: scorecard?.rows ?? [],
  }
}
