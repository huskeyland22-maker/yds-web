import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import {
  canComputeYds,
  computeYdsScore,
  formatMetric,
  YDS_MILESTONE_ORDER,
} from "./ydsHistoricalEventTypes.js"
import { PRODUCTION_CANDIDATE_PANIC_IDS } from "./ydsProductionCandidateV3.js"

/** YDS 전조 검증관 — 검증 페이지 전용 · getFinalScore 미변경 */
export const PRECURSOR_VALIDATION_LABEL = "YDS 전조 검증관"
export const PRECURSOR_VALIDATION_NOTE =
  "공포확대(발생일) 기준 T-offset · milestone 선형 보간 · 미래 전조 탐지 시스템 설계용"

export const PRECURSOR_VALIDATION_IDS = [...PRODUCTION_CANDIDATE_PANIC_IDS]

/** 발생일 = T-0 · 공포확대 milestone */
export const PRECURSOR_ANCHOR_MILESTONE = "fearExpansion"

/** @type {readonly number[]} days before anchor (0 = 발생일) */
export const PRECURSOR_T_OFFSETS = [30, 14, 7, 3, 1, 0]

const METRIC_KEYS = ["vix", "cnn", "bofa", "highYield", "putCall"]

const METRIC_LABELS = {
  vix: "VIX",
  cnn: "CNN F&G",
  bofa: "BofA",
  highYield: "HY",
  putCall: "Put/Call",
  yds: "YDS",
}

/** @type {Record<string, { label: string; stressUp: (baseline: number, current: number) => number }>} */
const STRESS_DELTA = {
  vix: {
    label: "VIX",
    stressUp: (b, c) => c - b,
  },
  cnn: {
    label: "CNN F&G",
    stressUp: (b, c) => b - c,
  },
  bofa: {
    label: "BofA",
    stressUp: (b, c) => b - c,
  },
  highYield: {
    label: "HY",
    stressUp: (b, c) => c - b,
  },
  putCall: {
    label: "Put/Call",
    stressUp: (b, c) => c - b,
  },
}

const FIRST_MOVER_THRESHOLDS = {
  vix: 4,
  cnn: 12,
  bofa: 0.6,
  highYield: 0.5,
  putCall: 0.06,
}

const YDS_RISE_DELTA_MIN = 6
const YDS_WARNING_MIN = 50

function parseDay(iso) {
  return new Date(`${String(iso).slice(0, 10)}T12:00:00`).getTime()
}

function formatDay(ts) {
  return new Date(ts).toISOString().slice(0, 10)
}

function offsetDay(iso, days) {
  const d = new Date(parseDay(iso))
  d.setUTCDate(d.getUTCDate() + days)
  return formatDay(d.getTime())
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData} event
 */
function getMilestoneSeries(event) {
  return YDS_MILESTONE_ORDER.map((key) => {
    const m = event?.milestones?.[key]
    if (!m?.date) return null
    return {
      key,
      date: m.date.slice(0, 10),
      ts: parseDay(m.date),
      historyData: m.historyData ?? {},
    }
  })
    .filter(Boolean)
    .sort((a, b) => a.ts - b.ts)
}

/**
 * @param {ReturnType<typeof getMilestoneSeries>} series
 * @param {string} targetDate
 */
function interpolateHistoryAtDate(series, targetDate) {
  if (!series.length) return null
  const targetTs = parseDay(targetDate)

  if (targetTs <= series[0].ts) {
    return { ...series[0].historyData, date: targetDate, _clamp: "before" }
  }
  if (targetTs >= series[series.length - 1].ts) {
    return { ...series[series.length - 1].historyData, date: targetDate, _clamp: "after" }
  }

  for (let i = 0; i < series.length - 1; i += 1) {
    const a = series[i]
    const b = series[i + 1]
    if (targetTs >= a.ts && targetTs <= b.ts) {
      const span = b.ts - a.ts
      const t = span === 0 ? 0 : (targetTs - a.ts) / span
      /** @type {Record<string, number | null>} */
      const out = { date: targetDate }
      for (const key of [...METRIC_KEYS, "sp500"]) {
        const va = a.historyData[key]
        const vb = b.historyData[key]
        if (va == null && vb == null) {
          out[key] = null
        } else if (va == null) {
          out[key] = vb
        } else if (vb == null) {
          out[key] = va
        } else {
          out[key] = va + t * (vb - va)
        }
      }
      return out
    }
  }
  return null
}

/**
 * @param {Record<string, unknown>} raw
 */
