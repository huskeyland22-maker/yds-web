/**
 * iOS home-screen PWA header chrome — status bar must not overlay content.
 * node --test scripts/ios-pwa-header-meta.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

describe("iOS PWA header meta + safe area", () => {
  it("uses opaque default status bar and light theme-color", () => {
    const html = readFileSync(join(root, "vite-project/index.html"), "utf8")
    assert.match(html, /viewport-fit=cover/)
    assert.match(html, /apple-mobile-web-app-status-bar-style"\s+content="default"/)
    assert.doesNotMatch(html, /status-bar-style"\s+content="black-translucent"/)
    assert.match(html, /name="theme-color"\s+content="#ffffff"/)
    assert.match(html, /yds-ios-standalone/)
  })

  it("standalone CSS uses light body and header safe band", () => {
    const css = readFileSync(join(root, "vite-project/src/index.css"), "utf8")
    assert.match(css, /\.yds-mobile-app-header__safe\s*\{[\s\S]*?env\(safe-area-inset-top/)
    assert.match(css, /@media all and \(display-mode: standalone\)\s*\{[\s\S]*?background-color:\s*#ffffff/)
    assert.doesNotMatch(
      css,
      /@media all and \(display-mode: standalone\)\s*\{[\s\S]*?background-color:\s*#0b0e14/,
    )
    assert.match(css, /html\.yds-ios-standalone/)
    /* Do not force filter on every header descendant (iOS soft-raster bug) */
    assert.doesNotMatch(
      css,
      /\.yds-mobile-app-header \*,\s*\n\s*\.yds-mobile-app-header \*::before/,
    )
  })

  it("build-meta forces light PWA manifest chrome colors", () => {
    const meta = readFileSync(join(root, "vite-project/scripts/generate-build-meta.mjs"), "utf8")
    assert.match(meta, /background_color:\s*"#ffffff"/)
    assert.match(meta, /theme_color:\s*"#ffffff"/)
    assert.doesNotMatch(meta, /theme_color:\s*"#0b0f1a"/)
  })
})
