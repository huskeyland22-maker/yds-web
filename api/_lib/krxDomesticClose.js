/**
 * 국내 정규장(15:30) 종료 후 OHLC·거래량 확정 — 업데이트 기준 16:00 KST.
 */

export const KRX_DATA_CONFIRM_MINUTES = 16 * 60

export function ymdKst(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d)
  const y = parts.find((p) => p.type === "year")?.value
  const m = parts.find((p) => p.type === "month")?.value
  const day = parts.find((p) => p.type === "day")?.value
  if (!y || !m || !day) return null
  return `${y}${m}${day}`
}

export function kstMinutes(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(d)
  const h = Number(parts.find((p) => p.type === "hour")?.value)
  const m = Number(parts.find((p) => p.type === "minute")?.value)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0
  return h * 60 + m
}

export function isKstWeekday(d = new Date()) {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", weekday: "short" }).format(d)
  return wd !== "Sat" && wd !== "Sun"
}

/** 16:00 KST 이후 — 국내 일봉·수급 확정 반영 구간 */
export function afterKrxDataConfirmed(d = new Date()) {
  return isKstWeekday(d) && kstMinutes(d) >= KRX_DATA_CONFIRM_MINUTES
}

/** @param {Date} [d] */
export function formatUpdateBasisKst(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d)
  const y = parts.find((p) => p.type === "year")?.value
  const mo = parts.find((p) => p.type === "month")?.value
  const day = parts.find((p) => p.type === "day")?.value
  const h = parts.find((p) => p.type === "hour")?.value
  const mi = parts.find((p) => p.type === "minute")?.value
  if (!y || !mo || !day || h == null || mi == null) return "—"
  return `${y}-${mo}-${day} ${h}:${mi} KST`
}

/**
 * KIS 일봉: 16:00 전 당일 봉 제외, 16:00 후 당일 봉 미도착 시 stale.
 * @param {Array<{ date?: string }>} rows
 * @param {Date} [now]
 */
export function sanitizeKisRowsForClose(rows, now = new Date()) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      rows: [],
      excludedTodayBar: false,
      confirmReady: false,
      dataStale: false,
      needsReverify: false,
    }
  }

  const todayYmd = ymdKst(now)
  const last = rows[rows.length - 1]
  const lastDate = last?.date ? String(last.date) : null
  const beforeConfirm = isKstWeekday(now) && !afterKrxDataConfirmed(now)

  if (beforeConfirm && lastDate === todayYmd) {
    const trimmed = rows.slice(0, -1)
    return {
      rows: trimmed.length >= 2 ? trimmed : rows,
      excludedTodayBar: trimmed.length >= 2,
      confirmReady: false,
      dataStale: false,
      needsReverify: true,
    }
  }

  if (isKstWeekday(now) && afterKrxDataConfirmed(now) && lastDate !== todayYmd) {
    return {
      rows,
      excludedTodayBar: false,
      confirmReady: false,
      dataStale: true,
      needsReverify: true,
    }
  }

  const confirmReady = isKstWeekday(now) && afterKrxDataConfirmed(now) && lastDate === todayYmd
  return {
    rows,
    excludedTodayBar: false,
    confirmReady,
    dataStale: false,
    needsReverify: isKstWeekday(now) && !confirmReady && !beforeConfirm,
  }
}
