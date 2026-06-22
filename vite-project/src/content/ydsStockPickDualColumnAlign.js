/**
 * 종목추천 2컬럼(US/KR) — 섹션 높이 동기화
 */

export const SPICK_DUAL_ALIGN_ZONES = /** @type {const} */ ([
  "summary",
  "hero",
  "why",
])

export const SPICK_DUAL_ALIGN_LOG = "[spick-dual-align]"

/**
 * @param {Record<string, number>[]} rows
 * @param {readonly string[]} zones
 */
export function computeMaxZoneHeights(rows, zones = SPICK_DUAL_ALIGN_ZONES) {
  /** @type {Record<string, number>} */
  const max = {}
  for (const zone of zones) {
    max[zone] = Math.max(0, ...rows.map((row) => row[zone] ?? 0))
  }
  return max
}

/**
 * @param {HTMLElement} panel
 * @param {readonly string[]} [zones]
 */
export function measureCountryPanelZones(panel, zones = SPICK_DUAL_ALIGN_ZONES) {
  const country = panel.dataset.country ?? "?"
  /** @type {Record<string, number>} */
  const heights = { country }
  for (const zone of zones) {
    const el = panel.querySelector(`[data-spick-zone="${zone}"]`)
    heights[zone] = el ? Math.round(el.getBoundingClientRect().height) : 0
  }
  const sectorEl = panel.querySelector('[data-spick-zone="sector"]')
  heights.sectorTop = sectorEl ? Math.round(sectorEl.getBoundingClientRect().top) : 0
  return heights
}

/**
 * @param {HTMLElement} dualRoot
 * @param {{ log?: boolean }} [options]
 */
export function syncStockPickDualColumnAlign(dualRoot, options = {}) {
  const { log = true } = options
  const panels = [...dualRoot.querySelectorAll(".yds-spick-country-panel[data-country]")]
  if (panels.length < 2) return null

  const measured = panels.map((panel) => measureCountryPanelZones(panel))
  const maxHeights = computeMaxZoneHeights(measured)

  for (const zone of SPICK_DUAL_ALIGN_ZONES) {
    const h = maxHeights[zone]
    if (h > 0) {
      dualRoot.style.setProperty(`--spick-align-${zone}-h`, `${h}px`)
    }
  }

  dualRoot.classList.add("yds-spick-dual--synced")

  const gridStyles = getComputedStyle(dualRoot)
  const sectorTopDelta =
    measured.length >= 2
      ? Math.abs((measured[0].sectorTop ?? 0) - (measured[1].sectorTop ?? 0))
      : 0

  if (log) {
    console.log(SPICK_DUAL_ALIGN_LOG, {
      layout: {
        gridAlignItems: gridStyles.alignItems,
        dualSynced: dualRoot.classList.contains("yds-spick-dual--synced"),
      },
      columns: measured,
      maxHeights,
      sectorTopDelta,
    })
  }

  return { measured, maxHeights, sectorTopDelta }
}
