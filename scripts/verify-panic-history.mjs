/**
 * 패닉 히스토리 DB 누적 검증 (로컬/CI)
 * 사용: node scripts/verify-panic-history.mjs
 * env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (또는 Vercel 배포 URL)
 */
import { pathToFileURL } from "node:url"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

async function runLocal() {
  const mod = await import(pathToFileURL(join(root, "api/_lib/panicHistoryVerify.js")).href)
  return mod.verifyPanicHistoryStorage()
}

async function runRemote(baseUrl) {
  const url = `${baseUrl.replace(/\/+$/, "")}/api/supabase/health?panic_verify=1`
  const res = await fetch(url, { cache: "no-store" })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
  return json
}

const base = process.env.VERIFY_BASE_URL || process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : null

try {
  const report = base ? await runRemote(base) : await runLocal()
  console.log(JSON.stringify(report, null, 2))
  if (!report.pass) {
    console.error("\n[verify-panic-history] CHECK 필요 — supabase/sql/verify_panic_history.sql 참고")
    process.exit(1)
  }
  console.log("\n[verify-panic-history] PASS")
} catch (e) {
  console.error("[verify-panic-history] FAIL", e?.message || e)
  process.exit(1)
}
