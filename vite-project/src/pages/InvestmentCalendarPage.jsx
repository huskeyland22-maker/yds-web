import { useMemo } from "react"
import { Link } from "react-router-dom"
import { buildInvestmentCalendarReport } from "../content/ydsInvestmentCalendarEngine.js"
import { useYdsMarketContext } from "../hooks/useYdsMarketContext.js"
import YdsV1ReleaseBadge from "../components/trust/YdsV1ReleaseBadge.jsx"
import { YdsInvestmentCalendarRow } from "../components/market-analysis/YdsInvestmentCalendarStrip.jsx"

function EventSection({ title, id, events, empty }) {
  return (
    <section className="yds-inv-cal__section" aria-labelledby={id}>
      <h2 id={id} className="yds-inv-cal__h2">
        {title}
      </h2>
      {!events.length ? (
        <p className="yds-inv-cal__empty">{empty}</p>
      ) : (
        <div className="yds-inv-cal__list">
          {events.map((event) => (
            <YdsInvestmentCalendarRow key={event.id} event={event} />
          ))}
        </div>
      )}
    </section>
  )
}

export default function InvestmentCalendarPage() {
  const marketContext = useYdsMarketContext()
  const report = useMemo(
    () => buildInvestmentCalendarReport(marketContext?.ready ? marketContext : null),
    [marketContext],
  )

  return (
    <div className="yds-inv-cal yds-inv-cal--page min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-inv-cal__header">
        <div>
          <YdsV1ReleaseBadge compact />
          <p className="yds-inv-cal__kicker">Investment Calendar · YDS</p>
          <h1 className="yds-inv-cal__title">투자 캘린더</h1>
          <p className="yds-inv-cal__sub">
            시장상태와 연결된 거시·종목 일정 · 영향은 현재{" "}
            <Link to="/market-analysis">시장분석</Link> 기준 예상
            {report.marketStage ? ` (${report.marketStage})` : null}
          </p>
        </div>
        <div className="yds-inv-cal__week-badge font-mono tabular-nums">{report.week.label}</div>
      </header>

      <div className="yds-inv-cal__legend" aria-label="범례">
        <span>중요도 ★~★★★</span>
        <span className="yds-inv-cal__impact yds-inv-cal__impact--positive">긍정</span>
        <span className="yds-inv-cal__impact yds-inv-cal__impact--neutral">중립</span>
        <span className="yds-inv-cal__impact yds-inv-cal__impact--negative">부정</span>
      </div>

      <EventSection
        id="inv-macro-week"
        title="1 · 이번주 중요 일정 (거시)"
        events={report.macroThisWeek}
        empty="이번 주 거시 지표 일정 없음"
      />

      <EventSection
        id="inv-stock-week"
        title="2 · 종목 이벤트 (이번주)"
        events={report.stockThisWeek}
        empty="이번 주 종목 이벤트 없음"
      />

      <section className="yds-inv-cal__section" aria-labelledby="inv-upcoming">
        <h2 id="inv-upcoming" className="yds-inv-cal__h2">
          3 · 향후 일정
        </h2>
        <div className="yds-inv-cal__upcoming-grid">
          <div>
            <h3 className="yds-inv-cal__h3">거시 · FOMC · CPI · PPI · PCE · 고용 · GDP</h3>
            <div className="yds-inv-cal__list">
              {report.macroUpcoming.map((event) => (
                <YdsInvestmentCalendarRow key={event.id} event={event} />
              ))}
            </div>
          </div>
          <div>
            <h3 className="yds-inv-cal__h3">종목 · 실적 · 배당 · 주총</h3>
            <div className="yds-inv-cal__list">
              {report.stockUpcoming.map((event) => (
                <YdsInvestmentCalendarRow key={event.id} event={event} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <p className="yds-inv-cal__foot">
        일정은 YDS 시드 데이터 기준 · 실제 발표 시각·서프라이즈는 별도 확인
      </p>
    </div>
  )
}
