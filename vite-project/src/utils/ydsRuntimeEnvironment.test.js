import { describe, expect, it } from "vitest"
import {
  PRODUCTION_APP_HOST,
  PRODUCTION_SUPABASE_REF,
  STAGING_SUPABASE_REF,
  buildMarketEnvStripModel,
  formatCoreAsOfSummary,
  resolveCoreMetricAsOfDates,
  resolveDeployRuntime,
  resolveEnvironmentBanner,
  resolveSupabaseProjectKind,
} from "./ydsRuntimeEnvironment.js"

const stagingUrl = `https://${STAGING_SUPABASE_REF}.supabase.co`
const productionUrl = `https://${PRODUCTION_SUPABASE_REF}.supabase.co`

describe("ydsRuntimeEnvironment", () => {
  it("classifies supabase project by ref only", () => {
    expect(resolveSupabaseProjectKind(stagingUrl)).toBe("staging")
    expect(resolveSupabaseProjectKind(productionUrl)).toBe("production")
    expect(resolveSupabaseProjectKind("")).toBe("missing")
    expect(resolveSupabaseProjectKind("https://other.supabase.co")).toBe("other")
  })

  it("uses Vercel env and known host facts without inventing production", () => {
    expect(resolveDeployRuntime({ isDev: true, hostname: PRODUCTION_APP_HOST })).toBe("local")
    expect(resolveDeployRuntime({ isDev: false, vercelEnv: "production" })).toBe("production")
    expect(resolveDeployRuntime({ isDev: false, vercelEnv: "preview" })).toBe("preview")
    expect(
      resolveDeployRuntime({ isDev: false, vercelEnv: "", hostname: PRODUCTION_APP_HOST }),
    ).toBe("production")
    expect(
      resolveDeployRuntime({
        isDev: false,
        vercelEnv: "",
        hostname: "yds-web-git-rc-user.vercel.app",
      }),
    ).toBe("preview")
    expect(resolveDeployRuntime({ isDev: false, vercelEnv: "", hostname: "" })).toBe("unknown")
  })

  it("requires matching deploy + project pairs", () => {
    expect(
      resolveEnvironmentBanner({ deploy: "local", project: "staging" }).label,
    ).toBe("LOCAL · STAGING CONNECTED")
    expect(
      resolveEnvironmentBanner({ deploy: "production", project: "production" }).label,
    ).toBe("PRODUCTION · LIVE DATA")
    expect(
      resolveEnvironmentBanner({ deploy: "preview", project: "staging" }).label,
    ).toBe("PREVIEW · TEST DATA")
    expect(
      resolveEnvironmentBanner({ deploy: "preview", project: "production" }).label,
    ).toBe("PREVIEW · TEST DATA")
    expect(
      resolveEnvironmentBanner({ deploy: "local", project: "production" }).label,
    ).toBe("ENVIRONMENT UNKNOWN")
    expect(
      resolveEnvironmentBanner({ deploy: "production", project: "staging" }).label,
    ).toBe("ENVIRONMENT UNKNOWN")
    expect(
      resolveEnvironmentBanner({ deploy: "unknown", project: "staging" }).label,
    ).toBe("ENVIRONMENT UNKNOWN")
  })

  it("shows one as-of when the three cores share a date, and splits when they differ", () => {
    const shared = resolveCoreMetricAsOfDates({
      date: "2026-11-05",
      vix: 28.18,
      fearGreed: 20,
      putCall: 0.8,
      updatedAt: "2026-11-05T12:00:00.000Z",
      __fetchSource: "HUB",
    })
    expect(formatCoreAsOfSummary(shared)).toBe("VIX · CNN · Put/Call 기준일 2026-11-05")

    const split = resolveCoreMetricAsOfDates({
      date: "2026-11-05",
      vix: 28.18,
      fearGreed: 20,
      putCall: 0.8,
      fearGreedDate: "2026-11-04",
      updatedAt: "2026-11-05T12:00:00.000Z",
      __fetchSource: "HUB",
    })
    expect(formatCoreAsOfSummary(split)).toContain("CNN 2026-11-04")
    expect(formatCoreAsOfSummary(split)).toContain("VIX 2026-11-05")
  })

  it("builds the local staging strip model from real pairing rules", () => {
    const model = buildMarketEnvStripModel(
      {
        date: "2026-11-05",
        vix: 28.18,
        fearGreed: 20,
        putCall: 0.8,
        updatedAt: "2026-11-05T12:00:00.000Z",
        __fetchSource: "HUB",
      },
      {
        isDev: true,
        hostname: "localhost",
        supabaseUrl: stagingUrl,
        now: new Date("2026-11-17T00:00:00.000Z"),
      },
    )
    expect(model.label).toBe("LOCAL · STAGING CONNECTED")
    expect(model.dataSource).toBe("STAGING")
    expect(model.scoreState).toBe("DELAYED")
    expect(model.sharedAsOf).toBe("2026-11-05")
    expect(model.asOfSummary).toBe("VIX · CNN · Put/Call 기준일 2026-11-05")
    expect(model.updatedLabel).toMatch(/2026-11-05/)
  })
})
