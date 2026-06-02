import { supabaseRest, isSupabaseConfigured } from "./supabaseRest.js"

const METRIC_KEYS = ["vix", "fear_greed", "put_call", "panic_score", "hy_oas", "gs_sentiment"]

function numClose(a, b, eps = 0.0001) {
  const x = Number(a)
  const y = Number(b)
  if (!Number.isFinite(x) && !Number.isFinite(y)) return true
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false
  return Math.abs(x - y) <= eps
}

async function fetchTableCount(table, dateColumn = "date") {
  try {
    const rows = await supabaseRest(`${table}?select=${dateColumn}&order=${dateColumn}.desc&limit=5000`, {
      method: "GET",
    })
    return Array.isArray(rows) ? rows.length : 0
  } catch {
    return null
  }
}

async function fetchHistorySample(limit = 30) {
  const rows = await supabaseRest(
    `panic_index_history?select=date,vix,fear_greed,put_call,panic_score,created_at,updated_at&order=date.desc&limit=${limit}`,
    { method: "GET" },
  )
  return Array.isArray(rows) ? rows : []
}

async function fetchLatestPanicMetrics() {
  const rows = await supabaseRest(
    "latest_panic_metrics?select=id,date,vix,vxn,put_call,fear_greed,move,bofa,skew,hy_oas,gs_sentiment,panic_score,updated_at&id=eq.global&limit=1",
    { method: "GET" },
  )
  return Array.isArray(rows) && rows[0] ? rows[0] : null
}

