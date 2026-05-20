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

const MACRO_KEY = "yds-macro-score-hist"
const CYCLE_KEY = "yds-cycle-score-hist"

/**
 * @param {number} currentScore
 * @param {string} storageKey
 * @returns {{ delta: number | null; hasYesterday: boolean; yesterdayScore: number | null; todayScore: number }}
 */
function scoreDayOverDay(currentScore, storageKey) {
  const s = Number(currentScore)
  if (!Number.isFinite(s)) {
    return { delta: null, hasYesterday: false, yesterdayScore: null, todayScore: NaN }
  }

  const today = localIsoDate()
  const y = prevLocalDay(today)

  /** @type {{ d: string; s: number }[]} */
  let hist = []
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw) hist = JSON.parse(raw)
  } catch {
    hist = []
  }
  if (!Array.isArray(hist)) hist = []

  const yesterdayRow = hist.find((h) => h && h.d === y && Number.isFinite(Number(h.s)))

  const idx = hist.findIndex((h) => h && h.d === today)
  if (idx >= 0) hist[idx] = { d: today, s }
  else hist.push({ d: today, s })

  hist.sort((a, b) => (a.d < b.d ? -1 : 1))
  while (hist.length > 45) hist.shift()
  try {
    localStorage.setItem(storageKey, JSON.stringify(hist))
  } catch {
    // ignore
  }

  const yesterdayScore =
    yesterdayRow && Number.isFinite(Number(yesterdayRow.s)) ? Math.round(Number(yesterdayRow.s)) : null

  if (yesterdayScore == null) {
    return { delta: null, hasYesterday: false, yesterdayScore: null, todayScore: Math.round(s) }
  }
  return {
    delta: Math.round(s - yesterdayScore),
    hasYesterday: true,
    yesterdayScore,
    todayScore: Math.round(s),
  }
}

/** @param {number} currentScore */
export function macroScorePrevDayDelta(currentScore) {
  return scoreDayOverDay(currentScore, MACRO_KEY)
}

/** @param {number} currentScore */
export function cycleScorePrevDayDelta(currentScore) {
  return scoreDayOverDay(currentScore, CYCLE_KEY)
}
