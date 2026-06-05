import { YDS_VALIDATION_EVENT_DATASET } from "./ydsHistoricalValidationEvents.js"
import { buildCurrentMarketAnalysisReport } from "./ydsCurrentMarketAnalysis.js"

export const AI_DAILY_REPORT_LABEL = "AI Daily Report — Phase 34"

/** @type {Record<string, string>} */
const STAGE_ONE_LINER = {
  overheated: "과열 구간 — 현금 확보와 추격 자제가 우선입니다.",
  neutral: "중립 구간 — 종목 탐색·선별 관찰 단계입니다.",
  interest: "관심 구간 — 우량주 추적과 현금 비중 유지가 핵심입니다.",
  dca: "분할매수 구간 — 준비된 현금을 나눠 투입할 시기입니다.",
  panicBuy: "패닉매수 구간 — 계획된 현금 투입을 검토할 수 있습니다.",
}

/** @type {Record<string, string>} */
const STAGE_EXPLANATION = {
  overheated:
    "YDS는 시장이 과열 구간에 있다고 판단합니다. 주식 비중을 낮추고 현금을 확보하며, 신규 추격 매수는 제한하는 것이 권장됩니다.",
  neutral:
    "YDS는 아직 패닉매수 단계가 아닌 중립 구간으로 봅니다. 시장은 관찰·종목 선별에 적합하며, 무리한 일괄 매수보다 탐색이 우선입니다.",
  interest:
    "조정 가능성이 커지는 관심 구간입니다. 핵심 섹터·종목을 추적하되, 현금 일부를 유지하며 선별 매수를 준비하세요.",
  dca:
    "공포가 확대되는 분할매수 구간입니다. 분할 계획에 따라 우량 종목에 나눠 진입하고, 한 번에 몰아넣지 않는 것이 좋습니다.",
  panicBuy:
    "역사적 공포에 가까운 패닉매수 구간입니다. 사전에 준비한 현금을 계획대로 투입할 수 있는 국면으로 해석됩니다.",
}

/** @type {Record<string, string>} */
const RISK_INTERPRETATION = {
  stable:
    "시장 위험도는 상대적으로 낮습니다. 다만 행동 단계와 괴리가 없는지 함께 확인하세요.",
  watch:
    "일부 리스크 신호가 감지됩니다. 포지션 크기를 점검하고 모니터링 빈도를 높이세요.",
  danger:
    "리스크가 확대된 구간입니다. 방어적 비중·손절 규칙을 점검하고 추격 매수는 자제하세요.",
  crisis:
    "패닉 가능성이 높아진 구간입니다. 역사적 저점 매수를 검토할 수 있으나, 분할·현금 관리가 필수입니다.",
}

/** @type {Record<string, string>} */
const ACTION_GUIDE_BY_STAGE = {
  overheated: "오늘은 비중 축소·현금 확보를 우선하고, 신규 매수는 관망하세요.",
  neutral: "오늘은 종목 탐색과 관찰을 우선하고, 확신 없는 추격 매수는 피하세요.",
  interest: "오늘은 관심 종목 리스트를 점검하고, 소액·분할 진입만 검토하세요.",
  dca: "오늘은 분할매수 계획에 따라 우량 종목에 나눠 진입하세요.",
  panicBuy: "오늘은 계획된 현금을 활용해 패닉매수 후보를 분할 집행하세요.",
}

/**
 * @param {string[]} names
 */
