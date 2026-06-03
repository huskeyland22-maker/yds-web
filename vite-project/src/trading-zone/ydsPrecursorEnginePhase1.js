import { formatMetric } from "./ydsHistoricalEventTypes.js"
import {
  estimateMoveFromVix,
  getEventMilestoneSeries,
  interpolateMetricsAtDate,
  offsetPrecursorDay,
} from "./ydsPrecursorInterpolation.js"
import { PRODUCTION_CANDIDATE_PANIC_IDS } from "./ydsProductionCandidateV3.js"

/** YDS Precursor Engine — Phase 1 (검증 전용 · getFinalScore/V3/프로덕션 미수정) */
export const PRECURSOR_ENGINE_PHASE1_LABEL = "YDS Precursor Engine — Phase 1"
export const PRECURSOR_ENGINE_PHASE1_NOTE =
  "극점(climax) 기준 T-offset · VIX·CNN·HY·Put/Call·MOVE · 패닉 전 전조 탐지 설계"

export const PRECURSOR_ENGINE_PHASE1_IDS = [...PRODUCTION_CANDIDATE_PANIC_IDS]

/** T-0 = climax (극점) */
export const PRECURSOR_ENGINE_ANCHOR = "climax"

/** @type {readonly number[]} */
export const PRECURSOR_ENGINE_T_OFFSETS = [14, 10, 7, 5, 3, 1, 0]

export const PRECURSOR_ENGINE_METRIC_KEYS = ["vix", "cnn", "highYield", "putCall", "move"]

export const PRECURSOR_ENGINE_METRIC_LABELS = {
  vix: "VIX",
  cnn: "CNN F&G",
  highYield: "HY",
  putCall: "Put/Call",
  move: "MOVE",
}

/** T-14 baseline 대비 스트레스 변화량 (양수 = 공포↑ / 스트레스↑) */
const STRESS_DELTA = {
  vix: { label: "VIX", delta: (b, c) => c - b },
  cnn: { label: "CNN F&G", delta: (b, c) => b - c },
  highYield: { label: "HY", delta: (b, c) => c - b },
  putCall: { label: "Put/Call", delta: (b, c) => c - b },
  move: { label: "MOVE", delta: (b, c) => c - b },
}

/** T-14 대비 Δ 임계 (전조 신호) */
const DELTA_THRESHOLDS = {
  vix: 3,
  cnn: 10,
  highYield: 0.35,
  putCall: 0.05,
  move: 7,
}

/** 절대 수준 임계 (전조 신호) */
const LEVEL_THRESHOLDS = {
  vix: 22,
  cnn: 45,
  highYield: 4.4,
  putCall: 0.87,
  move: 108,
}

const BASELINE_OFFSET = 14

function normalizeSnapshot(raw) {
  if (!raw) return null
  const vix = raw.vix != null ? Number(raw.vix) : null
  const cnn = raw.cnn != null ? Number(raw.cnn) : null
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
    highYield: Number.isFinite(highYield) ? highYield : null,
    putCall: Number.isFinite(putCall) ? putCall : null,
    move: Number.isFinite(move) ? move : null,
    moveEstimated: raw.move == null && Number.isFinite(move),
  }
}

function isMetricSignal(metric, baseline, current) {
  const b = baseline[metric]
  const c = current[metric]
  if (!Number.isFinite(b) || !Number.isFinite(c)) return { active: false, reason: null, delta: null }

  const delta = STRESS_DELTA[metric].delta(b, c)
  const deltaHit = delta >= DELTA_THRESHOLDS[metric]
  const levelHit =
    metric === "cnn" ? c <= LEVEL_THRESHOLDS.cnn : c >= LEVEL_THRESHOLDS[metric]

  if (deltaHit && levelHit) {
    return { active: true, reason: "delta+level", delta: Math.round(delta * 100) / 100 }
  }
  if (deltaHit) return { active: true, reason: "delta", delta: Math.round(delta * 100) / 100 }
  if (levelHit) return { active: true, reason: "level", delta: Math.round(delta * 100) / 100 }
  return { active: false, reason: null, delta: Math.round(delta * 100) / 100 }
}

