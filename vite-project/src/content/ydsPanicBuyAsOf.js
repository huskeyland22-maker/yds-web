/**
 * 공포·패닉 매수 화면의 "현재" 스냅샷.
 * PRO 히스토리 API가 있을 때만 그 시계열의 마지막 행을 쓴다.
 * 401·403·빈 히스토리로 로컬 시드에 떨어진 경우에는 시드 날짜를 최신으로 쓰지 않는다.
 */

const METRIC_KEYS = ["vix", "vxn", "fearGreed", "putCall", "bofa", "move", "skew", "highYield"]

/** @param {unknown} data */
export function panicBuyHasMetrics(data) {
  if (!data || typeof data !== "object") return false
  return METRIC_KEYS.some((key) => {
    const n = Number(data[key])
    return Number.isFinite(n)
  })
}

/**
 * @param {unknown} data
 * @returns {string | null}
 */
export function realPanicUpdatedAt(data) {
  if (!data || typeof data !== "object") return null
  if (data.__emergency === true) return null
  const raw = data.updatedAt ?? data.updated_at ?? data.marketUpdateTime ?? null
  if (raw == null || raw === "") return null
  const iso = String(raw)
  if (!Number.isFinite(new Date(iso).getTime())) return null
  return iso
}

/**
 * @param {{
 *   historySource?: string | null
 *   historyPanic?: object | null
 *   hubPanic?: object | null
 * }} input
 * @returns {{
 *   source: "pro-history" | "hub-latest" | "none"
 *   panicData: object | null
 * }}
 */
export function resolvePanicBuyDisplay(input = {}) {
  const historySource = input.historySource ?? "none"
  const historyPanic = input.historyPanic ?? null
  const hubPanic = input.hubPanic ?? null

  if (
    historySource === "supabase-index-history" &&
    historyPanic &&
    panicBuyHasMetrics(historyPanic)
  ) {
    return { source: "pro-history", panicData: historyPanic }
  }

  if (hubPanic && hubPanic.__emergency !== true && panicBuyHasMetrics(hubPanic)) {
    const updatedAt = realPanicUpdatedAt(hubPanic)
    return {
      source: "hub-latest",
      panicData: {
        vix: hubPanic.vix ?? null,
        vxn: hubPanic.vxn ?? null,
        fearGreed: hubPanic.fearGreed ?? null,
        putCall: hubPanic.putCall ?? null,
        bofa: hubPanic.bofa ?? null,
        move: hubPanic.move ?? null,
        skew: hubPanic.skew ?? null,
        highYield: hubPanic.highYield ?? hubPanic.hyOas ?? null,
        updatedAt,
        date: null,
        asOfDate: null,
        __fromHub: true,
      },
    }
  }

  return { source: "none", panicData: null }
}

/**
 * PRO 히스토리는 API 행만 유지한다. 시드는 API가 비었을 때의 보관본이지 최신 행이 아니다.
 * @param {{ hubRows?: object[] | null, localSeedRows?: object[] | null }} input
 * @returns {{ rows: object[], fallbackUsed: boolean, fallbackReason: string | null }}
 */
export function selectPanicHistoryRows(input = {}) {
  const hubRows = Array.isArray(input.hubRows) ? input.hubRows : []
  const localSeedRows = Array.isArray(input.localSeedRows) ? input.localSeedRows : []
  if (hubRows.length > 0) {
    return { rows: hubRows, fallbackUsed: false, fallbackReason: null }
  }
  if (localSeedRows.length > 0) {
    return { rows: localSeedRows, fallbackUsed: true, fallbackReason: "api_empty" }
  }
  return { rows: [], fallbackUsed: false, fallbackReason: null }
}
