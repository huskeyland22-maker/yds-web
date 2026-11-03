/**
 * Unified FREE/PRO access policy for ETF + equity Daily Bottom Buy.
 *
 * Audience (3): logged-out visitor · FREE member · PRO member
 * Functional tiers (2): FREE (logged-out === FREE data) · PRO (full detail)
 * Analysis payload never differs between logged-out and FREE — only CTA copy may.
 */

import { MEMBERSHIP_STATUS } from "./ydsMembership.js"

/** FREE-visible summary (both products). */
export const DBB_FREE_VISIBLE = Object.freeze([
  "symbol_or_ticker",
  "name_or_theme",
  "sector_or_group",
  "candidate_list",
  "brief_status_label",
  "score_n_of_4",
  "basic_service_copy",
])

/** PRO-only detail (both products). */
export const DBB_PRO_ONLY = Object.freeze([
  "rsi",
  "stoch_k",
  "bb_pct_b",
  "ma20_gap",
  "atr_detail",
  "condition_pass_value",
  "detailed_signal_reading",
  "pro_analysis_copy",
])

export const DBB_SHARED_PRO_LOCK_COPY = Object.freeze({
  title: "PRO 전용 상세 분석입니다",
  body: "RSI·Stoch %K·BB %B·MA20 Gap·ATR 및 조건별 상세 수치는 PRO에서 확인할 수 있습니다. 종목·섹터·후보 목록·간략 상태·점수(N/4)는 FREE에서도 동일하게 볼 수 있습니다.",
})

/**
 * Login vs upgrade CTA only — never changes analysis visibility.
 * @param {{
 *   isPro?: boolean
 *   isLoggedOut?: boolean
 *   status?: string | null
 * }} opts
 * @returns {{ kind: "login" | "upgrade", title: string, body: string } | null}
 */
export function buildDbbMembershipAudienceCta(opts = {}) {
  if (opts.isPro === true) return null

  const loggedOut =
    opts.isLoggedOut === true || opts.status === MEMBERSHIP_STATUS.LOGGED_OUT

  if (loggedOut) {
    return {
      kind: "login",
      title: "무료 회원가입 또는 로그인",
      body: "비로그인과 FREE 회원은 같은 요약 정보를 봅니다. 계정을 만들거나 로그인해도 상세 지표는 열리지 않으며, PRO에서 RSI·Stoch·BB%B·MA20·ATR 등 상세를 확인할 수 있습니다.",
    }
  }

  return {
    kind: "upgrade",
    title: "PRO 업그레이드 안내",
    body: "현재 FREE 권한입니다. 후보·점수(N/4)·간략 상태는 그대로 이용할 수 있고, 상세 지표와 조건별 분석은 PRO 멤버십에서 열립니다.",
  }
}
