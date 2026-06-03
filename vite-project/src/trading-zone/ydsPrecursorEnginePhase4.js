import {
  buildPrecursorClassificationMetrics,
  buildPrecursorEnginePhase2Event,
  formatPrecursorConfusionMatrix,
  PRECURSOR_ENGINE_PHASE2_BASELINE_OFFSET,
  PRECURSOR_ENGINE_PHASE2_LEAD_MAX,
  PRECURSOR_ENGINE_PHASE2_LEAD_MIN,
  PRECURSOR_ENGINE_PHASE2_WARN_PRI_A,
  PRECURSOR_ENGINE_PHASE2_WARN_PRI_B,
} from "./ydsPrecursorEnginePhase2.js"
import {
  buildPhase3ValidationDataset,
  PRECURSOR_PHASE3_PANIC_IDS,
} from "./ydsPrecursorPhase3EventCatalog.js"

export const PRECURSOR_ENGINE_PHASE4_LABEL = "YDS Precursor Engine — Phase 4 (Missed Event Analysis)"

export const FAILURE_REASON_CODES = {
  cnn: { id: "A", label: "CNN 반응 부족" },
  highYield: { id: "B", label: "HY 반응 부족" },
  move: { id: "C", label: "MOVE 반응 부족" },
  vix: { id: "D", label: "VIX 선행성 부족" },
  putCall: { id: "E", label: "Put/Call 반응 부족" },
  data: { id: "F", label: "데이터 부족" },
}

/** @type {Record<string, "critical" | "major" | "minor">} */
export const PANIC_SEVERITY_BY_ID = {
  "panic-2008-lehman": "critical",
  "panic-2020-covid": "critical",
  "panic-2025-tariff-shock": "major",
  "interest-2016-brexit": "major",
  "panic-2011-us-downgrade": "major",
  "panic-2022-tightening": "major",
  "panic-2022-ukraine": "major",
  "panic-2018-q4": "major",
  "panic-2015-china-deval": "major",
  "interest-2018-trade-war": "major",
  "panic-2024-yen-carry": "major",
  "panic-2023-svb": "major",
  "overheated-2000-dotcom": "major",
  "panic-2010-flash": "minor",
  "panic-2019-repo": "minor",
}

export const SEVERITY_LABELS = {
  critical: "Critical (리먼/코로나급)",
  major: "Major (관세/브렉시트급)",
  minor: "Minor (플래시/Repo급)",
}

const PRI_A_STRESS = {
  cnn: { stressUp: (b, c) => b - c, cap: 18 },
  highYield: { stressUp: (b, c) => c - b, cap: 0.55 },
  move: { stressUp: (b, c) => c - b, cap: 14 },
  bofa: { stressUp: (b, c) => b - c, cap: 1.2 },
}

const VIX_CAP = 32
const PC_CAP = 0.32
const PC_BASE = 0.78
const VIX_BASE = 14
const WEAK_RATIO = 0.35

/**
 * @param {ReturnType<typeof buildPrecursorEnginePhase2Event>} report
 */
function getLeadContext(report) {
  const baseline =
    report.timeSeries.find((s) => s.offsetDays === PRECURSOR_ENGINE_PHASE2_BASELINE_OFFSET) ??
    null
  const lead = report.timeSeries.filter((s) => s.inLeadWindow)
  const allLead = report.timeSeries.filter((s) => s.offsetDays >= PRECURSOR_ENGINE_PHASE2_LEAD_MIN)

  let peakA = null
  let peakB = null
  for (const s of lead) {
    if (s.priA != null && (peakA == null || s.priA > peakA.priA)) peakA = s
    if (s.priB != null && (peakB == null || s.priB > peakB.priB)) peakB = s
  }

  const firstA = [...lead].filter((s) => s.priAAlert).sort((a, b) => b.offsetDays - a.offsetDays)[0]
  const firstB = [...lead].filter((s) => s.priBAlert).sort((a, b) => b.offsetDays - a.offsetDays)[0]
  const firstAny = [...allLead]
    .filter((s) => s.priAAlert || s.priBAlert)
    .sort((a, b) => b.offsetDays - a.offsetDays)[0]

  return { baseline, lead, peakA, peakB, firstA, firstB, firstAny }
}

