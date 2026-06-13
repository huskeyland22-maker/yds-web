/**
 * TOP10 "왜 이 종목인가?" 카드 — 산업·병목·실적·기술·액션
 */

import { getStockPickTotalScore } from "./ydsStockPickUxStatus.js"
import { resolveStockPickThemes } from "./ydsStockPickThemes.js"

/**
 * @typedef {{
 *   industry: string
 *   bottleneck: string
 *   performance: string
 *   technology: string
 *   action: string
 * }} StockPickWhyBrief
 */

/** @type {Record<string, Partial<StockPickWhyBrief>>} */
const TICKER_WHY = {
  NVDA: {
    industry: "AI 가속·데이터센터 GPU",
    bottleneck: "CoWoS·HBM 공급 제약 속 AI 수요",
    performance: "데이터센터 매출 비중 확대",
    technology: "Blackwell 세대 GPU·소프트웨어 생태계",
  },
  "000660": {
    industry: "HBM·DRAM 메모리",
    bottleneck: "AI 서버용 HBM 공급 부족",
    performance: "HBM 매출·마진 개선 사이클",
    technology: "HBM3E·고대역폭 패키징",
  },
  "005930": {
    industry: "파운드리·메모리·디스플레이",
    bottleneck: "HBM·先端 파운드리 수율·수주",
    performance: "메모리 업사이클·HBM 회복 기대",
    technology: "HBM·GAA 파운드리 로드맵",
  },
  GEV: {
    industry: "전력·그리드·가스터빈",
    bottleneck: "북미 전력망·변압기 납기",
    performance: "전력 인프라 수주·백로그 확대",
    technology: "그리드 현대화·가스·재생 믹스",
  },
  "298040": {
    industry: "변압기·전력기기",
    bottleneck: "북미·중동 변압기 수출 납기",
    performance: "전력 수주·수출 모멘텀",
    technology: "초고압 변압기·스마트 그리드",
  },
  "267260": {
    industry: "변압기·배전기기",
    bottleneck: "북미 전력 수주·생산 CAPA",
    performance: "해외 수주·마진 개선",
    technology: "대형 변압기·AMI 연계",
  },
  CEG: {
    industry: "원전·청정 전력",
    bottleneck: "AI 데이터센터 전력 수요",
    performance: "장기 전력 계약·가동률",
    technology: "원전·재생 하이브리드 전력",
  },
  "012450": {
    industry: "방산·항공우주",
    bottleneck: "글로벌 방산 수출·납기",
    performance: "수주잔고·수출 비중 확대",
    technology: "유도무기·항공 엔진",
  },
  MU: {
    industry: "HBM·DRAM·NAND",
    bottleneck: "AI 메모리 공급 제약",
    performance: "HBM·메모리 가격 사이클",
    technology: "HBM3E·고밀도 DRAM",
  },
  "277810": {
    industry: "협동·산업 로봇",
    bottleneck: "제조·물류 자동화 수요",
    performance: "로봇·SI 수주 확대",
    technology: "협동로봇·모션 제어",
  },
}

/** @type {Record<string, Partial<StockPickWhyBrief>>} */
const SECTOR_WHY = {
  ai: {
    industry: "AI·클라우드·소프트웨어",
    bottleneck: "AI 투자·인프라 CAPEX 사이클",
    performance: "AI 매출·클라우드 성장",
    technology: "생성형 AI·플랫폼 확장",
  },
  power: {
    industry: "전력·그리드·전력기기",
    bottleneck: "변압기·배전 납기·수주",
    performance: "전력 인프라 수주·수출",
    technology: "스마트 그리드·전력 관리",
  },
  defense: {
    industry: "방산·항공·조선",
    bottleneck: "지정학·수출 수주 납기",
    performance: "수주잔고·수출 모멘텀",
    technology: "정밀 유도·플랫폼 통합",
  },
  semi: {
    industry: "반도체·장비·패키징",
    bottleneck: "HBM·先端 공정 공급",
    performance: "메모리·장비 사이클",
    technology: "HBM·고급 패키징·테스트",
  },
  robot: {
    industry: "로봇·자동화",
    bottleneck: "제조·물류 자동화 투자",
    performance: "로봇·부품 매출 성장",
    technology: "협동·산업용 로봇",
  },
  nuclear: {
    industry: "원전·에너지",
    bottleneck: "전력·원전 수요·규제",
    performance: "EPC·가동·전력 계약",
    technology: "SMR·원전 현대화",
  },
  infra: {
    industry: "인프라·건설·물류",
    bottleneck: "SOC·CAPEX·물류 효율",
    performance: "수주·운송·장비 실적",
    technology: "스마트 인프라·자동화",
  },
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 * @returns {StockPickWhyBrief}
 */
export function buildStockPickWhyBrief(stock) {
  const ticker = String(stock.ticker ?? "").toUpperCase()
  const sector = stock.sector ?? "ai"
  const themes = resolveStockPickThemes(stock)
  const comment = String(stock.comment ?? "").trim()

  const base = {
    ...SECTOR_WHY[sector],
    ...TICKER_WHY[ticker],
  }

  const actionLabel = stock.stockAction?.label ?? stock.stockStatus?.label ?? "관망"
  const actionReason = stock.actionReason ?? stock.recommendReasonSummary ?? comment
  const totalScore = getStockPickTotalScore(stock)

  return {
    industry: base.industry ?? `${themes[0] ?? stock.sectorLabel} 관련 핵심 산업`,
    bottleneck: base.bottleneck ?? (comment || "수급·수주·CAPEX 사이클"),
    performance: base.performance ?? (comment || "실적·수주 모멘텀 점검"),
    technology: base.technology ?? (comment || "핵심 기술·제품 경쟁력"),
    action: `${actionLabel}${totalScore != null ? ` · 종합 ${totalScore}점` : ""}${actionReason ? ` — ${actionReason}` : ""}`,
  }
}
