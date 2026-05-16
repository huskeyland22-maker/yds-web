import { maskSecret, getSupabaseEnv } from "../lib/supabaseBrowser.js"
import { LIVE_JSON_GET_INIT, withNoStoreQuery } from "../config/liveDataFetch.js"

const LOG = "[YDS_ENV]"

/**
 * 앱 부팅 시 Supabase/Vercel env 상태를 콘솔·window에 노출 (값은 마스킹).
 */
export async function bootSupabaseEnvReport() {
  if (typeof window === "undefined") return null

  const runtime = getSupabaseEnv()
  const viteUrl = import.meta.env.VITE_SUPABASE_URL
  const viteKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const viteHub = import.meta.env.VITE_PANIC_HUB

  console.log(LOG, "import.meta.env.VITE_SUPABASE_URL", viteUrl ? maskSecret(String(viteUrl), 16) : "undefined")
  console.log(LOG, "import.meta.env.VITE_SUPABASE_ANON_KEY", viteKey ? `set (len=${String(viteKey).length})` : "undefined")
  console.log(LOG, "import.meta.env.VITE_PANIC_HUB", viteHub ?? "undefined")
  console.log(LOG, "runtime.configured (url+anon)", runtime.configured)
  console.log(LOG, "runtime.panicHub flag", runtime.panicHub)

  let buildManifest = null
  try {
    const res = await fetch(withNoStoreQuery("/client-env-manifest.json"), LIVE_JSON_GET_INIT)
    if (res.ok) {
      buildManifest = await res.json()
      console.log(LOG, "build-time manifest", buildManifest)
    }
  } catch (e) {
    console.warn(LOG, "client-env-manifest.json fetch failed", e)
  }

  const issues = []
  if (!runtime.configured) {
    issues.push("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing in this bundle (undefined at runtime)")
  }
  if (!runtime.panicHub) {
    issues.push("VITE_PANIC_HUB not enabled (must be \"1\" at build time)")
  }
  if (buildManifest && !buildManifest.client?.VITE_SUPABASE_URL) {
    issues.push("Last Vercel build was WITHOUT VITE_SUPABASE_URL — redeploy after adding env")
  }
  if (buildManifest && !buildManifest.client?.VITE_PANIC_HUB) {
    issues.push("Last Vercel build was WITHOUT VITE_PANIC_HUB=1")
  }

  const report = {
    at: Date.now(),
    runtime: {
      urlPresent: Boolean(viteUrl),
      anonKeyPresent: Boolean(viteKey),
      panicHub: String(viteHub ?? ""),
      configured: runtime.configured,
      panicHubEnabled: runtime.panicHub,
    },
    buildManifest,
    issues,
    supabaseConnected: runtime.configured && runtime.panicHub,
    envLoaded: runtime.configured,
  }

  if (issues.length) {
    console.error(LOG, "CONFIG ISSUES — mobile data will fail until fixed:", issues)
    console.error(
      LOG,
      "Fix: Vercel Project Settings → Environment Variables → set for Production+Preview+Development → Redeploy → PWA hard refresh",
    )
  } else {
    console.log(LOG, "env OK — supabase client config present in bundle")
  }

  try {
    window.__YDS_SUPABASE_ENV__ = report
  } catch {
    // ignore
  }

  return report
}

/** @returns {{ ok: boolean, message: string, issues: string[] }} */
export function assertSupabaseClientEnv(action = "fetch") {
  const env = getSupabaseEnv()
  const issues = []
  if (!env.url) issues.push("VITE_SUPABASE_URL missing")
  if (!env.anonKey) issues.push("VITE_SUPABASE_ANON_KEY missing")
  if (!env.panicHub) issues.push("VITE_PANIC_HUB not enabled (set to 1 in Vercel, then redeploy)")
  if (issues.length) {
    const message = `[YDS] Cannot ${action}: ${issues.join("; ")}`
    console.error(message)
    return { ok: false, message, issues }
  }
  return { ok: true, message: "ok", issues: [] }
}
