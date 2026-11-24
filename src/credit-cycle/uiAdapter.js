/**
 * Credit Cycle → UI DTO adapter.
 * Does not change engine math. Maps engine / research payloads for display.
 * License-safe product mode: never expose HY/BBB numeric values.
 */

import { INDICATOR_CONFIG, REGIME_IDS } from "./config.js"
import { classifyRegime } from "./regime.js"

export const UI_FEED_STATUS = {
  PREPARING: "PREPARING",
  RESEARCH_SNAPSHOT: "RESEARCH_SNAPSHOT",
  LOCAL_CACHE: "LOCAL_CACHE",
  /** Phase 11: local FRED/FDIC → license-safe CCI snapshots (NON_PIT), not Staging DB. */
  LICENSE_SAFE_LOCAL: "LICENSE_SAFE_LOCAL",
  STAGING_API: "STAGING_API",
  LIVE: "LIVE",
  UNAVAILABLE: "UNAVAILABLE",
}

const INDICATOR_LABELS = {
  hy: "HY Spread",
  bbb: "BBB Spread",
  sloos: "Fed SLOOS",
  cpff: "CPFF 자금시장",
  bank: "Bank Soundness",
  cre: "CRE Delinquency",
  corp_delinq: "Corporate Delinquency",
}

/** Full catalog order for UI rows (incl. license-restricted placeholders). */
export const UI_INDICATOR_ORDER = ["hy", "bbb", "sloos", "cpff", "bank", "cre", "corp_delinq"]

/**
 * @param {number | null | undefined} n
 * @param {number} [digits]
 */
export function formatScore(n, digits = 1) {
  if (n == null || !Number.isFinite(Number(n))) return null
  return Number(Number(n).toFixed(digits))
}

/**
 * @param {object | null | undefined} engineResult — computeCciAt return
 * @param {{
 *   feedStatus?: string,
 *   priorCci?: number | null,
 *   updatedAt?: string | null,
 *   history?: object | null,
 *   note?: string | null,
 * }} [opts]
 */
