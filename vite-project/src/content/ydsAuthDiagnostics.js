/**
 * Preview / debug-only Firebase auth diagnostics.
 * Never stores or exposes email, ID tokens, access tokens, passwords, or cookies.
 */

import { FIREBASE_PRODUCTION_APP_HOST } from "./ydsFirebaseAuthDomain.js"

export const YDS_AUTH_DIAG_WINDOW_KEY = "__YDS_AUTH_DIAG"
export const YDS_AUTH_DEBUG_QUERY = "yds_auth_debug"
export const YDS_AUTH_FLOW_STORAGE_KEY = "yds.authFlowDiag"

/** @typedef {string} YdsAuthFlowStage */

export const AUTH_FLOW_STAGE = Object.freeze({
  IDLE: "idle",
  LOGIN_BUTTON_CLICKED: "login_button_clicked",
  LOGIN_FN_CALLED: "login_fn_called",
  SIGN_IN_STARTED: "sign_in_started",
  GOOGLE_REDIRECT_PREPARING: "google_redirect_preparing",
  REDIRECT_STARTED: "redirect_started",
  REDIRECT_RETURNED: "redirect_returned",
  REDIRECT_RESULT_CHECKED: "redirect_result_checked",
  AUTH_SUCCESS: "auth_success",
  AUTH_FAILURE: "auth_failure",
  AUTH_HANDOFF_EMPTY: "auth_handoff_empty",
})

const FLOW_STAGE_LABELS = Object.freeze({
  [AUTH_FLOW_STAGE.IDLE]: "로그인 버튼 클릭 전",
  [AUTH_FLOW_STAGE.LOGIN_BUTTON_CLICKED]: "로그인 버튼 클릭",
  [AUTH_FLOW_STAGE.LOGIN_FN_CALLED]: "로그인 함수 호출",
  [AUTH_FLOW_STAGE.SIGN_IN_STARTED]: "로그인 함수 호출",
  [AUTH_FLOW_STAGE.GOOGLE_REDIRECT_PREPARING]: "Google 인증 화면 이동 준비",
  [AUTH_FLOW_STAGE.REDIRECT_STARTED]: "redirect 시작",
  [AUTH_FLOW_STAGE.REDIRECT_RETURNED]: "redirect 복귀",
  [AUTH_FLOW_STAGE.REDIRECT_RESULT_CHECKED]: "redirect 결과 확인",
  [AUTH_FLOW_STAGE.AUTH_SUCCESS]: "인증 성공",
  [AUTH_FLOW_STAGE.AUTH_FAILURE]: "인증 실패",
  [AUTH_FLOW_STAGE.AUTH_HANDOFF_EMPTY]: "redirect 복귀·결과 없음",
})

/**
 * @typedef {object} YdsAuthFlowPersisted
 * @property {string} flowStage
 * @property {boolean} loginButtonClicked
 * @property {string | null} signInMethod
 * @property {boolean} signInCallStarted
 * @property {boolean} signInCallCompleted
 * @property {boolean} redirectStarted
 * @property {boolean} redirectResultChecked
 * @property {string | null} redirectErrorCode
 * @property {string | null} signInErrorCode
 * @property {boolean | null} pendingRedirectKeyPresent
 * @property {string | null} updatedAt
 */

/**
 * @typedef {object} YdsAuthDiagSnapshot
 * @property {boolean} authConfigPresent
 * @property {boolean} authInstancePresent
 * @property {boolean} authInitialized
 * @property {boolean} authBootReady
 * @property {boolean} authLoading
 * @property {boolean} redirectSettling
 * @property {boolean | null} redirectResultHasUser
 * @property {boolean | null} redirectResultPresent
 * @property {string | null} redirectErrorCode
 * @property {boolean | null} currentUserPresent
 * @property {boolean | null} onAuthStateChangedHasUser
 * @property {string | null} authDomain
 * @property {string | null} handlerRedirectUri
 * @property {string | null} pageHostname
 * @property {string | null} membershipStatus
 * @property {boolean} loginButtonClicked
 * @property {string | null} signInMethod
 * @property {boolean} signInCallStarted
 * @property {boolean} signInCallCompleted
 * @property {boolean} redirectStarted
 * @property {boolean} redirectResultChecked
 * @property {string | null} signInErrorCode
 * @property {boolean | null} pendingRedirectKeyPresent
 * @property {string} flowStage
 * @property {string} flowStageLabel
 * @property {string | null} lastUpdatedAt
 */

/** @returns {YdsAuthFlowPersisted} */
export function createEmptyAuthFlowPersisted() {
  return {
    flowStage: AUTH_FLOW_STAGE.IDLE,
    loginButtonClicked: false,
    signInMethod: null,
    signInCallStarted: false,
    signInCallCompleted: false,
    redirectStarted: false,
    redirectResultChecked: false,
    redirectErrorCode: null,
    signInErrorCode: null,
    pendingRedirectKeyPresent: null,
    updatedAt: null,
  }
}

