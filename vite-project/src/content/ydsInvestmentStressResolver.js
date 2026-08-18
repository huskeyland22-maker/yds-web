function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function toFinite(value) {
  if (value == null || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function scaleLinear(value, points) {
  const n = toFinite(value)
  if (n == null || !Array.isArray(points) || points.length < 2) return null
  const sorted = [...points].sort((a, b) => a[0] - b[0])
  if (n <= sorted[0][0]) return sorted[0][1]
  if (n >= sorted[sorted.length - 1][0]) return sorted[sorted.length - 1][1]
  for (let i = 1; i < sorted.length; i += 1) {
    const [x1, y1] = sorted[i - 1]
    const [x2, y2] = sorted[i]
    if (n <= x2) {
      const ratio = (n - x1) / (x2 - x1)
      return y1 + (y2 - y1) * ratio
    }
  }
  return sorted[sorted.length - 1][1]
}

/**
 * 이전 3그룹 구조의 최종 기여를 보존한다.
 * VIX 0.24 + Put/Call 0.16 + CNN 0.25 = 단기 0.65
 * BofA 0.1575 + HY 0.1925 = 중기 0.35
 * CNN을 독립 3번째 그룹에서 단기 공포로 옮기되, 지표별 최종 비중은 바꾸지 않는다.
 */
const SHORT_TERM_GROUP_WEIGHT = 0.65
const MEDIUM_TERM_GROUP_WEIGHT = 0.35
const SHORT_TERM_METRIC_WEIGHTS = {
  vix: 0.24,
  putCall: 0.16,
  fearGreed: 0.25,
}
const MEDIUM_TERM_METRIC_WEIGHTS = {
  bofa: 0.1575,
  highYield: 0.1925,
}

function weightedMean(entries) {
  const present = (Array.isArray(entries) ? entries : []).filter(
    (item) => item && item.value != null && item.weight > 0,
  )
  const weightSum = present.reduce((sum, item) => sum + item.weight, 0)
  if (weightSum <= 0) return null
  return present.reduce((sum, item) => sum + item.value * item.weight, 0) / weightSum
}

function resolveDataDate(panicData) {
  const candidates = [panicData?.tradeDate, panicData?.date, panicData?.historyDate, panicData?.updatedAt]
  for (const raw of candidates) {
    if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  }
  return null
}

function ageDaysFrom(dateStr, now = new Date()) {
  if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
  const [year, month, day] = dateStr.split("-").map(Number)
  const dataUtc = Date.UTC(year, month - 1, day)
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.max(0, Math.round((todayUtc - dataUtc) / 86400000))
}

function metricQuality(key, rawValue, score, dataDate, ageDays, stale) {
  return {
    key,
    value: toFinite(rawValue),
    score: score == null ? null : score,
    dataDate,
    ageDays,
    stale,
  }
}

/** @param {number | null} score */
export function resolveMarketStressLevel(score) {
  const n = toFinite(score)
  if (n == null) {
    return {
      id: "UNKNOWN",
      label: "데이터 대기",
      tone: "neutral",
      actionGuide: "시장 스트레스 데이터가 준비되면 폭락 대응 가이드가 표시됩니다.",
    }
  }
  if (n <= 39) {
    return {
      id: "NORMAL",
      label: "NORMAL",
      tone: "stable",
      actionGuide: "월 적립을 유지하고 대기자금은 그대로 보유합니다.",
    }
  }
  if (n <= 59) {
    return {
      id: "CAUTION",
      label: "CAUTION",
      tone: "watch",
      actionGuide: "기본 적립을 유지하고 현재는 추가 투입을 하지 않습니다.",
    }
  }
  if (n <= 74) {
    return {
      id: "HIGH_STRESS",
      label: "HIGH_STRESS",
      tone: "stress",
      actionGuide: "기본 적립을 유지하면서 대기자금 투입 준비를 시작할 구간입니다.",
    }
  }
  if (n <= 89) {
    return {
      id: "CRASH",
      label: "CRASH",
      tone: "fear",
      actionGuide: "기본 적립을 유지하고 대기자금 1~2단계 투입을 검토할 구간입니다.",
    }
  }
  return {
    id: "EXTREME",
    label: "EXTREME",
    tone: "crash",
    actionGuide: "남은 대기자금을 3~5단계 원칙에 따라 단계적으로 검토할 수 있는 극단적 공포 구간입니다.",
  }
}

/** @param {object | null | undefined} panicData */
export function resolveMarketStressReport(panicData) {
  const dataDate = resolveDataDate(panicData)
  const ageDays = ageDaysFrom(dataDate)
  const stale = ageDays != null ? ageDays >= 1 : false

  const vixStress = scaleLinear(panicData?.vix, [
    [14, 0],
    [18, 20],
    [24, 50],
    [30, 75],
    [40, 100],
  ])
  const putCallStress = scaleLinear(panicData?.putCall, [
    [0.6, 0],
    [0.8, 20],
    [0.95, 45],
    [1.1, 75],
    [1.25, 100],
  ])
  const fearGreedStress = scaleLinear(panicData?.fearGreed, [
    [0, 100],
    [20, 80],
    [40, 60],
    [60, 35],
    [80, 10],
    [100, 0],
  ])
  const bofaStress = scaleLinear(panicData?.bofa, [
    [0, 100],
    [2, 80],
    [4, 55],
    [6, 25],
    [8, 0],
  ])
  const highYieldStress = scaleLinear(panicData?.highYield, [
    [2.5, 0],
    [3.5, 20],
    [4.5, 45],
    [5.5, 70],
    [7, 100],
  ])

  const shortTermFear = weightedMean([
    { weight: SHORT_TERM_METRIC_WEIGHTS.vix, value: vixStress },
    { weight: SHORT_TERM_METRIC_WEIGHTS.putCall, value: putCallStress },
    { weight: SHORT_TERM_METRIC_WEIGHTS.fearGreed, value: fearGreedStress },
  ])
  const mediumTermRisk = weightedMean([
    { weight: MEDIUM_TERM_METRIC_WEIGHTS.bofa, value: bofaStress },
    { weight: MEDIUM_TERM_METRIC_WEIGHTS.highYield, value: highYieldStress },
  ])

  const rawScore = weightedMean([
    { weight: SHORT_TERM_GROUP_WEIGHT, value: shortTermFear },
    { weight: MEDIUM_TERM_GROUP_WEIGHT, value: mediumTermRisk },
  ])
  const score = rawScore == null ? null : clamp(Math.round(rawScore))
  const level = resolveMarketStressLevel(score)

  return {
    score,
    level,
    updatedAt: panicData?.updatedAt ?? null,
    dataQuality: {
      dataDate,
      ageDays,
      stale,
      missingCount: [
        vixStress,
        putCallStress,
        fearGreedStress,
        bofaStress,
        highYieldStress,
      ].filter((value) => value == null).length,
      metrics: [
        metricQuality("vix", panicData?.vix, vixStress, dataDate, ageDays, stale),
        metricQuality("putCall", panicData?.putCall, putCallStress, dataDate, ageDays, stale),
        metricQuality("fearGreed", panicData?.fearGreed, fearGreedStress, dataDate, ageDays, stale),
        metricQuality("bofa", panicData?.bofa, bofaStress, dataDate, ageDays, stale),
        metricQuality("highYield", panicData?.highYield, highYieldStress, dataDate, ageDays, stale),
      ],
    },
    components: {
      shortTermFear: {
        label: "단기 공포",
        value: shortTermFear == null ? null : Math.round(shortTermFear),
        metrics: {
          vix: toFinite(panicData?.vix),
          putCall: toFinite(panicData?.putCall),
          fearGreed: toFinite(panicData?.fearGreed),
        },
      },
      mediumTermRisk: {
        label: "중기 위험",
        value: mediumTermRisk == null ? null : Math.round(mediumTermRisk),
        metrics: {
          bofa: toFinite(panicData?.bofa),
          highYield: toFinite(panicData?.highYield),
        },
      },
    },
  }
}

/** @param {{ targetAmount: number; currentAmount: number; stageCount: number; stagePercentages: number[]; stageStatuses?: boolean[] }} crashReserve */
export function buildCrashReservePlan(crashReserve) {
  const targetAmount = Math.max(0, Math.round(Number(crashReserve?.targetAmount) || 0))
  const currentAmount = Math.max(0, Math.round(Number(crashReserve?.currentAmount) || 0))
  const stageCount = clamp(Math.round(Number(crashReserve?.stageCount) || 5), 3, 5)
  const percentages = Array.isArray(crashReserve?.stagePercentages)
    ? crashReserve.stagePercentages.slice(0, stageCount).map((value) => Math.max(0, Number(value) || 0))
    : []
  while (percentages.length < stageCount) percentages.push(0)
  const totalPct = percentages.reduce((sum, value) => sum + value, 0)
  const normalized = totalPct > 0 ? percentages.map((value) => (value / totalPct) * 100) : Array(stageCount).fill(100 / stageCount)
  const readyPct = targetAmount > 0 ? clamp((currentAmount / targetAmount) * 100) : null
  const stageStatuses = Array.isArray(crashReserve?.stageStatuses)
    ? crashReserve.stageStatuses.slice(0, stageCount).map((value) => Boolean(value))
    : Array(stageCount).fill(false)

  return {
    targetAmount: targetAmount || null,
    currentAmount: currentAmount || null,
    availableAmount: currentAmount || null,
    stageCount,
    stagePercentages: normalized.map((value) => Math.round(value * 10) / 10),
    readyPct: readyPct == null ? null : Math.round(readyPct * 10) / 10,
    stages: normalized.map((pct, index) => ({
      id: `stage-${index + 1}`,
      label: `${index + 1}차 투입`,
      pct: Math.round(pct * 10) / 10,
      amount: targetAmount > 0 ? Math.round((targetAmount * pct) / 100) : null,
      completed: stageStatuses[index] ?? false,
    })),
  }
}
