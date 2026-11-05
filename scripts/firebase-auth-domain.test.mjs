/**
 * node --test scripts/firebase-auth-domain.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  FIREBASE_PROJECT_AUTH_DOMAIN,
  firebaseAuthHandlerRedirectUri,
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
  })

  it("keeps project authDomain on Preview vercel.app (avoids redirect_uri_mismatch)", () => {
    const previewHost = "yds-web-git-integration-yds-windows-mac-so-sung-yangs-projects.vercel.app"
    assert.equal(
      resolveFirebaseAuthDomain("yds-web-fec1e.firebaseapp.com", { hostname: previewHost }),
      FIREBASE_PROJECT_AUTH_DOMAIN,
    )
    assert.equal(
      firebaseAuthHandlerRedirectUri(FIREBASE_PROJECT_AUTH_DOMAIN),
      "https://yds-web-fec1e.firebaseapp.com/__/auth/handler",
    )
    // Broken previous behavior produced this mismatched redirect_uri:
    assert.notEqual(
      firebaseAuthHandlerRedirectUri(FIREBASE_PROJECT_AUTH_DOMAIN),
      `https://${previewHost}/__/auth/handler`,
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
