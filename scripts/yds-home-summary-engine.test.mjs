/**
 * YDS 홈 요약 엔진 — node --test scripts/yds-home-summary-engine.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildHomeCreditSummary,
  buildHomeEquityDbbSummary,
  buildHomeEtfDbbSummary,
  buildHomeFearSummary,
  buildHomeHeaderAsOfLabel,
  buildHomeJudgmentNarrative,
  buildHomePortfolioSummary,
  isLicenseRestrictedYieldLike,
  pickHomeHeaderAsOf,
  resolveHomePutCallDisplay,
} from "../vite-project/src/content/ydsHomeSummaryEngine.js"

describe("resolveHomePutCallDisplay", () => {
  it("shows verified ratio in API range", () => {
    const r = resolveHomePutCallDisplay(0.92)
    assert.equal(r.ok, true)
    assert.equal(r.unit, "ratio")
    assert.equal(r.display, "0.92")
  })

  it("hides out-of-range raw like 11 as 확인 필요", () => {
    const r = resolveHomePutCallDisplay(11)
    assert.equal(r.ok, false)
    assert.equal(r.display, "확인 필요")
    assert.equal(r.reason, "out_of_ratio_range")
  })

  it("marks missing as 데이터 없음", () => {
    assert.equal(resolveHomePutCallDisplay(null).display, "데이터 없음")
    assert.equal(resolveHomePutCallDisplay("").display, "데이터 없음")
  })
})

describe("buildHomeFearSummary", () => {
  it("does not treat highYield 0 as a real HY print", () => {
    const fear = buildHomeFearSummary({
      date: "2026-03-20",
      vix: 18.4,
      fearGreed: 42,
      putCall: 0.95,
      bofa: null,
      highYield: 0,
    })
    assert.equal(fear.highYieldHidden, true)
    assert.equal(fear.bofa.display, "데이터 없음")
    assert.equal(fear.putCall.ok, true)
    assert.equal(fear.asOf, "2026-03-20")
  })

  it("gates putCall 11", () => {
    const fear = buildHomeFearSummary({ putCall: 11, vix: 20 })
    assert.equal(fear.putCall.display, "확인 필요")
  })
})

describe("isLicenseRestrictedYieldLike", () => {
  it("treats null and 0 as restricted", () => {
    assert.equal(isLicenseRestrictedYieldLike(null), true)
    assert.equal(isLicenseRestrictedYieldLike(0), true)
  })
})

describe("buildHomeCreditSummary", () => {
  it("maps license-safe CCI without HY/BBB fields", () => {
    const credit = buildHomeCreditSummary({
      cci: 61.2,
      coveragePct: 78,
      regime: "Expansion",
      pitLabel: "NON_PIT",
      statusLabel: "License-safe 로컬 · NON_PIT",
      asOf: "2026-03-18",
      hold: false,
      indicators: [
        { id: "hy", exposed: false, licenseRestricted: true, quality: "VALID", label: "HY" },
        { id: "fdic", exposed: true, licenseRestricted: false, quality: "STALE", label: "FDIC" },
      ],
    })
    assert.equal(credit.cciDisplay, "61")
    assert.equal(credit.coverageDisplay, "78%")
    assert.equal(credit.pitLabel, "NON_PIT")
    assert.ok(credit.staleNames.includes("FDIC"))
    assert.equal(/HY\s*\d|BBB\s*\d/.test(JSON.stringify(credit)), false)
  })

  it("holds test seed", () => {
    const credit = buildHomeCreditSummary({ testSeedOnly: true, cci: 50 })
    assert.equal(credit.cci, null)
    assert.equal(credit.hold, true)
  })

  it("flattens regime object to a string label (React child safe)", () => {
    const credit = buildHomeCreditSummary({
      cci: 40,
      asOf: "2026-03-18",
      regime: {
        id: "Expansion",
        label: "Expansion",
        status: "OK",
        reasons: [],
        knownIds: ["Expansion"],
      },
    })
    assert.equal(credit.regime, "Expansion")
    assert.equal(typeof credit.regime, "string")
  })
})

describe("buildHomeEtfDbbSummary / equity", () => {
  it("counts ETF candidates independently of CCI", () => {
    const etf = buildHomeEtfDbbSummary({
      updatedAt: "2026-03-19T10:00:00Z",
      all: [
        { symbol: "QQQ", ok: true, count: 3 },
        { symbol: "SPY", ok: true, count: 2 },
        { symbol: "IWM", ok: false, count: 1 },
      ],
    })
    assert.equal(etf.candidateCount, 1)
    assert.equal(etf.watchCount, 1)
    assert.equal(etf.topLines[0], "QQQ 3/4")
  })

  it("handles equity empty payload", () => {
    const eq = buildHomeEquityDbbSummary(null)
    assert.equal(eq.ready, false)
    assert.equal(eq.message, "데이터 없음")
  })
})

describe("buildHomeJudgmentNarrative", () => {
  it("uses status sentences without Panic/CCI/DBB score merge or metric dumps", () => {
    const judgment = buildHomeJudgmentNarrative({
      fear: buildHomeFearSummary({
        date: "2026-03-20",
        vix: 22,
        fearGreed: 30,
        putCall: 1.1,
      }),
      credit: buildHomeCreditSummary({ cci: 55, asOf: "2026-03-18", coveragePct: 70 }),
      fearAsOf: "2026-03-20",
      creditAsOf: "2026-03-18",
      today: "2026-03-24",
    })
    const blob = `${judgment.headline} ${judgment.lines.join(" ")}`
    assert.equal(judgment.deferred, false)
    assert.match(judgment.headline, /기준일이 다르/)
    assert.match(blob, /합산하지/)
    assert.equal(/종합 점수|합산 점수|totalScore|VIX 22|CCI 55|N\/4/i.test(blob), false)
  })

  it("defers when fear and credit are both thin", () => {
    const judgment = buildHomeJudgmentNarrative({
      fear: buildHomeFearSummary({}),
      credit: buildHomeCreditSummary(null),
      today: "2026-03-24",
    })
    assert.equal(judgment.deferred, true)
    assert.match(judgment.headline, /종합 판단하기 어렵/)
  })

  it("ready same-day axes get independent check headline", () => {
    const judgment = buildHomeJudgmentNarrative({
      fear: buildHomeFearSummary({ date: "2026-03-18", vix: 18, fearGreed: 40, putCall: 1.0 }),
      credit: buildHomeCreditSummary({ cci: 40, asOf: "2026-03-18", coveragePct: 80 }),
      fearAsOf: "2026-03-18",
      creditAsOf: "2026-03-18",
      today: "2026-03-18",
    })
    assert.equal(judgment.deferred, false)
    assert.match(judgment.headline, /각각 확인/)
  })
})

describe("buildHomeHeaderAsOfLabel", () => {
  it("shows mixed axis dates without inventing a merged score", () => {
    const label = buildHomeHeaderAsOfLabel({
      fearAsOf: "2026-03-20",
      creditAsOf: "2026-03-18",
      today: "2026-03-24",
    })
    assert.equal(label.mixed, true)
    assert.match(label.text, /공포 2026-03-20/)
    assert.match(label.text, /신용 2026-03-18/)
  })
})

describe("buildHomePortfolioSummary", () => {
  it("guest shows login guidance without sample returns", () => {
    const g = buildHomePortfolioSummary({ isLoggedIn: false, holdingCount: 0, cashBalance: null })
    assert.equal(g.mode, "guest")
    assert.equal(g.showNumbers, false)
    assert.match(g.body, /로그인/)
    assert.equal(/%|수익/.test(g.body), false)
  })

  it("logged-in empty portfolio", () => {
    const e = buildHomePortfolioSummary({ isLoggedIn: true, holdingCount: 0, cashBalance: null })
    assert.equal(e.mode, "empty")
    assert.equal(e.showNumbers, false)
  })

  it("logged-in with holdings", () => {
    const r = buildHomePortfolioSummary({ isLoggedIn: true, holdingCount: 3, cashBalance: 1000 })
    assert.equal(r.mode, "ready")
    assert.equal(r.holdingCount, 3)
    assert.equal(/샘플|가상/.test(r.body), false)
  })
})

describe("pickHomeHeaderAsOf", () => {
  it("picks latest day key", () => {
    assert.equal(pickHomeHeaderAsOf(["2026-03-10", null, "2026-03-18", "2026-03-12"]), "2026-03-18")
  })
})
