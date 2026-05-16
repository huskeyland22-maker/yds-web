import fs from "node:fs"
import path from "node:path"

const now = new Date()
const buildId = String(Date.now())

const TZ = "Asia/Seoul"
const y = new Intl.DateTimeFormat("en", { timeZone: TZ, year: "numeric" }).format(now)
const mo = new Intl.DateTimeFormat("en", { timeZone: TZ, month: "2-digit" }).format(now)
const da = new Intl.DateTimeFormat("en", { timeZone: TZ, day: "2-digit" }).format(now)
const dayLabel = `${y}.${mo}.${da}`

const publicDir = path.resolve(process.cwd(), "public")
fs.mkdirSync(publicDir, { recursive: true })

const buildVersionPath = path.join(publicDir, "build-version.json")

let seq = 1
if (fs.existsSync(buildVersionPath)) {
  try {
    const prevRaw = fs.readFileSync(buildVersionPath, "utf8")
    const prev = JSON.parse(prevRaw)
    const v = typeof prev.version === "string" ? prev.version : ""
    const m = v.match(/^v(\d{4})\.(\d{2})\.(\d{2})\.(\d+)$/)
    if (m) {
      const prevDay = `${m[1]}.${m[2]}.${m[3]}`
      const prevSeq = Number.parseInt(m[4], 10)
      if (prevDay === dayLabel && Number.isFinite(prevSeq)) seq = prevSeq + 1
    }
  } catch {
    // ignore — reset sequence
  }
}

const version = `v${dayLabel}.${String(seq).padStart(3, "0")}`
/** Workbox cacheId / 디버그용 — 날짜+일련 (비공백, 짧게) */
const cacheId = `app-v${y}${mo}${da}-${String(seq).padStart(3, "0")}`

const meta = {
  buildId,
  version,
  timestamp: Number(buildId),
  builtAt: now.toISOString(),
  cacheId,
  /** UI / 로그: 브라우저 Workbox 캐시 네임스페이스와 맞춤 (vite `workbox.cacheId`) */
  swWorkboxCacheId: `yds-pwa-${buildId}`,
}

// 1) /build-version.json — fetched by the runtime version checker (must be no-store on Vercel)
fs.writeFileSync(path.join(publicDir, "build-version.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8")

// 2) /manifest.webmanifest — versioned PWA manifest so iOS detects identity changes
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

fs.writeFileSync(path.join(publicDir, "manifest.json"), `${JSON.stringify(versionedManifest, null, 2)}\n`, "utf8")

console.log("[build-meta] generated", { ...meta, manifest: "manifest.webmanifest" })