/** @returns {YdsAuthDiagSnapshot} */
export function createEmptyAuthDiagSnapshot() {
  const flow = createEmptyAuthFlowPersisted()
  return {
    authConfigPresent: false,
    authInstancePresent: false,
    authInitialized: false,
    authBootReady: false,
    authLoading: true,
    redirectSettling: false,
    redirectResultHasUser: null,
    redirectResultPresent: null,
    redirectErrorCode: null,
    currentUserPresent: null,
    onAuthStateChangedHasUser: null,
    authDomain: null,
    handlerRedirectUri: null,
    pageHostname: null,
    membershipStatus: null,
    loginButtonClicked: flow.loginButtonClicked,
    signInMethod: flow.signInMethod,
    signInCallStarted: flow.signInCallStarted,
    signInCallCompleted: flow.signInCallCompleted,
    redirectStarted: flow.redirectStarted,
    redirectResultChecked: flow.redirectResultChecked,
    signInErrorCode: flow.signInErrorCode,
    pendingRedirectKeyPresent: flow.pendingRedirectKeyPresent,
    flowStage: flow.flowStage,
    flowStageLabel: flowStageLabel(flow.flowStage),
    lastUpdatedAt: null,
  }
}

/**
 * @param {string | null | undefined} stage
 * @returns {string}
 */
export function flowStageLabel(stage) {
  if (typeof stage === "string" && FLOW_STAGE_LABELS[stage]) return FLOW_STAGE_LABELS[stage]
  return FLOW_STAGE_LABELS[AUTH_FLOW_STAGE.IDLE]
}

/**
 * @param {Storage | null | undefined} storage
 * @returns {boolean}
 */
export function hasFirebasePendingRedirectKey(storage) {
  if (!storage) return false
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i) || ""
      if (key.startsWith("firebase:pendingRedirect:")) return true
    }
  } catch {
    return false
  }
  return false
}

/**
 * @param {{ sessionStorage?: Storage } | null | undefined} storeTarget
 * @returns {YdsAuthFlowPersisted}
 */
