const LOG_PREFIX = "[YDS_DEBUG_DATA]"

export function debugLog(event, detail = {}) {
  const line = { t: new Date().toISOString(), event, ...detail }
  console.log(LOG_PREFIX, event, line)
}

export function debugWarn(event, detail = {}) {
  const line = { t: new Date().toISOString(), event, ...detail }
  console.warn(LOG_PREFIX, event, line)
}

export function debugError(event, detail = {}) {
  const line = { t: new Date().toISOString(), event, ...detail }
  console.error(LOG_PREFIX, event, line)
}

/**
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} label
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`timeout:${label}:${ms}ms`)), ms)
    }),
  ])
}

/**
 * @param {unknown} err
 * @param {{ rowCount?: number, httpStatus?: number }} ctx
 * @returns {{ code: string, message: string, hint: string }}
 */
export function classifyDataFailure(err, ctx = {}) {
  const rowCount = ctx.rowCount ?? 0
  const msg = err instanceof Error ? err.message : String(err ?? "")
  const lower = msg.toLowerCase()

  if (String(msg).startsWith("timeout:")) {
    return {
      code: "timeout",
      message: msg,
      hint: "네트워크·Supabase 응답 지연. Wi‑Fi/셀룰러 전환 후 재시도.",
    }
  }

  if (rowCount === 0 && !err) {
    return {
      code: "empty_rows",
      message: "Query succeeded with 0 rows",
      hint: "테이블은 있으나 데이터 없음 — Vercel API로 insert 되었는지 Supabase Table Editor 확인.",
    }
  }

  if (
    lower.includes("permission denied") ||
    lower.includes("row-level security") ||
    lower.includes("rls") ||
    lower.includes("42501") ||
    lower.includes("pgrst301")
  ) {
    return {
      code: "permission_denied",
      message: msg || "RLS / permission denied",
      hint: "anon SELECT 정책(panic_metrics_select_public 등)이 Supabase에 적용됐는지 확인.",
    }
  }

  if (
    lower.includes("does not exist") ||
    lower.includes("relation") ||
    lower.includes("42p01") ||
    lower.includes("pgrst205")
  ) {
    return {
      code: "table_not_found",
      message: msg,
      hint: "마이그레이션 미적용. panic_metrics / panic_index_history 테이블 생성 필요.",
    }
  }

  if (
    lower.includes("invalid api key") ||
    lower.includes("jwt") ||
    lower.includes("401") ||
    lower.includes("auth")
  ) {
    return {
      code: "auth_failed",
      message: msg,
      hint: "VITE_SUPABASE_ANON_KEY 가 프로젝트 URL과 일치하는지 Vercel env 확인.",
    }
  }

  if (ctx.httpStatus === 503 || lower.includes("supabase_not_configured")) {
    return {
      code: "not_configured",
      message: msg || "Supabase not configured on server",
      hint: "Vercel에 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, 프론트에 VITE_SUPABASE_* + VITE_PANIC_HUB=1",
    }
  }

  if (err) {
    return {
      code: "query_error",
      message: msg,
      hint: "콘솔 [YDS_DEBUG_DATA] 로그와 Supabase Dashboard Logs 확인.",
    }
  }

  return { code: "unknown", message: msg || "unknown", hint: "—" }
}

/** @param {unknown[]} rows */
export function summarizeRows(rows) {
  const list = Array.isArray(rows) ? rows : []
  const nullCounts = {}
  if (list[0] && typeof list[0] === "object") {
    for (const key of Object.keys(list[0])) {
      nullCounts[key] = list.filter((r) => r?.[key] == null).length
    }
  }
  const updatedAts = list
    .map((r) => r?.updated_at ?? r?.updatedAt ?? r?.created_at ?? r?.date ?? null)
    .filter(Boolean)
  return {
    rowCount: list.length,
    nullCounts,
    latestUpdatedAt: updatedAts.length ? String(updatedAts[updatedAts.length - 1]) : null,
    sampleKeys: list[0] ? Object.keys(list[0]) : [],
  }
}
