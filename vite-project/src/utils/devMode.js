/**
 * 프로덕션 UI vs 개발자 도구 분리.
 * 일반 사용자: debug/RAW/sync·개발자 메뉴 숨김.
 */
export function isDevMode() {
  if (import.meta.env?.DEV) return true
  if (typeof window === "undefined") return false
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.get("dev") === "1" || q.get("debug") === "1") return true
    if (window.localStorage?.getItem("yds-dev-mode") === "1") return true
    if (window.localStorage?.getItem("devMode") === "1") return true
  } catch {
    // ignore
  }
  return false
}

/**
 * Macro Risk DEV DATA PANEL 등 — `SHOW_DEBUG=true` / Vite `VITE_SHOW_DEBUG`.
 * 일반 사용자 비표시; `isDevMode()`와 함께 쓸 것.
 */
export function isShowDebugPanel() {
  const env = String(import.meta.env?.VITE_SHOW_DEBUG ?? "").toLowerCase()
  if (env === "1" || env === "true") return true
  if (typeof window === "undefined") return false
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.get("SHOW_DEBUG") === "1" || q.get("show_debug") === "1") return true
    if (window.localStorage?.getItem("yds-show-debug") === "1") return true
  } catch {
    // ignore
  }
  return false
}

/** 프로덕션 배포 UI — 개발자·검증·디버그 항목 숨김 */
export function hideDeveloperItems() {
  return import.meta.env?.PROD && !isDevMode()
}
