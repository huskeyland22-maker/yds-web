/**
 * Apply scripts/staging-panic-grants.sql to Staging via Supabase Management SQL API.
 * Requires SUPABASE_ACCESS_TOKEN. Refuses any host that is not qzunuksx (staging).
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
const token = String(process.env.SUPABASE_ACCESS_TOKEN || fileEnv.SUPABASE_ACCESS_TOKEN || "").trim()
const host = url ? new URL(url).host : ""
const ref = host.split(".")[0]

if (!host.startsWith("qzunuksx")) {
  console.error(JSON.stringify({ ok: false, reason: "refusing_non_staging_host", host }))
  process.exit(2)
}
if (!token) {
  console.error(
    JSON.stringify({
      ok: false,
      reason: "missing_SUPABASE_ACCESS_TOKEN",
      sqlFile: "scripts/staging-panic-grants.sql",
      hint: "Run the SQL file in Staging SQL Editor, or set SUPABASE_ACCESS_TOKEN and re-run.",
    }),
  )
  process.exit(3)
}

const sql = readFileSync(resolve("scripts/staging-panic-grants.sql"), "utf8")
const endpoint = `https://api.supabase.com/v1/projects/${ref}/database/query`
const res = await fetch(endpoint, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
})
const text = await res.text()
console.log(JSON.stringify({ ok: res.ok, status: res.status, bodyPrefix: text.slice(0, 400) }, null, 2))
process.exit(res.ok ? 0 : 1)
