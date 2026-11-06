/**
 * panic_index_history — DB 컬럼 ↔ 앱 필드 단일 매핑
 * 프로덕션 기준: HY = hy_oas (high_yield / hy 등은 읽기 fallback)
 */

/** @type {Record<string, string>} UI/API 키 → PostgREST 컬럼 */
export const PANIC_METRIC_DB_COLUMN = {
  vix: "vix",
  vxn: "vxn",
  fearGreed: "fear_greed",
  putCall: "put_call",
  move: "move",
  bofa: "bofa",
  skew: "skew",
  highYield: "hy_oas",
  hyOas: "hy_oas",
  panicScore: "panic_score",
}

/** 목록·latest 조회용 (존재하지 않는 alias 컬럼 제외) */
export const PANIC_INDEX_HISTORY_SELECT =
  "date,vix,vxn,put_call,fear_greed,move,bofa,skew,hy_oas,panic_score,updated_at,source,market"

/** 일부 스키마에서 meta 컬럼 누락 시 */
export const PANIC_INDEX_HISTORY_SELECT_MINIMAL =
  "date,vix,vxn,put_call,fear_greed,move,bofa,skew,hy_oas,updated_at"

export function isSchemaColumnError(err) {
  const msg = err instanceof Error ? err.message : String(err || "")
  return /column|schema|does not exist|42703|PGRST204/i.test(msg)
}

/** Finite number only — never treat null/undefined as 0 via Number(null). */
export function finiteMetricOrNull(v) {
  if (v == null || v === "") return null
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 * @param {string} dbCol
 */
function pickNum(row, dbCol) {
  if (!row || typeof row !== "object") return null
  return finiteMetricOrNull(row[dbCol])
}

/** HY — hy_oas 우선, 레거시 high_yield/hy 등은 읽기 전용 fallback */
export function pickHyFromRow(row) {
  if (!row || typeof row !== "object") return null
  const candidates = [row.hy_oas, row.highYield, row.hyOas, row.high_yield, row.hy]
  for (const v of candidates) {
    const n = finiteMetricOrNull(v)
    if (n != null) return n
  }
  return null
}

/** BBB OAS — bbb_oas 우선 (컬럼 추가 전 EAV/클라이언트 필드만 있을 수 있음) */
export function pickBbbFromRow(row) {
  if (!row || typeof row !== "object") return null
  const candidates = [row.bbb_oas, row.bbbOas, row.bbb]
  for (const v of candidates) {
    const n = finiteMetricOrNull(v)
    if (n != null) return n
  }
  return null
}

/**
 * DB row → 클라이언트 panic_index_history 행
 * @param {Record<string, unknown>} row
 */
export function mapPanicIndexHistoryRowToClient(row) {
  if (!row || typeof row !== "object") return null
  const dateStr = String(row.date ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
  const hy = pickHyFromRow(row)
  const bbb = pickBbbFromRow(row)
  return {
    date: dateStr,
    vix: pickNum(row, "vix"),
    vxn: pickNum(row, "vxn"),
    fearGreed: pickNum(row, "fear_greed"),
    move: pickNum(row, "move"),
    bofa: pickNum(row, "bofa"),
    skew: pickNum(row, "skew"),
    hyOas: hy,
    highYield: hy,
    bbbOas: bbb,
    putCall: pickNum(row, "put_call"),
    panicScore: pickNum(row, "panic_score"),
    market_state: row.market_state ?? null,
    marketState: row.market_state ?? null,
    marketPhase: row.market_phase ?? null,
    riskLevel: row.risk_level ?? null,
    strategy: row.strategy ?? null,
    createdAt: row.created_at ?? row.updated_at ?? null,
  }
}

/**
 * 스냅샷 → DB upsert payload (alias 컬럼 미포함)
 * Metric nulls are omitted (NULL-fill coalesce). Score contract keys are handled
 * separately so `data_insufficient` + `panic_score: null` is never dropped (P2-32).
 * @param {Record<string, unknown>} normalized finalizePanicHistoryRow 결과
 */
export function panicIndexHistoryDbPayloadFromNormalized(normalized) {
  const hy = pickHyFromRow(normalized) ?? normalized.hy_oas ?? null
  /** null 필드는 payload에서 제외 — merge upsert가 기존 BofA/HY를 0/null로 덮지 않도록 */
  const raw = {
    date: normalized.date,
    vix: normalized.vix,
    vxn: normalized.vxn,
    fear_greed: normalized.fear_greed,
    put_call: normalized.put_call,
    move: normalized.move,
    bofa: normalized.bofa,
    skew: normalized.skew,
    hy_oas: hy,
    market: normalized.market ?? "global",
    source: normalized.source ?? "manual",
    market_phase: normalized.market_phase,
    risk_level: normalized.risk_level,
    strategy: normalized.strategy,
    created_at: normalized.created_at,
    updated_at: normalized.updated_at,
  }
  const payload = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined && v !== null),
  )

  const statusRaw = normalized.panic_score_status ?? normalized.score_status
  const status =
    statusRaw == null || statusRaw === "" ? null : String(statusRaw)

  if (status === "ok" || status === "data_insufficient" || status === "stored_unverified") {
    payload.panic_score_status = status
    if (status === "data_insufficient") {
      // Explicit clear — key must remain for RPC (P2-24/28)
      payload.panic_score = null
    } else {
      const n = Number(normalized.panic_score)
      payload.panic_score = Number.isFinite(n) ? n : null
    }
  } else if (normalized.panic_score != null && normalized.panic_score !== "") {
    // Legacy number-only: omit status → RPC stored_unverified (never mint ok here)
    const n = Number(normalized.panic_score)
    if (Number.isFinite(n)) payload.panic_score = n
  }

  return payload
}

/**
 * @param {string} pathSuffix `panic_index_history?select=...` 이후 쿼리 (select 제외)
 * @param {import('./supabaseRest.js').supabaseRest} supabaseRestFn
 */
export async function fetchPanicIndexHistoryRaw(supabaseRestFn, pathSuffix = "") {
  const suffix = pathSuffix ? (pathSuffix.startsWith("&") ? pathSuffix : `&${pathSuffix}`) : ""
  const attempts = [
    PANIC_INDEX_HISTORY_SELECT,
    PANIC_INDEX_HISTORY_SELECT_MINIMAL,
    "*",
  ]
  let lastErr = null
  for (const sel of attempts) {
    try {
      const rows = await supabaseRestFn(`panic_index_history?select=${sel}${suffix}`, {
        method: "GET",
      })
      return Array.isArray(rows) ? rows : []
    } catch (e) {
      lastErr = e
      if (!isSchemaColumnError(e)) throw e
      console.warn("[panic_index_history] select fallback:", sel, e instanceof Error ? e.message : e)
    }
  }
  console.warn(
    "[panic_index_history] all selects failed — returning []",
    lastErr instanceof Error ? lastErr.message : lastErr,
  )
  return []
}
