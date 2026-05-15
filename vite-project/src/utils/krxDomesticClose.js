/**
 * 국내 주식 — 16:00 KST 확정·재검증 (클라이언트 스케줄).
 */

export const KRX_DATA_CONFIRM_MINUTES = 16 * 60

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

export function afterKrxDataConfirmed(d = new Date()) {
  return isKstWeekday(d) && kstMinutes(d) >= KRX_DATA_CONFIRM_MINUTES
}

/** 다음 평일 16:00 KST까지 ms (주말·공휴 미반영 — 평일만) */
export function msUntilKrx16Kst(from = new Date()) {
  if (!isKstWeekday(from)) return null
  const min = kstMinutes(from)
  if (min >= KRX_DATA_CONFIRM_MINUTES) return 0
  return (KRX_DATA_CONFIRM_MINUTES - min) * 60 * 1000
}

/** @param {object | null | undefined} chartMeta */
export function shouldRefetchDomesticStock(chartMeta) {
  if (!chartMeta || chartMeta.dataSource !== "kis") return false
  if (chartMeta.needsReverify === true) return true
  if (chartMeta.confirmReady === false && isKstWeekday() && afterKrxDataConfirmed()) return true
  return false
}
