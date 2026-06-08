import { useMemo } from "react"
import { useAppDataStore } from "../store/appDataStore.js"
import { panicDataFromCycleRow, mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import { resolveMarketAdapterContext } from "../content/ydsMarketAdapter.js"

/** @returns {import("../content/ydsMarketAdapter.js").YdsMarketAdapterContext} */
export function useYdsMarketContext() {
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)

  const history = useMemo(
    () => resolveCycleHistoryRows(mergeCycleRows(storeRows ?? [], [])),
    [storeRows],
  )

  const panicData = useMemo(() => {
    const latest = history[history.length - 1] ?? null
    return latest ? panicDataFromCycleRow(latest) : null
  }, [history])

  return useMemo(
    () => resolveMarketAdapterContext(panicData, history),
    [panicData, history],
  )
}
