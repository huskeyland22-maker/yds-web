/** URL hash 제거 — /value-chain 유지 */
export function clearValueChainHash() {
  if (typeof window === "undefined") return
  const path = window.location.pathname || "/value-chain"
  history.replaceState(null, "", path)
}

/**
 * @param {string} elementId
 * @param {{ behavior?: ScrollBehavior; block?: ScrollLogicalPosition }} [options]
 */
export function scrollToValueChainSection(elementId, options = {}) {
  if (typeof window === "undefined" || !elementId) return
  const el = document.getElementById(elementId)
  if (!el) return
  el.scrollIntoView({
    behavior: options.behavior ?? "smooth",
    block: options.block ?? "start",
  })
  clearValueChainHash()
}
