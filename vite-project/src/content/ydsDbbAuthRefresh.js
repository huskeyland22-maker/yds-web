/**
 * 일상 조정 매수 — 로그인·멤버십 변경 후 스냅샷 재조회 게이트.
 * Firebase 인증 구조를 바꾸지 않고, 화면이 멤버십 확정 후에만 데이터를 다시 받는다.
 */

/**
 * @param {{
 *   authReady?: boolean
 *   membershipLoading?: boolean
 *   status?: string | null
 * }} input
 * @returns {{ canFetch: boolean, showLoading: boolean }}
 */
export function resolveDbbSnapshotFetchGate(input = {}) {
  const authReady = Boolean(input.authReady)
  const membershipLoading = Boolean(input.membershipLoading)
  if (!authReady) {
    return { canFetch: false, showLoading: true }
  }
  if (membershipLoading) {
    // Keep spinner while membership settles so login does not leave a stale FREE payload.
    return { canFetch: false, showLoading: true }
  }
  return { canFetch: true, showLoading: false }
}