export function adaptEngineResultToUi(engineResult, opts = {}) {
  if (!engineResult || typeof engineResult !== "object") {
    return buildPreparingSnapshot({ reason: "engine_result_missing" })
  }

  const mode = engineResult.mode === "research" ? "research" : "license_safe"
  const asOf = engineResult.dataAsOfDate || engineResult.asOfDate || null
  const cciRaw = mode === "license_safe" ? engineResult.cci : engineResult.cci
  const hold =
    engineResult.status === "HOLD_LOW_COVERAGE" ||
    engineResult.cci == null ||
    engineResult.coverage < 0.7

  const scoredById = new Map(
    (engineResult.indicators || []).map((row) => [row.id, row]),
  )

  const indicators = UI_INDICATOR_ORDER.map((id) => {
    const cfg = INDICATOR_CONFIG.find((c) => c.id === id)
    const row = scoredById.get(id)
    const licenseRestricted = Boolean(cfg?.licenseRestricted)
    if (licenseRestricted || mode === "license_safe" && cfg?.licenseRestricted) {
      return {
        id,
        label: INDICATOR_LABELS[id] || id,
        frequency: cfg?.frequency || null,
        licenseRestricted: true,
        value: null,
        valueDisplay: null,
        priorValue: null,
        delta: null,
        riskScore: null,
        contribution: null,
        asOf: null,
        quality: "LICENSE_RESTRICTED",
        statusLabel: "라이선스 제한",
        trend: "UNKNOWN",
        exposed: false,
      }
    }

    const value = row?.lastValue ?? null
    const riskScore = row?.score ?? null
    const quality = row?.quality || "MISSING"
    const mom =
      row?.detail?.momentum?.shortDelta != null ? row.detail.momentum.shortDelta : null
    const trend =
      mom == null
        ? "UNKNOWN"
        : cfg?.riskDirection === "higher_is_risk"
          ? mom > 0
            ? "WORSENING"
            : mom < 0
              ? "IMPROVING"
              : "FLAT"
          : mom < 0
            ? "WORSENING"
            : mom > 0
              ? "IMPROVING"
              : "FLAT"

    const weight = cfg?.weightNominal ?? null
    const contribution =
      riskScore != null && weight != null ? formatScore(riskScore * weight, 2) : null

    return {
      id,
      label: INDICATOR_LABELS[id] || cfg?.label || id,
      frequency: cfg?.frequency || null,
      licenseRestricted: false,
      value: value == null ? null : formatScore(value, 4),
      valueDisplay: value == null ? null : formatScore(value, 2),
      priorValue: null,
      delta: mom == null ? null : formatScore(mom, 2),
      riskScore: formatScore(riskScore, 1),
      contribution,
      asOf: row?.lastObservationDate || asOf,
      quality,
      statusLabel: qualityStatusLabel(quality, hold),
      trend,
      exposed: true,
    }
  })

  // Ensure HY/BBB always restricted in product DTO even if research mode slipped in
  for (const row of indicators) {
    if (row.id === "hy" || row.id === "bbb") {
      row.licenseRestricted = true
      row.exposed = false
      row.value = null
      row.valueDisplay = null
      row.priorValue = null
      row.delta = null
      row.riskScore = null
      row.contribution = null
      row.quality = "LICENSE_RESTRICTED"
      row.statusLabel = "라이선스 제한"
      row.trend = "UNKNOWN"
    }
  }

  const coverage = engineResult.coverage ?? null
  const confidence = engineResult.confidence || null
  const priorCci = opts.priorCci ?? null
  const cci = hold ? null : formatScore(cciRaw, 1)
  const cciDelta =
    cci != null && priorCci != null && Number.isFinite(Number(priorCci))
      ? formatScore(cci - Number(priorCci), 1)
      : engineResult.cciMomentum != null
        ? formatScore(engineResult.cciMomentum, 1)
        : null

  let regime = engineResult.regime || null
  if (!regime && cci != null) {
    regime = classifyRegime({
      cci,
      cciMomentum: cciDelta,
      worseningCount: indicators.filter((i) => i.trend === "WORSENING").length,
      indicatorCount: indicators.filter((i) => i.exposed && i.riskScore != null).length,
      persistenceShare: null,
      priorRegime: null,
    })
  }

  const pitLabel = normalizePitLabel(engineResult.pitStatus || engineResult.pit)

  return {
    mode: "license_safe",
    feedStatus: opts.feedStatus || UI_FEED_STATUS.LIVE,
    asOf,
    updatedAt: opts.updatedAt || null,
    cci,
    cciDelta,
    coverage: coverage == null ? null : Number(coverage),
    coveragePct:
      coverage == null ? null : formatScore((Number(coverage) <= 1 ? Number(coverage) : Number(coverage) / 100) * 100, 0),
    confidence,
    hold,
    holdReason: hold ? engineResult.status || "HOLD_OR_UNAVAILABLE" : null,
    pitLabel,
    statusLabel: hold
      ? "데이터 부족 · 해석 보류"
      : opts.feedStatus === UI_FEED_STATUS.LOCAL_CACHE
        ? "로컬 캐시 관측 · NON_PIT"
        : pitLabel === "PIT"
          ? "데이터 충분 · 관측 가능"
          : "관측 가능 · 출처 확인 필요",
    regime: adaptRegime(regime),
    indicators,
    narrative: buildNarrative({
      cci,
      cciDelta,
      hold,
      indicators: indicators.filter((i) => i.exposed),
      regime: adaptRegime(regime),
      pitLabel,
      localCache: opts.feedStatus === UI_FEED_STATUS.LOCAL_CACHE,
    }),
    checklist: buildChecklist(indicators),
    history: opts.history || null,
    cciPath: opts.cciPath || null,
    series: opts.series || null,
    inventory: opts.inventory || null,
    disclaimers: buildDisclaimers(opts),
    warningPolicy: {
      locked: false,
      evidence: "INSUFFICIENT_EVIDENCE",
      note: "생산용 경고 임계값·가중치는 확정되지 않았습니다.",
    },
    researchNote: opts.note || null,
  }
}

/**
 * Adapt local FRED/FDIC cache UI bundle (built by localHistoryProvider).
 * @param {object} bundle
 */
