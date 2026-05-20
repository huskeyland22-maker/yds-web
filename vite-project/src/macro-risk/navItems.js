import { isMacroRiskEnabled } from "./featureFlag.js"

/** @returns {{ label: string; path: string; active: boolean }[]} */
export function getMarketOsNavItems() {
  const items = [{ label: "01 시장 사이클", path: "/cycle", active: true }]
  if (isMacroRiskEnabled()) {
    items.push({ label: "02 Macro Risk", path: "/macro-risk", active: true })
    items.push({ label: "03 코리아 밸류체인", path: "/value-chain", active: true })
    items.push({ label: "04 트레이딩 로그", path: "/trading-log", active: true })
  } else {
    items.push({ label: "02 코리아 밸류체인", path: "/value-chain", active: true })
    items.push({ label: "03 트레이딩 로그", path: "/trading-log", active: true })
  }
  return items
}

/** @returns {{ to: string; label: string }[]} */
export function getMobileDrawerLinks() {
  const links = [
    { to: "/cycle", label: "시장 사이클" },
    ...(isMacroRiskEnabled() ? [{ to: "/macro-risk", label: "Macro Risk" }] : []),
    { to: "/value-chain", label: "코리아 밸류체인" },
    { to: "/trading-log", label: "트레이딩 로그" },
  ]
  return links
}
