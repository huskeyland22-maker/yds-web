/**
 * KIS Open API (서버 전용) — 토큰·일봉 조회·응답 검증.
 */

import {
  inspectKisOutputFields,
  logKis,
  logKisError,
  logKisHttpRequest,
  logKisHttpResponse,
  logKisTokenResult,
  logKisWarn,
} from "./kisDebugLog.js"
import { toErrorMessage } from "./toErrorMessage.js"

const TR_INQUIRE_DAILY_REAL = "FHKST03010100"
const TR_INQUIRE_DAILY_VIRTUAL = "VFHKST03010100"

let kisTokenCache = { accessToken: null, expiresAtMs: 0 }

export function normalizeDomesticStockCode(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "")
  if (!digits || digits.length > 6) return null
  return digits.padStart(6, "0")
}

export function getKisBaseUrl() {
  const custom = process.env.KIS_BASE_URL?.trim()
  if (custom) return custom.replace(/\/$/, "")
  const v = process.env.KIS_USE_VIRTUAL === "1" || process.env.KIS_USE_VIRTUAL === "true"
  return v ? "https://openapivts.koreainvestment.com:29443" : "https://openapi.koreainvestment.com:9443"
}

export function isKisVirtualMode() {
  return process.env.KIS_USE_VIRTUAL === "1" || process.env.KIS_USE_VIRTUAL === "true"
}

function getKisDailyTrId() {
  const override = process.env.KIS_TR_ID_DAILY?.trim()
  if (override) return override
  return isKisVirtualMode() ? TR_INQUIRE_DAILY_VIRTUAL : TR_INQUIRE_DAILY_REAL
}

function formatYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}${m}${day}`
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
 * @param {unknown} data
 * @param {{ symbol?: string; market?: string }} [ctx]
 */
export function validateKisDailyResponse(data, ctx = {}) {
  const inspection = inspectKisOutputFields(data)
  logKis("validate response fields", { symbol: ctx.symbol, market: ctx.market, ...inspection })

  if (!data || typeof data !== "object") {
    throw new Error("KIS API 응답이 비어 있습니다")
  }
  const d = /** @type {Record<string, unknown>} */ (data)
  const rt = String(d.rt_cd ?? "")
  if (rt && rt !== "0") {
    logKisWarn("validate failed: rt_cd !== 0", {
      rt_cd: rt,
      msg1: d.msg1,
      msg_cd: d.msg_cd,
      symbol: ctx.symbol,
      market: ctx.market,
    })
    throw new Error(toErrorMessage(d.msg1 || d.msg_cd, "KIS API 오류"))
  }
  if (!Array.isArray(d.output2)) {
    logKisWarn("validate failed: output2 missing", {
      hasOutput: inspection.hasOutput,
      hasOutput1: inspection.hasOutput1,
      symbol: ctx.symbol,
      market: ctx.market,
    })
    throw new Error("KIS API 응답 형식 오류: output2 없음")
  }
  return d
}

function kisDomesticHeaders(accessToken, appKey, appSecret) {
  return {
    "content-type": "application/json; charset=UTF-8",
    authorization: `Bearer ${accessToken}`,
    appkey: appKey,
    appsecret: appSecret,
    tr_id: getKisDailyTrId(),
    custtype: "P",
  }
}

export function rowsFromKisOutput2(rawList) {
  const asc = [...(Array.isArray(rawList) ? rawList : [])].reverse()
  const rows = []
  for (const row of asc) {
    const close = parseFloat(String(row.stck_clpr ?? "").replace(/,/g, ""))
    const open = parseFloat(String(row.stck_oprc ?? "").replace(/,/g, ""))
    const high = parseFloat(String(row.stck_hgpr ?? "").replace(/,/g, ""))
    const low = parseFloat(String(row.stck_lwpr ?? "").replace(/,/g, ""))
    const vol = parseFloat(String(row.acml_vol ?? "").replace(/,/g, ""))
    if (!Number.isFinite(close)) continue
    rows.push({
      open: Number.isFinite(open) ? open : close,
      high: Number.isFinite(high) ? high : close,
      low: Number.isFinite(low) ? low : close,
      close,
      volume: Number.isFinite(vol) ? vol : 0,
      date: row.stck_bsop_date ? String(row.stck_bsop_date) : null,
    })
  }
  return rows
}

export async function getKisAccessToken(baseUrl, appKey, appSecret) {
  const virtual = isKisVirtualMode()
  const mode = virtual ? "모의" : "실전"
  const now = Date.now()

  if (kisTokenCache.accessToken && now < kisTokenCache.expiresAtMs - 45_000) {
    assertValidAccessToken(kisTokenCache.accessToken)
    logKisTokenResult({
      mode,
      virtual,
      source: "cache",
      baseUrl,
      expiresAtMs: kisTokenCache.expiresAtMs,
      accessToken: kisTokenCache.accessToken,
    })
    return kisTokenCache.accessToken
  }

  const url = `${baseUrl}/oauth2/tokenP`
  logKisHttpRequest({ phase: "token", mode, virtual, method: "POST", url })

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
  let j = {}
  try {
    j = JSON.parse(text)
  } catch (parseErr) {
    logKisError("token parse failed", parseErr, { httpStatus: res.status, rawPreview: text.slice(0, 200) })
    throw new Error(`KIS 토큰 응답 파싱 실패 (${res.status})`)
  }

  logKisHttpResponse(
    { phase: "token", mode, virtual, httpStatus: res.status, httpOk: res.ok },
    j,
  )

  if (!res.ok) {
    const err = new Error(toErrorMessage(j.message || j.error_description, `KIS 토큰 HTTP ${res.status}`))
    logKisError("token HTTP error", err, { httpStatus: res.status })
    throw err
  }

  const tok = j.access_token
  try {
    assertValidAccessToken(tok)
  } catch (e) {
    logKisError("token invalid", e, { hasAccessToken: Boolean(tok) })
    throw e
  }

  let expMs = now + (Number(j.expires_in) || 23 * 3600) * 1000
  const parsed = parseKisExpiryMs(j.access_token_token_expired)
  if (parsed != null) expMs = Math.min(expMs, parsed - 60_000)
  kisTokenCache = { accessToken: tok, expiresAtMs: expMs }

  logKisTokenResult({
    mode,
    virtual,
    source: "fresh",
    baseUrl,
    httpStatus: res.status,
    expires_in: j.expires_in,
    expiresAtMs: expMs,
    accessToken: tok,
  })

  return tok
}

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} appKey
 * @param {string} appSecret
 * @param {string} code 6자리 (앞자리 0 유지)
 */
export async function fetchKisDailyRows(baseUrl, accessToken, appKey, appSecret, code) {
  const normalized = normalizeDomesticStockCode(code)
  if (!normalized) throw new Error("유효하지 않은 국내 종목코드")

  const virtual = isKisVirtualMode()
  const mode = virtual ? "모의" : "실전"

  logKis("stock code", { raw: code, normalized, symbol: normalized })

  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 420)
  let lastErr = null

  for (const mrkt of ["J", "Q"]) {
    const marketLabel = mrkt === "J" ? "KOSPI" : "KOSDAQ"
    const params = new URLSearchParams({
      fid_cond_mrkt_div_code: mrkt,
      fid_input_iscd: normalized,
      fid_input_date_1: formatYmd(start),
      fid_input_date_2: formatYmd(end),
      fid_period_div_code: "D",
      fid_org_adj_prc: "0",
    })
    const url = `${baseUrl}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?${params.toString()}`

    logKisHttpRequest({
      phase: "daily",
      mode,
      virtual,
      method: "GET",
      url,
      symbol: normalized,
      market: marketLabel,
      tr_id: getKisDailyTrId(),
    })

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: kisDomesticHeaders(accessToken, appKey, appSecret),
        cache: "no-store",
      })
      const text = await res.text()
      let data = {}
      try {
        data = JSON.parse(text)
      } catch (parseErr) {
        logKisError("daily parse failed", parseErr, {
          httpStatus: res.status,
          symbol: normalized,
          market: marketLabel,
          rawPreview: text.slice(0, 300),
        })
        throw new Error(`KIS 일봉 응답 파싱 실패 (${res.status})`)
      }

      logKisHttpResponse(
        {
          phase: "daily",
          mode,
          virtual,
          httpStatus: res.status,
          httpOk: res.ok,
          symbol: normalized,
          market: marketLabel,
        },
        data,
      )

      if (!res.ok) {
        throw new Error(toErrorMessage(data.msg1 || data.message, `KIS 일봉 HTTP ${res.status}`))
      }

      const validated = validateKisDailyResponse(data, { symbol: normalized, market: marketLabel })
      const rows = rowsFromKisOutput2(validated.output2)
      logKis("daily rows parsed", { symbol: normalized, market: marketLabel, barCount: rows.length })

      if (rows.length >= 70) return rows
      lastErr = new Error(`KIS 일봉 데이터 부족 (${mrkt}, ${rows.length}봉)`)
      logKisWarn("short history, try next market", {
        symbol: normalized,
        market: marketLabel,
        barCount: rows.length,
      })
    } catch (e) {
      lastErr = e
      logKisError("daily fetch failed", e, { symbol: normalized, market: marketLabel })
    }
  }

  logKisError("daily all markets failed", lastErr, { symbol: normalized })
  throw lastErr instanceof Error ? lastErr : new Error("KIS 일봉 조회 실패")
}

export function getKisEnvStatus() {
  const appKey = process.env.KIS_APP_KEY?.trim()
  const appSecret = process.env.KIS_APP_SECRET?.trim()
  return {
    configured: Boolean(appKey && appSecret),
    virtual: isKisVirtualMode(),
    mode: isKisVirtualMode() ? "모의" : "실전",
    baseUrl: getKisBaseUrl(),
    trId: getKisDailyTrId(),
    tokenCached: Boolean(kisTokenCache.accessToken && Date.now() < kisTokenCache.expiresAtMs - 45_000),
  }
}
