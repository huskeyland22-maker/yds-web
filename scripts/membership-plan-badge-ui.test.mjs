/**
 * Header membership badge wiring (no PROD / Premium access in top chrome).
 * node --test scripts/membership-plan-badge-ui.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

describe("membership plan badge UI", () => {
  it("desktop topbar uses MembershipPlanBadge and drops PROD/Premium access", () => {
    const app = readFileSync(join(root, "vite-project/src/App.jsx"), "utf8")
    assert.match(app, /MembershipPlanBadge/)
    assert.doesNotMatch(app, /Premium access/)
    assert.doesNotMatch(app, /AppReleaseEnvBadge/)
  })

  it("mobile header uses MembershipPlanBadge beside name and drops release-env badge", () => {
    const mobile = readFileSync(join(root, "vite-project/src/components/layout/MobileAppHeader.jsx"), "utf8")
    assert.match(mobile, /MembershipPlanBadge/)
    assert.match(mobile, /displayName|\.email/)
    assert.match(mobile, /data-yds-mobile-header="sharp-20261105"/)
    assert.match(mobile, /bg-white/)
    assert.doesNotMatch(mobile, /AppReleaseEnvBadge/)
    assert.doesNotMatch(mobile, /backdrop-blur/)
    assert.doesNotMatch(mobile, /bg-white\/\[/)
    assert.doesNotMatch(mobile, /text-slate-300\/65/)
  })

  it("MembershipPlanBadge uses header state including pending/error paths", () => {
    const badge = readFileSync(join(root, "vite-project/src/components/MembershipPlanBadge.jsx"), "utf8")
    assert.match(badge, /membershipHeaderBadgeState/)
    assert.match(badge, /pending/)
  })

  it("premium shell keeps mobile header opaque without backdrop blur", () => {
    const shell = readFileSync(join(root, "vite-project/src/styles/yds-shell-premium.css"), "utf8")
    assert.match(shell, /\.app-shell-host \.yds-mobile-app-header \{[\s\S]*?backdrop-filter:\s*none/)
    assert.match(shell, /\.yds-theme-premium \.yds-mobile-app-header \{[\s\S]*?backdrop-filter:\s*none/)
    assert.match(shell, /background-color:\s*#ffffff\s*!important/)
    assert.equal(shell.includes("backdrop-filter: blur(8px)"), false)
  })

  it("admin dashboard still keeps AppReleaseEnvBadge for ops", () => {
    const admin = readFileSync(join(root, "vite-project/src/pages/AdminDashboardPage.jsx"), "utf8")
    assert.match(admin, /AppReleaseEnvBadge/)
  })
})
