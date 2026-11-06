/**
 * SPA shells (/market-analysis etc.) must get the same no-store headers as /.
 * node --test scripts/vercel-spa-html-cache-headers.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

describe("vercel SPA HTML cache headers", () => {
  it("root vercel.json applies no-store to extensionless SPA routes", () => {
    const raw = readFileSync(join(root, "vercel.json"), "utf8")
    const json = JSON.parse(raw)
    const spa = (json.headers || []).find((h) => h.source === "/((?!api/|.*\\..*).*)")
    assert.ok(spa, "missing SPA catch-all header rule")
    const cc = spa.headers.find((x) => x.key === "Cache-Control")?.value || ""
    assert.match(cc, /no-store/i)
    const cdn = spa.headers.find((x) => x.key === "CDN-Cache-Control")?.value || ""
    assert.match(cdn, /no-store/i)
  })

  it("vite-project vercel.json mirrors SPA no-store rule", () => {
    const raw = readFileSync(join(root, "vite-project/vercel.json"), "utf8")
    const json = JSON.parse(raw)
    const spa = (json.headers || []).find((h) => h.source === "/((?!api/|.*\\..*).*)")
    assert.ok(spa, "missing SPA catch-all header rule")
    const cc = spa.headers.find((x) => x.key === "Cache-Control")?.value || ""
    assert.match(cc, /no-store/i)
  })

  it("assets stay immutable long-cache", () => {
    const json = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"))
    const assets = (json.headers || []).find((h) => h.source === "/assets/(.*)")
    assert.ok(assets)
    const cc = assets.headers.find((x) => x.key === "Cache-Control")?.value || ""
    assert.match(cc, /immutable/i)
  })
})
