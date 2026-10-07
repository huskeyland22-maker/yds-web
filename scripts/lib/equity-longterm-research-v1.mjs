/**
 * Ten-year hold suitability for the existing 31-name US growth universe.
 *
 * Research only. The sell-research line is not an input. Scores use a fixed
 * rubric: industry, moat, reinvestment, and AI class are checklist points;
 * growth, profitability, cash, and valuation are read from the stored market
 * snapshot or left empty. Missing ROIC, EPS CAGR, and five-year revenue CAGR
 * stay empty. Free-cash-flow margin is empty when cash flow is more than twice
 * revenue. Enterprise value to sales above 100 is empty, because that multiple
 * is not a usable observation for this universe. Penalties are fixed and capped
 * at 20. A name is CORE LONG-TERM
 * only when the final score is at least 85 and the valuation class is present
 * and not Extreme.
 *
 * selectedStrategy stays null. This is not an investment recommendation.
 */

import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./equity-sell-research-universe.mjs"

export const SELECTED_STRATEGY = null
export const TICKERS = EQUITY_SELL_RESEARCH_UNIVERSE.map((item) => item.symbol)

export const WEIGHTS = {
  industry: 15,
  moat: 20,
  growth: 10,
  profit: 10,
  capital: 15,
  tam: 10,
  ai: 10,
  valuation: 10,
}
export const PENALTY_CAP = 20
export const MOAT_POINTS = {
  technical: 18,
  scale: 12,
  network: 14,
  switching: 14,
  ecosystem: 12,
  brand: 6,
  lockin: 10,
  supply: 10,
  ip: 10,
  regulatory: 8,
}
export const TAM_POINTS = {
  large: 30,
  growing: 20,
  adjacent: 15,
  international: 10,
  aiPath: 15,
  reinvest: 10,
}
export const AI_SCORE = {
  "direct beneficiary": 85,
  "infrastructure beneficiary": 80,
  "indirect beneficiary": 68,
  neutral: 50,
  "disruption risk": 25,
}
const CYCLICAL = new Set(["MU", "FCX", "CEG", "VST"])
const REGULATORY = new Set(["LLY"])
const CHINA_DOMINANT = new Set(["TSM"])
const DISRUPTION = new Set(["GOOGL"])

