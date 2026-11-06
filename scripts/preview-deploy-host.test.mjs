/**
 * Preview host helpers — Production kappa must never be treated as Preview.
 * node --test scripts/preview-deploy-host.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  PRODUCTION_APP_HOST,
  STABLE_PREVIEW_BOOKMARK_URL,
  STABLE_PREVIEW_HOST,
  isPreviewOpsToolsEnabled,
  isProductionAppHost,
  isStablePreviewBookmarkHost,
  isVercelPreviewHost,
  shortCommitFromBuildId,
} from "../vite-project/src/utils/previewDeployHost.js"

describe("previewDeployHost", () => {
  it("distinguishes Production kappa from Preview alias", () => {
    assert.equal(isProductionAppHost(PRODUCTION_APP_HOST), true)
    assert.equal(isVercelPreviewHost(PRODUCTION_APP_HOST), false)
    assert.equal(isVercelPreviewHost(STABLE_PREVIEW_HOST), true)
    assert.equal(isStablePreviewBookmarkHost(STABLE_PREVIEW_HOST), true)
    assert.equal(isStablePreviewBookmarkHost(PRODUCTION_APP_HOST), false)
    assert.match(STABLE_PREVIEW_BOOKMARK_URL, /^https:\/\/yds-web-git-integration-yds-windows-mac/)
  })

  it("treats ephemeral yds-web vercel hosts as Preview (not kappa)", () => {
    assert.equal(
      isVercelPreviewHost("yds-web-abc123-so-sung-yangs-projects.vercel.app"),
      true,
    )
    assert.equal(isVercelPreviewHost("localhost"), false)
  })

  it("enables preview ops via host or query", () => {
    assert.equal(isPreviewOpsToolsEnabled({ hostname: STABLE_PREVIEW_HOST }), true)
    assert.equal(isPreviewOpsToolsEnabled({ hostname: PRODUCTION_APP_HOST }), false)
    assert.equal(
      isPreviewOpsToolsEnabled({ hostname: PRODUCTION_APP_HOST, search: "?preview-ops=1" }),
      true,
    )
  })

  it("shortens build ids to commit prefix", () => {
    assert.equal(shortCommitFromBuildId("8d86b06a-1793891967686"), "8d86b06a")
    assert.equal(shortCommitFromBuildId("dev"), "dev")
  })
})
