/**
 * Shell chrome must not show DEV/RC/PROD release-env badge.
 * Admin dashboard may still use AppReleaseEnvBadge.
 * node --test scripts/shell-release-env-badge.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

describe("shell release-env badge", () => {
  it("App desktop topbar does not mount AppReleaseEnvBadge", () => {
    const src = readFileSync(join(root, "vite-project/src/App.jsx"), "utf8")
    assert.doesNotMatch(src, /import AppReleaseEnvBadge/)
    assert.doesNotMatch(src, /<AppReleaseEnvBadge/)
  })

  it("MobileAppHeader does not mount AppReleaseEnvBadge", () => {
    const src = readFileSync(
      join(root, "vite-project/src/components/layout/MobileAppHeader.jsx"),
      "utf8",
    )
    assert.doesNotMatch(src, /AppReleaseEnvBadge/)
  })
})
