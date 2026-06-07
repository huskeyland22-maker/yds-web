import { useMemo, useState } from "react"
import {
  YDS_CYCLE_TAGLINE,
  YDS_HARVEST_TAGLINE,
  YDS_STAGE_RAIL_LABELS,
} from "../content/ydsCyclePhilosophy.js"
import {
  resolveMarketCycleStage,
} from "../content/ydsMarketCycleDisplay.js"
import { resolveMomentumLayer } from "../content/ydsMomentumLayer.js"
import { resolveEventLayer } from "../content/ydsEventLayer.js"
import { macroStageDisplayLabel } from "../content/ydsLanguage.js"
import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { getFinalScore } from "../utils/tradingScores.js"

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

function buildSignalTemplate(stageId) {
  if (stageId === "overheated") {
    return {
      headline: "현금 확보 우선",
      caution: "공격적 신규매수 금지",
      do: ["현금 확보", "수익 보호"],
      avoid: ["공격적 신규매수"],
      priority: ["현금 확보", "기존 수익 보호", "신규 진입 보류"],
      conclusion: "리스크 관리 우위",
    }
  }
  if (stageId === "neutral") {
    return {
      headline: "종목 탐색 우선",
      caution: "추격매수 금지",
      do: ["기존 보유 유지", "신규 진입 가능", "종목 탐색", "눌림목 관찰"],
      avoid: ["추격매수"],
      priority: ["종목 탐색", "기존 보유 관리", "신규 진입 검토"],
      conclusion: "종목 탐색 우위 강화",
    }
  }
  if (stageId === "interest") {
    return {
      headline: "매수 준비 · 종목 발굴",
      caution: "패닉(80+)만 기다리지 않기",
      do: ["종목 발굴 · 현금 확보", "소량 분할 검토", "우량주 리스트 압축"],
      avoid: ["추격·일괄 매수"],
      priority: ["종목 발굴", "현금 확보", "매수 준비"],
      conclusion: "관심 · 매수 준비 강화",
    }
  }
  if (stageId === "dca") {
    return {
      headline: "핵심 매집 · 분할매수 실행",
      caution: "일괄 매수 금지",
      do: ["분할매수 실행", "비중 확대", "우량주 중심"],
      avoid: ["일괄 매수"],
      priority: ["핵심 매집", "분할매수 집행", "리스크 분산"],
      conclusion: "핵심 매집 실행",
    }
  }
  return {
    headline: "보너스 · 드문 극단 공포",
    caution: "레버리지 과도 사용 금지",
    do: ["계획 현금 투입", "분할 가속"],
    avoid: ["감정적 일괄 매수"],
    priority: ["보너스 투입", "현금 집행", "리스크 점검"],
    conclusion: "보너스 구간 대응",
  }
}

/**
 * @param {{ panicData?: object | null; historyRows?: object[] }} props
 */
