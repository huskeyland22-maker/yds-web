import { LIVE_JSON_GET_INIT, withNoStoreQuery } from "../config/liveDataFetch.js"

/**
 * GET /api/stock-indicators
 * 국내 6자리 → KIS 전용, 해외·ETF·지수 티커 → Yahoo 전용.
 *
 * @param {{ code: string; name?: string; signal?: AbortSignal }} opts
 */
export async function fetchStockIndicators({ code, name, signal: userSignal } = {}) {
  if (!code) throw new Error("missing code")
  const qs = new URLSearchParams()
  const raw = String(code).trim()
  const isDomestic = /^\d{4,6}$/.test(raw.replace(/\D/g, "")) && !/[A-Za-z]/.test(raw)
  qs.set("code", isDomestic ? raw.replace(/\D/g, "").padStart(6, "0") : raw)
  if (name) qs.set("name", String(name))

  const ctrl = new AbortController()
  const tid = setTimeout(() => ctrl.abort(), 28_000)
  const onUserAbort = () => ctrl.abort()
  if (userSignal) {
    if (userSignal.aborted) {
      clearTimeout(tid)
      throw new DOMException("Aborted", "AbortError")
    }
    userSignal.addEventListener("abort", onUserAbort)
  }

  try {
    const res = await fetch(withNoStoreQuery(`/api/stock-indicators?${qs.toString()}`), {
      ...LIVE_JSON_GET_INIT,
      signal: ctrl.signal,
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = body.message || body.error || `HTTP ${res.status}`
      throw new Error(msg)
    }
    return body
  } catch (e) {
    if (e?.name === "AbortError") {
      throw new Error(userSignal?.aborted ? "요청이 취소되었습니다." : "응답 시간이 초과되었습니다. 네트워크를 확인한 뒤 다시 시도하세요.")
    }
    throw e
  } finally {
    clearTimeout(tid)
    if (userSignal) userSignal.removeEventListener("abort", onUserAbort)
  }
}
