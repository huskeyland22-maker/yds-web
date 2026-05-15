/**
 * Yahoo .KS / .KQ 후보 중 신선한 meta·당일 일봉이 있는 티커 선택.
 */

function num(v) {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** @param {object} meta */
export function isFreshYahooMeta(meta, maxAgeDays = 7) {
  const t = meta?.regularMarketTime
  if (t == null || !Number.isFinite(t)) return false
  const ageMs = Date.now() - t * 1000
  return ageMs >= 0 && ageMs < maxAgeDays * 86400000
}

/**
 * @param {{ meta: object; rows: Array<{ date?: string; close: number }>; ticker: string; todayYmd: string }} input
 */
export function scoreYahooChartCandidate({ meta, rows, ticker, todayYmd }) {
  let score = 0
  if (Array.isArray(rows) && rows.length >= 70) score += 20

  const rm = num(meta?.regularMarketPrice)
  if (rm != null && rm > 0) score += 10

  if (isFreshYahooMeta(meta, 5)) score += 200
  else if (isFreshYahooMeta(meta, 30)) score += 40

  const last = rows?.[rows.length - 1]
  const lastDate = last?.date ? String(last.date) : ""
  if (lastDate === todayYmd && Number.isFinite(last?.close)) score += 80
  else if (lastDate && lastDate < todayYmd && Number.isFinite(last?.close)) score += 20

  if (ticker.endsWith(".KQ")) score += 5

  return score
}

/**
 * @param {object} meta
 * @param {Array<{ close: number }>} closes
 */
export function pickYahooPreviousClose(meta, closes = []) {
  const rmPrev = num(meta?.regularMarketPreviousClose)
  if (rmPrev != null) return rmPrev

  const reversed = [...closes].reverse()
  const validClose = reversed.find((v) => Number.isFinite(v))
  return (
    num(meta?.previousClose) ??
    num(meta?.chartPreviousClose) ??
    num(meta?.previousClosePrice) ??
    (validClose != null ? validClose : null)
  )
}
