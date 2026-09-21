/**
 * Panic 장기 검증 회귀 — 고정 9저점 / 40·27·33 핵심 수치
 * node --test scripts/panic-spx-validation-regression.test.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import {
  VALIDATION_BOTTOMS,
  buildBottomsMeta,
  buildSummary,
  simulate402733ForBottom,
} from "./lib/panic-spx-validation-core.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SERIES = path.join(
  __dirname,
  "..",
  "vite-project",
  "public",
  "data",
  "panic-spx-validation-series.json",
)

function loadSeries() {
  return JSON.parse(fs.readFileSync(SERIES, "utf8"))
}

describe("panic-spx-validation regression", () => {
  it("keeps 9 fixed bottoms", () => {
    assert.equal(VALIDATION_BOTTOMS.length, 9)
    const doc = loadSeries()
    assert.equal(doc.summary.n, 9)
    assert.deepEqual(
      doc.bottoms.map((b) => b.d0),
      [...VALIDATION_BOTTOMS],
    )
  })

  it("matches peak-window hit rates 8/9 · 4/9 · 3/9", () => {
    const doc = loadSeries()
    assert.equal(doc.summary.hit50, 8)
    assert.equal(doc.summary.hit60, 4)
    assert.equal(doc.summary.hit70, 3)

    const rebuilt = buildBottomsMeta(doc.rows, VALIDATION_BOTTOMS)
    const summary = buildSummary(rebuilt)
    assert.equal(summary.hit50, 8)
    assert.equal(summary.hit60, 4)
    assert.equal(summary.hit70, 3)
  })

  it("40/27/33 buckets: full3=3 stage1_only=4 none=1", () => {
    const doc = loadSeries()
    const cases = VALIDATION_BOTTOMS.map((d0) =>
      simulate402733ForBottom(doc.rows, d0),
    )
    assert.equal(cases.filter((c) => c.bucket === "full3").length, 3)
    assert.equal(cases.filter((c) => c.bucket === "stage1_only").length, 4)
    assert.equal(cases.filter((c) => c.bucket === "none").length, 1)
    assert.equal(cases.filter((c) => c.bucket === "stage2").length, 1)
  })

  it("2025-04-08: 60/70 same day and D0 ≈ -8.8%", () => {
    const doc = loadSeries()
    const c = simulate402733ForBottom(doc.rows, "2025-04-08")
    assert.equal(c.bucket, "full3")
    const f60 = c.fills.find((f) => f.tag === "60")
    const f70 = c.fills.find((f) => f.tag === "70")
    assert.ok(f60 && f70)
    assert.equal(f60.date, f70.date)
    assert.equal(f60.date, "2025-04-03")
    assert.equal(c.retD0, -8.8)
    assert.equal(c.deployed, 100)
    assert.equal(c.cash, 0)
  })
})
