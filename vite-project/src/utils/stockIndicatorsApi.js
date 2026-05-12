/**
 * Phase-1 stock engine: GET /api/stock-indicators
 * (KIS 일봉 우선, 미설정 시 Yahoo 일봉 폴백 → RSI·MACD·이평 등).
 *
 * @param {{ code: string; name?: string; signal?: AbortSignal }} opts
 */
export async function fetchStockIndicators({ code, name, signal: userSignal } = {}) {
  if (!code) throw new Error("missing code")
  const qs = new URLSearchParams()
  qs.set("code", String(code).replace(/\D/g, "").padStart(6, "0"))
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
    const res = await fetch(`/api/stock-indicators?${qs.toString()}`, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
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
