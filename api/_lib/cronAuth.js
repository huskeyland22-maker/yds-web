/**
 * Vercel Cron: CRON_SECRET 설정 시 Authorization: Bearer <secret> 자동 전달.
 * 수동 호출: curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/cron/panic-collect
 */

export function verifyCronRequest(req) {
  const secret = String(process.env.CRON_SECRET || "").trim()
  if (!secret) {
    return { ok: false, status: 503, error: "cron_secret_not_configured" }
  }
  const auth = String(req.headers?.authorization || "")
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : ""
  const headerSecret = String(req.headers?.["x-cron-secret"] || "").trim()
  if (bearer === secret || headerSecret === secret) {
    return { ok: true }
  }
  return { ok: false, status: 401, error: "unauthorized" }
}
