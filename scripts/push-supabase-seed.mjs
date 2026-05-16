/**
 * Re-apply panic seed via Vercel-style API (service role on Supabase REST).
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
const url = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "")
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()

if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const seedPayload = {
  vix: 18.42,
  vxn: 20.15,
  fearGreed: 52,
  bofa: 0.62,
  move: 94.8,
  skew: 142.5,
  putCall: 0.88,
  highYield: 3.18,
  gsBullBear: 0.28,
  updatedAt: new Date().toISOString(),
}

async function rest(path, opts = {}) {
  const r = await fetch(`${url}/rest/v1/${path}`, {
    method: opts.method || "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: opts.prefer || "",
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  const text = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${text}`)
  return text ? JSON.parse(text) : null
}

const metrics = [
  ["vix", 18.42],
  ["vxn", 20.15],
  ["fearGreed", 52],
  ["bofa", 0.62],
  ["move", 94.8],
  ["skew", 142.5],
  ["putCall", 0.88],
  ["highYield", 3.18],
  ["gsBullBear", 0.28],
].map(([metric_key, metric_value]) => ({
  metric_key,
  metric_value,
  source: "yds-seed-script",
  updated_at: new Date().toISOString(),
}))
metrics.push({
  metric_key: "risk_regime",
  metric_value: null,
  status: "neutral",
  source: "yds-seed-script",
  updated_at: new Date().toISOString(),
})

await rest("panic_metrics?on_conflict=metric_key", {
  method: "POST",
  prefer: "resolution=merge-duplicates,return=minimal",
  body: metrics,
})

const today = new Date().toISOString().slice(0, 10)
await rest("panic_index_history?on_conflict=date", {
  method: "POST",
  prefer: "resolution=merge-duplicates,return=minimal",
  body: {
    date: today,
    vix: seedPayload.vix,
    vxn: seedPayload.vxn,
    fear_greed: seedPayload.fearGreed,
    move: seedPayload.move,
    bofa: seedPayload.bofa,
    skew: seedPayload.skew,
    hy_oas: seedPayload.highYield,
    gs_sentiment: seedPayload.gsBullBear,
    source: "yds-seed-script",
    updated_at: new Date().toISOString(),
  },
})

console.log("[push-supabase-seed] OK — panic_metrics + panic_index_history for", today)
