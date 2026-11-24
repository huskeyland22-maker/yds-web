import { describe, it } from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  buildLicenseSafeSnapshotsFromCache,
  engineResultToLicenseSafeSnapshot,
  licenseSafeBundleToEngineShape,
  LICENSE_SAFE_CALC_VERSION,
} from "./licenseSafeSnapshotBuilder.js"
import { computeCciAt } from "./engine.js"
import { loadLicenseSafeSeriesMap } from "./localHistoryProvider.js"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const CACHE = path.join(ROOT, ".cache", "credit-cycle")

describe("licenseSafeSnapshotBuilder", () => {
  it("builds NON_PIT license_safe snapshots without HY/BBB numerics", async () => {
    const bundle = await buildLicenseSafeSnapshotsFromCache(CACHE, { from: "2020-01-01" })
    assert.equal(bundle.meta.mode, "license_safe")
    assert.equal(bundle.meta.pitLabel, "NON_PIT")
    assert.equal(bundle.meta.stagingDbWrite, false)
    assert.ok(bundle.meta.snapshotCount >= 1)
    assert.ok(bundle.latest)
    assert.notEqual(bundle.latest.as_of_date, "1900-01-01")
    assert.equal(bundle.latest.data_mode, "license_safe")
    assert.equal(bundle.latest.pit_status, "NON_PIT")
    assert.equal(bundle.latest.calculation_version, LICENSE_SAFE_CALC_VERSION)
    assert.equal(bundle.latest.payload, null)

    const hy = bundle.latest.indicator_scores.find((r) => r.indicator_code === "hy")
    const bbb = bundle.latest.indicator_scores.find((r) => r.indicator_code === "bbb")
    assert.equal(hy.license_restricted, true)
    assert.equal(hy.raw_value, null)
    assert.equal(hy.indicator_score, null)
    assert.equal(bbb.raw_value, null)

    const safe = bundle.latest.indicator_scores.filter((r) => !r.license_restricted)
    assert.ok(safe.some((r) => ["sloos", "cpff", "bank", "cre", "corp_delinq"].includes(r.indicator_code)))
    for (const r of safe) {
      assert.ok(r.observation_date == null || typeof r.observation_date === "string")
    }
  })

  it("refuses test seed asOf", async () => {
    const map = await loadLicenseSafeSeriesMap(CACHE)
    const asOf = Object.values(map).flat().map((o) => o.observation_date).sort().at(-1)
    const engine = computeCciAt(map, asOf, { mode: "license_safe", pitMode: "obs_date" })
    assert.throws(() => engineResultToLicenseSafeSnapshot(engine, "1900-01-01"), /test_seed/)
  })

  it("maps bundle to engine shape for UI", async () => {
    const bundle = await buildLicenseSafeSnapshotsFromCache(CACHE, { from: "2022-01-01" })
    const shaped = licenseSafeBundleToEngineShape(bundle)
    assert.equal(shaped.mode, "license_safe")
    assert.equal(shaped.pitStatus, "NON_PIT")
    assert.ok(!shaped.indicators.some((i) => i.id === "hy" && i.score != null))
  })
})