export function adaptLocalHistoryBundleToUi(bundle) {
  if (!bundle?.latestEngine && !bundle?.cciPath?.length) {
    return buildPreparingSnapshot({ reason: "local_bundle_empty" })
  }

  /** @type {ReturnType<typeof adaptEngineResultToUi>} */
  let base
  if (bundle.latestEngine) {
    base = adaptEngineResultToUi(bundle.latestEngine, {
      feedStatus: UI_FEED_STATUS.LOCAL_CACHE,
      priorCci: bundle.priorCci ?? null,
      updatedAt: bundle.meta?.builtAt || null,
      history: bundle.researchHistory || null,
      note: bundle.meta?.note || null,
      cciPath: bundle.cciPath || null,
      inventory: bundle.inventory || null,
    })
  } else {
    base = buildPreparingSnapshot({ reason: "local_bundle_path_only" })
    const last = bundle.cciPath[bundle.cciPath.length - 1]
    const prev = bundle.cciPath[bundle.cciPath.length - 2]
    base.feedStatus = UI_FEED_STATUS.LOCAL_CACHE
    base.asOf = last?.asOf || null
    base.cci = last?.cci ?? null
    base.cciDelta =
      last?.cci != null && prev?.cci != null
        ? formatScore(last.cci - prev.cci, 1)
        : null
    base.coverage = last?.coverage ?? null
    base.coveragePct =
      last?.coverage == null
        ? null
        : formatScore((last.coverage <= 1 ? last.coverage : last.coverage / 100) * 100, 0)
    base.confidence = last?.confidence || null
    base.hold = last?.cci == null
    base.history = bundle.researchHistory || null
  }

  base.feedStatus = UI_FEED_STATUS.LOCAL_CACHE
  base.pitLabel = normalizePitLabel(bundle.meta?.pitLabel || "NON_PIT")
  base.cciPath = bundle.cciPath || null
  base.inventory = bundle.inventory || null
  base.series = bundle.series || null
  base.updatedAt = bundle.meta?.builtAt || base.updatedAt

  base.indicators = base.indicators.map((row) => {
    const s = bundle.series?.[row.id]
    if (!s) return { ...row, seriesPoints: [] }
    if (s.licenseRestricted || row.licenseRestricted) {
      return {
        ...row,
        licenseRestricted: true,
        exposed: false,
        value: null,
        valueDisplay: null,
        priorValue: null,
        delta: null,
        riskScore: null,
        observationDate: null,
        releaseDate: null,
        retrievedAt: null,
        seriesPoints: [],
        unit: null,
        source: null,
        valuesExcluded: true,
      }
    }
    return {
      ...row,
      value: s.lastValue == null ? row.value : formatScore(s.lastValue, 4),
      valueDisplay: s.lastValue == null ? row.valueDisplay : formatScore(s.lastValue, 2),
      priorValue: s.priorValue == null ? null : formatScore(s.priorValue, 4),
      valueDelta: s.delta == null ? null : formatScore(s.delta, 3),
      observationDate: s.lastObservationDate || row.asOf,
      releaseDate: s.lastReleaseDate || null,
      retrievedAt: s.retrievedAt || null,
      unit: s.unit || null,
      source: s.source || null,
      frequency: s.frequency || row.frequency,
      seriesPoints: Array.isArray(s.points) ? s.points : [],
      pitLabel: s.pitLabel || "NON_PIT",
    }
  })

  base.statusLabel = base.hold
    ? "데이터 부족 · 해석 보류"
    : "로컬 캐시 관측 · NON_PIT (실시간·PIT 아님)"
  base.disclaimers = buildDisclaimers({
    note: bundle.meta?.note,
    warningEvidence: bundle.meta?.warningEvidence || "INSUFFICIENT_EVIDENCE",
  })
  base.narrative = [
    "데이터 구분: 로컬 캐시 관측(NON_PIT). 연구 PIT 스냅샷과 별개입니다.",
    ...(base.narrative || []),
  ]
  return base
}

/**
 * Adapt Phase4-style research snapshot JSON (public/credit-cycle/research-snapshot.json).
 * @param {object} snapshot
 */