function enrichSnapshot(raw) {
  if (!raw) return null
  const historyData = {
    vix: raw.vix,
    cnn: raw.cnn,
    bofa: raw.bofa,
    highYield: raw.highYield,
    putCall: raw.putCall,
  }
  if (!canComputeYds(historyData)) {
    return {
      date: raw.date,
      computable: false,
      yds: null,
      vix: raw.vix,
      cnn: raw.cnn,
      bofa: raw.bofa,
      highYield: raw.highYield,
      putCall: raw.putCall,
      stage: null,
    }
  }
  const yds = computeYdsScore(historyData)
  return {
    date: raw.date,
    computable: true,
    yds,
    vix: historyData.vix,
    cnn: historyData.cnn,
    bofa: historyData.bofa,
    highYield: historyData.highYield,
    putCall: historyData.putCall,
    stage: resolveMacroV1Status(yds),
  }
}

/**
 * @param {ReturnType<typeof buildPrecursorTimeline>} timeline
 * @param {ReturnType<typeof enrichSnapshot>[]} snapshots
 */
function analyzeFirstMover(snapshots) {
  const baseline = snapshots.find((s) => s?.offsetDays === 30)
  if (!baseline?.computable) {
    return { metric: null, label: "—", atOffset: null, atDate: null, detail: "T-30 baseline 없음" }
  }

  const ordered = [...snapshots]
    .filter((s) => s?.computable && s.offsetDays < 30)
    .sort((a, b) => b.offsetDays - a.offsetDays)

  /** @type {{ metric: string; label: string; atOffset: number; atDate: string; delta: number }[]} */
  const triggers = []

  for (const key of METRIC_KEYS) {
    const b = Number(baseline[key])
    if (!Number.isFinite(b)) continue
    for (const snap of ordered) {
      const c = Number(snap[key])
      if (!Number.isFinite(c)) continue
      const delta = STRESS_DELTA[key].stressUp(b, c)
      if (delta >= FIRST_MOVER_THRESHOLDS[key]) {
        triggers.push({
          metric: key,
          label: STRESS_DELTA[key].label,
          atOffset: snap.offsetDays,
          atDate: snap.date,
          delta: Math.round(delta * 100) / 100,
        })
        break
      }
    }
  }

  if (!triggers.length) {
    return { metric: null, label: "—", atOffset: null, atDate: null, detail: "임계 스트레스 변화 미감지" }
  }

  const earliest = triggers.sort((a, b) => b.atOffset - a.atOffset || b.delta - a.delta)[0]
  return {
    ...earliest,
    detail: `${earliest.label} T-${earliest.atOffset} (${earliest.atDate}) · Δ${earliest.delta}`,
  }
}

/**
 * @param {ReturnType<typeof enrichSnapshot>[]} snapshots
 */
function analyzeYdsRiseStart(snapshots) {
  const baseline = snapshots.find((s) => s?.offsetDays === 30)
  if (!baseline?.computable) {
    return { atOffset: null, atDate: null, yds: null, detail: "T-30 baseline 없음" }
  }
  const ordered = [...snapshots].filter((s) => s?.computable).sort((a, b) => b.offsetDays - a.offsetDays)
  for (const snap of ordered) {
    if (snap.offsetDays >= 30) continue
    const rise = snap.yds - baseline.yds
    if (rise >= YDS_RISE_DELTA_MIN) {
      return {
        atOffset: snap.offsetDays,
        atDate: snap.date,
        yds: snap.yds,
        deltaFromBaseline: rise,
        detail: `T-${snap.offsetDays} YDS ${snap.yds} (+${rise}p vs T-30 ${baseline.yds})`,
      }
    }
  }
  return { atOffset: null, atDate: null, yds: null, detail: `T-30~T-1 구간 +${YDS_RISE_DELTA_MIN}p 미달` }
}

/**
 * @param {ReturnType<typeof enrichSnapshot>[]} snapshots
 */
