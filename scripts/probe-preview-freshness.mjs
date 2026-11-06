/**
 * Live probe: Preview branch alias vs Production — cache headers + build ids.
 * node scripts/probe-preview-freshness.mjs
 */
const PREVIEW =
  process.env.PREVIEW_URL ||
  "https://yds-web-git-integration-yds-windows-mac-so-sung-yangs-projects.vercel.app"
const PROD = process.env.PROD_URL || "https://yds-web-kappa.vercel.app"

async function probeHost(label, base) {
  const out = { label, base, routes: {} }
  for (const p of ["/", "/market", "/market-analysis", "/panic", "/build-version.json", "/sw.js", "/manifest.webmanifest"]) {
    const r = await fetch(`${base}${p}`, { cache: "no-store", redirect: "follow" })
    const row = {
      status: r.status,
      cacheControl: r.headers.get("cache-control"),
      cdnCacheControl: r.headers.get("cdn-cache-control"),
      xVercelCache: r.headers.get("x-vercel-cache"),
      age: r.headers.get("age"),
    }
    if (p === "/build-version.json") {
      row.body = await r.json()
    } else if (p === "/manifest.webmanifest") {
      const j = await r.json()
      row.start_url = j.start_url
      row.build_id = j.build_id
      row.id = j.id
    } else if (p === "/sw.js") {
      const t = await r.text()
      row.len = t.length
      row.cacheId = (t.match(/yds-pwa-[a-z0-9.-]+/i) || [])[0] || null
      row.precacheAndRoute = t.includes("precacheAndRoute")
      row.mentionsIndexHtml = /index\.html/.test(t)
    } else {
      const t = await r.text()
      row.assetJs = (t.match(/assets\/index-[^"']+\.js/) || [])[0] || null
      row.appBuildId = (t.match(/name="app-build-id"\s+content="([^"]+)"/) || [])[1] ||
        (t.match(/content="([^"]+)"\s+name="app-build-id"/) || [])[1] ||
        null
      row.hasNoStoreMeta = /Cache-Control"\s+content="no-store/.test(t)
    }
    out.routes[p] = row
  }
  return out
}

const results = [await probeHost("PREVIEW", PREVIEW), await probeHost("PROD", PROD)]
console.log(JSON.stringify(results, null, 2))

const preview = results[0]
const spa = preview.routes["/market-analysis"] || preview.routes["/market"]
const root = preview.routes["/"]
const spaWeak =
  spa &&
  typeof spa.cacheControl === "string" &&
  /public/i.test(spa.cacheControl) &&
  !/no-store/i.test(spa.cacheControl)
const rootStrong = root && /no-store/i.test(String(root.cacheControl || ""))

if (spaWeak && rootStrong) {
  console.error(
    "\n[FINDING] SPA routes lack no-store Cache-Control while / has no-store — bookmarked deep links can get stale HTML shells.",
  )
  process.exitCode = 0
}