/**
 * @param {ReturnType<typeof getLeadContext>} ctx
 */
function diagnoseFailureReasons(ctx) {
  const { baseline, peakA, peakB } = ctx
  /** @type {string[]} */
  const codes = []

  if (!baseline || !peakA) {
    codes.push("data")
    return { codes, labels: codes.map((c) => FAILURE_REASON_CODES[c]?.label ?? c), detail: "선행 윈도우 스냅샷 부족" }
  }

  let missingCount = 0
  for (const key of ["cnn", "highYield", "move", "bofa"]) {
    const b = baseline[key]
    const c = peakA[key]
    if (!Number.isFinite(b) || !Number.isFinite(c)) {
      missingCount += 1
      continue
    }
    const delta = PRI_A_STRESS[key].stressUp(b, c)
    const ratio = Math.max(0, delta) / PRI_A_STRESS[key].cap
    if (ratio < WEAK_RATIO) codes.push(key)
  }
  if (missingCount >= 2) codes.push("data")

  const snap = peakA
  if (Number.isFinite(snap.vix) && Number.isFinite(baseline.vix)) {
    const vixRise = snap.vix - baseline.vix
    if (vixRise < VIX_CAP * WEAK_RATIO) codes.push("vix")
  } else if (!Number.isFinite(snap.vix)) {
    codes.push("vix")
  }

  if (Number.isFinite(snap.putCall) && Number.isFinite(baseline.putCall)) {
    const pcRise = snap.putCall - baseline.putCall
    if (pcRise < PC_CAP * WEAK_RATIO) codes.push("putCall")
  } else if (!Number.isFinite(snap.putCall)) {
    codes.push("putCall")
  }

  if (peakB && Number.isFinite(peakB.priB) && peakB.priB < PRECURSOR_ENGINE_PHASE2_WARN_PRI_B) {
    if (!codes.includes("vix") && Number.isFinite(peakB.vix) && peakB.vix < VIX_BASE + VIX_CAP * WEAK_RATIO) {
      codes.push("vix")
    }
    if (
      !codes.includes("putCall") &&
      Number.isFinite(peakB.putCall) &&
      peakB.putCall < PC_BASE + PC_CAP * WEAK_RATIO
    ) {
      codes.push("putCall")
    }
  }

  const unique = [...new Set(codes)]
  if (unique.length === 0) unique.push("cnn")

  return {
    codes: unique,
    labels: unique.map((c) => FAILURE_REASON_CODES[c]?.label ?? c),
    detail: unique.map((c) => FAILURE_REASON_CODES[c]?.id).join(", "),
  }
}

/**
 * @param {ReturnType<typeof buildPrecursorEnginePhase2Event>} report
 */
function buildPanicListItem(report) {
  const ctx = getLeadContext(report)
  const detectedPriA = report.outcome.hitPriA
  const detectedPriB = report.outcome.hitPriB
  const detected = detectedPriA || detectedPriB
  const severity = PANIC_SEVERITY_BY_ID[report.id] ?? "major"

  return {
    id: report.id,
    name: report.name,
    climaxDate: report.climaxDate,
    severity,
    severityLabel: SEVERITY_LABELS[severity],
    detectedPriA,
    detectedPriB,
    detected,
    statusLabel: detected ? "감지 성공" : "감지 실패",
    statusClass: detected ? "success" : "failure",
    firstWarningAny: ctx.firstAny?.offsetLabel ?? "—",
    maxPriAInLead: report.outcome.maxPriAInLead,
    maxPriBInLead: report.outcome.maxPriBInLead,
  }
}

/**
 * @param {ReturnType<typeof buildPrecursorEnginePhase2Event>} report
 */