const ASSESSMENTS = {
  NVDA: { group: "AI / Semiconductors", industry: "AI accelerators", industryScore: 90, ai: "direct beneficiary", moat: ["technical", "scale", "switching", "ecosystem", "lockin", "supply", "ip"], tam: ["large", "growing", "adjacent", "international", "aiPath", "reinvest"], why: "가속기와 CUDA 생태계가 컴퓨팅 수요의 중심에 있다.", risk: "성장률이 낮아질 때 멀티플이 함께 줄어드는 것.", question: "고객 몇 곳이 매출의 대부분을 계속 가져가는지." },
  AMD: { group: "AI / Semiconductors", industry: "AI accelerators and CPUs", industryScore: 90, ai: "direct beneficiary", moat: ["technical", "scale", "switching", "ip"], tam: ["large", "growing", "adjacent", "international", "aiPath", "reinvest"], why: "CPU와 GPU를 함께 공급하는 위치가 남아 있다.", risk: "가속기 소프트웨어 생태계가 더 좁다.", question: "데이터센터 GPU 점유를 이익으로 유지하는지." },
  AVGO: { group: "AI / Semiconductors", industry: "custom AI silicon and infrastructure software", industryScore: 86, ai: "infrastructure beneficiary", moat: ["technical", "scale", "switching", "ecosystem", "lockin", "supply", "ip"], tam: ["large", "growing", "adjacent", "international", "aiPath", "reinvest"], why: "맞춤 AI 칩과 인프라 소프트웨어가 한 회사에 있다.", risk: "소수 대형 고객과 인수 회계.", question: "맞춤 칩 매출이 특정 고객에 얼마나 묶여 있는지." },
  TSM: { group: "AI / Semiconductors", industry: "leading-edge foundry", industryScore: 88, ai: "infrastructure beneficiary", moat: ["technical", "scale", "switching", "supply", "ip"], tam: ["large", "growing", "international", "aiPath", "reinvest"], why: "선단 공정 파운드리 공급이 대체되기 어렵다.", risk: "대만 생산 거점과 지정학.", question: "해외 팹이 같은 수율을 내는지." },
  ASML: { group: "AI / Semiconductors", industry: "lithography equipment", industryScore: 82, ai: "infrastructure beneficiary", moat: ["technical", "scale", "switching", "lockin", "supply", "ip", "regulatory"], tam: ["large", "growing", "international", "aiPath", "reinvest"], why: "EUV 노광은 대체 공급자가 없다.", risk: "장비 주문의 사이클과 수출 제한.", question: "하이 NA 장비 수요가 예상만큼 이어지는지." },
  AMAT: { group: "AI / Semiconductors", industry: "wafer fab equipment", industryScore: 82, ai: "infrastructure beneficiary", moat: ["technical", "scale", "switching", "supply", "ip"], tam: ["large", "growing", "international", "aiPath", "reinvest"], why: "증착·식각 공정 장비가 팹 투자에 붙는다.", risk: "웨이퍼 장비 지출의 사이클.", question: "중국 매출 비중이 제한 이후 얼마나 줄었는지." },
  LRCX: { group: "AI / Semiconductors", industry: "wafer fab equipment", industryScore: 82, ai: "infrastructure beneficiary", moat: ["technical", "scale", "switching", "supply", "ip"], tam: ["large", "growing", "international", "aiPath", "reinvest"], why: "식각 장비는 미세 공정의 반복 수요에 연결된다.", risk: "메모리 투자 사이클.", question: "메모리와 파운드리 비중 변화." },
  KLAC: { group: "AI / Semiconductors", industry: "process control equipment", industryScore: 82, ai: "infrastructure beneficiary", moat: ["technical", "scale", "switching", "lockin", "ip"], tam: ["large", "growing", "international", "aiPath", "reinvest"], why: "공정 검사 장비는 수율 관리에 남는다.", risk: "팹 투자가 멈추면 주문도 멈춘다.", question: "서비스 매출 비중이 사이클을 얼마나 완충하는지." },
  MU: { group: "AI / Semiconductors", industry: "memory", industryScore: 68, ai: "infrastructure beneficiary", moat: ["technical", "scale", "supply"], tam: ["large", "growing", "international", "aiPath", "reinvest"], why: "HBM은 AI 서버의 구조적 부품이다.", risk: "메모리는 가격 사이클이 이익을 뒤집는다.", question: "현재 마진이 주기 정상인지 호황인지." },
  SNPS: { group: "AI / Semiconductors", industry: "EDA and semiconductor IP", industryScore: 86, ai: "infrastructure beneficiary", moat: ["technical", "scale", "switching", "ecosystem", "lockin", "ip"], tam: ["large", "growing", "adjacent", "international", "aiPath", "reinvest"], why: "칩 설계 소프트웨어는 설계가 늘수록 남는다.", risk: "대형 인수 통합.", question: "Ansys 통합 이후 마진이 유지되는지." },
  ANET: { group: "Data center / network", industry: "data center networking", industryScore: 84, ai: "infrastructure beneficiary", moat: ["technical", "scale", "switching", "ecosystem", "lockin"], tam: ["large", "growing", "adjacent", "international", "aiPath", "reinvest"], why: "대형 클라우드 네트워크의 운영체제가 교체 비용이 크다.", risk: "클라우드 고객 소수 집중.", question: "이더넷이 스케일업 네트워크까지 가는지." },
  VRT: { group: "Data center / power", industry: "data center thermal and power", industryScore: 80, ai: "infrastructure beneficiary", moat: ["technical", "switching", "scale", "supply"], tam: ["large", "growing", "adjacent", "international", "aiPath", "reinvest"], why: "고밀도 AI 서버는 전력과 냉각을 더 쓴다.", risk: "데이터센터 건설 지연.", question: "액체냉각 점유가 경쟁으로 얼마나 깎이는지." },
  CEG: { group: "Power", industry: "nuclear and competitive power", industryScore: 74, ai: "infrastructure beneficiary", moat: ["scale", "switching", "supply", "regulatory"], tam: ["large", "growing", "aiPath", "reinvest"], why: "기존 원전 면허는 새로 짓기 어렵다.", risk: "전력 가격과 정책.", question: "데이터센터 계약이 발전량보다 앞서는지." },
  VST: { group: "Power", industry: "competitive power generation", industryScore: 74, ai: "infrastructure beneficiary", moat: ["scale", "regulatory"], tam: ["large", "growing", "aiPath", "reinvest"], why: "전력 수요 증가의 공급 쪽에 있다.", risk: "가스 발전은 복제가 가능하고 부채가 높다.", question: "계약 마진이 도매 가격과 분리되는지." },
  ETN: { group: "Grid equipment", industry: "electrical equipment", industryScore: 78, ai: "infrastructure beneficiary", moat: ["technical", "scale", "switching", "brand", "supply"], tam: ["large", "growing", "adjacent", "international", "aiPath", "reinvest"], why: "데이터센터와 전력망이 같은 전기 장비를 쓴다.", risk: "단기 수주가 경기와 건설에 민감하다.", question: "데이터센터 비중이 순환 수요를 넘어서는지." },
  GEV: { group: "Grid equipment", industry: "power generation and grid equipment", industryScore: 78, ai: "infrastructure beneficiary", moat: ["technical", "scale", "switching", "brand", "supply"], tam: ["large", "growing", "adjacent", "international", "aiPath", "reinvest"], why: "발전 설비와 그리드 장비가 전력 투자에 연결된다.", risk: "분사 이후 실적 기간이 짧다.", question: "가스터빈 호황이 전력망 수주로 이어지는지." },
  PWR: { group: "Grid construction", industry: "utility and infrastructure construction", industryScore: 76, ai: "infrastructure beneficiary", moat: ["scale", "switching", "lockin"], tam: ["large", "growing", "adjacent", "aiPath", "reinvest"], why: "송전·변전 시공은 숙련 인력 제약이 있다.", risk: "프로젝트 일정과 원가.", question: "수주잔고가 마진으로 바뀌는지." },
  MSFT: { group: "Software / cloud", industry: "cloud and enterprise software", industryScore: 86, ai: "direct beneficiary", moat: ["technical", "scale", "switching", "ecosystem", "brand", "lockin", "ip"], tam: ["large", "growing", "adjacent", "international", "aiPath", "reinvest"], why: "업무 소프트웨어와 클라우드가 이미 깔려 있다.", risk: "AI 인프라 투자가 현금흐름을 잠식하는 것.", question: "Copilot 유료 전환이 좌석 성장으로 보이는지." },
  ORCL: { group: "Software / cloud", industry: "database and cloud infrastructure", industryScore: 80, ai: "infrastructure beneficiary", moat: ["technical", "scale", "switching", "ecosystem", "lockin", "ip"], tam: ["large", "growing", "adjacent", "international", "aiPath", "reinvest"], why: "데이터베이스 전환 비용이 크고 클라우드 용량을 늘리고 있다.", risk: "데이터센터 투자로 잉여현금이 마이너스인 것.", question: "그 투자가 계약 매출로 회수되는지." },
  PLTR: { group: "Software", industry: "data analytics software", industryScore: 72, ai: "direct beneficiary", moat: ["technical", "switching", "lockin", "ip"], tam: ["large", "growing", "adjacent", "international", "aiPath", "reinvest"], why: "운영 데이터 위에 소프트웨어가 붙으면 교체가 어렵다.", risk: "현재 멀티플이 성장 지속을 이미 요구한다.", question: "정부 밖 상업 매출이 같은 마진을 내는지." },
  PANW: { group: "Cybersecurity", industry: "cybersecurity platform", industryScore: 80, ai: "indirect beneficiary", moat: ["technical", "scale", "switching", "ecosystem", "lockin"], tam: ["large", "growing", "adjacent", "international", "aiPath", "reinvest"], why: "보안 플랫폼은 위협이 늘수록 교체 비용이 커진다.", risk: "플랫폼 전환 할인과 높은 선반영 배수.", question: "청구 성장이 매출 성장과 같이 가는지." },
  CRWD: { group: "Cybersecurity", industry: "endpoint and cloud security", industryScore: 80, ai: "indirect beneficiary", moat: ["technical", "scale", "switching", "ecosystem", "lockin"], tam: ["large", "growing", "adjacent", "international", "aiPath", "reinvest"], why: "엔드포인트 점유는 한 번 깔리면 남기 쉽다.", risk: "이익이 아직 얇고 선반영 배수가 높다.", question: "흑자 전환이 성장률을 깎는지." },
  FTNT: { group: "Cybersecurity", industry: "network security", industryScore: 80, ai: "indirect beneficiary", moat: ["technical", "scale", "switching", "lockin"], tam: ["large", "growing", "adjacent", "international", "aiPath"], why: "자체 보안 칩과 구독이 네트워크 보안에 붙어 있다.", risk: "방화벽 제품 주기의 둔화.", question: "구독 비중이 장비 사이클을 넘어서는지." },
  GOOGL: { group: "Internet platform", industry: "digital advertising and cloud", industryScore: 70, ai: "direct beneficiary", moat: ["technical", "scale", "network", "ecosystem", "brand", "ip"], tam: ["large", "growing", "adjacent", "international", "aiPath", "reinvest"], why: "검색·영상 네트워크와 클라우드를 함께 가지고 있다.", risk: "검색 광고가 AI 답변으로 잠식되는 것.", question: "검색 매출 성장이 AI 개편 이후에도 유지되는지." },
  AMZN: { group: "Internet platform", industry: "cloud infrastructure and retail", industryScore: 78, ai: "infrastructure beneficiary", moat: ["technical", "scale", "network", "switching", "ecosystem", "brand", "lockin"], tam: ["large", "growing", "adjacent", "international", "aiPath", "reinvest"], why: "클라우드 인프라와 유통 규모가 함께 있다.", risk: "유통 마진이 클라우드 이익을 가린다.", question: "AWS 성장이 전체 마진으로 드러나는지." },
  AAPL: { group: "Consumer platform", industry: "consumer devices and services", industryScore: 62, ai: "indirect beneficiary", moat: ["technical", "scale", "switching", "ecosystem", "brand", "lockin", "ip"], tam: ["growing", "adjacent", "international", "aiPath", "reinvest"], why: "기기와 서비스 생태계의 교체 비용이 크다.", risk: "기기 판매 대수의 성숙.", question: "서비스 성장이 기기 둔화를 메우는지." },
  TSLA: { group: "Auto / energy", industry: "electric vehicles and energy", industryScore: 58, ai: "indirect beneficiary", moat: ["technical", "scale", "brand", "supply"], tam: ["large", "growing", "adjacent", "international", "aiPath", "reinvest"], why: "전기차 제조 규모와 에너지 저장이 있다.", risk: "자동차 경쟁과 현재 배수.", question: "자율주행 매출이 차량 판매와 분리돼 있는지." },
  LLY: { group: "Healthcare", industry: "biopharma", industryScore: 74, ai: "neutral", moat: ["technical", "scale", "ip", "regulatory"], tam: ["large", "growing", "adjacent", "international", "reinvest"], why: "대사 질환 치료제 수요의 구조가 크다.", risk: "소수 제품과 특허, 그리고 약가.", question: "후속 파이프라인이 현재 제품을 잇는지." },
  ISRG: { group: "Healthcare", industry: "robotic surgery", industryScore: 76, alsoFits: "Robotics", ai: "indirect beneficiary", moat: ["technical", "scale", "switching", "lockin", "ip", "regulatory"], tam: ["large", "growing", "adjacent", "international", "aiPath", "reinvest"], why: "수술 로봇 설치와 의사 훈련이 남아 있다.", risk: "병원 자본지출 둔화.", question: "신규 술기가 장비 당 시술 수를 늘리는지." },
  V: { group: "Payments", industry: "card network", industryScore: 70, ai: "neutral", moat: ["network", "scale", "switching", "brand", "lockin", "regulatory"], tam: ["growing", "adjacent", "international"], why: "카드 네트워크는 양면 시장이라 대체 비용이 크다.", risk: "결제 규제와 성숙한 핵심 시장.", question: "신규 결제 흐름이 기존 네트워크 안으로 들어오는지." },
  FCX: { group: "Materials", industry: "copper mining", industryScore: 64, ai: "indirect beneficiary", moat: ["scale", "supply", "regulatory"], tam: ["large", "growing", "international", "reinvest"], why: "구리 광체는 전력 투자 수요와 맞닿아 있다.", risk: "구리 가격이 이익을 결정한다.", question: "증산 원가가 가격 하락을 버티는지." },
}

