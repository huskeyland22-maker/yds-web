import { resolvePanicV2Status } from "../panic-v2/panicV2Status.js"

function toNum(v) {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** @param {object[]} rows */
export function logPanicV2ClientSummary(rows, label = "패닉V2") {
  const sorted = [...(rows || [])]
    .filter((r) => toNum(r.panicV2DynamicScore ?? r.panicV2Score ?? r.panic_index_v2) != null)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const recent30 = sorted.slice(-30)
  const latest = recent30[recent30.length - 1] ?? null
  const currentScore = toNum(latest?.panicV2DynamicScore ?? latest?.panicV2Score ?? latest?.panic_index_v2)
  const status = resolvePanicV2Status(currentScore)
  const summary = {
    label,
    recent30Days: recent30.length,
    currentScore,
    status: status?.label ?? "—",
    latestDate: latest?.date ?? null,
  }
  console.log("[패닉V2]", summary)
  return summary
}
