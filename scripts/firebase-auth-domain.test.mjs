/**
 * node --test scripts/firebase-auth-domain.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  resolveFirebaseAuthDomain,
  shouldClearUserOnAuthNull,
} from "../vite-project/src/content/ydsFirebaseAuthDomain.js"

describe("firebase auth domain", () => {
  it("uses production app host on production vercel hostname", () => {
    assert.equal(
      resolveFirebaseAuthDomain("yds-web-fec1e.firebaseapp.com", {
        hostname: "yds-web-kappa.vercel.app",
      }),
      "yds-web-kappa.vercel.app",
    )
  })

  it("uses same-origin host on Preview vercel.app aliases", () => {
    assert.equal(
      resolveFirebaseAuthDomain("yds-web-fec1e.firebaseapp.com", {
        hostname: "yds-web-git-integration-yds-windows-mac-so-sung-yangs-projects.vercel.app",
      }),
      "yds-web-git-integration-yds-windows-mac-so-sung-yangs-projects.vercel.app",
    )
  })

  it("keeps project auth domain for unknown hosts", () => {
    assert.equal(
      resolveFirebaseAuthDomain("yds-web-fec1e.firebaseapp.com", { hostname: "example.com" }),
      "yds-web-fec1e.firebaseapp.com",
    )
  })
})

describe("auth null clearing during redirect", () => {
  it("does not clear while redirect is settling", () => {
    assert.equal(
      shouldClearUserOnAuthNull({ nextUser: null, redirectSettling: true, authCurrentUser: null }),
      false,
    )
  })

  it("clears when fully logged out", () => {
    assert.equal(
      shouldClearUserOnAuthNull({ nextUser: null, redirectSettling: false, authCurrentUser: null }),
      true,
    )
  })
})
