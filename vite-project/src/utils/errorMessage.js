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
    const nested = o.message ?? o.msg1 ?? o.error ?? o.hint ?? o.reason ?? o.detail
    if (nested != null && nested !== value) {
      const fromNested = toErrorMessage(nested, "")
      if (fromNested) return fromNested
    }
    try {
      const json = JSON.stringify(value)
      if (json && json !== "{}" && json !== "[object Object]") return json
    } catch {
      // ignore
    }
  }
  return fallback
}

/** 저장 실패 콘솔 로그 (payload/response 디버깅용) */
export function logSaveError(label, error) {
  console.error(`${label}:`, error)
  try {
    if (error instanceof Error) {
      const plain = {
        name: error.name,
        message: error.message,
        status: /** @type {Error & { status?: number }} */ (error).status,
        stage: /** @type {Error & { stage?: string }} */ (error).stage,
        code: /** @type {Error & { code?: string }} */ (error).code,
        stack: error.stack,
        history: /** @type {Error & { history?: unknown }} */ (error).history,
      }
      console.error(JSON.stringify(plain, null, 2))
    } else {
      console.error(JSON.stringify(error, null, 2))
    }
  } catch {
    console.error(toErrorMessage(error, "unknown error"))
  }
}

/**
 * User-facing save error text. Never includes JS stacks (those belong in console only).
 * @param {unknown} error
 * @param {string} [fallback]
 */
export function formatSaveErrorForUi(error, fallback = "unknown error") {
  if (error == null) return fallback

  const code =
    error instanceof Error
      ? /** @type {Error & { code?: string }} */ (error).code
      : typeof error === "object" && error && "code" in error
        ? /** @type {{ code?: string }} */ (error).code
        : undefined
  const missing =
    error instanceof Error
      ? /** @type {Error & { missing?: string[] }} */ (error).missing
      : typeof error === "object" && error && "missing" in error
        ? /** @type {{ missing?: string[] }} */ (error).missing
        : undefined
  const status =
    error instanceof Error
      ? /** @type {Error & { status?: number }} */ (error).status
      : typeof error === "object" && error && "status" in error
        ? /** @type {{ status?: number }} */ (error).status
        : undefined
  const stage =
    error instanceof Error
      ? /** @type {Error & { stage?: string }} */ (error).stage
      : typeof error === "object" && error && "stage" in error
        ? /** @type {{ stage?: string }} */ (error).stage
        : undefined
  const msg = toErrorMessage(
    error instanceof Error ? error.message : error,
    "",
  )

  if (
    code === "INCOMPLETE_CORE_METRICS" ||
    (Array.isArray(missing) && missing.length > 0) ||
    /incomplete_core_metrics|INCOMPLETE_CORE_METRICS/i.test(msg)
  ) {
    const labels = Array.isArray(missing) && missing.length ? missing.join(", ") : null
    return labels
      ? `저장할 수 없습니다.\n누락된 핵심 지표: ${labels}`
      : "저장할 수 없습니다.\n핵심 Panic Index 3개(VIX · CNN Fear & Greed · Put/Call)가 모두 입력되어야 저장할 수 있습니다."
  }

  if (
    code === "preview_schema_missing" ||
    /preview_schema_missing|Staging DB에 panic|panic_index_history/i.test(msg)
  ) {
    const lines = [
      "클라우드 저장에 실패했습니다.",
      "Preview Staging DB에 panic 테이블이 없습니다.",
      "Staging에 scripts/staging-panic-bootstrap.sql 적용 후 다시 시도하세요.",
      "입력한 값은 이 화면에 유지됩니다.",
    ]
    if (status != null) lines.push(`status: ${status}`)
    if (stage) lines.push(`stage: ${stage}`)
    return lines.join("\n")
  }

  const lines = []
  if (msg) lines.push(msg)
  if (status != null) lines.push(`status: ${status}`)
  if (stage) lines.push(`stage: ${stage}`)
  // Intentionally omit error.stack — mobile users were seeing vite index-*.js frames.
  const text = lines.filter(Boolean).join("\n")
  return text || fallback
}

/**
 * @param {unknown} body API JSON
 * @param {number} status HTTP status
 */
export function stockApiErrorFromBody(body, status) {
  const code =
    typeof body?.errorCode === "string"
      ? body.errorCode
      : typeof body?.error === "string" && body.error !== "true"
        ? body.error
        : ""
  const kisDetail = toErrorMessage(body?.msg1 ?? body?.message, "")
  const technical =
    kisDetail ||
    toErrorMessage(body?.hint, "") ||
    (body?.msg_cd ? `KIS ${body.msg_cd}` : "") ||
    (typeof body?.error === "string" && body.error !== "true" ? body.error : "")

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
      detail: kisDetail || "종목 데이터를 확인해주세요. KIS API 응답 오류",
      code,
      technical: technical || "KIS API 오류",
      msg_cd: body?.msg_cd ?? null,
      msg1: body?.msg1 ?? null,
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
