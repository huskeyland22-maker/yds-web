/**
 * `updatedAt` / `updated_at` 기준으로 고정 샘플·과거 정적 JSON(예: 2024-01-05)을 배제합니다.
 * @param {unknown} data
 */
export function isPanicBusinessDataStale(data) {
  if (!data || typeof data !== "object") return true
  const u = String(data.updatedAt ?? data.updated_at ?? "").trim()
  if (!u) return false
  if (/^2024-01-05/.test(u)) return true
  if (/^2024-/.test(u)) return true
  const isoish = u.includes("T") ? u : u.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?)/, "$1T$2")
  const t = Date.parse(isoish)
  if (!Number.isFinite(t)) return false
  if (t < Date.UTC(2025, 0, 1)) return true
  const maxAgeMs = 120 * 86400000
  if (Date.now() - t > maxAgeMs) return true
  return false
}

/**
 * STEP 12: 패닉 API 페이로드 신뢰도 검증 (VIX·F&G + 비즈니스 날짜 신선도).
 * @param {unknown} data
 * @returns {boolean}
 */
export function validatePanicData(data) {
  if (!data) return false

  const vix = Number(data.vix)
  const fearGreed = Number(data.fearGreed)

  if (!Number.isFinite(vix) || vix < 0 || vix > 100) return false
  if (!Number.isFinite(fearGreed) || fearGreed < 0 || fearGreed > 100) return false
  if (isPanicBusinessDataStale(data)) return false

  return true
}