export function adaptResearchSnapshotToUi(snapshot) {
  if (!snapshot?.latest) {
    return buildPreparingSnapshot({ reason: "snapshot_missing_latest" })
  }
  const latest = snapshot.latest
  const catalog = snapshot.indicatorCatalog || {}
  const hold =
    latest.cci == null ||
    latest.cciStatus === "HOLD_LOW_COVERAGE" ||
    (latest.coverage != null && latest.coverage < 0.7)

  const scoreById = new Map((latest.indicators || []).map((i) => [i.id, i]))

  const indicators = UI_INDICATOR_ORDER.map((id) => {
    const meta = catalog[id] || {}
    const licenseRestricted = Boolean(meta.licenseRestricted) || id === "hy" || id === "bbb"
    if (licenseRestricted) {
      return {
        id,
        label: meta.label || INDICATOR_LABELS[id] || id,
        frequency: meta.frequency || null,
        licenseRestricted: true,
        value: null,
        valueDisplay: null,
        priorValue: null,
        delta: null,
        riskScore: null,
        contribution: null,
        asOf: null,
        quality: "LICENSE_RESTRICTED",
        statusLabel: "라이선스 제한",
        trend: "UNKNOWN",
        exposed: false,
      }
    }
    const row = scoreById.get(id)
    const riskScore = row?.score ?? null
    const quality = row?.quality || "MISSING"
    return {
      id,
      label: meta.label || INDICATOR_LABELS[id] || id,
      frequency: meta.frequency || null,
      licenseRestricted: false,
      value: null,
      valueDisplay: riskScore == null ? null : formatScore(riskScore, 1),
      valueKind: "risk_score",
      priorValue: null,
      delta: null,
      riskScore: formatScore(riskScore, 1),
      contribution: null,
      asOf: latest.asOf,
      quality,
      statusLabel: qualityStatusLabel(quality, hold),
      trend: "UNKNOWN",
      exposed: true,
    }
  })

  const cci = hold ? null : formatScore(latest.cci, 1)
  const prior = latest.cciPrior
  const cciDelta =
    cci != null && prior != null ? formatScore(cci - Number(prior), 1) : formatScore(latest.cciMomentum, 1)

  const regimeInput = classifyRegime({
    cci: cci,
    cciMomentum: cciDelta,
    worseningCount: 0,
    indicatorCount: indicators.filter((i) => i.riskScore != null).length,
    persistenceShare: latest.elevatedCount != null && latest.available
      ? latest.elevatedCount / Math.max(1, latest.available)
      : null,
    priorRegime: null,
  })

  const coverage = latest.coverage
  return {
    mode: "license_safe",
    feedStatus: UI_FEED_STATUS.RESEARCH_SNAPSHOT,
    asOf: latest.asOf,
    updatedAt: snapshot.meta?.generatedFromReportAt || null,
    cci,
    cciDelta,
    coverage,
    coveragePct: coverage == null ? null : formatScore((coverage <= 1 ? coverage : coverage / 100) * 100, 0),
    confidence: latest.confidence || null,
    hold,
    holdReason: hold ? latest.cciStatus || "HOLD" : null,
    pitLabel: normalizePitLabel(latest.pit),
    statusLabel: hold ? "데이터 부족 · 해석 보류" : "연구 스냅샷 · 실시간 피드 아님",
    regime: adaptRegime(regimeInput),
    indicators,
    narrative: buildNarrative({
      cci,
      cciDelta,
      hold,
      indicators: indicators.filter((i) => i.exposed),
      regime: adaptRegime(regimeInput),
      pitLabel: normalizePitLabel(latest.pit),
      research: true,
    }),
    checklist: buildChecklist(indicators),
    history: snapshot.history || null,
    disclaimers: buildDisclaimers({
      note: snapshot.meta?.note,
      warningEvidence: snapshot.meta?.warningEvidence || "INSUFFICIENT_EVIDENCE",
    }),
    warningPolicy: {
      locked: false,
      evidence: snapshot.meta?.warningEvidence || "INSUFFICIENT_EVIDENCE",
      note: "생산용 경고 임계값·가중치는 확정되지 않았습니다.",
    },
    researchNote: snapshot.meta?.note || null,
  }
}