function buildFnRow(report) {
  const ctx = getLeadContext(report)
  const diagnosis = diagnoseFailureReasons(ctx)
  const severity = PANIC_SEVERITY_BY_ID[report.id] ?? "major"

  return {
    id: report.id,
    name: report.name,
    climaxDate: report.climaxDate,
    severity,
    severityLabel: SEVERITY_LABELS[severity],
    firstWarning: ctx.firstAny?.offsetLabel ?? "미발생",
    firstWarningPriA: ctx.firstA?.offsetLabel ?? "—",
    firstWarningPriB: ctx.firstB?.offsetLabel ?? "—",
    maxPriA: report.outcome.maxPriAInLead ?? "—",
    maxPriB: report.outcome.maxPriBInLead ?? "—",
    failureReasons: diagnosis.labels.join(" · "),
    failureCodes: diagnosis.codes,
    missedPriA: !report.outcome.hitPriA,
    missedPriB: !report.outcome.hitPriB,
  }
}

/**
 * @param {ReturnType<typeof buildFnRow>[]} fnRows
 */
function buildFailureReasonBreakdown(fnRows) {
  const counts = Object.keys(FAILURE_REASON_CODES).map((code) => ({
    code,
    id: FAILURE_REASON_CODES[code].id,
    label: FAILURE_REASON_CODES[code].label,
    count: 0,
  }))

  for (const row of fnRows) {
    for (const code of row.failureCodes) {
      const entry = counts.find((c) => c.code === code)
      if (entry) entry.count += 1
    }
  }

  return counts.sort((a, b) => b.count - a.count)
}

/**
 * @param {ReturnType<typeof buildFnRow>[]} fnRows
 * @param {ReturnType<typeof buildPrecursorClassificationMetrics>} metricsA
 */
