/** 서버용 — koreaGrowthSectorMap / React 의존 없음 */
export function sectorFlowFromPanic(panicData, marketState) {
  const stateKey = marketState?.stateKey ?? "neutral"
  const leader =
    stateKey === "risk_on"
      ? { id: "ai-semiconductor", label: "AI·반도체", shortLabel: "AI·반도체" }
      : stateKey === "defensive" || stateKey === "fear_dominant" || stateKey === "volatility_expansion"
        ? { id: "power-infra", label: "전력·원전", shortLabel: "전력" }
        : { id: "ai-semiconductor", label: "AI·반도체", shortLabel: "AI·반도체" }
  return {
    leaderSector: [{ ...leader, score: 70, reasons: [] }],
    watchSector: [],
    avoidSector: [],
    scores: { [leader.id]: 70 },
    marketMoodLabel: "",
    marketStateLabel: marketState?.label ?? stateKey,
  }
}
