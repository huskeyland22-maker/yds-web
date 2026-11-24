#!/usr/bin/env node
/**
 * Arm probe .env.staging.local for Credit Cycle Staging API (local only).
 * - Refuses Production ref
 * - Never prints secret values
 * - Optionally merges service_role from drop file (single line, no quotes needed)
 *
 * Drop file (gitignored via .env.*):
 *   .env.staging.service_role.local
 * Put ONLY the Staging service_role secret on the first non-comment line.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  classifyCreditCycleSupabaseUrl,
  classifyCreditCycleSupabaseKey,
  CREDIT_CYCLE_PRODUCTION_REF,
  CREDIT_CYCLE_STAGING_REF,
} from "../api/_lib/creditCycleEnv.js"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const ENV_PATH = path.join(ROOT, ".env.staging.local")
const DROP_PATH = path.join(ROOT, ".env.staging.service_role.local")

function parse(text) {
  /** @type {Record<string, string>} */
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

function readDropServiceRole() {
  if (!existsSync(DROP_PATH)) return ""
  const raw = readFileSync(DROP_PATH, "utf8")
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    // allow KEY=value or bare value
    if (t.includes("=") && /^[A-Z0-9_]+=/.test(t)) {
      return t.slice(t.indexOf("=") + 1).trim()
    }
    return t
  }
  return ""
}

if (!existsSync(ENV_PATH)) {
  console.log(JSON.stringify({ ok: false, reason: "missing_.env.staging.local" }))
  process.exit(2)
}

const map = parse(readFileSync(ENV_PATH, "utf8"))
const url = String(map.CREDIT_CYCLE_SUPABASE_URL || "").trim()
const kind = classifyCreditCycleSupabaseUrl(url)

if (kind === "production" || url.includes(CREDIT_CYCLE_PRODUCTION_REF)) {
  console.log(JSON.stringify({ ok: false, reason: "production_url_refused" }))
  process.exit(2)
}
if (kind !== "staging" || !url.includes(CREDIT_CYCLE_STAGING_REF)) {
  console.log(JSON.stringify({ ok: false, reason: "staging_ref_required", kind }))
  process.exit(2)
}

const dropped = readDropServiceRole()
let dropKeyKind = "missing"
if (dropped) {
  if (dropped.includes(CREDIT_CYCLE_PRODUCTION_REF)) {
    console.log(JSON.stringify({ ok: false, reason: "production_token_refused" }))
    process.exit(2)
  }
  dropKeyKind = classifyCreditCycleSupabaseKey(dropped)
  // Store under both aliases: SERVICE_ROLE_KEY (legacy) + SECRET_KEY (sb_secret preferred name)
  map.CREDIT_CYCLE_SUPABASE_SERVICE_ROLE_KEY = dropped
  if (dropKeyKind === "sb_secret") {
    map.CREDIT_CYCLE_SUPABASE_SECRET_KEY = dropped
  }
}

map.CREDIT_CYCLE_DATA_MODE = "staging"
map.CREDIT_CYCLE_API_ENABLED = "1"
map.CREDIT_CYCLE_ALLOW_REMOTE = "1"
// UI stays on LOCAL_CACHE until separate approval
map.VITE_CREDIT_CYCLE_USE_STAGING_API = "0"

const lines = [
  "# Credit Cycle Staging env (Phase 10B) — gitignored",
  "# Secrets never logged by arm/smoke scripts.",
  "# Privileged key: JWT service_role OR new sb_secret_... (apikey-only headers).",
  `CREDIT_CYCLE_SUPABASE_URL=${map.CREDIT_CYCLE_SUPABASE_URL || ""}`,
  `CREDIT_CYCLE_SUPABASE_ANON_KEY=${map.CREDIT_CYCLE_SUPABASE_ANON_KEY || ""}`,
  `CREDIT_CYCLE_SUPABASE_SERVICE_ROLE_KEY=${map.CREDIT_CYCLE_SUPABASE_SERVICE_ROLE_KEY || ""}`,
  `CREDIT_CYCLE_SUPABASE_SECRET_KEY=${map.CREDIT_CYCLE_SUPABASE_SECRET_KEY || ""}`,
  `CREDIT_CYCLE_DATA_MODE=${map.CREDIT_CYCLE_DATA_MODE}`,
  `CREDIT_CYCLE_API_ENABLED=${map.CREDIT_CYCLE_API_ENABLED}`,
  `CREDIT_CYCLE_ALLOW_REMOTE=${map.CREDIT_CYCLE_ALLOW_REMOTE}`,
  `VITE_CREDIT_CYCLE_USE_STAGING_API=${map.VITE_CREDIT_CYCLE_USE_STAGING_API}`,
  "",
]
writeFileSync(ENV_PATH, lines.join("\n"), "utf8")

console.log(
  JSON.stringify(
    {
      ok: true,
      wrote: ".env.staging.local",
      stagingRef: CREDIT_CYCLE_STAGING_REF,
      dataMode: map.CREDIT_CYCLE_DATA_MODE,
      apiEnabled: map.CREDIT_CYCLE_API_ENABLED,
      allowRemote: map.CREDIT_CYCLE_ALLOW_REMOTE,
      uiStagingApi: map.VITE_CREDIT_CYCLE_USE_STAGING_API,
      anonPresent: Boolean(map.CREDIT_CYCLE_SUPABASE_ANON_KEY),
      privilegedKeyPresent: Boolean(
        map.CREDIT_CYCLE_SUPABASE_SERVICE_ROLE_KEY || map.CREDIT_CYCLE_SUPABASE_SECRET_KEY,
      ),
      privilegedKeyKind: dropKeyKind !== "missing" ? dropKeyKind : map.CREDIT_CYCLE_SUPABASE_SECRET_KEY
        ? classifyCreditCycleSupabaseKey(map.CREDIT_CYCLE_SUPABASE_SECRET_KEY)
        : map.CREDIT_CYCLE_SUPABASE_SERVICE_ROLE_KEY
          ? classifyCreditCycleSupabaseKey(map.CREDIT_CYCLE_SUPABASE_SERVICE_ROLE_KEY)
          : "missing",
      serviceRoleFromDrop: Boolean(dropped),
      dropFile: ".env.staging.service_role.local",
      dropFileExists: existsSync(DROP_PATH),
    },
    null,
    2,
  ),
)
