/**
 * Panic API — 단일 Vercel Serverless Function
 *
 * GET  ?mode=latest | history | historylatest | v2 | v2history | backfill
 * POST ?mode=update | backfill
 */
import {
  handlePanicModeBackfill,
  handlePanicModeHistory,
  handlePanicModeHistoryLatest,
  handlePanicModeLatest,
  handlePanicModeUpdate,
  handlePanicModeV2History,
  panicNoStore,
} from "./_lib/panicApiHandlers.js"

/** @param {string} raw */
function normalizeMode(raw) {
  const m = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "")
  if (!m) return ""
  if (m === "v2" || m === "v2history" || m === "historyv2") return "v2history"
  if (m === "historylatest" || m === "latesthistory") return "historylatest"
  return m
}

/** @param {import('@vercel/node').VercelRequest} req */
function resolveMode(req) {
  const url = new URL(req.url || "", "http://localhost")
  const fromQuery = normalizeMode(url.searchParams.get("mode") ?? req.query?.mode)
  if (fromQuery) return fromQuery
  const body = typeof req.body === "object" && req.body ? req.body : {}
  const fromBody = normalizeMode(body.mode)
  if (fromBody) return fromBody
  if (req.method === "POST") return "update"
  return "latest"
}

export default async function handler(req, res) {
  panicNoStore(res)
  const mode = resolveMode(req)

  try {
    switch (mode) {
      case "latest":
        if (req.method !== "GET") {
          res.status(405).json({ ok: false, error: "method_not_allowed", mode })
          return
        }
        await handlePanicModeLatest(req, res)
        return

      case "history":
        if (req.method !== "GET") {
          res.status(405).json({ ok: false, error: "method_not_allowed", mode })
          return
        }
        await handlePanicModeHistory(req, res)
        return

      case "historylatest":
        if (req.method !== "GET") {
          res.status(405).json({ ok: false, error: "method_not_allowed", mode })
          return
        }
        await handlePanicModeHistoryLatest(req, res)
        return

      case "v2history":
        if (req.method !== "GET") {
          res.status(405).json({ ok: false, error: "method_not_allowed", mode })
          return
        }
        await handlePanicModeV2History(req, res)
        return

      case "backfill":
        if (req.method !== "GET" && req.method !== "POST") {
          res.status(405).json({ ok: false, error: "method_not_allowed", mode })
          return
        }
        await handlePanicModeBackfill(req, res)
        return

      case "update":
        if (req.method !== "POST") {
          res.status(405).json({ ok: false, error: "method_not_allowed", mode })
          return
        }
        await handlePanicModeUpdate(req, res)
        return

      default:
        res.status(400).json({
          ok: false,
          error: "unknown_mode",
          mode,
          allowed: ["latest", "history", "historylatest", "v2", "v2history", "backfill", "update"],
        })
    }
  } catch (error) {
    console.error("[panic] unhandled", mode, error)
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "handler_failed",
      mode,
    })
  }
}
