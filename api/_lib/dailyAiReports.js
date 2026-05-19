import { supabaseRest } from "./supabaseRest.js"
import { createDailyReport } from "./dailyReportEngine.js"
import { persistSectorScoreHistoryFromReport } from "./sectorScoreHistory.js"
import { fetchMarketCycleRowByDate } from "./marketCycleHistory.js"
import { persistDeskMarketReport } from "./panicMarketReport.js"

function isRpcMissing(err) {
  const msg = err instanceof Error ? err.message : String(err || "")
  return /function|rpc|does not exist|42883|PGRST202/i.test(msg)
}

export function dailyReportToClient(row) {
  if (!row || typeof row !== "object") return null
  const date = String(row.date ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  return {
    date,
    tradeDate: date,
    summary: row.summary ?? "",
    market_view: row.market_view ?? "",
    marketView: row.market_view ?? "",
    short_strategy: row.short_strategy ?? "",
    mid_strategy: row.mid_strategy ?? "",
    long_strategy: row.long_strategy ?? "",
    risk_note: row.risk_note ?? "",
    priority_sector: row.priority_sector ?? "",
    shortTerm: row.short_strategy ?? "",
    midTerm: row.mid_strategy ?? "",
    longTerm: row.long_strategy ?? "",
    risk: row.risk_note ?? "",
    sector: row.priority_sector ?? "",
    risks: String(row.risk_note ?? "")
      .split(/\n|·/)
      .map((s) => s.trim())
      .filter(Boolean),
    panic_score: row.panic_score,
    market_state: row.market_state,
    updatedAt: row.updated_at ?? null,
  }
}

export async function upsertDailyAiReport(report, source = "auto") {
  if (!report?.date) return { ok: false, reason: "no_report" }
  const payload = {
    date: report.date,
    summary: report.summary ?? "",
    market_view: report.market_view ?? "",
    short_strategy: report.short_strategy ?? report.shortTerm ?? "",
    mid_strategy: report.mid_strategy ?? report.midTerm ?? "",
    long_strategy: report.long_strategy ?? report.longTerm ?? "",
    risk_note: report.risk_note ?? report.risk ?? "",
    priority_sector: report.priority_sector ?? report.sector ?? "",
    panic_score: report.panic_score ?? null,
    market_state: report.market_state ?? null,
    source,
  }

  try {
    const saved = await supabaseRest("rpc/upsert_daily_ai_report_fill", {
      method: "POST",
      prefer: "return=representation",
      body: { p_payload: payload },
    })
    const row = Array.isArray(saved) ? saved[0] : saved
    return { ok: true, row: row ?? payload }
  } catch (err) {
    if (!isRpcMissing(err)) throw err
    await supabaseRest("daily_ai_reports?on_conflict=date", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: payload,
    })
    return { ok: true, row: payload, fallback: true }
  }
}

export async function fetchDailyAiReportByDate(tradeDate) {
  const d = String(tradeDate ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null
  try {
    const rows = await supabaseRest(`daily_ai_reports?select=*&date=eq.${d}&limit=1`, {
      method: "GET",
    })
    if (Array.isArray(rows) && rows[0]) return dailyReportToClient(rows[0])
    return null
  } catch (err) {
    if (/relation|does not exist/i.test(String(err?.message || err))) return null
    throw err
  }
}

export async function fetchDailyAiReports(opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 30, 1), 120)
  try {
    const rows = await supabaseRest(
      `daily_ai_reports?select=*&order=date.desc&limit=${limit}`,
      { method: "GET" },
    )
    if (!Array.isArray(rows)) return []
    return rows.map(dailyReportToClient).filter(Boolean)
  } catch {
    return []
  }
}

/**
 * panic 저장 후: cycle row 조회 → createDailyReport → daily_ai_reports + sector_score_history
 */
export async function createAndPersistDailyReport(panicData, tradeDate, opts = {}) {
  const date =
    tradeDate ||
    (typeof panicData?.tradeDate === "string" ? panicData.tradeDate : null) ||
    new Date().toISOString().slice(0, 10)

  const cycleRow = (await fetchMarketCycleRowByDate(date)) ?? opts.cycleRow ?? null
  const report = createDailyReport(panicData, cycleRow, date)
  if (!report) {
    return { ok: false, reason: "insufficient_metrics" }
  }

  const sectorResult = await persistSectorScoreHistoryFromReport(report, opts.source ?? "panic_save")
  const dailyResult = await upsertDailyAiReport(report, opts.source ?? "panic_save")

  let legacy = { ok: false }
  try {
    legacy = await persistDeskMarketReport(panicData, date)
  } catch (err) {
    legacy = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  return {
    ok: true,
    report,
    daily: dailyResult,
    sectors: sectorResult,
    legacy,
    date,
  }
}