function finite(value) {
  return Number.isFinite(value)
}

function clamp(value) {
  return Math.min(100, Math.max(0, value))
}

function round1(value) {
  return finite(value) ? Math.round(value * 10) / 10 : null
}

function band(score) {
  if (!finite(score)) return null
  if (score >= 85) return "매우 강함"
  if (score >= 70) return "강함"
  if (score >= 50) return "보통"
  if (score >= 30) return "약함"
  return "매우 약함"
}

function checklist(flags, points) {
  const used = []
  let score = 0
  for (const [key, value] of Object.entries(points)) {
    if (flags.includes(key)) {
      used.push(key)
      score += value
    }
  }
  return { score: Math.min(100, score), used }
}

function yearOf(date) {
  const year = Number(String(date).slice(0, 4))
  return Number.isInteger(year) ? year : null
}

export function revenuePath(annual) {
  return (annual ?? [])
    .filter((row) => finite(row.revenue) && row.revenue > 0 && yearOf(row.end))
    .map((row) => ({ end: row.end, year: yearOf(row.end), revenue: row.revenue }))
    .sort((a, b) => a.year - b.year || String(a.end).localeCompare(String(b.end)))
}

export function revenueCagr(annual, years) {
  const path = revenuePath(annual)
  if (path.length < years + 1) return null
  const end = path[path.length - 1]
  const start = path[path.length - 1 - years]
  if (end.year - start.year !== years || !(start.revenue > 0)) return null
  return (end.revenue / start.revenue) ** (1 / years) - 1
}

