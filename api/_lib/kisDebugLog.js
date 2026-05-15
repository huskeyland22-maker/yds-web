/**
 * KIS 서버 디버그 로그 (Vercel Functions 로그 / 로컬 터미널).
 * UI에는 노출하지 않음.
 */

const PREFIX = "[KIS]"

/** @param {string} token */
function maskToken(token) {
  if (typeof token !== "string" || !token) return "(empty)"
  if (token.length <= 12) return `${token.slice(0, 4)}…`
  return `${token.slice(0, 8)}…${token.slice(-4)} (len=${token.length})`
}

/** @param {unknown} body */
export function inspectKisOutputFields(body) {
  if (!body || typeof body !== "object") {
    return { hasOutput: false, hasOutput1: false, hasOutput2: false, output2Len: 0 }
  }
  const b = /** @type {Record<string, unknown>} */ (body)
  const o2 = b.output2
  return {
    hasOutput: b.output != null,
    hasOutput1: b.output1 != null,
    hasOutput2: Array.isArray(o2),
    output2Len: Array.isArray(o2) ? o2.length : typeof o2 === "object" && o2 ? 1 : 0,
    rt_cd: b.rt_cd != null ? String(b.rt_cd) : null,
    msg_cd: b.msg_cd != null ? String(b.msg_cd) : null,
    msg1: typeof b.msg1 === "string" ? b.msg1 : null,
  }
}

/**
 * @param {string} step
 * @param {Record<string, unknown>} [data]
 */
export function logKis(step, data = {}) {
  console.log(PREFIX, step, data)
}

/**
 * @param {string} step
 * @param {Record<string, unknown>} [data]
 */
export function logKisWarn(step, data = {}) {
  console.warn(PREFIX, step, data)
}

/**
 * @param {string} step
 * @param {unknown} err
 * @param {Record<string, unknown>} [data]
 */
export function logKisError(step, err, data = {}) {
  const message = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack : undefined
  console.error(PREFIX, step, { ...data, message, stack })
}

export function logKisRequestStart(meta) {
  logKis("request start", meta)
}

export function logKisTokenResult(meta) {
  logKis("access token", {
    ...meta,
    accessToken: maskToken(/** @type {string} */ (meta.accessToken)),
  })
}

export function logKisHttpRequest(meta) {
  logKis("HTTP request", meta)
}

/**
 * @param {Record<string, unknown>} meta
 * @param {unknown} body
 */
export function logKisHttpResponse(meta, body) {
  const inspection = inspectKisOutputFields(body)
  const rt = inspection.rt_cd
  const rtOk = rt == null || rt === "" || rt === "0"

  logKis("HTTP response", {
    ...meta,
    httpStatus: meta.httpStatus,
    rt_cd: rt,
    rt_cd_ok: rtOk,
    ...inspection,
  })

  console.log(PREFIX, "response body", body)

  if (!rtOk) {
    logKisWarn("rt_cd !== 0", {
      rt_cd: rt,
      msg_cd: inspection.msg_cd,
      msg1: inspection.msg1,
      symbol: meta.symbol,
      market: meta.market,
    })
  }

  if (!inspection.hasOutput2) {
    logKisWarn("output2 missing or not array", {
      hasOutput: inspection.hasOutput,
      hasOutput1: inspection.hasOutput1,
      symbol: meta.symbol,
      market: meta.market,
    })
  }
}

export { maskToken }