export function readAuthFlowPersisted(storeTarget = typeof window !== "undefined" ? window : null) {
  const empty = createEmptyAuthFlowPersisted()
  try {
    const raw = storeTarget?.sessionStorage?.getItem(YDS_AUTH_FLOW_STORAGE_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return empty
    return {
      ...empty,
      flowStage: typeof parsed.flowStage === "string" ? parsed.flowStage : empty.flowStage,
      loginButtonClicked: Boolean(parsed.loginButtonClicked),
      signInMethod: typeof parsed.signInMethod === "string" ? parsed.signInMethod : null,
      signInCallStarted: Boolean(parsed.signInCallStarted),
      signInCallCompleted: Boolean(parsed.signInCallCompleted),
      redirectStarted: Boolean(parsed.redirectStarted),
      redirectResultChecked: Boolean(parsed.redirectResultChecked),
      redirectErrorCode:
        typeof parsed.redirectErrorCode === "string" ? parsed.redirectErrorCode : null,
      signInErrorCode: typeof parsed.signInErrorCode === "string" ? parsed.signInErrorCode : null,
      pendingRedirectKeyPresent:
        typeof parsed.pendingRedirectKeyPresent === "boolean"
          ? parsed.pendingRedirectKeyPresent
          : null,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    }
  } catch {
    return empty
  }
}

/**
 * @param {Partial<YdsAuthFlowPersisted>} patch
 * @param {{ sessionStorage?: Storage } | null | undefined} storeTarget
 * @returns {YdsAuthFlowPersisted}
 */
export function patchAuthFlowPersisted(
  patch = {},
  storeTarget = typeof window !== "undefined" ? window : null,
) {
  const prev = readAuthFlowPersisted(storeTarget)
  const next = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  try {
    storeTarget?.sessionStorage?.setItem(YDS_AUTH_FLOW_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  return next
}

/**
 * @param {YdsAuthFlowPersisted} flow
 * @returns {boolean}
 */
export function shouldMarkRedirectReturned(flow) {
  if (!flow) return false
  if (flow.redirectResultChecked) return false
  return Boolean(flow.redirectStarted || flow.signInCallStarted)
}

/**
 * Classify empty redirect result after a started redirect (Safari handoff / persistence).
 * @param {{
 *   redirectStarted?: boolean
 *   redirectResultPresent?: boolean
 *   redirectResultHasUser?: boolean
 *   redirectErrorCode?: string | null
 *   currentUserPresent?: boolean
 * }} input
 * @returns {{ flowStage: string, redirectErrorCode: string | null }}
 */
export function classifyRedirectSettleOutcome(input = {}) {
  if (input.currentUserPresent || input.redirectResultHasUser) {
    return { flowStage: AUTH_FLOW_STAGE.AUTH_SUCCESS, redirectErrorCode: null }
  }
  if (input.redirectErrorCode) {
    return {
      flowStage: AUTH_FLOW_STAGE.AUTH_FAILURE,
      redirectErrorCode: input.redirectErrorCode,
    }
  }
  if (input.redirectStarted && !input.redirectResultPresent && !input.redirectResultHasUser) {
    return {
      flowStage: AUTH_FLOW_STAGE.AUTH_HANDOFF_EMPTY,
      redirectErrorCode: "yds/no-redirect-result-after-return",
    }
  }
  return {
    flowStage: AUTH_FLOW_STAGE.REDIRECT_RESULT_CHECKED,
    redirectErrorCode: null,
  }
}

/**
 * Merge patch into previous snapshot without accepting secret fields.
 * @param {YdsAuthDiagSnapshot} prev
 * @param {Partial<YdsAuthDiagSnapshot>} patch
 * @returns {YdsAuthDiagSnapshot}
 */
export function mergeAuthDiagSnapshot(prev, patch = {}) {
  const base = prev && typeof prev === "object" ? prev : createEmptyAuthDiagSnapshot()
  const next = { ...base }
  const allowed = Object.keys(createEmptyAuthDiagSnapshot())
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      next[key] = patch[key]
    }
  }
  if (typeof next.flowStage === "string") {
    next.flowStageLabel = flowStageLabel(next.flowStage)
  }
  next.lastUpdatedAt = new Date().toISOString()
  return next
}

/**
 * Apply persisted flow fields onto a diag snapshot patch.
 * @param {YdsAuthFlowPersisted} flow
 * @returns {Partial<YdsAuthDiagSnapshot>}
 */
export function diagPatchFromAuthFlow(flow) {
  const f = flow && typeof flow === "object" ? flow : createEmptyAuthFlowPersisted()
  return {
    loginButtonClicked: Boolean(f.loginButtonClicked),
    signInMethod: f.signInMethod,
    signInCallStarted: Boolean(f.signInCallStarted),
    signInCallCompleted: Boolean(f.signInCallCompleted),
    redirectStarted: Boolean(f.redirectStarted),
    redirectResultChecked: Boolean(f.redirectResultChecked),
    redirectErrorCode: f.redirectErrorCode,
    signInErrorCode: f.signInErrorCode,
    pendingRedirectKeyPresent: f.pendingRedirectKeyPresent,
    flowStage: f.flowStage || AUTH_FLOW_STAGE.IDLE,
    flowStageLabel: flowStageLabel(f.flowStage),
  }
}

/**
 * Publish safe snapshot for Preview console inspection.
 * @param {YdsAuthDiagSnapshot} snapshot
 * @param {Window | null | undefined} target
 */
export function publishAuthDiagSnapshot(snapshot, target = typeof window !== "undefined" ? window : null) {
  if (!target || typeof target !== "object") return
  try {
    target[YDS_AUTH_DIAG_WINDOW_KEY] = snapshot
  } catch {
    // ignore
  }
}

/**
 * Show auth debug chrome on Preview hosts or when explicitly requested.
 * Production app host never auto-shows (query/localStorage override only).
 * @param {{ hostname?: string, search?: string, localStorage?: Storage } | null | undefined} loc
 */
export function shouldShowAuthDebugPanel(loc = typeof window !== "undefined" ? window.location : null) {
  if (!loc) return false
  const hostname =
    typeof loc.hostname === "string" ? loc.hostname.trim().toLowerCase() : ""
  let search = typeof loc.search === "string" ? loc.search : ""
  let forced = false
  try {
    if (typeof window !== "undefined") {
      search = search || window.location.search || ""
      forced =
        new URLSearchParams(search).get(YDS_AUTH_DEBUG_QUERY) === "1" ||
        window.localStorage?.getItem("yds-auth-debug") === "1"
    } else if (search) {
      forced = new URLSearchParams(search).get(YDS_AUTH_DEBUG_QUERY) === "1"
    }
  } catch {
    forced = false
  }

  if (hostname === FIREBASE_PRODUCTION_APP_HOST) return forced
  if (forced) return true
  if (hostname.endsWith(".vercel.app")) return true
  if (hostname === "localhost" || hostname === "127.0.0.1") return forced
  return false
}

/**
 * Whether UI should treat auth as still settling (hide premature logout CTA).
 * @param {{ authBootReady?: boolean, redirectSettling?: boolean, hasUser?: boolean }} input
 */
export function isAuthUiPending(input = {}) {
  if (input.hasUser) return false
  if (input.redirectSettling) return true
  if (input.authBootReady === false) return true
  return false
}
