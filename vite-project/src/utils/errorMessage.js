/**
 * UI용 에러 메시지 (객체를 절대 그대로 렌더하지 않음).
 */

/** @param {unknown} value @param {string} [fallback] */
export function toErrorMessage(value, fallback = "") {
  if (value == null) return fallback
  if (typeof value === "string") {
    const t = value.trim()
    if (!t || t === "[object Object]") return fallback
    return t
  }
  if (value instanceof Error) return toErrorMessage(value.message, fallback)
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (typeof value === "object") {
    const o = /** @type {Record<string, unknown>} */ (value)
    const nested = o.message ?? o.msg1 ?? o.error ?? o.hint
    if (nested != null && nested !== value) return toErrorMessage(nested, fallback)
  }
  return fallback
}

/**
 * @param {unknown} body API JSON
 * @param {number} status HTTP status
 */
export function stockApiErrorFromBody(body, status) {
  const code = typeof body?.error === "string" ? body.error : ""
  const technical = toErrorMessage(body?.message ?? body?.hint ?? body?.error, "")

  if (code === "kis_required") {
    return {
      title: "데이터 연결 중 문제가 발생했습니다.",
      detail: "국내 종목은 KIS API 설정이 필요합니다. 잠시 후 다시 시도해주세요.",
      code,
      technical,
    }
  }
  if (code === "kis_fetch_failed") {
    return {
      title: "데이터를 불러오지 못했습니다.",
      detail: "종목 데이터를 확인해주세요. API 응답 오류",
      code,
      technical: technical || "KIS API 오류",
    }
  }
  if (code === "chart_fetch_failed") {
    return {
      title: "데이터를 불러오지 못했습니다.",
      detail: "종목 데이터를 확인해주세요.",
      code,
      technical,
    }
  }
  if (status >= 500) {
    return {
      title: "데이터 연결 중 문제가 발생했습니다.",
      detail: "잠시 후 다시 시도해주세요.",
      code: code || "server_error",
      technical: technical || `HTTP ${status}`,
    }
  }
  return {
    title: "데이터를 불러오지 못했습니다.",
    detail: "잠시 후 다시 시도해주세요.",
    code: code || "request_failed",
    technical: technical || `HTTP ${status}`,
  }
}

/** @param {unknown} err */
export function stockFetchErrorFromException(err) {
  if (err?.name === "AbortError") {
    return {
      title: "요청이 취소되었습니다.",
      detail: "",
      code: "aborted",
      technical: "",
    }
  }
  const msg = toErrorMessage(err instanceof Error ? err.message : err, "")
  if (/시간이 초과|timeout/i.test(msg)) {
    return {
      title: "응답 시간이 초과되었습니다.",
      detail: "네트워크를 확인한 뒤 다시 시도해주세요.",
      code: "timeout",
      technical: msg,
    }
  }
  if (msg && msg !== "[object Object]") {
    return {
      title: "데이터를 불러오지 못했습니다.",
      detail: "잠시 후 다시 시도해주세요.",
      code: "client_error",
      technical: msg,
    }
  }
  return {
    title: "데이터 연결 중 문제가 발생했습니다.",
    detail: "잠시 후 다시 시도해주세요.",
    code: "unknown",
    technical: "",
  }
}
