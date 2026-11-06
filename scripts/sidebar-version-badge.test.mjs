/**
 * General-user sidebar must not show YDS V1.8 release badge.
 * node --test scripts/sidebar-version-badge.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

describe("sidebar version badge", () => {
  it("AppSidebar keeps brand + slogan and drops YdsV1ReleaseBadge", () => {
    const src = readFileSync(join(root, "vite-project/src/components/layout/AppSidebar.jsx"), "utf8")
    assert.match(src, /Y&apos;ds|Y'ds/)
    assert.match(src, /함께하는 인생 투자/)
    assert.doesNotMatch(src, /YdsV1ReleaseBadge/)
    assert.doesNotMatch(src, /YDS_V1_VERSION/)
  })

  it("MobileDrawer brand header has no V1.8 badge", () => {
    const src = readFileSync(join(root, "vite-project/src/components/layout/MobileDrawer.jsx"), "utf8")
    assert.match(src, /함께하는 인생 투자/)
    assert.doesNotMatch(src, /YdsV1ReleaseBadge/)
  })
})
