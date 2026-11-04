/**
 * 공포·패닉 매수 화면의 "현재" 스냅샷.
 * PRO 히스토리 API가 있을 때만 그 시계열의 마지막 행을 쓴다.
 * 401·403·빈 히스토리로 로컬 시드에 떨어진 경우에는 시드 날짜를 최신으로 쓰지 않는다.
 * 허브가 emergency일 때는 history-latest API 행만 보조로 쓴다(시드 금지).
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
 * history-latest API row → display snapshot (시드·emergency 제외)
 * @param {object | null | undefined} row
 * @returns {object | null}
 */
export function panicDataFromHistoryLatestRow(row) {
  if (!row || typeof row !== "object") return null
  if (row.__emergency === true) return null
  if (!panicBuyHasMetrics(row)) return null
  const dateRaw = String(row.date ?? "").slice(0, 10)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : null
  const updatedAt =
    realPanicUpdatedAt(row) ??
    (typeof row.createdAt === "string" && Number.isFinite(new Date(row.createdAt).getTime())
      ? row.createdAt
      : null)
  return {
    vix: row.vix ?? null,
    vxn: row.vxn ?? null,
    fearGreed: row.fearGreed ?? null,
    putCall: row.putCall ?? null,
    bofa: row.bofa ?? null,
    move: row.move ?? null,
    skew: row.skew ?? null,
    highYield: row.highYield ?? row.hyOas ?? null,
    updatedAt,
    date,
    asOfDate: date,
    __fromHistoryLatest: true,
  }
}

/**
 * @param {{
 *   historySource?: string | null
 *   historyPanic?: object | null
 *   hubPanic?: object | null
 *   latestHistoryRow?: object | null
 * }} input
 * @returns {{
 *   source: "pro-history" | "hub-latest" | "history-latest" | "none"
 *   panicData: object | null
 * }}
 */
export function resolvePanicBuyDisplay(input = {}) {
  const historySource = input.historySource ?? "none"
  const historyPanic = input.historyPanic ?? null
  const hubPanic = input.hubPanic ?? null
  const latestHistoryRow = input.latestHistoryRow ?? null

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

  const fromLatest = panicDataFromHistoryLatestRow(latestHistoryRow)
  if (fromLatest) {
    return { source: "history-latest", panicData: fromLatest }
  }

  return { source: "none", panicData: null }
}

/**
 * 동기화 UI: 부트 미완료일 때만 "동기화 중". 완료 후 데이터 없으면 빈 상태.
 * @param {{ bootSettled?: boolean, hasLive?: boolean }} input
 */
export function resolvePanicBuyLoadingState(input = {}) {
  const bootSettled = Boolean(input.bootSettled)
  const hasLive = Boolean(input.hasLive)
  if (hasLive) return { phase: "ready", showSyncing: false, showEmpty: false }
  if (!bootSettled) return { phase: "syncing", showSyncing: true, showEmpty: false }
  return { phase: "empty", showSyncing: false, showEmpty: true }
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
