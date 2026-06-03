import {
  buildPrecursorEnginePhase2Event,
  PRECURSOR_ENGINE_PHASE2_BASELINE_OFFSET,
  PRECURSOR_ENGINE_PHASE2_LEAD_MIN,
} from "./ydsPrecursorEnginePhase2.js"
import { buildPrecursorLivePriCards } from "./ydsPrecursorEnginePhase3.js"
import {
  buildPhase3ValidationDataset,
  PRECURSOR_PHASE3_PANIC_IDS,
} from "./ydsPrecursorPhase3EventCatalog.js"
import { PATTERN_ARCHETYPES } from "./ydsPrecursorEnginePhase5.js"

export const PRECURSOR_ENGINE_PHASE6_LABEL = "YDS Precursor Engine — Phase 6 (Live Pattern Radar)"

/** @type {Record<string, { id: string; label: string; referenceEventId: string; description: string; kind?: "stress" | "calm" }>} */
export const RADAR_PATTERNS = {
  ...PATTERN_ARCHETYPES,
  bull: {
    id: "bull",
    label: "강세장형",
    referenceEventId: "nonpanic-2024-bull-market",
    description: "VIX 안정 · CNN 중립~탐욕 · HY·Put/Call 낮은 스트레스",
    kind: "calm",
  },
}

export const RADAR_INPUT_LABELS = {
  cnn: "CNN",
  highYield: "HY",
  move: "MOVE",
  bofa: "BofA",
  vix: "VIX",
  putCall: "Put/Call",
  priA: "PRI-A",
  priB: "PRI-B",
}

const PRI_A_STRESS = {
  cnn: { stressUp: (b, c) => b - c, cap: 18 },
  highYield: { stressUp: (b, c) => c - b, cap: 0.55 },
  move: { stressUp: (b, c) => c - b, cap: 14 },
  bofa: { stressUp: (b, c) => b - c, cap: 1.2 },
}

const PRI_A_KEYS = ["cnn", "highYield", "move", "bofa"]

/**
 * @param {ReturnType<typeof buildPrecursorEnginePhase2Event>} report
 */
function getPatternSnapContext(report) {
  const baseline =
    report.timeSeries.find((s) => s.offsetDays === PRECURSOR_ENGINE_PHASE2_BASELINE_OFFSET) ?? null
  const lead = report.timeSeries.filter((s) => s.inLeadWindow)
  const allLead = report.timeSeries.filter((s) => s.offsetDays >= PRECURSOR_ENGINE_PHASE2_LEAD_MIN)
  const firstAny = [...allLead]
    .filter((s) => s.priAAlert || s.priBAlert)
    .sort((a, b) => b.offsetDays - a.offsetDays)[0]
  let peakA = null
  for (const s of lead) {
    if (s.priA != null && (peakA == null || s.priA > peakA.priA)) peakA = s
  }
  const calmSnap = report.timeSeries.find((s) => s.offsetDays === 21) ?? report.timeSeries[0]
  return {
    baseline,
    analysisSnap: firstAny ?? peakA ?? calmSnap ?? null,
    calmSnap,
  }
}

/**
 * @param {object} baseline
 * @param {object} snap
 */
export function buildStressFeatureVector(baseline, snap) {
  if (!baseline || !snap) return null
  /** @type {Record<string, number>} */
  const vec = {}
  for (const key of PRI_A_KEYS) {
    const b = baseline[key]
    const c = snap[key]
    if (!Number.isFinite(b) || !Number.isFinite(c)) {
      vec[key] = 0
      continue
    }
    vec[key] = Math.max(0, PRI_A_STRESS[key].stressUp(b, c) / PRI_A_STRESS[key].cap)
  }
  vec.vix = Number.isFinite(snap.vix) ? Math.max(0, (snap.vix - 14) / 32) : 0
  vec.putCall = Number.isFinite(snap.putCall) ? Math.max(0, (snap.putCall - 0.78) / 0.32) : 0
  return vec
}