export function buildPreparingSnapshot({ reason } = {}) {
  const indicators = UI_INDICATOR_ORDER.map((id) => {
    const cfg = INDICATOR_CONFIG.find((c) => c.id === id)
    const licenseRestricted = Boolean(cfg?.licenseRestricted) || id === "hy" || id === "bbb"
    return {
      id,
      label: INDICATOR_LABELS[id] || id,
      frequency: cfg?.frequency || null,
      licenseRestricted,
      value: null,
      valueDisplay: null,
      priorValue: null,
      delta: null,
      riskScore: null,
      contribution: null,
      asOf: null,
      quality: licenseRestricted ? "LICENSE_RESTRICTED" : "MISSING",
      statusLabel: licenseRestricted ? "라이선스 제한" : "데이터 준비 중",
      trend: "UNKNOWN",
      exposed: !licenseRestricted,
    }
  })

  return {
    mode: "license_safe",
    feedStatus: UI_FEED_STATUS.PREPARING,
    asOf: null,
    updatedAt: null,
    cci: null,
    cciDelta: null,
    coverage: null,
    coveragePct: null,
    confidence: null,
    hold: true,
    holdReason: reason || "DATA_PREPARING",
    pitLabel: "UNKNOWN",
    statusLabel: "데이터 준비 중",
    regime: {
      id: null,
      label: "국면 미확정",
      status: "NOT_CLASSABLE",
      reasons: ["data_preparing"],
      knownIds: [...REGIME_IDS],
    },
    indicators,
    narrative: [
      "실시간·자동 수집 피드가 아직 연결되지 않았습니다.",
      "임의의 점수를 표시하지 않으며, 데이터가 준비되면 License-safe CCI와 국면이 표시됩니다.",
      "HY·BBB 수치는 ICE 라이선스 확인 전까지 노출하지 않습니다.",
      "Panic Index(VIX·CNN·Put/Call)와 점수를 합산하지 않습니다.",
    ],
    checklist: buildChecklist(indicators),
    history: null,
    cciPath: null,
    series: null,
    inventory: null,
    disclaimers: buildDisclaimers({}),
    warningPolicy: {
      locked: false,
      evidence: "INSUFFICIENT_EVIDENCE",
      note: "생산용 경고 임계값·가중치는 확정되지 않았습니다.",
    },
    researchNote: null,
  }
}

function adaptRegime(regime) {
  if (!regime || regime.regime == null) {
    return {
      id: null,
      label: "국면 미확정",
      status: regime?.status || "NOT_CLASSABLE",
      reasons: regime?.reasons || ["unavailable"],
      knownIds: [...REGIME_IDS],
    }
  }
  return {
    id: regime.regime,
    label: regime.regime,
    status: regime.status || "OK",
    reasons: regime.reasons || [],
    knownIds: [...REGIME_IDS],
  }
}

function normalizePitLabel(pit) {
  if (!pit) return "UNKNOWN"
  const p = String(pit).toUpperCase()
  if (p === "PIT") return "PIT"
  if (p === "NON_PIT") return "NON_PIT"
  if (p === "PARTIAL" || p === "MIXED") return "MIXED"
  if (p === "EMPTY") return "EMPTY"
  return p
}

function qualityStatusLabel(quality, hold) {
  if (hold) return "해석 보류"
  switch (quality) {
    case "VALID":
      return "정상"
    case "STALE":
      return "지연·오래됨"
    case "DELAYED":
      return "발표 지연"
    case "MISSING":
      return "누락"
    case "LICENSE_RESTRICTED":
      return "라이선스 제한"
    case "VINTAGE_UNAVAILABLE":
      return "빈티지 없음"
    default:
      return quality || "미확인"
  }
}

