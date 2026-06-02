import ReplayViewer from "./ReplayViewer.jsx"
import { isEventComplete } from "../../trading-zone/ydsHistoricalEventCompletions.js"
import {
  YDS_MILESTONE_ORDER,
  YDS_VALIDATION_EVENT_CATEGORY_LABEL,
} from "../../trading-zone/ydsHistoricalValidationEvents.js"

const STEP_LABEL = {
  start: "시작",
  rise: "상승",
  fearExpansion: "공포확대",
  climax: "극점",
  recovery: "회복",
}

function formatPct(value) {
  if (value == null || !Number.isFinite(value)) return "—"
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(1)}%`
}

function formatMetric(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—"
  return Number(value).toFixed(digits)
}

/**
 * @param {{ eventItem: Record<string, unknown> | null }} props
 */
export default function YdsEventDetailPanel({ eventItem }) {
  if (!eventItem) return null

  const complete = isEventComplete(eventItem)
  const perf = eventItem.marketPerformance ?? {}

  return (
    <section className="yds-event-detail" aria-label="이벤트 상세">
      <div className="yds-event-detail__header">
        <p className="m-0 yds-event-detail__title">{eventItem.event}</p>
        {complete ? (
          <span className="yds-event-detail__badge yds-event-detail__badge--complete">완성 이벤트</span>
        ) : (
          <span className="yds-event-detail__badge">데이터 준비 중</span>
        )}
      </div>

      <div className="yds-event-detail__block">
        <p className="m-0 yds-event-detail__head">이벤트 개요</p>
        <p className="m-0 yds-event-detail__meta">
          {YDS_VALIDATION_EVENT_CATEGORY_LABEL[eventItem.category] ?? eventItem.category} ·{" "}
          <span className="font-mono tabular-nums">
            {eventItem.startDate} ~ {eventItem.endDate}
          </span>
          {eventItem.durationDays != null ? ` (${eventItem.durationDays}일)` : ""}
        </p>
      </div>

      <div className="yds-event-detail__block">
        <p className="m-0 yds-event-detail__head">1. 대표 날짜</p>
        <table className="yds-event-detail__table">
          <thead>
            <tr>
              <th scope="col">단계</th>
              <th scope="col">날짜</th>
            </tr>
          </thead>
          <tbody>
            {YDS_MILESTONE_ORDER.map((key) => (
              <tr key={key}>
                <td>{STEP_LABEL[key]}</td>
                <td className="font-mono tabular-nums">{eventItem.milestones?.[key]?.date ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="yds-event-detail__block">
        <p className="m-0 yds-event-detail__head">2. 지표 데이터 (VIX · CNN Fear &amp; Greed)</p>
        <table className="yds-event-detail__table yds-event-detail__table--indicators">
          <thead>
            <tr>
              <th scope="col">단계</th>
              <th scope="col">날짜</th>
              <th scope="col">VIX</th>
              <th scope="col">CNN F&amp;G</th>
            </tr>
          </thead>
          <tbody>
            {YDS_MILESTONE_ORDER.map((key) => {
              const h = eventItem.milestones?.[key]?.historyData
              return (
                <tr key={`ind-${key}`}>
                  <td>{STEP_LABEL[key]}</td>
                  <td className="font-mono tabular-nums">{h?.date ?? "—"}</td>
                  <td>
                    <span className="yds-event-detail__field" data-empty={h?.vix == null}>
                      {formatMetric(h?.vix)}
                    </span>
                  </td>
                  <td>
                    <span className="yds-event-detail__field" data-empty={h?.cnn == null}>
                      {formatMetric(h?.cnn, 0)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!complete && (
          <p className="m-0 yds-event-detail__hint">미입력 지표는 null(—)로 표시됩니다. 코로나 이벤트부터 순차 완성합니다.</p>
        )}
      </div>

      <div className="yds-event-detail__block">
        <p className="m-0 yds-event-detail__head">3. 시장 성과 (S&amp;P500)</p>
        <dl className="yds-event-detail__perf">
          <div>
            <dt>최대 낙폭 (MDD)</dt>
            <dd className="font-mono tabular-nums">{formatPct(perf.maxDrawdownPct)}</dd>
          </div>
          <div>
            <dt>6개월 후 수익률</dt>
            <dd className="font-mono tabular-nums">{formatPct(perf.after6mSp500Pct)}</dd>
          </div>
          <div>
            <dt>12개월 후 수익률</dt>
            <dd className="font-mono tabular-nums">{formatPct(perf.after12mSp500Pct)}</dd>
          </div>
        </dl>
        {perf.performanceAnchorDate && (
          <p className="m-0 yds-event-detail__hint font-mono tabular-nums">
            수익률 기준일: {perf.performanceAnchorDate}
            {eventItem.performanceNotes ? ` · ${eventItem.performanceNotes}` : ""}
          </p>
        )}
        {!complete && perf.maxDrawdownPct == null && (
          <p className="m-0 yds-event-detail__hint">시장 성과 데이터는 이벤트 완성 시 채웁니다.</p>
        )}
      </div>

      <ReplayViewer eventItem={eventItem} />
    </section>
  )
}
