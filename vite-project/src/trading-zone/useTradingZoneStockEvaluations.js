import { useEffect, useRef, useState } from "react"
import { fetchStockIndicators } from "../utils/stockIndicatorsApi.js"
import {
  applyStockEvaluationsToPositions,
  evaluateStockFromApi,
  resolvePositionApiCode,
} from "./tradingZoneStockEvaluation.js"

/**
 * @param {{
 *   positions: import("./tacticalTradingZoneData.js").TradingZonePosition[]
 *   market: import("./tacticalTradingZoneData.js").TradingMarketId
 *   panicData?: object | null
 *   macroBehavior?: object | null
 *   enabled?: boolean
 * }} opts
 */
export function useTradingZoneStockEvaluations({
  positions,
  market,
  panicData = null,
  macroBehavior = null,
  enabled = true,
}) {
  const [evalMap, setEvalMap] = useState(/** @type {Record<string, import("./tradingZoneStockEvaluation.js").TradingZoneStockEvaluation>} */ ({}))
  const [loading, setLoading] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState(/** @type {string | null} */ (null))
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!enabled) return undefined

    const marketPositions = positions.filter((p) => p.market === market)
    if (!marketPositions.length) {
      setEvalMap({})
      return undefined
    }

    const requestId = ++requestIdRef.current
    const ac = new AbortController()

    ;(async () => {
      setLoading(true)
      const settled = await Promise.allSettled(
        marketPositions.map(async (p) => {
          const code = resolvePositionApiCode(p)
          if (!code) {
            return /** @type {const} */ ([p.id, evaluateStockFromApi(p, null, panicData)])
          }
          const body = await fetchStockIndicators({
            code,
            name: p.symbol,
            signal: ac.signal,
            panicIndex: panicData?.vix,
          })
          return /** @type {const} */ ([p.id, evaluateStockFromApi(p, body, panicData)])
        }),
      )

      if (requestId !== requestIdRef.current) return

      /** @type {Record<string, import("./tradingZoneStockEvaluation.js").TradingZoneStockEvaluation>} */
      const next = {}
      for (const item of settled) {
        if (item.status !== "fulfilled") continue
        const [id, ev] = item.value
        next[id] = ev
      }
      setEvalMap(next)
      setLastSyncAt(new Date().toISOString())
      setLoading(false)
    })().catch(() => {
      if (requestId === requestIdRef.current) setLoading(false)
    })

    return () => {
      ac.abort()
    }
  }, [positions, market, panicData, enabled])

  const enrichedPositions = applyStockEvaluationsToPositions(positions, evalMap, {
    date: panicData?.date,
    macroBehavior,
    enableAutoStage: true,
  })

  return { evalMap, enrichedPositions, loading, lastSyncAt }
}