function consecutiveGrowth(path) {
  const rates = []
  for (let i = 1; i < path.length; i += 1) {
    if (path[i].year - path[i - 1].year !== 1) continue
    rates.push(path[i].revenue / path[i - 1].revenue - 1)
  }
  return rates
}

function growthScore(rate, fallback) {
  let score = 25
  if (rate >= 0.25) score = 90
  else if (rate >= 0.15) score = 78
  else if (rate >= 0.1) score = 68
  else if (rate >= 0.05) score = 55
  else if (rate >= 0) score = 40
  if (fallback) score = Math.min(score, 70)
  return score
}

export function valuationClass(input) {
  const price = input.currentPrice
  const pe = input.forwardPE
  const eps = input.forwardEps
  if (!(price > 0) || !(pe > 0) || !(eps > 0)) return null
  if (Math.abs((eps * pe) / price - 1) > 0.15) return null
  const peg = input.pegRatio
  const evs = finite(input.enterpriseToRevenue) && input.enterpriseToRevenue > 0 && input.enterpriseToRevenue <= 100
    ? input.enterpriseToRevenue
    : null
  const growth = input.growth
  if ((finite(peg) && peg >= 3) || pe >= 60 || (finite(evs) && evs >= 30 && (!finite(growth) || growth < 0.2))) return "Extreme"
  if (finite(peg) && peg > 0 && peg <= 1 && pe <= 25) return "Cheap"
  if ((finite(peg) && peg > 0 && peg <= 1.5) || (pe <= 30 && finite(growth) && growth >= 0.15)) return "Reasonable"
  return "Expensive"
}

