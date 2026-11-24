/**
 * Credit Cycle read API — Phase 9 scaffolding.
 *
 * GET ?mode=latest | history | indicators
 * Not a Vercel serverless entry (Hobby 12-function cap).
 * Local Vite middleware imports this module for /api/credit-cycle.
 * Default: disabled (503). Does not use VITE_SUPABASE_URL fallback.
 * Does not write DB. Panic-independent.
 */
import {
  handleCreditCycleHistory,
  handleCreditCycleIndicators,
  handleCreditCycleLatest,
  creditCycleNoStore,
  buildCreditCycleDisabledPayload,
} from "./creditCycleApiHandlers.js"

/** @param {string} raw */
function normalizeMode(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "")
}

/** @param {import('@vercel/node').VercelRequest} req */
function resolveMode(req) {
  const url = new URL(req.url || "", "http://localhost")
  const pathOnly = url.pathname || ""
  if (pathOnly.endsWith("/latest")) return "latest"
  if (pathOnly.endsWith("/history")) return "history"
  if (pathOnly.endsWith("/indicators")) return "indicators"
  const q = normalizeMode(url.searchParams.get("mode") ?? req.query?.mode)
  if (q === "latest" || q === "history" || q === "indicators") return q
  return "latest"
}

export default async function handler(req, res) {
  creditCycleNoStore(res)
  if (req.method && req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
    res.statusCode = 405
    res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.end(JSON.stringify({ ok: false, reason: "method_not_allowed" }))
    return
  }
  if (req.method === "OPTIONS") {
    res.statusCode = 204
    res.end()
    return
  }

  const mode = resolveMode(req)
  try {
    if (mode === "history") {
      await handleCreditCycleHistory(req, res)
      return
    }
    if (mode === "indicators") {
      await handleCreditCycleIndicators(req, res)
      return
    }
    await handleCreditCycleLatest(req, res)
  } catch {
    res.statusCode = 503
    res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.end(JSON.stringify(buildCreditCycleDisabledPayload()))
  }
}
