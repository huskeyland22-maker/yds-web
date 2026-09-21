/**
 * Panic × SPX 장기 검증 — 순수 계산 (제품 로직 비의존)
 * Panic V2 / 50·60·70 / 40·27·33 고정. threshold·비중·시간·SPX 조건 변경 금지.
 */

/** @type {readonly string[]} */
export const VALIDATION_BOTTOMS = Object.freeze([
  "2023-03-13",
  "2023-10-03",
  "2023-10-27",
  "2024-04-19",
  "2024-08-05",
  "2025-03-13",
  "2025-04-08",
  "2025-11-20",
  "2026-03-30",
])

export const WEIGHT_50 = 40
export const WEIGHT_60 = 27
export const WEIGHT_70 = 33
export const CAPITAL = 100

const PEAK_LOOKBACK_TD = 120
/** 40/27/33 운용 시뮬: D−20~D0 창 (차트 타이밍표와 동일) */
const ENTRY_LOOKBACK_TD = 20

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

function toNum(x) {
  if (x === null || x === undefined || x === "") return NaN
  const n = Number(x)
  return Number.isFinite(n) ? n : NaN
}

/** V2 VIX 점수 — tradingScores.scoreVixV2 와 동일 */
export function scoreVixV2(vix) {
  const v = toNum(vix)
  if (!Number.isFinite(v)) return null
  return clamp(((v - 12) / (40 - 12)) * 100, 0, 100)
}

/** V2 CNN 점수 — tradingScores.scoreCnnV2 와 동일 */
export function scoreCnnV2(fg) {
  const f = toNum(fg)
  if (!Number.isFinite(f)) return null
  return clamp(100 - f, 0, 100)
}

/** V2 Total P/C 점수 — tradingScores.scoreTotalPutCallV2 와 동일 */
export function scoreTotalPutCallV2(pc) {
  const x = toNum(pc)
  if (!Number.isFinite(x)) return null
  const lo = 0.92
  const mid = 1.14
  const hi = 1.39
  if (x <= lo) return 0
  if (x >= hi) return 100
  if (x <= mid) return (50 * (x - lo)) / (mid - lo)
  return 50 + (50 * (x - mid)) / (hi - mid)
}

/** Panic V2 = 0.45·VIX + 0.35·CNN + 0.20·P/C */
export function panicScoreV2(vix, fearGreed, putCall) {
  const sV = scoreVixV2(vix)
  const sC = scoreCnnV2(fearGreed)
  const sP = scoreTotalPutCallV2(putCall)
  if (sV == null || sC == null || sP == null) return null
  return Math.round(clamp(0.45 * sV + 0.35 * sC + 0.2 * sP, 0, 100))
}

function round1(n) {
  return Math.round(Number(n) * 10) / 10
}

/**
 * @param {{ date: string, spx: number, panic: number | null }[]} rows
 * @param {number} thr
 */
export function firstPanicReach(rows, thr) {
  for (const row of rows) {
    if (row?.panic != null && Number.isFinite(row.panic) && row.panic >= thr && row.spx > 0) {
      return { date: row.date, panic: row.panic, spx: row.spx }
    }
  }
  return null
}

/**
 * @param {{ date: string, spx: number, panic: number | null }[]} rows
 * @param {readonly string[]} bottoms
 */
export function buildBottomsMeta(rows, bottoms = VALIDATION_BOTTOMS) {
  const dates = rows.map((r) => r.date)
  const out = []

  for (const d0 of bottoms) {
    const i0 = dates.indexOf(d0)
    if (i0 < 0) {
      throw new Error(`VALIDATION_BOTTOMS date missing from rows: ${d0}`)
    }
    const d0Row = rows[i0]
    const peakFrom = Math.max(0, i0 - PEAK_LOOKBACK_TD)
    let peakIdx = peakFrom
    for (let j = peakFrom; j < i0; j++) {
      if (rows[j].spx >= rows[peakIdx].spx) peakIdx = j
    }
    const peak = rows[peakIdx]
    const ddPct = round1((d0Row.spx / peak.spx - 1) * 100)

    const peakToD0 = rows.slice(peakIdx, i0 + 1)
    const first50 = firstPanicReach(peakToD0, 50)
    const first60 = firstPanicReach(peakToD0, 60)
    const first70 = firstPanicReach(peakToD0, 70)

    let panicPeak = null
    let panicPeakDate = null
    for (const r of peakToD0) {
      if (r.panic == null || !Number.isFinite(r.panic)) continue
      if (panicPeak == null || r.panic >= panicPeak) {
        panicPeak = r.panic
        panicPeakDate = r.date
      }
    }
    let panicPeakLagTd = null
    if (panicPeakDate) {
      panicPeakLagTd = dates.indexOf(panicPeakDate) - i0
    }

    out.push({
      d0,
      spx: d0Row.spx,
      dd_pct: ddPct,
      peak_date: peak.date,
      panic_at_d0: d0Row.panic,
      panic_peak: panicPeak,
      panic_peak_date: panicPeakDate,
      panic_peak_lag_td: panicPeakLagTd,
      first50,
      first60,
      first70,
      hit50: Boolean(first50),
      hit60: Boolean(first60),
      hit70: Boolean(first70),
    })
  }

  return out
}

/**
 * @param {ReturnType<typeof buildBottomsMeta>} bottoms
 */
