import { formatMetric } from "./ydsHistoricalEventTypes.js"
import {
  estimateMoveFromVix,
  getEventMilestoneSeries,
  interpolateMetricsAtDate,
  offsetPrecursorDay,
} from "./ydsPrecursorInterpolation.js"
import { PRODUCTION_CANDIDATE_PANIC_IDS } from "./ydsProductionCandidateV3.js"

/** YDS Precursor Engine — Phase 2 (검증 전용 · getFinalScore/V3/프로덕션 미수정) */
export const PRECURSOR_ENGINE_PHASE2_LABEL = "YDS Precursor Engine — Phase 2"
export const PRECURSOR_ENGINE_PHASE2_NOTE =
  "PRI-A 조기경보(CNN·HY·MOVE·BofA 변화율) + PRI-B 충격확인(VIX·P/C) · climax 기준 2~4주 선행 검증"

export const PRECURSOR_ENGINE_PHASE2_PANIC_IDS = [...PRODUCTION_CANDIDATE_PANIC_IDS]

export const PRECURSOR_ENGINE_PHASE2_NON_PANIC_IDS = [
  "nonpanic-2023-ai-rally",
  "nonpanic-2024-bull-market",
  "nonpanic-2024-ath-breakout",
  "nonpanic-2025-bull-continuation",
  "nonpanic-current-market",
]

export const PRECURSOR_ENGINE_PHASE2_ALL_IDS = [
  ...PRECURSOR_ENGINE_PHASE2_PANIC_IDS,
  ...PRECURSOR_ENGINE_PHASE2_NON_PANIC_IDS,
]

export const PRECURSOR_ENGINE_PHASE2_ANCHOR = "climax"

/** @type {readonly number[]} */
export const PRECURSOR_ENGINE_PHASE2_T_OFFSETS = [28, 21, 14, 10, 7, 5, 3, 1, 0]

/** 패닉 2~4주 전 선행 탐지 윈도우 (climax 대비 일수) */
export const PRECURSOR_ENGINE_PHASE2_LEAD_MIN = 14
export const PRECURSOR_ENGINE_PHASE2_LEAD_MAX = 28

export const PRECURSOR_ENGINE_PHASE2_BASELINE_OFFSET = 28

/** PRI-A 조기경보 임계 (주의 이상) */
export const PRECURSOR_ENGINE_PHASE2_WARN_PRI_A = 30

/** PRI-B 충격감지 임계 */
export const PRECURSOR_ENGINE_PHASE2_WARN_PRI_B = 30

const PRI_A_METRICS = ["cnn", "highYield", "move", "bofa"]
const PRI_B_METRICS = ["vix", "putCall"]
const INTERP_KEYS = ["vix", "cnn", "bofa", "highYield", "putCall"]

/** @type {Record<string, { stressUp: (b: number, c: number) => number; cap: number }>} */
const PRI_A_STRESS = {
  cnn: { stressUp: (b, c) => b - c, cap: 18 },
  highYield: { stressUp: (b, c) => c - b, cap: 0.55 },
  move: { stressUp: (b, c) => c - b, cap: 14 },
  bofa: { stressUp: (b, c) => b - c, cap: 1.2 },
}

function normalizeSnapshot(raw) {
  if (!raw) return null
  const vix = raw.vix != null ? Number(raw.vix) : null
  const cnn = raw.cnn != null ? Number(raw.cnn) : null
  const bofa = raw.bofa != null ? Number(raw.bofa) : null
  const highYield = raw.highYield != null ? Number(raw.highYield) : null
  const putCall = raw.putCall != null ? Number(raw.putCall) : null
  let move = raw.move != null ? Number(raw.move) : null
  if (!Number.isFinite(move) && Number.isFinite(vix)) {
    move = estimateMoveFromVix(vix)
  }
  return {
    date: raw.date,
    vix: Number.isFinite(vix) ? vix : null,
    cnn: Number.isFinite(cnn) ? cnn : null,
    bofa: Number.isFinite(bofa) ? bofa : null,
    highYield: Number.isFinite(highYield) ? highYield : null,
    putCall: Number.isFinite(putCall) ? putCall : null,
    move: Number.isFinite(move) ? move : null,
    moveEstimated: raw.move == null && Number.isFinite(move),
  }
}

