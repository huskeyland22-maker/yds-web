/**
 * Optional OpenAI desk bullets. Requires OPENAI_API_KEY on Vercel.
 * POST JSON: { "facts": { ... compact briefing facts } }
 */

function safeJson(text) {
  try {
    const t = String(text || "").trim()
    const start = t.indexOf("[")
    const end = t.lastIndexOf("]")
    if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1))
  } catch {
    /* ignore */
  }
  return null
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store")
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method" })
    return
  }

  const key = process.env.OPENAI_API_KEY
  if (!key) {
    res.status(200).json({ ok: true, usedAi: false, lines: null })
    return
  }

  let body = {}
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {}
  } catch {
    res.status(400).json({ ok: false, error: "json" })
    return
  }

  const facts = body.facts && typeof body.facts === "object" ? body.facts : {}

  const system = `You are a senior macro strategist at a hedge fund. Output ONLY a JSON array of 5 to 7 strings in Korean.
Each string is ONE dense desk line (max 120 chars). No blog tone. No markdown. No emojis.
Bloomberg / morning brief style: tickers, %, regime. Use middle dot (·) sparingly.`

  const user = `Facts JSON:\n${JSON.stringify(facts).slice(0, 6000)}`

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MACRO_MODEL || "gpt-4o-mini",
        temperature: 0.35,
        max_tokens: 700,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    })

    if (!r.ok) {
      const errText = await r.text()
      res.status(200).json({
        ok: true,
        usedAi: false,
        lines: null,
        error: `openai_http_${r.status}`,
        detail: errText.slice(0, 200),
      })
      return
    }

    const data = await r.json()
    const content = data?.choices?.[0]?.message?.content
    const lines = safeJson(content)
    if (!Array.isArray(lines) || !lines.every((x) => typeof x === "string")) {
      res.status(200).json({ ok: true, usedAi: false, lines: null, error: "parse" })
      return
    }

    res.status(200).json({
      ok: true,
      usedAi: true,
      lines: lines
        .map((s) => String(s).trim())
        .filter(Boolean)
        .slice(0, 8),
    })
  } catch (e) {
    res.status(200).json({ ok: true, usedAi: false, lines: null, error: e instanceof Error ? e.message : "fetch" })
  }
}
