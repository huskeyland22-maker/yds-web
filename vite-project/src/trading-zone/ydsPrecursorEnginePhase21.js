import {
  buildPrecursorEnginePhase2Event,
  PRECURSOR_ENGINE_PHASE2_LEAD_MAX,
  PRECURSOR_ENGINE_PHASE2_LEAD_MIN,
  PRECURSOR_ENGINE_PHASE2_WARN_PRI_A,
  PRECURSOR_ENGINE_PHASE2_WARN_PRI_B,
} from "./ydsPrecursorEnginePhase2.js"
import {
  buildPrecursorEnginePhase4Report,
  PANIC_SEVERITY_BY_ID,
  SEVERITY_LABELS,
} from "./ydsPrecursorEnginePhase4.js"
import { buildPrecursorEnginePhase10Report } from "./ydsPrecursorEnginePhase10.js"
import {
  buildPrecursorEnginePhase20Report,
  buildTimeMachineEventReport,
  PANIC_TIME_MACHINE_EVENTS,
} from "./ydsPrecursorEnginePhase20.js"
import {
  buildPhase3ValidationDataset,
  PRECURSOR_PHASE3_PANIC_IDS,
} from "./ydsPrecursorPhase3EventCatalog.js"
import {
  buildRadarPatternCentroids,
} from "./ydsPrecursorEnginePhase6.js"
import {
  PATTERN_LABELS,
  resolveEventGroundTruthPattern,
} from "./ydsPrecursorEnginePhase7.js"
import { formatMetric } from "./ydsHistoricalEventTypes.js"

export const PRECURSOR_ENGINE_PHASE21_LABEL =
  "YDS Precursor Engine — Phase 21 (Early Warning Scorecard)"

export const EARLY_WARNING_GRADES = [
  { id: "S", label: "S", description: "21일+ 선행 · 탐지 우수", tone: "gold" },
  { id: "A", label: "A", description: "14~20일 선행", tone: "good" },
  { id: "B", label: "B", description: "7~13일 선행", tone: "mid" },
  { id: "C", label: "C", description: "7일 미만 또는 미탐지", tone: "low" },
]

const SCORECARD_PATTERN_IDS = ["lehman", "covid", "tariff", "svb"]

/**
 * @param {number | null} leadDays
 * @param {boolean} detected
 */
export function resolveEarlyWarningGrade(leadDays, detected) {
  if (!detected || leadDays == null || !Number.isFinite(leadDays)) {
    return EARLY_WARNING_GRADES.find((g) => g.id === "C")
  }
  if (leadDays >= 21) return EARLY_WARNING_GRADES.find((g) => g.id === "S")
  if (leadDays >= 14) return EARLY_WARNING_GRADES.find((g) => g.id === "A")
  if (leadDays >= 7) return EARLY_WARNING_GRADES.find((g) => g.id === "B")
  return EARLY_WARNING_GRADES.find((g) => g.id === "C")
}

/**
 * @param {number | null} avgLead
 * @param {number | null} successRate
 * @param {number | null} maxLead
 */
export function resolveFinalScorecardGrade(avgLead, successRate, maxLead) {
  const rate = successRate ?? 0
  const avg = avgLead ?? 0
  const max = maxLead ?? 0
  if (rate >= 85 && avg >= 18 && max >= 21) return "S"
  if (rate >= 70 && avg >= 14) return "A"
  if (rate >= 50 && avg >= 7) return "B"
  return "C"
}

/**
 * @param {ReturnType<typeof buildPrecursorEnginePhase2Event>} phase2
 */
function findFirstCompositeWarning(phase2) {
  const lead = phase2.timeSeries.filter((s) => s.inLeadWindow)
  const firstA = [...lead].filter((s) => s.priAAlert).sort((a, b) => b.offsetDays - a.offsetDays)[0]
  const firstB = [...lead].filter((s) => s.priBAlert).sort((a, b) => b.offsetDays - a.offsetDays)[0]

  /** @type {{ type: string; days: number; offsetLabel: string; score: number | null }[]} */
  const candidates = []
  if (firstA) {
    candidates.push({
      type: "PRI-A",
      days: firstA.offsetDays,
      offsetLabel: firstA.offsetLabel,
      score: firstA.priA,
    })
  }
  if (firstB) {
    candidates.push({
      type: "PRI-B",
      days: firstB.offsetDays,
      offsetLabel: firstB.offsetLabel,
      score: firstB.priB,
    })
  }
  candidates.sort((a, b) => b.days - a.days)
  return candidates[0] ?? null
}

/**
 * @param {ReturnType<typeof buildPrecursorEnginePhase2Event>} phase2
 * @param {ReturnType<typeof buildPrecursorEnginePhase4Report>["panicList"]["all"][number]} phase4Item
 * @param {ReturnType<typeof buildTimeMachineEventReport>["finalEvaluation"] | null} timeMachineEval
 * @param {{ passed?: boolean; monotonic?: boolean } | null} regimeReplay
 * @param {boolean} isTimeMachine
 */