function buildImprovementPriorities(fnRows, metricsA) {
  const breakdown = buildFailureReasonBreakdown(fnRows)
  const severityCounts = { critical: 0, major: 0, minor: 0 }
  for (const row of fnRows) severityCounts[row.severity] += 1

  /** @type {string[]} */
  const priorities = []

  const top = breakdown.filter((b) => b.count > 0).slice(0, 3)
  if (top.length) {
    priorities.push(
      `1. 지표 민감도: ${top.map((t) => `${t.label}(${t.count}건)`).join(" · ")} — PRI-A 가중·임계 재조정 검토`,
    )
  }
  if (severityCounts.critical > 0) {
    priorities.push(
      `2. Critical FN ${severityCounts.critical}건 — 리먼/코로나급은 CNN·HY 외 VIX 선행 복합 룰 검토`,
    )
  }
  if ((metricsA.recall ?? 0) < 70) {
    priorities.push("3. Recall 70% 미만 — 선행 윈도우 T-21~T-28 확대 또는 PRI-A 경고 임계 25 하향 시뮬레이션")
  }
  if ((metricsA.falsePositiveRate ?? 0) > 10) {
    priorities.push("4. FPR 상승 리스크 — 임계 완화 시 비패닉 calm 앵커 오경보 재검증 필수")
  } else {
    priorities.push("4. FPR 양호 — Recall 개선 우선(오경보 최소화 전제)")
  }
  priorities.push("5. MOVE 실데이터·일별 스냅샷 연동 시 FN 원인 F(데이터 부족) 감소 기대")

  return priorities
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 */
export function buildPrecursorEnginePhase4Report(events) {
  const dataset = buildPhase3ValidationDataset(events)
  const panicReports = dataset
    .filter((e) => PRECURSOR_PHASE3_PANIC_IDS.includes(e.id))
    .map((e) => buildPrecursorEnginePhase2Event(e, { panicIds: PRECURSOR_PHASE3_PANIC_IDS }))

  const allPanicItems = panicReports.map(buildPanicListItem)
  const successItems = allPanicItems.filter((p) => p.detected)
  const failureItems = allPanicItems.filter((p) => !p.detected)

  const fnPriA = panicReports.filter((r) => !r.outcome.hitPriA)
  const fnPriB = panicReports.filter((r) => !r.outcome.hitPriB)
  const fnCombined = panicReports.filter((r) => !r.outcome.hitPriA && !r.outcome.hitPriB)

  const fnTable = fnCombined.map(buildFnRow)
  const fnTablePriA = fnPriA.map(buildFnRow)

  const nonPanicReports = dataset
    .filter((e) => !PRECURSOR_PHASE3_PANIC_IDS.includes(e.id))
    .map((e) => buildPrecursorEnginePhase2Event(e, { panicIds: PRECURSOR_PHASE3_PANIC_IDS }))

  const metricsPriAFull = buildPrecursorClassificationMetrics(
    [...panicReports, ...nonPanicReports],
    "priA",
    PRECURSOR_ENGINE_PHASE2_WARN_PRI_A,
  )
  const metricsPriBFull = buildPrecursorClassificationMetrics(
    [...panicReports, ...nonPanicReports],
    "priB",
    PRECURSOR_ENGINE_PHASE2_WARN_PRI_B,
  )

  const failureBreakdown = buildFailureReasonBreakdown(fnTablePriA.length ? fnTablePriA : fnTable)
  const severityBreakdown = {
    critical: fnTable.filter((r) => r.severity === "critical").length,
    major: fnTable.filter((r) => r.severity === "major").length,
    minor: fnTable.filter((r) => r.severity === "minor").length,
  }

  return {
    label: PRECURSOR_ENGINE_PHASE4_LABEL,
    panicCount: panicReports.length,
    leadWindow: `T-${PRECURSOR_ENGINE_PHASE2_LEAD_MAX}~T-${PRECURSOR_ENGINE_PHASE2_LEAD_MIN}`,
    warnThresholdA: PRECURSOR_ENGINE_PHASE2_WARN_PRI_A,
    warnThresholdB: PRECURSOR_ENGINE_PHASE2_WARN_PRI_B,
    panicList: {
      all: allPanicItems,
      success: successItems,
      failure: failureItems,
    },
    fn: {
      combined: fnTable,
      priAOnly: fnTablePriA,
      priACount: fnPriA.length,
      priBCount: fnPriB.length,
      combinedCount: fnCombined.length,
    },
    failureReasonBreakdown: failureBreakdown,
    severityBreakdown,
    finalReport: {
      recallPriA: metricsPriAFull.recall,
      recallPriB: metricsPriBFull.recall,
      fprPriA: metricsPriAFull.falsePositiveRate,
      fprPriB: metricsPriBFull.falsePositiveRate,
      precisionPriA: metricsPriAFull.precision,
      precisionPriB: metricsPriBFull.precision,
      confusionPriA: formatPrecursorConfusionMatrix(metricsPriAFull),
      confusionPriB: formatPrecursorConfusionMatrix(metricsPriBFull),
      fnComposition: {
        priA: `${fnPriA.length}/${panicReports.length}`,
        priB: `${fnPriB.length}/${panicReports.length}`,
        bothMissed: `${fnCombined.length}/${panicReports.length}`,
        bySeverity: severityBreakdown,
      },
      improvementPriorities: buildImprovementPriorities(
        fnTablePriA.length ? fnTablePriA : fnTable,
        metricsPriAFull,
      ),
    },
    notes: [
      "검증 전용 · getFinalScore·VIX V3·프로덕션 엔진 미변경",
      `감지 성공 = 선행 윈도우 내 PRI-A≥${PRECURSOR_ENGINE_PHASE2_WARN_PRI_A} 또는 PRI-B≥${PRECURSOR_ENGINE_PHASE2_WARN_PRI_B}`,
      "FN 테이블 기본 = PRI-A·PRI-B 모두 미감지 · PRI-A 단독 FN은 별도 집계",
      "실패 원인 = T-28 대비 선행 구간 피크 시점 지표 기여도 분석",
    ],
  }
}
