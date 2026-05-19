import { supabaseRest } from "./supabaseRest.js"
import { SECTOR_KO_LABELS } from "./dailyReportEngine.js"

/**
 * @param {import('./dailyReportEngine.js').createDailyReport extends (...args: any) => infer R ? R : never} report
 */
export async function persistSectorScoreHistoryFromReport(report, source = "auto") {
  if (!report?.date || !report.sectorScores) {
    return { ok: false, reason: "no_scores" }
  }

  const date = String(report.date).slice(0, 10)
  const rows = Object.entries(report.sectorScores).map(([sector, score]) => {
    const flowSector = report.sectorFlow?.leaderSector?.find((s) => s.id === sector)
    const reasons = flowSector?.reasons ?? report.sectorFlow?.watchSector?.find((s) => s.id === sector)?.reasons ?? []
    return {
      date,
      sector,
      score: Number(score) || 0,
      label: SECTOR_KO_LABELS[sector] ?? sector,
      reasons,
      source,
      updated_at: new Date().toISOString(),
    }
  })

  if (!rows.length) return { ok: false, reason: "empty" }

  try {
    await supabaseRest("sector_score_history?on_conflict=date,sector", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: rows,
    })
    return { ok: true, count: rows.length, date }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/relation|does not exist/i.test(msg)) {
      return { ok: false, skipped: true, reason: "table_missing" }
    }
    throw err
  }
}

export async function fetchSectorScoresByDate(tradeDate) {
  const d = String(tradeDate ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return []
  try {
    const rows = await supabaseRest(
      `sector_score_history?select=*&date=eq.${d}&order=score.desc`,
      { method: "GET" },
    )
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}
