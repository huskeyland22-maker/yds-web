/**
 * Panic mode=backfill 접근 제어 — cron/ops only (membership PRO 불가).
 * 기존 verifyCronRequest / CRON_SECRET 재사용.
 */
import { verifyCronRequest } from "./cronAuth.js"

/**
 * @param {{ method?: string, headers?: Record<string, string | string[] | undefined> }} req
 * @returns {{ ok: true } | { ok: false, status: number, error: string }}
 */
export function authorizePanicBackfillRequest(req) {
  const method = String(req?.method || "")
    .trim()
    .toUpperCase()
  if (method !== "POST") {
    return { ok: false, status: 405, error: "method_not_allowed" }
  }
  return verifyCronRequest(req)
}
