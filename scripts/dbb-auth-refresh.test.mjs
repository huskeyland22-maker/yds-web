/**
 * 일상 조정 매수 — 로그인 후 스냅샷 재조회 게이트
 * node --test scripts/dbb-auth-refresh.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveDbbSnapshotFetchGate } from "../vite-project/src/content/ydsDbbAuthRefresh.js"

describe("dbb auth refresh gate", () => {
  it("waits while auth is not ready", () => {
    assert.deepEqual(resolveDbbSnapshotFetchGate({ authReady: false, membershipLoading: false }), {
      canFetch: false,
      showLoading: true,
    })
  })

  it("keeps loading while membership settles after login", () => {
    assert.deepEqual(resolveDbbSnapshotFetchGate({ authReady: true, membershipLoading: true }), {
      canFetch: false,
      showLoading: true,
    })
  })

  it("fetches only after auth + membership are ready", () => {
    assert.deepEqual(
      resolveDbbSnapshotFetchGate({ authReady: true, membershipLoading: false, status: "free" }),
      { canFetch: true, showLoading: false },
    )
    assert.deepEqual(
      resolveDbbSnapshotFetchGate({ authReady: true, membershipLoading: false, status: "pro" }),
      { canFetch: true, showLoading: false },
    )
  })
})
