import { LIVE_JSON_GET_INIT, withNoStoreQuery } from "../config/liveDataFetch.js"
import { stockApiErrorFromBody, stockFetchErrorFromException } from "./errorMessage.js"

/** 서버 API Route — KIS 직접 호출 금지 */
const STOCK_API_PATH = "/api/stock"

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
export async function fetchStockIndicators({ code, name, signal: userSignal } = {}) {
  if (!code) {
    const err = new Error("missing code")
    err.stockError = stockFetchErrorFromException(err)
    throw err
  }

  const normalizedCode = normalizeStockCodeParam(code)
  const qs = new URLSearchParams()
  qs.set("code", normalizedCode)
  if (name) qs.set("name", String(name))

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
          errorCode: body?.error,
          message: body?.message,
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
