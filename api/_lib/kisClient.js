/**
 * KIS Open API (서버 전용) — 토큰·일봉 조회·응답 검증.
 */

import {
  inspectKisOutputFields,
  logKis,
  logKisError,
  logKisHttpRequest,
  logKisHttpResponse,
  logKisWarn,
} from "./kisDebugLog.js"
import {
  getKisCredentialsFromEnv,
  getKisTokenCacheStatus,
  isKisTokenAuthFailure,
  withKisAccessToken,
} from "./kisTokenManager.js"
import { toErrorMessage } from "./toErrorMessage.js"

export { getKisAccessToken, getKisTokenCacheStatus, invalidateKisTokenCache } from "./kisTokenManager.js"

const TR_INQUIRE_DAILY_REAL = "FHKST03010100"
const TR_INQUIRE_DAILY_VIRTUAL = "VFHKST03010100"
const TR_INQUIRE_PRICE_REAL = "FHKST01010100"
const TR_INQUIRE_PRICE_VIRTUAL = "VFHKST01010100"

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

function getKisPriceTrId() {
  const override = process.env.KIS_TR_ID_PRICE?.trim()
  if (override) return override
  return isKisVirtualMode() ? TR_INQUIRE_PRICE_VIRTUAL : TR_INQUIRE_PRICE_REAL
}

/** @param {unknown} v */
function parseKisNum(v) {
  const n = parseFloat(String(v ?? "").replace(/,/g, ""))
  return Number.isFinite(n) ? n : null
}

/** KIS API 비즈니스 오류 (msg_cd / msg1 보존) */
export class KisApiError extends Error {
  /**
   * @param {string} message
   * @param {{ msg_cd?: unknown; msg1?: unknown; rt_cd?: unknown; httpStatus?: number; phase?: string }} [meta]
   */
  constructor(message, meta = {}) {
    super(message)
    this.name = "KisApiError"
    this.msg_cd = meta.msg_cd != null ? String(meta.msg_cd) : null
    this.msg1 = meta.msg1 != null ? String(meta.msg1) : null
    this.rt_cd = meta.rt_cd != null ? String(meta.rt_cd) : null
    this.httpStatus = meta.httpStatus
    this.phase = meta.phase
    this.kisApiError = true
  }
}

/**
 * @param {unknown} data
 * @param {{ symbol?: string; phase?: string }} [ctx]
 */
export function logKisRawResponse(data, ctx = {}) {
  console.log("[KIS RAW RESPONSE]", JSON.stringify(data, null, 2))
  if (ctx.symbol || ctx.phase) {
    logKis("raw response context", ctx)
  }
}

/**
 * output → output1 → output2 우선순위 (단일 블록).
 * @param {unknown} data
 */
export function pickKisOutput(data) {
  if (!data || typeof data !== "object") return null
  const d = /** @type {Record<string, unknown>} */ (data)
  if (d.output != null) return d.output
  if (d.output1 != null) return d.output1
  if (d.output2 != null) return d.output2
  return null
}

/** 일봉·시계열용 배열 (output2 → output1 → output → 단일 객체) */
export function pickKisOutputArray(data) {
  if (!data || typeof data !== "object") return []
  const d = /** @type {Record<string, unknown>} */ (data)
  if (Array.isArray(d.output2) && d.output2.length > 0) return d.output2
  if (Array.isArray(d.output1) && d.output1.length > 0) return d.output1
  if (Array.isArray(d.output) && d.output.length > 0) return d.output
  for (const key of ["output2", "output1", "output"]) {
    const block = d[key]
    if (block && typeof block === "object" && !Array.isArray(block)) {
      const row = /** @type {Record<string, unknown>} */ (block)
      if (row.stck_bsop_date != null || row.stck_clpr != null) return [block]
    }
  }
  return []
}

