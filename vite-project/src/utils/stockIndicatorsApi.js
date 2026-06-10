import { LIVE_JSON_GET_INIT, withNoStoreQuery } from "../config/liveDataFetch.js"
import { stockApiErrorFromBody, stockFetchErrorFromException } from "./errorMessage.js"

/** 서버 API Route — KIS 직접 호출 금지 */
const STOCK_API_PATH = "/api/stock"
const STOCK_BATCH_API_PATH = "/api/stock-batch"

/** @param {string} raw */
export function normalizeStockCodeParam(raw) {
  const s = String(raw ?? "").trim()
  if (!s) return ""
  const isDomestic = /^\d{4,6}$/.test(s.replace(/\D/g, "")) && !/[A-Za-z^]/.test(s)
  return isDomestic ? s.replace(/\D/g, "").padStart(6, "0") : s
}

function logClient(event, payload) {
  console.info(`[stock-client] ${event}`, payload)
}

function logClientError(event, payload, err) {
  console.error(`[stock-client] ${event}`, payload, err)
}

/**
 * GET /api/stock (서버 → KIS / Yahoo). 프론트는 KIS를 직접 호출하지 않음.
 *
 * @param {{ code: string; name?: string; signal?: AbortSignal }} opts
 * @returns {Promise<object>}
 */
export async function fetchStockIndicators({
  code,
  name,
  signal: userSignal,
  sectorScore,
  panicIndex,
} = {}) {
  if (!code) {
    const err = new Error("missing code")
    err.stockError = stockFetchErrorFromException(err)
    throw err
  }

  const normalizedCode = normalizeStockCodeParam(code)
  const qs = new URLSearchParams()
  qs.set("code", normalizedCode)
  if (name) qs.set("name", String(name))
  if (sectorScore != null && Number.isFinite(Number(sectorScore))) {
    qs.set("sectorScore", String(sectorScore))
  }
  if (panicIndex != null && Number.isFinite(Number(panicIndex))) {
    qs.set("panicIndex", String(panicIndex))
  }

  const apiUrl = withNoStoreQuery(`${STOCK_API_PATH}?${qs.toString()}`)
  logClient("request start (API route only, not KIS direct)", {
    apiRoute: STOCK_API_PATH,
    apiUrl,
    code: normalizedCode,
    name: name || null,
    kisDirectCall: false,
  })

  const ctrl = new AbortController()
  const tid = setTimeout(() => ctrl.abort(), 28_000)
  const onUserAbort = () => ctrl.abort()
  if (userSignal) {
    if (userSignal.aborted) {
      clearTimeout(tid)
      const err = new DOMException("Aborted", "AbortError")
      err.stockError = stockFetchErrorFromException(err)
      throw err
    }
    userSignal.addEventListener("abort", onUserAbort)
  }

  try {
    const res = await fetch(apiUrl, {
      ...LIVE_JSON_GET_INIT,
      signal: ctrl.signal,
    })
    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      const stockError = stockApiErrorFromBody(body, res.status)
      const err = new Error(stockError.detail || stockError.title)
      err.stockError = stockError
      err.httpStatus = res.status
      logClientError(
        "server API error (check Vercel [KIS] logs)",
        {
          code: normalizedCode,
          httpStatus: res.status,
          errorCode: body?.errorCode ?? body?.error,
          message: body?.msg1 ?? body?.message,
          msg_cd: body?.msg_cd,
          msg1: body?.msg1,
          kisEnv: body?.kisEnv,
          marketKind: body?.marketKind,
          uiMessage: stockError.title,
        },
        body,
      )
      throw err
    }

    logClient("request success", {
      code: normalizedCode,
      dataSource: body?.dataSource,
      symbol: body?.symbol,
      barsUsed: body?.barsUsed,
    })
    return body
  } catch (e) {
    if (e?.stockError) throw e
    if (e?.name === "AbortError") {
      const err = new Error(
        userSignal?.aborted ? "요청이 취소되었습니다." : "응답 시간이 초과되었습니다. 네트워크를 확인한 뒤 다시 시도하세요.",
      )
      err.stockError = stockFetchErrorFromException(e)
      logClientError("client abort/timeout", { code: normalizedCode, apiUrl }, e)
      throw err
    }
    logClientError(
      "client network error (browser → /api/stock)",
      { code: normalizedCode, apiUrl, kisDirectCall: false },
      e,
    )
    const err = new Error(stockFetchErrorFromException(e).title)
    err.stockError = stockFetchErrorFromException(e)
    throw err
  } finally {
    clearTimeout(tid)
    if (userSignal) userSignal.removeEventListener("abort", onUserAbort)
  }
}

