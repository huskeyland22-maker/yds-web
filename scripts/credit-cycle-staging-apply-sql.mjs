#!/usr/bin/env node
/**
 * Phase 10B helper — apply Credit Cycle schema/RLS to Staging via Management API
 * or report blockers. Does NOT target Production.
 *
 * Requires one of:
 *   - SUPABASE_ACCESS_TOKEN (personal access token) for Management SQL API
 *   - OR run SQL manually in Staging dashboard
 *
 * Reads Staging URL from CREDIT_CYCLE_SUPABASE_URL or SUPABASE_URL.
 * Refuses Production ref.
 *
 * Usage (from worktree root):
 *   node scripts/credit-cycle-staging-apply-sql.mjs --dry-run
 *   node scripts/credit-cycle-staging-apply-sql.mjs --apply   # only if ACCESS_TOKEN set
 */

import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  CREDIT_CYCLE_PRODUCTION_REF,
  CREDIT_CYCLE_STAGING_REF,
  classifyCreditCycleSupabaseUrl,
} from "../api/_lib/creditCycleEnv.js"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const STAGING_ENV_CANDIDATES = [
  path.join(ROOT, ".env.staging.local"),
  path.join(ROOT, "../yds web/.env.staging.local"),
]

async function loadEnvFile(filePath) {
  try {
    const text = await readFile(filePath, "utf8")
    /** @type {Record<string,string>} */
    const map = {}
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
      map[t.slice(0, eq).trim()] = v
    }
    return map
  } catch {
    return null
  }
}

async function resolveStagingEnv() {
  for (const p of STAGING_ENV_CANDIDATES) {
    const m = await loadEnvFile(p)
    if (!m) continue
    const url = String(m.CREDIT_CYCLE_SUPABASE_URL || m.SUPABASE_URL || m.VITE_SUPABASE_URL || "").trim()
    const kind = classifyCreditCycleSupabaseUrl(url)
    return { path: p, map: m, url, kind }
  }
  return null
}

async function main() {
  const apply = process.argv.includes("--apply")
  const dry = process.argv.includes("--dry-run") || !apply

  const envInfo = await resolveStagingEnv()
  if (!envInfo) {
    console.log(
      JSON.stringify({
        ok: false,
        reason: "staging_env_file_missing",
        expected: [".env.staging.local"],
      }),
    )
    process.exit(1)
  }

  if (envInfo.kind === "production") {
    console.log(JSON.stringify({ ok: false, reason: "production_url_refused", aborted: true }))
    process.exit(2)
  }
  if (envInfo.kind !== "staging") {
    console.log(
      JSON.stringify({
        ok: false,
        reason: "staging_ref_required",
        projectKind: envInfo.kind,
        requiredRef: CREDIT_CYCLE_STAGING_REF,
        refusedRef: CREDIT_CYCLE_PRODUCTION_REF,
      }),
    )
    process.exit(2)
  }

  const token = String(process.env.SUPABASE_ACCESS_TOKEN || envInfo.map.SUPABASE_ACCESS_TOKEN || "").trim()
  const schemaSql = await readFile(
    path.join(ROOT, "supabase/staging/credit-cycle-schema.sql"),
    "utf8",
  )
  const rlsSql = await readFile(path.join(ROOT, "supabase/staging/credit-cycle-rls.sql"), "utf8")

  const report = {
    ok: true,
    mode: dry ? "dry-run" : "apply",
    stagingRef: CREDIT_CYCLE_STAGING_REF,
    projectKind: envInfo.kind,
    envFileUsed: path.basename(envInfo.path),
    schemaBytes: schemaSql.length,
    rlsBytes: rlsSql.length,
    accessTokenPresent: Boolean(token),
    note: dry
      ? "Dry-run only. Pass --apply with SUPABASE_ACCESS_TOKEN to execute Management SQL API."
      : "Attempting Management API apply",
  }

  if (dry) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  if (!token) {
    console.log(
      JSON.stringify({
        ...report,
        ok: false,
        reason: "missing_supabase_access_token",
        next: "Set SUPABASE_ACCESS_TOKEN or paste SQL in Staging dashboard SQL editor",
      }),
    )
    process.exit(3)
  }

  // Management API: execute SQL on project
  const endpoint = `https://api.supabase.com/v1/projects/${CREDIT_CYCLE_STAGING_REF}/database/query`
  for (const [name, sql] of [
    ["schema", schemaSql],
    ["rls", rlsSql],
  ]) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    })
    if (!res.ok) {
      const text = await res.text()
      console.log(
        JSON.stringify({
          ok: false,
          failedStep: name,
          httpStatus: res.status,
          bodyPreview: text.slice(0, 300),
          aborted: true,
          hint: "Do not re-run blindly; inspect error. Production untouched.",
        }),
      )
      process.exit(4)
    }
  }

  console.log(
    JSON.stringify({
      ok: true,
      applied: ["schema", "rls"],
      stagingRef: CREDIT_CYCLE_STAGING_REF,
      productionTouched: false,
    }),
  )
}

main().catch((e) => {
  console.log(JSON.stringify({ ok: false, error: String(e?.message || e) }))
  process.exit(1)
})
