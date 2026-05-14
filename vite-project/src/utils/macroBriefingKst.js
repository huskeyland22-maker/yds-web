/**
 * KST 08:00까지 남은 ms (해당 분 시작 시각 기준).
 * @param {number} [fromMs=Date.now()]
 */
export function msUntilNextKst8am(fromMs = Date.now()) {
  const step = 60 * 1000
  let t = Math.ceil(fromMs / step) * step
  const limit = fromMs + 26 * 60 * 60 * 1000
  while (t <= limit) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(t))
    const h = Number(parts.find((p) => p.type === "hour")?.value)
    const m = Number(parts.find((p) => p.type === "minute")?.value)
    if (h === 8 && m === 0 && t > fromMs + 500) return t - fromMs
    t += step
  }
  return 24 * 60 * 60 * 1000
}

/** @param {string | null | undefined} iso */
export function formatNySessionDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" })
}

/** @param {number} [fromMs=Date.now()] */
export function formatRelativeKst(fromMs = Date.now()) {
  const d = new Date(fromMs)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

/** @param {number} fetchedAtMs */
export function formatAgeKorean(fetchedAtMs) {
  if (!Number.isFinite(fetchedAtMs)) return null
  const sec = Math.max(0, Math.floor((Date.now() - fetchedAtMs) / 1000))
  if (sec < 60) return `${sec}초 전`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}분 전`
  const h = Math.floor(min / 60)
  return `${h}시간 전`
}
