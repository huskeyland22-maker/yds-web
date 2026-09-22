/** V1 한글 UI 라벨 — 표시명만. path·id·엔진 key는 변경하지 않음 */

/**
 * 사이드바 최상위 핵심 2메뉴 (표시용 메타 포함)
 * @returns {{ label: string; shortLabel: string; path: string; subtitle: string; tone: 'brand' | 'panic' }[]}
 */
export function getCoreNavItems() {
  return [
    {
      label: "일상 조정 매수",
      shortLabel: "조정매수",
      path: "/daily-bottom-buy",
      subtitle: "섹터 ETF · 일상 조정 타점",
      tone: "brand",
    },
    {
      label: "공포·패닉 매수",
      shortLabel: "패닉매수",
      path: "/market-analysis",
      subtitle: "Panic Index · 장기 참고",
      tone: "panic",
    },
  ]
}

/**
 * 기타 기능 (접기 그룹) — 기존 route 전부 유지
 * @returns {{ label: string; path: string }[]}
 */
export function getOtherNavItems() {
  return [
    { label: "⭐ 종목추천", path: "/stock-picks" },
    { label: "💼 포트폴리오", path: "/portfolio" },
    { label: "📈 성과검증", path: "/performance-validation" },
    { label: "⭐ 관심종목", path: "/watchlist" },
    { label: "🔔 알림", path: "/alert-center" },
    { label: "📋 투자 원칙", path: "/investment-playbook" },
    { label: "📅 투자 캘린더", path: "/investment-calendar" },
    { label: "🧪 패닉 연구실", path: "/panic-lab" },
    { label: "🧪 연구실", path: "/lab" },
    { label: "시작하기", path: "/start" },
    { label: "About", path: "/about" },
    { label: "용어 설명", path: "/glossary" },
  ]
}

/** @deprecated 호환용 — 핵심 메뉴만 반환 */
export function getPrimaryNavItems() {
  return getCoreNavItems().map((item) => ({ label: item.label, path: item.path }))
}

/** @deprecated 호환용 — 기타 기능과 동일 */
export function getSecondaryNavItems() {
  return getOtherNavItems()
}

/** 하단 고정 안내 (소개·FAQ·피드백) */
export function getSidebarFooterLinks() {
  return [
    { label: "YDS 소개", path: "/intro" },
    { label: "FAQ", path: "/faq" },
    { label: "피드백", path: "/feedback" },
  ]
}

/** @type {Record<string, string>} */
export const NAV_MOBILE_SHORT = {
  "/": "인생",
  "/daily-bottom-buy": "일상 조정 매수",
  "/market-analysis": "공포·패닉 매수",
  "/stock-picks": "종목",
  "/watchlist": "관심",
  "/portfolio": "포트",
  "/performance-validation": "검증",
  "/performance-dashboard": "포트",
  "/ai-daily-report": "인사이트",
  "/alert-center": "알림",
  "/panic-lab": "패닉",
  "/investment-calendar": "캘린더",
  "/investment-playbook": "원칙",
  "/lab": "연구",
}

export const UI_RADAR = {
  stock: "종목 추천",
  sector: "추천 섹터",
  entry: "진입 신호",
}

export const UI_PAGE = {
  stockPicks: {
    title: "종목추천",
    kicker: "종목추천 · Phase 2-7",
    path: "/stock-picks",
  },
  portfolio: {
    title: "포트폴리오 센터",
    kicker: "Portfolio Center V1",
    path: "/portfolio",
  },
  watchlist: {
    title: "관심종목",
    kicker: "Watchlist · YDS V1",
    subtitleSuffix: "등록 종목 추적",
    path: "/watchlist",
  },
  alert: {
    title: "알림",
    kicker: "알림 · YDS V1",
  },
  performance: {
    title: "성과",
    kicker: "성과센터 · YDS V1",
  },
  performanceValidation: {
    title: "성과 검증",
    kicker: "백테스트 · YDS V1",
    path: "/performance-validation",
  },
  research: {
    title: "연구실",
    kicker: "연구실 · YDS V1",
  },
  panicLab: {
    title: "패닉 연구실",
    kicker: "Panic Lab · YDS V1",
    path: "/panic-lab",
  },
  lifeStrategy: {
    title: "YDS 인생 투자전략",
    kicker: "지금, 그리고 10년 후까지",
    path: "/",
  },
  marketPanic: {
    title: "공포·패닉 매수",
    kicker: "지금 시장은 어떤 구간인가",
    path: "/market-analysis",
  },
}

export const UI_BTN = {
  detail: "상세 보기",
  whyRecommend: "왜 추천?",
  whyWatch: "왜 관찰?",
  whyAlert: "왜 알림?",
  performance: "성과 보기",
  watchlist: "관심종목 보기",
  watchlistFromAlert: "관심종목에서 보기",
  marketAnalysis: "공포·패닉 매수",
}

/** @type {Record<string, string>} */
export const UI_TERM_DISPLAY = {
  "Stock Radar": UI_RADAR.stock,
  "Sector Radar": UI_RADAR.sector,
  "Entry Radar": UI_RADAR.entry,
  Watchlist: UI_PAGE.watchlist.title,
  "Watchlist Center": UI_PAGE.watchlist.title,
  "Alert Center": UI_PAGE.alert.title,
  "Performance Center": UI_PAGE.performance.title,
  Research: UI_PAGE.research.title,
  "Market Fit": "시장 적합도",
  "Sector Strength": "섹터 강도",
  "Technical Trend": "기술적 추세",
  Volume: "거래량 점수",
  Confidence: "신뢰도",
  Regime: "시장 국면",
  Pattern: "위험 패턴",
  "Market Analysis": "공포·패닉 매수",
}

/**
 * @param {string} text
 * @returns {string}
 */
export function applyUiTermDisplay(text) {
  if (!text || typeof text !== "string") return text
  let out = text
  const keys = Object.keys(UI_TERM_DISPLAY).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    out = out.split(key).join(UI_TERM_DISPLAY[key])
  }
  return out
}
