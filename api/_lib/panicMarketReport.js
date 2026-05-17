import { supabaseRest } from "./supabaseRest.js"
import { generatePanicMarketReport, deskReportKey } from "../../vite-project/src/utils/panicMarketReportEngine.js"

export { generatePanicMarketReport, deskReportKey }

/**
 * @param {object} panicData — normalized panic snapshot
 * @param {string} [tradeDate]
 */
export async function persistDeskMarketReport(panicData, tradeDate) {
  const report = generatePanicMarketReport(panicData)
  if (!report) return { ok: false, reason: "insufficient_metrics" }

  const date =
    tradeDate ||
    report.tradeDate ||
    (typeof panicData?.tradeDate === "string" ? panicData.tradeDate : null) ||
    new Date().toISOString().slice(0, 10)

  const reportKey = deskReportKey(date)
  const row = {
    report_key: reportKey,
    market: "global",
    metric_name: "market_desk",
    title: "오늘 시장 리포트",
    content: {
      reportType: "market_desk",
      tradeDate: date,
      ...report,
    },
    signal: report.actionMode ?? null,
    status: "published",
    source: "panic_save",
  }

  const saved = await supabaseRest("ai_reports?on_conflict=report_key", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: row,
  })

  const out = Array.isArray(saved) ? saved[0] : saved
  return { ok: true, report, reportKey, row: out ?? row }
}
