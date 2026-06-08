import { useMemo } from "react"
import { buildValidationReport } from "../../content/ydsValidationEngine.js"
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
  const { portfolio } = usePortfolioHoldings()

  const report = useMemo(
    () => buildValidationReport(marketContext, portfolio),
    [marketContext, portfolio],
  )

  const { picks, pickSummary, regimeSummary, portfolio: pf, reviews } = report

  return (
    <section
      className="yds-portfolio__section yds-portfolio-v2__section yds-portfolio-p7__validation"
      aria-labelledby="pf-validation"
    >
      <h2 id="pf-validation" className="yds-portfolio__section-title">
        5 · YDS 검증
      </h2>

      <p className="yds-portfolio-v2__hint-inline">
        새 분석 없음 · 종목추천 TOP3·포트폴리오·복기 데이터 자동 추적
      </p>

      <div className="yds-portfolio-p7__block">
        <h3 className="yds-portfolio-p7__block-title">1 · 추천 종목 성과</h3>
        {pickSummary.total === 0 ? (
          <p className="yds-portfolio-v2__empty">추천 스냅샷이 쌓이면 자동 추적됩니다.</p>
        ) : (
          <>
            <p className="yds-portfolio-p7__summary font-mono tabular-nums">
              기록 {pickSummary.total}건 · 추적 {pickSummary.tracked}건
              {pickSummary.avgReturn != null ? ` · 평균 ${formatSignedPct(pickSummary.avgReturn)}` : ""}
            </p>
            <div className="yds-portfolio-v2__table-wrap">
              <table className="yds-portfolio-v2__table yds-portfolio-p7__table">
                <thead>
                  <tr>
                    <th scope="col">종목</th>
                    <th scope="col">추천일</th>
                    <th scope="col">추천가</th>
                    <th scope="col">현재가</th>
                    <th scope="col">수익률</th>
                    <th scope="col">시장</th>
                  </tr>
                </thead>
                <tbody>
                  {picks.slice(0, 12).map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.name}</strong>
                        <span className="yds-portfolio-v2__ticker font-mono tabular-nums">
                          {row.ticker}
                        </span>
                      </td>
                      <td className="font-mono tabular-nums">{row.recommendedAt}</td>
                      <td className="font-mono tabular-nums">
                        {formatPrice(row.recommendedPrice, row.country)}
                      </td>
                      <td className="font-mono tabular-nums">
                        {formatPrice(row.currentPrice, row.country)}
                      </td>
                      <td
                        className={[
                          "font-mono tabular-nums",
                          (row.returnPct ?? 0) > 0 ? "yds-portfolio-v2__up" : "",
                          (row.returnPct ?? 0) < 0 ? "yds-portfolio-v2__down" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {formatSignedPct(row.returnPct)}
                      </td>
                      <td>{row.regimeLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="yds-portfolio-p7__block">
        <h3 className="yds-portfolio-p7__block-title">2 · 상태별 성과</h3>
        <div className="yds-portfolio-p7__regime-grid">
          {regimeSummary.map((g) => (
            <div key={g.regimeLabel} className="yds-portfolio-p7__regime-card">
              <p className="yds-portfolio-p7__regime-label">{g.regimeLabel}</p>
              <p className="yds-portfolio-p7__regime-value font-mono tabular-nums">
                {g.avgReturn != null ? formatSignedPct(g.avgReturn) : "—"}
              </p>
              <p className="yds-portfolio-p7__regime-meta">
                {g.count}건 · 추적 {g.withReturn}건
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="yds-portfolio-p7__block">
        <h3 className="yds-portfolio-p7__block-title">3 · 포트폴리오 성과</h3>
        {!pf.latest ? (
          <p className="yds-portfolio-v2__empty">거래·현금 입력 후 일별 스냅샷이 쌓입니다.</p>
        ) : (
          <div className="yds-portfolio-p7__pf-grid">
            <div className="yds-portfolio-p7__pf-metric">
              <span>총자산</span>
              <strong className="font-mono tabular-nums">
                {pf.latest.totalAssets.toLocaleString("ko-KR")}원
              </strong>
              {pf.assetsDelta != null ? (
                <em className="font-mono tabular-nums">{formatSignedKrw(pf.assetsDelta)}</em>
              ) : null}
            </div>
            <div className="yds-portfolio-p7__pf-metric">
              <span>총손익</span>
              <strong className="font-mono tabular-nums">{formatSignedKrw(pf.latest.totalPnl)}</strong>
              {pf.pnlDelta != null ? (
                <em className="font-mono tabular-nums">{formatSignedKrw(pf.pnlDelta)}</em>
              ) : null}
            </div>
            <div className="yds-portfolio-p7__pf-metric">
              <span>총수익률</span>
              <strong className="font-mono tabular-nums">
                {formatSignedPct(pf.latest.totalReturnPct)}
              </strong>
              {pf.returnDelta != null ? (
                <em className="font-mono tabular-nums">{formatSignedPct(pf.returnDelta)}</em>
              ) : null}
            </div>
            <div className="yds-portfolio-p7__pf-metric">
              <span>현금비중</span>
              <strong className="font-mono tabular-nums">{pf.latest.cashPct}%</strong>
            </div>
          </div>
        )}
        {pf.snapshots.length > 1 ? (
          <p className="yds-portfolio-p7__pf-track font-mono tabular-nums">
            추적 {pf.snapshots.length}일 · {pf.first?.date} → {pf.latest?.date}
          </p>
        ) : null}
      </div>

      <div className="yds-portfolio-p7__block">
        <h3 className="yds-portfolio-p7__block-title">4 · 복기 데이터</h3>
        <div className="yds-portfolio-p7__review-stats">
          <span>매수 이유 {reviews.buyReasons}</span>
          <span>매도 이유 {reviews.sellReasons}</span>
          <span>배운 점 {reviews.lessons}</span>
          <span>전체 {reviews.total}</span>
        </div>
        {reviews.recent.length === 0 ? (
          <p className="yds-portfolio-v2__empty">종목 카드·거래 메모에 복기를 남기면 축적됩니다.</p>
        ) : (
          <ul className="yds-portfolio-p7__review-list">
            {reviews.recent.map((item, i) => (
              <li key={`${item.title}-${i}`}>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
