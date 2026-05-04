/**
 * 패닉 점수(0~100, 높을수록 공포↑) 기반 섹터·종목 추천 (교육용).
 */

/** @typedef {{ name: string, ticker: string, type: string, theme: string }} StockRow */

/** @type {StockRow[]} */
export const stockList = [
  { name: "엔비디아", ticker: "NVDA", type: "growth", theme: "AI 성장" },
  { name: "테슬라", ticker: "TSLA", type: "growth", theme: "기술·성장" },
  { name: "메타", ticker: "META", type: "growth", theme: "플랫폼 성장" },
  { name: "알파벳", ticker: "GOOGL", type: "growth", theme: "AI·클라우드" },
  { name: "마이크로소프트", ticker: "MSFT", type: "growth", theme: "AI·소프트웨어" },
  { name: "AMD", ticker: "AMD", type: "semi", theme: "반도체" },
  { name: "삼성전자", ticker: "005930.KS", type: "semi", theme: "반도체" },
  { name: "SK하이닉스", ticker: "000660.KS", type: "semi", theme: "메모리" },
  { name: "TSMC", ticker: "TSM", type: "semi", theme: "파운드리" },
  { name: "브로드컴", ticker: "AVGO", type: "semi", theme: "칩·인프라" },
  { name: "팔란티어", ticker: "PLTR", type: "ai", theme: "AI 소프트웨어" },
  { name: "크라우드스트라이크", ticker: "CRWD", type: "ai", theme: "사이버·AI" },
  { name: "스노우플레이크", ticker: "SNOW", type: "ai", theme: "데이터·AI" },
  { name: "캐터필러", ticker: "CAT", type: "industrial", theme: "산업재" },
  { name: "GE", ticker: "GE", type: "industrial", theme: "산업·항공" },
  { name: "다우", ticker: "DOW", type: "industrial", theme: "소재·산업" },
  { name: "S&P500 ETF", ticker: "SPY", type: "etf", theme: "분산·대형주" },
  { name: "나스닥100 ETF", ticker: "QQQ", type: "etf", theme: "분산·기술" },
  { name: "KODEX 200", ticker: "069500.KS", type: "etf", theme: "국내 대표지수" },
  { name: "아이셰어즈 핵심배당", ticker: "DGRO", type: "etf", theme: "배당·분산" },
  { name: "바이택 ETF", ticker: "VGT", type: "etf", theme: "기술·분산" },
  { name: "코카콜라", ticker: "KO", type: "staples", theme: "필수소비재" },
  { name: "P&G", ticker: "PG", type: "staples", theme: "필수소비재" },
  { name: "월마트", ticker: "WMT", type: "staples", theme: "필수소비재" },
  { name: "존슨앤드존슨", ticker: "JNJ", type: "dividend", theme: "배당·방어" },
  { name: "버크셔 B", ticker: "BRK.B", type: "dividend", theme: "배당·가치" },
  { name: "3M", ticker: "MMM", type: "dividend", theme: "배당·산업" },
  { name: "KOSEF 국고채10년", ticker: "148070.KS", type: "safe", theme: "채권 ETF" },
  { name: "iShares 1-3년 국채", ticker: "SHY", type: "safe", theme: "채권·현금성" },
  { name: "머니마켓(현금성)", ticker: "CASH", type: "safe", theme: "현금" },
  { name: "VG 단기국채", ticker: "VGSH", type: "safe", theme: "단기 국채" },
  { name: "iShares 0-3개월 국채", ticker: "SGOV", type: "safe", theme: "초단기·현금성" },
]

const REGIMES = [
  {
    id: "extreme",
    minScore: 80,
    label: "극단적 공포 (강한 매수)",
    types: ["growth"],
    tone: "up",
    headline: "극단적 공포 구간 — 역발상으로 성장·기술주 반등을 노릴 때가 많습니다.",
  },
  {
    id: "buy",
    minScore: 65,
    label: "매수 구간",
    types: ["semi", "ai", "industrial"],
    tone: "up",
    headline: "공포가 유지되는 매수 구간 — 반도체·AI·산업재로 섹터를 좁혀 보세요.",
  },
  {
    id: "neutral",
    minScore: 50,
    label: "중립",
    types: ["etf"],
    tone: "neutral",
    headline: "중립 구간 — ETF로 분산하며 방향을 기다리는 편이 안전합니다.",
  },
  {
    id: "defense",
    minScore: 35,
    label: "방어",
    types: ["dividend", "staples"],
    tone: "defensive",
    headline: "방어 구간 — 배당·필수소비재로 변동성을 줄이세요.",
  },
  {
    id: "danger",
    minScore: -Infinity,
    label: "위험 회피",
    types: ["safe"],
    tone: "danger",
    headline: "위험 회피 구간 — 현금·단기채로 자본을 보존하는 것을 우선하세요.",
  },
]

function pickRegime(score) {
  const s = Number(score)
  const x = Number.isFinite(s) ? s : 50
  if (x >= 80) return REGIMES[0]
  if (x >= 65) return REGIMES[1]
  if (x >= 50) return REGIMES[2]
  if (x > 35) return REGIMES[3]
  return REGIMES[4]
}

/** 타입별로 한 종목씩 돌아가며 뽑아 섹터 혼합 */
function balancedPick(allRows, types, limit = 5) {
  const buckets = types.map((t) => allRows.filter((r) => r.type === t).slice())
  const out = []
  let guard = 0
  while (out.length < limit && guard < 50) {
    guard += 1
    let added = false
    for (const b of buckets) {
      if (out.length >= limit) break
      const next = b.shift()
      if (next) {
        out.push(next)
        added = true
      }
    }
    if (!added) break
  }
  return out
}

/**
 * @param {number} score — getFinalScore 등
 * @returns {{
 *   score: number,
 *   regime: typeof REGIMES[0],
 *   picks: { name: string, ticker: string, theme: string, reason: string }[],
 * }}
 */
export function getRecommendedStocks(score) {
  const regime = pickRegime(score)
  const allowed = new Set(regime.types)
  const pool = stockList.filter((row) => allowed.has(row.type))
  const chosen =
    regime.types.length > 1 ? balancedPick(pool, regime.types, 5) : pool.slice(0, 5)
  const picks = chosen.map((row) => ({
    name: row.name,
    ticker: row.ticker,
    theme: row.theme,
    reason: regime.headline,
  }))
  return {
    score: Number(score),
    regime,
    picks,
  }
}
