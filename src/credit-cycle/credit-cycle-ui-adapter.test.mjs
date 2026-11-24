import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  adaptEngineResultToUi,
  adaptResearchSnapshotToUi,
  assertNoHyBbbLeak,
  buildPreparingSnapshot,
  UI_FEED_STATUS,
} from "./uiAdapter.js"
import { computeCciAt } from "./engine.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "../..")

describe("credit-cycle ui adapter", () => {
  it("preparing snapshot has null CCI and no invented scores", () => {
    const dto = buildPreparingSnapshot()
    assert.equal(dto.feedStatus, UI_FEED_STATUS.PREPARING)
    assert.equal(dto.cci, null)
    assert.equal(dto.hold, true)
    assert.ok(assertNoHyBbbLeak(dto))
  })

  it("adapts research snapshot without HY/BBB numbers", async () => {
    const raw = await readFile(
      path.join(root, "vite-project/public/credit-cycle/research-snapshot.json"),
      "utf8",
    )
    const snap = JSON.parse(raw)
    const dto = adaptResearchSnapshotToUi(snap)
    assert.equal(dto.feedStatus, UI_FEED_STATUS.RESEARCH_SNAPSHOT)
    assert.equal(dto.mode, "license_safe")
    assert.equal(dto.cci, 32.7)
    assert.ok(dto.asOf)
    assert.ok(assertNoHyBbbLeak(dto))
    const hy = dto.indicators.find((i) => i.id === "hy")
    assert.equal(hy.licenseRestricted, true)
    assert.equal(hy.value, null)
    assert.equal(hy.riskScore, null)
    assert.equal(dto.warningPolicy.evidence, "INSUFFICIENT_EVIDENCE")
    assert.ok(dto.history?.GFC?.mode === "NON_PIT")
    assert.ok(dto.history?.COVID?.mode === "PIT")
  })

  it("engine computeCciAt maps through adapter without HY/BBB leak", () => {
    const mk = (id, dates, values) =>
      dates.map((d, i) => ({
        series_id: id,
        observation_date: d,
        release_date: d,
        value: values[i],
        frequency: "quarterly",
        source: "test",
      }))
    const dates = [
      "2022-03-31",
      "2022-06-30",
      "2022-09-30",
      "2022-12-31",
      "2023-03-31",
      "2023-06-30",
      "2023-09-30",
      "2023-12-31",
    ]
    const seriesMap = {
      sloos: mk("DRTSCILM", dates, [10, 20, 30, 40, 45, 50, 55, 40]),
      cpff: dates.map((d, i) => ({
        series_id: "CPFF",
        observation_date: d,
        release_date: d,
        value: 0.1 + i * 0.02,
        frequency: "daily",
        source: "test",
      })),
      bank: dates.map((d, i) => ({
        series_id: "FDIC_BANK_SOUNDNESS",
        observation_date: d,
        release_date: d,
        value: 30 + i,
        frequency: "quarterly",
        source: "test",
      })),
      cre: mk("DRCRELEXFACBS", dates, [1, 1.2, 1.4, 1.5, 1.6, 1.7, 1.8, 1.5]),
      corp_delinq: mk("DRBLACBS", dates, [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.4]),
      // research-only series present but license_safe mode must block
      hy: dates.map((d) => ({
        series_id: "BAMLH0A0HYM2",
        observation_date: d,
        release_date: d,
        value: 5,
        frequency: "daily",
        source: "test",
      })),
      bbb: dates.map((d) => ({
        series_id: "BAMLC0A4CBBB",
        observation_date: d,
        release_date: d,
        value: 2,
        frequency: "daily",
        source: "test",
      })),
    }
    const engine = computeCciAt(seriesMap, "2023-12-31", { mode: "license_safe", pitMode: "strict" })
    const dto = adaptEngineResultToUi(engine, {
      feedStatus: UI_FEED_STATUS.LIVE,
      priorCci: 40,
    })
    assert.equal(dto.mode, "license_safe")
    assert.ok(assertNoHyBbbLeak(dto))
    assert.equal(dto.indicators.find((i) => i.id === "hy").quality, "LICENSE_RESTRICTED")
    if (dto.cci != null) {
      assert.ok(Number.isFinite(dto.cci))
    }
  })

  it("missing engine result → preparing", () => {
    const dto = adaptEngineResultToUi(null)
    assert.equal(dto.feedStatus, UI_FEED_STATUS.PREPARING)
    assert.equal(dto.cci, null)
  })
})