export function buildSummary(bottoms) {
  const n = bottoms.length
  const lags = bottoms
    .map((b) => b.panic_peak_lag_td)
    .filter((x) => x != null && Number.isFinite(x))
  const peaks = bottoms
    .map((b) => b.panic_peak)
    .filter((x) => x != null && Number.isFinite(x))
  return {
    n,
    hit50: bottoms.filter((b) => b.hit50).length,
    hit60: bottoms.filter((b) => b.hit60).length,
    hit70: bottoms.filter((b) => b.hit70).length,
    avg_panic_peak: peaks.length ? round1(peaks.reduce((a, b) => a + b, 0) / peaks.length) : null,
    avg_peak_lag_td: lags.length ? round1(lags.reduce((a, b) => a + b, 0) / lags.length) : null,
  }
}

/**
 * 40/27/33 — D−20~D0 최초 도달 시에만 단계 매수 (Temp Python 운용 검증과 동일)
 * @param {{ date: string, spx: number, panic: number | null }[]} rows
 * @param {string} d0
 */
export function simulate402733ForBottom(rows, d0) {
  const dates = rows.map((r) => r.date)
  const by = Object.fromEntries(rows.map((r) => [r.date, r]))
  const i0 = dates.indexOf(d0)
  if (i0 < 0) throw new Error(`d0 not in rows: ${d0}`)

  const win = []
  for (let j = Math.max(0, i0 - ENTRY_LOOKBACK_TD); j <= i0; j++) {
    win.push({ ...by[dates[j]], j })
  }

  /** @type {{ tag: string, date: string, spx: number, weight: number, shares: number, j: number }[]} */
  const fills = []
  for (const [thr, tag, weight] of [
    [50, "50", WEIGHT_50],
    [60, "60", WEIGHT_60],
    [70, "70", WEIGHT_70],
  ]) {
    const hit = firstPanicReach(win, thr)
    if (!hit) continue
    if (fills.some((f) => f.tag === tag)) continue
    const j = dates.indexOf(hit.date)
    fills.push({
      tag,
      date: hit.date,
      spx: hit.spx,
      weight,
      shares: weight / hit.spx,
      j,
    })
  }

  const deployed = fills.reduce((s, f) => s + f.weight, 0)
  const cash = CAPITAL - deployed

  function mark(j) {
    const active = fills.filter((f) => f.j <= j)
    const rem = CAPITAL - active.reduce((s, f) => s + f.weight, 0)
    const px = by[dates[j]].spx
    return active.reduce((s, f) => s + f.shares * px, 0) + rem
  }

  let mae = 0
  if (fills.length) {
    const jStart = Math.min(...fills.map((f) => f.j))
    for (let j = jStart; j <= i0; j++) {
      mae = Math.min(mae, (mark(j) / CAPITAL - 1) * 100)
    }
  }

  const retAt = (j) => {
    if (j >= dates.length) return null
    if (!fills.length) return 0
    return round1((mark(j) / CAPITAL - 1) * 100)
  }

  const extraToD0 = {}
  for (const tag of ["50", "60", "70"]) {
    const f = fills.find((x) => x.tag === tag)
    if (!f) {
      extraToD0[tag] = null
      continue
    }
    const trough = Math.min(...dates.slice(f.j, i0 + 1).map((d) => by[d].spx))
    extraToD0[tag] = round1((trough / f.spx - 1) * 100)
  }

  const tags = new Set(fills.map((f) => f.tag))
  let bucket = "other"
  if (tags.size === 0) bucket = "none"
  else if (tags.size === 1 && tags.has("50")) bucket = "stage1_only"
  else if (tags.has("50") && tags.has("60") && tags.has("70")) bucket = "full3"
  else if (tags.has("50") && tags.has("60") && !tags.has("70")) bucket = "stage2"

  return {
    d0,
    firstBuy: fills[0]?.date ?? null,
    fills: fills.map((f) => ({
      tag: f.tag,
      date: f.date,
      spx: f.spx,
      weight: f.weight,
    })),
    deployed: round1(deployed),
    cash: round1(cash),
    retD0: retAt(i0),
    mae: round1(mae),
    retD5: retAt(i0 + 5),
    retD10: retAt(i0 + 10),
    retD20: retAt(i0 + 20),
    extraAfterEntry: extraToD0,
    bucket,
  }
}

/**
 * @param {{ rows: { date: string, spx: number, panic: number | null }[], bottoms?: { d0: string }[] }} series
 */
export function simulate402733Series(series, bottoms = VALIDATION_BOTTOMS) {
  const list = bottoms.length ? bottoms : series.bottoms?.map((b) => b.d0) ?? []
  return list.map((d0) => simulate402733ForBottom(series.rows, d0))
}

/**
 * @param {{ date: string, spx: number, panic: number | null }[]} rows
 * @param {readonly string[]} bottoms
 */
export function buildValidationSeriesDocument(rows, bottoms = VALIDATION_BOTTOMS) {
  const bottomsMeta = buildBottomsMeta(rows, bottoms)
  const summary = buildSummary(bottomsMeta)
  const missingPanicDates = rows.filter((r) => r.panic == null).map((r) => r.date)
  return {
    generatedAt: new Date().toISOString(),
    sourceNote:
      "market-source recomputed Panic V2 (0.45 VIX / 0.35 CNN / 0.20 Total P/C) · not YDS History DB",
    span: [rows[0]?.date ?? null, rows[rows.length - 1]?.date ?? null],
    missingPanicDates,
    summary,
    bottoms: bottomsMeta,
    rows,
  }
}
