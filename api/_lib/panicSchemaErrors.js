/**
 * Detect Preview/Staging missing-relation errors from Supabase REST.
 */

/**
 * @param {unknown} err
 * @returns {boolean}
 */
export function isMissingPanicRelationError(err) {
  const msg = String(err?.message || err || "")
  return (
    /Could not find the table/i.test(msg) ||
    /PGRST205/i.test(msg) ||
    /relation .* does not exist/i.test(msg) ||
    /42P01/.test(msg)
  )
}

/**
 * @param {unknown} err
 * @returns {Error}
 */
export function toPreviewSchemaMissingError(err) {
  const detail = String(err?.message || err || "schema_missing")
  const out = new Error(
    "Preview Staging DB에 panic 테이블이 없습니다. Staging SQL 부트스트랩을 적용한 뒤 다시 저장하세요.",
  )
  out.stage = "pipeline"
  out.statusCode = 503
  out.code = "preview_schema_missing"
  out.detail = detail
  out.hint = "Run scripts/staging-panic-bootstrap.sql on Staging (qzunuksx) via scripts/apply-staging-panic-bootstrap.mjs"
  out.retryable = true
  return out
}