/** 검증 전용 전조 위험도 0~100 (getFinalScore·프로덕션 엔진과 무관) */
function computePrecursorRiskIndex(snapshot) {
  if (!snapshot) return null
  let score = 0
  const vix = snapshot.vix
  const cnn = snapshot.cnn
  const hy = snapshot.highYield
  const pc = snapshot.putCall
  const move = snapshot.move

  if (Number.isFinite(vix)) score += Math.min(25, Math.max(0, ((vix - 14) / 30) * 25))
  if (Number.isFinite(cnn)) score += Math.min(20, Math.max(0, ((55 - cnn) / 45) * 20))
  if (Number.isFinite(hy)) score += Math.min(20, Math.max(0, ((hy - 3.2) / 4) * 20))
  if (Number.isFinite(pc)) score += Math.min(15, Math.max(0, ((pc - 0.75) / 0.35) * 15))
  if (Number.isFinite(move)) score += Math.min(20, Math.max(0, ((move - 85) / 80) * 20))

  return Math.round(Math.min(100, Math.max(0, score)))
}

function riskTier(pri) {
  if (pri == null) return { id: "unknown", label: "—", emoji: "⚪" }
  if (pri >= 70) return { id: "critical", label: "긴급", emoji: "🔴" }
  if (pri >= 50) return { id: "elevated", label: "경계", emoji: "🟠" }
  if (pri >= 30) return { id: "watch", label: "관찰", emoji: "🟡" }
  return { id: "calm", label: "안정", emoji: "🟢" }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData} event
 */
export function buildPrecursorEnginePhase1Event(event) {
  const anchorMilestone = event?.milestones?.[PRECURSOR_ENGINE_ANCHOR]
  const climaxDate = anchorMilestone?.date?.slice(0, 10) ?? null
  const series = getEventMilestoneSeries(event)
  const interpKeys = ["vix", "cnn", "highYield", "putCall"]

  const snapshots = PRECURSOR_ENGINE_T_OFFSETS.map((offsetDays) => {
    const date = climaxDate ? offsetPrecursorDay(climaxDate, -offsetDays) : null
    const raw = date ? interpolateMetricsAtDate(series, date, interpKeys) : null
    const normalized = normalizeSnapshot(raw)
    if (!normalized) return null
    return {
      offsetDays,
      offsetLabel: offsetDays === 0 ? "T-0 (climax)" : `T-${offsetDays}`,
      ...normalized,
      precursorRiskIndex: computePrecursorRiskIndex(normalized),
      riskTier: riskTier(computePrecursorRiskIndex(normalized)),
    }
  }).filter(Boolean)

  const baseline = snapshots.find((s) => s.offsetDays === BASELINE_OFFSET) ?? snapshots[0]

  const signalMatrix = PRECURSOR_ENGINE_METRIC_KEYS.map((metric) => {
    const cells = PRECURSOR_ENGINE_T_OFFSETS.map((offsetDays) => {
      const snap = snapshots.find((s) => s.offsetDays === offsetDays)
      if (!snap || !baseline) return { offsetDays, active: false, reason: null, delta: null }
      if (offsetDays >= BASELINE_OFFSET) {
        return { offsetDays, active: false, reason: "baseline", delta: null }
      }
      const sig = isMetricSignal(metric, baseline, snap)
      return { offsetDays, ...sig }
    })
    const firstActive = cells
      .filter((c) => c.active)
      .sort((a, b) => b.offsetDays - a.offsetDays)[0]
    return {
      metric,
      label: PRECURSOR_ENGINE_METRIC_LABELS[metric],
      cells,
      firstSignalAt: firstActive ? `T-${firstActive.offsetDays}` : "—",
      anySignal: cells.some((c) => c.active),
    }
  })

  const activeMetrics = signalMatrix.filter((m) => m.anySignal).map((m) => m.label)
  const firstComposite = signalMatrix
    .filter((m) => m.anySignal)
    .map((m) => ({
      metric: m.metric,
      label: m.label,
      at: m.firstSignalAt,
      offset: Number(String(m.firstSignalAt).replace("T-", "")) || 0,
    }))
    .sort((a, b) => b.offset - a.offset)[0]

  const priAtClimax = snapshots.find((s) => s.offsetDays === 0)?.precursorRiskIndex ?? null
  const priAtT7 = snapshots.find((s) => s.offsetDays === 7)?.precursorRiskIndex ?? null
  const warningOffset =
    [...snapshots]
      .filter((s) => s.offsetDays > 0 && s.offsetDays <= BASELINE_OFFSET)
      .sort((a, b) => b.offsetDays - a.offsetDays)
      .find((s) => (s.precursorRiskIndex ?? 0) >= 50)?.offsetDays ?? null

  return {
    id: event.id,
    name: event.name,
    climaxDate,
    snapshots,
    signalMatrix,
    signalSummary: {
      activeCount: activeMetrics.length,
      activeMetrics,
      firstComposite,
      warningAt: warningOffset != null ? `T-${warningOffset}` : "—",
      priAtT7,
      priAtClimax,
    },
  }
}