/**
 * PRI-A: CNN·HY·MOVE·BofA 변화율 (T-28 baseline 대비) — VIX 제외
 * @param {ReturnType<typeof normalizeSnapshot>} baseline
 * @param {ReturnType<typeof normalizeSnapshot>} current
 */
export function computePriA(baseline, current) {
  if (!baseline || !current) return null
  let score = 0
  let parts = 0
  for (const key of PRI_A_METRICS) {
    const b = baseline[key]
    const c = current[key]
    if (!Number.isFinite(b) || !Number.isFinite(c)) continue
    const delta = PRI_A_STRESS[key].stressUp(b, c)
    const cap = PRI_A_STRESS[key].cap
    score += Math.min(25, Math.max(0, (Math.max(0, delta) / cap) * 25))
    parts += 1
  }
  if (parts === 0) return null
  return Math.round(Math.min(100, score))
}

/** PRI-B: VIX + Put/Call 절대 수준 */
export function computePriB(snapshot) {
  if (!snapshot) return null
  let score = 0
  const { vix, putCall } = snapshot
  if (Number.isFinite(vix)) {
    score += Math.min(50, Math.max(0, ((vix - 14) / 32) * 50))
  }
  if (Number.isFinite(putCall)) {
    score += Math.min(50, Math.max(0, ((putCall - 0.78) / 0.32) * 50))
  }
  if (!Number.isFinite(vix) && !Number.isFinite(putCall)) return null
  return Math.round(Math.min(100, score))
}

/** @param {number | null} score @param {"A" | "B"} kind */
export function resolvePriTier(score, kind = "A") {
  if (score == null || !Number.isFinite(score)) {
    return { id: "unknown", label: "—", emoji: "⚪" }
  }
  if (kind === "B") {
    if (score >= 70) return { id: "panic", label: "패닉", emoji: "🔴" }
    if (score >= 50) return { id: "fear", label: "공포", emoji: "🟠" }
    if (score >= 30) return { id: "shock", label: "충격감지", emoji: "🟡" }
    return { id: "normal", label: "정상", emoji: "🟢" }
  }
  if (score >= 70) return { id: "danger", label: "위험", emoji: "🔴" }
  if (score >= 50) return { id: "warning", label: "경고", emoji: "🟠" }
  if (score >= 30) return { id: "caution", label: "주의", emoji: "🟡" }
  return { id: "normal", label: "정상", emoji: "🟢" }
}

function inLeadWindow(offsetDays) {
  return (
    offsetDays >= PRECURSOR_ENGINE_PHASE2_LEAD_MIN &&
    offsetDays <= PRECURSOR_ENGINE_PHASE2_LEAD_MAX
  )
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 */
export function resolvePrecursorPhase2Events(events) {
  const byId = new Map(events.map((e) => [e.id, e]))
  return PRECURSOR_ENGINE_PHASE2_ALL_IDS.map((id) => byId.get(id)).filter(Boolean)
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData} event
 */
/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData} event
 * @param {{ panicIds?: readonly string[] }} [options]
 */
