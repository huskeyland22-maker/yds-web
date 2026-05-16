/**
 * Vite는 VITE_* 변수를 **빌드 시점**에 번들에 인라인합니다.
 * Vercel에 env를 추가한 뒤 반드시 Production 재배포가 필요합니다.
 * (값은 저장하지 않고 존재 여부만 public/client-env-manifest.json 에 기록)
 */
import fs from "node:fs"
import path from "node:path"

function flag(name) {
  const v = process.env[name]
  return typeof v === "string" && v.trim().length > 0
}

function hubOn() {
  const v = process.env.VITE_PANIC_HUB
  return v === "1" || v === "true"
}

const client = {
  VITE_SUPABASE_URL: flag("VITE_SUPABASE_URL"),
  VITE_SUPABASE_ANON_KEY: flag("VITE_SUPABASE_ANON_KEY"),
  VITE_PANIC_HUB: hubOn(),
}

const server = {
  SUPABASE_URL: flag("SUPABASE_URL") || flag("VITE_SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: flag("SUPABASE_SERVICE_ROLE_KEY"),
}

const clientReady = client.VITE_SUPABASE_URL && client.VITE_SUPABASE_ANON_KEY && client.VITE_PANIC_HUB
const serverReady = server.SUPABASE_URL && server.SUPABASE_SERVICE_ROLE_KEY

const manifest = {
  builtAt: new Date().toISOString(),
  nodeEnv: process.env.NODE_ENV ?? "unknown",
  vercel: process.env.VERCEL === "1",
  vercelEnv: process.env.VERCEL_ENV ?? null,
  client,
  server,
  clientReady,
  serverReady,
  hubReady: client.VITE_PANIC_HUB && clientReady,
  note:
    "client.* = inlined into JS at vite build. If false after setting Vercel env, redeploy Production.",
}

const publicDir = path.resolve(process.cwd(), "public")
fs.mkdirSync(publicDir, { recursive: true })
fs.writeFileSync(path.join(publicDir, "client-env-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8")

const lines = [
  `[client-env] VITE_SUPABASE_URL=${client.VITE_SUPABASE_URL}`,
  `[client-env] VITE_SUPABASE_ANON_KEY=${client.VITE_SUPABASE_ANON_KEY}`,
  `[client-env] VITE_PANIC_HUB=${client.VITE_PANIC_HUB}`,
  `[client-env] SUPABASE_URL(server)=${server.SUPABASE_URL}`,
  `[client-env] SUPABASE_SERVICE_ROLE_KEY=${server.SUPABASE_SERVICE_ROLE_KEY}`,
]

for (const line of lines) console.log(line)

if (process.env.VERCEL === "1") {
  if (!client.VITE_SUPABASE_URL || !client.VITE_SUPABASE_ANON_KEY) {
    console.error(
      "\n[YDS BUILD] CRITICAL: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing at BUILD time.\n" +
        "  Vercel → Settings → Environment Variables → enable for Production, Preview, Development\n" +
        "  Then Redeploy (env added without rebuild leaves mobile/PWA with undefined).\n",
    )
  }
  if (!client.VITE_PANIC_HUB) {
    console.warn("[YDS BUILD] WARN: VITE_PANIC_HUB is not 1 — app uses Render fallback / hub disabled.")
  }
  if (!server.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[YDS BUILD] WARN: SUPABASE_SERVICE_ROLE_KEY missing — /api/panic/latest will 503.")
  }
}