function buildEventScorecardRow(phase2, phase4Item, timeMachineEval, regimeReplay, isTimeMachine) {
  const patternId = resolveEventGroundTruthPattern(phase2.id)
  const patternLabel =
    patternId && PATTERN_LABELS[patternId] ? PATTERN_LABELS[patternId] : patternId ?? "—"
  const severity = PANIC_SEVERITY_BY_ID[phase2.id] ?? "major"

  const composite = findFirstCompositeWarning(phase2)
  const ydsEval = timeMachineEval?.yds ?? null

  /** @type {{ type: string; days: number; offsetLabel: string }[]} */
  const allWarnings = []
  if (composite) {
    allWarnings.push({
      type: composite.type,
      days: composite.days,
      offsetLabel: composite.offsetLabel,
    })
  }
  if (ydsEval?.daysBefore != null && ydsEval.inLeadWindow) {
    allWarnings.push({
      type: "YDS",
      days: ydsEval.daysBefore,
      offsetLabel: ydsEval.offsetLabel,
    })
  }
  allWarnings.sort((a, b) => b.days - a.days)
  const firstWarning = allWarnings[0] ?? null

  const leadDays = firstWarning?.days ?? null
  const detected = phase4Item.detected
  const grade = resolveEarlyWarningGrade(leadDays, detected)

  return {
    eventId: phase2.id,
    name: phase2.name,
    climaxDate: phase2.climaxDate,
    isTimeMachine,
    patternId,
    patternLabel,
    severity,
    severityLabel: SEVERITY_LABELS[severity],
    firstWarning: {
      type: firstWarning?.type ?? "—",
      offsetLabel: firstWarning?.offsetLabel ?? "—",
      daysBefore: leadDays,
    },
    firstPriA: {
      offsetLabel: phase2.firstWarning.priA,
      daysBefore: phase2.firstWarning.priADays,
      hit: phase4Item.detectedPriA,
      threshold: PRECURSOR_ENGINE_PHASE2_WARN_PRI_A,
    },
    firstPriB: {
      offsetLabel: phase2.firstWarning.priB,
      daysBefore: phase2.firstWarning.priBDays,
      hit: phase4Item.detectedPriB,
      threshold: PRECURSOR_ENGINE_PHASE2_WARN_PRI_B,
    },
    firstYds: ydsEval
      ? {
          offsetLabel: ydsEval.offsetLabel,
          daysBefore: ydsEval.daysBefore,
          score: ydsEval.score,
          inLeadWindow: ydsEval.inLeadWindow,
        }
      : null,
    leadDays,
    detected,
    detectedLabel: detected ? "성공" : "실패",
    grade: grade?.id ?? "C",
    gradeLabel: grade?.label ?? "C",
    gradeDescription: grade?.description ?? "",
    regimeReplayPassed: regimeReplay?.passed ?? null,
    maxPriAInLead: phase2.outcome.maxPriAInLead,
    maxPriBInLead: phase2.outcome.maxPriBInLead,
  }
}

/**
 * @param {ReturnType<typeof buildEventScorecardRow>[]} rows
 */
function averageLeadDays(rows, filterFn = () => true) {
  const eligible = rows.filter((r) => filterFn(r) && r.detected && r.leadDays != null)
  if (eligible.length === 0) return null
  const sum = eligible.reduce((a, r) => a + (r.leadDays ?? 0), 0)
  return Math.round((sum / eligible.length) * 10) / 10
}

/**
 * @param {ReturnType<typeof buildEventScorecardRow>[]} rows
 * @param {string} patternId
 */
