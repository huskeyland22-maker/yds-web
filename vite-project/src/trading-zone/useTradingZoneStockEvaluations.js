import { useEffect, useMemo, useRef, useState } from "react"
import { resolveHomeV5StrategyRegime } from "../home-v5/homeV5StrategyRegime.js"
import { fetchStockIndicators } from "../utils/stockIndicatorsApi.js"
import {
  applyStockEvaluationsToPositions,
  evaluateStockFromApi,
  resolvePositionApiCode,
} from "./tradingZoneStockEvaluation.js"
import { persistPositionsStageState } from "./tradingZoneStagePersist.js"

/**
 * @param {{
 *   positions: import("./tacticalTradingZoneData.js").TradingZonePosition[]
 *   market: import("./tacticalTradingZoneData.js").TradingMarketId
 *   panicData?: object | null
 *   macroBehavior?: object | null
 *   marketPolicy?: { marketState?: string } | null
 *   cycleScore?: number | null
 *   enabled?: boolean
 * }} opts
 */
export function useTradingZoneStockEvaluations({
  positions,
  market,
  panicData = null,
  macroBehavior = null,
  marketPolicy = null,
  cycleScore = null,
  enabled = true,
}) {
  const [evalMap, setEvalMap] = useState(/** @type {Record<string, import("./tradingZoneStockEvaluation.js").TradingZoneStockEvaluation>} */ ({}))
  const [loading, setLoading] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState(/** @type {string | null} */ (null))
  const requestIdRef = useRef(0)

  const evalContext = useMemo(() => {
    const regime = resolveHomeV5StrategyRegime(panicData)
    return {
      marketState: marketPolicy?.marketState,
      regimeId: regime?.id ?? null,
      cycleScore,
    }
  }, [panicData, marketPolicy?.marketState, cycleScore])

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
            return /** @type {const} */ ([p.id, evaluateStockFromApi(p, null, panicData, evalContext)])
          }
          const body = await fetchStockIndicators({
            code,
            name: p.symbol,
            signal: ac.signal,
            panicIndex: panicData?.vix,
          })
          return /** @type {const} */ ([p.id, evaluateStockFromApi(p, body, panicData, evalContext)])
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
  }, [positions, market, panicData, enabled, evalContext])

  const enrichedPositions = useMemo(
    () =>
      applyStockEvaluationsToPositions(positions, evalMap, {
        date: panicData?.date,
        macroBehavior,
        enableAutoStage: true,
      }),
    [positions, evalMap, panicData?.date, macroBehavior],
  )

  useEffect(() => {
    if (!enabled || loading) return
    if (!Object.keys(evalMap).length) return
    persistPositionsStageState(enrichedPositions)
  }, [enabled, loading, evalMap, enrichedPositions])

  return { evalMap, enrichedPositions, loading, lastSyncAt }
}
