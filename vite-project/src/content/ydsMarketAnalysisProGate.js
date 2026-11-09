/**
 * /market-analysis Panic Index — which blocks need PRO membership.
 * Visibility is driven only by useMembership().isPro (server plan).
 */

/**
 * @param {boolean} isPro — must be useMembership().isPro (fail-closed elsewhere)
 * @returns {{
 *   freeHero: true
 *   freeFearScale: true
 *   freeLede: true
 *   proHistoryChart: boolean
 *   proDriversDetail: boolean
 *   proDcaGuidance: boolean
 * }}
 */
export function buildPanicCenterVisibility(isPro) {
  const unlocked = isPro === true
  return {
    freeHero: true,
    freeFearScale: true,
    freeLede: true,
    proHistoryChart: unlocked,
    proDriversDetail: unlocked,
    proDcaGuidance: unlocked,
  }
}

export const PANIC_PRO_LOCK_COPY = Object.freeze({
  title: "PRO 전용 기능입니다",
  body: "Panic Index 히스토리 차트·상세 Drivers·분할매수 참고 안내는 PRO 멤버십에서 확인할 수 있습니다. 현재 점수와 FEAR SCALE은 계속 이용할 수 있습니다.",
})

export const PANIC_LAB_PRO_LOCK_COPY = Object.freeze({
  title: PANIC_PRO_LOCK_COPY.title,
  body: "패닉 연구실(Panic Lab)은 Panic Index 히스토리와 동일한 PRO 멤버십 기능입니다. 현재 점수와 FEAR SCALE은 시장분석에서 계속 이용할 수 있습니다.",
})

/**
 * PRO 전용 히스토리 소비(Lab·차트)용 — FREE/비PRO는 로컬·store 시계열을 넘기지 않는다.
 * localStorage는 삭제하지 않으며, 호출 측에서 빈 배열만 사용한다.
 * @param {unknown} rows
 * @param {boolean} isPro — useMembership().isPro
 * @returns {object[]}
 */
export function resolvePanicHistoryRowsForProFeature(rows, isPro) {
  if (isPro !== true) return []
  return Array.isArray(rows) ? rows : []
}

/**
 * Hub history가 membership으로 거부된 경우(localStorage를 store에 올리지 않음).
 * @param {string | null | undefined} invalidReason — fetchPanicIndexHistory bundle.invalidReason
 */
export function allowLocalPanicHistoryMergeAfterHubFetch(invalidReason) {
  return invalidReason !== "pro_required"
}

/**
 * Hub history fetch threw (network / 5xx) — localStorage → store fallback.
 * PRO only; FREE / loading / unknown stay fail-closed (LS on disk is not deleted).
 * @param {boolean} isPro — useMembership().isPro (must be strictly true)
 */
export function allowLocalPanicHistoryFallbackOnApiError(isPro) {
  return isPro === true
}
