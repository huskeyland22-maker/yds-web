/**
 * Macro Risk 레이어 배포 플래그.
 * VITE_ENABLE_MACRO_RISK=0|false 로만 명시적 OFF.
 * 미설정 시 ON (모바일·데스크 메뉴·라우트 공통).
 */
export function isMacroRiskEnabled() {
  const v = import.meta.env.VITE_ENABLE_MACRO_RISK
  const s = String(v ?? "").toLowerCase().trim()
  if (s === "0" || s === "false" || s === "off") return false
  if (s === "1" || s === "true" || s === "on") return true
  return true
}
