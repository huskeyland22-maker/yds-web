import { useCallback, useEffect, useRef, useState } from "react"
import { isMacroRiskEnabled } from "./featureFlag.js"
import {
  BOND_SYNC_REQUEST_EVENT,
  dispatchBondSyncRequest,
  loadBondSyncMeta,
  recordBondSyncMeta,
} from "./bondSyncMeta.js"
import { loadMacroRiskSnapshot } from "./fetchMacroRisk.js"

/**
 * @param {object | null} panicContext — read-only (vxn 등). 패닉 저장소/로직 미변경.
 */
export function useMacroRiskSnapshot(panicContext = null) {
  const enabled = isMacroRiskEnabled()
  const vxn = panicContext?.vxn
  const move = panicContext?.move
  const updatedAt = panicContext?.updatedAt
  const [snapshot, setSnapshot] = useState(null)
  const [loading, setLoading] = useState(enabled)
  const [syncingBond, setSyncingBond] = useState(false)
  const [error, setError] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [lastBondSyncAt, setLastBondSyncAt] = useState(() => loadBondSyncMeta()?.at ?? null)
  const forceBondSyncRef = useRef(false)

  const runLoad = useCallback(
    (forceBondSync = false) => {
      if (!enabled) return undefined

      let cancelled = false
      if (forceBondSync) setSyncingBond(true)
      else setLoading(true)
      setError(null)

      const ctx =
        vxn != null || move != null || updatedAt != null ? { vxn, move, updatedAt } : null

      loadMacroRiskSnapshot(ctx, { forceBondSync })
        .then((s) => {
          if (cancelled) return
          setSnapshot(s)
          const metaAt = loadBondSyncMeta()?.at
          const at = forceBondSync ? metaAt ?? new Date().toISOString() : metaAt ?? s.updatedAt ?? null
          if (at) setLastBondSyncAt(at)
          if (!forceBondSync && s.updatedAt && !metaAt) {
            recordBondSyncMeta({ asOfNy: s.bondAsOfNy })
            setLastBondSyncAt(loadBondSyncMeta()?.at ?? s.updatedAt)
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : String(e))
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false)
            setSyncingBond(false)
          }
        })

      return () => {
        cancelled = true
      }
    },
    [enabled, vxn, move, updatedAt],
  )

  const refetch = useCallback(() => {
    forceBondSyncRef.current = false
    setReloadToken((t) => t + 1)
  }, [])

  const refetchBond = useCallback(() => {
    dispatchBondSyncRequest()
  }, [])

  useEffect(() => {
    const cancel = runLoad(forceBondSyncRef.current)
    forceBondSyncRef.current = false
    return cancel
  }, [runLoad, reloadToken])

  useEffect(() => {
    const onBondSync = () => {
      forceBondSyncRef.current = true
      setReloadToken((t) => t + 1)
    }
    window.addEventListener(BOND_SYNC_REQUEST_EVENT, onBondSync)
    return () => window.removeEventListener(BOND_SYNC_REQUEST_EVENT, onBondSync)
  }, [])

  return {
    enabled,
    snapshot,
    loading,
    syncingBond,
    error,
    refetch,
    refetchBond,
    lastBondSyncAt,
  }
}
