export const INVESTMENT_HOME_SETTINGS_KEY = "yds-investment-home-settings-v2"

const LEGACY_SETTINGS_KEY = "yds-investment-home-settings-v1"

/**
 * @typedef {{
 *   ticker: string
 *   name: string
 *   quantity: number
 *   averageCost: number
 *   currentValue: number
 * }} InvestmentHolding
 *
 * @typedef {{
 *   id: string
 *   name: string
 *   purpose: string
 *   openingValuation: number
 *   openingContribution: number
 *   openingProfitLoss: number
 *   monthlyContributionPlan: number
 *   holdings: InvestmentHolding[]
 * }} InvestmentHomeAccount
 *
 * @typedef {{
 *   accounts: InvestmentHomeAccount[]
 *   investmentStartMonth: string
 *   targetDurationYears: number
 * }} InvestmentHomeSettings
 */

/** @returns {InvestmentHomeAccount[]} */
function defaultAccounts() {
  return [
    {
      id: "yang-doseong",
      name: "양도성",
      purpose: "본인 연금저축",
      openingValuation: 796820,
      openingContribution: 802360,
      openingProfitLoss: -5540,
      monthlyContributionPlan: 100000,
      holdings: [],
    },
    {
      id: "yang-soyoon",
      name: "양소윤",
      purpose: "장기 투자",
      openingValuation: 978605,
      openingContribution: 932377,
      openingProfitLoss: 46228,
      monthlyContributionPlan: 100000,
      holdings: [],
    },
    {
      id: "yang-jiyu",
      name: "양지유",
      purpose: "장기 투자",
      openingValuation: 949310,
      openingContribution: 904836,
      openingProfitLoss: 44474,
      monthlyContributionPlan: 100000,
      holdings: [],
    },
  ]
}

/** @returns {InvestmentHomeSettings} */
export function defaultInvestmentHomeSettings() {
  return {
    accounts: defaultAccounts(),
    investmentStartMonth: "",
    targetDurationYears: 10,
  }
}

/** @param {unknown} raw */
function normalizeHolding(raw) {
  const row = raw && typeof raw === "object" ? raw : {}
  return {
    ticker: String(row.ticker ?? "").trim(),
    name: String(row.name ?? "").trim(),
    quantity: Math.max(0, Number(row.quantity) || 0),
    averageCost: Math.max(0, Math.round(Number(row.averageCost) || 0)),
    currentValue: Math.max(0, Math.round(Number(row.currentValue) || 0)),
  }
}

/**
 * @param {unknown} raw
 * @param {InvestmentHomeAccount} base
 * @returns {InvestmentHomeAccount}
 */
function normalizeAccount(raw, base) {
  const row = raw && typeof raw === "object" ? raw : {}
  return {
    id: String(row.id ?? base.id),
    name: String(row.name ?? base.name),
    purpose: String(row.purpose ?? base.purpose),
    openingValuation: Math.max(0, Math.round(Number(row.openingValuation) || 0)),
    openingContribution: Math.max(0, Math.round(Number(row.openingContribution) || 0)),
    openingProfitLoss: Math.round(Number(row.openingProfitLoss) || 0),
    monthlyContributionPlan: Math.max(0, Math.round(Number(row.monthlyContributionPlan) || 0)),
    holdings: Array.isArray(row.holdings) ? row.holdings.map(normalizeHolding) : base.holdings,
  }
}

/** @param {unknown} raw */
function normalizeSettings(raw) {
  const base = defaultInvestmentHomeSettings()
  const row = raw && typeof raw === "object" ? raw : {}
  const sourceAccounts = Array.isArray(row.accounts) ? row.accounts : null
  const normalizedAccounts = sourceAccounts
    ? base.accounts.map((item, index) => normalizeAccount(sourceAccounts[index], item))
    : base.accounts.map((item) => ({ ...item, holdings: item.holdings.map((holding) => ({ ...holding })) }))

  return {
    accounts: normalizedAccounts,
    investmentStartMonth:
      /^\d{4}-\d{2}$/.test(String(row.investmentStartMonth ?? "").trim())
        ? String(row.investmentStartMonth).trim()
        : "",
    targetDurationYears: Math.max(0, Math.round(Number(row.targetDurationYears) || 0)),
  }
}

/** @returns {InvestmentHomeSettings} */
export function loadInvestmentHomeSettings() {
  try {
    const raw = localStorage.getItem(INVESTMENT_HOME_SETTINGS_KEY)
    if (!raw) {
      const legacyRaw = localStorage.getItem(LEGACY_SETTINGS_KEY)
      if (!legacyRaw) return defaultInvestmentHomeSettings()
      const legacy = JSON.parse(legacyRaw)
      return normalizeSettings({
        accounts: defaultAccounts().map((account) => ({
          ...account,
          monthlyContributionPlan: Math.max(
            0,
            Math.round(Number(legacy?.monthlyPlannedAmount) || 0) / 3,
          ),
        })),
        investmentStartMonth: legacy?.investmentStartMonth,
        targetDurationYears: legacy?.targetDurationYears,
      })
    }
    return normalizeSettings(JSON.parse(raw))
  } catch {
    return defaultInvestmentHomeSettings()
  }
}

/** @param {InvestmentHomeSettings} settings */
export function saveInvestmentHomeSettings(settings) {
  try {
    localStorage.setItem(INVESTMENT_HOME_SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)))
  } catch {
    /* ignore */
  }
}
