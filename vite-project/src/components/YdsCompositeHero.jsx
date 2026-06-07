import { useMemo } from "react"
import { buildYdsScoreBreakdown } from "../trading-zone/ydsScoreBreakdown.js"
import { getStagePhilosophy, YDS_CYCLE_TAGLINE, YDS_FEAR_CYCLE_RAIL } from "../content/ydsCyclePhilosophy.js"
import { YDS_LABEL_PANIC_SCORE, macroStageDisplayLabel } from "../content/ydsLanguage.js"
import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { getFinalScore } from "../utils/tradingScores.js"
import { resolveMacroStageAllocation } from "../trading-zone/macroStageAllocation.js"
import { getTradingZonePositions } from "../trading-zone/tacticalTradingZoneData.js"
import { buildRecommendationTrackRows } from "../trading-zone/tradingZoneRecommendationTrack.js"

const STAGE_RAIL = YDS_FEAR_CYCLE_RAIL.map(({ id, emoji, short }) => ({ id, short, emoji }))

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
  if (stageId === "overheated") {
    return {
      recommend: ["기존 보유 점검", "현금 비중 확대"],
      caution: ["신규 진입 최소화"],
      avoid: ["레버리지 신규 진입"],
    }
  }
  if (stageId === "interest") {
    return {
      recommend: ["종목 발굴 · 현금 확보", "소량 분할 진입 검토"],
      caution: ["패닉(80+)만 기다리지 않기", "추격매수 금지"],
      avoid: ["일괄·추격 매수"],
    }
  }
  if (stageId === "dca") {
    return {
      recommend: ["핵심 매집 · 분할매수 실행", "우량주 중심 비중 확대"],
      caution: ["한 번에 올인 금지"],
      avoid: ["실적 약한 종목 집중"],
    }
  }
  if (stageId === "panicBuy") {
    return {
      recommend: ["보너스 구간 · 계획 현금 투입", "분할 가속"],
      caution: ["레버리지 과다 금지"],
      avoid: ["감정적 일괄 매수"],
    }
  }
  return {
    recommend: ["기존 보유 유지", "종목 리스트 정리"],
    caution: ["추격매수 금지"],
    avoid: ["레버리지 신규 진입"],
  }
}

function buildTodayActions(stageId) {
  if (stageId === "overheated") {
    return ["현금 확보", "기존 보유 수익 보호", "추격매수 금지"]
  }
  if (stageId === "interest") {
    return ["종목 발굴 · 현금 확보", "매수 준비", "추격매수 금지"]
  }
  if (stageId === "dca") {
    return ["핵심 매집 실행", "분할매수 집행", "일괄 매수 금지"]
  }
  if (stageId === "panicBuy") {
    return ["보너스 현금 투입", "분할 가속", "레버리지 과다 금지"]
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
    const philosophy = getStagePhilosophy(stage?.id)
    const actionGuide = philosophy.actionGuide
    const breakdownModel = buildYdsScoreBreakdown({
      vix: panicData?.vix,
      cnn: panicData?.fearGreed,
      bofa: panicData?.bofa,
      putCall: panicData?.putCall,
      highYield: panicData?.highYield,
    })
    const breakdown = breakdownModel.computable
      ? {
          vixPts: breakdownModel.contributions.vix,
          cnnPts: breakdownModel.contributions.cnn,
          bofaPts: breakdownModel.contributions.bofa,
          pcPts: breakdownModel.contributions.putCall,
          hyPts: breakdownModel.contributions.highYield,
          sumPoints: breakdownModel.sumContributions,
        }
      : { vixPts: 0, cnnPts: 0, bofaPts: 0, pcPts: 0, hyPts: 0, sumPoints: nowScore }
    const explainLines = [
      `현재 ${stage?.label ?? macroStageDisplayLabel("neutral")} — ${philosophy.role}.`,
      toStateSentence("vix", toNum(panicData?.vix)),
      toStateSentence("cnn", toNum(panicData?.fearGreed)),
      toStateSentence("bofa", toNum(panicData?.bofa)),
      philosophy.explain,
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
    return {
      score: nowScore,
      scoreDisplay: `${nowScore} / 100`,
      stageLabel: stage?.label ?? macroStageDisplayLabel("neutral"),
      stageEmoji: stage?.emoji ?? "⚪",
      stageId: stage?.id ?? "neutral",
      trendLine: trendLine || "—",
      actionGuide,
      allocation,
      breakdown,
      explainLines,
      stageGuide,
      todayActions,
      prevScore,
      scoreDelta,
      changeCause: changeCause.slice(0, 3),
    }
  }, [panicData, historyRows])

  if (!view) return null

  return (
    <section className="yds-composite-hero trading-card-shell panic-v2-section" aria-label={YDS_LABEL_PANIC_SCORE}>
      <div className="yds-composite-hero__head">
        <p className="m-0 yds-composite-hero__title">{YDS_LABEL_PANIC_SCORE}</p>
        <p className="m-0 yds-composite-hero__score font-mono tabular-nums">{view.scoreDisplay}</p>
      </div>
      <p className="m-0 yds-composite-hero__stage">
        {view.stageEmoji} {view.stageLabel}
      </p>
      <div className="yds-composite-hero__stage-rail" aria-label="시장 5단계 위치">
        {STAGE_RAIL.map((step) => (
          <span
            key={step.id}
            className={[
              "yds-composite-hero__stage-chip",
              view.stageId === step.id ? "yds-composite-hero__stage-chip--active" : "",
            ].join(" ")}
            data-stage={step.id}
          >
            {step.emoji} {step.short}
          </span>
        ))}
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
        {YDS_LABEL_PANIC_SCORE} 변화{" "}
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
      <div className="yds-composite-hero__breakdown" role="status" aria-label={`${YDS_LABEL_PANIC_SCORE} 점수 분해`}>
        <p className="m-0 yds-composite-hero__break-row">
          <span>{YDS_LABEL_PANIC_SCORE}</span>
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
          <span>P/C</span>
          <strong className="font-mono tabular-nums">+{view.breakdown.pcPts}</strong>
        </p>
        <p className="m-0 yds-composite-hero__break-row">
          <span>HY</span>
          <strong className="font-mono tabular-nums">+{view.breakdown.hyPts}</strong>
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
      <p className="m-0 yds-composite-hero__philosophy">{YDS_CYCLE_TAGLINE}</p>
    </section>
  )
}
