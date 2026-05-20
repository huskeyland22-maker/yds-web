import { isDevMode, isShowDebugPanel } from "../utils/devMode.js"
import { buildMacroRiskSnapshot } from "./engine.js"
import { loadMacroRiskHistory } from "./clientHistory.js"

/**
 * 클라이언트 전용 Macro Risk 스냅샷 (신규 api/* route 없음).
 * @param {object | null} panicContext read-only (vxn, move)
 */
export async function loadMacroRiskSnapshot(panicContext = null) {
  const { history, updatedAt, sources, liveFetchOk } = await loadMacroRiskHistory(panicContext)
  const snapshot = buildMacroRiskSnapshot(history, panicContext, {
    sources,
    liveFetchOk,
    updatedAt,
    includeDev: isDevMode() && isShowDebugPanel(),
  })
  snapshot.updatedAt = updatedAt
  return snapshot
}
