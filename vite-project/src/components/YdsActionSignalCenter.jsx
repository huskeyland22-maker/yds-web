import { useMemo, useState } from "react"
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
      headline: "분할 진입 준비",
      caution: "성급한 비중 확대 금지",
      do: ["분할 진입 준비", "관심 종목 압축"],
      avoid: ["한 번에 비중 확대"],
      priority: ["분할 진입 준비", "관심 종목 관찰", "현금 비중 유지"],
      conclusion: "분할 진입 준비 강화",
    }
  }
  if (stageId === "dca") {
    return {
      headline: "분할매수 시작",
      caution: "일괄 매수 금지",
      do: ["분할매수 시작", "우량주 중심 진입"],
      avoid: ["일괄 매수"],
      priority: ["분할매수 실행", "우량주 선별", "리스크 분산"],
      conclusion: "분할매수 실행 우위",
    }
  }
  return {
    headline: "적극 매수",
    caution: "레버리지 과도 사용 금지",
    do: ["적극 매수", "계획된 분할 집행"],
    avoid: ["감정적 추격 대응"],
    priority: ["매수 실행", "현금 투입 관리", "리스크 점검"],
    conclusion: "매수 실행 우위 강화",
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
    return {
      stageLabel: stage?.label ?? "중립구간",
      stageEmoji: stage?.emoji ?? "⚪",
      score: nowScore,
      prevScore,
      template,
      changeReasons: changeReasons.slice(0, 2),
    }
  }, [panicData, historyRows])

  if (!view) return null

  return (
    <section className="yds-action-signal trading-card-shell panic-v2-section" aria-label="YDS 행동 시그널 센터">
      <p className="m-0 yds-action-signal__title">YDS 행동센터 · Compact</p>
      <div className="yds-action-signal__cards">
        <div className="yds-action-signal__card">
          <p className="m-0 yds-action-signal__block-title">오늘의 행동</p>
          <p className="m-0 yds-action-signal__headline">
            {view.stageEmoji} {view.template.headline}
          </p>
          <p className="m-0 yds-action-signal__line">✓ {view.template.do[0] ?? "종목 탐색"}</p>
          <p className="m-0 yds-action-signal__line">✓ {view.template.do[1] ?? "기존 보유 유지"}</p>
          <p className="m-0 yds-action-signal__line yds-action-signal__line--warn">⚠ {view.template.caution}</p>
        </div>

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
        <p className="m-0 yds-action-signal__philosophy-stages">🔵 과열 · 🟢 중립 · 🟡 관심 · 🟠 분할매수 · 🔴 패닉매수</p>
        <p className="m-0 yds-action-signal__philosophy-quote">공포를 피하는 것이 아니라 공포에서 기회를 찾는다.</p>
      </div>
    </section>
  )
}
