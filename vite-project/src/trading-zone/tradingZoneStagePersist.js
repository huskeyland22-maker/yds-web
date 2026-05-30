/**
 * 관심 → 눌림 → 추세 단계 이력 — 브라우저 localStorage (새로고침 유지)
 */

const STORAGE_KEY = "yds-trading-zone-stage-v1"

/**
 * @returns {Record<string, { stage?: string; stageHistory?: object[]; updatedAt?: string }>}
 */
export function loadTradingZoneStagePersist() {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * @param {Record<string, unknown>} record
 */
function saveTradingZoneStagePersist(record) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    /* quota / private mode */
  }
}

/**
 * @param {import("./tacticalTradingZoneData.js").TradingZonePosition[]} positions
 */
export function mergePersistIntoPositions(positions) {
  const store = loadTradingZoneStagePersist()
  return positions.map((p) => {
    const saved = store[p.id]
    if (!saved?.stage) return p
    return {
      ...p,
      stage: /** @type {import("./tacticalTradingZoneData.js").TradingStageId} */ (saved.stage),
      stageHistory:
        Array.isArray(saved.stageHistory) && saved.stageHistory.length
          ? saved.stageHistory
          : p.stageHistory,
    }
  })
}

/**
 * @param {import("./tacticalTradingZoneData.js").TradingZonePosition[]} positions
 */
export function persistPositionsStageState(positions) {
  const store = loadTradingZoneStagePersist()
  const at = new Date().toISOString()
  for (const p of positions) {
    store[p.id] = {
      stage: p.stage,
      stageHistory: p.stageHistory ?? [],
      updatedAt: at,
    }
  }
  saveTradingZoneStagePersist(store)
}
