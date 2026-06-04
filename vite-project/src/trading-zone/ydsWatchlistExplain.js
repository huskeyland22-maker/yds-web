/**
 * Watchlist V2 — 상태·우선순위 설명 (엔진 미변경, 표시 레이어)
 */

/** @type {Record<string, { title: string; bullets: string[] }>} */
export const WATCH_STATE_EXPLAIN = {
  observe: {
    title: "관찰",
    bullets: ["진입 신호 대기", "Stock Radar·Entry 등급 점검", "시장 단계와 섹터 강도 확인"],
  },
  dip_wait: {
    title: "눌림대기",
    bullets: ["눌림 구간 진입 대기", "손절·매수존 사전 설정", "PRI-B·변동성 확인"],
  },
  entry_ready: {
    title: "진입가능",
    bullets: ["반도체·핵심 섹터 강세 가능", "기술·시장 적합도 양호", "Entry A/B 등급 충족"],
  },
  holding: {
    title: "보유",
    bullets: ["Paper/실계좌 보유 중", "손절·목표가 유지", "단계 변경 시 비중 재점검"],
  },
  take_profit_wait: {
    title: "익절대기",
    bullets: ["목표 수익 근접", "분할 익절 검토", "추세 이탈 시 방어"],
  },
}

/** @type {Record<string, string>} */
export const WATCH_PRIORITY_HINT = {
  today: "오늘 확인 — 진입·익절 등 즉시 행동 검토",
  week: "이번주 확인 — 눌림·돌파 후속 관찰",
  long_term: "장기 관찰 — 단계·섹터 변화 모니터링",
}

/**
 * @param {{
 *   watchStateId: string
 *   watchStateLabel: string
 *   priorityId: string
 *   sectorLabel: string
 *   score: number
 *   stockStatus?: { label?: string } | null
 *   scoreBreakdown?: { marketFit?: number; sectorStrength?: number; technicalTrend?: number } | null
 * }} item
 */
export function buildWatchlistItemExplain(item) {
  const base = WATCH_STATE_EXPLAIN[item.watchStateId] ?? WATCH_STATE_EXPLAIN.observe
  /** @type {string[]} */
  const bullets = [...base.bullets]

  if (item.sectorLabel) bullets.unshift(`${item.sectorLabel} 섹터 맥락`)
  if (item.scoreBreakdown?.technicalTrend != null && item.scoreBreakdown.technicalTrend >= 80) {
    bullets.push("기술 추세 점수 우수")
  }
  if (item.scoreBreakdown?.marketFit != null && item.scoreBreakdown.marketFit >= 78) {
    bullets.push("시장 적합도 양호")
  }
  if (item.stockStatus?.label) bullets.push(`종목 상태 · ${item.stockStatus.label}`)

  return {
    stateTitle: base.title,
    stateBullets: bullets.slice(0, 4),
    priorityHint: WATCH_PRIORITY_HINT[item.priorityId] ?? WATCH_PRIORITY_HINT.week,
  }
}
