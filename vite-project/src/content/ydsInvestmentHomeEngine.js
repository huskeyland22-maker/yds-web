import { stockList } from "../utils/stockRecommendations.js"
import { tradeAmountKrw } from "./ydsPortfolioV5Engine.js"

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

/** @param {number | null | undefined} score */
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

/**
 * @param {import("./ydsPortfolioTradesStorage.js").PortfolioTrade[]} trades
 * @param {number} cashAmount
 * @param {ReturnType<typeof import("./ydsPortfolioV5Engine.js").buildV5Holdings>} portfolio
 * @param {import("../hooks/useYdsMarketContext.js").useYdsMarketContext extends (...args: any) => infer R ? R : any} marketContext
 * @param {{ monthlyPlannedAmount: number; emergencyCashReserve: number; investmentStartMonth: string; targetDurationYears: number }} settings
 */
export function buildInvestmentHomeReport(
  trades,
  cashAmount,
  portfolio,
  marketContext,
  settings,
) {
  const safeTrades = Array.isArray(trades) ? trades : []
  const monthKey = currentMonthKey()

  const buyTrades = safeTrades.filter((trade) => trade?.action === "buy")
  const monthlyBuyAmount = buyTrades
    .filter((trade) => String(trade.date ?? "").slice(0, 7) === monthKey)
    .reduce((sum, trade) => sum + tradeAmountKrw(trade), 0)
  const cumulativeInvestedAmount = buyTrades.reduce((sum, trade) => sum + tradeAmountKrw(trade), 0)

  const plannedAmount = Math.max(0, Number(settings?.monthlyPlannedAmount) || 0)
  const emergencyReserve = Math.max(0, Number(settings?.emergencyCashReserve) || 0)
  const investmentStartMonth = String(settings?.investmentStartMonth ?? "").trim()
  const targetDurationYears = Math.max(0, Number(settings?.targetDurationYears) || 0)
  const actualCash = Math.max(0, Number(cashAmount) || 0)
  const protectedEmergencyCash = Math.min(actualCash, emergencyReserve)
  const waitingCash = Math.max(0, actualCash - protectedEmergencyCash)
  const stage = resolveInvestmentStressStage(marketContext?.ydsScore)
  const hasHoldings = Number(portfolio?.stockTotal ?? 0) > 0
  const hasCash = actualCash > 0
  const hasTradeHistory = buyTrades.length > 0
  const hasAnyInvestmentData = hasHoldings || hasCash || hasTradeHistory

  const representativeEtfs = stockList
    .filter((item) => item.type === "etf" && ["SPY", "QQQ", "VGT"].includes(String(item.ticker)))
    .slice(0, 3)

  let reserveStatus = "설정 필요"
  if (emergencyReserve > 0 && protectedEmergencyCash <= 0) {
    reserveStatus = "비상자금 현금이 아직 입력되지 않음"
  } else if (emergencyReserve > 0 && protectedEmergencyCash < emergencyReserve) {
    reserveStatus = "일부 준비됨"
  } else if (emergencyReserve > 0) {
    reserveStatus = "준비됨"
  }

  let deploymentReadiness = "설정 필요"
  if (emergencyReserve > 0 && protectedEmergencyCash > 0) {
    deploymentReadiness =
      stage.id === "crash"
        ? "비상자금 투입 검토 가능"
        : "비상자금 보유 중 · 시장 스트레스 확대 시 사용"
  }

  const ydsActionLine =
    stage.id === "unknown"
      ? "시장 데이터가 준비되면 이번 달 YDS 행동이 표시됩니다."
      : stage.id === "normal"
        ? "정기 적립을 유지하고 비상자금은 보존합니다."
        : stage.id === "adjustment"
          ? "정기 적립을 유지하면서 현금을 준비합니다."
          : stage.id === "stress"
            ? "정기 적립은 유지하고 비상자금 투입 여부를 관찰합니다."
            : stage.id === "fear"
              ? "정기 적립을 유지하면서 비상자금 1단계 투입을 검토합니다."
              : "대폭락 구간이므로 비상자금 투입 계획을 실제 행동으로 점검합니다."

  const reserveCoveragePct =
    emergencyReserve > 0 ? Math.min(100, (protectedEmergencyCash / emergencyReserve) * 100) : null

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
    stage,
    market: {
      score: marketContext?.ydsScore ?? null,
      strategyLabel: marketContext?.strategyLabel ?? "—",
      panicLabel: marketContext?.panicLabel ?? "—",
      contextLine: marketContext?.contextLine ?? "",
    },
    overview: {
      totalInvestmentAssets: hasAnyInvestmentData ? portfolio?.totalAssets ?? actualCash : null,
      cumulativeInvestedAmount: hasTradeHistory ? cumulativeInvestedAmount : null,
      currentValuationAmount: hasHoldings ? portfolio?.stockTotal ?? 0 : null,
      monthlyPlannedAmount: plannedAmount > 0 ? plannedAmount : null,
      monthlyInvestedAmount: hasTradeHistory ? monthlyBuyAmount : null,
      waitingCash: hasCash ? waitingCash : null,
      emergencyCash: emergencyReserve > 0 ? protectedEmergencyCash : null,
      reserveTarget: emergencyReserve,
      reserveStatus,
      deploymentReadiness,
      reserveCoveragePct,
      deployableCashAmount: emergencyReserve > 0 ? protectedEmergencyCash : null,
    },
    investmentTarget: {
      title: "미국 대표지수 ETF",
      summary:
        "기본 투자대상은 미국 대표지수 ETF이며, 개별 종목 추천은 메인 핵심 흐름에서 후순위로 유지합니다.",
      candidates: representativeEtfs,
    },
    actions: {
      monthlyPlanLine:
        plannedAmount > 0
          ? `이번 달 여유돈 기준 적립 예정금은 ${fmtMoney(plannedAmount)}입니다.`
          : "이번 달 적립 예정금을 아직 설정하지 않았습니다.",
      monthlyStatus:
        plannedAmount > 0
          ? monthlyBuyAmount >= plannedAmount
            ? "정상 진행"
            : monthlyBuyAmount > 0
              ? "진행 중"
              : "시작 전"
          : "설정 필요",
      marketLine: stage.label,
      actionLine:
        stage.id === "crash"
          ? "평소 적립을 유지하고 비상자금 추가 투입을 검토합니다."
          : stage.id === "fear"
            ? "예정된 적립을 유지하면서 비상자금 사용 여부를 점검합니다."
            : "예정된 적립만 차분히 진행합니다.",
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
