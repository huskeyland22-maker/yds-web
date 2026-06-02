import { useMemo } from "react"
import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { getFinalScore, scoreBofa, scoreFearGreed, scoreVIX } from "../utils/tradingScores.js"
import { resolveMacroStageAllocation } from "../trading-zone/macroStageAllocation.js"
import { getTradingZonePositions } from "../trading-zone/tacticalTradingZoneData.js"
import { buildRecommendationTrackRows } from "../trading-zone/tradingZoneRecommendationTrack.js"

const STAGE_RAIL = [
  { id: "overheated", short: "과열", emoji: "🔵" },
  { id: "neutral", short: "중립", emoji: "🟢" },
  { id: "interest", short: "관심", emoji: "🟡" },
  { id: "dca", short: "분할매수", emoji: "🟠" },
  { id: "panicBuy", short: "패닉매수", emoji: "🔴" },
]

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function pickPanicPayload(row) {
  if (!row || typeof row !== "object") return null
  if (row.panicData && typeof row.panicData === "object") return row.panicData
  if (row.metrics && typeof row.metrics === "object") return row.metrics
  return row
}

function formatSigned(n) {
  const value = Number(n)
  if (!Number.isFinite(value)) return "—"
  return `${value > 0 ? "+" : ""}${value}`
}

function toStateSentence(id, value) {
  if (!Number.isFinite(value)) return null
  if (id === "vix") {
    if (value < 16) return "VIX가 안정권에 진입했습니다."
    if (value < 24) return "VIX는 중립 범위입니다."
    return "VIX 변동성이 확대된 상태입니다."
  }
  if (id === "cnn") {
    if (value >= 60) return "CNN 공포탐욕지수는 탐욕 상태입니다."
    if (value >= 40) return "CNN 공포탐욕지수는 중립 상태입니다."
    return "CNN 공포탐욕지수는 공포 상태입니다."
  }
  if (id === "bofa") {
    if (value >= 4) return "BofA는 낙관 우위 상태입니다."
    if (value >= 2.5) return "BofA는 균형 상태입니다."
    return "BofA는 비관 우위 상태입니다."
  }
  return null
}

function buildStageGuide(stageId) {
  if (stageId === "panicBuy") {
    return {
      recommend: ["분할매수 실행", "현금 우선 투입"],
      caution: ["하락 중 전액 진입 금지"],
      avoid: ["레버리지 집중 매수"],
    }
  }
  if (stageId === "dca") {
    return {
      recommend: ["기존 보유 유지", "우량주 분할 진입"],
      caution: ["한 번에 비중 확대 금지"],
      avoid: ["실적 약한 종목 신규 진입"],
    }
  }
  if (stageId === "interest") {
    return {
      recommend: ["관심 종목 관찰", "눌림 구간 대기"],
      caution: ["추격매수 금지"],
      avoid: ["단기 고점 추격"],
    }
  }
  if (stageId === "overheated") {
    return {
      recommend: ["기존 보유 점검", "현금 비중 확대"],
      caution: ["신규 진입 최소화"],
      avoid: ["레버리지 신규 진입"],
    }
  }
  return {
    recommend: ["기존 보유 유지", "관심 종목 관찰"],
    caution: ["추격매수 금지"],
    avoid: ["레버리지 신규 진입"],
  }
}

function buildTodayActions(stageId) {
  if (stageId === "overheated") {
    return ["현금 확보", "기존 보유 수익 보호", "추격매수 금지"]
  }
  if (stageId === "interest") {
    return ["분할 진입 준비", "관심 종목 관찰", "추격매수 금지"]
  }
  if (stageId === "dca") {
    return ["분할매수 시작", "기존 보유 유지", "일괄 매수 금지"]
  }
  if (stageId === "panicBuy") {
    return ["적극 매수", "분할 집행", "레버리지 과다 금지"]
  }
  return ["종목 탐색", "기존 보유 유지", "추격매수 금지"]
}

/**
 * @param {{ panicData?: object | null; historyRows?: object[] }} props
 */