async function fetchMarketCycleSample(limit = 30) {
  try {
    const rows = await supabaseRest(
      `market_cycle_history?select=date,market_state,risk_signal,short_score,mid_score,long_score,panic_score&order=date.desc&limit=${limit}`,
      { method: "GET" },
    )
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

async function fetchAllHistoryDates() {
  const rows = await supabaseRest("panic_index_history?select=date&order=date.asc&limit=5000", {
    method: "GET",
  })
  if (!Array.isArray(rows)) return []
  return rows.map((r) => String(r.date ?? "").slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
}

async function fetchCreatedAtRange() {
  try {
    const [oldestRows, newestRows] = await Promise.all([
      supabaseRest("panic_index_history?select=created_at&order=created_at.asc&limit=1", { method: "GET" }),
      supabaseRest("panic_index_history?select=created_at&order=created_at.desc&limit=1", { method: "GET" }),
    ])
    return {
      minCreatedAt: Array.isArray(oldestRows) && oldestRows[0] ? oldestRows[0].created_at ?? null : null,
      maxCreatedAt: Array.isArray(newestRows) && newestRows[0] ? newestRows[0].created_at ?? null : null,
    }
  } catch {
    return {
      minCreatedAt: null,
      maxCreatedAt: null,
    }
  }
}

function findDuplicateDates(dates) {
  const counts = new Map()
  for (const d of dates) {
    counts.set(d, (counts.get(d) || 0) + 1)
  }
  return [...counts.entries()].filter(([, c]) => c > 1).map(([date, count]) => ({ date, count }))
}

function compareLatestToHistory(latest, topHistory) {
  if (!latest || !topHistory) {
    return { aligned: false, reason: "missing_row", diffs: [] }
  }
  const latestDate = String(latest.date ?? "").slice(0, 10)
  const histDate = String(topHistory.date ?? "").slice(0, 10)
  if (latestDate !== histDate) {
    return {
      aligned: false,
      reason: "date_mismatch",
      latestDate,
      histDate,
      diffs: [],
    }
  }
  const diffs = []
  for (const key of ["vix", "fear_greed", "put_call", "panic_score"]) {
    const a = latest[key]
    const b = topHistory[key]
    if (!numClose(a, b)) {
      diffs.push({ key, latest: a, history: b })
    }
  }
  const hyLatest = latest.hy_oas ?? latest.high_yield
  const hyHist = topHistory.hy_oas ?? topHistory.high_yield
  if (!numClose(hyLatest, hyHist)) {
    diffs.push({ key: "hy_oas", latest: hyLatest, history: hyHist })
  }
  return { aligned: diffs.length === 0, reason: diffs.length ? "value_mismatch" : "ok", diffs, latestDate }
}

function assessDateSequence(dates) {
  if (!dates.length) return { ok: false, note: "empty" }
  const sorted = [...new Set(dates)].sort()
  const desc = [...sorted].reverse()
  let consecutiveDesc = true
  for (let i = 1; i < desc.length; i += 1) {
    const prev = new Date(`${desc[i - 1]}T12:00:00Z`)
    const cur = new Date(`${desc[i]}T12:00:00Z`)
    const gapDays = (prev - cur) / (24 * 60 * 60 * 1000)
    if (gapDays > 3) consecutiveDesc = false
  }
  return {
    ok: true,
    uniqueDays: sorted.length,
    newest: desc[0] ?? null,
    oldest: desc[desc.length - 1] ?? null,
    looksDailyAppend: consecutiveDesc || sorted.length < 3,
  }
}

/**
 * 패닉 히스토리 누적 검증 — Supabase service role
 */
export async function verifyPanicHistoryStorage() {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "supabase_not_configured", checks: {} }
  }

  const checkedAt = new Date().toISOString()
  const [sample, latest, cycleSample, allDates, totalCount, createdAtRange] = await Promise.all([
    fetchHistorySample(30),
    fetchLatestPanicMetrics(),
    fetchMarketCycleSample(30),
    fetchAllHistoryDates(),
    fetchTableCount("panic_index_history"),
    fetchCreatedAtRange(),
  ])

  const topHistory = sample[0] ?? null
  const duplicates = findDuplicateDates(allDates)
  const latestCompare = compareLatestToHistory(latest, topHistory)
  const dateSeq = assessDateSequence(allDates)

  const checks = {
    historySample: {
      ok: sample.length > 0,
      rows: sample.length,
      newest: sample[0]?.date ?? null,
      sample: sample.slice(0, 5),
    },
    noDuplicateDates: {
      ok: duplicates.length === 0,
      duplicateCount: duplicates.length,
      duplicates: duplicates.slice(0, 10),
      required: "0 rows from GROUP BY date HAVING COUNT(*) > 1",
    },
    latestMatchesHistoryTop: {
      ok: latestCompare.aligned,
      ...latestCompare,
      latestRow: latest
        ? {
            date: latest.date,
            vix: latest.vix,
            fear_greed: latest.fear_greed,
            put_call: latest.put_call,
            panic_score: latest.panic_score,
          }
        : null,
      topHistoryRow: topHistory
        ? {
            date: topHistory.date,
            vix: topHistory.vix,
            fear_greed: topHistory.fear_greed,
            put_call: topHistory.put_call,
            panic_score: topHistory.panic_score,
          }
        : null,
    },
    marketCycleHistory: {
      ok: cycleSample.length > 0,
      rows: cycleSample.length,
      newest: cycleSample[0]?.date ?? null,
      sample: cycleSample.slice(0, 5),
      note: cycleSample.length ? "market_cycle_history populated" : "run panic save after migration",
    },
    totalHistoryCount: {
      ok: (totalCount ?? 0) > 0,
      count: totalCount,
      uniqueDates: allDates.length,
      targetNote: "매일 +1 저장 시 uniqueDates ≈ count, 1년 목표 365",
    },
    createdAtRange: {
      ok: Boolean(createdAtRange.minCreatedAt || createdAtRange.maxCreatedAt),
      minCreatedAt: createdAtRange.minCreatedAt,
      maxCreatedAt: createdAtRange.maxCreatedAt,
      required: "SELECT COUNT(*), MIN(created_at), MAX(created_at) FROM panic_index_history",
    },
    dateSequence: dateSeq,
  }

  const pass =
    checks.historySample.ok &&
    checks.noDuplicateDates.ok &&
    checks.latestMatchesHistoryTop.ok &&
    checks.totalHistoryCount.ok

  return {
    ok: pass,
    pass,
    checks,
    checkedAt,
    sqlHint: "supabase/sql/verify_panic_history.sql",
  }
}
