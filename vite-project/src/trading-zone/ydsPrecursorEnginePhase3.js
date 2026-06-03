import { formatMetric } from "./ydsHistoricalEventTypes.js"
import { PANIC_VALIDATION_EXTENDED_HISTORY } from "./panicValidationExtendedHistory.js"
import {
  computePriA,
  computePriB,
  buildPrecursorEnginePhase2Event,
  buildPrecursorClassificationMetrics,
  formatPrecursorConfusionMatrix,
  PRECURSOR_ENGINE_PHASE2_WARN_PRI_A,
  PRECURSOR_ENGINE_PHASE2_WARN_PRI_B,
  resolvePriTier,
} from "./ydsPrecursorEnginePhase2.js"
import {
  estimateMoveFromVix,
  offsetPrecursorDay,
  parsePrecursorDay,
} from "./ydsPrecursorInterpolation.js"
import {
  buildPhase3ValidationDataset,
  getPhase3DatasetCounts,
  PRECURSOR_PHASE3_PANIC_IDS,
} from "./ydsPrecursorPhase3EventCatalog.js"

export const PRECURSOR_ENGINE_PHASE3_LABEL = "YDS Precursor Engine — Phase 3 (Real Early Warning)"
export const PRECURSOR_ENGINE_PHASE3_NOTE =
  "실시간 PRI-A/B · 현금 비중 가이드(표시용) · 확장 백테스트 · getFinalScore/V3 미변경"

export const PRECURSOR_LIVE_BASELINE_DAYS = 30

const INTERP_KEYS = ["vix", "cnn", "bofa", "highYield", "putCall"]

/**
 * @param {Record<string, unknown>} row
 */
function rowToSnapshot(row) {
  if (!row) return null
  const vix = Number(row.vix)
  const cnn = Number(row.cnn ?? row.fearGreed)
  const bofa = Number(row.bofa)
  const highYield = Number(row.highYield)
  const putCall = Number(row.putCall)
  let move = row.move != null ? Number(row.move) : null
  if (!Number.isFinite(move) && Number.isFinite(vix)) move = estimateMoveFromVix(vix)
  const date =
    typeof row.date === "string"
      ? row.date.slice(0, 10)
      : typeof row.asOf === "string"
        ? row.asOf.slice(0, 10)
        : null
  return {
    date,
    vix: Number.isFinite(vix) ? vix : null,
    cnn: Number.isFinite(cnn) ? cnn : null,
    bofa: Number.isFinite(bofa) ? bofa : null,
    highYield: Number.isFinite(highYield) ? highYield : null,
    putCall: Number.isFinite(putCall) ? putCall : null,
    move: Number.isFinite(move) ? move : null,
    moveEstimated: row.move == null && Number.isFinite(move),
  }
}

/**
 * @param {ReturnType<typeof rowToSnapshot>[]} series
 * @param {string} targetDate
 */
export function interpolateSeriesAt(series, targetDate) {
  if (!series.length) return null
  const targetTs = parsePrecursorDay(targetDate)
  const sorted = [...series].filter((s) => s?.date).sort((a, b) => parsePrecursorDay(a.date) - parsePrecursorDay(b.date))

  if (targetTs <= parsePrecursorDay(sorted[0].date)) return { ...sorted[0], date: targetDate }
  if (targetTs >= parsePrecursorDay(sorted[sorted.length - 1].date)) {
    return { ...sorted[sorted.length - 1], date: targetDate }
  }

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i]
    const b = sorted[i + 1]
    const ta = parsePrecursorDay(a.date)
    const tb = parsePrecursorDay(b.date)
    if (targetTs >= ta && targetTs <= tb) {
      const span = tb - ta
      const t = span === 0 ? 0 : (targetTs - ta) / span
      /** @type {Record<string, number | null>} */
      const out = { date: targetDate }
      for (const key of INTERP_KEYS.concat(["move"])) {
        const va = a[key]
        const vb = b[key]
        if (!Number.isFinite(va) && !Number.isFinite(vb)) out[key] = null
        else if (!Number.isFinite(va)) out[key] = vb
        else if (!Number.isFinite(vb)) out[key] = va
        else out[key] = va + t * (vb - va)
      }
      return rowToSnapshot(out)
    }
  }
  return null
}

/**
 * @param {Record<string, unknown> | null | undefined} latestSnapshot
 * @param {object[]} [extraRows]
 */
export function buildPrecursorHistorySeries(latestSnapshot = null, extraRows = []) {
  const merged = new Map()
  for (const r of PANIC_VALIDATION_EXTENDED_HISTORY) {
    merged.set(r.date.slice(0, 10), rowToSnapshot({ ...r, cnn: r.fearGreed, date: r.date }))
  }
  for (const r of extraRows ?? []) {
    const snap = rowToSnapshot(r)
    if (snap?.date) merged.set(snap.date, snap)
  }
  if (latestSnapshot) {
    const snap = rowToSnapshot(latestSnapshot)
    if (snap?.date) merged.set(snap.date, snap)
    else if (snap) {
      const fallbackDate = PANIC_VALIDATION_EXTENDED_HISTORY.at(-1)?.date?.slice(0, 10)
      merged.set(fallbackDate ?? "2026-03-06", { ...snap, date: fallbackDate ?? "2026-03-06" })
    }
  }
  return [...merged.values()].sort((a, b) => parsePrecursorDay(a.date) - parsePrecursorDay(b.date))
}

