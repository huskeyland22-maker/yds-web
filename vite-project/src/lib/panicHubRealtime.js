import { createClient } from "@supabase/supabase-js"

/**
 * Browser-side Supabase Realtime for public.panic_metrics (anon SELECT RLS).
 * @param {{ onChange: () => void }} opts
 * @returns {() => void} unsubscribe
 */
export function subscribePanicHubRealtime({ onChange }) {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (typeof window === "undefined" || !url || !anonKey) {
    return () => {}
  }

  const client = createClient(String(url), String(anonKey), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const channel = client
    .channel("yds-panic-metrics")
    .on("postgres_changes", { event: "*", schema: "public", table: "panic_metrics" }, () => {
      onChange()
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
