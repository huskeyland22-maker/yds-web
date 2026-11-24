/**
 * License-safe / restricted series metadata — browser-safe (no node:fs).
 */

export const LICENSE_SAFE_SERIES = {
  sloos: {
    seriesId: "DRTSCILM",
    frequency: "quarterly",
    unit: "net % tightening",
    label: "Fed SLOOS",
  },
  cpff: {
    seriesId: "CPFF",
    frequency: "daily",
    unit: "pp (CP−EFFR)",
    label: "CPFF 자금시장",
  },
  cre: {
    seriesId: "DRCRELEXFACBS",
    frequency: "quarterly",
    unit: "% delinquency",
    label: "CRE Delinquency",
  },
  corp_delinq: {
    seriesId: "DRBLACBS",
    frequency: "quarterly",
    unit: "% delinquency",
    label: "Corporate Delinquency",
  },
  bank: {
    seriesId: "FDIC_BANK_SOUNDNESS",
    frequency: "quarterly",
    unit: "risk score 0–100",
    label: "Bank Soundness",
  },
}

export const RESTRICTED_SERIES = {
  hy: { seriesId: "BAMLH0A0HYM2", frequency: "daily", label: "HY Spread" },
  bbb: { seriesId: "BAMLC0A4CBBB", frequency: "daily", label: "BBB Spread" },
}