export default function YdsCompositeHero({ panicData = null, historyRows = [] }) {
  const recSummary = useMemo(() => {
    const rows = buildRecommendationTrackRows(getTradingZonePositions(), [], {})
    const withRet = rows.filter((r) => Number.isFinite(r.returnPct))
    const winRate = withRet.length
      ? (withRet.filter((r) => Number(r.returnPct) > 0).length / withRet.length) * 100
      : null
    const avgReturn = withRet.length
      ? withRet.reduce((sum, r) => sum + Number(r.returnPct), 0) / withRet.length
      : null
    return { winRate, avgReturn }
  }, [])

  const view = useMemo(() => {
    if (!panicData) return null
    const score = getFinalScore(panicData)
    if (!Number.isFinite(score)) return null
    const stage = resolveMacroV1Status(score)
    const allocation = resolveMacroStageAllocation(stage?.id ?? "neutral")
    const flow = (historyRows ?? [])
      .slice(-3)
      .map((row) => getFinalScore(pickPanicPayload(row) ?? {}))
      .filter(Number.isFinite)
      .map((n) => Math.round(n))
    const nowScore = Math.round(score)
    const trendLine = [...flow, Math.round(score)].slice(-4).join(" → ")
    const actionGuide =
      stage?.id === "panicBuy"
        ? "분할매수 실행 · 현금 우선 투입"
        : stage?.id === "dca"
          ? "분할 진입 확대 · 우량주 우선"
          : stage?.id === "interest"
            ? "관심 종목 선별 · 눌림 대기"
            : stage?.id === "overheated"
              ? "추격 제한 · 현금 비중 확대"
              : "종목 탐색 우선 · 추격매수 제한"
    const vixPts = Math.round(scoreVIX(panicData?.vix) * 0.3)
    const cnnPts = Math.round(scoreFearGreed(panicData?.fearGreed) * 0.2)
    const bofaPts = Math.round(scoreBofa(panicData?.bofa) * 0.175)
    const otherPts = nowScore - (vixPts + cnnPts + bofaPts)
    const sumPoints = vixPts + cnnPts + bofaPts + otherPts
    const explainLines = [
      `현재 시장은 ${stage?.label ?? "중립구간"}입니다.`,
      toStateSentence("vix", toNum(panicData?.vix)),
      toStateSentence("cnn", toNum(panicData?.fearGreed)),
      toStateSentence("bofa", toNum(panicData?.bofa)),
      stage?.id === "overheated"
        ? "공격적 신규 진입보다 보유 종목 리스크 관리가 유리합니다."
        : stage?.id === "neutral"
          ? "공격적 신규 진입보다 기존 보유 종목 관리가 유리합니다."
          : stage?.id === "interest"
            ? "성급한 진입보다 관심 종목 관찰과 눌림 대기가 유리합니다."
            : stage?.id === "dca"
              ? "분할매수 원칙을 유지하며 우량주 중심으로 접근하는 구간입니다."
              : "과도한 공포 구간이므로 계획된 분할매수를 실행하는 구간입니다.",
    ].filter(Boolean)

    const historyPayload = (historyRows ?? [])
      .map((row) => pickPanicPayload(row))
      .filter(Boolean)
    const prev = historyPayload[historyPayload.length - 1] ?? null
    const prevScore = prev ? Math.round(getFinalScore(prev)) : null
    const scoreDelta = prevScore == null ? null : nowScore - prevScore
    const metricDelta = {
      vix: prev ? toNum(panicData?.vix) - toNum(prev?.vix) : null,
      cnn: prev ? toNum(panicData?.fearGreed) - toNum(prev?.fearGreed) : null,
      bofa: prev ? toNum(panicData?.bofa) - toNum(prev?.bofa) : null,
    }
    const changeCause = []
    if (Number.isFinite(metricDelta.cnn)) {
      changeCause.push(
        Math.abs(metricDelta.cnn) < 0.15 ? "CNN 변화 없음" : `CNN ${formatSigned(metricDelta.cnn.toFixed(1))}`,
      )
    }
    if (Number.isFinite(metricDelta.bofa)) {
      changeCause.push(
        Math.abs(metricDelta.bofa) < 0.1 ? "BofA 변화 없음" : `BofA ${formatSigned(metricDelta.bofa.toFixed(1))}`,
      )
    }
    if (Number.isFinite(metricDelta.vix)) {
      changeCause.push(
        Math.abs(metricDelta.vix) < 0.2
          ? "VIX 변화 없음"
          : metricDelta.vix < 0
            ? "VIX 안정화"
            : "VIX 상승",
      )
    }
    const stageGuide = buildStageGuide(stage?.id)
    const todayActions = buildTodayActions(stage?.id)
    const stageIndex = Math.max(0, STAGE_RAIL.findIndex((s) => s.id === (stage?.id ?? "neutral")))

    return {
      score: nowScore,
      scoreDisplay: `${nowScore} / 100`,
      stageLabel: stage?.label ?? "중립구간",
      stageEmoji: stage?.emoji ?? "⚪",
      stageId: stage?.id ?? "neutral",
      trendLine: trendLine || "—",
      actionGuide,
      allocation,
      breakdown: { vixPts, cnnPts, bofaPts, otherPts, sumPoints },
      explainLines,
      stageGuide,
      todayActions,
      stageIndex,
      prevScore,
      scoreDelta,
      changeCause: changeCause.slice(0, 3),
    }
  }, [panicData, historyRows])

  if (!view) return null

  return (
    <section className="yds-composite-hero trading-card-shell panic-v2-section" aria-label="YDS 종합점수">
      <div className="yds-composite-hero__head">
        <p className="m-0 yds-composite-hero__title">YDS MARKET SCORE</p>
        <p className="m-0 yds-composite-hero__score font-mono tabular-nums">{view.scoreDisplay}</p>
      </div>
      <p className="m-0 yds-composite-hero__stage">
        {view.stageEmoji} {view.stageLabel}
      </p>
      <div className="yds-composite-hero__stage-rail" aria-label="시장 단계 게이지">
        <p className="m-0 yds-composite-hero__stage-line" aria-hidden>
          {STAGE_RAIL.map((step, idx) => (
            <span key={`g-${step.id}`} className="yds-composite-hero__stage-line-part">
              {step.emoji}
              {view.stageIndex === idx ? <strong>●</strong> : null}
              {idx < STAGE_RAIL.length - 1 ? "────" : ""}
            </span>
          ))}
        </p>
        <p className="m-0 yds-composite-hero__stage-labels">
          {STAGE_RAIL.map((step) => (
            <span key={step.id}>{step.short}</span>
          ))}
        </p>
      </div>
      <div className="yds-composite-hero__topline">
        <p className="m-0 yds-composite-hero__guide-title">오늘의 행동</p>
        <p className="m-0 yds-composite-hero__guide">✓ {view.todayActions[0]}</p>
        <p className="m-0 yds-composite-hero__guide">✓ {view.todayActions[1]}</p>
        <p className="m-0 yds-composite-hero__guide yds-composite-hero__guide--warn">⚠ {view.todayActions[2]}</p>
      </div>
      <div className="yds-composite-hero__allocation-hero" aria-label="권장 비중">
        <p className="m-0 yds-composite-hero__alloc-big">{view.allocation?.stockPct ?? 70}%</p>
        <p className="m-0 yds-composite-hero__alloc-label">주식</p>
        <p className="m-0 yds-composite-hero__alloc-big">{view.allocation?.cashPct ?? 30}%</p>
        <p className="m-0 yds-composite-hero__alloc-label">현금</p>
      </div>
      <p className="m-0 yds-composite-hero__recent">
        YDS 변화{" "}
        <span className="font-mono tabular-nums">
          {view.prevScore != null ? `${view.prevScore} → ${view.score}` : view.trendLine}
        </span>{" "}
        {view.scoreDelta != null ? `${view.scoreDelta >= 0 ? "+" : ""}${view.scoreDelta} 상승` : ""}
      </p>
      <div className="yds-composite-hero__validation-badges" aria-label="최근 검증">
        <span className="yds-composite-hero__validation-badge">
          추천 승률 {recSummary.winRate != null ? `${recSummary.winRate.toFixed(0)}%` : "—"}
        </span>
        <span className="yds-composite-hero__validation-badge">
          평균 수익률 {recSummary.avgReturn != null ? `${recSummary.avgReturn > 0 ? "+" : ""}${recSummary.avgReturn.toFixed(0)}%` : "—"}
        </span>
      </div>
      <div className="yds-composite-hero__breakdown" role="status" aria-label="YDS 점수 분해">
        <p className="m-0 yds-composite-hero__break-row">
          <span>YDS 점수</span>
          <strong className="font-mono tabular-nums">{view.score}</strong>
        </p>
        <p className="m-0 yds-composite-hero__break-row">
          <span>VIX</span>
          <strong className="font-mono tabular-nums">+{view.breakdown.vixPts}</strong>
        </p>
        <p className="m-0 yds-composite-hero__break-row">
          <span>CNN</span>
          <strong className="font-mono tabular-nums">+{view.breakdown.cnnPts}</strong>
        </p>
        <p className="m-0 yds-composite-hero__break-row">
          <span>BofA</span>
          <strong className="font-mono tabular-nums">+{view.breakdown.bofaPts}</strong>
        </p>
        <p className="m-0 yds-composite-hero__break-row">
          <span>기타(PC/HY)</span>
          <strong className="font-mono tabular-nums">+{view.breakdown.otherPts}</strong>
        </p>
        <p className="m-0 yds-composite-hero__break-row yds-composite-hero__break-row--sum">
          <span>합계</span>
          <strong className="font-mono tabular-nums">{view.breakdown.sumPoints}</strong>
        </p>
      </div>
      <div className="yds-composite-hero__explain" aria-label="현재 시장 해설">
        {view.explainLines.map((line) => (
          <p key={line} className="m-0 yds-composite-hero__explain-line">
            {line}
          </p>
        ))}
      </div>
      <p className="m-0 yds-composite-hero__trend">최근 흐름 {view.trendLine}</p>
      <p className="m-0 yds-composite-hero__guide">현재 행동 가이드 · {view.actionGuide}</p>
      <div className="yds-composite-hero__stage-guide" aria-label="단계별 행동 가이드">
        <p className="m-0 yds-composite-hero__stage-guide-title">{view.stageLabel} 권장</p>
        {view.stageGuide.recommend.map((line) => (
          <p key={`rec-${line}`} className="m-0 yds-composite-hero__stage-guide-line">
            ✓ {line}
          </p>
        ))}
        <p className="m-0 yds-composite-hero__stage-guide-title">주의</p>
        {view.stageGuide.caution.map((line) => (
          <p key={`cau-${line}`} className="m-0 yds-composite-hero__stage-guide-line">
            △ {line}
          </p>
        ))}
        <p className="m-0 yds-composite-hero__stage-guide-title">비추천</p>
        {view.stageGuide.avoid.map((line) => (
          <p key={`avoid-${line}`} className="m-0 yds-composite-hero__stage-guide-line">
            ✗ {line}
          </p>
        ))}
      </div>
      <div className="yds-composite-hero__change" aria-label="최근 변화 설명">
        <p className="m-0 yds-composite-hero__change-head">
          최근 흐름{" "}
          <span className="font-mono tabular-nums">
            {view.prevScore != null ? `${view.prevScore} → ${view.score}` : view.trendLine}
          </span>
        </p>
        {view.changeCause.map((line) => (
          <p key={line} className="m-0 yds-composite-hero__change-line">
            {line}
          </p>
        ))}
        {view.scoreDelta != null ? (
          <p className="m-0 yds-composite-hero__change-impact">
            → 점수 {view.scoreDelta >= 0 ? "+" : ""}
            {view.scoreDelta} 변화
          </p>
        ) : null}
      </div>
    </section>
  )
}
