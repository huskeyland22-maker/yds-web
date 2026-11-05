/**
 * node --test scripts/firebase-auth-domain.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  FIREBASE_PROJECT_AUTH_DOMAIN,
  firebaseAuthHandlerRedirectUri,
  resolveAuthHandoffMode,
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
    assert.equal(
      firebaseAuthHandlerRedirectUri("yds-web-kappa.vercel.app"),
      "https://yds-web-kappa.vercel.app/__/auth/handler",
    )
    assert.equal(
      resolveAuthHandoffMode("yds-web-kappa.vercel.app", "yds-web-kappa.vercel.app"),
      "same-origin",
    )
  })

  it("uses Preview vercel.app hostname as same-origin authDomain (Firebase Option 3)", () => {
    const previewHost = "yds-web-git-integration-yds-windows-mac-so-sung-yangs-projects.vercel.app"
    assert.equal(
      resolveFirebaseAuthDomain("yds-web-fec1e.firebaseapp.com", { hostname: previewHost }),
      previewHost,
    )
    assert.equal(
      firebaseAuthHandlerRedirectUri(previewHost),
      `https://${previewHost}/__/auth/handler`,
    )
    assert.equal(resolveAuthHandoffMode(previewHost, previewHost), "same-origin")
    // Previous cross-origin Preview config (broken on mobile Chrome/Safari):
    assert.equal(
      resolveAuthHandoffMode(FIREBASE_PROJECT_AUTH_DOMAIN, previewHost),
      "cross-origin",
    )
  })

  it("keeps project auth domain for unknown hosts and localhost", () => {
    assert.equal(
      resolveFirebaseAuthDomain("yds-web-fec1e.firebaseapp.com", { hostname: "example.com" }),
      "yds-web-fec1e.firebaseapp.com",
    )
    assert.equal(
      resolveFirebaseAuthDomain("yds-web-fec1e.firebaseapp.com", { hostname: "localhost" }),
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