/**
 * @param {object} snap
 */
function buildCalmFeatureVector(snap) {
  if (!snap) return null
  /** @type {Record<string, number>} */
  const vec = {}
  vec.cnn = Number.isFinite(snap.cnn) ? Math.max(0, Math.min(1, snap.cnn / 75)) : 0
  vec.highYield = Number.isFinite(snap.highYield)
    ? Math.max(0, Math.min(1, (6.5 - snap.highYield) / 3.5))
    : 0
  vec.move = Number.isFinite(snap.move) ? Math.max(0, Math.min(1, (140 - snap.move) / 60)) : 0
  vec.bofa = Number.isFinite(snap.bofa) ? Math.max(0, Math.min(1, (snap.bofa - 4) / 3)) : 0
  vec.vix = Number.isFinite(snap.vix) ? Math.max(0, Math.min(1, (28 - snap.vix) / 18)) : 0
  vec.putCall = Number.isFinite(snap.putCall)
    ? Math.max(0, Math.min(1, (0.95 - snap.putCall) / 0.25))
    : 0
  return vec
}

/**
 * @param {Record<string, number>} a
 * @param {Record<string, number>} b
 */
export function cosineSimilarityPercent(a, b) {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])]
  let dot = 0
  let na = 0
  let nb = 0
  for (const k of keys) {
    const va = a[k] ?? 0
    const vb = b[k] ?? 0
    dot += va * vb
    na += va * va
    nb += vb * vb
  }
  if (na === 0 || nb === 0) return 0
  return Math.round(Math.min(100, (dot / (Math.sqrt(na) * Math.sqrt(nb))) * 100))
}

/**
 * @param {ReturnType<typeof buildPrecursorEnginePhase2Event>[]} eventReports
 */
export function buildRadarPatternCentroids(eventReports) {
  /** @type {Record<string, { id: string; label: string; referenceEventId: string; description: string; kind: string; vector: Record<string, number> }>} */
  const centroids = {}

  for (const pattern of Object.values(RADAR_PATTERNS)) {
    const ref = eventReports.find((r) => r.id === pattern.referenceEventId)
    if (!ref) continue
    const ctx = getPatternSnapContext(ref)
    const isCalm = pattern.kind === "calm"
    const vec = isCalm
      ? buildCalmFeatureVector(ctx.calmSnap ?? ctx.analysisSnap)
      : buildStressFeatureVector(ctx.baseline, ctx.analysisSnap)
    if (!vec) continue
    centroids[pattern.id] = {
      id: pattern.id,
      label: pattern.label,
      referenceEventId: pattern.referenceEventId,
      description: pattern.description,
      kind: pattern.kind ?? "stress",
      vector: vec,
    }
  }
  return centroids
}

/**
 * @param {Record<string, number>} currentStress
 * @param {Record<string, number>} currentCalm
 * @param {ReturnType<typeof buildRadarPatternCentroids>} centroids
 */
