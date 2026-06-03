import {
  buildPrecursorEnginePhase2Event,
  computePriA,
  computePriB,
  PRECURSOR_ENGINE_PHASE2_BASELINE_OFFSET,
  PRECURSOR_ENGINE_PHASE2_LEAD_MIN,
  PRECURSOR_ENGINE_PHASE2_WARN_PRI_A,
  PRECURSOR_ENGINE_PHASE2_WARN_PRI_B,
} from "./ydsPrecursorEnginePhase2.js"
import {
  buildPhase3ValidationDataset,
  PRECURSOR_PHASE3_PANIC_IDS,
} from "./ydsPrecursorPhase3EventCatalog.js"
import { buildPrecursorLivePriCards } from "./ydsPrecursorEnginePhase3.js"

export const PRECURSOR_ENGINE_PHASE5_LABEL = "YDS Precursor Engine — Phase 5 (TP Pattern Analysis)"

export const METRIC_CONTRIBUTION_LABELS = {
  cnn: "CNN",
  highYield: "HY",
  move: "MOVE",
  bofa: "BofA",
  vix: "VIX",
  putCall: "Put/Call",
}

/** @type {Record<string, { id: string; label: string; referenceEventId: string; description: string }>} */
export const PATTERN_ARCHETYPES = {
  lehman: {
    id: "lehman",
    label: "리먼형",
    referenceEventId: "panic-2008-lehman",
    description: "신용·HY 급등 + CNN 급락 + VIX 중·고점 선행",
  },
  covid: {
    id: "covid",
    label: "코로나형",
    referenceEventId: "panic-2020-covid",
    description: "VIX·Put/Call 극단 + CNN 공포 + HY 스트레스 동반",
  },
  tariff: {
    id: "tariff",
    label: "관세형",
    referenceEventId: "panic-2025-tariff-shock",
    description: "VIX 급등 + BofA·CNN 동시 악화 + 단기 선행",
  },
  svb: {
    id: "svb",
    label: "SVB형",
    referenceEventId: "panic-2023-svb",
    description: "HY·Put/Call 중간 강도 + VIX 완만 상승 · 국지 은행 스트레스",
  },
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
function getTpLeadContext(report) {
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

  const analysisSnap = firstAny ?? peakA ?? lead[0] ?? null
  return { baseline, lead, firstAny, peakA, analysisSnap }
}

/**
 * @param {object} baseline
 * @param {object} snap
 */
function computeMetricContributions(baseline, snap) {
  if (!baseline || !snap) return []

  /** @type {{ key: string; label: string; points: number; normalized: number }[]} */
  const rows = []

  for (const key of PRI_A_KEYS) {
    const b = baseline[key]
    const c = snap[key]
    if (!Number.isFinite(b) || !Number.isFinite(c)) continue
    const delta = PRI_A_STRESS[key].stressUp(b, c)
    const cap = PRI_A_STRESS[key].cap
    const points = Math.min(25, Math.max(0, (Math.max(0, delta) / cap) * 25))
    rows.push({
      key,
      label: METRIC_CONTRIBUTION_LABELS[key],
      points: Math.round(points * 10) / 10,
      normalized: Math.round((Math.max(0, delta) / cap) * 1000) / 10,
    })
  }

  const vix = snap.vix
  if (Number.isFinite(vix)) {
    const points = Math.min(50, Math.max(0, ((vix - 14) / 32) * 50))
    rows.push({
      key: "vix",
      label: METRIC_CONTRIBUTION_LABELS.vix,
      points: Math.round(points * 10) / 10,
      normalized: Math.round(points * 2),
    })
  }

  const putCall = snap.putCall
  if (Number.isFinite(putCall)) {
    const points = Math.min(50, Math.max(0, ((putCall - 0.78) / 0.32) * 50))
    rows.push({
      key: "putCall",
      label: METRIC_CONTRIBUTION_LABELS.putCall,
      points: Math.round(points * 10) / 10,
      normalized: Math.round(points * 2),
    })
  }

  return rows.sort((a, b) => b.points - a.points)
}

/**
 * @param {ReturnType<typeof computeMetricContributions>} contribs
 */
function topContributorLabels(contribs, n = 2) {
  return contribs
    .slice(0, n)
    .filter((c) => c.points > 0)
    .map((c) => c.label)
    .join(" · ")
}

/**
 * @param {object} baseline
 * @param {object} snap
 */
function buildFeatureVector(baseline, snap) {
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
 * @param {Record<string, number>} a
 * @param {Record<string, number>} b
 */
function cosineSimilarity(a, b) {
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
  return Math.round((dot / (Math.sqrt(na) * Math.sqrt(nb))) * 1000) / 10
}

/**
 * @param {ReturnType<typeof buildPrecursorEnginePhase2Event>[]} panicReports
 */
function buildArchetypeCentroids(panicReports) {
  /** @type {Record<string, { vector: Record<string, number>; label: string; referenceEventId: string; description: string }>} */
  const centroids = {}

  for (const arch of Object.values(PATTERN_ARCHETYPES)) {
    const ref = panicReports.find((r) => r.id === arch.referenceEventId)
    if (!ref) continue
    const ctx = getTpLeadContext(ref)
    const vec = buildFeatureVector(ctx.baseline, ctx.analysisSnap)
    if (vec) {
      centroids[arch.id] = {
        vector: vec,
        label: arch.label,
        referenceEventId: arch.referenceEventId,
        description: arch.description,
      }
    }
  }
  return centroids
}

/**
 * @param {Record<string, number>} vec
 * @param {ReturnType<typeof buildArchetypeCentroids>} centroids
 */
function assignPatternCluster(vec, centroids) {
  const scores = Object.entries(centroids).map(([id, c]) => ({
    id,
    label: c.label,
    similarity: cosineSimilarity(vec, c.vector),
  }))
  scores.sort((a, b) => b.similarity - a.similarity)
  return {
    primary: scores[0] ?? null,
    all: scores,
  }
}

/**
 * @param {ReturnType<typeof buildPrecursorEnginePhase2Event>} report
 * @param {ReturnType<typeof buildArchetypeCentroids>} centroids
 */
function buildTpRow(report, centroids) {
  const ctx = getTpLeadContext(report)
  const contribs = computeMetricContributions(ctx.baseline, ctx.analysisSnap)
  const vec = buildFeatureVector(ctx.baseline, ctx.analysisSnap)
  const cluster = vec ? assignPatternCluster(vec, centroids) : { primary: null, all: [] }

  return {
    id: report.id,
    name: report.name,
    climaxDate: report.climaxDate,
    firstWarning: ctx.firstAny?.offsetLabel ?? "—",
    firstWarningDays: ctx.firstAny?.offsetDays ?? null,
    priAAtWarning: ctx.firstAny?.priA ?? ctx.peakA?.priA ?? null,
    priBAtWarning: ctx.firstAny?.priB ?? ctx.analysisSnap?.priB ?? null,
    maxPriAInLead: report.outcome.maxPriAInLead,
    maxPriBInLead: report.outcome.maxPriBInLead,
    topContributors: topContributorLabels(contribs),
    contributions: contribs,
    featureVector: vec,
    patternCluster: cluster.primary?.label ?? "—",
    patternClusterId: cluster.primary?.id ?? null,
    patternSimilarity: cluster.primary?.similarity ?? null,
    patternScores: cluster.all,
  }
}

/**
 * @param {ReturnType<typeof buildTpRow>[]} tpRows
 */
function buildContributionAnalysis(tpRows) {
  const metricKeys = ["cnn", "highYield", "move", "bofa", "vix", "putCall"]
  const n = tpRows.length

  return metricKeys.map((key) => {
    let topCount = 0
    let presentCount = 0
    let pointSum = 0

    for (const row of tpRows) {
      const c = row.contributions.find((x) => x.key === key)
      if (!c || c.points <= 0) continue
      presentCount += 1
      pointSum += c.points
      if (row.contributions[0]?.key === key || row.contributions[1]?.key === key) topCount += 1
    }

    return {
      key,
      label: METRIC_CONTRIBUTION_LABELS[key],
      tpRate: n > 0 ? Math.round((presentCount / n) * 1000) / 10 : 0,
      topContributorRate: n > 0 ? Math.round((topCount / n) * 1000) / 10 : 0,
      avgPoints: presentCount > 0 ? Math.round((pointSum / presentCount) * 10) / 10 : 0,
      eventCount: presentCount,
    }
  }).sort((a, b) => b.topContributorRate - a.topContributorRate)
}

/**
 * @param {ReturnType<typeof buildTpRow>[]} tpRows
 */
function buildPatternClusters(tpRows) {
  return Object.values(PATTERN_ARCHETYPES).map((arch) => {
    const members = tpRows.filter((r) => r.patternClusterId === arch.id)
    const alsoSimilar = tpRows.filter(
      (r) => r.patternScores?.find((s) => s.id === arch.id)?.similarity >= 60,
    )
    return {
      ...arch,
      memberCount: members.length,
      members: members.map((m) => m.name),
      similarCount: alsoSimilar.length,
    }
  })
}

/**
 * @param {ReturnType<typeof buildArchetypeCentroids>} centroids
 * @param {Record<string, unknown> | null | undefined} latestSnapshot
 */
function buildSimilarityEngineDraft(centroids, latestSnapshot) {
  const live = buildPrecursorLivePriCards(latestSnapshot ?? null)
  const currentVec = buildFeatureVector(live.baseline30, live.snapshot)

  const similarities = currentVec
    ? Object.entries(centroids).map(([id, c]) => ({
        patternId: id,
        patternLabel: c.label,
        referenceEventId: c.referenceEventId,
        similarity: cosineSimilarity(currentVec, c.vector),
        description: c.description,
      }))
    : []

  similarities.sort((a, b) => b.similarity - a.similarity)

  return {
    version: "0.1-draft",
    purpose: "현재 시장 vs TP 패턴 archetype 유사도",
    featureKeys: [...PRI_A_KEYS, "vix", "putCall"],
    baselineWindowDays: 30,
    patterns: Object.entries(centroids).map(([id, c]) => ({
      id,
      label: c.label,
      referenceEventId: c.referenceEventId,
      description: c.description,
      centroid: c.vector,
    })),
    compare: {
      asOf: live.asOf,
      currentVector: currentVec,
      currentPriA: live.priA,
      currentPriB: live.priB,
      similarities,
      nearestPattern: similarities[0] ?? null,
    },
    apiShape: {
      input: "{ baselineSnapshot, currentSnapshot }",
      output: "{ similarities: [{ patternId, similarity }], nearestPatternId }",
    },
  }
}

/**
 * @param {ReturnType<typeof buildTpRow>[]} tpRows
 * @param {ReturnType<typeof buildContributionAnalysis>} contributionAnalysis
 * @param {ReturnType<typeof buildPatternClusters>} clusters
 * @param {ReturnType<typeof buildSimilarityEngineDraft>} similarityDraft
 */
function buildPatternDictionaryDraft(tpRows, contributionAnalysis, clusters, similarityDraft) {
  const topMetrics = contributionAnalysis.slice(0, 3).map((c) => c.label).join(" · ")

  const entries = clusters
    .filter((c) => c.memberCount > 0 || c.referenceEventId)
    .map((c) => ({
      patternId: c.id,
      title: `${c.label} (${c.memberCount}건 TP)`,
      signature: c.description,
      members: c.members,
      referenceEvent: c.referenceEventId,
    }))

  return {
    title: "전조 패턴 사전 (초안)",
    summary: `TP ${tpRows.length}건 · 공통 선행 지표: ${topMetrics || "—"}`,
    entries,
    rules: [
      "PRI-A≥30 또는 PRI-B≥30 선행 감지 시 패턴 유사도로 2차 분류",
      `가장 빈번한 TP 기여: ${contributionAnalysis[0]?.label ?? "—"} (${contributionAnalysis[0]?.topContributorRate ?? 0}%)`,
      "현재 시장 nearest pattern → similarityDraft.compare.nearestPattern",
      "Phase 6: 일별 live vector + rolling similarity dashboard",
    ],
    currentMarketHint: similarityDraft.compare.nearestPattern
      ? `현재 ${similarityDraft.compare.nearestPattern.patternLabel} 유사도 ${similarityDraft.compare.nearestPattern.similarity}%`
      : "현재 시장 벡터 미산출",
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null }} [options]
 */
export function buildPrecursorEnginePhase5Report(events, options = {}) {
  const dataset = buildPhase3ValidationDataset(events)
  const panicReports = dataset
    .filter((e) => PRECURSOR_PHASE3_PANIC_IDS.includes(e.id))
    .map((e) => buildPrecursorEnginePhase2Event(e, { panicIds: PRECURSOR_PHASE3_PANIC_IDS }))

  const tpReports = panicReports.filter(
    (r) => r.outcome.hitPriA || r.outcome.hitPriB,
  )

  const centroids = buildArchetypeCentroids(panicReports)
  const tpRows = tpReports.map((r) => buildTpRow(r, centroids))
  const contributionAnalysis = buildContributionAnalysis(tpRows)
  const patternClusters = buildPatternClusters(tpRows)
  const similarityEngineDraft = buildSimilarityEngineDraft(
    centroids,
    options.latestSnapshot ?? null,
  )
  const patternDictionary = buildPatternDictionaryDraft(
    tpRows,
    contributionAnalysis,
    patternClusters,
    similarityEngineDraft,
  )

  return {
    label: PRECURSOR_ENGINE_PHASE5_LABEL,
    tpCount: tpRows.length,
    panicCount: panicReports.length,
    tpTable: tpRows,
    contributionAnalysis,
    patternClusters,
    similarityEngineDraft,
    patternDictionary,
    notes: [
      "검증 전용 · getFinalScore·VIX V3·프로덕션 엔진 미변경",
      `TP = 선행 윈도우 내 PRI-A≥${PRECURSOR_ENGINE_PHASE2_WARN_PRI_A} 또는 PRI-B≥${PRECURSOR_ENGINE_PHASE2_WARN_PRI_B}`,
      "기여도 = T-28 baseline 대비 최초 경고 시점 지표 점수 분해",
      "패턴 군집 = 4 archetype centroid 코사인 유사도",
    ],
  }
}
