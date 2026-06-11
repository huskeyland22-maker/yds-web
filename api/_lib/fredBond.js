/**
 * Bond / Liquidity — FRED H.15 Treasury constant maturity (official close).
 * 혼합 출처 금지: 채권은 FRED만. DXY 등은 market-data(Yahoo) 유지.
 */

/** @typedef {{ key: string; series: string; aliasKeys?: string[] }} FredBondSeriesDef */

/** @type {FredBondSeriesDef[]} */
export const BOND_FRED_SERIES = [
  { key: "dgs10", series: "DGS10", aliasKeys: ["us10y", "yield10"] },
  { key: "dgs2", series: "DGS2", aliasKeys: ["us2y", "yield2"] },
  { key: "dgs30", series: "DGS30", aliasKeys: ["us30y", "yield30"] },
  { key: "dfii10", series: "DFII10", aliasKeys: ["realYield"] },
  { key: "t10yie", series: "T10YIE", aliasKeys: ["bei"] },
]

export const BOND_FRED_POLICY = {
  provider: "fred-h15",
  method: "fredgraph.csv",
  note: "FRED H.15 official close — not intraday",
  snapshotRule: "us_close_confirmed_preferred_kst_0800",
}

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** @param {string} text */
function isHtmlErrorBody(text) {
  const t = String(text ?? "").trim().toLowerCase()
  return t.startsWith("<!doctype") || t.startsWith("<html") || t.includes("gateway time-out")
}

/**
 * @param {string} seriesId
 * @param {number} maxPoints
 * @param {string} apiKey
 */
async function fetchFredViaApi(seriesId, maxPoints, apiKey) {
  const url = new URL("https://api.stlouisfed.org/fred/series/observations")
  url.searchParams.set("series_id", seriesId)
  url.searchParams.set("api_key", apiKey)
  url.searchParams.set("file_type", "json")
  url.searchParams.set("sort_order", "asc")
  url.searchParams.set("limit", String(Math.max(10, maxPoints)))

  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" })
  if (!res.ok) throw new Error(`FRED API HTTP ${res.status} (${seriesId})`)

  const json = await res.json()
  const obs = Array.isArray(json?.observations) ? json.observations : []
  /** @type {{ date: string; value: number }[]} */
  const rows = []
  for (const o of obs) {
    const raw = String(o?.value ?? "").trim()
    if (!raw || raw === ".") continue
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0.05) continue
    const date = String(o?.date ?? "").trim()
    if (!date) continue
    rows.push({ date, value: n })
  }

  if (rows.length < 1) throw new Error(`FRED API empty (${seriesId})`)

  const tail = rows.slice(-maxPoints)
  const values = tail.map((r) => r.value)
  const dates = tail.map((r) => r.date)
  const current = values[values.length - 1]
  const prev = values.length >= 2 ? values[values.length - 2] : null
  const changePct =
    Number.isFinite(prev) && prev !== 0 ? ((current - prev) / Math.abs(prev)) * 100 : null

  return {
    seriesId,
    values,
    dates,
    current,
    prev,
    changePct,
    asOfNy: dates[dates.length - 1] ?? null,
    source: "fred-api",
  }
}

/**
 * @param {string} seriesId
 * @param {number} maxPoints
 */
async function fetchFredCsv(seriesId, maxPoints) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`
  const res = await fetch(url, { method: "GET", cache: "no-store" })
  if (!res.ok) throw new Error(`FRED CSV HTTP ${res.status} (${seriesId})`)

  const text = await res.text()
  if (isHtmlErrorBody(text)) {
    throw new Error(`FRED CSV HTML error (${seriesId})`)
  }

  const lines = String(text || "")
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)

  /** @type {{ date: string; value: number }[]} */
  const rows = []
  for (const line of lines) {
    const idx = line.lastIndexOf(",")
    if (idx < 0) continue
    const date = line.slice(0, idx).trim()
    const raw = line.slice(idx + 1).trim()
    if (raw === "." || raw === "") continue
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0.05) continue
    rows.push({ date, value: n })
  }

  if (rows.length < 1) throw new Error(`FRED CSV parse failed (${seriesId})`)

  const tail = rows.slice(-maxPoints)
  const values = tail.map((r) => r.value)
  const dates = tail.map((r) => r.date)
  const current = values[values.length - 1]
  const prev = values.length >= 2 ? values[values.length - 2] : null
  const changePct =
    Number.isFinite(prev) && prev !== 0 ? ((current - prev) / Math.abs(prev)) * 100 : null

  return {
    seriesId,
    values,
    dates,
    current,
    prev,
    changePct,
    asOfNy: dates[dates.length - 1] ?? null,
    source: "fred-csv",
  }
}

/**
 * @param {string} seriesId
 * @param {number} [maxPoints]
 */
export async function fetchFredObservationHistory(seriesId, maxPoints = 90) {
  const apiKey = String(process.env.FRED_API_KEY || "").trim()
  /** @type {string[]} */
  const errors = []

  if (apiKey) {
    try {
      return await fetchFredViaApi(seriesId, maxPoints, apiKey)
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  } else {
    errors.push("fred_api_key_missing")
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fetchFredCsv(seriesId, maxPoints)
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
      if (attempt < 2) await sleep(400 * (attempt + 1))
    }
  }

  const err = new Error(errors.join(" | "))
  err.errors = errors
  throw err
}

/**
 * @param {number} [maxPoints]
 */
export async function fetchAllBondFredSeries(maxPoints = 90) {
  const settled = await Promise.allSettled(
    BOND_FRED_SERIES.map(async (def) => {
      const hist = await fetchFredObservationHistory(def.series, maxPoints)
      return { def, hist }
    }),
  )

  /** @type {Record<string, Awaited<ReturnType<typeof fetchFredObservationHistory>>>} */
  const bySeriesId = {}
  /** @type {Record<string, string>} */
  const errors = {}
  let asOfNy = null
  let liveCount = 0

  for (let i = 0; i < settled.length; i += 1) {
    const entry = settled[i]
    if (entry.status !== "fulfilled") {
      const seriesId = BOND_FRED_SERIES[i]?.series ?? "unknown"
      const reason = entry.reason
      errors[seriesId] =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "fetch_failed"
      continue
    }
    const { def, hist } = entry.value
    bySeriesId[def.series] = hist
    liveCount += 1
    if (hist.asOfNy && (!asOfNy || hist.asOfNy > asOfNy)) asOfNy = hist.asOfNy
  }

  return {
    bySeriesId,
    asOfNy,
    policy: BOND_FRED_POLICY,
    errors,
    liveCount,
    totalCount: BOND_FRED_SERIES.length,
  }
}
