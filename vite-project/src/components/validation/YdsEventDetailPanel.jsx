import ReplayViewer from "./ReplayViewer.jsx"
import { YDS_MILESTONE_ORDER } from "../../trading-zone/ydsHistoricalValidationEvents.js"

const STEP_LABEL = {
  start: "시작",
  rise: "상승",
  fearExpansion: "공포확대",
  climax: "극점",
  recovery: "회복",
}

/**
 * @param {{ eventItem: any }} props
 */
export default function YdsEventDetailPanel({ eventItem }) {
  if (!eventItem) return null
  return (
    <section className="yds-event-detail" aria-label="이벤트 상세">
      <p className="m-0 yds-event-detail__title">이벤트 상세 페이지 구조</p>
      <div className="yds-event-detail__block">
        <p className="m-0 yds-event-detail__head">이벤트 개요</p>
        <p className="m-0">{eventItem.event}</p>
        <p className="m-0 font-mono tabular-nums">
          {eventItem.startDate} ~ {eventItem.endDate} ({eventItem.durationDays}일)
        </p>
      </div>
      <div className="yds-event-detail__block">
        <p className="m-0 yds-event-detail__head">대표 날짜</p>
        {YDS_MILESTONE_ORDER.map((key) => (
          <p key={key} className="m-0 yds-event-detail__line font-mono tabular-nums">
            {STEP_LABEL[key]} · {eventItem.milestones?.[key]?.date ?? "—"}
          </p>
        ))}
      </div>
      <div className="yds-event-detail__block">
        <p className="m-0 yds-event-detail__head">지표 데이터</p>
        {YDS_MILESTONE_ORDER.map((key) => {
          const h = eventItem.milestones?.[key]?.historyData
          return (
            <p key={`hist-${key}`} className="m-0 yds-event-detail__line font-mono tabular-nums">
              {STEP_LABEL[key]} · YDS {h?.yds ?? "null"} / VIX {h?.vix ?? "null"} / CNN {h?.cnn ?? "null"} / BofA{" "}
              {h?.bofa ?? "null"} / HY {h?.hy ?? "null"} / PutCall {h?.putCall ?? "null"} / SP500 {h?.sp500 ?? "null"}
            </p>
          )
        })}
      </div>
      <div className="yds-event-detail__block">
        <p className="m-0 yds-event-detail__head">시장 성과</p>
        <p className="m-0 font-mono tabular-nums">
          이벤트 기간 {eventItem.marketPerformance?.eventPeriodSp500Pct ?? "null"}% · 6개월{" "}
          {eventItem.marketPerformance?.after6mSp500Pct ?? "null"}% · 12개월{" "}
          {eventItem.marketPerformance?.after12mSp500Pct ?? "null"}%
        </p>
      </div>
      <ReplayViewer eventItem={eventItem} />
    </section>
  )
}

