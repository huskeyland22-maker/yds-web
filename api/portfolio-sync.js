/**
 * GET/PUT /api/portfolio-sync
 * Authorization: Bearer <Firebase ID token>
 *
 * Also hosts /api/trade-records-sync via vercel rewrite (?ydsMode=trade-records)
 * to stay within the Hobby serverless function cap.
 */
import { handlePortfolioSync } from "./_lib/portfolioSyncHandler.js"
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
  // /api/trade-records-sync → rewrite → ?ydsMode=trade-records
  if (resolveYdsMode(req) === "trade-records") {
    return handleTradeRecordsSync(req, res)
  }

  return handlePortfolioSync(req, res)
}