export function buildPrecursorEnginePhase2Event(event, options = {}) {
  const panicIds = options.panicIds ?? PRECURSOR_ENGINE_PHASE2_PANIC_IDS
  const climaxDate = event?.milestones?.[PRECURSOR_ENGINE_PHASE2_ANCHOR]?.date?.slice(0, 10) ?? null
  const series = getEventMilestoneSeries(event)
  const isPanic = panicIds.includes(event.id)

  const snapshots = PRECURSOR_ENGINE_PHASE2_T_OFFSETS.map((offsetDays) => {
    const date = climaxDate ? offsetPrecursorDay(climaxDate, -offsetDays) : null
    const raw = date ? interpolateMetricsAtDate(series, date, INTERP_KEYS) : null
    const snap = normalizeSnapshot(raw)
    if (!snap) return null
    return {
      offsetDays,
      offsetLabel: offsetDays === 0 ? "T-0 (climax)" : `T-${offsetDays}`,
      ...snap,
    }
  }).filter(Boolean)

  const baseline =
    snapshots.find((s) => s.offsetDays === PRECURSOR_ENGINE_PHASE2_BASELINE_OFFSET) ??
    snapshots[snapshots.length - 1] ??
    null

  const timeSeries = snapshots.map((snap) => {
    const priA = computePriA(baseline, snap)
    const priB = computePriB(snap)
    return {
      ...snap,
      priA,
      priB,
      priATier: resolvePriTier(priA, "A"),
      priBTier: resolvePriTier(priB, "B"),
      inLeadWindow: inLeadWindow(snap.offsetDays),
      priAAlert: priA != null && priA >= PRECURSOR_ENGINE_PHASE2_WARN_PRI_A,
      priBAlert: priB != null && priB >= PRECURSOR_ENGINE_PHASE2_WARN_PRI_B,
    }
  })

  const leadSnapshots = timeSeries.filter((s) => inLeadWindow(s.offsetDays))

  const firstPriA = [...leadSnapshots]
    .filter((s) => s.priAAlert)
    .sort((a, b) => b.offsetDays - a.offsetDays)[0]
  const firstPriB = [...leadSnapshots]
    .filter((s) => s.priBAlert)
    .sort((a, b) => b.offsetDays - a.offsetDays)[0]

  const hitPriA = isPanic && leadSnapshots.some((s) => s.priAAlert)
  const hitPriB = isPanic && leadSnapshots.some((s) => s.priBAlert)
  const falseAlarmPriA = !isPanic && leadSnapshots.some((s) => s.priAAlert)
  const falseAlarmPriB = !isPanic && leadSnapshots.some((s) => s.priBAlert)

  const maxPriAInLead = leadSnapshots.reduce(
    (m, s) => (s.priA != null ? Math.max(m, s.priA) : m),
    -1,
  )
  const maxPriBInLead = leadSnapshots.reduce(
    (m, s) => (s.priB != null ? Math.max(m, s.priB) : m),
    -1,
  )

  return {
    id: event.id,
    name: event.name,
    isPanic,
    climaxDate,
    timeSeries,
    firstWarning: {
      priA: firstPriA ? firstPriA.offsetLabel : "—",
      priB: firstPriB ? firstPriB.offsetLabel : "—",
      priADays: firstPriA?.offsetDays ?? null,
      priBDays: firstPriB?.offsetDays ?? null,
    },
    outcome: {
      hitPriA,
      hitPriB,
      falseAlarmPriA,
      falseAlarmPriB,
      maxPriAInLead: maxPriAInLead >= 0 ? maxPriAInLead : null,
      maxPriBInLead: maxPriBInLead >= 0 ? maxPriBInLead : null,
    },
  }
}

/**
 * @param {ReturnType<typeof buildPrecursorEnginePhase2Event>[]} eventReports
 */
