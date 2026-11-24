import {
  INDICATOR_CONFIG,
  QUALITY,
  researchIndicators,
  licenseSafeIndicators,
} from "./config.js"
import { computeCoverageAndConfidence } from "./quality.js"

/**
 * Aggregate indicator scores into CCI without silently reweighting to 100%.
 *
 * weightedSum = Σ score_i * w_i  for available i
 * reportedScore = weightedSum / totalNominalWeight * 100? NO —
 * We report:
 *   - rawWeightedAverageAmongAvailable (optional, labeled)
 *   - cciPartial = Σ (score_i * w_i) / Σ w_all_nominal   ← scales with coverage
 *   - cciRenormalized (optional, separate field) = Σ score_i * w_i / Σ w_available
 *
 * Default `cci` uses partial (does not inflate when components missing).
 *
 * @param {Array<{ id: string, score: number | null, quality?: string }>} scores
 * @param {{ mode: 'research'|'license_safe', asOfDate: string, pitStatus?: string }} opts
 */
export function computeCci(scores, opts) {
  const catalog =
    opts.mode === "license_safe" ? licenseSafeIndicators() : researchIndicators()

  /** @type {Map<string, { score: number | null, quality: string }>} */
  const byId = new Map()
  for (const s of scores) {
    byId.set(s.id, {
      score: s.score,
      quality: s.quality ?? (s.score == null ? QUALITY.MISSING : QUALITY.VALID),
    })
  }

  const parts = catalog.map((cfg) => {
    const got = byId.get(cfg.id)
    let quality = got?.quality ?? QUALITY.MISSING
    let score = got?.score ?? null
    if (opts.mode === "license_safe" && cfg.licenseRestricted) {
      quality = QUALITY.LICENSE_RESTRICTED
      score = null
    }
    if (cfg.licenseRestricted && opts.mode === "research") {
      // research may include ICE series; still flag license for reporting
    }
    return {
      id: cfg.id,
      label: cfg.label,
      weightNominal: cfg.weightNominal,
      score,
      quality,
      licenseRestricted: cfg.licenseRestricted,
    }
  })

  const meta = computeCoverageAndConfidence(parts)
  const totalW = parts.reduce((s, p) => s + p.weightNominal, 0)

  let weightedSum = 0
  for (const p of parts) {
    if (p.score == null || !Number.isFinite(p.score)) continue
    if (
      p.quality === QUALITY.MISSING ||
      p.quality === QUALITY.INVALID ||
      p.quality === QUALITY.LICENSE_RESTRICTED ||
      p.quality === QUALITY.VINTAGE_UNAVAILABLE
    ) {
      continue
    }
    // STALE/DELAYED/VALID still contribute numerically but are flagged in meta
    weightedSum += p.score * p.weightNominal
  }

  const cciPartial =
    totalW > 0 ? Math.round((weightedSum / totalW) * 10) / 10 : null
  const cciRenormalized =
    meta.availableWeight > 0
      ? Math.round((weightedSum / meta.availableWeight) * 10) / 10
      : null

  const held = meta.hold
  const licenseExcluded =
    opts.mode === "license_safe"
      ? INDICATOR_CONFIG.filter((c) => c.licenseRestricted).map((c) => c.id)
      : parts.filter((p) => p.licenseRestricted).map((p) => p.id)

  return {
    mode: opts.mode,
    asOfDate: opts.asOfDate,
    cci: held ? null : cciPartial,
    cciPartial,
    cciRenormalized,
    cciStatus: held ? "HOLD_LOW_COVERAGE" : cciPartial == null ? "UNAVAILABLE" : "OK",
    coverage: meta.coverage,
    confidence: meta.confidence,
    availableIndicatorCount: meta.availableCount,
    missingIndicators: meta.missingIndicators,
    staleIndicators: meta.staleIndicators,
    licenseRestrictedIndicators: [
      ...new Set([...meta.licenseRestrictedIndicators, ...licenseExcluded]),
    ],
    components: parts,
    pitValidationStatus: opts.pitStatus ?? "UNSPECIFIED",
    weightsAreHypothesis: true,
    note:
      "cciPartial divides by full nominal weight (missing lowers score). cciRenormalized is separate and must not be labeled as the same index.",
  }
}

export function listDefaultResearchWeights() {
  return INDICATOR_CONFIG.filter((c) => c.inResearchCci).map((c) => ({
    id: c.id,
    weight: c.weightNominal,
    licenseRestricted: c.licenseRestricted,
  }))
}
