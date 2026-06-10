/**
 * 종목추천 컴포넌트 mount/unmount 추적 (remount 원인 분석)
 */

let seq = 0

/**
 * @param {string} component
 * @param {"mount" | "unmount"} phase
 * @param {Record<string, unknown>} [meta]
 */
export function traceStockPickMount(component, phase, meta = {}) {
  const id = ++seq
  const ts = typeof performance !== "undefined" ? Math.round(performance.now()) : Date.now()
  console.log(`[stock-pick-mount] ${phase} ${component}`, {
    id,
    ts,
    ...meta,
  })
  return id
}