function analyzeWarningPoint(snapshots) {
  const ordered = [...snapshots].filter((s) => s?.computable).sort((a, b) => b.offsetDays - a.offsetDays)
  for (const snap of ordered) {
    if (snap.offsetDays >= 30) continue
    if (snap.yds >= YDS_WARNING_MIN) {
      return {
        atOffset: snap.offsetDays,
        atDate: snap.date,
        yds: snap.yds,
        stageLabel: snap.stage ? `${snap.stage.emoji} ${snap.stage.label}` : "—",
        detail: `T-${snap.offsetDays} YDS ${snap.yds} ≥ ${YDS_WARNING_MIN} (${snap.stage?.label ?? "—"})`,
      }
    }
  }
  return {
    atOffset: null,
    atDate: null,
    yds: null,
    stageLabel: "—",
    detail: `발생 전 YDS ${YDS_WARNING_MIN} 미만`,
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData} event
 */
export function buildPrecursorTimeline(event) {
  const anchorMilestone = event?.milestones?.[PRECURSOR_ANCHOR_MILESTONE]
  const anchorDate = anchorMilestone?.date?.slice(0, 10) ?? null
  const series = getMilestoneSeries(event)

  const snapshots = PRECURSOR_T_OFFSETS.map((offsetDays) => {
    const date = anchorDate ? offsetDay(anchorDate, -offsetDays) : null
    const raw = date ? interpolateHistoryAtDate(series, date) : null
    const enriched = enrichSnapshot(raw ? { ...raw, date } : null)
    return enriched
      ? {
          offsetDays,
          offsetLabel: offsetDays === 0 ? "T-0 (발생)" : `T-${offsetDays}`,
          ...enriched,
        }
      : null
  }).filter(Boolean)

  return {
    id: event.id,
    name: event.name,
    anchorDate,
    anchorMilestone: PRECURSOR_ANCHOR_MILESTONE,
    snapshots,
    firstMover: analyzeFirstMover(snapshots),
    ydsRiseStart: analyzeYdsRiseStart(snapshots),
    warningPoint: analyzeWarningPoint(snapshots),
    leadTimeDays:
      analyzeWarningPoint(snapshots).atOffset != null
        ? analyzeWarningPoint(snapshots).atOffset
        : null,
  }
}

/**
 * @param {ReturnType<typeof buildPrecursorTimeline>[]} timelines
 */
function buildCrossEventInsights(timelines) {
  const withWarning = timelines.filter((t) => t.warningPoint.atOffset != null)
  const avgLead =
    withWarning.length > 0
      ? Math.round(
          withWarning.reduce((s, t) => s + (t.warningPoint.atOffset ?? 0), 0) / withWarning.length,
        )
      : null

  const moverCounts = {}
  for (const t of timelines) {
    if (t.firstMover.metric) {
      moverCounts[t.firstMover.metric] = (moverCounts[t.firstMover.metric] ?? 0) + 1
    }
  }
  const topMover = Object.entries(moverCounts).sort((a, b) => b[1] - a[1])[0]

  return [
    `발생일 = 공포확대(fearExpansion) milestone · ${PRECURSOR_T_OFFSETS.map((d) => (d === 0 ? "T-0" : `T-${d}`)).join(" → ")}`,
    avgLead != null
      ? `6건 중 ${withWarning.length}건에서 YDS≥${YDS_WARNING_MIN} 사전 경고 · 평균 ${avgLead}일 전`
      : "사전 YDS 경고 구간 미충족 이벤트 다수 — 임계값 재조정 검토",
    topMover
      ? `가장 빠른 선행 지표(1차): ${METRIC_LABELS[topMover[0]] ?? topMover[0]} (${topMover[1]}/${timelines.length}건)`
      : "선행 지표 패턴 불명확",
    "목표: 역사 검증 → 실시간 T-offset 모니터링·알림 규칙으로 확장",
  ]
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 */
export function buildPrecursorValidationReport(events) {
  const timelines = events
    .filter((e) => PRECURSOR_VALIDATION_IDS.includes(e.id))
    .map(buildPrecursorTimeline)
    .filter((t) => t.snapshots.some((s) => s.computable))

  const summaryRows = timelines.map((t) => ({
    id: t.id,
    name: t.name,
    anchorDate: t.anchorDate,
    firstMover: t.firstMover.label,
    firstMoverAt: t.firstMover.atOffset != null ? `T-${t.firstMover.atOffset}` : "—",
    ydsRiseAt: t.ydsRiseStart.atOffset != null ? `T-${t.ydsRiseStart.atOffset}` : "—",
    warningAt: t.warningPoint.atOffset != null ? `T-${t.warningPoint.atOffset}` : "—",
    warningYds: t.warningPoint.yds,
    leadDays: t.warningPoint.atOffset,
  }))

  return {
    timelines,
    summaryRows,
    insights: buildCrossEventInsights(timelines),
    thresholds: {
      firstMover: FIRST_MOVER_THRESHOLDS,
      ydsRiseDeltaMin: YDS_RISE_DELTA_MIN,
      ydsWarningMin: YDS_WARNING_MIN,
    },
    notes: [
      PRECURSOR_VALIDATION_NOTE,
      "지표값 = 이벤트 milestone 5구간 선형 보간(검증용 근사).",
      "getFinalScore·프로덕션 미변경 · 실시간 전조 탐지는 별도 파이프라인 필요.",
    ],
  }
}

export function formatPrecursorCell(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—"
  return formatMetric(value, digits)
}

export { METRIC_LABELS, METRIC_KEYS }
