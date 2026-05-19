/** URL hash 제거 — /value-chain 유지 */
export function clearValueChainHash() {
  if (typeof window === "undefined") return
  const path = window.location.pathname || "/value-chain"
  const search = window.location.search || ""
  history.replaceState(null, "", `${path}${search}`)
}

/** 섹터 이동 후 body/html 스크롤 잠금 잔여 제거 */
export function ensurePageScrollUnlocked() {
  if (typeof document === "undefined") return
  const { body, documentElement: html } = document
  body.style.overflow = ""
  body.style.overflowY = ""
  body.style.position = ""
  body.style.touchAction = ""
  body.style.pointerEvents = ""
  html.style.overflow = ""
  html.style.overflowY = ""
}

/**
 * @param {HTMLElement} el
 */
function scrollMarginTopPx(el) {
  const v = window.getComputedStyle(el).scrollMarginTop
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

/** @returns {Element} */
function getPageScrollRoot() {
  return document.scrollingElement ?? document.documentElement
}

/**
 * @param {string} elementId
 * @param {{ behavior?: ScrollBehavior }} [options]
 */
export function scrollToValueChainSection(elementId, options = {}) {
  if (typeof window === "undefined" || !elementId) return
  const el = document.getElementById(elementId)
  if (!el) return

  ensurePageScrollUnlocked()
  clearValueChainHash()

  const behavior = options.behavior ?? "smooth"
  const marginTop = scrollMarginTopPx(el)
  const scrollRoot = getPageScrollRoot()

  if (scrollRoot === document.documentElement || scrollRoot === document.body) {
    const y = el.getBoundingClientRect().top + window.scrollY - marginTop
    window.scrollTo({ top: Math.max(0, y), behavior })
    return
  }

  const rootRect = scrollRoot.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const top = elRect.top - rootRect.top + scrollRoot.scrollTop - marginTop
  scrollRoot.scrollTo({ top: Math.max(0, top), behavior })
}
