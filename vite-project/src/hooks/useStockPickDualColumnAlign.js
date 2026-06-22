import { useLayoutEffect, useRef } from "react"
import { syncStockPickDualColumnAlign } from "../content/ydsStockPickDualColumnAlign.js"

/**
 * @param {boolean} enabled
 */
export function useStockPickDualColumnAlign(enabled) {
  const dualRef = useRef(null)

  useLayoutEffect(() => {
    if (!enabled) return undefined
    const root = dualRef.current
    if (!root) return undefined

    let frame = 0

    const run = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        syncStockPickDualColumnAlign(root, { log: true })
      })
    }

    run()

    const ro = new ResizeObserver(run)
    ro.observe(root)
    for (const panel of root.querySelectorAll(".yds-spick-country-panel[data-country]")) {
      ro.observe(panel)
      for (const zone of panel.querySelectorAll("[data-spick-zone]")) {
        ro.observe(zone)
      }
    }

    window.addEventListener("resize", run)

    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      window.removeEventListener("resize", run)
      root.classList.remove("yds-spick-dual--synced")
      for (const zone of ["summary", "hero", "why"]) {
        root.style.removeProperty(`--spick-align-${zone}-h`)
      }
    }
  }, [enabled])

  return dualRef
}
