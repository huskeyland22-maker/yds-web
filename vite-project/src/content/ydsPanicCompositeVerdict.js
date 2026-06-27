/**
 * 패닉 V2 — 심리 + 가격 위치 + 추세 종합 판정
 *
 * YDS 패닉 점수: 높을수록 공포·매수 기회 (역발상)
 */

import { getFinalScore } from "../utils/tradingScores.js"
import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { buildPanicPricePositionReport } from "./ydsPanicPricePosition.js"

/** @typedef {'trueFear' | 'earlyRecovery' | 'laggingFear' | 'overheat'} PanicCompositeVerdictId */

/**
 * @typedef {{
 *   id: PanicCompositeVerdictId
 *   label: string
 *   emoji: string
 *   buyStrength: string
 *   actionLine: string
 *   narrative: string[]
 *   tone: string
 * }} PanicCompositeVerdictDef
 */

/** @type {Record<PanicCompositeVerdictId, PanicCompositeVerdictDef>} */
export const PANIC_COMPOSITE_VERDICTS = {
  trueFear: {
    id: "trueFear",
    label: "진짜 공포",
    emoji: "🔴",
    buyStrength: "★★★★★",
    actionLine: "적극 분할매수",
    narrative: [
      "심리 지표와 가격 위치 모두 공포·저점 구간입니다.",
      "역사적으로 분할매수 우선순위가 높은 구간입니다.",
    ],
    tone: "strong-buy",
  },
  earlyRecovery: {
    id: "earlyRecovery",
    label: "회복 초기",
    emoji: "🟢",
    buyStrength: "★★★★☆",
    actionLine: "분할매수",
    narrative: [
      "공포 이후 반등이 시작되지만 아직 과열 구간은 아닙니다.",
      "계획된 비중으로 분할 접근을 검토하세요.",
    ],
    tone: "buy",
  },
  laggingFear: {
    id: "laggingFear",
    label: "늦은 공포",
    emoji: "🟠",
    buyStrength: "★★☆☆☆",
    actionLine: "추격매수 금지",
    narrative: [
      "심리는 아직 위축되어 있지만",
      "가격은 이미 저점 대비 충분히 상승했습니다.",
      "신규 추격매수보다 조정을 기다리는 것이 유리합니다.",
    ],
    tone: "caution",
  },
  overheat: {
    id: "overheat",
    label: "과열",
    emoji: "🟡",
    buyStrength: "★☆☆☆☆",
    actionLine: "비중 축소",
    narrative: [
      "심리·가격 모두 매수 우선순위가 낮은 구간입니다.",
      "신규 비중 확대보다 익절·현금 비중 점검을 우선하세요.",
    ],
    tone: "reduce",
  },
}

/** @param {number | null} psychScore */
export function resolvePsychologyLabel(psychScore) {
  if (psychScore == null || !Number.isFinite(psychScore)) return "—"
  const stage = resolveMacroV1Status(psychScore)
  if (stage) return stage.label
  if (psychScore >= 75) return "인생 타점"
  if (psychScore >= 60) return "분할매수"
  if (psychScore >= 45) return "관심"
  if (psychScore >= 30) return "공포 부족"
  return "공포 없음"
}

/**
 * @param {number | null} psychScore
 * @param {import("./ydsPanicPricePosition.js").PanicPricePositionReport | null} price
 */
function resolveCompositeVerdictId(psychScore, price) {
  const psych = psychScore ?? 50
  const pos = price?.positionScore ?? 50
  const r10 = price?.return10d ?? 0
  const r20 = price?.return20d ?? 0
  const rsi = price?.rsi14 ?? 50
  const dd = price?.drawdownFromHighPct ?? 0

  const psychFear = psych >= 55
  const psychLow = psych <= 35
  const priceLow = pos <= 38 && r10 <= 4 && dd >= 6
  const priceRecovered = pos >= 62 || r10 >= 8 || r20 >= 12 || (price?.ma20GapPct ?? 0) >= 3
  const priceOverheat = pos >= 78 || rsi >= 72 || r20 >= 15

  if (psychFear && priceLow) return "trueFear"
  if (psychFear && priceRecovered) return "laggingFear"
  if (psychLow || priceOverheat) return "overheat"
  if (psych >= 48 && pos >= 35 && pos <= 62 && r10 >= 1 && r10 <= 10) return "earlyRecovery"
  if (psychFear && !priceRecovered) return "trueFear"
  if (psych >= 45) return "earlyRecovery"
  return "overheat"
}

