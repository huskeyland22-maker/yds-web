/**
 * Curated ETF quality fund metadata (Phase C / D).
 * Values come only from issuer pages / fact sheets.
 * Missing required fields stay null → engine marks evaluation pending (no invented scores).
 * Morningstar fields are intentionally omitted from this feed.
 */

/**
 * @typedef {'core_style' | 'broad_tech' | 'software_security' | 'semiconductor' | 'ai_robotics' | 'infrastructure' | 'sector_spdr'} EtfQualityPeerGroup
 */

/**
 * @typedef {{
 *   symbol: string
 *   peerGroup: EtfQualityPeerGroup
 *   expenseRatioPct: number | null
 *   expenseRatioAsOf: string | null
 *   expenseRatioSource: string | null
 *   aumUsd: number | null
 *   aumAsOf: string | null
 *   aumSource: string | null
 *   inceptionDate: string | null
 *   inceptionSource: string | null
 *   top10WeightPct: number | null
 *   maxNameWeightPct: number | null
 *   holdingsAsOf: string | null
 *   holdingsSource: string | null
 *   medianSpreadPct: number | null
 *   spreadAsOf: string | null
 *   spreadSource: string | null
 * }} EtfQualityFundMeta
 */

/** Snapshot id for UI / audit. */
export const ETF_QUALITY_META_VERSION = "etf_quality_meta_v2_2026-11-18"

/**
 * @type {Readonly<Record<string, EtfQualityFundMeta>>}
 */
