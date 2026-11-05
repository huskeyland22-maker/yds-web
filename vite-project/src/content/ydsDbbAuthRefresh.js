/**
 * 일상 조정 매수 — 로그인·멤버십 변경 후 스냅샷 재조회 게이트.
 * Firebase 인증 구조를 바꾸지 않고, 화면이 멤버십 확정 후에만 데이터를 다시 받는다.
 */

const DEFAULT_MEMBERSHIP_WAIT_MS = 8000

/**
 * @param {{
 *   authReady?: boolean
 *   membershipLoading?: boolean
 *   status?: string | null
 *   membershipWaitMs?: number
 *   nowMs?: number
 *   membershipLoadingSinceMs?: number | null
 * }} input
 * @returns {{ canFetch: boolean, showLoading: boolean, softTimedOut: boolean }}
 */
export function resolveDbbSnapshotFetchGate(input = {}) {
  const authReady = Boolean(input.authReady)
  const membershipLoading = Boolean(input.membershipLoading)
  const waitMs = Number(input.membershipWaitMs)
  const maxWait = Number.isFinite(waitMs) && waitMs > 0 ? waitMs : DEFAULT_MEMBERSHIP_WAIT_MS
  const nowMs = Number.isFinite(Number(input.nowMs)) ? Number(input.nowMs) : Date.now()
  const since = input.membershipLoadingSinceMs
  const softTimedOut =
    membershipLoading &&
    since != null &&
    Number.isFinite(Number(since)) &&
    nowMs - Number(since) >= maxWait

  if (!authReady) {
    return { canFetch: false, showLoading: true, softTimedOut: false }
  }
  if (membershipLoading && !softTimedOut) {
    // Keep spinner while membership settles so login does not leave a stale FREE payload.
    return { canFetch: false, showLoading: true, softTimedOut: false }
  }
  return { canFetch: true, showLoading: softTimedOut, softTimedOut }
}
