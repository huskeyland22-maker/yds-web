/**
 * YDS ETF Quality Score engine (Phase C / D remediation).
 * Independent of Daily Bottom Buy thresholds / signals.
 * Peer-relative when sample ≥ MIN_PEER_RELATIVE; otherwise absolute reference.
 * Missing required fields / low data confidence → pending (never invent scores).
 */

import {
  ETF_QUALITY_FUND_META,
  ETF_QUALITY_META_VERSION,
  getEtfQualityFundMeta,
} from "./etfQualityMeta.js"

export const ETF_QUALITY_STATUS_PENDING = "pending"
export const ETF_QUALITY_STATUS_SCORED = "scored"
export const ETF_QUALITY_LABEL_PENDING = "평가 보류"

/** Nominal pillar weights (sum 100). */
export const ETF_QUALITY_PILLAR_WEIGHTS = Object.freeze({
  performance: 25,
  risk: 20,
  cost: 15,
  liquidity: 15,
  composition: 15,
  stability: 10,
})

export const ETF_QUALITY_PEER_GROUP_LABELS = Object.freeze({
  core_style: "Core / Style",
  broad_tech: "Broad Technology",
  software_security: "Software / Security",
  semiconductor: "Semiconductor",
  ai_robotics: "AI / Robotics",
  infrastructure: "Infrastructure",
  sector_spdr: "Sector SPDR",
})

/** Minimum eligible peers for relative ranking; below → absolute reference. */
export const ETF_QUALITY_MIN_PEER_RELATIVE = 3

/** Minimum data coverage (%) to publish a score (confidence gate). */
export const ETF_QUALITY_MIN_DATA_COVERAGE_PCT = 70

/**
 * If excluded pillars' nominal weight sum exceeds this, hold evaluation
 * (renormalization would over-amplify remaining pillars).
 */
export const ETF_QUALITY_MAX_EXCLUDED_NOMINAL = 25

const MIN_BARS_3Y = 700
const TRADING_DAYS_YEAR = 252

/** Absolute reference bands: good → 100, bad → 0 (linear clamp). */
const ABS_BANDS = Object.freeze({
  ret3y: { direction: "higher", good: 0.15, bad: 0 },
  ret5y: { direction: "higher", good: 0.12, bad: 0 },
  ret10y: { direction: "higher", good: 0.1, bad: 0 },
  vol3y: { direction: "lower", good: 0.12, bad: 0.35 },
  mdd3y: { direction: "lower", good: 0.15, bad: 0.55 },
  recoveryDays: { direction: "lower", good: 60, bad: 400 },
  expenseRatio: { direction: "lower", good: 0.05, bad: 0.75 },
  dollarVolume: { direction: "higher", good: 500_000_000, bad: 10_000_000 },
  spread: { direction: "lower", good: 0.02, bad: 0.2 },
  top10: { direction: "lower", good: 25, bad: 70 },
  maxWeight: { direction: "lower", good: 5, bad: 25 },
  aum: { direction: "higher", good: 50_000_000_000, bad: 500_000_000 },
  age: { direction: "higher", good: 15, bad: 3 },
})

/**
 * @param {number | null | undefined} v
 * @param {number} [digits]
 */
function round(v, digits = 2) {
  if (v == null || !Number.isFinite(v)) return null
  const p = 10 ** digits
  return Math.round(v * p) / p
}

/**
 * @param {string} inceptionDate YYYY-MM-DD
 * @param {string | null} asOfDate
 */