function buildChecklist(indicators) {
  const byId = new Map(indicators.map((i) => [i.id, i]))
  const items = [
    { id: "hy", label: "HY Spread 악화" },
    { id: "bbb", label: "BBB Spread 악화" },
    { id: "sloos", label: "SLOOS 대출 기준 강화" },
    { id: "cpff", label: "단기 자금시장 스트레스" },
    { id: "bank", label: "Bank Soundness 악화" },
    { id: "cre", label: "CRE 연체율 상승" },
    { id: "corp_delinq", label: "기업 연체율 상승" },
  ]
  return items.map((item) => {
    const row = byId.get(item.id)
    if (!row || row.licenseRestricted) {
      return { ...item, state: "UNAVAILABLE", stateLabel: "미확인(라이선스/데이터)", checked: false }
    }
    if (row.riskScore == null && row.quality === "MISSING") {
      return { ...item, state: "UNAVAILABLE", stateLabel: "미확인", checked: false }
    }
    if (row.trend === "WORSENING" || (row.riskScore != null && row.riskScore >= 60)) {
      return { ...item, state: "FLAGGED", stateLabel: "악화 징후(연구 점수)", checked: false }
    }
    if (row.trend === "IMPROVING" || (row.riskScore != null && row.riskScore < 40)) {
      return { ...item, state: "CLEAR", stateLabel: "완화·안정 쪽", checked: false }
    }
    return { ...item, state: "WATCH", stateLabel: "관찰", checked: false }
  })
}

function buildNarrative({ cci, cciDelta, hold, indicators, regime, pitLabel, research, localCache }) {
  /** @type {string[]} */
  const lines = []
  if (hold || cci == null) {
    lines.push("현재 License-safe CCI를 확정 표시할 수 없습니다(데이터 부족 또는 준비 중).")
  } else {
    const srcTag = research
      ? " (연구 스냅샷 기준)"
      : localCache
        ? " (로컬 FRED/FDIC 캐시)"
        : ""
    lines.push(
      `License-safe CCI는 ${cci}입니다${srcTag}. PIT 구분: ${pitLabel}.`,
    )
    if (cciDelta != null) {
      lines.push(
        cciDelta > 0
          ? `이전 관측 대비 ${cciDelta}p 상승(위험 쪽) 방향입니다.`
          : cciDelta < 0
            ? `이전 관측 대비 ${Math.abs(cciDelta)}p 하락(완화 쪽) 방향입니다.`
            : "이전 관측 대비 큰 변화가 없습니다.",
      )
    }
  }
  if (regime?.id) {
    lines.push(`엔진 국면 판정(가설): ${regime.id}. 국면은 경고 단계와 다른 개념입니다.`)
  } else {
    lines.push("국면을 판정할 수 없어 미확정으로 표시합니다.")
  }
  const leaders = [...indicators]
    .filter((i) => i.riskScore != null)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 2)
  if (leaders.length) {
    lines.push(
      `위험 점수 기여가 상대적으로 큰 지표: ${leaders.map((l) => `${l.label}(${l.riskScore})`).join(", ")}.`,
    )
  }
  lines.push("CCI는 매수·매도 신호가 아니며 Panic 점수와 합산하지 않습니다.")
  return lines
}

function buildDisclaimers(opts) {
  return [
    "표시 CCI는 License-safe이며 HY/BBB를 포함하지 않습니다.",
    "Panic Index(VIX·CNN·Put/Call)와 점수를 합산하지 않습니다.",
    "생산용 경고 임계값은 검증 근거 부족(INSUFFICIENT_EVIDENCE)으로 확정되지 않았습니다.",
    "GFC 구간은 NON_PIT 연구 참고이며 실시간(PIT) 검증이 아닙니다.",
    opts?.note || null,
  ].filter(Boolean)
}

/**
 * Assert product DTO never leaks HY/BBB numbers.
 * @param {ReturnType<typeof adaptEngineResultToUi>} dto
 */
export function assertNoHyBbbLeak(dto) {
  for (const row of dto.indicators || []) {
    if (row.id === "hy" || row.id === "bbb") {
      if (row.value != null || row.valueDisplay != null || row.riskScore != null || row.delta != null) {
        return false
      }
    }
  }
  const blob = JSON.stringify(dto.indicators)
  // crude: ensure license rows stay restricted
  return !/"id":"hy"[^}]*"value":[0-9]/.test(blob)
}