/**
 * @param {number | null} priA
 */
export function resolveCashAllocationGuide(priA) {
  if (priA == null || !Number.isFinite(priA)) {
    return {
      equityPct: null,
      cashPct: null,
      label: "—",
      disclaimer: "데이터 부족 · 표시용 가이드",
    }
  }
  let cashPct = 100
  if (priA >= 70) cashPct = 40
  else if (priA >= 50) cashPct = 60
  else if (priA >= 30) cashPct = 80
  const equityPct = 100 - cashPct
  const band =
    priA >= 70 ? "위험" : priA >= 50 ? "경고" : priA >= 30 ? "주의" : "정상"
  return {
    equityPct,
    cashPct,
    label: `주식 ${equityPct}% / 현금 ${cashPct}% (${band})`,
    disclaimer: "표시용 참고 가이드이며 실제 투자 권유가 아닙니다",
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} latestSnapshot
 * @param {object[]} [extraRows]
 */
export function buildPrecursorLivePriCards(latestSnapshot = null, extraRows = []) {
  const series = buildPrecursorHistorySeries(latestSnapshot, extraRows)
  const asOf = series.at(-1)?.date ?? null
  if (!asOf) {
    return {
      asOf: null,
      priA: null,
      priB: null,
      priACard: null,
      priBCard: null,
      cashGuide: resolveCashAllocationGuide(null),
      seriesLength: 0,
    }
  }

  const current = interpolateSeriesAt(series, asOf)
  const baseline30 = interpolateSeriesAt(series, offsetPrecursorDay(asOf, -PRECURSOR_LIVE_BASELINE_DAYS))
  const baseline60 = interpolateSeriesAt(series, offsetPrecursorDay(asOf, -PRECURSOR_LIVE_BASELINE_DAYS * 2))

  const priA = computePriA(baseline30, current)
  const priB = computePriB(current)
  const priAPrior = baseline60 && baseline30 ? computePriA(baseline60, baseline30) : null
  const priBPrior = baseline30 ? computePriB(baseline30) : null

  const priAChange30d =
    priA != null && priAPrior != null ? Math.round(priA - priAPrior) : null
  const priBChange30d =
    priB != null && priBPrior != null ? Math.round(priB - priBPrior) : null

  const priATier = resolvePriTier(priA, "A")
  const priBTier = resolvePriTier(priB, "B")
  const warnA = priA != null && priA >= PRECURSOR_ENGINE_PHASE2_WARN_PRI_A
  const warnB = priB != null && priB >= PRECURSOR_ENGINE_PHASE2_WARN_PRI_B

  return {
    asOf,
    priA,
    priB,
    seriesLength: series.length,
    priACard: {
      score: priA,
      tier: priATier,
      change30d: priAChange30d,
      change30dLabel:
        priAChange30d != null
          ? `${priAChange30d >= 0 ? "+" : ""}${priAChange30d} (30일 PRI-A 변화)`
          : "—",
      warning: warnA,
      warningLabel: warnA ? "⚠ 조기경보 ON" : "정상",
      baselineDate: baseline30?.date ?? null,
    },
    priBCard: {
      score: priB,
      tier: priBTier,
      change30d: priBChange30d,
      change30dLabel:
        priBChange30d != null
          ? `${priBChange30d >= 0 ? "+" : ""}${priBChange30d} (30일 PRI-B 변화)`
          : "—",
      shockState: priBTier.label,
      warning: warnB,
      warningLabel: warnB ? "⚠ 충격감지 ON" : "정상",
    },
    cashGuide: resolveCashAllocationGuide(priA),
    snapshot: current,
    baseline30,
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 */
export function buildPrecursorEnginePhase3ValidationReport(events) {
  const dataset = buildPhase3ValidationDataset(events)
  const counts = getPhase3DatasetCounts()

  const eventReports = dataset.map((ev) =>
    buildPrecursorEnginePhase2Event(ev, { panicIds: PRECURSOR_PHASE3_PANIC_IDS }),
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

  return {
    label: PRECURSOR_ENGINE_PHASE3_LABEL,
    datasetCounts: counts,
    eventReports,
    classification: {
      priA: {
        ...metricsPriA,
        confusionMatrix: formatPrecursorConfusionMatrix(metricsPriA),
      },
      priB: {
        ...metricsPriB,
        confusionMatrix: formatPrecursorConfusionMatrix(metricsPriB),
      },
    },
    notes: [
      PRECURSOR_ENGINE_PHASE3_NOTE,
      `패닉 ${counts.panic}건 · 비패닉 ${counts.nonPanic}건 (앵커 calm ${counts.anchorCalm}건)`,
      `실시간 PRI = 최근 ${PRECURSOR_LIVE_BASELINE_DAYS}일 변화율 기준`,
      "현금 비중 가이드는 UI 표시용이며 투자 권유가 아님",
      "getFinalScore·VIX V3·프로덕션 엔진 미변경",
    ],
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null; extraRows?: object[] }} [options]
 */
export function buildPrecursorEnginePhase3Report(events, options = {}) {
  const live = buildPrecursorLivePriCards(options.latestSnapshot ?? null, options.extraRows)
  const validation = buildPrecursorEnginePhase3ValidationReport(events)

  return {
    label: PRECURSOR_ENGINE_PHASE3_LABEL,
    live,
    validation,
    notes: validation.notes,
  }
}

export function formatPhase3Cell(value, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "—"
  return formatMetric(value, digits)
}
