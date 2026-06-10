/**
 * 종목추천 Transparency — 기존 스냅샷·점수 메타에서 근거 문장 생성
 */

/** @param {unknown} v */
function toNum(v) {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {number | null | undefined} price
 * @param {'US' | 'KR'} country
 */
export function formatTransparencyPrice(price, country) {
  const p = toNum(price)
  if (p == null) return "—"
  if (country === "KR") return Math.round(p).toLocaleString("ko-KR")
  if (p >= 1000) return Math.round(p).toLocaleString("en-US")
  if (p >= 100) return p.toFixed(1)
  return p.toFixed(2)
}

/**
 * @param {number | null | undefined} ratio
 */
export function formatVolumeRatioLabel(ratio) {
  const r = toNum(ratio)
  if (r == null || r <= 0) return "—"
  return `평균 대비 ${r.toFixed(1)}배`
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 */
function resolveSnapshotNumbers(stock) {
  const snap = stock.snapshot ?? {}
  const close = toNum(snap.price ?? snap.close)
  return {
    close,
    ma20: toNum(snap.ma20),
    ma60: toNum(snap.ma60),
    high52w: toNum(snap.high52w),
    volumeRatio: toNum(stock.scoreMeta?.volumeRatio),
  }
}

/**
 * @param {{
 *   close: number | null
 *   ma20: number | null
 *   ma60: number | null
 *   high52w: number | null
 *   volumeRatio: number | null
 * }} nums
 * @returns {string[]}
 */
export function buildTransparencyRationale(nums) {
  const { close, ma20, ma60, high52w, volumeRatio } = nums
  /** @type {string[]} */
  const lines = []

  if (close != null && ma20 != null) {
    if (close > ma20) lines.push("20일선 위")
    else if (close < ma20) lines.push("20일선 아래")
    else lines.push("20일선 부근")
  }

  if (close != null && ma60 != null) {
    if (close > ma60) lines.push("60일선 위")
    else if (close < ma60) lines.push("60일선 아래")
    else lines.push("60일선 부근")
  }

  if (volumeRatio != null && volumeRatio >= 1.1) {
    lines.push("거래량 증가")
  } else if (volumeRatio != null && volumeRatio < 0.9) {
    lines.push("거래량 감소")
  }

  if (close != null && high52w != null && high52w > 0) {
    const gapPct = Math.max(0, Math.round((1 - close / high52w) * 100))
    if (gapPct <= 5) lines.push(`52주 신고가 ${gapPct}% 이내`)
  }

  return lines.slice(0, 3)
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 */
export function buildStockPickTransparency(stock) {
  const nums = resolveSnapshotNumbers(stock)
  const country = stock.country === "KR" ? "KR" : "US"

  return {
    badge: stock.dataSource === "live" ? "live" : "fallback",
    countryFlag: country === "KR" ? "🇰🇷" : "🇺🇸",
    metrics: [
      { id: "close", label: "현재가", value: formatTransparencyPrice(nums.close, country) },
      { id: "ma20", label: "20일선", value: formatTransparencyPrice(nums.ma20, country) },
      { id: "ma60", label: "60일선", value: formatTransparencyPrice(nums.ma60, country) },
      {
        id: "volume",
        label: "거래량",
        value: formatVolumeRatioLabel(nums.volumeRatio),
      },
    ],
    rationale: buildTransparencyRationale(nums),
  }
}
