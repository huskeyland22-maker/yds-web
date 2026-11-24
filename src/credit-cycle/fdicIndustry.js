/**
 * FDIC industry aggregate ratios — NEVER average bank-level percentages.
 * Industry ratio = Σ(numerator) / Σ(denominator).
 */

/** Field definitions used for industry rebuild (amounts in $ thousands typically). */
export const FDIC_AMOUNT_FIELDS = {
  // Asset quality
  NCLNLS: {
    id: "NCLNLS",
    role: "numerator",
    label: "Noncurrent loans & leases",
    pairsWith: "LNLS",
  },
  LNLS: {
    id: "LNLS",
    role: "denominator",
    label: "Net loans & leases",
  },
  NTLNLS: {
    id: "NTLNLS",
    role: "numerator",
    label: "Net charge-offs (YTD)",
    pairsWith: "LNLS",
    note: "Charge-off rates are often annualized; treat carefully vs stock ratios",
  },
  LNATRES: {
    id: "LNATRES",
    role: "numerator",
    label: "Loan loss allowance",
    pairsWith: "LNLS",
  },
  // Capital — keep separate; do not splice IDT1CER history with RBC1AAJ
  RBCT1J: {
    id: "RBCT1J",
    role: "numerator",
    label: "Tier 1 capital ($thousands)",
    pairsWith: "RWAJT",
  },
  RWAJT: {
    id: "RWAJT",
    role: "denominator",
    label: "Risk-weighted assets (FDIC RWAJT)",
    note: "Not identical to RBC1AAJ definition — keep as distinct industry_tier1_rwa series",
  },
}

/**
 * @param {Array<Record<string, number | null | undefined>>} bankRows
 * @param {string} numField
 * @param {string} denField
 * @returns {{ ratioPct: number | null, numSum: number, denSum: number, nBanks: number, nUsed: number, status: string }}
 */
export function industryRatioFromAmounts(bankRows, numField, denField) {
  let numSum = 0
  let denSum = 0
  let nUsed = 0
  let nBanks = 0
  for (const row of bankRows) {
    nBanks += 1
    const n = Number(row[numField])
    const d = Number(row[denField])
    if (!Number.isFinite(n) || !Number.isFinite(d)) continue
    if (d === 0) continue
    // Allow zero numerator
    numSum += n
    denSum += d
    nUsed += 1
  }
  if (denSum === 0 || nUsed < 1) {
    return {
      ratioPct: null,
      numSum,
      denSum,
      nBanks,
      nUsed,
      status: "NOT_AVAILABLE",
    }
  }
  return {
    ratioPct: (numSum / denSum) * 100,
    numSum,
    denSum,
    nBanks,
    nUsed,
    status: "OK",
  }
}

/**
 * Forbidden: mean of bank-level ratio fields (e.g. mean of NCLNLSR).
 * Exposed only so tests can assert we do not use it in production paths.
 * @param {number[]} ratioPcts
 */
export function simpleAverageRatios_FORBIDDEN(ratioPcts) {
  const xs = ratioPcts.filter((x) => Number.isFinite(x))
  if (!xs.length) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

/**
 * Build industry snapshots for known amount-based pairs.
 * @param {string} repdte YYYYMMDD
 * @param {Array<Record<string, number | null | undefined>>} bankRows
 */
export function buildIndustrySnapshot(repdte, bankRows) {
  const ncl = industryRatioFromAmounts(bankRows, "NCLNLS", "LNLS")
  const ntl = industryRatioFromAmounts(bankRows, "NTLNLS", "LNLS")
  const all = industryRatioFromAmounts(bankRows, "LNATRES", "LNLS")
  const tier1rwa = industryRatioFromAmounts(bankRows, "RBCT1J", "RWAJT")

  // Capital series kept distinct:
  // - industry_tier1_rwa = ΣRBCT1J/ΣRWAJT (NOT the same series as RBC1AAJ or IDT1CER)
  // - IDT1CER_industry left null unless official industry CET1 totals exist
  // - Never average bank-level IDT1CER/RBC1AAJ percentages
  return {
    observation_date: `${repdte.slice(0, 4)}-${repdte.slice(4, 6)}-${repdte.slice(6, 8)}`,
    repdte,
    NCLNLSR_industry: ncl.ratioPct,
    NCLNLSR_meta: ncl,
    NTLNLSR_industry: ntl.ratioPct,
    NTLNLSR_meta: ntl,
    LNATRESR_industry: all.ratioPct,
    LNATRESR_meta: all,
    industry_tier1_rwa: tier1rwa.ratioPct,
    industry_tier1_rwa_meta: tier1rwa,
    // Alias used by bank soundness GFC path as RBC-like capital input — labeled approx
    RBC1AAJ_industry_approx: tier1rwa.ratioPct,
    RBC1AAJ_meta: {
      ...tier1rwa,
      warning:
        "Uses Tier1/RWA (RBCT1J/RWAJT), not identical to bank-reported RBC1AAJ",
    },
    IDT1CER_industry: null,
    IDT1CER_note:
      "Not reconstructed via simple average of IDT1CER; requires official CET1 industry totals",
    method: "sum_numerator_over_sum_denominator",
    forbidden_method: "simple_average_of_bank_ratios",
  }
}

/**
 * Map observation_date → which capital industry series is usable.
 * @param {string} observationDate
 * @param {{ IDT1CER_industry?: number | null, RBC1AAJ_industry_approx?: number | null }} snap
 */
export function selectIndustryCapital(observationDate, snap) {
  const modernFrom = "2015-01-01"
  if (observationDate >= modernFrom) {
    if (Number.isFinite(snap.IDT1CER_industry) && snap.IDT1CER_industry > 0) {
      return {
        field: "IDT1CER_industry",
        value: snap.IDT1CER_industry,
        note: "modern_industry_tier1",
      }
    }
    if (Number.isFinite(snap.RBC1AAJ_industry_approx)) {
      return {
        field: "RBC1AAJ_industry_approx",
        value: snap.RBC1AAJ_industry_approx,
        note: "modern_fallback_industry_total_rbc_not_spliced",
      }
    }
  } else {
    if (Number.isFinite(snap.RBC1AAJ_industry_approx)) {
      return {
        field: "RBC1AAJ_industry_approx",
        value: snap.RBC1AAJ_industry_approx,
        note: "gfc_era_industry_total_rbc",
      }
    }
    if (Number.isFinite(snap.IDT1CER_industry) && snap.IDT1CER_industry > 0) {
      return {
        field: "IDT1CER_industry",
        value: snap.IDT1CER_industry,
        note: "unexpected_pre2015_idt1cer_industry",
      }
    }
  }
  return { field: null, value: null, note: "industry_capital_unavailable" }
}
