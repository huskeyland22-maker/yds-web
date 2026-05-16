import { isSupabaseConfigured, supabaseRest } from "./supabaseRest.js"

const TABLES = ["panic_metrics", "panic_index_history", "market_status", "ai_reports"]

/**
 * PostgREST: HEAD with Prefer count=exact — fallback to select id limit 1 + length
 */
async function countTable(table) {
  try {
    const rows = await supabaseRest(`${table}?select=id&limit=1000`, { method: "GET" })
    return Array.isArray(rows) ? rows.length : 0
  } catch {
    return null
  }
}

export async function fetchSupabaseTableHealth() {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "supabase_not_configured", tables: {} }
  }
  const tables = {}
  for (const name of TABLES) {
    tables[name] = await countTable(name)
  }
  const ready =
    (tables.panic_metrics ?? 0) > 0 &&
    (tables.panic_index_history ?? 0) > 0
  return { ok: true, ready, tables, checkedAt: new Date().toISOString() }
}