/**
 * @param {ReturnType<typeof buildPrecursorEnginePhase1Event>[]} events
 */
function buildCommonPatterns(events) {
  const n = events.length
  const metricStats = PRECURSOR_ENGINE_METRIC_KEYS.map((metric) => {
    const label = PRECURSOR_ENGINE_METRIC_LABELS[metric]
    const withSignal = events.filter((e) => e.signalMatrix.find((m) => m.metric === metric)?.anySignal)
    const offsets = withSignal
      .map((e) => {
        const row = e.signalMatrix.find((m) => m.metric === metric)
        const off = Number(String(row?.firstSignalAt).replace("T-", ""))
        return Number.isFinite(off) ? off : null
      })
      .filter((x) => x != null)
    const avgLead =
      offsets.length > 0 ? Math.round(offsets.reduce((a, b) => a + b, 0) / offsets.length) : null
    return {
      metric,
      label,
      signalRate: n > 0 ? Math.round((withSignal.length / n) * 100) : 0,
      eventCount: withSignal.length,
      avgLeadDays: avgLead,
    }
  }).sort((a, b) => b.signalRate - a.signalRate)

  const multiSignalByT7 = events.filter((e) => {
    const active = e.signalMatrix.filter((m) =>
      m.cells.some((c) => c.active && c.offsetDays >= 7),
    )
    return active.length >= 2
  }).length

  const avgPriT7 =
    events.length > 0
      ? Math.round(
          events.reduce((s, e) => s + (e.signalSummary.priAtT7 ?? 0), 0) / events.length,
        )
      : null

  return {
    metricStats,
    multiSignalByT7Rate: n > 0 ? Math.round((multiSignalByT7 / n) * 100) : 0,
    avgPrecursorRiskAtT7: avgPriT7,
    insights: [
      `기준: climax(극점) · ${PRECURSOR_ENGINE_T_OFFSETS.map((d) => (d === 0 ? "T-0" : `T-${d}`)).join(" → ")}`,
      metricStats[0]
        ? `가장 빈번한 전조 지표: ${metricStats[0].label} (${metricStats[0].signalRate}% 이벤트)`
        : "전조 지표 패턴 수집 중",
      avgPriT7 != null ? `T-7 평균 Precursor Risk Index: ${avgPriT7}/100` : "",
      `${multiSignalByT7}건/${n}건 T-7 이전 복수 지표 동시 전조`,
      "MOVE = milestone 미수집 시 VIX 기반 검증용 근사",
    ].filter(Boolean),
  }
}