/**
 * @param {object | null | undefined} panicData
 * @param {{
 *   spyPrices?: Record<string, number>
 *   qqqPrices?: Record<string, number>
 *   asOfDate?: string | null
 * }} [priceContext]
 */
export function buildPanicCompositeVerdictReport(panicData, priceContext = {}) {
  if (!panicData) {
    return { visible: false, title: "심리 + 가격 종합 판정" }
  }

  const psychScore = Math.round(getFinalScore(panicData) ?? NaN)
  if (!Number.isFinite(psychScore)) {
    return { visible: false, title: "심리 + 가격 종합 판정" }
  }

  const priceReport = buildPanicPricePositionReport({
    spyPrices: priceContext.spyPrices,
    qqqPrices: priceContext.qqqPrices,
    asOfDate: priceContext.asOfDate,
  })

  const verdictId = resolveCompositeVerdictId(psychScore, priceReport)
  const verdict = PANIC_COMPOSITE_VERDICTS[verdictId]

  const priceLabel = priceReport?.label ?? "데이터 없음"
  const trendLabel = priceReport?.trendLabel ?? "—"

  return {
    visible: true,
    title: "심리 + 가격 종합 판정",
    psychScore,
    psychLabel: resolvePsychologyLabel(psychScore),
    priceLabel,
    trendLabel,
    verdictId,
    verdictLabel: verdict.label,
    verdictEmoji: verdict.emoji,
    buyStrength: verdict.buyStrength,
    actionLine: verdict.actionLine,
    narrative: verdict.narrative,
    tone: verdict.tone,
    priceMetrics: priceReport
      ? [
          { id: "r10", label: "10일 상승률", value: priceReport.return10d, display: fmtPct(priceReport.return10d) },
          { id: "r20", label: "20일 상승률", value: priceReport.return20d, display: fmtPct(priceReport.return20d) },
          {
            id: "dd",
            label: "고점 대비 하락",
            value: priceReport.drawdownFromHighPct,
            display: fmtPct(priceReport.drawdownFromHighPct),
          },
          {
            id: "ma20",
            label: "MA20 괴리",
            value: priceReport.ma20GapPct,
            display: fmtPct(priceReport.ma20GapPct),
          },
          {
            id: "ma60",
            label: "MA60 괴리",
            value: priceReport.ma60GapPct,
            display: fmtPct(priceReport.ma60GapPct),
          },
          {
            id: "rsi",
            label: "RSI",
            value: priceReport.rsi14,
            display: priceReport.rsi14 != null ? String(priceReport.rsi14) : "—",
          },
          {
            id: "bb",
            label: "볼린저 위치",
            value: priceReport.bollingerPctB,
            display:
              priceReport.bollingerPctB != null
                ? `${Math.round(priceReport.bollingerPctB * 100)}%`
                : "—",
          },
        ]
      : [],
    hasPriceData: Boolean(priceReport),
  }
}

/** @param {number | null | undefined} v */
function fmtPct(v) {
  if (v == null || !Number.isFinite(v)) return "—"
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`
}

/**
 * 종합 판정 기반 매수 의견 (패닉 점수 단독 사용 금지)
 * @param {object | null | undefined} panicData
 * @param {Parameters<typeof buildPanicCompositeVerdictReport>[1]} [priceContext]
 */
export function resolvePanicCompositeActionView(panicData, priceContext) {
  const report = buildPanicCompositeVerdictReport(panicData, priceContext)
  if (!report.visible) return null
  return {
    buyStrength: report.buyStrength,
    actionLine: report.actionLine,
    verdictId: report.verdictId,
    verdictLabel: report.verdictLabel,
    verdictEmoji: report.verdictEmoji,
    narrative: report.narrative,
    psychLabel: report.psychLabel,
    priceLabel: report.priceLabel,
  }
}
