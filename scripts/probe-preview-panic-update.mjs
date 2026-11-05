/** POST Preview /api/panic?mode=update and print status + body (no secrets). */
const preview =
  process.env.PREVIEW_URL ||
  "https://yds-web-git-integration-yds-windows-mac-so-sung-yangs-projects.vercel.app"
const today = new Date().toISOString().slice(0, 10)
const body = {
  vix: 18.5,
  fear_greed: 42,
  put_call: 0.95,
  tradeDate: today,
  source: "manual",
}
const res = await fetch(`${preview}/api/panic?mode=update`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})
const text = await res.text()
let json = null
try {
  json = JSON.parse(text)
} catch {
  /* ignore */
}
console.log(
  JSON.stringify(
    {
      url: `${preview}/api/panic?mode=update`,
      status: res.status,
      ok: res.ok,
      bodyPrefix: text.slice(0, 1500),
      code: json?.code ?? null,
      message: json?.message ?? json?.error ?? null,
      detail: json?.detail ?? null,
      stage: json?.stage ?? null,
    },
    null,
    2,
  ),
)
process.exit(res.ok ? 0 : 1)
