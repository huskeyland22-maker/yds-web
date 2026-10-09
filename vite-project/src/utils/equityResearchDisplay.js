import { EQUITY_SELL_RESEARCH_UNIVERSE } from "../../../scripts/lib/equity-sell-research-universe.mjs"

/** Display names only. Does not change the research universe. */
export const EQUITY_RESEARCH_NAME_KO = {
  AMZN: "아마존",
  AAPL: "애플",
  AMAT: "어플라이드 머티리얼즈",
  ASML: "ASML",
  AVGO: "브로드컴",
  CEG: "콘스텔레이션 에너지",
  ETN: "이튼",
  FCX: "프리포트-맥모란",
  FTNT: "포티넷",
  GOOGL: "알파벳",
  LRCX: "램리서치",
  LLY: "일라이 릴리",
  MU: "마이크론",
  NVDA: "엔비디아",
  ORCL: "오라클",
  PANW: "팔로알토 네트웍스",
  PLTR: "팔란티어",
  TSLA: "테슬라",
  TSM: "TSMC",
  VST: "비스트라",
  KLAC: "KLA",
  ANET: "아리스타 네트웍스",
  VRT: "버티브",
  PWR: "퀀타 서비스",
  V: "비자",
  MSFT: "마이크로소프트",
  GEV: "GE 버노바",
  ISRG: "인튜이티브 서지컬",
  SNPS: "시놉시스",
  AMD: "AMD",
  CRWD: "크라우드스트라이크",
}

/** Frozen research names, in list order. Not the 20-name screen scan. */
export function equityResearchDisplayList(scanRows = []) {
  const scan = new Map((scanRows || []).map((row) => [row.symbol, row]))
  return EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => {
    const known = scan.get(row.symbol)
    return {
      symbol: row.symbol,
      name: known?.name || row.name,
      nameKo: EQUITY_RESEARCH_NAME_KO[row.symbol] || "",
      group: known?.group || null,
      role: row.role,
    }
  })
}

/** Ticker, English name, Korean name. Role badges stay off this label. */
export function equityTickerLabel(row) {
  if (!row) return ""
  const ko = row.nameKo || EQUITY_RESEARCH_NAME_KO[row.symbol] || ""
  return [row.symbol, row.name, ko].filter(Boolean).join(" · ")
}

/** The picker starts closed so the 31 names are not on screen. */
export function initialTickerPickerState() {
  return { open: false }
}

export function toggleTickerPicker(state) {
  return { open: !state?.open }
}

export function closeTickerPicker() {
  return { open: false }
}

const EQUITY_STAGE_CLASS = {
  strongLow: "strong",
  firstBuy: "primary",
  interest: "watch",
  wait: "wait",
}

/**
 * Summary-row text for one already computed view.
 * A missing view stays blank. A real score of 0 stays 0/4.
 */
export function equitySummaryRow(view) {
  const scored = view?.ok === true && Number.isFinite(Number(view.score))
  if (!scored) {
    return { countText: "—", stageLabel: "—", stageClass: "wait" }
  }
  return {
    countText: `${Number(view.score)}/4`,
    stageLabel: view.state?.label || "—",
    stageClass: EQUITY_STAGE_CLASS[view.state?.id] || "wait",
  }
}

/** Search and group filters only. Does not cap the list. */
export function visibleResearchStocks(rows, { group = "all", query = "" } = {}) {
  const q = String(query || "").trim().toLowerCase()
  return (rows || []).filter((row) => {
    if (group !== "all" && row.group !== group) return false
    if (!q) return true
    const ko = String(row.nameKo || "").toLowerCase()
    return (
      row.symbol.toLowerCase().includes(q) ||
      String(row.name || "").toLowerCase().includes(q) ||
      ko.includes(q)
    )
  })
}
