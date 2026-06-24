/**
 * 시장 사이클 — 수평 진행바 (현재 위치 표시)
 */

/** @typedef {{ id: string; label: string }} MarketCycleProgressStage */

/** @type {MarketCycleProgressStage[]} */
export const MARKET_CYCLE_PROGRESS_TRACK = [
  { id: "adj_entry", label: "조정진입" },
  { id: "adj_stable", label: "조정안정" },
  { id: "adj_recovery", label: "조정회복" },
  { id: "rise_early", label: "상승초기" },
  { id: "rise_spread", label: "상승확산" },
]

/**
 * @typedef {{
 *   visible: boolean
 *   track: Array<MarketCycleProgressStage & { isCurrent: boolean }>
 *   activeIndex: number
 *   currentLabel: string
 *   currentDurationDays: number
 *   transitionCount: number
 *   windowDays: number
 * }} MarketCycleProgressReport
 */

/** @param {string} cycleLabel */
export function resolveCycleProgressIndex(cycleLabel) {
  const label = String(cycleLabel ?? "").trim()
  const exact = MARKET_CYCLE_PROGRESS_TRACK.findIndex((stage) => stage.label === label)
  if (exact >= 0) return exact

  if (/조정회복\(경고\)/.test(label)) return 2
  if (/조정회복|회복중/.test(label)) return 2
  if (/조정안정|안정화/.test(label) && /조정|위축|충격|경계/.test(label)) return 1
  if (/진입/.test(label)) return 0
  if (/상승초기|경계회복|위축회복/.test(label)) return 3
  if (/상승확산|과열|경계약화|약화/.test(label)) return 4
  if (/회복/.test(label)) return 2
  if (/안정/.test(label)) return 1
  return 2
}

/**
 * @param {import("./ydsMarketCycleFlow.js").MarketCycleFlowReport | null | undefined} flow
 */
export function buildMarketCycleProgressReport(flow) {
  if (!flow?.visible) {
    return {
      visible: false,
      track: [],
      activeIndex: 0,
      currentLabel: "—",
      currentDurationDays: 0,
      transitionCount: 0,
      windowDays: flow?.windowDays ?? 30,
    }
  }

  const activeIndex = resolveCycleProgressIndex(flow.currentCycleLabel)
  const track = MARKET_CYCLE_PROGRESS_TRACK.map((stage, index) => ({
    ...stage,
    isCurrent: index === activeIndex,
  }))

  return {
    visible: true,
    track,
    activeIndex,
    currentLabel: flow.currentCycleLabel,
    currentDurationDays: flow.currentDurationDays,
    transitionCount: flow.transitionCount,
    windowDays: flow.windowDays,
  }
}