export function buildPrecursorClassificationMetrics(eventReports, scoreKey, warnThreshold) {
  const panic = eventReports.filter((e) => e.isPanic)
  const nonPanic = eventReports.filter((e) => !e.isPanic)

  const tp = panic.filter((e) =>
    e.timeSeries.some(
      (s) => inLeadWindow(s.offsetDays) && s[scoreKey] != null && s[scoreKey] >= warnThreshold,
    ),
  ).length
  const fn = panic.length - tp
  const fp = nonPanic.filter((e) =>
    e.timeSeries.some(
      (s) => inLeadWindow(s.offsetDays) && s[scoreKey] != null && s[scoreKey] >= warnThreshold,
    ),
  ).length
  const tn = nonPanic.length - fp

  const precision = tp + fp > 0 ? Math.round((tp / (tp + fp)) * 1000) / 10 : null
  const recall = tp + fn > 0 ? Math.round((tp / (tp + fn)) * 1000) / 10 : null
  const falsePositiveRate = fp + tn > 0 ? Math.round((fp / (fp + tn)) * 1000) / 10 : null
  const hitRate = recall
  const falseAlarmRate = falsePositiveRate

  return {
    scoreKey,
    warnThreshold,
    leadWindow: `T-${PRECURSOR_ENGINE_PHASE2_LEAD_MAX}~T-${PRECURSOR_ENGINE_PHASE2_LEAD_MIN}`,
    confusion: { tp, fp, tn, fn },
    hitRate,
    falseAlarmRate,
    precision,
    recall,
    falsePositiveRate,
    panicCount: panic.length,
    nonPanicCount: nonPanic.length,
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 */
export function buildPrecursorEnginePhase2Report(events) {
  const resolved = resolvePrecursorPhase2Events(events)
  const eventReports = resolved.map(buildPrecursorEnginePhase2Event)

  const timeSeriesTable = eventReports.flatMap((ev) =>
    ev.timeSeries.map((row) => ({
      eventId: ev.id,
      eventName: ev.name,
      isPanic: ev.isPanic,
      climaxDate: ev.climaxDate,
      offsetLabel: row.offsetLabel,
      offsetDays: row.offsetDays,
      date: row.date,
      priA: row.priA,
      priB: row.priB,
      priATier: row.priATier.label,
      priBTier: row.priBTier.label,
      inLeadWindow: row.inLeadWindow,
    })),
  )

  const metricsPriA = buildPrecursorClassificationMetrics(
    eventReports,
    "priA",
    PRECURSOR_ENGINE_PHASE2_WARN_PRI_A,
  )
  const metricsPriB = buildPrecursorClassificationMetrics(
    eventReports,
    "priB",
    PRECURSOR_ENGINE_PHASE2_WARN_PRI_B,
  )

  const panicHitsA = eventReports.filter((e) => e.isPanic && e.outcome.hitPriA).length
  const panicHitsB = eventReports.filter((e) => e.isPanic && e.outcome.hitPriB).length

  return {
    label: PRECURSOR_ENGINE_PHASE2_LABEL,
    eventReports,
    timeSeriesTable,
    firstWarnings: eventReports.map((e) => ({
      id: e.id,
      name: e.name,
      isPanic: e.isPanic,
      climaxDate: e.climaxDate,
      ...e.firstWarning,
      hitPriA: e.outcome.hitPriA,
      hitPriB: e.outcome.hitPriB,
      falseAlarmPriA: e.outcome.falseAlarmPriA,
      maxPriAInLead: e.outcome.maxPriAInLead,
      maxPriBInLead: e.outcome.maxPriBInLead,
    })),
    classification: {
      priA: metricsPriA,
      priB: metricsPriB,
      combined: {
        panicHitPriA: `${panicHitsA}/${metricsPriA.panicCount}`,
        panicHitPriB: `${panicHitsB}/${metricsPriB.panicCount}`,
      },
    },
    notes: [
      PRECURSOR_ENGINE_PHASE2_NOTE,
      `PRI-A = T-${PRECURSOR_ENGINE_PHASE2_BASELINE_OFFSET} 대비 CNN·HY·MOVE·BofA 변화율 (VIX 제외)`,
      "PRI-B = VIX·Put/Call 절대 수준",
      `선행 윈도우: climax ${PRECURSOR_ENGINE_PHASE2_LEAD_MIN}~${PRECURSOR_ENGINE_PHASE2_LEAD_MAX}일 전 · 경고 임계 PRI≥${PRECURSOR_ENGINE_PHASE2_WARN_PRI_A}`,
      "getFinalScore·VIX V3·프로덕션 엔진 미변경",
      "MOVE 미수집 시 VIX 근사",
    ],
  }
}

export function formatPhase2Cell(value, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—"
  return formatMetric(value, digits)
}

/** @param {ReturnType<typeof buildPrecursorClassificationMetrics>} metrics */
export function formatPrecursorConfusionMatrix(metrics) {
  const { tp, fp, tn, fn } = metrics.confusion
  return {
    columns: ["예측: 경고", "예측: 정상"],
    rows: [
      { label: "실제: 패닉", cells: [tp, fn] },
      { label: "실제: 비패닉", cells: [fp, tn] },
    ],
    tp,
    fp,
    tn,
    fn,
  }
}