function patternAverageLead(rows, patternId) {
  return averageLeadDays(rows, (r) => r.patternId === patternId)
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 */
export function buildPrecursorEnginePhase21Report(events) {
  const phase4 = buildPrecursorEnginePhase4Report(events)
  const phase10 = buildPrecursorEnginePhase10Report(events)
  const phase20 = buildPrecursorEnginePhase20Report(events)

  const dataset = buildPhase3ValidationDataset(events)
  const phase4ById = new Map(phase4.panicList.all.map((p) => [p.id, p]))

  const timeMachineIds = new Set(PANIC_TIME_MACHINE_EVENTS.map((e) => e.eventId))
  const timeMachineEvalById = new Map(
    phase20.events
      .filter((e) => e.available && e.report)
      .map((e) => [e.eventId, e.report.finalEvaluation]),
  )

  const replayByEventId = new Map(
    (phase10.replays ?? [])
      .filter((r) => r.found)
      .map((r) => [r.eventId, r.validation]),
  )

  const eventReports = dataset
    .filter((e) => PRECURSOR_PHASE3_PANIC_IDS.includes(e.id))
    .map((e) => buildPrecursorEnginePhase2Event(e, { panicIds: PRECURSOR_PHASE3_PANIC_IDS }))

  const eventScorecard = eventReports
    .map((phase2) => {
      const phase4Item = phase4ById.get(phase2.id)
      if (!phase4Item) return null
      return buildEventScorecardRow(
        phase2,
        phase4Item,
        timeMachineEvalById.get(phase2.id) ?? null,
        replayByEventId.get(phase2.id) ?? null,
        timeMachineIds.has(phase2.id),
      )
    })
    .filter(Boolean)
    .sort((a, b) => (b.leadDays ?? -1) - (a.leadDays ?? -1))

  const timeMachineScorecard = eventScorecard.filter((r) => r.isTimeMachine)

  const detectedRows = eventScorecard.filter((r) => r.detected)
  const avgLeadOverall = averageLeadDays(eventScorecard)
  const avgLeadTimeMachine = averageLeadDays(timeMachineScorecard)
  const maxLead = detectedRows.reduce((m, r) => Math.max(m, r.leadDays ?? 0), 0) || null
  const successCount = eventScorecard.filter((r) => r.detected).length
  const successRate =
    eventScorecard.length > 0
      ? Math.round((successCount / eventScorecard.length) * 1000) / 10
      : null

  const patternAverages = SCORECARD_PATTERN_IDS.map((patternId) => ({
    patternId,
    label: PATTERN_LABELS[patternId] ?? patternId,
    avgLeadDays: patternAverageLead(eventScorecard, patternId),
    eventCount: eventScorecard.filter((r) => r.patternId === patternId).length,
    detectedCount: eventScorecard.filter((r) => r.patternId === patternId && r.detected).length,
  }))

  const gradeDistribution = EARLY_WARNING_GRADES.map((g) => ({
    ...g,
    count: eventScorecard.filter((r) => r.grade === g.id).length,
  }))

  const bestCases = [...detectedRows]
    .sort((a, b) => (b.leadDays ?? 0) - (a.leadDays ?? 0))
    .slice(0, 5)

  const worstCases = [...eventScorecard]
    .sort((a, b) => {
      if (a.detected !== b.detected) return a.detected ? 1 : -1
      return (a.leadDays ?? 0) - (b.leadDays ?? 0)
    })
    .slice(0, 5)

  const finalGradeId = resolveFinalScorecardGrade(avgLeadOverall, successRate, maxLead)
  const finalGrade = EARLY_WARNING_GRADES.find((g) => g.id === finalGradeId) ?? EARLY_WARNING_GRADES[3]

  return {
    meta: {
      label: PRECURSOR_ENGINE_PHASE21_LABEL,
      panicCount: eventScorecard.length,
      timeMachineCount: timeMachineScorecard.length,
      leadWindow: `T-${PRECURSOR_ENGINE_PHASE2_LEAD_MAX}~T-${PRECURSOR_ENGINE_PHASE2_LEAD_MIN}`,
      warnThresholdA: PRECURSOR_ENGINE_PHASE2_WARN_PRI_A,
      warnThresholdB: PRECURSOR_ENGINE_PHASE2_WARN_PRI_B,
    },
    eventScorecard,
    timeMachineScorecard,
    patternAverages,
    gradeDistribution,
    bestCases,
    worstCases,
    finalScorecard: {
      avgLeadDays: avgLeadOverall,
      avgLeadDaysTimeMachine: avgLeadTimeMachine,
      maxLeadDays: maxLead,
      successCount,
      successRate,
      totalCount: eventScorecard.length,
      grade: finalGradeId,
      gradeLabel: finalGrade.label,
      gradeDescription: finalGrade.description,
    },
    phase4Summary: {
      success: phase4.panicList.success.length,
      failure: phase4.panicList.failure.length,
      recallPriA: phase4.finalReport?.recallPriA ?? null,
      recallPriB: phase4.finalReport?.recallPriB ?? null,
    },
    notes: [
      "Phase 2·4·10·20 읽기 전용 · Phase 0~20 엔진·PRI·getFinalScore 미수정",
      "탐지 성공 = 선행 윈도우 내 PRI-A≥30 또는 PRI-B≥30 (Phase 4 기준)",
      "선행일수 = YDS·PRI-A·PRI-B 중 가장 이른 경고 (Phase 20 YDS는 타임머신 10건)",
      "등급 S/A/B/C = 선행일수 + 탐지 성공 여부 기반 (Phase 21 전용)",
    ],
  }
}

/** Phase 20 타임머신 YDS 보강용 — Phase 21 내부 일괄 빌드 */
export function buildTimeMachineEvaluations(events) {
  const dataset = buildPhase3ValidationDataset(events)
  const eventReports = dataset.map((e) =>
    buildPrecursorEnginePhase2Event(e, { panicIds: PRECURSOR_PHASE3_PANIC_IDS }),
  )
  const centroids = buildRadarPatternCentroids(eventReports)
  const byId = new Map(dataset.map((e) => [e.id, e]))

  return PANIC_TIME_MACHINE_EVENTS.map((spec) => {
    const event = byId.get(spec.eventId)
    if (!event) return { ...spec, available: false, finalEvaluation: null }
    const report = buildTimeMachineEventReport(event, centroids)
    return {
      ...spec,
      available: true,
      finalEvaluation: report.finalEvaluation,
    }
  })
}

export function formatScorecardDays(value) {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${formatMetric(value)}일`
}

export function formatScorecardRate(value) {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${formatMetric(value)}%`
}