const VALUATION_SCORE = { Cheap: 85, Reasonable: 70, Expensive: 45, Extreme: 20 }

function qualityBand(score) {
  if (!finite(score)) return null
  if (score >= 80) return "High"
  if (score >= 65) return "Medium"
  return "Low"
}

export function attractivenessOf(quality, valuation) {
  if (!valuation) return null
  if (valuation === "Cheap") return "High"
  if (valuation === "Extreme") return "Low"
  if (!quality) return null
  if (valuation === "Reasonable") return quality === "High" ? "High" : "Medium"
  if (valuation === "Expensive") return quality === "High" ? "Medium" : "Low"
  return null
}

export function gradeOf(score, valuation) {
  if (!finite(score)) return "DATA_INCOMPLETE"
  if (score >= 85 && valuation && valuation !== "Extreme") return "CORE LONG-TERM"
  if (score >= 75) return "LONG-TERM"
  if (score >= 65) return "WATCH"
  if (score >= 50) return "SPECULATIVE"
  return "NOT LONG-TERM"
}

function durabilityScore(industry, moat, profit, fcfMargin, highDebt, aiClass, aiScore) {
  let business = 35
  if (industry >= 80 && moat >= 70) business = 90
  else if (industry >= 60 && moat >= 60) business = 75
  else if (industry >= 50 || moat >= 50) business = 55
  const balance = !finite(fcfMargin) ? null : (fcfMargin >= 0 && !highDebt ? 80 : fcfMargin >= 0 ? 55 : 35)
  const technology = aiClass === "disruption risk" ? 30 : aiScore
  const parts = {
    business,
    competitive: moat,
    earnings: profit,
    balance,
    technology,
  }
  const values = Object.values(parts).filter(finite)
  return {
    parts,
    score: values.length ? round1(values.reduce((sum, value) => sum + value, 0) / values.length) : null,
    confidence: Object.values(parts).every(finite) ? "Medium" : "Low",
  }
}

