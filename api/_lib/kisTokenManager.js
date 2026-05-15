/**
 * KIS access token — 서버 전용 자동 발급·캐시·갱신.
 * APP_KEY / APP_SECRET 은 process.env (Vercel) 만 사용. 브라우저 노출 없음.
 */

import { logKis, logKisError, logKisHttpRequest, logKisHttpResponse, logKisTokenResult, logKisWarn } from "./kisDebugLog.js"
import { toErrorMessage } from "./toErrorMessage.js"

/** 만료 5분 전부터 선제 재발급 */
export const KIS_TOKEN_REFRESH_BEFORE_MS = 5 * 60 * 1000

/** 만료 시각 파싱 여유 */
const EXPIRY_SKEW_MS = 30_000

/** @type {{ accessToken: string | null; expiresAtMs: number; issuedAtMs: number }} */
let tokenCache = {
  accessToken: null,
  expiresAtMs: 0,
  issuedAtMs: 0,
}

/** 동시 요청 시 토큰 발급 1회만 */
let refreshInFlight = null

function getKisBaseUrl() {
  const custom = process.env.KIS_BASE_URL?.trim()
  if (custom) return custom.replace(/\/$/, "")
  const v = process.env.KIS_USE_VIRTUAL === "1" || process.env.KIS_USE_VIRTUAL === "true"
  return v ? "https://openapivts.koreainvestment.com:29443" : "https://openapi.koreainvestment.com:9443"
}

export function isKisVirtualMode() {
  return process.env.KIS_USE_VIRTUAL === "1" || process.env.KIS_USE_VIRTUAL === "true"
}

function getKisModeLabel() {
  return isKisVirtualMode() ? "모의" : "실전"
}

/** @returns {{ appKey: string; appSecret: string }} */
export function getKisCredentialsFromEnv() {
  const appKey = process.env.KIS_APP_KEY?.trim()
  const appSecret = process.env.KIS_APP_SECRET?.trim()
  if (!appKey || !appSecret) {
    const err = new Error("KIS_APP_KEY / KIS_APP_SECRET not configured")
    err.code = "kis_not_configured"
    throw err
  }
  return { appKey, appSecret }
}

function parseKisExpiryMs(raw) {
  if (raw == null) return null
  const s = String(raw).trim()
  if (/^\d{14}$/.test(s)) {
    return new Date(
      +s.slice(0, 4),
      +s.slice(4, 6) - 1,
      +s.slice(6, 8),
      +s.slice(8, 10),
      +s.slice(10, 12),
      +s.slice(12, 14),
    ).getTime()
  }
  const t = Date.parse(s)
  return Number.isFinite(t) ? t : null
}

function assertValidAccessToken(tok) {
  if (typeof tok !== "string" || tok.length < 8) {
    throw new Error("KIS access token이 유효하지 않습니다")
  }
}

/**
 * @param {number} [now]
 */
export function isKisTokenCacheValid(now = Date.now()) {
  if (!tokenCache.accessToken || !tokenCache.expiresAtMs) return false
  return now < tokenCache.expiresAtMs - KIS_TOKEN_REFRESH_BEFORE_MS
}

export function invalidateKisTokenCache(reason = "manual") {
  logKisWarn("token cache invalidate", { reason, hadToken: Boolean(tokenCache.accessToken) })
  tokenCache = { accessToken: null, expiresAtMs: 0, issuedAtMs: 0 }
}

/**
 * @param {number} httpStatus
 * @param {unknown} data
 */
export function isKisTokenAuthFailure(httpStatus, data) {
  if (httpStatus === 401 || httpStatus === 403) return true
  if (!data || typeof data !== "object") return false
  const d = /** @type {Record<string, unknown>} */ (data)
  const blob = `${d.msg1 ?? ""} ${d.msg_cd ?? ""} ${d.message ?? ""}`.toLowerCase()
  return /token|oauth|인증|만료|expired|unauthorized|appkey|appsecret|egw00123/.test(blob)
}

export function getKisTokenCacheStatus(now = Date.now()) {
  const valid = isKisTokenCacheValid(now)
  const msUntilRefresh =
    tokenCache.expiresAtMs > 0
      ? tokenCache.expiresAtMs - KIS_TOKEN_REFRESH_BEFORE_MS - now
      : null
  return {
    cached: Boolean(tokenCache.accessToken),
    valid,
    issuedAtMs: tokenCache.issuedAtMs || null,
    expiresAtMs: tokenCache.expiresAtMs || null,
    expiresInSec:
      tokenCache.expiresAtMs > now ? Math.max(0, Math.floor((tokenCache.expiresAtMs - now) / 1000)) : 0,
    refreshBeforeMs: KIS_TOKEN_REFRESH_BEFORE_MS,
    refreshInSec:
      msUntilRefresh != null && msUntilRefresh > 0 ? Math.floor(msUntilRefresh / 1000) : 0,
    refreshInFlight: Boolean(refreshInFlight),
  }
}

