import { describe, it } from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { readFile } from "node:fs/promises"
import {
  fredCurrentToObservations,
  inventoryLocalCaches,
  loadLicenseSafeSeriesMap,
  buildLocalHistoryUiBundle,
  buildQuarterAsOfDates,
} from "./localHistoryProvider.js"
import {
  adaptLocalHistoryBundleToUi,
  assertNoHyBbbLeak,
  UI_FEED_STATUS,
} from "./uiAdapter.js"
import { computeCciAt } from "./engine.js"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const CACHE = path.join(ROOT, ".cache", "credit-cycle")

describe("credit-cycle local history provider", () => {
  it("fredCurrentToObservations sorts and skips missing; no invented release", () => {
    const obs = fredCurrentToObservations(
      {
        retrieved_at: "2026-01-01T00:00:00Z",
        observations: [
          { date: "2020-06-01", value: "2" },
          { date: "2020-03-01", value: "." },
          { date: "2020-09-01", value: "3" },
        ],
      },
      "DRTSCILM",
      "quarterly",
    )
    assert.equal(obs.length, 2)
    assert.equal(obs[0].observation_date, "2020-06-01")
    assert.equal(obs[1].observation_date, "2020-09-01")
    assert.equal(obs[0].release_date, null)
    assert.equal(obs[0].vintage_available, false)
  })

  it("inventory lists license-safe series and marks HY/BBB restricted without values", async () => {
    const inv = await inventoryLocalCaches(CACHE)
    assert.ok(inv.indicators.sloos?.count > 0)
    assert.ok(inv.indicators.cpff?.count > 0)
    assert.equal(inv.indicators.hy.licenseRestricted, true)
    assert.equal(inv.indicators.hy.valuesExportedToUi, false)
    assert.equal(inv.indicators.sloos.pitCapableFromThisFile, false)
  })

  it("loads series map and computeCciAt license_safe connects", async () => {
    const map = await loadLicenseSafeSeriesMap(CACHE)
    assert.ok((map.sloos || []).length > 10)
    assert.ok((map.bank || []).length >= 1)
    const dates = buildQuarterAsOfDates(map, { from: "2023-01-01", to: "2023-12-31" })
    assert.ok(dates.length >= 1)
    const asOf = dates[dates.length - 1]
    const r = computeCciAt(map, asOf, { mode: "license_safe", pitMode: "obs_date" })
    assert.equal(r.mode, "license_safe")
    assert.ok(r.coverage == null || r.coverage >= 0)
    // missing must not become 0 score coercion — null scores stay null
    for (const ind of r.indicators || []) {
      if (ind.quality === "MISSING") assert.equal(ind.score, null)
    }
  })

  it("UI bundle adapts as LOCAL_CACHE without HY/BBB leak", async () => {
    const bundle = await buildLocalHistoryUiBundle(CACHE, { researchHistory: null })
    assert.equal(bundle.meta.feedStatus, "LOCAL_CACHE")
    assert.equal(bundle.meta.pitLabel, "NON_PIT")
    assert.equal(bundle.series.hy.lastValue, null)
    assert.deepEqual(bundle.series.hy.points, [])
    assert.ok((bundle.series.sloos.points || []).length > 0)
    assert.ok(bundle.series.sloos.lastObservationDate)

    const slim = {
      meta: bundle.meta,
      inventory: bundle.inventory,
      priorCci: bundle.priorCci,
      latestEngine: bundle.latestEngine,
      cciPath: bundle.cciPath,
      series: bundle.series,
      researchHistory: null,
    }
    const dto = adaptLocalHistoryBundleToUi(slim)
    assert.equal(dto.feedStatus, UI_FEED_STATUS.LOCAL_CACHE)
    assert.equal(dto.pitLabel, "NON_PIT")
    assert.ok(assertNoHyBbbLeak(dto))
    const sloos = dto.indicators.find((i) => i.id === "sloos")
    assert.ok(sloos.seriesPoints.length > 0)
    assert.ok(sloos.observationDate)
    // release may be null for FRED current vintage — must not invent
    assert.ok(sloos.releaseDate == null || typeof sloos.releaseDate === "string")
  })

  it("research snapshot file still present and distinct", async () => {
    const raw = await readFile(
      path.join(ROOT, "vite-project/public/credit-cycle/research-snapshot.json"),
      "utf8",
    )
    const j = JSON.parse(raw)
    assert.equal(j.meta.feedStatus, "RESEARCH_SNAPSHOT")
  })
})
