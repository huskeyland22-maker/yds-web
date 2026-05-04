import { getFinalScore, getMidScore, getShortScore } from "./tradingScores.js"

const STORAGE_KEY = "yds-panic-score-history-v1"
const MAX_ENTRIES = 30

/** @typedef {{ date: string, score: number, short: number, mid: number }} PanicHistoryEntry */

function readRaw() {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRaw(entries) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

/**
 * 서버 data로 스냅샷을 히스토리에 추가 (최대 30개, 오래된 것 제거).
 * 연속 동일 (score, short, mid)면 중복 저장하지 않음.
 * @returns {PanicHistoryEntry[]}
 */
export function saveHistory(data) {
  const score = getFinalScore(data)
  const short = getShortScore(data.vix, data.putCall)
  const mid = getMidScore(data.fearGreed, data.bofa, data.highYield)
  const entry = {
    date: new Date().toISOString(),
    score,
    short,
    mid,
  }

  const prev = readRaw()
  const last = prev[prev.length - 1]
  if (
    last &&
    last.score === entry.score &&
    last.short === entry.short &&
    last.mid === entry.mid
  ) {
    return prev
  }

  const next = [...prev, entry]
  while (next.length > MAX_ENTRIES) {
    next.shift()
  }
  writeRaw(next)
  return next
}

/** @returns {PanicHistoryEntry[]} */
export function getHistory() {
  const list = readRaw()
  return list.filter(
    (e) =>
      e &&
      typeof e.date === "string" &&
      Number.isFinite(Number(e.score)) &&
      Number.isFinite(Number(e.short)) &&
      Number.isFinite(Number(e.mid)),
  )
}

function avgScores(slice) {
  if (!slice.length) return NaN
  const sum = slice.reduce((a, e) => a + Number(e.score), 0)
  return sum / slice.length
}

/**
 * 최근 3개 평균 vs 직전 3개 평균 비교.
 * @returns {{ direction: 'up'|'down'|'flat', label: string, avgRecent: number, avgPrev: number, insufficient: boolean }}
 */
export function getTrend(history) {
  const h = Array.isArray(history) ? history : []
  if (h.length < 6) {
    return {
      direction: "flat",
      label: "데이터 수집 중",
      avgRecent: h.length ? avgScores(h.slice(-3)) : NaN,
      avgPrev: NaN,
      insufficient: true,
    }
  }

  const recent = h.slice(-3)
  const prev = h.slice(-6, -3)
  const avgRecent = avgScores(recent)
  const avgPrev = avgScores(prev)
  const diff = avgRecent - avgPrev
  const threshold = 1.5

  if (diff > threshold) {
    return {
      direction: "up",
      label: "상승 추세",
      avgRecent,
      avgPrev,
      insufficient: false,
    }
  }
  if (diff < -threshold) {
    return {
      direction: "down",
      label: "하락 추세",
      avgRecent,
      avgPrev,
      insufficient: false,
    }
  }
  return {
    direction: "flat",
    label: "횡보",
    avgRecent,
    avgPrev,
    insufficient: false,
  }
}

/**
 * @param {number} score
 * @param {{ direction: string, insufficient?: boolean }} trend
 */
export function getTimingSignal(score, trend) {
  const history = getHistory()
  const scores = history.length ? history.map((e) => Number(e.score)) : [Number(score)]
  const min = Math.min(...scores, Number(score))
  const max = Math.max(...scores, Number(score))
  const span = Math.max(1e-6, max - min)
  const pos = (Number(score) - min) / span
  const nearLow = pos <= 0.38
  const nearHigh = pos >= 0.62

  if (trend.insufficient) {
    return {
      label: "관망",
      tone: "neutral",
      detail: "스냅샷이 6개 이상 쌓이면 추세·타이밍을 판별합니다.",
    }
  }

  if (trend.direction === "flat") {
    return {
      label: "관망",
      tone: "neutral",
      detail: "단기 평균이 횡보입니다. 방향 확인 후 진입하세요.",
    }
  }

  if (trend.direction === "up" && nearLow) {
    return {
      label: "초기 진입 신호",
      tone: "buy",
      detail: "점수가 상승 전환 중이며 히스토리 대비 상대적 저점 구간입니다.",
    }
  }

  if (trend.direction === "down" && nearHigh) {
    return {
      label: "익절 신호",
      tone: "danger",
      detail: "점수가 하락 전환 중이며 히스토리 대비 상대적 고점 구간입니다.",
    }
  }

  return {
    label: "관망",
    tone: "neutral",
    detail: "추세와 위치가 전형 패턴에 맞지 않아 신호를 보류합니다.",
  }
}