/**
 * 국내 종목 일괄 조회 — 서버 1회 호출·KIS 토큰 1회 재사용
 * @param {{ codes: string[]; panicIndex?: number; signal?: AbortSignal }} opts
 */
export async function fetchKrStockIndicatorsBatch({ codes, panicIndex, signal } = {}) {
  const list = (codes ?? []).map((c) => normalizeStockCodeParam(c)).filter(Boolean)
  if (!list.length) {
    return { results: {}, errors: {}, tokenStats: null }
  }

  const qs = new URLSearchParams()
  qs.set("batch", "1")
  qs.set("codes", list.join(","))
  if (panicIndex != null && Number.isFinite(Number(panicIndex))) {
    qs.set("panicIndex", String(panicIndex))
  }

  const apiUrl = withNoStoreQuery(`${STOCK_API_PATH}?${qs.toString()}`)
  logClient("KR batch request (single token reuse)", {
    apiUrl,
    codeCount: list.length,
    kisDirectCall: false,
  })

  const res = await fetch(apiUrl, {
    ...LIVE_JSON_GET_INIT,
    signal,
  })
  const body = await res.json().catch(() => ({}))

  if (!res.ok) {
    const stockError = stockApiErrorFromBody(body, res.status)
    const err = new Error(stockError.detail || stockError.title)
    err.stockError = stockError
    throw err
  }

  logClient("KR batch success", {
    successCount: Object.keys(body?.results ?? {}).length,
    errorCount: Object.keys(body?.errors ?? {}).length,
    tokenStats: body?.tokenStats,
  })

  return {
    results: body?.results ?? {},
    errors: body?.errors ?? {},
    tokenStats: body?.tokenStats ?? null,
    batchMeta: body?.batchMeta ?? null,
  }
}

/**
 * 미국·해외 종목 일괄 조회 — 서버 1회 호출 · Yahoo 병렬 fetch
 * @param {{ codes: string[]; panicIndex?: number; signal?: AbortSignal }} opts
 */
export async function fetchUsStockIndicatorsBatch({ codes, panicIndex, signal } = {}) {
  const list = (codes ?? []).map((c) => normalizeStockCodeParam(c)).filter(Boolean)
  if (!list.length) {
    return { results: {}, errors: {}, batchMeta: null }
  }

  const qs = new URLSearchParams()
  qs.set("codes", list.join(","))
  if (panicIndex != null && Number.isFinite(Number(panicIndex))) {
    qs.set("panicIndex", String(panicIndex))
  }

  const apiUrl = withNoStoreQuery(`${STOCK_BATCH_API_PATH}?${qs.toString()}`)
  logClient("US batch request (single HTTP, server parallel Yahoo)", {
    apiUrl,
    codeCount: list.length,
    httpCallCount: 1,
  })

  const res = await fetch(apiUrl, {
    ...LIVE_JSON_GET_INIT,
    signal,
  })
  const body = await res.json().catch(() => ({}))

  if (!res.ok) {
    const stockError = stockApiErrorFromBody(body, res.status)
    const err = new Error(stockError.detail || stockError.title)
    err.stockError = stockError
    throw err
  }

  logClient("US batch success", {
    successCount: Object.keys(body?.results ?? {}).length,
    errorCount: Object.keys(body?.errors ?? {}).length,
    batchMeta: body?.batchMeta,
  })

  return {
    results: body?.results ?? {},
    errors: body?.errors ?? {},
    batchMeta: body?.batchMeta ?? null,
  }
}
