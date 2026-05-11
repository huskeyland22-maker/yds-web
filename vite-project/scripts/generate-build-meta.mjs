import fs from "node:fs"
import path from "node:path"

const now = new Date()
const buildId = String(Date.now())
const day = String(now.getDate()).padStart(2, "0")
const hh = String(now.getHours()).padStart(2, "0")
const mm = String(now.getMinutes()).padStart(2, "0")
const version = `v1.0.${day}${hh}${mm}`

const out = {
  buildId,
  version,
  timestamp: Number(buildId),
  builtAt: now.toISOString(),
}

const outDir = path.resolve(process.cwd(), "public")
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, "build-version.json"), `${JSON.stringify(out, null, 2)}\n`, "utf8")
console.log("[build-meta] generated", out)
