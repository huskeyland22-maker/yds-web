import { createClient } from "@supabase/supabase-js"
import { getSupabaseEnv } from "./supabaseBrowser.js"
import { assertSupabaseClientEnv } from "../utils/supabaseEnvBoot.js"

/**
 * Browser-side Supabase Realtime for public.panic_metrics (anon SELECT RLS).
 * @param {{ onChange: () => void }} opts
 * @returns {() => void} unsubscribe
 */
export function subscribePanicHubRealtime({ onChange }) {
  const check = assertSupabaseClientEnv("realtime")
  if (!check.ok) {
    console.warn("[YDS] realtime skipped:", check.message)
    return () => {}
  }
  const { url, anonKey } = getSupabaseEnv()
  if (typeof window === "undefined" || !url || !anonKey) {
    return () => {}
  }

  const client = createClient(String(url), String(anonKey), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const channel = client
    .channel("yds-panic-hub")
    .on("postgres_changes", { event: "*", schema: "public", table: "panic_metrics" }, () => {
      onChange?.({ table: "panic_metrics" })
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "panic_index_history" }, () => {
      onChange?.({ table: "panic_index_history" })
    })
    .subscribe()

  return () => {
    try {
      void client.removeChannel(channel)
    } catch {
      // ignore
    }
    try {
      client.realtime.disconnect()
    } catch {
      // ignore
    }
  }
}
