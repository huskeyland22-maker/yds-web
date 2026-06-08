import { useMemo } from "react"
import { buildValidationReport, HORIZON_DAYS } from "../../content/ydsValidationEngine.js"
import { usePortfolioHoldings } from "../../hooks/usePortfolioHoldings.js"
import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"

function formatSignedPct(n) {
  if (n == null || !Number.isFinite(n)) return "—"
  const sign = n > 0 ? "+" : ""
  return `${sign}${n}%`
}

function formatSignedKrw(n) {
  if (n == null || !Number.isFinite(n)) return "—"
  const sign = n > 0 ? "+" : ""
  return `${sign}${Math.round(n).toLocaleString("ko-KR")}원`
}

function formatPrice(price, country) {
  if (price == null || !Number.isFinite(price)) return "—"
  if (country === "KR") return `${Math.round(price).toLocaleString("ko-KR")}원`
  return `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
}

export default function YdsPortfolioValidationSection() {
  const marketContext = useYdsMarketContext()
  const { portfolio, trades, cashAmount, quoteMap, usdkrw } = usePortfolioHoldings()

  const report = useMemo(
    () => buildValidationReport(marketContext, portfolio, trades, cashAmount, quoteMap, usdkrw),
    [marketContext, portfolio, trades, cashAmount, quoteMap, usdkrw],
  )

  const {
    picks,
    pickSummary,
    stockStatusSummary,
    regimePeriods,
    portfolio: pf,
    reviews,
    annual,
  } = report

  return (
    <section
      className="yds-portfolio__section yds-portfolio-v2__section yds-portfolio-p7__validation"
      aria-labelledby="pf-validation"
    >
      <h2 id="pf-validation" className="yds-portfolio__section-title">
        5 · YDS 검증
      </h2>

      <p className="yds-portfolio-v2__hint-inline">
        추천은 주장 · 성과는 검증 · 새 분석 없이 기존 결과만 기록
      </p>

      <div className="yds-portfolio-p7__block">
        <h3 className="yds-portfolio-p7__block-title">7.1 · 추천 종목 검증</h3>
        {pickSummary.total === 0 ? (
          <p className="yds-portfolio-v2__empty">종목추천·포트폴리오 방문 시 자동 기록됩니다.</p>
        ) : (
          <>
            <div className="yds-portfolio-p7__agg-row">
              <div className="yds-portfolio-p7__agg-card">
                <span>전체</span>
                <strong className="font-mono tabular-nums">
                  승률 {pickSummary.winRate != null ? `${pickSummary.winRate}%` : "—"}
                </strong>
                <em className="font-mono tabular-nums">
                  평균 {formatSignedPct(pickSummary.avgReturn)} · {pickSummary.total}건
                </em>
              </div>
              <div className="yds-portfolio-p7__agg-card yds-portfolio-p7__agg-card--accent">
                <span>TOP3</span>
                <strong className="font-mono tabular-nums">
                  승률 {pickSummary.top3.winRate != null ? `${pickSummary.top3.winRate}%` : "—"}
                </strong>
                <em className="font-mono tabular-nums">
                  평균 {formatSignedPct(pickSummary.top3.avgReturn)} · {pickSummary.top3.count}건
                </em>
              </div>
              <div className="yds-portfolio-p7__agg-card">
                <span>평균 보유</span>
                <strong className="font-mono tabular-nums">
                  {pickSummary.avgHoldingDays != null ? `${pickSummary.avgHoldingDays}일` : "—"}
                </strong>
              </div>
            </div>

            <div className="yds-portfolio-v2__table-wrap">
              <table className="yds-portfolio-v2__table yds-portfolio-p7__table">
                <thead>
                  <tr>
                    <th scope="col">종목</th>
                    <th scope="col">추천일</th>
                    <th scope="col">상태</th>
                    <th scope="col">추천가</th>
                    <th scope="col">현재가</th>
                    {HORIZON_DAYS.map((h) => (
                      <th key={h.key} scope="col" className="font-mono tabular-nums">
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {picks.slice(0, 10).map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.name}</strong>
                        {row.isTop3 ? (
                          <span className="yds-portfolio-v2__tag">TOP3</span>
                        ) : null}
                        <span className="yds-portfolio-v2__ticker font-mono tabular-nums">
                          {row.ticker}
                        </span>
                      </td>
                      <td className="font-mono tabular-nums">{row.recommendedAt}</td>
                      <td>{row.statusLabel}</td>
                      <td className="font-mono tabular-nums">
                        {formatPrice(row.recommendedPrice, row.country)}
                      </td>
                      <td className="font-mono tabular-nums">
                        {formatPrice(row.currentPrice, row.country)}
                      </td>
                      {HORIZON_DAYS.map((h) => (
                        <td key={h.key} className="font-mono tabular-nums">
                          {formatSignedPct(row.horizons[h.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="yds-portfolio-p7__status-grid">
              {stockStatusSummary.map((g) => (
                <div key={g.statusId} className="yds-portfolio-p7__regime-card">
                  <p className="yds-portfolio-p7__regime-label">{g.statusLabel}</p>
                  <p className="yds-portfolio-p7__regime-value font-mono tabular-nums">
                    {g.avgReturn != null ? formatSignedPct(g.avgReturn) : "—"}
                  </p>
                  <p className="yds-portfolio-p7__regime-meta">
                    승률 {g.winRate != null ? `${g.winRate}%` : "—"} · {g.count}건
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="yds-portfolio-p7__block">
        <h3 className="yds-portfolio-p7__block-title">7.2 · 시장 상태 검증</h3>
        {regimePeriods.length === 0 ? (
          <p className="yds-portfolio-v2__empty">YDS 시장 상태 구간이 기록되면 SPY·QQQ·KOSPI·KOSDAQ과 비교합니다.</p>
        ) : (
          <div className="yds-portfolio-v2__table-wrap">
            <table className="yds-portfolio-v2__table yds-portfolio-p7__table">
              <thead>
                <tr>
                  <th scope="col">상태</th>
                  <th scope="col">진입</th>
                  <th scope="col">종료</th>
                  <th scope="col">SPY</th>
                  <th scope="col">QQQ</th>
                  <th scope="col">KOSPI</th>
                  <th scope="col">KOSDAQ</th>
                </tr>
              </thead>
              <tbody>
                {[...regimePeriods].reverse().slice(0, 8).map((p) => (
                  <tr key={p.id}>
                    <td>{p.regimeLabel}</td>
                    <td className="font-mono tabular-nums">{p.startDate}</td>
                    <td className="font-mono tabular-nums">{p.endDate ?? "진행중"}</td>
                    <td className="font-mono tabular-nums">
                      {formatSignedPct(p.benchmarkReturns?.SPY)}
                    </td>
                    <td className="font-mono tabular-nums">
                      {formatSignedPct(p.benchmarkReturns?.QQQ)}
                    </td>
                    <td className="font-mono tabular-nums">
                      {formatSignedPct(p.benchmarkReturns?.KOSPI)}
                    </td>
                    <td className="font-mono tabular-nums">
                      {formatSignedPct(p.benchmarkReturns?.KOSDAQ)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="yds-portfolio-p7__block">
        <h3 className="yds-portfolio-p7__block-title">7.3 · 포트폴리오 성과 검증</h3>
        {!pf.latest ? (
          <p className="yds-portfolio-v2__empty">일별 스냅샷이 쌓이면 기간·지수 비교가 표시됩니다.</p>
        ) : (
          <>
            <div className="yds-portfolio-p7__pf-grid">
              <div className="yds-portfolio-p7__pf-metric">
                <span>총자산</span>
                <strong className="font-mono tabular-nums">
                  {pf.latest.totalAssets.toLocaleString("ko-KR")}원
                </strong>
              </div>
              <div className="yds-portfolio-p7__pf-metric">
                <span>총손익</span>
                <strong className="font-mono tabular-nums">
                  {formatSignedKrw(pf.latest.totalPnl)}
                </strong>
              </div>
              <div className="yds-portfolio-p7__pf-metric">
                <span>총수익률</span>
                <strong className="font-mono tabular-nums">
                  {formatSignedPct(pf.latest.totalReturnPct)}
                </strong>
              </div>
              <div className="yds-portfolio-p7__pf-metric">
                <span>현금비중</span>
                <strong className="font-mono tabular-nums">{pf.latest.cashPct}%</strong>
              </div>
            </div>
            <div className="yds-portfolio-v2__table-wrap">
              <table className="yds-portfolio-v2__table yds-portfolio-p7__table">
                <thead>
                  <tr>
                    <th scope="col">기간</th>
                    <th scope="col">YDS 포트</th>
                    <th scope="col">SPY</th>
                    <th scope="col">QQQ</th>
                    <th scope="col">KOSPI</th>
                    <th scope="col">KOSDAQ</th>
                    <th scope="col">초과(SPY)</th>
                  </tr>
                </thead>
                <tbody>
                  {pf.horizons.map((h) => (
                    <tr key={h.days}>
                      <td>{h.label}</td>
                      <td className="font-mono tabular-nums">{formatSignedPct(h.portfolioReturn)}</td>
                      <td className="font-mono tabular-nums">
                        {formatSignedPct(h.benchmarkReturns?.SPY)}
                      </td>
                      <td className="font-mono tabular-nums">
                        {formatSignedPct(h.benchmarkReturns?.QQQ)}
                      </td>
                      <td className="font-mono tabular-nums">
                        {formatSignedPct(h.benchmarkReturns?.KOSPI)}
                      </td>
                      <td className="font-mono tabular-nums">
                        {formatSignedPct(h.benchmarkReturns?.KOSDAQ)}
                      </td>
                      <td className="font-mono tabular-nums">{formatSignedPct(h.excessVsSpy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="yds-portfolio-p7__block">
        <h3 className="yds-portfolio-p7__block-title">7.4 · 투자 복기</h3>
        <div className="yds-portfolio-p7__review-stats">
          <span>매수 이유 {reviews.buyReasons}</span>
          <span>매도 이유 {reviews.sellReasons}</span>
          <span>실수 {reviews.mistakes}</span>
          <span>배운 점 {reviews.lessons}</span>
        </div>
        {reviews.byStock.length > 0 ? (
          <ul className="yds-portfolio-p7__review-list">
            {reviews.byStock.map((group) => (
              <li key={group.stockName}>
                <strong>{group.stockName}</strong>
                {group.items.slice(0, 3).map((item, i) => (
                  <p key={i}>
                    {item.title.split("·").pop()?.trim()}: {item.body}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        ) : (
          <p className="yds-portfolio-v2__empty">종목 카드·전체 복기·매도 메모가 축적됩니다.</p>
        )}
      </div>

      <div className="yds-portfolio-p7__block yds-portfolio-p7__annual">
        <h3 className="yds-portfolio-p7__block-title">7.5 · {annual.year} 연간 리포트</h3>
        <div className="yds-portfolio-p7__annual-grid">
          <div className="yds-portfolio-p7__annual-item">
            <span>시장판단 준수율</span>
            <strong className="font-mono tabular-nums">
              {annual.compliancePct != null ? `${annual.compliancePct}%` : "—"}
            </strong>
          </div>
          <div className="yds-portfolio-p7__annual-item">
            <span>추천 승률</span>
            <strong className="font-mono tabular-nums">
              {annual.pickWinRate != null ? `${annual.pickWinRate}%` : "—"}
            </strong>
          </div>
          <div className="yds-portfolio-p7__annual-item">
            <span>추천 평균 수익률</span>
            <strong className="font-mono tabular-nums">
              {formatSignedPct(annual.pickAvgReturn)}
            </strong>
          </div>
          <div className="yds-portfolio-p7__annual-item">
            <span>포트폴리오 수익률</span>
            <strong className="font-mono tabular-nums">
              {formatSignedPct(annual.portfolioReturn)}
            </strong>
          </div>
          <div className="yds-portfolio-p7__annual-item">
            <span>SPY</span>
            <strong className="font-mono tabular-nums">{formatSignedPct(annual.spyReturn)}</strong>
          </div>
          <div className="yds-portfolio-p7__annual-item yds-portfolio-p7__annual-item--accent">
            <span>초과성과</span>
            <strong className="font-mono tabular-nums">
              {formatSignedPct(annual.excessReturn)}
            </strong>
          </div>
        </div>
        <p className="yds-portfolio-p7__annual-meta font-mono tabular-nums">
          추천 기록 {annual.pickCount}건 · 포트 추적 {annual.trackingDays}일 · TOP3 승률{" "}
          {annual.top3WinRate != null ? `${annual.top3WinRate}%` : "—"}
        </p>
      </div>
    </section>
  )
}
