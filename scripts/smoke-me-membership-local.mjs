/**
 * Local smoke for GET/POST /api/me-membership against Staging env file.
 *
 * Usage (repo root):
 *   1. Copy docs/templates/staging-me-membership.env.example → .env.staging.local
 *   2. Fill PLACEHOLDER_* with Staging keys (never commit)
 *   3. node scripts/smoke-me-membership-local.mjs
 *
 * Does not print secret values. Aborts if SUPABASE_URL looks like Production.
 */
import http from "node:http"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const STAGING_REF = "qzunuksxwwzusyivaznx"
const PRODUCTION_REF = "oausvweyocgynjpeguka"
const DEFAULT_ENV_FILE = path.join(ROOT, ".env.staging.local")

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Env file missing: ${filePath}\nCopy docs/templates/staging-me-membership.env.example to .env.staging.local and fill placeholders.`,
    )
  }
  const text = fs.readFileSync(filePath, "utf8")
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (key && process.env[key] == null) process.env[key] = val
  }
}

function assertStagingUrl() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim()
  if (!url) throw new Error("SUPABASE_URL is empty — fill .env.staging.local")
  if (url.includes(PRODUCTION_REF)) {
    throw new Error("Refusing to run: SUPABASE_URL points at Production. Use Staging only.")
  }
  if (!url.includes(STAGING_REF)) {
    throw new Error(
      `Refusing to run: SUPABASE_URL must include Staging ref ${STAGING_REF}`,
    )
  }
  if (/PLACEHOLDER/i.test(String(process.env.SUPABASE_SERVICE_ROLE_KEY || ""))) {
    console.warn(
      "[warn] SUPABASE_SERVICE_ROLE_KEY still looks like a placeholder — auth-only checks may pass; logged-in lookup will fail until you set a real Staging key.",
    )
  }
}

function makeRes(nodeRes) {
  let code = 200
  return {
    setHeader(k, v) {
      nodeRes.setHeader(k, v)
    },
    status(n) {
      code = n
      return {
        json(body) {
          nodeRes.statusCode = code
          nodeRes.setHeader("Content-Type", "application/json")
          nodeRes.end(JSON.stringify(body))
        },
      }
    },
  }
}

async function main() {
  const envPath = process.env.STAGING_ENV_FILE
    ? path.resolve(process.env.STAGING_ENV_FILE)
    : DEFAULT_ENV_FILE

  console.log("[smoke] env file:", path.relative(ROOT, envPath) || envPath)
  loadEnvFile(envPath)
  assertStagingUrl()

  const { default: handler } = await import(
    pathToFileURL(path.join(ROOT, "api", "me-membership.js")).href
  )

  const server = http.createServer(async (req, res) => {
    try {
      await handler(req, makeRes(res))
    } catch {
      res.statusCode = 500
      res.end(JSON.stringify({ error: "wrapper_failed" }))
    }
  })

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const { port } = server.address()
  const base = `http://127.0.0.1:${port}`

  async function call(method, headers = {}) {
    const r = await fetch(`${base}/api/me-membership`, { method, headers })
    const text = await r.text()
    let error = null
    let plan = null
    let reason = null
    try {
      const j = JSON.parse(text)
      error = j.error ?? null
      plan = j.plan ?? null
      reason = j.reason ?? null
    } catch {
      error = "non_json"
    }
    return { method, status: r.status, error, plan, reason }
  }

  const getNoToken = await call("GET")
  const postNoToken = await call("POST")

  console.log("[smoke] GET no token:", {
    status: getNoToken.status,
    error: getNoToken.error,
  })
  console.log("[smoke] POST:", {
    status: postNoToken.status,
    error: postNoToken.error,
  })

  let getWithToken = null
  const idToken = String(process.env.ME_MEMBERSHIP_ID_TOKEN || "").trim()
  if (idToken && !/PLACEHOLDER/i.test(idToken)) {
    getWithToken = await call("GET", { Authorization: `Bearer ${idToken}` })
    console.log("[smoke] GET with token:", {
      status: getWithToken.status,
      error: getWithToken.error,
      plan: getWithToken.plan,
      reason: getWithToken.reason,
    })
  } else {
    console.log(
      "[smoke] GET with token: skipped (set ME_MEMBERSHIP_ID_TOKEN in .env.staging.local to run)",
    )
  }

  server.close()

  const okAuth =
    getNoToken.status === 401 &&
    getNoToken.error === "missing_token" &&
    postNoToken.status === 405 &&
    postNoToken.error === "method_not_allowed"

  if (!okAuth) {
    console.error("[smoke] FAIL auth/method checks")
    process.exit(1)
  }

  if (getWithToken) {
    if (getWithToken.status !== 200 || getWithToken.plan !== "free") {
      console.error(
        "[smoke] FAIL logged-in check (expected 200 plan=free when membership row missing)",
      )
      process.exit(1)
    }
  }

  console.log("[smoke] PASS (auth/method" + (getWithToken ? " + logged-in FREE" : "") + ")")
}

main().catch((e) => {
  console.error("[smoke] aborted:", e instanceof Error ? e.message : e)
  process.exit(1)
})
