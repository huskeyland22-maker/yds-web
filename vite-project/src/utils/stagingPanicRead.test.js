import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  BLOCKED_PANIC_PROXY_HOSTS,
  PRODUCTION_SUPABASE_REF,
  STAGING_SUPABASE_REF,
  classifyPanicReadRequest,
  inspectStagingPanicEnv,
  isBlockedPanicProxyTarget,
  parseStagingEnvText,
  stagingClientPublicEnv,
  stagingServerEnvAssignments,
} from "../../../api/_lib/stagingPanicRead.js"

const stagingUrl = `https://${STAGING_SUPABASE_REF}.supabase.co`
const productionUrl = `https://${PRODUCTION_SUPABASE_REF}.supabase.co`

function stagingEnv(overrides = {}) {
  return {
    SUPABASE_URL: stagingUrl,
    VITE_SUPABASE_URL: stagingUrl,
    VITE_SUPABASE_ANON_KEY: "anon-test",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
    ...overrides,
  }
}

describe("staging panic read route", () => {
  it("keeps hub-off selection on the static path by leaving the hub flag unset", () => {
    const info = inspectStagingPanicEnv(stagingEnv())
    expect(info.hubOn).toBe(false)
    expect(info.clientHubReady).toBe(false)
    expect(info.serverReadReady).toBe(true)
    expect(stagingClientPublicEnv(stagingEnv()).hub).toBeNull()
  })

  it("selects the staging ref when the hub flag is on", () => {
    const env = stagingEnv({ VITE_PANIC_HUB: "1" })
    const info = inspectStagingPanicEnv(env)
    const client = stagingClientPublicEnv(env)
    const server = stagingServerEnvAssignments(env)
    expect(info.ref).toBe("staging")
    expect(info.clientHubReady).toBe(true)
    expect(client.ok).toBe(true)
    expect(client.hub).toBe("1")
    expect(client.url).toContain(STAGING_SUPABASE_REF)
    expect(client.url).not.toContain(PRODUCTION_SUPABASE_REF)
    expect(server.assignments.SUPABASE_URL).toContain(STAGING_SUPABASE_REF)
    expect(JSON.stringify(client)).not.toContain("service-role-test")
  })

  it("fail-closes when the production ref is selected", () => {
    const env = stagingEnv({
      SUPABASE_URL: productionUrl,
      VITE_SUPABASE_URL: productionUrl,
      VITE_PANIC_HUB: "1",
    })
    const info = inspectStagingPanicEnv(env)
    expect(info.ok).toBe(false)
    expect(info.reason).toBe("production_url_refused")
    expect(info.ref).toBe("production")
    expect(info.serverReadReady).toBe(false)
    expect(info.clientHubReady).toBe(false)
    expect(stagingServerEnvAssignments(env).assignments).toBeNull()
    expect(stagingClientPublicEnv(env).ok).toBe(false)
  })

  it("does not route panic reads through the production API host", () => {
    expect(isBlockedPanicProxyTarget(`https://${BLOCKED_PANIC_PROXY_HOSTS[0]}/api/panic?mode=latest`)).toBe(true)
    expect(isBlockedPanicProxyTarget(productionUrl)).toBe(true)
    expect(isBlockedPanicProxyTarget(stagingUrl)).toBe(false)
    const viteConfig = fs.readFileSync(path.resolve(process.cwd(), "vite.config.js"), "utf8")
    expect(viteConfig).not.toMatch(/["']\/api\/panic["']\s*:/)
  })

  it("allows GET reads and blocks writes", () => {
    expect(classifyPanicReadRequest({ method: "GET", mode: "latest" }).allow).toBe(true)
    expect(classifyPanicReadRequest({ method: "GET", mode: "history" }).allow).toBe(true)
    expect(classifyPanicReadRequest({ method: "GET" }).mode).toBe("latest")
    expect(classifyPanicReadRequest({ method: "POST", mode: "update" })).toMatchObject({
      allow: false,
      reason: "read_only",
    })
    expect(classifyPanicReadRequest({ method: "GET", mode: "backfill" }).allow).toBe(false)
    expect(classifyPanicReadRequest({ method: "GET", mode: "latest", probe: "1" })).toMatchObject({
      allow: false,
      reason: "write_probe_blocked",
    })
  })

  it("classifies the local staging file without returning secrets", () => {
    const candidates = [
      path.resolve(process.cwd(), "../.env.staging.local"),
      path.resolve(process.cwd(), ".env.staging.local"),
    ]
    const file = candidates.find((item) => fs.existsSync(item))
    expect(file).toBeTruthy()
    const info = inspectStagingPanicEnv(parseStagingEnvText(fs.readFileSync(file, "utf8")))
    expect(info.ref).toBe("staging")
    expect(info.serverReadReady).toBe(true)
    expect(info.hasAnon).toBe(true)
    expect(info.hasServiceRole).toBe(true)
    expect(info.clientHubReady).toBe(info.hubOn)
    expect(JSON.stringify(info)).not.toMatch(/sb_secret_|sb_publishable_|eyJ/)
  })
})
