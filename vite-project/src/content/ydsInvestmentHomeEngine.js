import { stockList } from "../utils/stockRecommendations.js"
import { buildCrashReservePlan, resolveMarketStressReport } from "./ydsInvestmentStressResolver.js"

/** @param {number | null | undefined} value */
function fmtMoney(value) {
  const n = Math.round(Number(value) || 0)
  return `${n.toLocaleString("ko-KR")}원`
}

/** @param {number | null | undefined} value */
function fmtPct(value) {
  if (!Number.isFinite(value)) return null
  return `${Math.round(Number(value) * 10) / 10}%`
}

/** @param {string} monthKey */
function parseMonthKey(monthKey) {
  const raw = String(monthKey ?? "").trim()
  if (!/^\d{4}-\d{2}$/.test(raw)) return null
  const [year, month] = raw.split("-").map(Number)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null
  return { year, month }
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7)
}

function shiftMonthKey(monthKey, deltaMonths) {
  const base = parseMonthKey(monthKey)
  if (!base) return ""
  const date = new Date(Date.UTC(base.year, base.month - 1 + deltaMonths, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

function diffMonthsInclusive(startMonthKey, endMonthKey) {
  const start = parseMonthKey(startMonthKey)
  const end = parseMonthKey(endMonthKey)
  if (!start || !end) return null
  return (end.year - start.year) * 12 + (end.month - start.month)
}

/**
 * 레거시 패닉점수 구간. YDS 2.0 홈은 사용하지 않는다.
 * 홈 시장 스트레스는 resolveMarketStressReport() → resolveMarketStressLevel()만 사용한다.
 * @param {number | null | undefined} score
 */
export function resolveInvestmentStressStage(score) {
  if (!Number.isFinite(score)) {
    return {
      id: "unknown",
      label: "데이터 대기",
      tone: "neutral",
      description: "시장 스트레스 데이터를 불러오는 중입니다.",
      action: "시장 데이터 동기화 대기",
    }
  }

  const s = Math.max(0, Math.min(100, Math.round(Number(score))))
  if (s <= 20) {
    return {
      id: "normal",
      label: "정상",
      tone: "stable",
      description: "시장 스트레스가 낮습니다. 기본 적립 계획을 유지하는 구간입니다.",
      action: "정기 적립",
    }
  }
  if (s <= 40) {
    return {
      id: "adjustment",
      label: "조정",
      tone: "watch",
      description: "가격 변동은 커졌지만 계획을 크게 바꿀 단계는 아닙니다.",
      action: "정기 적립 유지",
    }
  }
  if (s <= 60) {
    return {
      id: "stress",
      label: "스트레스",
      tone: "stress",
      description: "불안이 커지는 구간입니다. 적립은 유지하되 비상자금 상태를 점검해야 합니다.",
      action: "정기 적립 유지 · 비상자금 점검",
    }
  }
  if (s <= 80) {
    return {
      id: "fear",
      label: "공포",
      tone: "fear",
      description: "강한 공포 구간입니다. 평시 적립과 함께 비상자금 1단계 준비가 필요합니다.",
      action: "정기 적립 + 비상자금 1단계 준비",
    }
  }
  return {
    id: "crash",
    label: "대폭락",
    tone: "crash",
    description: "비상자금 투입을 실제로 검토할 수 있는 고강도 스트레스 구간입니다.",
    action: "비상자금 투입 검토",
  }
}

/** @param {number | null | undefined} value */
function safeMoney(value) {
  return Math.round(Number(value) || 0)
}

/**
 * @param {unknown[]} trades
 * @param {number} cashAmount
 * @param {unknown} portfolio
 * @param {import("../hooks/useYdsMarketContext.js").useYdsMarketContext extends (...args: any) => infer R ? R : any} marketContext
 * @param {{ accounts?: Array<{ id: string; name: string; purpose: string; openingValuation: number; openingContribution: number; openingProfitLoss: number; monthlyContributionPlan: number; holdings?: Array<{ ticker: string; name: string; quantity: number; averageCost: number; currentValue: number }> }>; investmentStartMonth: string; targetDurationYears: number; crashReserve?: { targetAmount: number; currentAmount: number; stageCount: number; stagePercentages: number[]; stageStatuses?: boolean[] } }} settings
 */
export function buildInvestmentHomeReport(trades, cashAmount, portfolio, marketContext, settings, panicData) {
  const monthKey = currentMonthKey()
  const accounts = Array.isArray(settings?.accounts) ? settings.accounts : []
  const investmentStartMonth = String(settings?.investmentStartMonth ?? "").trim()
  const targetDurationYears = Math.max(0, Number(settings?.targetDurationYears) || 0)
  // YDS 2.0 홈의 시장 스트레스는 resolveMarketStressReport(panicData)만 사용한다.
  // marketContext.ydsScore / getFinalScore()는 /market-analysis 패닉지수 전용이며 여기에 넣지 않는다.
  const stressReport = resolveMarketStressReport(panicData)
  const stressLevel = stressReport.level
  const totalOpeningValuation = accounts.reduce((sum, account) => sum + safeMoney(account?.openingValuation), 0)
  const totalOpeningContribution = accounts.reduce((sum, account) => sum + safeMoney(account?.openingContribution), 0)
  const totalOpeningProfitLoss = accounts.reduce((sum, account) => sum + Math.round(Number(account?.openingProfitLoss) || 0), 0)
  const monthlyContributionPlan = accounts.reduce((sum, account) => sum + safeMoney(account?.monthlyContributionPlan), 0)
  const annualContributionPlan = monthlyContributionPlan * 12
  const hasOpeningBalance = totalOpeningValuation > 0 || totalOpeningContribution > 0
  const hasMonthlyPlan = monthlyContributionPlan > 0
  const crashReserve = buildCrashReservePlan(settings?.crashReserve ?? null)

  const representativeEtfs = stockList
    .filter((item) => item.type === "etf" && ["SPY", "QQQ", "VGT"].includes(String(item.ticker)))
    .slice(0, 3)

  const ydsActionLine =
    stressLevel.id === "UNKNOWN"
      ? "시장 데이터가 준비되면 이번 달 YDS 행동이 표시됩니다."
      : stressLevel.id === "NORMAL"
        ? "정기 적립을 유지하고 비상자금은 보존합니다."
        : stressLevel.id === "CAUTION"
          ? "정기 적립을 유지하면서 현금을 준비합니다."
          : stressLevel.id === "HIGH_STRESS"
            ? "정기 적립은 유지하고 대기자금 투입 준비를 시작합니다."
            : stressLevel.id === "CRASH"
              ? "정기 적립을 유지하면서 대기자금 1~2단계 투입을 검토합니다."
              : "기본 적립은 유지하고 남은 대기자금을 3~5단계로 나눠 검토합니다."

  const totalPlanMonths = targetDurationYears > 0 ? targetDurationYears * 12 : null
  const elapsedMonthsRaw =
    investmentStartMonth && totalPlanMonths ? diffMonthsInclusive(investmentStartMonth, monthKey) : null
  const elapsedMonths =
    Number.isFinite(elapsedMonthsRaw) && elapsedMonthsRaw != null ? Math.max(0, elapsedMonthsRaw) : null
  const elapsedMonthsCapped =
    elapsedMonths != null && totalPlanMonths != null ? Math.min(totalPlanMonths, elapsedMonths) : null
  const remainingMonths =
    elapsedMonthsCapped != null && totalPlanMonths != null ? Math.max(0, totalPlanMonths - elapsedMonthsCapped) : null
  const targetEndMonth =
    investmentStartMonth && totalPlanMonths != null ? shiftMonthKey(investmentStartMonth, totalPlanMonths) : ""
  const progressPct =
    elapsedMonthsCapped != null && totalPlanMonths ? (elapsedMonthsCapped / totalPlanMonths) * 100 : null

  return {
    monthKey,
    stage: stressLevel,
    market: {
      score: stressReport.score,
      strategyLabel: marketContext?.strategyLabel ?? "—",
      panicLabel: marketContext?.panicLabel ?? "—",
      contextLine: marketContext?.contextLine ?? "",
      updatedAt: stressReport.updatedAt,
      components: stressReport.components,
      dataQuality: stressReport.dataQuality,
    },
    openingBalance: {
      totalValuation: hasOpeningBalance ? totalOpeningValuation : null,
      cumulativeContribution: hasOpeningBalance ? totalOpeningContribution : null,
      currentProfitLoss: hasOpeningBalance ? totalOpeningProfitLoss : null,
    },
    monthlyContributionPlan: {
      monthlyTotal: hasMonthlyPlan ? monthlyContributionPlan : null,
      annualTotal: hasMonthlyPlan ? annualContributionPlan : null,
    },
    overview: {
      totalInvestmentAssets: hasOpeningBalance ? totalOpeningValuation : null,
      cumulativeInvestedAmount: hasOpeningBalance ? totalOpeningContribution : null,
      currentValuationAmount: hasOpeningBalance ? totalOpeningValuation : null,
      currentProfitLoss: hasOpeningBalance ? totalOpeningProfitLoss : null,
      monthlyPlannedAmount: hasMonthlyPlan ? monthlyContributionPlan : null,
      annualPlannedAmount: hasMonthlyPlan ? annualContributionPlan : null,
    },
    investmentTarget: {
      title: "미국 대표지수 ETF",
      summary:
        "기본 투자대상은 미국 대표지수 ETF이며, 개별 종목 추천은 메인 핵심 흐름에서 후순위로 유지합니다.",
      candidates: representativeEtfs,
    },
    actions: {
      monthlyPlanLine:
        monthlyContributionPlan > 0
          ? `이번 달 여유돈 기준 적립 예정금은 ${fmtMoney(monthlyContributionPlan)}입니다.`
          : "이번 달 적립 예정금을 아직 설정하지 않았습니다.",
      monthlyStatus:
        monthlyContributionPlan > 0
          ? "계획 반영됨"
          : "설정 필요",
      marketLine: stressLevel.label,
      actionLine:
        stressLevel.actionGuide,
    },
    progress: {
      planLabel: targetDurationYears > 0 ? `${targetDurationYears}년 투자 계획` : "장기 투자 계획을 설정하세요",
      investmentStartMonth: investmentStartMonth || "",
      targetEndMonth,
      elapsedMonths: elapsedMonthsCapped,
      remainingMonths,
      progressPct: fmtPct(progressPct),
      isConfigured: Boolean(investmentStartMonth && totalPlanMonths),
    },
    crashReserve: crashReserve,
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      purpose: account.purpose,
      openingValuation: safeMoney(account.openingValuation),
      openingContribution: safeMoney(account.openingContribution),
      openingProfitLoss: Math.round(Number(account.openingProfitLoss) || 0),
      monthlyContributionPlan: safeMoney(account.monthlyContributionPlan),
      holdings: Array.isArray(account.holdings) ? account.holdings : [],
    })),
    principles: [
      "매달 여유돈으로 적립합니다.",
      "시장을 예측해서 적립을 중단하지 않습니다.",
      "대폭락이 아니면 비상자금을 사용하지 않습니다.",
      "단기 수익률보다 10년 이상의 시간을 봅니다.",
      "생활비와 투자금을 분리합니다.",
    ],
    ydsActionLine,
  }
}