/** 현재가 조회용 단일 객체 */
export function pickKisOutputObject(data) {
  const out = pickKisOutput(data)
  if (out && typeof out === "object" && !Array.isArray(out)) {
    return /** @type {Record<string, unknown>} */ (out)
  }
  if (Array.isArray(out) && out[0] && typeof out[0] === "object") {
    return /** @type {Record<string, unknown>} */ (out[0])
  }
  return null
}

/**
 * @param {unknown} data
 * @param {number} [httpStatus]
 */
export function kisFailurePayload(data, httpStatus) {
  if (data instanceof KisApiError) {
    return {
      error: true,
      msg_cd: data.msg_cd,
      msg1: data.msg1,
      rt_cd: data.rt_cd,
      httpStatus: data.httpStatus ?? httpStatus ?? null,
    }
  }
  const d = data && typeof data === "object" ? /** @type {Record<string, unknown>} */ (data) : {}
  return {
    error: true,
    msg_cd: d.msg_cd != null ? String(d.msg_cd) : null,
    msg1: typeof d.msg1 === "string" ? d.msg1 : d.msg1 != null ? String(d.msg1) : null,
    rt_cd: d.rt_cd != null ? String(d.rt_cd) : null,
    httpStatus: httpStatus ?? null,
  }
}

/**
 * @param {unknown} data
 * @param {{ symbol?: string; market?: string; phase?: string; httpStatus?: number }} [ctx]
 */
export function assertKisOk(data, ctx = {}) {
  if (!data || typeof data !== "object") {
    throw new KisApiError("KIS API 응답이 비어 있습니다", { phase: ctx.phase, httpStatus: ctx.httpStatus })
  }
  const d = /** @type {Record<string, unknown>} */ (data)
  const rt = String(d.rt_cd ?? "")
  if (rt && rt !== "0") {
    throw new KisApiError(toErrorMessage(d.msg1 || d.msg_cd, "KIS API 오류"), {
      msg_cd: d.msg_cd,
      msg1: d.msg1,
      rt_cd: rt,
      phase: ctx.phase,
      httpStatus: ctx.httpStatus,
    })
  }
  return d
}

function formatYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}${m}${day}`
}

/**
 * @param {unknown} data
 * @param {{ symbol?: string; market?: string }} [ctx]
 */
export function validateKisDailyResponse(data, ctx = {}) {
  logKisRawResponse(data, { symbol: ctx.symbol, market: ctx.market, phase: "daily" })
  const inspection = inspectKisOutputFields(data)
  logKis("validate response fields", { symbol: ctx.symbol, market: ctx.market, ...inspection })

  const d = assertKisOk(data, { ...ctx, phase: "daily" })
  const dailyRows = pickKisOutputArray(d)
  if (!dailyRows.length) {
    logKisWarn("validate failed: no daily rows in output/output1/output2", {
      ...inspection,
      symbol: ctx.symbol,
      market: ctx.market,
    })
    throw new KisApiError("KIS API 응답 형식 오류: 일봉 데이터 없음", {
      msg_cd: d.msg_cd,
      msg1: d.msg1,
      rt_cd: d.rt_cd,
      phase: "daily",
    })
  }
  return { ...d, output2: dailyRows }
}

function kisDomesticHeaders(accessToken, appKey, appSecret, trId) {
  return {
    "content-type": "application/json; charset=UTF-8",
    authorization: `Bearer ${accessToken}`,
    appkey: appKey,
    appsecret: appSecret,
    tr_id: trId,
    custtype: "P",
  }
}

/**
 * 현재가 스냅샷 (FHKST01010100 output 필드).
 * @param {unknown} data
 */
export function parseKisPriceSnapshot(data) {
  const row = pickKisOutputObject(data)
  if (!row) return null
  const price = parseKisNum(row.stck_prpr)
  const changeAmount = parseKisNum(row.prdy_vrss)
  const changePct = parseKisNum(row.prdy_ctrt)
  const volume = parseKisNum(row.acml_vol)
  const prevClose = parseKisNum(row.stck_sdpr)
  if (price == null) return null
  return {
    price,
    changeAmount,
    changePct,
    volume,
    prevClose,
    raw: row,
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

/**
 * KIS 일봉 조회 (토큰 자동 관리·인증 실패 시 1회 재발급 후 재시도).
 * @param {string} code 6자리 (앞자리 0 유지)
 * @param {string} [baseUrl]
 */
export async function fetchKisDailyRows(code, baseUrl = getKisBaseUrl()) {
  const normalized = normalizeDomesticStockCode(code)
  if (!normalized) throw new Error("유효하지 않은 국내 종목코드")

  return withKisAccessToken(
    (accessToken) => fetchKisDailyRowsWithToken(baseUrl, accessToken, normalized, code),
    { label: `daily:${normalized}` },
  )
}

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} normalized
 * @param {string} rawCode
 */
async function fetchKisDailyRowsWithToken(baseUrl, accessToken, normalized, rawCode) {
  const { appKey, appSecret } = getKisCredentialsFromEnv()
  const virtual = isKisVirtualMode()
  const mode = virtual ? "모의" : "실전"

  logKis("stock code", { raw: rawCode, normalized, symbol: normalized, tokenStatus: getKisTokenCacheStatus() })

  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 420)
  let lastErr = null
  let sawAuthFailure = false

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
        headers: kisDomesticHeaders(accessToken, appKey, appSecret, getKisDailyTrId()),
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
      logKisRawResponse(data, { symbol: normalized, market: marketLabel, phase: "daily" })

      if (isKisTokenAuthFailure(res.status, data)) {
        sawAuthFailure = true
        const err = new Error(toErrorMessage(data.msg1 || data.message, "KIS 인증 오류 — 토큰 재발급 필요"))
        err.kisTokenRetryable = true
        throw err
      }

      if (!res.ok) {
        throw new KisApiError(toErrorMessage(data.msg1 || data.message, `KIS 일봉 HTTP ${res.status}`), {
          msg_cd: data.msg_cd,
          msg1: data.msg1,
          rt_cd: data.rt_cd,
          httpStatus: res.status,
          phase: "daily",
        })
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
      if (e?.kisTokenRetryable) throw e
      logKisError("daily fetch failed", e, { symbol: normalized, market: marketLabel })
    }
  }

  if (sawAuthFailure && lastErr?.kisTokenRetryable) throw lastErr

  logKisError("daily all markets failed", lastErr, { symbol: normalized })
  throw lastErr instanceof Error ? lastErr : new Error("KIS 일봉 조회 실패")
}

/**
 * 국내주식 현재가 (TR FHKST01010100). 종목코드는 6자리 문자열 유지.
 * @param {string} code
 * @param {string} [baseUrl]
 */
export async function fetchKisCurrentPrice(code, baseUrl = getKisBaseUrl()) {
  const normalized = normalizeDomesticStockCode(code)
  if (!normalized) throw new Error("유효하지 않은 국내 종목코드")

  return withKisAccessToken(
    (accessToken) => fetchKisCurrentPriceWithToken(baseUrl, accessToken, normalized, code),
    { label: `price:${normalized}` },
  )
}

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} normalized
 * @param {string} rawCode
 */
async function fetchKisCurrentPriceWithToken(baseUrl, accessToken, normalized, rawCode) {
  const { appKey, appSecret } = getKisCredentialsFromEnv()
  const virtual = isKisVirtualMode()
  const mode = virtual ? "모의" : "실전"
  const trId = getKisPriceTrId()

  logKis("stock code (price)", { raw: rawCode, normalized, tr_id: trId, tokenStatus: getKisTokenCacheStatus() })

  let lastErr = null
  let sawAuthFailure = false

  for (const mrkt of ["J", "Q"]) {
    const marketLabel = mrkt === "J" ? "KOSPI" : "KOSDAQ"
    const params = new URLSearchParams({
      FID_COND_MRKT_DIV_CODE: mrkt,
      FID_INPUT_ISCD: normalized,
    })
    const url = `${baseUrl}/uapi/domestic-stock/v1/quotations/inquire-price?${params.toString()}`

    logKisHttpRequest({
      phase: "price",
      mode,
      virtual,
      method: "GET",
      url,
      symbol: normalized,
      market: marketLabel,
      tr_id: trId,
    })

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: kisDomesticHeaders(accessToken, appKey, appSecret, trId),
        cache: "no-store",
      })
      const text = await res.text()
      let data = {}
      try {
        data = JSON.parse(text)
      } catch (parseErr) {
        logKisError("price parse failed", parseErr, {
          httpStatus: res.status,
          symbol: normalized,
          market: marketLabel,
          rawPreview: text.slice(0, 300),
        })
        throw new KisApiError(`KIS 현재가 응답 파싱 실패 (${res.status})`, { phase: "price", httpStatus: res.status })
      }

      logKisHttpResponse(
        {
          phase: "price",
          mode,
          virtual,
          httpStatus: res.status,
          httpOk: res.ok,
          symbol: normalized,
          market: marketLabel,
        },
        data,
      )
      logKisRawResponse(data, { symbol: normalized, market: marketLabel, phase: "price" })

      if (isKisTokenAuthFailure(res.status, data)) {
        sawAuthFailure = true
        const err = new KisApiError(toErrorMessage(data.msg1 || data.message, "KIS 인증 오류 — 토큰 재발급 필요"), {
          msg_cd: data.msg_cd,
          msg1: data.msg1,
          rt_cd: data.rt_cd,
          httpStatus: res.status,
          phase: "price",
        })
        err.kisTokenRetryable = true
        throw err
      }

      if (!res.ok) {
        throw new KisApiError(toErrorMessage(data.msg1 || data.message, `KIS 현재가 HTTP ${res.status}`), {
          msg_cd: data.msg_cd,
          msg1: data.msg1,
          rt_cd: data.rt_cd,
          httpStatus: res.status,
          phase: "price",
        })
      }

      assertKisOk(data, { symbol: normalized, market: marketLabel, phase: "price", httpStatus: res.status })
      const snap = parseKisPriceSnapshot(data)
      if (snap?.price != null) {
        logKis("price snapshot parsed", {
          symbol: normalized,
          market: marketLabel,
          price: snap.price,
          changePct: snap.changePct,
          volume: snap.volume,
        })
        return { ...snap, market: marketLabel, symbol: normalized }
      }
      lastErr = new KisApiError("KIS 현재가 필드 파싱 실패 (stck_prpr 없음)", {
        msg_cd: data.msg_cd,
        msg1: data.msg1,
        rt_cd: data.rt_cd,
        phase: "price",
      })
      logKisWarn("price output empty, try next market", { symbol: normalized, market: marketLabel })
    } catch (e) {
      lastErr = e
      if (e?.kisTokenRetryable) throw e
      logKisError("price fetch failed", e, { symbol: normalized, market: marketLabel })
    }
  }

  if (sawAuthFailure && lastErr?.kisTokenRetryable) throw lastErr
  throw lastErr instanceof Error ? lastErr : new KisApiError("KIS 현재가 조회 실패", { phase: "price" })
}

export function getKisEnvStatus() {
  const appKey = process.env.KIS_APP_KEY?.trim()
  const appSecret = process.env.KIS_APP_SECRET?.trim()
  const token = getKisTokenCacheStatus()
  return {
    configured: Boolean(appKey && appSecret),
    virtual: isKisVirtualMode(),
    mode: isKisVirtualMode() ? "모의" : "실전",
    baseUrl: getKisBaseUrl(),
    trIdDaily: getKisDailyTrId(),
    trIdPrice: getKisPriceTrId(),
    tokenCached: token.cached,
    tokenValid: token.valid,
    tokenExpiresInSec: token.expiresInSec,
    tokenRefreshInSec: token.refreshInSec,
  }
}