async function requestNewAccessToken() {
  const { appKey, appSecret } = getKisCredentialsFromEnv()
  const baseUrl = getKisBaseUrl()
  const virtual = isKisVirtualMode()
  const mode = getKisModeLabel()
  const now = Date.now()
  const url = `${baseUrl}/oauth2/tokenP`

  logKisHttpRequest({ phase: "token", mode, virtual, method: "POST", url, autoRenew: true })

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json; charset=UTF-8" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: appKey,
      appsecret: appSecret,
    }),
  })

  const text = await res.text()
  let body = {}
  try {
    body = JSON.parse(text)
  } catch (parseErr) {
    logKisError("token parse failed", parseErr, { httpStatus: res.status, rawPreview: text.slice(0, 200) })
    const err = new Error(`KIS 토큰 응답 파싱 실패 (${res.status})`)
    err.code = "kis_token_parse_failed"
    throw err
  }

  logKisHttpResponse({ phase: "token", mode, virtual, httpStatus: res.status, httpOk: res.ok }, body)

  if (!res.ok) {
    const err = new Error(toErrorMessage(body.message || body.error_description, `KIS 토큰 HTTP ${res.status}`))
    err.code = "kis_token_http_error"
    logKisError("token HTTP error", err, { httpStatus: res.status })
    throw err
  }

  const tok = body.access_token
  try {
    assertValidAccessToken(tok)
  } catch (e) {
    logKisError("token invalid", e, { hasAccessToken: Boolean(tok) })
    throw e
  }

  let expMs = now + (Number(body.expires_in) || 23 * 3600) * 1000
  const parsed = parseKisExpiryMs(body.access_token_token_expired)
  if (parsed != null) expMs = Math.min(expMs, parsed - EXPIRY_SKEW_MS)

  tokenCache = {
    accessToken: tok,
    expiresAtMs: expMs,
    issuedAtMs: now,
  }

  logKisTokenResult({
    mode,
    virtual,
    source: "auto_issue",
    baseUrl,
    httpStatus: res.status,
    expires_in: body.expires_in,
    expiresAtMs: expMs,
    refreshBeforeMs: KIS_TOKEN_REFRESH_BEFORE_MS,
    accessToken: tok,
  })

  return tok
}

/**
 * 유효 토큰 반환. 만료 5분 전이면 자동 재발급. (서버 전용)
 * @param {{ forceRefresh?: boolean }} [opts]
 */
export async function getKisAccessToken(opts = {}) {
  if (opts.forceRefresh) {
    invalidateKisTokenCache("force_refresh")
  }

  const now = Date.now()
  if (isKisTokenCacheValid(now) && tokenCache.accessToken) {
    logKisTokenResult({
      mode: getKisModeLabel(),
      virtual: isKisVirtualMode(),
      source: "cache",
      expiresAtMs: tokenCache.expiresAtMs,
      expiresInSec: Math.floor((tokenCache.expiresAtMs - now) / 1000),
      refreshInSec: Math.floor((tokenCache.expiresAtMs - KIS_TOKEN_REFRESH_BEFORE_MS - now) / 1000),
      accessToken: tokenCache.accessToken,
    })
    return tokenCache.accessToken
  }

  const reason = tokenCache.accessToken ? "expiring_soon_or_expired" : "cold_start"
  logKis("token auto renew", { reason, ...getKisTokenCacheStatus(now) })

  if (!refreshInFlight) {
    refreshInFlight = requestNewAccessToken()
      .catch((e) => {
        logKisError("token auto renew failed", e, { reason })
        throw e
      })
      .finally(() => {
        refreshInFlight = null
      })
  }

  return refreshInFlight
}

/**
 * KIS API 호출 래퍼: 토큰 선확인 → 실패 시 1회 재발급 후 재시도.
 * @template T
 * @param {(accessToken: string) => Promise<T>} fn
 * @param {{ label?: string }} [ctx]
 */
export async function withKisAccessToken(fn, ctx = {}) {
  const label = ctx.label || "kis_api"
  let token = await getKisAccessToken()
  try {
    return await fn(token)
  } catch (e) {
    if (e?.kisTokenRetried) throw e
    if (!e?.kisTokenRetryable) throw e

    logKisWarn("API auth failed — invalidate token and retry once", { label, message: e?.message })
    invalidateKisTokenCache("api_auth_failure")
    token = await getKisAccessToken({ forceRefresh: true })
    try {
      const result = await fn(token)
      logKis("API retry success after token renew", { label })
      return result
    } catch (retryErr) {
      retryErr.kisTokenRetried = true
      logKisError("API retry failed after token renew", retryErr, { label })
      throw retryErr
    }
  }
}
