import { useEffect, useState } from "react"
import { isMacroRiskEnabled } from "./featureFlag.js"
import { loadMacroRiskSnapshot } from "./fetchMacroRisk.js"

/**
 * @param {object | null} panicContext — read-only (vxn 등). 패닉 저장소/로직 미변경.
 */
export function useMacroRiskSnapshot(panicContext = null) {
  const enabled = isMacroRiskEnabled()
  const vxn = panicContext?.vxn
  const move = panicContext?.move
  const [snapshot, setSnapshot] = useState(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!enabled) {
      setSnapshot(null)
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const ctx = vxn != null || move != null ? { vxn, move } : null
    loadMacroRiskSnapshot(ctx)
      .then((s) => {
        if (!cancelled) setSnapshot(s)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled, vxn, move])

  return { enabled, snapshot, loading, error }
}
