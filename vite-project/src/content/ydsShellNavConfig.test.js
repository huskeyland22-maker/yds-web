import { describe, expect, it } from "vitest"
import {
  SHELL_NAV_MAIN,
  getShellNavHub,
  shellNavItemIsActive,
  shellNavMainContainsPath,
} from "./ydsShellNavConfig.js"

function findItem(id) {
  for (const main of SHELL_NAV_MAIN) {
    if (main.id === id && main.kind === "link") {
      return {
        id: main.id,
        label: main.label,
        path: main.path,
        matchPaths: main.matchPaths,
        emphasis: main.emphasis,
      }
    }
    for (const item of main.items ?? []) {
      if (item.id === id) return item
    }
    for (const section of main.sections ?? []) {
      for (const item of section.items ?? []) {
        if (item.id === id) return item
      }
    }
  }
  return null
}

describe("ydsShellNavConfig — 5대메뉴 IA", () => {
  it("exposes five Korean top-level menus", () => {
    expect(SHELL_NAV_MAIN.map((entry) => entry.label)).toEqual([
      "시장 브리핑",
      "신용 사이클",
      "조정 매수 전략",
      "리서치",
      "기타 기능",
    ])
    expect(SHELL_NAV_MAIN.every((entry) => !/[A-Z]{3,}/.test(entry.label) || entry.label === "About")).toBe(true)
  })

  it("wires 시장 브리핑 and strategy leaves to live pages, not hubs", () => {
    expect(findItem("market-briefing")?.path).toBe("/market-analysis")
    expect(findItem("credit-cycle")?.path).toBe("/credit-cycle")

    const strategy = SHELL_NAV_MAIN.find((entry) => entry.id === "adjustment-strategy")
    expect(strategy?.kind).toBe("accordion")
    expect(strategy?.sections?.map((section) => section.label)).toEqual(["장기 조정 매수", "패닉·공포 매수"])
    expect(strategy?.sections?.[0].items.map((entry) => [entry.label, entry.path])).toEqual([
      ["ETF 조정 매수", "/daily-bottom-buy"],
      ["개별 종목 조정 매수", "/equity-daily-bottom-buy"],
      ["레버리지 조정 매수", "/leverage-adjustment"],
    ])
    expect(strategy?.sections?.[1].items.map((entry) => [entry.label, entry.path, Boolean(entry.alias)])).toEqual([
      ["패닉지수 분석", "/market-analysis", false],
      ["공포 구간 매수 전략", "/market-analysis", true],
      ["패닉 연구실", "/panic-lab", false],
    ])

    const research = SHELL_NAV_MAIN.find((entry) => entry.id === "research")
    expect(research?.items?.map((entry) => [entry.label, entry.path])).toEqual([
      ["전략 검증", "/strategy-validation"],
      ["연구실", "/lab"],
    ])

    const more = SHELL_NAV_MAIN.find((entry) => entry.id === "more")
    expect(more?.items?.some((entry) => entry.path === "/portfolio")).toBe(true)
    expect(more?.items?.some((entry) => entry.path === "/stock-picks")).toBe(true)
    expect(more?.items?.some((entry) => entry.id === "panic-lab")).toBe(false)
    expect(getShellNavHub("market-briefing")?.links.map((link) => link.path)).toContain("/market-analysis")
  })

  it("activates direct routes and expands strategy when nested path is open", () => {
    expect(shellNavItemIsActive(findItem("market-briefing"), { pathname: "/market-analysis" })).toBe(true)
    expect(shellNavItemIsActive(findItem("panic-index"), { pathname: "/market-analysis" })).toBe(true)
    expect(shellNavItemIsActive(findItem("fear-buy-strategy"), { pathname: "/market-analysis" })).toBe(false)
    expect(shellNavItemIsActive(findItem("etf-buy"), { pathname: "/daily-bottom-buy" })).toBe(true)
    expect(shellNavItemIsActive(findItem("equity-buy"), { pathname: "/equity-daily-bottom-buy" })).toBe(true)
    expect(shellNavItemIsActive(findItem("leverage"), { pathname: "/leverage-adjustment" })).toBe(true)
    expect(shellNavItemIsActive(findItem("panic-lab"), { pathname: "/panic-lab" })).toBe(true)
    expect(shellNavItemIsActive(findItem("strategy-validation"), { pathname: "/performance-validation/backtest" })).toBe(
      true,
    )
    expect(shellNavItemIsActive(findItem("lab"), { pathname: "/lab" })).toBe(true)
    expect(shellNavItemIsActive(findItem("credit-cycle"), { pathname: "/credit-cycle" })).toBe(true)

    const strategy = SHELL_NAV_MAIN.find((entry) => entry.id === "adjustment-strategy")
    expect(shellNavMainContainsPath(strategy, { pathname: "/daily-bottom-buy" })).toBe(true)
    expect(shellNavMainContainsPath(strategy, { pathname: "/panic-lab" })).toBe(true)
    expect(shellNavMainContainsPath(strategy, { pathname: "/lab" })).toBe(false)
  })
})
