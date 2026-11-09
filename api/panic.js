/**
 * Panic API — 단일 Vercel Serverless Function
 *
 * GET  ?mode=latest | history | history-latest | v2 | v2history
 * POST ?mode=update | backfill
 *
 * backfill: CRON_SECRET (verifyCronRequest) 필수 · POST only · membership PRO로는 불가
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
import { authorizePanicBackfillRequest } from "./_lib/panicBackfillAccess.js"
import {
  requireProMembership,
  sendProMembershipDenied,
} from "./_lib/requireProMembership.js"

/** History / V2 series power PRO-only charts — latest stays FREE for score UI. */
const PRO_PANIC_MODES = new Set(["history", "v2", "v2history"])

/** @param {string} raw */
function normalizeMode(raw) {
  const m = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "")
  if (!m) return ""
  if (m === "v2" || m === "v2history" || m === "historyv2") return "v2"
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
    if (PRO_PANIC_MODES.has(mode)) {
      const gate = await requireProMembership(req)
      if (!gate.ok) {
        sendProMembershipDenied(res, gate)
        return
      }
    }

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

      case "v2":
      case "v2history":
        if (req.method !== "GET") {
          res.status(405).json({ ok: false, error: "method_not_allowed", mode })
          return
        }
        await handlePanicModeV2History(req, res)
        return

      case "backfill": {
        const access = authorizePanicBackfillRequest(req)
        if (!access.ok) {
          res.status(access.status || 401).json({
            ok: false,
            error: access.error || "unauthorized",
            mode,
          })
          return
        }
        await handlePanicModeBackfill(req, res)
        return
      }

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
          allowed: [
            "latest",
            "history",
            "history-latest",
            "historylatest",
            "v2",
            "v2history",
            "backfill",
            "update",
          ],
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
