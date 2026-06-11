/**
 * Bond / Liquidity 데이터 정책 — FRED H.15 단일 출처
 */

export const BOND_FRED_POLICY_LABEL = "FRED H.15 · 미국장 종가 확정"

export const BOND_FRED_SERIES_MAP = [
  { macroKey: "US10Y", fredId: "DGS10", apiKeys: ["dgs10", "us10y", "yield10"] },
  { macroKey: "US30Y", fredId: "DGS30", apiKeys: ["dgs30", "us30y", "yield30"] },
  { macroKey: "US2Y", fredId: "DGS2", apiKeys: ["dgs2", "us2y"] },
  { macroKey: "REAL_YIELD", fredId: "DFII10", apiKeys: ["dfii10", "realYield"] },
  { macroKey: "BEI", fredId: "T10YIE", apiKeys: ["t10yie", "bei"] },
]

export const BOND_DATA_FOOTNOTE =
  "채권: FRED H.15 공식 종가(DGS10·DGS30·DGS2·DFII10·T10YIE) · 당일 장중 아님 · 확정 스냅샷 우선 · DXY만 market-data · KST 08:00 기준 해석"