function buildEngineDesignDraft(patterns) {
  const top = patterns.metricStats[0]
  return {
    name: "Precursor Risk Engine (Phase 2 설계 초안)",
    objective: "패닉 매수가 아닌 패닉 발생 전 전조·경고 탐지",
    inputs: PRECURSOR_ENGINE_METRIC_KEYS.map((k) => PRECURSOR_ENGINE_METRIC_LABELS[k]),
    anchor: "실시간 기준일 대비 climax 추정 또는 rolling peak proxy",
    scoring: {
      id: "precursorRiskIndex",
      range: "0~100",
      note: "검증 전용 · getFinalScore·VIX V3·프로덕션 엔진과 분리",
      weights: "VIX 25% · CNN 20% · HY 20% · Put/Call 15% · MOVE 20%",
    },
    alertLadder: [
      { tier: "🟢 안정", range: "0~29", action: "모니터링만" },
      { tier: "🟡 관찰", range: "30~49", action: "전조 대시보드 표시" },
      { tier: "🟠 경계", range: "50~69", action: "복수 지표 확인 · T-7 룰 적용" },
      { tier: "🔴 긴급", range: "70+", action: "패닉 임박 경고 · 히스토리 climax 대비 검증" },
    ],
    rules: [
      `T-14 baseline 대비 Δ 임계: VIX +${DELTA_THRESHOLDS.vix} · CNN −${DELTA_THRESHOLDS.cnn} · HY +${DELTA_THRESHOLDS.highYield} · P/C +${DELTA_THRESHOLDS.putCall} · MOVE +${DELTA_THRESHOLDS.move}`,
      `절대 수준: VIX≥${LEVEL_THRESHOLDS.vix} · CNN≤${LEVEL_THRESHOLDS.cnn} · HY≥${LEVEL_THRESHOLDS.highYield} · P/C≥${LEVEL_THRESHOLDS.putCall} · MOVE≥${LEVEL_THRESHOLDS.move}`,
      "Δ 또는 절대 수준 중 하나 충족 시 해당 지표 전조 ON",
      top ? `역사 패턴: ${top.label} 선행 신호 비율 ${top.signalRate}% · 평균 ${top.avgLeadDays ?? "—"}일 전` : "",
      "Phase 2: live cycle history 일별 스냅샷 + climax proxy 자동 산출",
    ].filter(Boolean),
    constraints: [
      "getFinalScore / VIX V3 / 프로덕션 엔진 코드 변경 금지",
      "검증 페이지·별도 모듈에서만 Precursor Risk Index 사용",
    ],
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 */
export function buildPrecursorEnginePhase1Report(events) {
  const eventReports = events
    .filter((e) => PRECURSOR_ENGINE_PHASE1_IDS.includes(e.id))
    .map(buildPrecursorEnginePhase1Event)

  const dataTable = eventReports.flatMap((ev) =>
    ev.snapshots.map((snap) => ({
      eventId: ev.id,
      eventName: ev.name,
      climaxDate: ev.climaxDate,
      offsetLabel: snap.offsetLabel,
      offsetDays: snap.offsetDays,
      date: snap.date,
      vix: snap.vix,
      cnn: snap.cnn,
      highYield: snap.highYield,
      putCall: snap.putCall,
      move: snap.move,
      moveEstimated: snap.moveEstimated,
      precursorRiskIndex: snap.precursorRiskIndex,
      riskTier: snap.riskTier.label,
    })),
  )

  const commonPatterns = buildCommonPatterns(eventReports)
  const engineDraft = buildEngineDesignDraft(commonPatterns)

  return {
    label: PRECURSOR_ENGINE_PHASE1_LABEL,
    eventReports,
    dataTable,
    commonPatterns,
    engineDraft,
    notes: [
      PRECURSOR_ENGINE_PHASE1_NOTE,
      "getFinalScore·VIX V3·프로덕션 엔진 미변경.",
      "지표 = milestone 선형 보간 · MOVE 미수집 시 VIX 근사.",
    ],
  }
}

export function formatPhase1Cell(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—"
  return formatMetric(value, digits)
}
