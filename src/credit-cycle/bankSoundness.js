import { BANK_SOUNDNESS_BLEND } from "./config.js"
import { clamp } from "./math.js"
import { computeLevelScore } from "./scores/level.js"
import { selectIndustryCapital } from "./fdicIndustry.js"

/**
 * Pick capital field for a quarter without splicing IDT1CER and RBC1AAJ
 * into one continuous series.
 *
 * @param {string} observationDate
 * @param {{ IDT1CER?: number | null, RBC1AAJ?: number | null }} fields
 */
export function selectCapitalField(observationDate, fields) {
  const modernFrom = BANK_SOUNDNESS_BLEND.capitalFieldByEra.modernFrom
  const preferModern = observationDate >= modernFrom
  if (preferModern) {
    if (Number.isFinite(fields.IDT1CER) && /** @type {number} */ (fields.IDT1CER) > 0) {
      return {
        field: "IDT1CER",
        value: /** @type {number} */ (fields.IDT1CER),
        note: "modern_tier1",
      }
    }
    if (Number.isFinite(fields.RBC1AAJ)) {
      return {
        field: "RBC1AAJ",
        value: /** @type {number} */ (fields.RBC1AAJ),
        note: "modern_fallback_total_rbc_not_spliced_as_same_series",
      }
    }
  } else {
    if (Number.isFinite(fields.RBC1AAJ)) {
      return {
        field: "RBC1AAJ",
        value: /** @type {number} */ (fields.RBC1AAJ),
        note: "gfc_era_total_rbc",
      }
    }
    if (Number.isFinite(fields.IDT1CER) && /** @type {number} */ (fields.IDT1CER) > 0) {
      return {
        field: "IDT1CER",
        value: /** @type {number} */ (fields.IDT1CER),
        note: "pre_modern_unexpected_idt1cer",
      }
    }
  }
  return { field: null, value: null, note: "capital_unavailable" }
}

/**
 * Map a capital ratio (%) to stress 0–100 (lower capital → higher stress).
 * Piecewise heuristic for tests — not a calibrated regulatory model.
 * @param {number} capitalPct
 */
export function capitalToStressScore(capitalPct) {
  if (!Number.isFinite(capitalPct)) return null
  // Rough: 4% → ~90, 8% → ~50, 12% → ~25, 16%+ → ~10
  const stress = 100 - clamp((capitalPct - 2) * (100 / 14), 0, 100)
  return stress == null ? null : Math.round(stress)
}

/**
 * Combine FDIC ratio snapshot (+ optional histories for level on each component).
 * Asset size must NOT be passed as a risk input.
 *
 * @param {object} snap
 * @param {string} snap.observation_date
 * @param {number | null} [snap.IDT1CER]
 * @param {number | null} [snap.RBC1AAJ]
 * @param {number | null} [snap.NCLNLSR]
 * @param {number | null} [snap.NTLNLSR]
 * @param {number | null} [snap.LNATRESR]
 * @param {{ ncl?: number[], ntl?: number[], all?: number[] }} [histories]
 */
export function computeBankSoundnessScore(snap, histories = {}) {
  const cap = selectCapitalField(snap.observation_date, {
    IDT1CER: snap.IDT1CER,
    RBC1AAJ: snap.RBC1AAJ,
  })
  const w = BANK_SOUNDNESS_BLEND.componentWeights

  const capitalStress = cap.value == null ? null : capitalToStressScore(cap.value)

  const nclLevel = histories.ncl?.length
    ? computeLevelScore(histories.ncl, {
        riskDirection: "higher_is_risk",
        minHistory: 4,
      }).score
    : Number.isFinite(snap.NCLNLSR)
      ? clamp(/** @type {number} */ (snap.NCLNLSR) * 15, 0, 100)
      : null

  const ntlLevel = histories.ntl?.length
    ? computeLevelScore(histories.ntl, {
        riskDirection: "higher_is_risk",
        minHistory: 4,
      }).score
    : Number.isFinite(snap.NTLNLSR)
      ? clamp(/** @type {number} */ (snap.NTLNLSR) * 25, 0, 100)
      : null

  const allLevel = histories.all?.length
    ? computeLevelScore(histories.all, {
        riskDirection: "higher_is_risk",
        minHistory: 4,
      }).score
    : Number.isFinite(snap.LNATRESR)
      ? clamp(/** @type {number} */ (snap.LNATRESR) * 20, 0, 100)
      : null

  const comps = [
    { id: "capitalStress", score: capitalStress, w: w.capitalStress },
    { id: "noncurrentLoans", score: nclLevel, w: w.noncurrentLoans },
    { id: "netChargeOff", score: ntlLevel, w: w.netChargeOff },
    { id: "allowance", score: allLevel, w: w.allowance },
  ]

  let availW = 0
  let sum = 0
  const missing = []
  for (const c of comps) {
    if (c.score == null || !Number.isFinite(c.score)) {
      missing.push(c.id)
      continue
    }
    availW += c.w
    sum += c.score * c.w
  }

  if (availW <= 0) {
    return {
      score: null,
      capitalField: cap.field,
      capitalNote: cap.note,
      missing,
      reason: "no_components",
    }
  }

  // Partial weight (do not pretend missing capital is fine)
  const nominal = w.capitalStress + w.noncurrentLoans + w.netChargeOff + w.allowance
  const scorePartial = Math.round((sum / nominal) * 10) / 10

  return {
    score: scorePartial,
    scoreRenormalized: Math.round((sum / availW) * 10) / 10,
    capitalField: cap.field,
    capitalValue: cap.value,
    capitalNote: cap.note,
    components: comps,
    missing,
    coverage: availW / nominal,
    note: "IDT1CER and RBC1AAJ are never concatenated into one history series",
  }
}

/**
 * Industry-aggregate path: uses NCLNLSR/NTLNLSR/LNATRESR industry ratios
 * and distinct capital series via selectIndustryCapital.
 *
 * @param {object} industrySnap from buildIndustrySnapshot (+ optional IDT1CER_industry)
 */
export function computeBankSoundnessFromIndustry(industrySnap, histories = {}) {
  // Pass both capital candidates; selectCapitalField picks by era without splicing histories.
  const scored = computeBankSoundnessScore(
    {
      observation_date: industrySnap.observation_date,
      IDT1CER: industrySnap.IDT1CER_industry,
      RBC1AAJ: industrySnap.RBC1AAJ_industry_approx,
      NCLNLSR: industrySnap.NCLNLSR_industry,
      NTLNLSR: industrySnap.NTLNLSR_industry,
      LNATRESR: industrySnap.LNATRESR_industry,
    },
    histories,
  )
  const industryCap = selectIndustryCapital(industrySnap.observation_date, {
    IDT1CER_industry: industrySnap.IDT1CER_industry,
    RBC1AAJ_industry_approx: industrySnap.RBC1AAJ_industry_approx,
  })
  return {
    ...scored,
    industryCapital: industryCap,
    source: "fdic_industry_aggregate",
  }
}
