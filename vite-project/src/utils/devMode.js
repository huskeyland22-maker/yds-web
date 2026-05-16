/**
 * 프로덕션 UI vs 개발자 도구 분리.
 * 일반 사용자: debug/RAW/sync 패널 숨김.
 */
export function isDevMode() {
  if (import.meta.env.DEV) return true
  if (typeof window === "undefined") return false
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.get("dev") === "1" || q.get("debug") === "1") return true
    if (window.localStorage?.getItem("yds-dev-mode") === "1") return true
  } catch {
    // ignore
  }
  return false
}
