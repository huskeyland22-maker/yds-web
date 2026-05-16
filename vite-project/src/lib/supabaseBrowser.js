import { createClient } from "@supabase/supabase-js"

let cachedClient = null

export function getSupabaseEnv() {
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim()
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim()
  const panicHub = import.meta.env.VITE_PANIC_HUB === "1" || import.meta.env.VITE_PANIC_HUB === "true"
  return { url, anonKey, panicHub, configured: Boolean(url && anonKey) }
}

export function maskSecret(value, visible = 4) {
  const s = String(value ?? "").trim()
  if (!s) return "(empty)"
  if (s.length <= visible * 2) return "•".repeat(s.length)
  return `${s.slice(0, visible)}…${s.slice(-visible)}`
}

/** @returns {import('@supabase/supabase-js').SupabaseClient | null} */
export function getSupabaseBrowserClient() {
  const { url, anonKey, configured } = getSupabaseEnv()
  if (!configured || typeof window === "undefined") return null
  if (!cachedClient) {
    cachedClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return cachedClient
}

export function resetSupabaseBrowserClient() {
  cachedClient = null
}
