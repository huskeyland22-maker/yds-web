/**
 * Macro Risk 레이어 점진 배포 플래그.
 * Vite: VITE_ENABLE_MACRO_RISK=1 또는 true
 */
export function isMacroRiskEnabled() {
  const v = import.meta.env.VITE_ENABLE_MACRO_RISK
  return v === "1" || String(v ?? "").toLowerCase() === "true"
}
