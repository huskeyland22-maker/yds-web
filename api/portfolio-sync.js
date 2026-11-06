/**
 * GET/PUT /api/portfolio-sync
 * Authorization: Bearer <Firebase ID token>
 *
 * Also hosts (Hobby serverless function cap):
 * - /api/trade-records-sync → rewrite → ?ydsMode=trade-records
 * - /api/me-membership → rewrite → ?ydsMode=me-membership
 * - /api/preview-supabase-ref → rewrite → ?ydsMode=preview-supabase-ref (TEMP Preview diag)
 */
import { handleMeMembership } from "./_lib/meMembershipHandler.js"
import { handlePortfolioSync } from "./_lib/portfolioSyncHandler.js"
import { handlePreviewSupabaseRefDiag } from "./_lib/previewSupabaseRefDiag.js"
import { handleTradeRecordsSync } from "./_lib/tradeRecordsSyncHandler.js"

/** @param {{ query?: Record<string, unknown> }} req */
function resolveYdsMode(req) {
  const raw = req?.query?.ydsMode
  return typeof raw === "string" ? raw.trim() : ""
}

/**
 * @param {import("http").IncomingMessage & { method?: string, body?: unknown, headers?: Record<string, string>, query?: Record<string, unknown> }} req
 * @param {import("http").ServerResponse & { status: (n: number) => { json: (b: unknown) => void }, setHeader: (k: string, v: string) => void }} res
 */
export default async function handler(req, res) {
  const mode = resolveYdsMode(req)

  // /api/me-membership → rewrite → ?ydsMode=me-membership
  if (mode === "me-membership") {
    return handleMeMembership(req, res)
  }

  // /api/trade-records-sync → rewrite → ?ydsMode=trade-records
  if (mode === "trade-records") {
    return handleTradeRecordsSync(req, res)
  }

  // /api/preview-supabase-ref → rewrite → ?ydsMode=preview-supabase-ref (TEMP)
  if (mode === "preview-supabase-ref") {
    return handlePreviewSupabaseRefDiag(req, res)
  }

  return handlePortfolioSync(req, res)
}