export const ETF_QUALITY_FUND_META = Object.freeze({
  VOO: {
    symbol: "VOO",
    peerGroup: "core_style",
    expenseRatioPct: 0.03,
    expenseRatioAsOf: "2025-04-29",
    expenseRatioSource: "https://investor.vanguard.com/investment-products/etfs/profile/voo",
    aumUsd: 1_032_260_000_000,
    aumAsOf: "2026-09-30",
    aumSource: "https://fund-docs.vanguard.com/F0968.pdf",
    inceptionDate: "2010-09-07",
    inceptionSource: "https://investor.vanguard.com/investment-products/etfs/profile/voo",
    top10WeightPct: 40.6,
    maxNameWeightPct: 8.4,
    holdingsAsOf: "2026-09-30",
    holdingsSource: "https://fund-docs.vanguard.com/F0968.pdf",
    medianSpreadPct: null,
    spreadAsOf: null,
    spreadSource: null,
  },
  QQQM: {
    symbol: "QQQM",
    peerGroup: "core_style",
    expenseRatioPct: 0.15,
    expenseRatioAsOf: "2026-09-30",
    expenseRatioSource:
      "https://www.invesco.com/us-rest/contentdetail?contentId=5b4d8e58e0737710VgnVCM1000006e36b50aRCRD&dnsName=us",
    // Issuer fact sheet did not publish AUM on the verified page → required field missing.
    aumUsd: null,
    aumAsOf: null,
    aumSource: null,
    inceptionDate: "2020-10-13",
    inceptionSource:
      "https://www.invesco.com/us-rest/contentdetail?contentId=5b4d8e58e0737710VgnVCM1000006e36b50aRCRD&dnsName=us",
    top10WeightPct: 49.57,
    maxNameWeightPct: 8.36,
    holdingsAsOf: "2026-09-30",
    holdingsSource:
      "https://www.invesco.com/us-rest/contentdetail?contentId=5b4d8e58e0737710VgnVCM1000006e36b50aRCRD&dnsName=us",
    medianSpreadPct: null,
    spreadAsOf: null,
    spreadSource: null,
  },
  SCHD: {
    symbol: "SCHD",
    peerGroup: "core_style",
    expenseRatioPct: 0.06,
    expenseRatioAsOf: "2026-11-16",
    expenseRatioSource: "https://www.schwabassetmanagement.com/products/schd",
    aumUsd: 123_722_686_095.39,
    aumAsOf: "2026-11-16",
    aumSource: "https://www.schwabassetmanagement.com/products/schd",
    inceptionDate: "2011-10-20",
    inceptionSource: "https://www.schwabassetmanagement.com/products/schd",
    top10WeightPct: 41.61,
    maxNameWeightPct: 4.56,
    holdingsAsOf: "2026-11-16",
    holdingsSource: "https://www.schwabassetmanagement.com/products/schd",
    medianSpreadPct: null,
    spreadAsOf: null,
    spreadSource: null,
  },
  AVUV: {
    symbol: "AVUV",
    peerGroup: "core_style",
    expenseRatioPct: 0.25,
    expenseRatioAsOf: "2026-01-01",
    expenseRatioSource:
      "https://www.avantisinvestors.com/avantis-investments/en-us/avantis-us-small-cap-value-etf/AVUV/",
    aumUsd: 30_400_000_000,
    aumAsOf: "2026-09-30",
    aumSource: "https://res.avantisinvestors.com/docs/avantis-us-small-cap-value-avuv-etf-fact-sheet.pdf",
    inceptionDate: "2019-09-24",
    inceptionSource:
      "https://www.avantisinvestors.com/avantis-investments/en-us/avantis-us-small-cap-value-etf/AVUV/",
    top10WeightPct: 8.22,
    maxNameWeightPct: 1.07,
    holdingsAsOf: "2026-09-30",
    holdingsSource: "https://res.avantisinvestors.com/docs/avantis-us-small-cap-value-avuv-etf-fact-sheet.pdf",
    medianSpreadPct: null,
    spreadAsOf: null,
    spreadSource: null,
  },
  SMH: {
    symbol: "SMH",
    peerGroup: "semiconductor",
    expenseRatioPct: 0.35,
    expenseRatioAsOf: "2026-10-31",
    expenseRatioSource: "https://www.vaneck.com/us/en/investments/semiconductor-etf-smh-fact-sheet.pdf/",
    aumUsd: 66_438_200_000,
    aumAsOf: "2026-10-31",
    aumSource: "https://www.vaneck.com/us/en/investments/semiconductor-etf-smh-fact-sheet.pdf/",
    inceptionDate: "2011-12-20",
    inceptionSource: "https://www.vaneck.com/us/en/investments/semiconductor-etf-smh",
    // VanEck holdings as of 2026-11-16 (NVDA…MU official weights summed).
    top10WeightPct: 69.27,
    maxNameWeightPct: 17.44,
    holdingsAsOf: "2026-11-16",
    holdingsSource: "https://www.vaneck.com/us/en/investments/semiconductor-etf-smh",
    medianSpreadPct: null,
    spreadAsOf: null,
    spreadSource: null,
  },
  VGT: {
    symbol: "VGT",
    peerGroup: "broad_tech",
    expenseRatioPct: 0.09,
    expenseRatioAsOf: "2026-09-30",
    expenseRatioSource: "https://fund-docs.vanguard.com/F0958.pdf",
    aumUsd: 154_542_000_000,
    aumAsOf: "2026-09-30",
    aumSource: "https://fund-docs.vanguard.com/F0958.pdf",
    inceptionDate: "2004-01-26",
    inceptionSource: "https://investor.vanguard.com/investment-products/etfs/profile/vgt",
    top10WeightPct: 63.7,
    maxNameWeightPct: 17.6,
    holdingsAsOf: "2026-09-30",
    holdingsSource: "https://fund-docs.vanguard.com/F0958.pdf",
    medianSpreadPct: null,
    spreadAsOf: null,
    spreadSource: null,
  },
  IGV: {
    symbol: "IGV",
    peerGroup: "software_security",
    expenseRatioPct: 0.38,
    expenseRatioAsOf: "2026-11-16",
    expenseRatioSource: "https://www.ishares.com/us/products/239771/ishares-north-american-techsoftware-etf",
    aumUsd: 12_593_577_881,
    aumAsOf: "2026-11-16",
    aumSource: "https://www.blackrock.com/us/individual/products/239771/ishares-expanded-tech-software-sector-etf",
    inceptionDate: "2001-07-10",
    inceptionSource: "https://www.ishares.com/us/products/239771/ishares-north-american-techsoftware-etf",
    top10WeightPct: 59.55,
    maxNameWeightPct: 9.15,
    holdingsAsOf: "2026-11-16",
    holdingsSource:
      "https://www.ishares.com/us/products/239771/ishares-north-american-techsoftware-etf",
    medianSpreadPct: 0.02,
    spreadAsOf: "2026-10-09",
    spreadSource: "https://www.ishares.com/us/products/239771/ishares-north-american-techsoftware-etf",
  },
  CIBR: {
    symbol: "CIBR",
    peerGroup: "software_security",
    expenseRatioPct: 0.58,
    expenseRatioAsOf: "2026-02-02",
    expenseRatioSource: "https://www.ftportfolios.com/ETF/CIBR",
    aumUsd: 16_241_033_739,
    aumAsOf: "2026-11-16",
    aumSource: "https://www.ftportfolios.com/ETF/CIBR",
    inceptionDate: "2015-07-06",
    inceptionSource: "https://www.ftportfolios.com/ETF/CIBR",
    top10WeightPct: 54.74,
    maxNameWeightPct: 8.29,
    holdingsAsOf: "2026-11-17",
    holdingsSource: "https://www.ftportfolios.com/ETF/CIBR",
    medianSpreadPct: 0.09,
    spreadAsOf: "2026-11-16",
    spreadSource: "https://www.ftportfolios.com/ETF/CIBR",
  },
  BOTZ: {
    symbol: "BOTZ",
    peerGroup: "ai_robotics",
    expenseRatioPct: 0.68,
    expenseRatioAsOf: "2026-11-17",
    expenseRatioSource: "https://www.globalxetfs.com/funds/botz",
    aumUsd: 2_760_000_000,
    aumAsOf: "2026-11-17",
    aumSource: "https://www.globalxetfs.com/funds/botz",
    inceptionDate: "2016-09-12",
    inceptionSource: "https://www.globalxetfs.com/funds/botz",
    top10WeightPct: 57.81,
    maxNameWeightPct: 10.74,
    holdingsAsOf: "2026-11-17",
    holdingsSource: "https://www.globalxetfs.com/funds/botz",
    medianSpreadPct: 0.03,
    spreadAsOf: "2026-11-17",
    spreadSource: "https://www.globalxetfs.com/funds/botz",
  },
  AIQ: {
    symbol: "AIQ",
    peerGroup: "ai_robotics",
    expenseRatioPct: 0.68,
    expenseRatioAsOf: "2026-11-17",
    expenseRatioSource: "https://www.globalxetfs.com/funds/aiq",
    aumUsd: 8_920_000_000,
    aumAsOf: "2026-11-17",
    aumSource: "https://www.globalxetfs.com/funds/aiq",
    inceptionDate: "2018-05-11",
    inceptionSource: "https://www.globalxetfs.com/funds/aiq",
    top10WeightPct: 34.5,
    maxNameWeightPct: 4.17,
    holdingsAsOf: "2026-11-17",
    holdingsSource: "https://www.globalxetfs.com/funds/aiq",
    medianSpreadPct: 0.02,
    spreadAsOf: "2026-11-17",
    spreadSource: "https://www.globalxetfs.com/funds/aiq",
  },
  GRID: {
    symbol: "GRID",
    peerGroup: "infrastructure",
    expenseRatioPct: 0.56,
    expenseRatioAsOf: "2026-11-17",
    expenseRatioSource: "https://www.ftportfolios.com/etf/GRID",
    aumUsd: 10_375_388_046,
    aumAsOf: "2026-11-17",
    aumSource: "https://www.ftportfolios.com/etf/GRID",
    inceptionDate: "2009-11-16",
    inceptionSource: "https://www.ftportfolios.com/etf/GRID",
    top10WeightPct: 58.05,
    maxNameWeightPct: 8.99,
    holdingsAsOf: "2026-11-17",
    holdingsSource: "https://www.ftportfolios.com/etf/GRID",
    medianSpreadPct: 0.12,
    spreadAsOf: "2026-11-17",
    spreadSource: "https://www.ftportfolios.com/etf/GRID",
  },
  XLU: {
    symbol: "XLU",
    peerGroup: "sector_spdr",
    expenseRatioPct: 0.08,
    expenseRatioAsOf: "2026-11-17",
    expenseRatioSource:
      "https://www.ssga.com/us/en/intermediary/etfs/state-street-utilities-select-sector-spdr-etf-xlu",
    aumUsd: 23_775_070_000,
    aumAsOf: "2026-11-16",
    aumSource:
      "https://www.ssga.com/us/en/intermediary/etfs/state-street-utilities-select-sector-spdr-etf-xlu",
    inceptionDate: "1998-12-16",
    inceptionSource:
      "https://www.ssga.com/us/en/intermediary/etfs/state-street-utilities-select-sector-spdr-etf-xlu",
    top10WeightPct: 58.67,
    maxNameWeightPct: 12.92,
    holdingsAsOf: "2026-11-17",
    holdingsSource:
      "https://www.ssga.com/us/en/intermediary/etfs/state-street-utilities-select-sector-spdr-etf-xlu",
    medianSpreadPct: null,
    spreadAsOf: null,
    spreadSource: null,
  },
  XLI: {
    symbol: "XLI",
    peerGroup: "sector_spdr",
    expenseRatioPct: 0.08,
    expenseRatioAsOf: "2026-11-17",
    expenseRatioSource:
      "https://www.ssga.com/us/en/intermediary/etfs/state-street-industrial-select-sector-spdr-etf-xli",
    aumUsd: 30_625_680_000,
    aumAsOf: "2026-11-16",
    aumSource:
      "https://www.ssga.com/us/en/intermediary/etfs/state-street-industrial-select-sector-spdr-etf-xli",
    inceptionDate: "1998-12-16",
    inceptionSource:
      "https://www.ssga.com/us/en/intermediary/etfs/state-street-industrial-select-sector-spdr-etf-xli",
    top10WeightPct: 37.02,
    maxNameWeightPct: 6.47,
    holdingsAsOf: "2026-11-17",
    holdingsSource:
      "https://www.ssga.com/us/en/intermediary/etfs/state-street-industrial-select-sector-spdr-etf-xli",
    medianSpreadPct: null,
    spreadAsOf: null,
    spreadSource: null,
  },
  XLV: {
    symbol: "XLV",
    peerGroup: "sector_spdr",
    expenseRatioPct: 0.08,
    expenseRatioAsOf: "2026-11-17",
    expenseRatioSource:
      "https://www.ssga.com/us/en/intermediary/etfs/state-street-health-care-select-sector-spdr-etf-xlv",
    aumUsd: 50_321_850_000,
    aumAsOf: "2026-11-16",
    aumSource:
      "https://www.ssga.com/us/en/intermediary/etfs/state-street-health-care-select-sector-spdr-etf-xlv",
    inceptionDate: "1998-12-16",
    inceptionSource:
      "https://www.ssga.com/us/en/intermediary/etfs/state-street-health-care-select-sector-spdr-etf-xlv",
    top10WeightPct: 60.79,
    maxNameWeightPct: 16.87,
    holdingsAsOf: "2026-11-17",
    holdingsSource:
      "https://www.ssga.com/us/en/intermediary/etfs/state-street-health-care-select-sector-spdr-etf-xlv",
    medianSpreadPct: null,
    spreadAsOf: null,
    spreadSource: null,
  },
  XLF: {
    symbol: "XLF",
    peerGroup: "sector_spdr",
    expenseRatioPct: 0.08,
    expenseRatioAsOf: "2026-11-17",
    expenseRatioSource:
      "https://www.ssga.com/us/en/intermediary/etfs/state-street-financial-select-sector-spdr-etf-xlf",
    aumUsd: 54_053_630_000,
    aumAsOf: "2026-11-16",
    aumSource:
      "https://www.ssga.com/us/en/intermediary/etfs/state-street-financial-select-sector-spdr-etf-xlf",
    inceptionDate: "1998-12-16",
    inceptionSource:
      "https://www.ssga.com/us/en/intermediary/etfs/state-street-financial-select-sector-spdr-etf-xlf",
    top10WeightPct: 57.5,
    maxNameWeightPct: 13.6,
    holdingsAsOf: "2026-11-17",
    holdingsSource:
      "https://www.ssga.com/us/en/intermediary/etfs/state-street-financial-select-sector-spdr-etf-xlf",
    medianSpreadPct: null,
    spreadAsOf: null,
    spreadSource: null,
  },
})

/**
 * @param {string} symbol
 * @returns {EtfQualityFundMeta | null}
 */
export function getEtfQualityFundMeta(symbol) {
  const key = String(symbol ?? "")
    .trim()
    .toUpperCase()
  return ETF_QUALITY_FUND_META[key] ?? null
}
