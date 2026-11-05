/**
 * node --test src/content/ydsAuthDiagnostics.test.js
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  createEmptyAuthDiagSnapshot,
  isAuthUiPending,
  mergeAuthDiagSnapshot,
  shouldShowAuthDebugPanel,
} from "./ydsAuthDiagnostics.js"
import { shouldClearUserOnAuthNull } from "./ydsFirebaseAuthDomain.js"

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
})
