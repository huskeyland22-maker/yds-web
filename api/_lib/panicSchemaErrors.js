/**
 * Detect Preview/Staging missing-relation / privilege errors from Supabase REST.
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
 * Table exists but PostgREST role lacks GRANT (common after CREATE TABLE without grants).
 * @param {unknown} err
 * @returns {boolean}
 */
export function isPanicTablePermissionError(err) {
  const msg = String(err?.message || err || "")
  return (
    /42501/.test(msg) ||
    /permission denied for table/i.test(msg) ||
    /Grant the required privileges/i.test(msg)
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
  out.hint =
    "Run scripts/staging-panic-bootstrap.sql on Staging (qzunuksxwwzusyivaznx) only."
  out.retryable = true
  return out
}

/**
 * @param {unknown} err
 * @returns {Error}
 */
export function toPreviewTablePermissionError(err) {
  const detail = String(err?.message || err || "permission_denied")
  const out = new Error(
    "Preview Staging DB panic 테이블 권한이 없습니다. Staging에 scripts/staging-panic-grants.sql 을 적용한 뒤 다시 저장하세요.",
  )
  out.stage = "pipeline"
  out.statusCode = 503
  out.code = "preview_table_permission_denied"
  out.detail = detail
  out.hint =
    "Staging ONLY (qzunuksxwwzusyivaznx): run scripts/staging-panic-grants.sql in SQL Editor."
  out.retryable = true
  return out
}

/**
 * Map known Staging schema/privilege failures for panic persist.
 * @param {unknown} err
 * @returns {Error}
 */
export function mapPanicPersistSchemaError(err) {
  if (isMissingPanicRelationError(err)) return toPreviewSchemaMissingError(err)
  if (isPanicTablePermissionError(err)) return toPreviewTablePermissionError(err)
  return err instanceof Error ? err : new Error(String(err ?? "persist_failed"))
}
