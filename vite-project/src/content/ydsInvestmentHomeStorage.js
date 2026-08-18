export const INVESTMENT_HOME_SETTINGS_KEY = "yds-investment-home-settings-v1"

/**
 * @typedef {{
 *   monthlyPlannedAmount: number
 *   emergencyCashReserve: number
 *   investmentStartMonth: string
 *   targetDurationYears: number
 * }} InvestmentHomeSettings
 */

/** @returns {InvestmentHomeSettings} */
export function defaultInvestmentHomeSettings() {
  return {
    monthlyPlannedAmount: 0,
    emergencyCashReserve: 0,
    investmentStartMonth: "",
    targetDurationYears: 10,
  }
}

/** @param {unknown} raw */
function normalizeSettings(raw) {
  const base = defaultInvestmentHomeSettings()
  const row = raw && typeof raw === "object" ? raw : {}
  return {
    monthlyPlannedAmount: Math.max(0, Math.round(Number(row.monthlyPlannedAmount) || 0)),
    emergencyCashReserve: Math.max(0, Math.round(Number(row.emergencyCashReserve) || 0)),
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
    if (!raw) return defaultInvestmentHomeSettings()
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
