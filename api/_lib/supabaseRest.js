/**
 * Supabase PostgREST from Vercel Node (no supabase-js dependency in api bundle).
 * Uses service role — never expose to the browser.
 */

function getSupabaseConfig() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "")
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()
  return { url, key }
}

export function isSupabaseConfigured() {
  const { url, key } = getSupabaseConfig()
  return Boolean(url && key)
}

/**
 * @param {string} pathQuery e.g. "panic_metrics?select=*"
 * @param {{ method?: string, body?: unknown, prefer?: string }} opts
 */
export async function supabaseRest(pathQuery, opts = {}) {
  const { url, key } = getSupabaseConfig()
  if (!url || !key) throw new Error("Supabase URL or service role key missing")

  const method = opts.method || "GET"
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  }
  if (opts.prefer) headers.Prefer = opts.prefer

  const res = await fetch(`${url}/rest/v1/${pathQuery}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  })
  const text = await res.text()
  let json = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = { raw: text }
    }
  }
  if (!res.ok) {
    const msg = typeof json?.message === "string" ? json.message : text || res.statusText
    throw new Error(`Supabase ${res.status}: ${msg}`)
  }
  return json
}
