import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import {
  computeYdsScore,
  formatMetric,
  resolveYdsStage,
} from "./ydsHistoricalEventTypes.js"

/** 패닉 이벤트 비교 검증 표본 (최소 5건 · 엔진 튜닝 전 확대 단계) */
export const PANIC_VALIDATION_COMPARE_IDS = [
  "panic-2011-us-downgrade",
  "panic-2020-covid",
  "panic-2022-tightening",
  "panic-2023-svb",
  "panic-2024-yen-carry",
]

/** 극점이 기대되는 YDS 단계 */
export const PANIC_CLIMAX_EXPECTED_STAGE_IDS = new Set(["dca", "panicBuy"])

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData} event
 */
export function buildClimaxComparisonRow(event) {
  const climax = event?.milestones?.climax
  const h = climax?.historyData ?? {}
  const yds = computeYdsScore(h)
  const stage = resolveYdsStage(yds)
  const stageOk = stage ? PANIC_CLIMAX_EXPECTED_STAGE_IDS.has(stage.id) : false

  return {
    id: event.id,
    name: event.name,
    climaxDate: climax?.date ?? null,
    yds,
    vix: h.vix ?? null,
    cnn: h.cnn ?? null,
    bofa: h.bofa ?? null,
    highYield: h.highYield ?? null,
    putCall: h.putCall ?? null,
    stageId: stage?.id ?? null,
    stageLabel: stage?.label ?? null,
    stageEmoji: stage?.emoji ?? null,
    stageOk,
    ydsComputable: yds != null,
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 */
export function buildPanicEventValidationReport(events) {
  const rows = events
    .filter((e) => PANIC_VALIDATION_COMPARE_IDS.includes(e.id))
    .map(buildClimaxComparisonRow)

  const ranked = [...rows]
    .filter((r) => r.yds != null)
    .sort((a, b) => (b.yds ?? 0) - (a.yds ?? 0))

  const evaluated = rows.filter((r) => r.ydsComputable)
  const hits = evaluated.filter((r) => r.stageOk)
  const hitRatePct =
    evaluated.length > 0 ? Math.round((hits.length / evaluated.length) * 100) : null

  const stageChecks = rows.map((r) => ({
    ...r,
    expected: "분할매수 또는 패닉매수",
    pass: r.stageOk,
    note: !r.ydsComputable ? "YDS 계산 불가(핵심 지표 미입력)" : r.stageOk ? "기대 단계 일치" : "기대 단계 불일치",
  }))

  return {
    rows,
    ranked,
    summary: {
      totalCompared: rows.length,
      evaluatedCount: evaluated.length,
      hitCount: hits.length,
      hitRatePct,
      allPass: evaluated.length > 0 && hits.length === evaluated.length,
    },
    stageChecks,
  }
}

export function formatIndicatorCell(value, digits = 1) {
  if (value == null) return "—"
  return formatMetric(value, digits)
}

export function formatStageBadge(stageEmoji, stageLabel) {
  if (!stageEmoji && !stageLabel) return "—"
  return `${stageEmoji ?? ""} ${stageLabel ?? ""}`.trim()
}

/** @param {number | null} score */
export function describeClimaxExpectation(score) {
  const stage = resolveMacroV1Status(score)
  if (!stage) return { ok: false, text: "계산 불가" }
  const ok = PANIC_CLIMAX_EXPECTED_STAGE_IDS.has(stage.id)
  return {
    ok,
    text: ok ? "기대 구간" : "기대 구간 외",
    stage,
  }
}