export function scoreTicker(ticker, market, assessment) {
  if (!assessment) throw new Error(`assessment missing ${ticker}`)
  const moat = checklist(assessment.moat, MOAT_POINTS)
  const tam = checklist(assessment.tam, TAM_POINTS)
  const aiScore = AI_SCORE[assessment.ai]
  if (!finite(aiScore)) throw new Error(`AI class missing ${ticker}`)
  const path = revenuePath(market?.annual)
  const cagr3 = revenueCagr(market?.annual, 3)
  const cagr5 = revenueCagr(market?.annual, 5)
  const yoy = finite(market?.revenueGrowth) ? market.revenueGrowth : null
  let growth = null
  let growthBasis = null
  let growthRate = null
  if (finite(cagr3)) {
    growthRate = cagr3
    growthBasis = "cagr3"
    growth = growthScore(cagr3, false)
    if (cagr3 > 0 && consecutiveGrowth(path).some((rate) => rate < 0)) growth = Math.max(0, growth - 10)
  } else if (finite(yoy)) {
    growthRate = yoy
    growthBasis = "yoy"
    growth = growthScore(yoy, true)
  }
  const opm = finite(market?.operatingMargins) ? market.operatingMargins : null
  let profit = null
  if (finite(opm)) {
    if (opm >= 0.3) profit = 90
    else if (opm >= 0.2) profit = 78
    else if (opm >= 0.1) profit = 65
    else if (opm >= 0) profit = 45
    else profit = 25
    if (finite(market?.earningsGrowth) && market.earningsGrowth > 0 && opm > 0) profit = Math.min(100, profit + 5)
  }
  const revenue = market?.totalRevenue
  const fcf = market?.freeCashflow
  const fcfMargin = finite(fcf) && finite(revenue) && revenue > 0 && Math.abs(fcf) <= 2 * revenue ? fcf / revenue : null
  let capital = null
  const highDebt = finite(market?.debtToEquity) && market.debtToEquity > 150
  if (finite(fcfMargin)) {
    if (fcfMargin >= 0.2) capital = 88
    else if (fcfMargin >= 0.1) capital = 75
    else if (fcfMargin >= 0) capital = 55
    else capital = 30
    if (highDebt) capital = Math.max(0, capital - 8)
  }
  const valuation = valuationClass({ ...market, growth: growthRate })
  const valuationScore = valuation ? VALUATION_SCORE[valuation] : null
  const axes = {
    industry: assessment.industryScore,
    moat: moat.score,
    growth,
    profit,
    capital,
    tam: tam.score,
    ai: aiScore,
    valuation: valuationScore,
  }
  const complete = Object.values(axes).every(finite)
  let weighted = null
  if (complete) {
    weighted = Object.entries(WEIGHTS).reduce((sum, [key, weight]) => sum + (weight * axes[key]) / 100, 0)
  }
  const qualityWeights = Object.entries(WEIGHTS).filter(([key]) => key !== "valuation")
  const qualityComplete = qualityWeights.every(([key]) => finite(axes[key]))
  const qualityScore = qualityComplete
    ? qualityWeights.reduce((sum, [key, weight]) => sum + weight * axes[key], 0) / qualityWeights.reduce((sum, [, weight]) => sum + weight, 0)
    : null
  const penalties = []
  const add = (id, points, on) => {
    penalties.push({ id, points, on: Boolean(on) })
  }
  add("customerConcentration", 4, false)
  add("highDebt", 4, highDebt)
  add("dilution", 3, false)
  add("regulatory", 3, REGULATORY.has(ticker))
  add("chinaGeopolitical", 4, CHINA_DOMINANT.has(ticker))
  add("singleProduct", 4, false)
  add("cyclicality", 3, CYCLICAL.has(ticker))
  add("aiDisruption", 4, DISRUPTION.has(ticker))
  add("extremeValuation", 5, valuation === "Extreme")
  add("accountingGap", 4, finite(opm) && opm > 0 && finite(market?.operatingCashflow) && market.operatingCashflow <= 0)
  const rawPenalty = penalties.filter((item) => item.on).reduce((sum, item) => sum + item.points, 0)
  const penalty = Math.min(PENALTY_CAP, rawPenalty)
  const final = complete ? round1(clamp(weighted - penalty)) : null
  const grade = gradeOf(final, valuation)
  const durability = durabilityScore(axes.industry, axes.moat, axes.profit, fcfMargin, highDebt, assessment.ai, aiScore)
  const confidence = !complete ? "Low" : (growthBasis === "cagr3" && finite(opm) && finite(fcfMargin) && valuation ? "High" : "Medium")
  const cagrStart = path.length >= 4 ? path[path.length - 4] : null
  const cagrEnd = path.length ? path[path.length - 1] : null
  return {
    ticker,
    name: EQUITY_SELL_RESEARCH_UNIVERSE.find((item) => item.symbol === ticker)?.name ?? null,
    group: assessment.group,
    alsoFits: assessment.alsoFits ?? null,
    industry: assessment.industry,
    why: assessment.why,
    risk: assessment.risk,
    question: assessment.question,
    axes: Object.fromEntries(Object.entries(axes).map(([key, value]) => [key, { score: finite(value) ? round1(value) : null, band: band(value) }])),
    evidence: {
      moatTypes: moat.used,
      moatSustainability: moat.score >= 70 ? "높음" : moat.score >= 50 ? "보통" : "낮음",
      tamFlags: tam.used,
      aiClass: assessment.ai,
      revenueCagr3Y: finite(cagr3) ? round1(cagr3 * 100) : null,
      revenueCagr5Y: finite(cagr5) ? round1(cagr5 * 100) : null,
      revenueGrowthYoY: finite(yoy) ? round1(yoy * 100) : null,
      growthBasis,
      growthPeriod: growthBasis === "cagr3" && cagrStart ? `${cagrStart.end} to ${cagrEnd.end}` : null,
      epsCagr3Y: null,
      epsCagr5Y: null,
      grossMargin: finite(market?.grossMargins) ? round1(market.grossMargins * 100) : null,
      operatingMargin: finite(opm) ? round1(opm * 100) : null,
      earningsGrowthYoY: finite(market?.earningsGrowth) ? round1(market.earningsGrowth * 100) : null,
      roic: null,
      roe: finite(market?.returnOnEquity) ? round1(market.returnOnEquity * 100) : null,
      fcfMargin: finite(fcfMargin) ? round1(fcfMargin * 100) : null,
      debtToEquity: finite(market?.debtToEquity) ? round1(market.debtToEquity) : null,
      forwardPE: finite(market?.forwardPE) ? round1(market.forwardPE) : null,
      pegRatio: finite(market?.pegRatio) ? round1(market.pegRatio) : null,
      enterpriseToRevenue: finite(market?.enterpriseToRevenue) && market.enterpriseToRevenue > 0 && market.enterpriseToRevenue <= 100
        ? round1(market.enterpriseToRevenue)
        : null,
      enterpriseToEbitda: finite(market?.enterpriseToEbitda) ? round1(market.enterpriseToEbitda) : null,
      valuation,
      source: "Yahoo Finance quoteSummary snapshot",
      sourceDate: "2026-10-07",
    },
    penalties,
    penalty,
    businessQuality: round1(qualityScore),
    businessQualityBand: qualityBand(qualityScore),
    attractiveness: attractivenessOf(qualityBand(qualityScore), valuation),
    coreBlockedByValuation: finite(final) && final >= 85 && valuation === "Extreme",
    durability,
    final,
    grade,
    confidence,
  }
}

