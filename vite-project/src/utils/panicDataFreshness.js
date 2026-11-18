/**
 * 시장 위험 화면의 데이터 상태.
 * 점수식은 바꾸지 않고, 이미 계산된 값을 어떤 상태로 보여줄지만 정한다.
 */
import { PANIC_HISTORY_SEED } from "./panicHistorySeed.js"
import { isPanicBusinessDataStale } from "./validatePanicData.js"

export const DATA_STATE = Object.freeze({
  LIVE: "LIVE",
  STALE: "STALE",
  SEED: "SEED",
  MISSING: "MISSING",
  UNKNOWN: "UNKNOWN",
})

/**
 * 코드에 지표별 신선도 일이 없어, 수집 주기만 보고 정한 기준.
 * VIX·CNN·Put/Call은 일별 시세, BofA는 수동 입력, HY는 FRED 일별 지연.
 * 기존 공통 한도는 validatePanicData의 120일이다.
 */
export const METRIC_FRESH_DAYS = Object.freeze({
  vix: 3,
  cnn: 3,
  putCall: 3,
  bofa: 14,
  highYield: 5,
})

const SCORE_INPUTS = ["vix", "cnn", "putCall"]
const CONFIRMED_SOURCES = new Set(["HUB", "API", "HISTORY"])

/** null, undefined, 빈 문자열은 결측이다. 숫자 0은 유지한다. */
export function readFiniteMetric(value) {
  if (value == null || value === "") return null
  if (typeof value === "object") {
    if (Object.prototype.hasOwnProperty.call(value, "value")) return readFiniteMetric(value.value)
    return null
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function finite(value) {
  return readFiniteMetric(value)
}

function dayKeyFrom(value) {
  const text = String(value ?? "")
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null
}

function sameNumber(left, right) {
  return left != null && right != null && Math.abs(left - right) < 1e-6
}

export function panicAsOfDate(panicData) {
  return (
    dayKeyFrom(panicData?.date) ??
    dayKeyFrom(panicData?.asOfDate) ??
    dayKeyFrom(panicData?.updatedAt) ??
    dayKeyFrom(panicData?.updated_at)
  )
}

/** cycle 행이 날짜만으로 만드는 정오 UTC. 수집 시각이 아니다. */
export function isPlaceholderUpdatedAt(panicData) {
  const date = dayKeyFrom(panicData?.date ?? panicData?.asOfDate)
  const iso = String(panicData?.updatedAt ?? panicData?.updated_at ?? "")
  if (!date || !iso) return false
  return iso.startsWith(`${date}T12:00:00`)
}

function metricNumber(panicData, metricId) {
  if (!panicData || typeof panicData !== "object") return null
  if (metricId === "cnn") return finite(panicData.fearGreed)
  if (metricId === "highYield") return finite(panicData.highYield ?? panicData.hyOas)
  if (metricId === "bbb") return finite(panicData.bbbSpread ?? panicData.bbb ?? panicData.bbbOas)
  return finite(panicData[metricId])
}

function seedNumber(row, metricId) {
  if (!row) return null
  if (metricId === "cnn") return finite(row.fearGreed)
  if (metricId === "highYield") return finite(row.highYield ?? row.hyOas)
  if (metricId === "bbb") return null
  return finite(row[metricId])
}

/** 시드 날짜이면서 VIX·CNN·Put/Call이 시드 값과 같으면 최신 실수집 행이 아니다. */
export function isSeedSnapshot(data) {
  const date = panicAsOfDate(data)
  if (!date || !PANIC_HISTORY_SEED.some((row) => row.date === date)) return false
  return ["vix", "cnn", "putCall"].every((id) => isSeedMetricValue(data, id))
}

const COLLECTED_METRIC_IDS = ["vix", "cnn", "putCall", "highYield", "bofa"]

export function hasCollectedMarketValue(data) {
  return COLLECTED_METRIC_IDS.some((id) => {
    const value = metricNumber(data, id)
    return value != null && !isSeedMetricValue(data, id)
  })
}

/** 같은 날짜에 남아 있는 시드 값만 지운다. 실수집 값과 기준일은 유지한다. */
export function omitSeedCarry(data) {
  if (!data || typeof data !== "object") return data
  const next = { ...data }
  if (isSeedMetricValue(next, "vix")) next.vix = null
  if (isSeedMetricValue(next, "cnn")) next.fearGreed = null
  if (isSeedMetricValue(next, "putCall")) next.putCall = null
  if (isSeedMetricValue(next, "highYield")) {
    next.highYield = null
    next.hyOas = null
  }
  if (isSeedMetricValue(next, "bofa")) next.bofa = null
  return next
}

export function latestCollectedHistoryRow(rows) {
  if (!Array.isArray(rows)) return null
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]
    if (!row || isSeedSnapshot(row)) continue
    if (hasCollectedMarketValue(row)) return row
  }
  return null
}

