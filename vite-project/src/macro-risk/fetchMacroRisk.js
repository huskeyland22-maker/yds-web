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
  const { history, updatedAt, sources, liveFetchOk, bondAsOfNy } = await loadMacroRiskHistory(panicContext, opts)
  const snapshot = buildMacroRiskSnapshot(history, panicContext, {
    sources,
    liveFetchOk,
    updatedAt,
    bondAsOfNy,
    includeDev: readMacroDevUiFlag() || (isDevMode() && isShowDebugPanel()),
  })
  snapshot.updatedAt = updatedAt
  snapshot.bondAsOfNy = bondAsOfNy ?? null
  return snapshot
}