function joinKoreanNames(names) {
  if (!names.length) return ""
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]}·${names[1]}`
  return `${names.slice(0, -1).join("·")}·${names[names.length - 1]}`
}

/**
 * @param {ReturnType<typeof buildCurrentMarketAnalysisReport>} report
 */
export function buildAiDailyReportFromMarketAnalysis(report) {
  const stageId = report.actionStageHero?.id ?? null
  const stageLabel = report.actionStageHero?.shortLabel ?? "—"
  const env = report.marketEnvironment?.marketCondition
  const envId = env?.levelId ?? "watch"
  const bullSim = report.marketEnvironment?.bullSimilarity

  const topSectors = (report.sectorRadar?.topSectors ?? []).slice(0, 3)
  const sectorLabels = topSectors.map((s) => s.label)

  const topStocksFromRadar = (report.stockRadar?.topBuys ?? []).slice(0, 3)
  const topStocksFromEntry = [...(report.entryRadar?.tradeCandidates ?? [])]
    .sort((a, b) => (b.entryScore ?? 0) - (a.entryScore ?? 0))
    .slice(0, 3)
    .map((c) => c.name)
  const stockPicks =
    topStocksFromRadar.length >= 1
      ? topStocksFromRadar.slice(0, 3)
      : topStocksFromEntry.length
        ? topStocksFromEntry.map((name, i) => ({ id: null, name, rank: i + 1, score: null }))
        : topStocksFromRadar

  const stockNames = stockPicks.map((s) => (typeof s === "string" ? s : s.name))

  const allocation = report.portfolio?.allocation

  const sectionA = {
    headline:
      (stageId && STAGE_ONE_LINER[stageId]) ||
      report.marketBrief?.cards?.[0]?.value ||
      "시장 데이터를 집계 중입니다.",
  }

  const sectionB = {
    title: `현재 단계 · ${report.actionStageHero?.emoji ?? ""} ${stageLabel}`,
    body:
      (stageId && STAGE_EXPLANATION[stageId]) ||
      report.actionStageHero?.description ||
      "행동 단계를 산출할 수 없습니다.",
    allocationHint: allocation?.summary ?? null,
  }

  const bullLine =
    bullSim != null && bullSim >= 55 && stageId !== "panicBuy"
      ? "강세장 유사도는 높지만 아직 패닉매수 단계는 아닙니다."
      : bullSim != null && stageId === "panicBuy"
        ? "강세장 유사도와 함께 패닉매수 국면으로 해석됩니다."
        : bullSim != null
          ? `강세장 유사도는 ${bullSim}% 수준입니다.`
          : null

  const sectionC = {
    title: `시장 위험도 · ${env?.emoji ?? ""} ${env?.label ?? "—"}`,
    body: RISK_INTERPRETATION[envId] ?? env?.description ?? "—",
    contrast: report.marketEnvironment?.contrastNote ?? null,
    bullLine,
    confidenceLine:
      report.marketEnvironment?.confidenceScore != null
        ? `신뢰도 ${report.marketEnvironment.confidenceScore}% (${report.marketEnvironment.confidenceLabel})`
        : null,
  }

  const sectionD = {
    items: topSectors.map((s) => ({
      rank: s.rank,
      label: s.label,
      score: s.score,
    })),
    summary:
      sectorLabels.length > 0
        ? `${joinKoreanNames(sectorLabels)} 섹터가 상대적으로 우세합니다.`
        : "추천 섹터를 산출할 수 없습니다.",
  }

  const sectionE = {
    items: stockPicks.map((s, i) =>
      typeof s === "string"
        ? { rank: i + 1, name: s, id: null, score: null }
        : { rank: s.rank ?? i + 1, name: s.name, id: s.id ?? null, score: s.score ?? null },
    ),
    summary:
      stockNames.length > 0
        ? `${joinKoreanNames(stockNames)}를 우선 관찰하십시오.`
        : "추천 종목을 산출할 수 없습니다.",
  }

  const sectionF = {
    action: report.actionGuide?.current?.label ?? report.actionGuide?.oneLiner ?? "—",
    recommended: report.actionGuide?.recommended?.label ?? null,
    body: (stageId && ACTION_GUIDE_BY_STAGE[stageId]) || report.actionGuide?.oneLiner || "—",
    allocation: allocation
      ? `${allocation.stockLabel} · ${allocation.cashLabel}`
      : null,
  }

  /** @type {string[]} */
  const narrativeParts = []
  if (stageId) {
    narrativeParts.push(`현재는 ${stageLabel}구간입니다.`)
  }
  if (bullLine) narrativeParts.push(bullLine)
  if (sectorLabels.length) {
    narrativeParts.push(`${joinKoreanNames(sectorLabels)} 섹터가 우세하며`)
  }
  if (stockNames.length) {
    narrativeParts.push(`${joinKoreanNames(stockNames)}를 우선 관찰하십시오.`)
  }
  const narrative =
    narrativeParts.length > 0
      ? narrativeParts.join(" ")
      : "시장 분석 데이터가 준비되면 일일 리포트가 생성됩니다."

  return {
    label: AI_DAILY_REPORT_LABEL,
    title: "AI 일일 투자 리포트",
    available: Boolean(stageId),
    asOf: report.asOf,
    asOfDisplay: report.asOf ? String(report.asOf).slice(0, 10) : "—",
    generatedNote: "GPT 미사용 · 현재 시장 분석 템플릿 자동 생성",
    narrative,
    sectionA,
    sectionB,
    sectionC,
    sectionD,
    sectionE,
    sectionF,
    notes: [
      "현재 시장 분석·추천 섹터/종목/진입 신호 읽기 전용 집약",
      "투자 조언이 아닌 YDS 시그널 해석용 내부 리포트",
      "YDS 엔진 미수정",
    ],
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} [events]
 * @param {{ latestSnapshot?: Record<string, unknown> | null; extraRows?: object[] }} [options]
 */
export function buildAiDailyReport(events = YDS_VALIDATION_EVENT_DATASET, options = {}) {
  const market = buildCurrentMarketAnalysisReport(events, options)
  return buildAiDailyReportFromMarketAnalysis(market)
}