export function computePatternSimilarities(currentStress, currentCalm, centroids) {
  return Object.values(centroids)
    .map((c) => {
      const vec = c.kind === "calm" ? currentCalm : currentStress
      if (!vec) return null
      return {
        patternId: c.id,
        patternLabel: c.label,
        referenceEventId: c.referenceEventId,
        description: c.description,
        kind: c.kind,
        similarity: cosineSimilarityPercent(vec, c.vector),
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.similarity - a.similarity)
}

/**
 * @param {{ patternId: string; patternLabel: string; similarity: number; kind?: string } | null} top
 * @param {number | null} priA
 * @param {number | null} priB
 */
export function resolveRadarAlert(top, priA, priB) {
  const maxPri = Math.max(priA ?? 0, priB ?? 0)
  const isPanicTop = top && top.patternId !== "bull"
  const sim = top?.similarity ?? 0

  if (top?.patternId === "bull" && sim >= 55 && maxPri < 30) {
    return { id: "normal", label: "정상", emoji: "🟢" }
  }
  if (isPanicTop && sim >= 70 && maxPri >= 50) {
    return { id: "critical", label: "심각", emoji: "🔴" }
  }
  if (isPanicTop && sim >= 55 && maxPri >= 30) {
    return { id: "danger", label: "위험", emoji: "🟠" }
  }
  if (isPanicTop && sim >= 40) {
    return { id: "caution", label: "주의", emoji: "🟡" }
  }
  if (maxPri >= 50) {
    return { id: "danger", label: "위험", emoji: "🟠" }
  }
  if (maxPri >= 30) {
    return { id: "caution", label: "주의", emoji: "🟡" }
  }
  return { id: "normal", label: "정상", emoji: "🟢" }
}

/**
 * @param {{ patternLabel: string; similarity: number } | null} top
 * @param {{ patternLabel: string; similarity: number } | null} second
 */
export function buildMarketInterpretation(top, second) {
  if (!top) return "현재 시장 패턴 데이터를 산출할 수 없습니다."
  let text = `현재 시장은 ${top.patternLabel}과 ${top.similarity}% 유사`
  if (second && second.similarity >= 40) {
    text += ` · 2위 ${second.patternLabel} ${second.similarity}%`
  }
  if (top.patternLabel === "강세장형") {
    text += " — 스트레스 지표가 낮은 구간"
  } else {
    text += " — 역사적 패닉 전조 패턴과 근접"
  }
  return text
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null }} [options]
 */
export function buildPrecursorEnginePhase6Report(events, options = {}) {
  const dataset = buildPhase3ValidationDataset(events)
  const eventReports = dataset.map((e) =>
    buildPrecursorEnginePhase2Event(e, { panicIds: PRECURSOR_PHASE3_PANIC_IDS }),
  )
  const centroids = buildRadarPatternCentroids(eventReports)

  const live = buildPrecursorLivePriCards(options.latestSnapshot ?? null)
  const snap = live.snapshot
  const baseline = live.baseline30

  const currentStress = buildStressFeatureVector(baseline, snap)
  const currentCalm = buildCalmFeatureVector(snap)

  const allSimilarities = computePatternSimilarities(currentStress, currentCalm, centroids)
  const top3 = allSimilarities.slice(0, 3)
  const top = allSimilarities[0] ?? null
  const second = allSimilarities[1] ?? null

  const radarAlert = resolveRadarAlert(top, live.priA, live.priB)
  const interpretation = buildMarketInterpretation(top, second)

  const inputs = {
    asOf: live.asOf,
    cnn: snap?.cnn ?? null,
    highYield: snap?.highYield ?? null,
    move: snap?.move ?? null,
    moveEstimated: snap?.moveEstimated ?? false,
    bofa: snap?.bofa ?? null,
    vix: snap?.vix ?? null,
    putCall: snap?.putCall ?? null,
    priA: live.priA,
    priB: live.priB,
    baselineDate: baseline?.date ?? null,
  }

  return {
    label: PRECURSOR_ENGINE_PHASE6_LABEL,
    inputs,
    patternSimilarity: allSimilarities.map((s) => ({
      patternId: s.patternId,
      patternLabel: s.patternLabel,
      similarity: s.similarity,
      kind: s.kind,
    })),
    top3: top3.map((s, i) => ({
      rank: i + 1,
      patternId: s.patternId,
      patternLabel: s.patternLabel,
      similarity: s.similarity,
    })),
    radarAlert,
    interpretation,
    centroids: Object.values(centroids).map((c) => ({
      id: c.id,
      label: c.label,
      referenceEventId: c.referenceEventId,
      kind: c.kind,
    })),
    notes: [
      "검증 전용 Live Pattern Radar · getFinalScore·YDS·PRI-A/B·VIX V3 미변경",
      "패닉 4형 = T-28 stress vector · 강세장형 = calm level vector",
      "유사도 = 코사인 유사도 0~100%",
      "Radar Alert = 최근접 패턴 + PRI-A/B 복합",
    ],
  }
}
