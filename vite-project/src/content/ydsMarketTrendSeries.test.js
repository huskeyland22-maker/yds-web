import { describe, expect, it } from "vitest"
import {
  buildMarketStateTrendChartData,
  buildPanicIntensityTrendChartData,
  marketStateScoreForRow,
  panicIntensityScoreForRow,
  resolveScoreZoneMeta,
} from "./ydsMarketTrendSeries.js"

describe("ydsMarketTrendSeries", () => {
  const rows = [
    { date: "2026-05-01", fearGreed: 75, vix: 14, bofa: 7, putCall: 0.7 },
    { date: "2026-05-15", fearGreed: 55, vix: 18, bofa: 6, putCall: 0.75 },
    { date: "2026-06-01", fearGreed: 40, vix: 22, bofa: 5.5, putCall: 0.82 },
  ]

  it("computes market state score from CNN/VIX/BofA", () => {
    const score = marketStateScoreForRow(rows[2])
    expect(score).toBeTypeOf("number")
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it("computes panic intensity from history row", () => {
    const score = panicIntensityScoreForRow(rows[2])
    expect(score).toBeTypeOf("number")
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it("builds ascending chart series within window", () => {
    const market = buildMarketStateTrendChartData(rows, 60)
    const panic = buildPanicIntensityTrendChartData(rows, 60)
    expect(market).toHaveLength(3)
    expect(panic).toHaveLength(3)
    expect(market[0].date).toBe("2026-05-01")
    expect(market[2].marketStateScore).toBe(marketStateScoreForRow(rows[2]))
  })

  it("maps score zones for market and panic labels", () => {
    expect(resolveScoreZoneMeta(85, "market").label).toBe("과열")
    expect(resolveScoreZoneMeta(33, "panic").label).toBe("공포 부족")
    expect(resolveScoreZoneMeta(49, "panic").label).toBe("중립")
    expect(resolveScoreZoneMeta(15, "panic").label).toBe("극단적 탐욕")
    expect(resolveScoreZoneMeta(70, "panic").label).toBe("공포")
    expect(resolveScoreZoneMeta(88, "panic").label).toBe("극단적 공포")
    expect(resolveScoreZoneMeta(70, "panic").actionLine).toBe(
      "투자심리가 위축된 구간으로 분할매수를 고려할 수 있습니다.",
    )
  })
})
