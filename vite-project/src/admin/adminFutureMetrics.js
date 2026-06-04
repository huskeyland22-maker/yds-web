/**
 * 향후 Analytics 연동 슬롯 (사용자 수·조회수·인기 종목·검색)
 * @type {readonly { id: string; label: string; status: string }[]}
 */
export const ADMIN_FUTURE_METRICS = [
  { id: "users", label: "사용자 수", status: "planned" },
  { id: "pageviews", label: "조회수", status: "planned" },
  { id: "hotSymbols", label: "인기 종목", status: "planned" },
  { id: "search", label: "검색 통계", status: "planned" },
]
