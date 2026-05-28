import { supabaseRest } from "./supabaseRest.js"

/**
 * @param {{ reportKey?: string, limit?: number }} [opts]
 */
export async function fetchAiReportRows(opts = {}) {
  const key = opts.reportKey ? String(opts.reportKey) : ""
  const limit = Math.min(Math.max(Number(opts.limit) || 20, 1), 50)
  let q = `ai_reports?select=*&order=updated_at.desc&limit=${limit}`
  if (key) q += `&report_key=eq.${encodeURIComponent(key)}`
  try {
    const rows = await supabaseRest(q, { method: "GET" })
    return Array.isArray(rows) ? rows : []
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err ?? "")
    // reports 조회 실패는 전체 패닉 데이터 파이프라인을 죽이지 않도록 빈 배열로 degrade.
    if (/does not exist|timeout|timed out|statement timeout|canceling statement/i.test(message)) {
      console.warn("[ai/reports] soft-fail", { message })
      return []
    }
    throw err
  }
}

export function aiReportToClient(row) {
  if (!row || typeof row !== "object") return null
  const content = row.content && typeof row.content === "object" ? row.content : {}
  return {
    reportKey: row.report_key ?? row.reportKey,
    market: row.market ?? "global",
    title: row.title ?? null,
    content,
    briefingLines: Array.isArray(content.briefingLines) ? content.briefingLines : [],
    signal: row.signal ?? null,
    status: row.status ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  }
}
