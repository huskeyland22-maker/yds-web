/**
 * 패닉 히스토리 UI — "—" / "히스토리 없음" 대신 준비·백필 상태
 */

/** @typedef {'idle' | 'loading' | 'backfilling' | 'ready' | 'preparing'} PanicHistoryV2SyncStatus */

/**
 * @param {{
 *   historyLength: number
 *   panicV2Count: number
 *   syncStatus?: PanicHistoryV2SyncStatus
 *   hubEnabled?: boolean
 * }} ctx
 */
export function resolvePanicHistoryUiState(ctx) {
  const { historyLength, panicV2Count, syncStatus = "idle", hubEnabled = true } = ctx

  if (!hubEnabled) {
    return {
      phase: "preparing",
      currentText: "데이터 준비중",
      statusLabel: "준비중",
      chartMessage: "데이터 준비중",
      showChart: false,
    }
  }

  if (syncStatus === "loading") {
    return {
      phase: "loading",
      currentText: "데이터 준비중",
      statusLabel: "준비중",
      chartMessage: "데이터 준비중",
      showChart: false,
    }
  }

  if (syncStatus === "backfilling") {
    return {
      phase: "backfilling",
      currentText: "백필중",
      statusLabel: "백필중",
      chartMessage: "백필중",
      showChart: false,
    }
  }

  if (historyLength < 1) {
    return {
      phase: "preparing",
      currentText: "데이터 준비중",
      statusLabel: "준비중",
      chartMessage: "데이터 준비중",
      showChart: false,
    }
  }

  if (panicV2Count < 1) {
    return {
      phase: "preparing",
      currentText: "데이터 준비중",
      statusLabel: "준비중",
      chartMessage: historyLength >= 1 ? "백필중" : "데이터 준비중",
      showChart: false,
    }
  }

  return {
    phase: "ready",
    currentText: null,
    statusLabel: null,
    chartMessage: null,
    showChart: true,
  }
}
