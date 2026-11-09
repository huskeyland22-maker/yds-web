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
