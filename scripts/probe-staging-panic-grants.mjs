/**
 * Staging-only probe: SELECT/INSERT privileges on panic tables via service_role.
 * Refuses non-qzunuksx hosts. Does not touch Production.
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

function loadEnvFile(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    out[m[1]] = m[2].replace(/^"|"$/g, "").trim()
  }
  return out
}

const fileEnv = {
  ...loadEnvFile(resolve(".env.local")),
  ...loadEnvFile(resolve(".env.staging.local")),
}
const url = String(process.env.SUPABASE_URL || fileEnv.SUPABASE_URL || "").replace(/\/$/, "")
const key = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY || "",
).trim()
const host = url ? new URL(url).host : ""
const ref = host.split(".")[0]

if (!host.startsWith("qzunuksx")) {
  console.error(JSON.stringify({ ok: false, reason: "refusing_non_staging_host", host, ref }))
  process.exit(2)
}
if (!key) {
  console.error(JSON.stringify({ ok: false, reason: "missing_service_role_key" }))
  process.exit(3)
}

async function rest(path, init = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "return=minimal",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  return { status: res.status, ok: res.ok, body: text.slice(0, 500) }
}

const tables = ["panic_index_history", "panic_metrics", "latest_panic_metrics"]
const selectResults = {}
for (const t of tables) {
  selectResults[t] = await rest(`${t}?select=*&limit=1`, { method: "GET" })
}

const probeDate = "2099-01-01"
const upsertHist = await rest(`panic_index_history?on_conflict=date`, {
  method: "POST",
  headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  body: JSON.stringify({
    date: probeDate,
    vix: 12.3,
    fear_greed: 45,
    put_call: 0.9,
    panic_score: 1,
    source: "probe",
    market: "global",
  }),
})

const delHist = await rest(`panic_index_history?date=eq.${probeDate}`, { method: "DELETE" })

const upsertMetrics = await rest(`panic_metrics?on_conflict=metric_key`, {
  method: "POST",
  headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  body: JSON.stringify({
    metric_key: "__probe_grants__",
    metric_value: 1,
    source: "probe",
    market: "global",
  }),
})
const delMetrics = await rest(`panic_metrics?metric_key=eq.__probe_grants__`, {
  method: "DELETE",
})

console.log(
  JSON.stringify(
    {
      ok: upsertHist.ok && upsertMetrics.ok && selectResults.panic_index_history.ok,
      ref,
      select: selectResults,
      upsert_panic_index_history: upsertHist,
      delete_probe_history: delHist,
      upsert_panic_metrics: upsertMetrics,
      delete_probe_metrics: delMetrics,
      grantHint:
        !upsertHist.ok || !upsertMetrics.ok
          ? "Apply scripts/staging-panic-grants.sql on Staging SQL Editor"
          : null,
    },
    null,
    2,
  ),
)
process.exit(upsertHist.ok && upsertMetrics.ok ? 0 : 1)
