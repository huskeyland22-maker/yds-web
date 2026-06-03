import { buildPrecursorEnginePhase6Report } from "./ydsPrecursorEnginePhase6.js"
import { buildPatternHistoryStore } from "./ydsPrecursorEnginePhase9.js"
import { buildLiveRegimeDetection } from "./ydsPrecursorEnginePhase10.js"
import { buildPrecursorEnginePhase11Report } from "./ydsPrecursorEnginePhase11.js"
import { formatMetric } from "./ydsHistoricalEventTypes.js"

export const PRECURSOR_DASHBOARD_BETA_LABEL = "YDS Market Dashboard (Beta)"

/**
 * 검증 Phase 0~11 산출만 집약 · 엔진 로직 변경 없음
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null; extraRows?: object[] }} [options]
 */
export function buildPrecursorDashboardBetaReport(events, options = {}) {
  const store = buildPatternHistoryStore(events, options)
  const last = store.history[store.history.length - 1] ?? null
  const live = buildLiveRegimeDetection(store.history)
  const phase6 = buildPrecursorEnginePhase6Report(events, options)
  const phase11 = buildPrecursorEnginePhase11Report(events, options)

  const topPattern = phase6.top3[0] ?? null
  const regime = live.regime

  const yds = last?.ydsScore ?? null
  const priA = last?.priA ?? phase6.inputs.priA ?? null
  const priB = last?.priB ?? phase6.inputs.priB ?? null

  return {
    label: PRECURSOR_DASHBOARD_BETA_LABEL,
    asOf: phase6.inputs.asOf ?? last?.date ?? null,
    headline: regime?.label ? `${regime.emoji} ${regime.label}` : "—",
    cards: {
      yds: {
        key: "yds",
        title: "YDS",
        value: yds,
        display: formatMetric(yds, 0),
        sub: "통합 패닉 지수",
      },
      priA: {
        key: "priA",
        title: "PRI-A",
        value: priA,
        display: formatMetric(priA, 0),
        sub: "조기경보 (CNN·HY·MOVE·BofA)",
      },
      priB: {
        key: "priB",
        title: "PRI-B",
        value: priB,
        display: formatMetric(priB, 0),
        sub: "충격확인 (VIX·Put/Call)",
      },
      regime: {
        key: "regime",
        title: "현재 국면",
        regimeId: regime?.id ?? "unknown",
        emoji: regime?.emoji ?? "⚪",
        label: regime?.label ?? "—",
        durationLabel: phase11.current?.durationLabel ?? "—",
        reason: regime?.reason ?? "",
      },
      pattern: {
        key: "pattern",
        title: "우세 패턴",
        patternId: topPattern?.patternId ?? null,
        label: topPattern?.patternLabel ?? "—",
        similarity: topPattern?.similarity ?? null,
        display:
          topPattern?.similarity != null
            ? `${topPattern.patternLabel} ${formatMetric(topPattern.similarity, 0)}%`
            : "—",
      },
      interpretation: {
        key: "interpretation",
        title: "시장 해석",
        text: phase6.interpretation ?? "데이터를 불러올 수 없습니다.",
        radarAlert: phase6.radarAlert ?? null,
      },
    },
    meta: {
      seriesLength: store.seriesLength ?? store.history.length,
      historyPoints: store.history.length,
      dataSource: "Phase 9 시계열 · Phase 10 국면 · Phase 6 패턴",
    },
    notes: [
      "Beta · Precursor Phase 0~11 읽기 전용 집약",
      "프로덕션 getFinalScore·VIX V3 미변경",
      "상세 검증은 패닉지수 검증 페이지 참고",
    ],
  }
}