export function study(source) {
  if (SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  if (TICKERS.length !== 31 || new Set(TICKERS).size !== 31) throw new Error("universe drifted")
  const rows = TICKERS.map((ticker) => scoreTicker(ticker, source.tickers[ticker], ASSESSMENTS[ticker]))
  const ranked = rows.filter((row) => finite(row.final)).sort((a, b) => b.final - a.final || a.ticker.localeCompare(b.ticker))
  ranked.forEach((row, index) => {
    row.rank = index + 1
  })
  for (const row of rows) if (!finite(row.final)) row.rank = null
  const byGrade = (grade) => rows.filter((row) => row.grade === grade).sort((a, b) => b.final - a.final || a.ticker.localeCompare(b.ticker))
  const core = byGrade("CORE LONG-TERM")
  const groups = {}
  for (const row of rows) {
    const list = groups[row.group] ?? []
    list.push(row.ticker)
    groups[row.group] = list
  }
  return {
    selectedStrategy: SELECTED_STRATEGY,
    note: "Research ranking of ten-year hold suitability. Not an investment recommendation and not a sell rule.",
    rules: {
      noImputedRoic: true,
      noImputedCagr: true,
      penaltyCap: PENALTY_CAP,
      coreRequiresValuationNotExtreme: true,
      sellResearchNotUsed: true,
    },
    universe: TICKERS,
    count: rows.length,
    rows,
    ranked: ranked.map((row) => row.ticker),
    grades: {
      core,
      longTerm: byGrade("LONG-TERM"),
      watch: byGrade("WATCH"),
      speculative: byGrade("SPECULATIVE"),
      notLongTerm: byGrade("NOT LONG-TERM"),
      incomplete: byGrade("DATA_INCOMPLETE"),
    },
    coreUpTo5: core.slice(0, 5).map((row) => row.ticker),
    coreUpTo10: core.slice(0, 10).map((row) => row.ticker),
    groups,
    sourceDate: source.sourceDate ?? null,
  }
}

export { ASSESSMENTS }
