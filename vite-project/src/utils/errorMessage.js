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

/** UI·setLog용 — [object Object] 금지, status·message·stack 포함 */
export function formatSaveErrorForUi(error, fallback = "unknown error") {
  if (error == null) return fallback
  if (error instanceof Error) {
    const lines = []
    const msg = toErrorMessage(error.message, "")
    if (msg) lines.push(msg)
    const status = /** @type {Error & { status?: number }} */ (error).status
    if (status != null) lines.push(`status: ${status}`)
    const stage = /** @type {Error & { stage?: string }} */ (error).stage
    if (stage) lines.push(`stage: ${stage}`)
    if (error.stack) {
      lines.push(
        error.stack
          .split("\n")
          .slice(0, 5)
          .join("\n"),
      )
    }
    const text = lines.filter(Boolean).join("\n")
    return text || fallback
  }
  const msg = toErrorMessage(error, "")
  if (msg) return msg
  try {
    return JSON.stringify(error, null, 2)
  } catch {
    return fallback
  }
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
