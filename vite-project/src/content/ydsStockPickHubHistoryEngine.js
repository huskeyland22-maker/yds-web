/** @type {ReadonlyArray<number>} */
export const HUB_HISTORY_LIMIT_STEPS = [10, 20, 50, Infinity]

/**
 * @param {number} stepIndex
 * @returns {number}
 */
export function resolveHubHistoryLimit(stepIndex) {
  const idx = Math.max(0, Math.min(stepIndex, HUB_HISTORY_LIMIT_STEPS.length - 1))
  return HUB_HISTORY_LIMIT_STEPS[idx]
}
