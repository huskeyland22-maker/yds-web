/**
 * 데스크 사이드바 · 모바일 drawer · 하단 탭 공통 1차 메뉴 (YDS V1 — 6개)
 * @returns {{ label: string; path: string }[]}
 */
export function getPrimaryNavItems() {
  return [
    { label: "시장분석", path: "/market-analysis" },
    { label: "Watchlist", path: "/watchlist" },
    { label: "알림", path: "/alert-center" },
    { label: "AI 리포트", path: "/ai-daily-report" },
    { label: "성과", path: "/performance-center" },
    { label: "Research", path: "/lab" },
  ]
}
