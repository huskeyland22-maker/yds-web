/**
 * Preview panic read-mirror helpers
 * node --test scripts/panic-preview-mirror.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isUsablePanicHistoryLatestMirror,
  isUsablePanicLatestMirror,
  resolvePanicMirrorOrigin,
} from "../api/_lib/panicPreviewMirror.js"

describe("panic preview mirror", () => {
  it("rejects emergency latest payloads", () => {
    assert.equal(
      isUsablePanicLatestMirror({
        emergency: true,
        data: { vix: 16.76, fearGreed: 50, putCall: 1, __emergency: true },
      }),
      false,
    )
  })

  it("accepts real production-shaped latest payloads", () => {
    assert.equal(
      isUsablePanicLatestMirror({
        ok: true,
        success: true,
        data: { vix: 21.15, fearGreed: 23, putCall: 0.9 },
      }),
      true,
    )
  })

  it("accepts history-latest rows with metrics", () => {
    assert.equal(
      isUsablePanicHistoryLatestMirror({
        ok: true,
        row: { date: "2026-11-02", vix: 21.15, fearGreed: 23 },
      }),
      true,
    )
    assert.equal(isUsablePanicHistoryLatestMirror({ ok: true, row: null }), false)
  })

  it("auto-enables mirror origin only on preview env", () => {
    const prev = process.env.VERCEL_ENV
    const prevOrigin = process.env.YDS_PANIC_MIRROR_ORIGIN
    try {
      delete process.env.YDS_PANIC_MIRROR_ORIGIN
      process.env.VERCEL_ENV = "preview"
      assert.equal(resolvePanicMirrorOrigin(), "https://yds-web-kappa.vercel.app")
      process.env.VERCEL_ENV = "production"
      assert.equal(resolvePanicMirrorOrigin(), null)
      process.env.YDS_PANIC_MIRROR_ORIGIN = "0"
      process.env.VERCEL_ENV = "preview"
      assert.equal(resolvePanicMirrorOrigin(), null)
    } finally {
      if (prev == null) delete process.env.VERCEL_ENV
      else process.env.VERCEL_ENV = prev
      if (prevOrigin == null) delete process.env.YDS_PANIC_MIRROR_ORIGIN
      else process.env.YDS_PANIC_MIRROR_ORIGIN = prevOrigin
    }
  })
})