export default function YdsActionSignalCenter({ panicData = null, historyRows = [] }) {
  const [templateOpen, setTemplateOpen] = useState(false)
  const view = useMemo(() => {
    if (!panicData) return null
    const score = getFinalScore(panicData)
    if (!Number.isFinite(score)) return null
    const stage = resolveMacroV1Status(score)
    const template = buildSignalTemplate(stage?.id)

    const payloads = (historyRows ?? [])
      .map((row) => pickPanicPayload(row))
      .filter(Boolean)
    const prev = payloads[payloads.length - 1] ?? null
    const prevScore = prev ? Math.round(getFinalScore(prev)) : null
    const nowScore = Math.round(score)
    const vixDelta = prev ? toNum(panicData?.vix) - toNum(prev?.vix) : null
    const changeReasons = []
    if (Number.isFinite(vixDelta)) {
      if (Math.abs(vixDelta) < 0.2) changeReasons.push("VIX 변화 없음")
      else if (vixDelta < 0) {
        changeReasons.push("VIX 안정화")
        changeReasons.push("변동성 감소")
      } else {
        changeReasons.push("VIX 상승")
      }
    }
    if (!changeReasons.length) changeReasons.push("핵심 지표 변화 제한적")

    const marketStage = resolveMarketCycleStage(panicData?.fearGreed, panicData?.bofa)
    const momentum = resolveMomentumLayer(panicData, historyRows ?? [])
    const eventLayer = resolveEventLayer(panicData, historyRows ?? [])

    return {
      stageLabel: stage?.label ?? macroStageDisplayLabel("neutral"),
      stageEmoji: stage?.emoji ?? "⚪",
      score: nowScore,
      prevScore,
      template,
      changeReasons: changeReasons.slice(0, 2),
      marketStage,
      momentum,
      eventLayer,
    }
  }, [panicData, historyRows])

  if (!view) return null

  return (
    <section className="yds-action-signal trading-card-shell panic-v2-section" aria-label="YDS 행동 시그널 센터">
      <p className="m-0 yds-action-signal__title">오늘의 행동 · 공포 + 시장 사이클</p>
      <div className="yds-action-signal__cards">
        <div className="yds-action-signal__card">
          <p className="m-0 yds-action-signal__block-title">매수 · 공포 사이클</p>
          <p className="m-0 yds-action-signal__headline">
            {view.stageEmoji} {view.template.headline}
          </p>
          <p className="m-0 yds-action-signal__line">✓ {view.template.do[0] ?? "종목 탐색"}</p>
          <p className="m-0 yds-action-signal__line">✓ {view.template.do[1] ?? "기존 보유 유지"}</p>
          <p className="m-0 yds-action-signal__line yds-action-signal__line--warn">⚠ {view.template.caution}</p>
        </div>

        <div className="yds-action-signal__card">
          <p className="m-0 yds-action-signal__block-title">
            수확 · 시장 사이클
            {view.marketStage ? (
              <>
                {" "}
                {view.marketStage.emoji} {view.marketStage.label}
              </>
            ) : null}
          </p>
          {view.marketStage && view.marketStage.id !== "normal" ? (
            <>
              <p className="m-0 yds-action-signal__headline yds-action-signal__headline--harvest">
                {view.marketStage.harvestGuide}
              </p>
              <p className="m-0 yds-action-signal__line">✓ 비중·현금 점검</p>
              <p className="m-0 yds-action-signal__line yds-action-signal__line--warn">⚠ 추격매수·레버리지 자제</p>
            </>
          ) : (
            <>
              <p className="m-0 yds-action-signal__headline">🟢 정상 — 보유 유지</p>
              <p className="m-0 yds-action-signal__line">✓ CNN·BofA 탐욕 임계 미만</p>
            </>
          )}
        </div>

        <div className="yds-action-signal__card">
          <p className="m-0 yds-action-signal__block-title">단기 · Momentum</p>
          {view.momentum.level !== "none" ? (
            <>
              <p className="m-0 yds-action-signal__headline yds-action-signal__headline--momentum">
                {view.momentum.emoji} {view.momentum.shortLabel}
              </p>
              {view.momentum.explainLines.slice(0, 2).map((line) => (
                <p key={line} className="m-0 yds-action-signal__line yds-action-signal__line--warn">
                  ⚠ {line}
                </p>
              ))}
            </>
          ) : (
            <>
              <p className="m-0 yds-action-signal__headline">🟢 단기 안정</p>
              <p className="m-0 yds-action-signal__line">CNN·BofA 급변 임계 미만</p>
            </>
          )}
        </div>

        {view.eventLayer.hasEvents ? (
          <div className="yds-action-signal__card yds-action-signal__card--event">
            <p className="m-0 yds-action-signal__block-title">📢 Event · 시장 이벤트</p>
            {view.eventLayer.events.slice(0, 2).map((ev) => (
              <div key={ev.id}>
                <p className="m-0 yds-action-signal__headline yds-action-signal__headline--event">
                  {ev.emoji} {ev.title}
                </p>
                <p className="m-0 yds-action-signal__line">{ev.summary}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="yds-action-signal__card">
          <p className="m-0 yds-action-signal__block-title">최근 변화</p>
          <p className="m-0 yds-action-signal__change-score font-mono tabular-nums">
            {view.prevScore != null ? `${view.prevScore} → ${view.score}` : `${view.score} → ${view.score}`}
          </p>
          {view.changeReasons.map((line) => (
            <p key={line} className="m-0 yds-action-signal__change-line">
              ✓ {line}
            </p>
          ))}
          <p className="m-0 yds-action-signal__change-conclusion">결론 · {view.template.conclusion}</p>
        </div>

        <div className="yds-action-signal__card">
          <p className="m-0 yds-action-signal__block-title">오늘 우선순위</p>
          {view.template.priority.slice(0, 3).map((line, idx) => (
            <p key={line} className="m-0 yds-action-signal__priority-line">
              {idx + 1} {line}
            </p>
          ))}
        </div>
      </div>

      <div className="yds-action-signal__block">
        <button
          type="button"
          className="yds-action-signal__toggle"
          onClick={() => setTemplateOpen((v) => !v)}
        >
          {view.stageLabel} 행동 템플릿 {templateOpen ? "닫기 ▲" : "자세히 보기 ▼"}
        </button>
        {templateOpen ? (
          <div className="yds-action-signal__template-panel">
            {view.template.do.map((line) => (
              <p key={`do-${line}`} className="m-0 yds-action-signal__template-line">
                ✓ {line}
              </p>
            ))}
            {view.template.avoid.map((line) => (
              <p key={`avoid-${line}`} className="m-0 yds-action-signal__template-line yds-action-signal__template-line--avoid">
                ✗ {line}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <div className="yds-action-signal__philosophy" aria-label="YDS 철학">
        <p className="m-0 yds-action-signal__philosophy-title">YDS 철학</p>
        <p className="m-0 yds-action-signal__philosophy-stages">{YDS_STAGE_RAIL_LABELS}</p>
        <p className="m-0 yds-action-signal__philosophy-quote">{YDS_CYCLE_TAGLINE}</p>
        <p className="m-0 yds-action-signal__philosophy-quote yds-action-signal__philosophy-quote--harvest">
          {YDS_HARVEST_TAGLINE}
        </p>
      </div>
    </section>
  )
}
