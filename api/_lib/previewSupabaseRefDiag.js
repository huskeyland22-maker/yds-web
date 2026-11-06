/**
 * TEMP Preview-only diagnostic: expose Supabase project ref (not URL/keys/data).
 * Mounted at /api/preview-supabase-ref → portfolio-sync?ydsMode=preview-supabase-ref.
 * Remove after Staging binding is confirmed (see scripts/preview-supabase-ref-diag.test.mjs header).
 */
import { getSupabaseConfig } from "./supabaseRest.js"

/** Docs / vite.config Staging project ref — hostname label only. */
export const STAGING_SUPABASE_PROJECT_REF = "qzunuksxwwzusyivaznx"

/**
 * @param {string} url
 * @returns {string | null}
 */
export function extractSupabaseProjectRef(url) {
  const raw = String(url || "").trim()
  if (!raw) return null
  try {
    const host = new URL(raw).hostname.toLowerCase()
    if (!host.endsWith(".supabase.co")) return null
    const ref = host.slice(0, -".supabase.co".length)
    return ref || null
  } catch {
    return null
  }
}

/**
 * Build the allowed Preview diagnostic body. Never include URL or keys.
 * @param {{ vercelEnv?: string, url?: string, key?: string }} input
 */
export function buildPreviewSupabaseRefDiagPayload(input = {}) {
  const vercelEnv = String(input.vercelEnv || "")
  if (vercelEnv !== "preview") {
    return { allowed: false }
  }
  const url = String(input.url || "")
  const key = String(input.key || "").trim()
  const supabaseProjectRef = extractSupabaseProjectRef(url)
  return {
    allowed: true,
    body: {
      environment: "preview",
      configured: Boolean(url && key),
      supabaseProjectRef,
      matchesStaging: supabaseProjectRef === STAGING_SUPABASE_PROJECT_REF,
    },
  }
}

/**
 * @param {import("http").IncomingMessage & { method?: string }} req
 * @param {import("http").ServerResponse & { status: (n: number) => { json: (b: unknown) => void }, setHeader: (k: string, v: string) => void }} res
 * @param {{ vercelEnv?: string, getSupabaseConfig?: () => { url: string, key: string } }} [deps]
 */
export async function handlePreviewSupabaseRefDiag(req, res, deps = {}) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "method_not_allowed" })
  }

  const vercelEnv = deps.vercelEnv ?? process.env.VERCEL_ENV
  if (String(vercelEnv || "") !== "preview") {
    // Production / local / development: no diagnostic fields.
    return res.status(403).json({ error: "forbidden" })
  }

  const getConfig = deps.getSupabaseConfig || getSupabaseConfig
  const { url, key } = getConfig()
  const built = buildPreviewSupabaseRefDiagPayload({ vercelEnv: "preview", url, key })
  return res.status(200).json(built.body)
}
