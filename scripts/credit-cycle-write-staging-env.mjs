#!/usr/bin/env node
/** Write probe .env.staging.local CREDIT_CYCLE_* from ops staging env. No secret logging. */
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  CREDIT_CYCLE_PRODUCTION_REF,
  CREDIT_CYCLE_STAGING_REF,
  classifyCreditCycleSupabaseUrl,
} from "../api/_lib/creditCycleEnv.js"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SRC = path.resolve(ROOT, "../yds web/.env.staging.local")
const OUT = path.join(ROOT, ".env.staging.local")

function parse(text) {
  /** @type {Record<string,string>} */
  const m = {}
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq <= 0) continue
    let v = t.slice(eq + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    m[t.slice(0, eq).trim()] = v
  }
  return m
}

const src = parse(await readFile(SRC, "utf8"))
const url = String(src.SUPABASE_URL || src.VITE_SUPABASE_URL || "").trim()
const anon = String(src.VITE_SUPABASE_ANON_KEY || "").trim()
const kind = classifyCreditCycleSupabaseUrl(url)
if (kind !== "staging") {
  console.log(JSON.stringify({ ok: false, reason: "not_staging", kind }))
  process.exit(2)
}
if (url.includes(CREDIT_CYCLE_PRODUCTION_REF)) {
  console.log(JSON.stringify({ ok: false, reason: "production_refused" }))
  process.exit(2)
}

const out = [
  "# Credit Cycle Staging env (Phase 10B) — gitignored",
  "# Copied URL/anon from ops .env.staging.local. Secrets not printed.",
  "# SERVICE_ROLE omitted: source key returned REST 401 (needs rotation).",
  `CREDIT_CYCLE_SUPABASE_URL=${url}`,
  `CREDIT_CYCLE_SUPABASE_ANON_KEY=${anon}`,
  "CREDIT_CYCLE_SUPABASE_SERVICE_ROLE_KEY=",
  "CREDIT_CYCLE_DATA_MODE=local",
  "CREDIT_CYCLE_API_ENABLED=0",
  "CREDIT_CYCLE_ALLOW_REMOTE=0",
  "VITE_CREDIT_CYCLE_USE_STAGING_API=0",
  "",
].join("\n")

await writeFile(OUT, out, "utf8")
console.log(
  JSON.stringify(
    {
      ok: true,
      wrote: ".env.staging.local",
      stagingRef: CREDIT_CYCLE_STAGING_REF,
      anonPresent: Boolean(anon),
      serviceRoleCopied: false,
      apiEnabled: false,
      allowRemote: false,
      serviceRoleSkippedReason: "staging_service_role_rest_401",
    },
    null,
    2,
  ),
)
