/**
 * lightweight-charts · 패닉 데스크 차트 공통 날짜 포맷 (ko locale 비사용 — MM/DD·YYYY.MM.DD 고정).
 */

/** @param {string | null | undefined} dayKey */
function partsFromDayKey(dayKey) {
  if (!dayKey || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return null
  const [year, month, day] = dayKey.split("-").map((x) => Number(x))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return { year, month, day }
}

/**
 * @param {unknown} time lightweight-charts Time (YYYY-MM-DD | BusinessDay | unix)
 * @returns {string | null}
 */
export function chartTimeToDayKey(time) {
  if (time == null) return null
  if (typeof time === "string") {
    return /^\d{4}-\d{2}-\d{2}$/.test(time) ? time : null
  }
  if (typeof time === "number") {
    const d = new Date(time * 1000)
    if (Number.isNaN(d.getTime())) return null
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, "0")
    const day = String(d.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }
  if (typeof time === "object" && "year" in time && "month" in time && "day" in time) {
    const { year, month, day } = time
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }
  return null
}

/** @param {string | null | undefined} dayKey */
export function formatChartTooltip(dayKey) {
  const p = partsFromDayKey(dayKey)
  if (!p) return dayKey ?? "—"
  const mm = String(p.month).padStart(2, "0")
  const dd = String(p.day).padStart(2, "0")
  return `${p.year}.${mm}.${dd}`
}

/** @param {string | null | undefined} dayKey */
export function formatChartAxisMd(dayKey) {
  const p = partsFromDayKey(dayKey)
  if (!p) return ""
  return `${String(p.month).padStart(2, "0")}/${String(p.day).padStart(2, "0")}`
}

/** @param {string | null | undefined} dayKey */
export function formatChartAxisYmd(dayKey) {
  const p = partsFromDayKey(dayKey)
  if (!p) return ""
  const mm = String(p.month).padStart(2, "0")
  const dd = String(p.day).padStart(2, "0")
  return `${p.year}.${mm}.${dd}`
}

/**
 * x축 tick — 모바일·compact MM/DD, 넓은 데스크톱 YYYY.MM.DD.
 * @param {string | null | undefined} dayKey
 * @param {{ mobile?: boolean; compact?: boolean }} [opts]
 */
export function formatChartAxisTick(dayKey, opts = {}) {
  if (!dayKey) return ""
  if (opts.mobile || opts.compact) return formatChartAxisMd(dayKey)
  return formatChartAxisYmd(dayKey)
}

/** @param {string} yyyymmdd */
export function yyyymmddToDayKey(yyyymmdd) {
  const s = String(yyyymmdd ?? "")
  if (!/^\d{8}$/.test(s)) return null
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

/**
 * YYYY-MM-DD → UTC midnight ms (차트 시간축용).
 * @param {string | null | undefined} dayKey
 * @returns {number | null}
 */
export function dayKeyToUtcMs(dayKey) {
  const p = partsFromDayKey(dayKey)
  if (!p) return null
  return Date.UTC(p.year, p.month - 1, p.day)
}

/**
 * @param {number | null | undefined} ms
 * @returns {string | null}
 */
export function utcMsToDayKey(ms) {
  if (ms == null || !Number.isFinite(Number(ms))) return null
  const d = new Date(Number(ms))
  if (Number.isNaN(d.getTime())) return null
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/**
 * 시작~종료 시각을 양끝 포함해 실제 시간 균등 간격 tick(ms)만 고른다.
 * 데이터 샘플링 아님 — 축 라벨 위치용.
 * @param {number} startMs
 * @param {number} endMs
 * @param {number} [targetCount=6]
 * @returns {number[]}
 */
export function pickEvenTimeAxisTicks(startMs, endMs, targetCount = 6) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return []
  if (endMs < startMs) return []
  if (endMs === startMs) return [startMs]
  const target = Math.max(2, Math.min(Math.floor(targetCount), 24))
  /** @type {number[]} */
  const out = []
  for (let i = 0; i < target; i += 1) {
    const t = Math.round(startMs + (i / (target - 1)) * (endMs - startMs))
    if (out.length === 0 || out[out.length - 1] !== t) out.push(t)
  }
  return out
}

/**
 * @param {string | null | undefined} dayKey
 * @param {number} deltaMonths 음수면 과거로
 * @returns {string | null}
 */
export function shiftDayKeyMonths(dayKey, deltaMonths) {
  const p = partsFromDayKey(dayKey)
  if (!p || !Number.isFinite(Number(deltaMonths))) return null
  const idx = p.year * 12 + (p.month - 1) + Math.trunc(deltaMonths)
  const y = Math.floor(idx / 12)
  const m = (idx % 12) + 1
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const d = Math.min(p.day, dim)
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

/**
 * 히스토리 차트 첫 화면 Brush 구간 — 끝날짜 기준 최근 N개월 (데이터 삭제 없음).
 * @param {readonly { date?: string }[]} rows
 * @param {number} [monthsBack=17]
 * @returns {{ startIndex: number; endIndex: number } | null}
 */
export function resolveHistoryDefaultBrushIndex(rows, monthsBack = 17) {
  if (!Array.isArray(rows) || rows.length < 2) return null
  const endIndex = rows.length - 1
  const endDate = rows[endIndex]?.date
  if (typeof endDate !== "string") return { startIndex: 0, endIndex }
  const startKey = shiftDayKeyMonths(endDate, -Math.abs(monthsBack))
  if (!startKey) return { startIndex: 0, endIndex }
  let startIndex = 0
  for (let i = 0; i < rows.length; i += 1) {
    const d = rows[i]?.date
    if (typeof d === "string" && d >= startKey) {
      startIndex = i
      break
    }
  }
  if (startIndex >= endIndex) return { startIndex: 0, endIndex }
  return { startIndex, endIndex }
}

/**
 * 히스토리 시간축 라벨. 장기간(>~18.5개월)은 연도 포함해 과거→현재가 읽히게.
 * @param {number | string | null | undefined} msOrDayKey
 * @param {number} [spanMs]
 */
export function formatHistoryTimeAxisTick(msOrDayKey, spanMs = 0) {
  const dayKey =
    typeof msOrDayKey === "number"
      ? utcMsToDayKey(msOrDayKey)
      : typeof msOrDayKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(msOrDayKey)
        ? msOrDayKey
        : utcMsToDayKey(Number(msOrDayKey))
  if (!dayKey) return ""
  const days = Number.isFinite(spanMs) && spanMs > 0 ? spanMs / 86_400_000 : 0
  // 기본 최근 ~17개월 창은 MM/DD, 그 이상 장기간만 연도 포함
  if (days > 560) {
    const p = partsFromDayKey(dayKey)
    if (!p) return ""
    const yy = String(p.year).slice(-2)
    const mm = String(p.month).padStart(2, "0")
    const dd = String(p.day).padStart(2, "0")
    return `${yy}/${mm}/${dd}`
  }
  return formatChartAxisMd(dayKey)
}

/**
 * X축 라벨용 — 값 배열에서 양끝 포함 균등 간격 tick만 고른다.
 * @deprecated prefer pickEvenTimeAxisTicks for time-scale charts
 * @param {readonly unknown[]} values
 * @param {number} [targetCount=6]
 * @returns {unknown[]}
 */
export function pickEvenAxisTickValues(values, targetCount = 6) {
  if (!Array.isArray(values) || values.length === 0) return []
  const n = values.length
  const target = Math.max(2, Math.min(Math.floor(targetCount), n))
  if (n <= target) return values.slice()
  /** @type {unknown[]} */
  const out = []
  for (let i = 0; i < target; i += 1) {
    const idx = Math.round((i / (target - 1)) * (n - 1))
    const v = values[idx]
    if (out.length === 0 || out[out.length - 1] !== v) out.push(v)
  }
  return out
}
