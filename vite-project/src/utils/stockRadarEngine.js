const WATCH_UNIVERSE = [
  { name: "엔비디아", ticker: "NVDA", sector: "AI 반도체" },
  { name: "브로드컴", ticker: "AVGO", sector: "AI 반도체" },
  { name: "LS ELECTRIC", ticker: "010120.KS", sector: "전력/인프라" },
  { name: "효성중공업", ticker: "298040.KS", sector: "전력/인프라" },
  { name: "프리포트맥모란", ticker: "FCX", sector: "원자재" },
  { name: "BHP", ticker: "BHP", sector: "원자재" },
  { name: "에코프로", ticker: "086520.KQ", sector: "2차전지" },
  { name: "코카콜라", ticker: "KO", sector: "소비재" },
]

function pickSignal(state, score, index) {
  if (state === "패닉" || state === "공포") {
    return index % 2 === 0
      ? { tag: "눌림 대기", desc: "과매도 반등 전환 확인 후 진입", tone: "amber" }
      : { tag: "관망", desc: "추세 확인 전 포지션 축소 유지", tone: "gray" }
  }
  if (state === "과열" || state === "버블") {
    return index % 2 === 0
      ? { tag: "추세 유지", desc: "이평 이탈 전까지 보유 우위", tone: "emerald" }
      : { tag: "거래량 경보", desc: "단기 과열 거래량 급증 구간", tone: "rose" }
  }
  if (score >= 60) {
    return index % 2 === 0
      ? { tag: "추세 유지", desc: "20일선 상방 구조 유지", tone: "emerald" }
      : { tag: "눌림 감시", desc: "이평 수렴 구간 재돌파 대기", tone: "sky" }
  }
  return index % 2 === 0
    ? { tag: "거래량 회복", desc: "거래대금 회복 이후 탄력 확인", tone: "sky" }
    : { tag: "눌림 대기", desc: "지지선 테스트 후 분할 접근", tone: "amber" }
}

function buildTechSignals(state, score, index) {
  if (state === "패닉" || state === "공포") {
    return index % 2 === 0
      ? ["20일선 눌림", "RSI 회복 시도", "MACD 바닥권"]
      : ["지지선 테스트", "거래량 감소", "추세 복원 대기"]
  }
  if (state === "과열" || state === "버블") {
    return index % 2 === 0
      ? ["추세 유지", "고점 돌파 시도", "이평 괴리 주의"]
      : ["거래량 급증", "RSI 과열권", "단기 되돌림 경계"]
  }
  if (score >= 60) {
    return index % 2 === 0
      ? ["20일선 지지", "추세 돌파", "거래량 증가 감지"]
      : ["이평선 수렴", "박스권 돌파 시도", "MACD 상향 전환"]
  }
  return index % 2 === 0
    ? ["거래량 회복", "저점 상승", "RSI 반등"]
    : ["눌림 대기", "지지선 확인", "추세 전환 시도"]
}

export function buildStockRadar({ brief, score }) {
  const strongSectorRows = (brief?.sectors?.strong ?? []).map((s) => ({
    name: s.name,
    score: Number(s.score) || 0,
    trend: s.trend,
  }))
  const weakSectorRows = (brief?.sectors?.weak ?? []).map((s) => ({
    name: s.name,
    score: Number(s.score) || 0,
    trend: s.trend,
  }))
  const strongSectors = new Set(strongSectorRows.map((s) => s.name))
  const weakSectors = new Set(weakSectorRows.map((s) => s.name))

  const candidates = WATCH_UNIVERSE.filter((s) => strongSectors.has(s.sector))
    .slice(0, 4)
    .map((s, i) => ({
      ...s,
      signal: pickSignal(brief?.state, Number(score) || 50, i),
      techSignals: buildTechSignals(brief?.state, Number(score) || 50, i),
    }))

  const caution = WATCH_UNIVERSE.filter((s) => weakSectors.has(s.sector))
    .slice(0, 2)
    .map((s) => s.name)

  return {
    headline: "유망 종목 레이더",
    subline: `${brief?.state ?? "중립"} · ${brief?.risk ?? "보통"} 구간 감시 종목`,
    strongSectors: strongSectorRows.slice(0, 3),
    weakSectors: weakSectorRows.slice(0, 3),
    candidates,
    cautionLine: caution.length ? `주의 섹터: ${caution.join(" · ")}` : "주의 섹터: -",
    strategyLine:
      brief?.risk === "매우 높음" || brief?.risk === "높음"
        ? "리스크 구간: 신규 추격 금지, 눌림 확인 후 진입."
        : "중립/순환매 구간: 강한 섹터 중심 감시 강화.",
  }
}
