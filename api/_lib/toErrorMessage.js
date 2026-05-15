/**
 * API·KIS 오류를 UI/API JSON에 넣을 수 있는 문자열로 변환 (객체 직렬화 방지).
 * @param {unknown} value
 * @param {string} [fallback]
 */
export function toErrorMessage(value, fallback = "알 수 없는 오류") {
  if (value == null) return fallback
  if (typeof value === "string") {
    const t = value.trim()
    return t || fallback
  }
  if (value instanceof Error) return toErrorMessage(value.message, fallback)
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (typeof value === "object") {
    const o = /** @type {Record<string, unknown>} */ (value)
    const nested = o.message ?? o.msg1 ?? o.msg_cd ?? o.error_description ?? o.error
    if (nested != null && nested !== value) return toErrorMessage(nested, fallback)
    try {
      const s = JSON.stringify(value)
      if (s && s !== "{}") return s.length > 240 ? `${s.slice(0, 240)}…` : s
    } catch {
      /* ignore */
    }
  }
  return fallback
}