/**
 * 최신 카드용 스냅샷. 시드 행은 건너뛰고, 실수집 후보 중 기준일이 가장 늦은 것을 고른다.
 * @param {object | null | undefined} historyPanic
 * @param {object | null | undefined} deskPanic
 * @param {object | null | undefined} storePanic
 */
export function resolveLivePanicData(historyPanic, deskPanic, storePanic) {
  const selected = [historyPanic, deskPanic, storePanic]
    .filter((item) => item && !isSeedSnapshot(item))
    .map((item) => omitSeedCarry(item))
    .filter((item) => hasCollectedMarketValue(item))
  if (!selected.length) return null
  selected.sort((left, right) =>
    String(panicAsOfDate(right) ?? "").localeCompare(String(panicAsOfDate(left) ?? "")),
  )
  const winner = { ...selected[0] }
  for (const key of ["bbbOas", "bbb", "bbbSpread"]) {
    if (readFiniteMetric(winner[key]) != null) continue
    for (const item of [historyPanic, deskPanic, storePanic]) {
      const value = readFiniteMetric(item?.[key])
      if (value != null) {
        winner[key] = value
        break
      }
    }
  }
  return winner
}

export function isSeedMetricValue(panicData, metricId) {
  const date = panicAsOfDate(panicData)
  if (!date) return false
  const seed = PANIC_HISTORY_SEED.find((row) => row.date === date)
  if (!seed) return false
  return sameNumber(metricNumber(panicData, metricId), seedNumber(seed, metricId))
}

function ageDays(date, now) {
  const stamp = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(stamp)) return null
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.floor((today - stamp) / 86400000)
}

export function hasConfirmedCollection(panicData) {
  if (!panicData || typeof panicData !== "object") return false
  if (isPlaceholderUpdatedAt(panicData) && !CONFIRMED_SOURCES.has(String(panicData.__fetchSource ?? ""))) {
    return false
  }
  const source = String(panicData.__fetchSource ?? "")
  if (CONFIRMED_SOURCES.has(source)) return true
  const iso = panicData.updatedAt ?? panicData.updated_at ?? null
  return Boolean(iso) && !isPlaceholderUpdatedAt(panicData)
}

export function classifyMetricState(panicData, metricId, now = new Date()) {
  const value = metricNumber(panicData, metricId)
  if (value == null) return DATA_STATE.MISSING
  if (isSeedMetricValue(panicData, metricId)) return DATA_STATE.SEED
  const date = panicAsOfDate(panicData)
  if (!date) return DATA_STATE.UNKNOWN
  const age = ageDays(date, now)
  const limit = METRIC_FRESH_DAYS[metricId]
  if (age == null || limit == null) return DATA_STATE.UNKNOWN
  const payloadStale = hasConfirmedCollection(panicData) && isPanicBusinessDataStale(panicData)
  if (age > limit || payloadStale) return DATA_STATE.STALE
  if (hasConfirmedCollection(panicData)) return DATA_STATE.LIVE
  return DATA_STATE.UNKNOWN
}

export function classifyPanicScoreState(panicData, now = new Date()) {
  const states = SCORE_INPUTS.map((id) => classifyMetricState(panicData, id, now))
  if (states.some((state) => state === DATA_STATE.SEED)) return DATA_STATE.SEED
  if (states.some((state) => state === DATA_STATE.MISSING)) return DATA_STATE.MISSING
  if (states.some((state) => state === DATA_STATE.UNKNOWN)) return DATA_STATE.UNKNOWN
  if (states.some((state) => state === DATA_STATE.STALE)) return DATA_STATE.STALE
  return DATA_STATE.LIVE
}

export function panicFreshnessNotice(state) {
  if (state === DATA_STATE.SEED) return "시드 데이터입니다. 실시간 값이 아닙니다."
  if (state === DATA_STATE.STALE) {
    return "수집된 값이지만 기준일이 오래되었습니다. 최신 수동 입력·수집값이 아닙니다."
  }
  if (state === DATA_STATE.MISSING) return "최신 데이터 없음"
  if (state === DATA_STATE.UNKNOWN) return "출처 또는 기준일을 확인하지 못했습니다."
  return "수집된 최신 스냅샷입니다."
}
