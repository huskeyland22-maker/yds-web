/**
 * 데스크 사이드바 · 모바일 drawer · 하단 탭 공통 1차 메뉴
 * @returns {{ label: string; path: string }[]}
 */
export function getPrimaryNavItems() {
  return [
    { label: "현재 시장 분석", path: "/market-analysis" },
    { label: "시장 사이클", path: "/cycle" },
    { label: "코리아 밸류체인", path: "/value-chain" },
    { label: "트레이딩 로그", path: "/trading-log" },
    { label: "연구실", path: "/lab" },
    { label: "추천 이력", path: "/recommendation-history" },
    { label: "성과센터", path: "/performance-center" },
    { label: "AI 리포트", path: "/ai-daily-report" },
  ]
}