function yearsSinceInception(inceptionDate, asOfDate) {
  const start = Date.parse(`${inceptionDate}T00:00:00Z`)
  const end = Date.parse(`${(asOfDate || new Date().toISOString().slice(0, 10))}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  return (end - start) / (365.25 * 86400 * 1000)
}

/**
 * Annualized return between two closes.
 * @param {number} start
 * @param {number} end
 * @param {number} years
 */
function annReturn(start, end, years) {
  if (!(start > 0) || !(end > 0) || !(years > 0)) return null
  return (end / start) ** (1 / years) - 1
}

/**
 * @param {{ date?: string, close: number, volume?: number }[]} bars
 */
export function computeQualityPriceMetrics(bars) {
  if (!Array.isArray(bars) || bars.length < 2) {
    return {
      ok: false,
      error: "insufficient_bars",
      barCount: Array.isArray(bars) ? bars.length : 0,
      asOfDate: null,
      ret3y: null,
      ret5y: null,
      ret10y: null,
      vol3y: null,
      mdd3y: null,
      recoveryDays: null,
      avgDollarVolume20d: null,
    }
  }

  const closes = bars.map((b) => Number(b.close))
  const volumes = bars.map((b) => Number(b.volume ?? 0))
  const n = closes.length
  const asOfDate = bars[n - 1]?.date ?? null
  const last = closes[n - 1]

  function lookbackReturn(years) {
    const idx = n - 1 - Math.round(years * TRADING_DAYS_YEAR)
    if (idx < 0) return null
    return annReturn(closes[idx], last, years)
  }

  const ret3y = lookbackReturn(3)
  const ret5y = lookbackReturn(5)
  const ret10y = lookbackReturn(10)

  const start3 = n - 1 - Math.round(3 * TRADING_DAYS_YEAR)
  let vol3y = null
  let mdd3y = null
  let recoveryDays = null
  if (start3 >= 0) {
    const slice = closes.slice(start3)
    const rets = []
    for (let i = 1; i < slice.length; i++) {
      if (slice[i - 1] > 0) rets.push(slice[i] / slice[i - 1] - 1)
    }
    if (rets.length > 1) {
      const mean = rets.reduce((a, b) => a + b, 0) / rets.length
      const varSum = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1)
      vol3y = Math.sqrt(varSum) * Math.sqrt(TRADING_DAYS_YEAR)
    }
    let peak = slice[0]
    let maxDd = 0
    let troughIdx = 0
    for (let i = 0; i < slice.length; i++) {
      const c = slice[i]
      if (c > peak) peak = c
      const dd = peak > 0 ? (c - peak) / peak : 0
      if (dd < maxDd) {
        maxDd = dd
        troughIdx = i
      }
    }
    // Store MDD as a non-negative magnitude (0.30 = -30% peak-to-trough).
    // ABS_BANDS / peer "lower is better" expect positive drawdown size — signed
    // negatives inverted ranking (deeper DD scored better) and absolute≈100.
    mdd3y = maxDd < 0 ? -maxDd : 0
    if (maxDd < 0) {
      const recoveryLevel = peak
      let recovered = null
      for (let i = troughIdx + 1; i < slice.length; i++) {
        if (slice[i] >= recoveryLevel) {
          recovered = i - troughIdx
          break
        }
      }
      recoveryDays = recovered
    } else {
      recoveryDays = 0
    }
  }

  let avgDollarVolume20d = null
  {
    const win = Math.min(20, n)
    let sum = 0
    let count = 0
    for (let i = n - win; i < n; i++) {
      const c = closes[i]
      const v = volumes[i]
      if (c > 0 && Number.isFinite(v) && v >= 0) {
        sum += c * v
        count += 1
      }
    }
    if (count > 0) avgDollarVolume20d = sum / count
  }

  const ok3y = n >= MIN_BARS_3Y && ret3y != null
  return {
    ok: ok3y,
    error: ok3y ? null : "insufficient_3y_price_history",
    barCount: n,
    asOfDate,
    ret3y,
    ret5y,
    ret10y,
    vol3y,
    mdd3y,
    recoveryDays,
    avgDollarVolume20d,
  }
}

/**
 * Peer percentile 0–100. Higher is better after direction applied.
 * Ties use average mid-rank so identical values share the same score;
 * when all peers are tied the result is the neutral 50 (order-independent).
 * @param {number} value
 * @param {number[]} peers
 * @param {'higher' | 'lower'} direction
 */
export function peerPercentile(value, peers, direction) {
  const clean = peers.filter((x) => x != null && Number.isFinite(x))
  if (!Number.isFinite(value) || clean.length === 0) return null
  if (clean.length === 1) return 50
  const scored = clean.map((v) => (direction === "higher" ? v : -v))
  const target = direction === "higher" ? value : -value
  let below = 0
  let equal = 0
  for (const s of scored) {
    if (s < target) below += 1
    else if (s === target) equal += 1
  }
  if (equal === 0) return null
  const midRank = below + (equal - 1) / 2
  return (midRank / (scored.length - 1)) * 100
}

/**
 * Absolute reference score 0–100 from fixed good/bad bands.
 * @param {number | null | undefined} value
 * @param {{ direction: 'higher' | 'lower', good: number, bad: number }} band
 */
export function absoluteMetricScore(value, band) {
  if (value == null || !Number.isFinite(value) || !band) return null
  const { direction, good, bad } = band
  if (direction === "higher") {
    if (value >= good) return 100
    if (value <= bad) return 0
    if (good === bad) return 50
    return ((value - bad) / (good - bad)) * 100
  }
  if (value <= good) return 100
  if (value >= bad) return 0
  if (good === bad) return 50
  return ((bad - value) / (bad - good)) * 100
}

/**
 * @param {number | null | undefined} value
 * @param {number[]} peers
 * @param {'higher' | 'lower'} direction
 * @param {'peer_relative' | 'absolute_reference'} mode
 * @param {keyof typeof ABS_BANDS} bandKey
 */
function metricScore(value, peers, direction, mode, bandKey) {
  if (mode === "peer_relative") return peerPercentile(value, peers, direction)
  return absoluteMetricScore(value, ABS_BANDS[bandKey])
}

/**
 * @param {Record<string, number | null | undefined>} parts
 * @returns {{ score: number | null, usedKeys: string[] }}
 */
function averageParts(parts) {
  const used = []
  let sum = 0
  for (const [k, v] of Object.entries(parts)) {
    if (v == null || !Number.isFinite(v)) continue
    used.push(k)
    sum += v
  }
  if (!used.length) return { score: null, usedKeys: used }
  return { score: sum / used.length, usedKeys: used }
}

/**
 * Required slots (always expected when eligible) + optional slots.
 * @param {ReturnType<typeof buildQualityFeatureRow>} row
 */
function computeCoverage(row) {
  const requiredSlots = [
    row.meta?.expenseRatioPct != null,
    row.meta?.aumUsd != null,
    Boolean(row.meta?.inceptionDate),
    row.price?.ok === true,
  ]
  const optionalSlots = [
    row.price?.ret5y != null,
    row.price?.ret10y != null,
    row.price?.recoveryDays != null,
    row.meta?.top10WeightPct != null,
    row.meta?.maxNameWeightPct != null,
    row.meta?.medianSpreadPct != null,
  ]
  const requiredOk = requiredSlots.filter(Boolean).length
  const optionalOk = optionalSlots.filter(Boolean).length
  const total = requiredSlots.length + optionalSlots.length
  const dataCoveragePct = round(((requiredOk + optionalOk) / total) * 100, 1)
  return { dataCoveragePct, requiredOk, optionalOk, requiredTotal: requiredSlots.length, optionalTotal: optionalSlots.length }
}

/**
 * Confidence 0–100 is separate from quality score.
 * @param {{ dataCoveragePct: number, excludedNominalSum: number, peerSampleSize: number, scoringMode: string }} args
 */
function computeDataConfidence({ dataCoveragePct, excludedNominalSum, peerSampleSize, scoringMode }) {
  let score = dataCoveragePct
  // Penalize heavy renormalization.
  if (excludedNominalSum > 0) {
    score -= Math.min(30, excludedNominalSum * 0.6)
  }
  if (scoringMode === "absolute_reference") {
    score -= peerSampleSize <= 1 ? 8 : 4
  }
  score = Math.max(0, Math.min(100, score))
  return round(score, 1)
}

/**
 * @param {object} args
 */
function buildPending({
  symbol,
  peerGroup,
  reasons,
  meta,
  price,
  sources,
  dataCoveragePct = 0,
  dataConfidence = null,
  scoringMode = null,
  peerSampleSize = null,
  pillars = null,
  appliedWeights = null,
}) {
  return {
    status: ETF_QUALITY_STATUS_PENDING,
    label: ETF_QUALITY_LABEL_PENDING,
    score: null,
    grade: null,
    peerGroup: peerGroup ?? null,
    peerGroupLabel: peerGroup ? ETF_QUALITY_PEER_GROUP_LABELS[peerGroup] ?? peerGroup : null,
    pendingReasons: reasons,
    dataCoveragePct,
    dataConfidence,
    scoringMode,
    peerSampleSize,
    nominalWeights: { ...ETF_QUALITY_PILLAR_WEIGHTS },
    appliedWeights,
    pillars,
    metrics: price
      ? {
          ret3y: round(price.ret3y != null ? price.ret3y * 100 : null, 2),
          ret5y: round(price.ret5y != null ? price.ret5y * 100 : null, 2),
          ret10y: round(price.ret10y != null ? price.ret10y * 100 : null, 2),
          vol3y: round(price.vol3y != null ? price.vol3y * 100 : null, 2),
          mdd3y: round(price.mdd3y != null ? price.mdd3y * 100 : null, 2),
          recoveryDays: price.recoveryDays,
          avgDollarVolume20d: round(price.avgDollarVolume20d, 0),
          barCount: price.barCount,
        }
      : null,
    asOfDate: price?.asOfDate ?? meta?.aumAsOf ?? meta?.expenseRatioAsOf ?? null,
    sources: sources ?? [],
    metaVersion: ETF_QUALITY_META_VERSION,
    morningstar: {
      status: "license_required",
      label: "라이선스 확보 후 표시",
      starRating: null,
      medalistRating: null,
    },
    symbol,
  }
}

/**
 * Build per-symbol feature row (pre-peer scoring).
 * @param {string} symbol
 * @param {{ date?: string, close: number, volume?: number }[] | null | undefined} bars
 */
export function buildQualityFeatureRow(symbol, bars) {
  const meta = getEtfQualityFundMeta(symbol)
  const price = computeQualityPriceMetrics(Array.isArray(bars) ? bars : [])
  const reasons = []
  if (!meta) reasons.push("missing_fund_meta")
  if (meta && (meta.expenseRatioPct == null || !Number.isFinite(meta.expenseRatioPct))) {
    reasons.push("missing_expense_ratio")
  }
  if (meta && (meta.aumUsd == null || !Number.isFinite(meta.aumUsd) || meta.aumUsd <= 0)) {
    reasons.push("missing_aum")
  }
  if (meta && !meta.inceptionDate) reasons.push("missing_inception_date")
  if (!price.ok) reasons.push(price.error || "insufficient_3y_price_history")

  const sources = []
  if (meta?.expenseRatioSource) {
    sources.push({
      field: "expenseRatio",
      source: meta.expenseRatioSource,
      asOf: meta.expenseRatioAsOf,
    })
  }
  if (meta?.aumSource) sources.push({ field: "aum", source: meta.aumSource, asOf: meta.aumAsOf })
  if (meta?.inceptionSource) {
    sources.push({ field: "inception", source: meta.inceptionSource, asOf: meta.inceptionDate })
  }
  if (meta?.holdingsSource) {
    sources.push({ field: "holdings", source: meta.holdingsSource, asOf: meta.holdingsAsOf })
  }
  if (meta?.spreadSource) {
    sources.push({ field: "spread", source: meta.spreadSource, asOf: meta.spreadAsOf })
  }
  if (price.asOfDate) {
    sources.push({
      field: "priceSeries",
      source: "YDS Yahoo OHLCV (daily_bottom_buy fetch path)",
      asOf: price.asOfDate,
    })
  }

  return {
    symbol: String(symbol).toUpperCase(),
    meta,
    price,
    reasons,
    sources,
    eligible: reasons.length === 0,
  }
}

/**
 * Score a peer cohort of feature rows (eligible only participate in ranks;
 * ineligible stay pending).
 * @param {ReturnType<typeof buildQualityFeatureRow>[]} rows
 */
export function scoreQualityPeerCohort(rows) {
  const eligible = rows.filter((r) => r.eligible)
  /** @type {Map<string, object>} */
  const out = new Map()

  for (const row of rows) {
    if (!row.eligible) {
      const cov = computeCoverage(row)
      out.set(
        row.symbol,
        buildPending({
          symbol: row.symbol,
          peerGroup: row.meta?.peerGroup ?? null,
          reasons: row.reasons,
          meta: row.meta,
          price: row.price,
          sources: row.sources,
          dataCoveragePct: cov.dataCoveragePct,
          dataConfidence: {
            score: computeDataConfidence({
              dataCoveragePct: cov.dataCoveragePct,
              excludedNominalSum: 100,
              peerSampleSize: 0,
              scoringMode: "peer_relative",
            }),
            dataCoveragePct: cov.dataCoveragePct,
            holdEvaluation: true,
            holdReasons: row.reasons,
          },
          peerSampleSize: 0,
        }),
      )
    }
  }

  if (!eligible.length) return out

  const peerGroup = eligible[0].meta.peerGroup
  const peerSampleSize = eligible.length
  const scoringMode =
    peerSampleSize >= ETF_QUALITY_MIN_PEER_RELATIVE ? "peer_relative" : "absolute_reference"

  const rets3 = eligible.map((r) => r.price.ret3y)
  const rets5 = eligible.map((r) => r.price.ret5y)
  const rets10 = eligible.map((r) => r.price.ret10y)
  const vols = eligible.map((r) => r.price.vol3y)
  const mdds = eligible.map((r) => r.price.mdd3y)
  const recoveries = eligible.map((r) => r.price.recoveryDays)
  const dvs = eligible.map((r) => r.price.avgDollarVolume20d)
  const ers = eligible.map((r) => r.meta.expenseRatioPct)
  const aums = eligible.map((r) => r.meta.aumUsd)
  const ages = eligible.map((r) => yearsSinceInception(r.meta.inceptionDate, r.price.asOfDate))
  const top10s = eligible.map((r) => r.meta.top10WeightPct)
  const maxWs = eligible.map((r) => r.meta.maxNameWeightPct)
  const spreads = eligible.map((r) => r.meta.medianSpreadPct)

  for (const row of eligible) {
    const mode = scoringMode
    const perf = averageParts({
      ret3y: metricScore(row.price.ret3y, rets3, "higher", mode, "ret3y"),
      ret5y: metricScore(row.price.ret5y, rets5, "higher", mode, "ret5y"),
      ret10y: metricScore(row.price.ret10y, rets10, "higher", mode, "ret10y"),
    })
    const risk = averageParts({
      vol3y: metricScore(row.price.vol3y, vols, "lower", mode, "vol3y"),
      mdd3y: metricScore(row.price.mdd3y, mdds, "lower", mode, "mdd3y"),
      recoveryDays: metricScore(row.price.recoveryDays, recoveries, "lower", mode, "recoveryDays"),
    })
    const cost = averageParts({
      expenseRatio: metricScore(row.meta.expenseRatioPct, ers, "lower", mode, "expenseRatio"),
    })
    const liquidity = averageParts({
      dollarVolume: metricScore(row.price.avgDollarVolume20d, dvs, "higher", mode, "dollarVolume"),
      spread: metricScore(row.meta.medianSpreadPct, spreads, "lower", mode, "spread"),
    })

    const hasTop10 = row.meta.top10WeightPct != null && Number.isFinite(row.meta.top10WeightPct)
    const hasMaxW = row.meta.maxNameWeightPct != null && Number.isFinite(row.meta.maxNameWeightPct)
    const composition = averageParts({
      top10: hasTop10 ? metricScore(row.meta.top10WeightPct, top10s, "lower", mode, "top10") : null,
      maxWeight: hasMaxW ? metricScore(row.meta.maxNameWeightPct, maxWs, "lower", mode, "maxWeight") : null,
    })
    const compositionExcludeReason =
      !hasTop10 && !hasMaxW
        ? "missing_official_top10"
        : composition.score == null
          ? "composition_unscorable"
          : null

    const age = yearsSinceInception(row.meta.inceptionDate, row.price.asOfDate)
    const stability = averageParts({
      aum: metricScore(row.meta.aumUsd, aums, "higher", mode, "aum"),
      age: metricScore(age, ages, "higher", mode, "age"),
    })

    /** @type {Record<string, { nominal: number, score: number | null, usedKeys: string[], excludeReason: string | null }>} */
    const pillarMap = {
      performance: {
        nominal: ETF_QUALITY_PILLAR_WEIGHTS.performance,
        score: perf.score,
        usedKeys: perf.usedKeys,
        excludeReason: perf.score == null ? "missing_performance_metrics" : null,
      },
      risk: {
        nominal: ETF_QUALITY_PILLAR_WEIGHTS.risk,
        score: risk.score,
        usedKeys: risk.usedKeys,
        excludeReason: risk.score == null ? "missing_risk_metrics" : null,
      },
      cost: {
        nominal: ETF_QUALITY_PILLAR_WEIGHTS.cost,
        score: cost.score,
        usedKeys: cost.usedKeys,
        excludeReason: cost.score == null ? "missing_expense_ratio" : null,
      },
      liquidity: {
        nominal: ETF_QUALITY_PILLAR_WEIGHTS.liquidity,
        score: liquidity.score,
        usedKeys: liquidity.usedKeys,
        excludeReason: liquidity.score == null ? "missing_liquidity_metrics" : null,
      },
      composition: {
        nominal: ETF_QUALITY_PILLAR_WEIGHTS.composition,
        score: composition.score,
        usedKeys: composition.usedKeys,
        excludeReason: compositionExcludeReason,
      },
      stability: {
        nominal: ETF_QUALITY_PILLAR_WEIGHTS.stability,
        score: stability.score,
        usedKeys: stability.usedKeys,
        excludeReason: stability.score == null ? "missing_stability_metrics" : null,
      },
    }

    const active = Object.entries(pillarMap).filter(([, p]) => p.score != null)
    const excluded = Object.entries(pillarMap).filter(([, p]) => p.score == null)
    const excludedNominalSum = excluded.reduce((s, [, p]) => s + p.nominal, 0)
    const cov = computeCoverage(row)

    /** @type {Record<string, number>} */
    const appliedWeights = {}
    /** @type {Record<string, object>} */
    const pillars = {}

    if (!active.length) {
      for (const [key, p] of Object.entries(pillarMap)) {
        pillars[key] = {
          nominalWeight: p.nominal,
          appliedWeight: 0,
          score: null,
          excluded: true,
          excludeReason: p.excludeReason,
          usedMetrics: [],
        }
      }
      const confidenceScore = computeDataConfidence({
        dataCoveragePct: cov.dataCoveragePct,
        excludedNominalSum: 100,
        peerSampleSize,
        scoringMode: mode,
      })
      out.set(
        row.symbol,
        buildPending({
          symbol: row.symbol,
          peerGroup,
          reasons: ["no_scorable_pillars"],
          meta: row.meta,
          price: row.price,
          sources: row.sources,
          dataCoveragePct: cov.dataCoveragePct,
          dataConfidence: {
            score: confidenceScore,
            dataCoveragePct: cov.dataCoveragePct,
            excludedPillars: excluded.map(([key, p]) => ({
              key,
              nominalWeight: p.nominal,
              reason: p.excludeReason,
            })),
            holdEvaluation: true,
            holdReasons: ["no_scorable_pillars"],
          },
          scoringMode: mode,
          peerSampleSize,
          pillars,
          appliedWeights: null,
        }),
      )
      continue
    }

    const weightSum = active.reduce((s, [, p]) => s + p.nominal, 0)
    let total = 0
    for (const [key, p] of Object.entries(pillarMap)) {
      if (p.score == null) {
        pillars[key] = {
          nominalWeight: p.nominal,
          appliedWeight: 0,
          score: null,
          excluded: true,
          excludeReason: p.excludeReason,
          usedMetrics: [],
        }
        continue
      }
      const applied = (p.nominal / weightSum) * 100
      appliedWeights[key] = round(applied, 2)
      total += (p.score * applied) / 100
      pillars[key] = {
        nominalWeight: p.nominal,
        appliedWeight: round(applied, 2),
        score: round(p.score, 1),
        excluded: false,
        excludeReason: null,
        usedMetrics: p.usedKeys,
      }
    }

    const score = round(total, 1)
    const grade =
      score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "E"

    const holdReasons = []
    if (cov.dataCoveragePct < ETF_QUALITY_MIN_DATA_COVERAGE_PCT) {
      holdReasons.push("low_data_coverage")
    }
    if (excludedNominalSum > ETF_QUALITY_MAX_EXCLUDED_NOMINAL) {
      holdReasons.push("excessive_pillar_exclusion")
    }

    const confidenceScore = computeDataConfidence({
      dataCoveragePct: cov.dataCoveragePct,
      excludedNominalSum,
      peerSampleSize,
      scoringMode: mode,
    })
    const dataConfidence = {
      score: confidenceScore,
      dataCoveragePct: cov.dataCoveragePct,
      excludedPillars: excluded.map(([key, p]) => ({
        key,
        nominalWeight: p.nominal,
        reason: p.excludeReason,
      })),
      appliedWeights: { ...appliedWeights },
      nominalWeights: { ...ETF_QUALITY_PILLAR_WEIGHTS },
      peerSampleSize,
      scoringMode: mode,
      holdEvaluation: holdReasons.length > 0,
      holdReasons,
      minDataCoveragePct: ETF_QUALITY_MIN_DATA_COVERAGE_PCT,
      maxExcludedNominal: ETF_QUALITY_MAX_EXCLUDED_NOMINAL,
    }

    if (holdReasons.length) {
      out.set(
        row.symbol,
        buildPending({
          symbol: row.symbol,
          peerGroup,
          reasons: holdReasons,
          meta: row.meta,
          price: row.price,
          sources: row.sources,
          dataCoveragePct: cov.dataCoveragePct,
          dataConfidence,
          scoringMode: mode,
          peerSampleSize,
          pillars,
          appliedWeights,
        }),
      )
      continue
    }

    out.set(row.symbol, {
      status: ETF_QUALITY_STATUS_SCORED,
      label: `YDS ${score}`,
      score,
      grade,
      peerGroup,
      peerGroupLabel: ETF_QUALITY_PEER_GROUP_LABELS[peerGroup] ?? peerGroup,
      pendingReasons: [],
      dataCoveragePct: cov.dataCoveragePct,
      dataConfidence,
      scoringMode: mode,
      peerSampleSize,
      nominalWeights: { ...ETF_QUALITY_PILLAR_WEIGHTS },
      appliedWeights,
      pillars,
      metrics: {
        expenseRatioPct: row.meta.expenseRatioPct,
        aumUsd: row.meta.aumUsd,
        inceptionDate: row.meta.inceptionDate,
        yearsSinceInception: round(age, 2),
        ret3y: round(row.price.ret3y * 100, 2),
        ret5y: round(row.price.ret5y != null ? row.price.ret5y * 100 : null, 2),
        ret10y: round(row.price.ret10y != null ? row.price.ret10y * 100 : null, 2),
        vol3y: round(row.price.vol3y != null ? row.price.vol3y * 100 : null, 2),
        mdd3y: round(row.price.mdd3y != null ? row.price.mdd3y * 100 : null, 2),
        recoveryDays: row.price.recoveryDays,
        avgDollarVolume20d: round(row.price.avgDollarVolume20d, 0),
        top10WeightPct: row.meta.top10WeightPct,
        maxNameWeightPct: row.meta.maxNameWeightPct,
        medianSpreadPct: row.meta.medianSpreadPct,
        barCount: row.price.barCount,
      },
      asOfDate: row.price.asOfDate,
      sources: row.sources,
      metaVersion: ETF_QUALITY_META_VERSION,
      morningstar: {
        status: "license_required",
        label: "라이선스 확보 후 표시",
        starRating: null,
        medalistRating: null,
      },
      symbol: row.symbol,
    })
  }

  return out
}

/**
 * Evaluate all product ETFs. BarsBySymbol may be partial.
 * @param {Iterable<string>} symbols
 * @param {Record<string, { date?: string, close: number, volume?: number }[]>} barsBySymbol
 */
export function evaluateEtfQualityUniverse(symbols, barsBySymbol = {}) {
  const list = [...symbols].map((s) => String(s).toUpperCase())
  const rows = list.map((symbol) => buildQualityFeatureRow(symbol, barsBySymbol[symbol]))

  /** @type {Map<string, ReturnType<typeof buildQualityFeatureRow>[]>} */
  const byPeer = new Map()
  for (const row of rows) {
    const g = row.meta?.peerGroup || "_unknown"
    if (!byPeer.has(g)) byPeer.set(g, [])
    byPeer.get(g).push(row)
  }

  /** @type {Record<string, object>} */
  const results = {}
  for (const [, cohort] of byPeer) {
    const scored = scoreQualityPeerCohort(cohort)
    for (const [sym, val] of scored) results[sym] = val
  }
  return results
}

/**
 * Placeholder used when bars/peer context are unavailable (card scaffold).
 * @param {string | null | undefined} symbol
 */
export function resolveEtfQualityEvaluation(symbol) {
  const key = String(symbol ?? "")
    .trim()
    .toUpperCase()
  const meta = getEtfQualityFundMeta(key)
  const reasons = ["awaiting_price_context"]
  if (!meta) reasons.unshift("missing_fund_meta")
  else {
    if (meta.aumUsd == null) reasons.unshift("missing_aum")
    if (meta.expenseRatioPct == null) reasons.unshift("missing_expense_ratio")
    if (!meta.inceptionDate) reasons.unshift("missing_inception_date")
  }
  return buildPending({
    symbol: key || null,
    peerGroup: meta?.peerGroup ?? null,
    reasons,
    meta,
    price: null,
    sources: meta
      ? [
          meta.expenseRatioSource && {
            field: "expenseRatio",
            source: meta.expenseRatioSource,
            asOf: meta.expenseRatioAsOf,
          },
          meta.aumSource && { field: "aum", source: meta.aumSource, asOf: meta.aumAsOf },
          meta.inceptionSource && {
            field: "inception",
            source: meta.inceptionSource,
            asOf: meta.inceptionDate,
          },
        ].filter(Boolean)
      : [],
  })
}

export { ETF_QUALITY_FUND_META, ETF_QUALITY_META_VERSION, getEtfQualityFundMeta }
