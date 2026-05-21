import { isMacroRiskEnabled } from "../macro-risk/featureFlag.js"

/**
 * 데스크 사이드바 · 모바일 drawer · 하단 탭 공통 1차 메뉴
 * @returns {{ label: string; path: string }[]}
 */
export function getPrimaryNavItems() {
  const items = [{ label: "시장 사이클", path: "/cycle" }]
  if (isMacroRiskEnabled()) {
    items.push({ label: "채권·유동성", path: "/macro-risk" })
  }
  items.push(
    { label: "코리아 밸류체인", path: "/value-chain" },
    { label: "트레이딩 로그", path: "/trading-log" },
  )
  return items
}
