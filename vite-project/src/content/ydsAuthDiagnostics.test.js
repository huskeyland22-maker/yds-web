/**
 * node --test src/content/ydsAuthDiagnostics.test.js
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  AUTH_FLOW_STAGE,
  classifyRedirectSettleOutcome,
  createEmptyAuthDiagSnapshot,
  diagPatchFromAuthFlow,
  flowStageLabel,
  isAuthUiPending,
  mergeAuthDiagSnapshot,
  patchAuthFlowPersisted,
  readAuthFlowPersisted,
  shouldMarkRedirectReturned,
  shouldShowAuthDebugPanel,
} from "./ydsAuthDiagnostics.js"
import { shouldClearUserOnAuthNull } from "./ydsFirebaseAuthDomain.js"

function memoryWindow(initial = {}) {
  const map = new Map(Object.entries(initial))
  const sessionStorage = {
    get length() {
      return map.size
    },
    key(index) {
      return [...map.keys()][index] ?? null
    },
    getItem(key) {
      return map.has(key) ? map.get(key) : null
    },
    setItem(key, value) {
      map.set(key, String(value))
    },
    removeItem(key) {
      map.delete(key)
    },
  }
  return { sessionStorage }
}

describe("ydsAuthDiagnostics", () => {
  it("merges only safe fields and stamps lastUpdatedAt", () => {
    const prev = createEmptyAuthDiagSnapshot()
    const next = mergeAuthDiagSnapshot(prev, {
      authBootReady: true,
      currentUserPresent: true,
      email: "secret@example.com",
      idToken: "tok",
    })
    assert.equal(next.authBootReady, true)
    assert.equal(next.currentUserPresent, true)
    assert.ok(next.lastUpdatedAt)
    assert.equal(Object.prototype.hasOwnProperty.call(next, "email"), false)
    assert.equal(Object.prototype.hasOwnProperty.call(next, "idToken"), false)
  })

  it("shows panel on Preview vercel hosts, not Production unless forced", () => {
    assert.equal(
      shouldShowAuthDebugPanel({
        hostname: "yds-web-git-integration-yds-windows-mac-so-sung-yangs-projects.vercel.app",
        search: "",
      }),
      true,
    )
    assert.equal(
      shouldShowAuthDebugPanel({
        hostname: "yds-web-kappa.vercel.app",
        search: "",
      }),
      false,
    )
    assert.equal(
      shouldShowAuthDebugPanel({
        hostname: "yds-web-kappa.vercel.app",
        search: "?yds_auth_debug=1",
      }),
      true,
    )
  })

  it("keeps login CTA pending until boot ready and not settling", () => {
    assert.equal(
      isAuthUiPending({ authBootReady: false, redirectSettling: false, hasUser: false }),
      true,
    )
    assert.equal(
      isAuthUiPending({ authBootReady: true, redirectSettling: true, hasUser: false }),
      true,
    )
    assert.equal(
      isAuthUiPending({ authBootReady: true, redirectSettling: false, hasUser: false }),
      false,
    )
    assert.equal(
      isAuthUiPending({ authBootReady: false, redirectSettling: true, hasUser: true }),
      false,
    )
  })

  it("does not clear UI user while auth boot is pending", () => {
    assert.equal(
      shouldClearUserOnAuthNull({
        nextUser: null,
        redirectSettling: false,
        authCurrentUser: null,
        authBootPending: true,
      }),
      false,
    )
    assert.equal(
      shouldClearUserOnAuthNull({
        nextUser: null,
        redirectSettling: false,
        authCurrentUser: null,
        authBootPending: false,
      }),
      true,
    )
  })

  it("persists login flow stages across sessionStorage for redirect return", () => {
    const win = memoryWindow()
    patchAuthFlowPersisted(
      {
        flowStage: AUTH_FLOW_STAGE.REDIRECT_STARTED,
        loginButtonClicked: true,
        signInMethod: "redirect",
        signInCallStarted: true,
        signInCallCompleted: true,
        redirectStarted: true,
      },
      win,
    )
    const restored = readAuthFlowPersisted(win)
    assert.equal(restored.redirectStarted, true)
    assert.equal(restored.loginButtonClicked, true)
    assert.equal(restored.signInMethod, "redirect")
    assert.equal(shouldMarkRedirectReturned(restored), true)
    assert.equal(flowStageLabel(AUTH_FLOW_STAGE.REDIRECT_STARTED), "redirect 시작")
  })

  it("classifies empty redirect after start as handoff empty", () => {
    const empty = classifyRedirectSettleOutcome({
      redirectStarted: true,
      redirectResultPresent: false,
      redirectResultHasUser: false,
      redirectErrorCode: null,
      currentUserPresent: false,
    })
    assert.equal(empty.flowStage, AUTH_FLOW_STAGE.AUTH_HANDOFF_EMPTY)
    assert.equal(empty.redirectErrorCode, "yds/no-redirect-result-after-return")

    const ok = classifyRedirectSettleOutcome({
      redirectStarted: true,
      redirectResultHasUser: true,
      currentUserPresent: true,
    })
    assert.equal(ok.flowStage, AUTH_FLOW_STAGE.AUTH_SUCCESS)

    const failed = classifyRedirectSettleOutcome({
      redirectStarted: true,
      redirectErrorCode: "auth/unauthorized-domain",
      currentUserPresent: false,
    })
    assert.equal(failed.flowStage, AUTH_FLOW_STAGE.AUTH_FAILURE)

    const coldBootNoise = classifyRedirectSettleOutcome({
      redirectStarted: false,
      redirectErrorCode: "auth/argument-error",
      currentUserPresent: false,
    })
    assert.equal(coldBootNoise.flowStage, AUTH_FLOW_STAGE.IDLE)
    assert.equal(coldBootNoise.redirectErrorCode, "auth/argument-error")
  })

  it("diagPatchFromAuthFlow exposes step flags without secrets", () => {
    const patch = diagPatchFromAuthFlow({
      flowStage: AUTH_FLOW_STAGE.LOGIN_BUTTON_CLICKED,
      loginButtonClicked: true,
      signInMethod: "redirect",
      signInCallStarted: true,
      signInCallCompleted: false,
      redirectStarted: false,
      redirectResultChecked: false,
      redirectErrorCode: null,
      signInErrorCode: null,
      pendingRedirectKeyPresent: false,
      updatedAt: "x",
      email: "nope@example.com",
    })
    assert.equal(patch.loginButtonClicked, true)
    assert.equal(patch.signInMethod, "redirect")
    assert.equal(Object.prototype.hasOwnProperty.call(patch, "email"), false)
  })
})
