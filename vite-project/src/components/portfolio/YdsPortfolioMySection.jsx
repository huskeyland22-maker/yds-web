import { usePortfolioHoldings } from "../../hooks/usePortfolioHoldings.js"
import { formatKrw } from "../../content/ydsPortfolioV2Engine.js"

function formatSignedKrw(n) {
  if (n == null || !Number.isFinite(n)) return "—"
  const sign = n > 0 ? "+" : ""
  return `${sign}${Math.round(n).toLocaleString("ko-KR")}원`
}

export default function YdsPortfolioMySection() {
  const { portfolio } = usePortfolioHoldings()
  const { rows, totalValue, cashPct, totalRealizedPnl } = portfolio

  return (
    <section
      className="yds-portfolio__section yds-portfolio-v2__section yds-portfolio-v3__my yds-portfolio-v4__my"
      aria-labelledby="pf-my"
    >
      <h2 id="pf-my" className="yds-portfolio__section-title">
        1 · 내 포트폴리오
      </h2>

      <p className="yds-portfolio-v2__hint-inline">거래 기록에서 자동 생성 · 직접 입력 없음</p>

      <div className="yds-portfolio-v3__hero" aria-label="포트폴리오 요약">
        <div className="yds-portfolio-v3__metric yds-portfolio-v3__metric--primary">
          <p className="yds-portfolio-v3__metric-label">총 평가금액</p>
          <p className="yds-portfolio-v3__metric-value font-mono tabular-nums">
            {totalValue > 0 ? totalValue.toLocaleString("ko-KR") : "—"}
            {totalValue > 0 ? <span className="yds-portfolio-v3__metric-unit">원</span> : null}
          </p>
        </div>
        <div className="yds-portfolio-v3__metric">
          <p className="yds-portfolio-v3__metric-label">실현손익</p>
          <p
            className={[
              "yds-portfolio-v3__metric-value font-mono tabular-nums",
              totalRealizedPnl > 0 ? "yds-portfolio-v2__up" : "",
              totalRealizedPnl < 0 ? "yds-portfolio-v2__down" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {totalValue > 0 || totalRealizedPnl !== 0
              ? formatSignedKrw(totalRealizedPnl)
              : "—"}
          </p>
        </div>
        <div className="yds-portfolio-v3__metric">
          <p className="yds-portfolio-v3__metric-label">현금 비중</p>
          <p className="yds-portfolio-v3__metric-value font-mono tabular-nums">
            {totalValue > 0 ? `${cashPct}%` : "—"}
          </p>
        </div>
      </div>

      {!rows.length ? (
        <p className="yds-portfolio-v2__empty">매매 기록을 남기면 보유 종목이 자동으로 생성됩니다.</p>
      ) : (
        <div className="yds-portfolio-v2__table-wrap">
          <table className="yds-portfolio-v2__table yds-portfolio-v4__holdings-table">
            <thead>
              <tr>
                <th scope="col">종목명</th>
                <th scope="col">매입금액</th>
                <th scope="col">현재 보유금액</th>
                <th scope="col">비중</th>
                <th scope="col">실현손익</th>
                <th scope="col">미실현손익</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.name}</strong>
                    <span className="yds-portfolio-v4__country">
                      {row.country === "kr" ? "🇰🇷" : "🇺🇸"}
                    </span>
                  </td>
                  <td className="font-mono tabular-nums">{formatKrw(row.purchaseAmount)}</td>
                  <td className="font-mono tabular-nums">{formatKrw(row.holdingAmount)}</td>
                  <td className="font-mono tabular-nums">{row.weightPct}%</td>
                  <td
                    className={[
                      "font-mono tabular-nums",
                      row.realizedPnl > 0 ? "yds-portfolio-v2__up" : "",
                      row.realizedPnl < 0 ? "yds-portfolio-v2__down" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {formatSignedKrw(row.realizedPnl)}
                  </td>
                  <td className="yds-portfolio-v4__future font-mono tabular-nums">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
