import fs from "node:fs"
import path from "node:path"

const now = new Date()
const buildId = String(Date.now())
const day = String(now.getDate()).padStart(2, "0")
const hh = String(now.getHours()).padStart(2, "0")
const mm = String(now.getMinutes()).padStart(2, "0")
const version = `v1.0.${day}${hh}${mm}`

const meta = {
  buildId,
  version,
  timestamp: Number(buildId),
  builtAt: now.toISOString(),
}

const publicDir = path.resolve(process.cwd(), "public")
fs.mkdirSync(publicDir, { recursive: true })

// 1) /build-version.json — fetched by the runtime version checker (must be no-store on Vercel)
fs.writeFileSync(
  path.join(publicDir, "build-version.json"),
  `${JSON.stringify(meta, null, 2)}\n`,
  "utf8",
)

// 2) /manifest.webmanifest — versioned PWA manifest so iOS detects identity changes
// We keep the legacy /manifest.json untouched for back-compat and emit a versioned
// .webmanifest that is referenced from index.html with a cache-busting query string.
const manifestSourcePath = path.join(publicDir, "manifest.json")
let baseManifest = {
  name: "Market Pulse AI",
  short_name: "Market Pulse",
  description: "AI 기반 시장 해석 및 실전 매매 레이더 플랫폼",
  start_url: "/",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: "#0b0f1a",
  theme_color: "#0b0f1a",
  icons: [
    { src: "/icon.svg", sizes: "192x192", type: "image/svg+xml" },
    { src: "/icon-maskable.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
  ],
}
try {
  if (fs.existsSync(manifestSourcePath)) {
    const raw = fs.readFileSync(manifestSourcePath, "utf8")
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object") baseManifest = { ...baseManifest, ...parsed }
  }
} catch {
  // fall back to defaults
}

// Inject identity/version into manifest so PWA hosts can detect changes
const versionedManifest = {
  id: "/?source=pwa",
  ...baseManifest,
  start_url: `/?source=pwa&v=${buildId}`,
  version,
  build_id: buildId,
  built_at: meta.builtAt,
}

fs.writeFileSync(
  path.join(publicDir, "manifest.webmanifest"),
  `${JSON.stringify(versionedManifest, null, 2)}\n`,
  "utf8",
)

// Also keep manifest.json (legacy) in sync with version metadata to avoid stale PWA installs
fs.writeFileSync(
  path.join(publicDir, "manifest.json"),
  `${JSON.stringify(versionedManifest, null, 2)}\n`,
  "utf8",
)

console.log("[build-meta] generated", { ...meta, manifest: "manifest.webmanifest" })
