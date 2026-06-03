import { buildProductionCandidateReport } from "./ydsProductionCandidateReport.js"
import { PANIC_PEAK_RANKING_IDS } from "./ydsPanicPeakRankingReport.js"
import {
  buildProductionCandidateEventRow,
  formatProductionCandidateStage,
  PRODUCTION_CANDIDATE_V3_ID,
  PRODUCTION_CANDIDATE_V3_LABEL,
  PRODUCTION_CANDIDATE_V3_NOTE,
  PRODUCTION_CANDIDATE_V3_STAGE_BANDS,
  resolveProductionCandidateStage,
} from "./ydsProductionCandidateV3.js"
import { VIX_EXPERIMENT_V3_ANCHORS } from "./ydsVixSensitivityLab.js"

/** @deprecated alias */
export const ENGINE_CANDIDATE_V3_ID = PRODUCTION_CANDIDATE_V3_ID
/** @deprecated alias */
export const ENGINE_CANDIDATE_V3_LABEL = `${PRODUCTION_CANDIDATE_V3_LABEL} (Engine #1 승격)`
/** @deprecated alias */
export const ENGINE_CANDIDATE_V3_NOTE = PRODUCTION_CANDIDATE_V3_NOTE

export {
  PRODUCTION_CANDIDATE_V3_STAGE_BANDS as ENGINE_CANDIDATE_V3_STAGE_BANDS,
  resolveProductionCandidateStage as resolveCandidateV3Stage,
  formatProductionCandidateStage as formatCandidateStage,
  buildProductionCandidateEventRow as buildEngineCandidateV3EventRow,
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 */
export function buildEngineCandidateV3Report(events) {
  const report = buildProductionCandidateReport(events)
  const rows = report.panicRows
    .filter((r) => PANIC_PEAK_RANKING_IDS.includes(r.id))
    .map((r) => ({
      id: r.id,
      name: r.name,
      currentYds: r.currentYds,
      candidateYds: r.v3Yds,
      delta: r.delta,
      peakMilestone: r.peakMilestone,
      peakDate: r.peakDate,
      currentStage: r.currentStage,
      candidateStage: r.v3Stage,
      currentStageLabel: r.currentStageLabel,
      candidateStageLabel: r.v3StageLabel,
      stageChanged: r.stageChanged,
      ydsComputable: r.ydsComputable,
    }))
    .sort((a, b) => (b.candidateYds ?? 0) - (a.candidateYds ?? 0))

  const covid = rows.find((r) => r.id === "panic-2020-covid")
  const tariff = rows.find((r) => r.id === "panic-2025-tariff-shock")
  const yen = rows.find((r) => r.id === "panic-2024-yen-carry")
  const tightening = rows.find((r) => r.id === "panic-2022-tightening")
  const svb = rows.find((r) => r.id === "panic-2023-svb")

  return {
    rows,
    stageBands: report.stageBands,
    finalValidation: {
      historicPanicSeparated: report.judgments.historicPanicSeparated,
      covidTariffGap: {
        pass: (covid?.candidateYds ?? 0) - (tariff?.candidateYds ?? 0) >= 10,
        gap: (covid?.candidateYds ?? 0) - (tariff?.candidateYds ?? 0),
        detail: `코로나−관세 ${(covid?.candidateYds ?? 0) - (tariff?.candidateYds ?? 0)}p (기준 ≥10p)`,
      },
      yenPosition: {
        pass: (yen?.candidateYds ?? 100) < 80,
        detail: `엔캐리 YDS ${yen?.candidateYds} → ${yen?.candidateStageLabel}`,
      },
      moderateEvents: {
        pass: (tightening?.candidateYds ?? 100) < 80 && (svb?.candidateYds ?? 100) < 80,
        detail: `긴축 ${tightening?.candidateYds} · SVB ${svb?.candidateYds} — 80 미만`,
      },
      naturalOrder: {
        pass: report.judgments.philosophyAligned.pass,
        detail: "리먼 > 코로나 > 관세 > 엔캐리 (V3 peak YDS)",
      },
    },
    verdict: {
      id:
        report.verdict.id === "A"
          ? "adopt"
          : report.verdict.id === "C"
            ? "reject"
            : "needs_validation",
      label: report.verdict.label.replace(/^A\. |^B\. |^C\. /, ""),
      emoji: report.verdict.emoji,
      summary: report.verdict.summary,
    },
    summary: {
      compared: rows.length,
      stageChangedCount: rows.filter((r) => r.stageChanged).length,
      candidateAnchors: VIX_EXPERIMENT_V3_ANCHORS.filter((a) => a.vix >= 40),
    },
    notes: report.notes,
  }
}

export { VIX_EXPERIMENT_V3_ANCHORS }
