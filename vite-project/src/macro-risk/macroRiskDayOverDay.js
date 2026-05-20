/** @returns {string} YYYY-MM-DD (로컬 캘린더) */
export function localIsoDate(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** @param {string} isoDate */
function prevLocalDay(isoDate) {
  const [y, mo, da] = isoDate.split("-").map((n) => Number(n))
  const d = new Date(y, mo - 1, da)
  d.setDate(d.getDate() - 1)
  return localIsoDate(d)
}

const KEY = "yds-macro-score-hist"

/**
 * 전일(로컬 캘린더) 대비 Macro 점수 차이. 직전 저장일이 없으면 null.
 * @param {number} currentScore
 * @returns {{ delta: number | null; hasYesterday: boolean }}
 */
export function macroScorePrevDayDelta(currentScore) {
  const s = Number(currentScore)
  if (!Number.isFinite(s)) return { delta: null, hasYesterday: false }

  const today = localIsoDate()
  const y = prevLocalDay(today)

  /** @type {{ d: string; s: number }[]} */
  let hist = []
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) hist = JSON.parse(raw)
  } catch {
    hist = []
  }
  if (!Array.isArray(hist)) hist = []

  const yesterdayRow = hist.find((h) => h && h.d === y && Number.isFinite(Number(h.s)))

  const idx = hist.findIndex((h) => h && h.d === today)
  if (idx >= 0) hist[idx] = { d: today, s: s }
  else hist.push({ d: today, s })

  hist.sort((a, b) => (a.d < b.d ? -1 : 1))
  while (hist.length > 45) hist.shift()
  try {
    localStorage.setItem(KEY, JSON.stringify(hist))
  } catch {
    // ignore
  }

  if (!yesterdayRow || !Number.isFinite(Number(yesterdayRow.s))) return { delta: null, hasYesterday: false }
  return { delta: Math.round(s - Number(yesterdayRow.s)), hasYesterday: true }
}
