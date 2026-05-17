/** @returns {number} fixed header clearance (px) */
export function getScrollOffsetPx() {
  if (typeof window === "undefined") return 120
  return window.matchMedia("(max-width: 767px)").matches ? 90 : 120
}

/**
 * @param {HTMLElement | null | undefined} el
 * @param {ScrollBehavior} [behavior]
 */
export function scrollToElementWithOffset(el, behavior = "smooth") {
  if (!el || typeof window === "undefined") return
  const y = el.getBoundingClientRect().top + window.pageYOffset - getScrollOffsetPx()
  window.scrollTo({ top: Math.max(0, y), behavior })
}
