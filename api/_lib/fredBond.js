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

/**
 * @param {string} seriesId
 * @param {number} [maxPoints]
 * @returns {Promise<{ seriesId: string; values: number[]; dates: string[]; current: number; prev: number|null; changePct: number|null; asOfNy: string|null }>}
 */
export async function fetchFredObservationHistory(seriesId, maxPoints = 90) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`
  const res = await fetch(url, { method: "GET", cache: "no-store" })
  if (!res.ok) throw new Error(`FRED HTTP ${res.status} (${seriesId})`)

  const text = await res.text()
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
    if (Number.isFinite(n)) rows.push({ date, value: n })
  }

  if (rows.length < 1) throw new Error(`FRED parse failed (${seriesId})`)

  const tail = rows.slice(-maxPoints)
  const values = tail.map((r) => r.value)
  const dates = tail.map((r) => r.date)
  const current = values[values.length - 1]
  const prev = values.length >= 2 ? values[values.length - 2] : null
  const changePct =
    Number.isFinite(prev) && prev !== 0 ? ((current - prev) / Math.abs(prev)) * 100 : null
  const asOfNy = dates[dates.length - 1] ?? null

  return { seriesId, values, dates, current, prev, changePct, asOfNy }
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
  let asOfNy = null

  for (const entry of settled) {
    if (entry.status !== "fulfilled") continue
    const { def, hist } = entry.value
    bySeriesId[def.series] = hist
    if (hist.asOfNy && (!asOfNy || hist.asOfNy > asOfNy)) asOfNy = hist.asOfNy
  }

  return { bySeriesId, asOfNy, policy: BOND_FRED_POLICY }
}
