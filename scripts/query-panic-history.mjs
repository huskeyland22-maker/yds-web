#!/usr/bin/env node
/**
 * panic_index_history 검증 — Supabase REST (service role).
 * Usage: node scripts/query-panic-history.mjs
 */
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    try {
      const raw = readFileSync(resolve(root, name), "utf8")
      for (const line of raw.split(/\r?\n/)) {
        const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
        if (!m) continue
        const key = m[1]
        let val = m[2].trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        if (!process.env[key]) process.env[key] = val
      }
    } catch {
      // ignore
    }
  }
}

loadEnv()

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required")
  process.exit(1)
}

const q =
  "panic_index_history?select=date,vix,fear_greed,put_call,hy_oas,bofa,updated_at&order=date.desc&limit=30"
const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${q}`, {
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
  },
})
if (!res.ok) {
  console.error("HTTP", res.status, await res.text())
  process.exit(1)
}
const rows = await res.json()
console.log("-- SQL equivalent:")
console.log("select date, vix, fear_greed, put_call from panic_index_history order by date desc limit 30;\n")
console.table(
  rows.map((r) => ({
    date: r.date,
    vix: r.vix,
    fear_greed: r.fear_greed,
    put_call: r.put_call,
    hy_oas: r.hy_oas,
    bofa: r.bofa,
  })),
)
console.log(`\nrows: ${rows.length}`)
