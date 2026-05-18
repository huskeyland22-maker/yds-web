/**
 * DevTools 이중 스크롤 진단 — Console: window.__ydsScrollAudit()
 */
export function logScrollContainers() {
  if (typeof document === "undefined") return []

  const matches = [...document.querySelectorAll("*")].filter((el) => {
    const oy = getComputedStyle(el).overflowY
    if (oy !== "scroll" && oy !== "auto") return false
    return el.scrollHeight > el.clientHeight + 1
  })

  const rows = matches.map((el) => ({
    tag: el.tagName.toLowerCase(),
    id: el.id || "",
    class: String(el.className || "").slice(0, 100),
    overflowY: getComputedStyle(el).overflowY,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }))

  console.log("[yds scroll audit] overflow-y scroll/auto + overflowing:", rows.length)
  if (rows.length) console.table(rows)
  console.log("[yds scroll audit] documentElement.scrollHeight:", document.documentElement.scrollHeight)
  console.log("[yds scroll audit] window.innerHeight:", window.innerHeight)
  console.log("[yds scroll audit] body.scrollHeight:", document.body.scrollHeight)

  return matches
}

if (typeof window !== "undefined") {
  window.__ydsScrollAudit = logScrollContainers
}
