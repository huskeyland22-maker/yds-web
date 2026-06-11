import { isDevMode, isShowDebugPanel } from "../utils/devMode.js"
import { buildMacroRiskSnapshot } from "./engine.js"
import { loadMacroRiskHistory } from "./clientHistory.js"

function readMacroDevUiFlag() {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem("yds-macro-dev-ui") === "1"
  } catch {
    return false
  }
}

/**
 * 클라이언트 전용 Macro Risk 스냅샷 (신규 api/* route 없음).
 * @param {object | null} panicContext read-only (vxn, move)
 */
/**
 * @param {object | null} panicContext
 * @param {{ forceBondSync?: boolean }} [opts]
 */
export async function loadMacroRiskSnapshot(panicContext = null, opts = {}) {
  try {
    const {
      history,
      updatedAt,
      sources,
      liveFetchOk,
      bondAsOfNy,
      bondFetchErrors,
      bondLiveCount,
    } = await loadMacroRiskHistory(panicContext, opts)
    const snapshot = buildMacroRiskSnapshot(history, panicContext, {
      sources,
      liveFetchOk,
      updatedAt,
      bondAsOfNy,
      bondFetchErrors,
      bondLiveCount,
      includeDev: readMacroDevUiFlag() || (isDevMode() && isShowDebugPanel()),
    })
    snapshot.updatedAt = updatedAt
    snapshot.bondAsOfNy = bondAsOfNy ?? null
    return snapshot
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const snapshot = buildMacroRiskSnapshot({}, panicContext, {
      liveFetchOk: false,
      bondFetchErrors: { _client: message || "snapshot_build_failed" },
      updatedAt: new Date().toISOString(),
    })
    snapshot.updatedAt = snapshot.updatedAt ?? new Date().toISOString()
    return snapshot
  }
}
