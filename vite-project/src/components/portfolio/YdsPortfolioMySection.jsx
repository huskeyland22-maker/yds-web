import { usePortfolioHoldings } from "../../hooks/usePortfolioHoldings.js"
import { formatKrw } from "../../content/ydsPortfolioV2Engine.js"

function formatSignedKrw(n) {
  if (n == null || !Number.isFinite(n)) return "—"
  const sign = n > 0 ? "+" : ""
  return `${sign}${Math.round(n).toLocaleString("ko-KR")}원`
}

function formatSignedPct(n) {
  if (n == null || !Number.isFinite(n)) return "—"
  const sign = n > 0 ? "+" : ""
  return `${sign}${n}%`
}

function formatUnitPrice(country, price) {
  if (price == null || !Number.isFinite(price)) return "—"
  if (country === "us") {
    return `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
  }
  return `${Math.round(price).toLocaleString("ko-KR")}원`
}

const SORT_OPTIONS = [
  { id: "returnPct", label: "수익률" },
  { id: "unrealizedPnl", label: "손익" },
  { id: "weightPct", label: "비중" },
]

export default function YdsPortfolioMySection() {
  const { portfolio, sortBy, setSortBy } = usePortfolioHoldings()
  const {
    rows,
    totalValue,
    totalCostKrw,
    totalPnl,
    totalReturnPct,
    cashPct,
    totalRealizedPnl,
  } = portfolio

  return (
    <section
      className="yds-portfolio__section yds-portfolio-v2__section yds-portfolio-v3__my yds-portfolio-v4__my yds-portfolio-v5__my"
      aria-labelledby="pf-my"
    >
      <h2 id="pf-my" className="yds-portfolio__section-title">
        1 · 내 포트폴리오
      </h2>

      <p className="yds-portfolio-v2__hint-inline">
        거래 기록 + 현재가 연동 · 보유·비중 자동 계산
      </p>

      <div className="yds-portfolio-v5__hero" aria-label="포트폴리오 요약">
        <div className="yds-portfolio-v3__metric yds-portfolio-v3__metric--primary">
          <p className="yds-portfolio-v3__metric-label">총 평가금액</p>
          <p className="yds-portfolio-v3__metric-value font-mono tabular-nums">
            {totalValue > 0 ? totalValue.toLocaleString("ko-KR") : "—"}
            {totalValue > 0 ? <span className="yds-portfolio-v3__metric-unit">원</span> : null}
          </p>
        </div>
        <div className="yds-portfolio-v3__metric">
          <p className="yds-portfolio-v3__metric-label">총 투자금액</p>
          <p className="yds-portfolio-v3__metric-value font-mono tabular-nums">
            {totalCostKrw > 0 ? totalCostKrw.toLocaleString("ko-KR") : "—"}
            {totalCostKrw > 0 ? <span className="yds-portfolio-v3__metric-unit">원</span> : null}
          </p>
        </div>
        <div className="yds-portfolio-v3__metric">
          <p className="yds-portfolio-v3__metric-label">총 손익</p>
          <p
            className={[
              "yds-portfolio-v3__metric-value font-mono tabular-nums",
              totalPnl > 0 ? "yds-portfolio-v2__up" : "",
              totalPnl < 0 ? "yds-portfolio-v2__down" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {totalValue > 0 || totalPnl !== 0 ? formatSignedKrw(totalPnl) : "—"}
          </p>
          {totalRealizedPnl !== 0 ? (
            <p className="yds-portfolio-v5__hero-sub font-mono tabular-nums">
              실현 {formatSignedKrw(totalRealizedPnl)}
            </p>
          ) : null}
        </div>
        <div className="yds-portfolio-v3__metric">
          <p className="yds-portfolio-v3__metric-label">총 수익률</p>
          <p
            className={[
              "yds-portfolio-v3__metric-value font-mono tabular-nums",
              (totalReturnPct ?? 0) > 0 ? "yds-portfolio-v2__up" : "",
              (totalReturnPct ?? 0) < 0 ? "yds-portfolio-v2__down" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {totalReturnPct != null ? formatSignedPct(totalReturnPct) : "—"}
          </p>
          <p className="yds-portfolio-v5__hero-sub font-mono tabular-nums">
            현금 {totalValue > 0 ? `${cashPct}%` : "—"}
          </p>
        </div>
      </div>

      {!rows.length ? (
        <p className="yds-portfolio-v2__empty">
          거래 기록(종목코드·수량·단가)을 남기면 현재가가 연동된 보유 종목이 자동 생성됩니다.
        </p>
      ) : (
        <>
          <div className="yds-portfolio-v5__sort" role="group" aria-label="정렬">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={[
                  "yds-portfolio-v5__sort-btn",
                  sortBy === opt.id ? "yds-portfolio-v5__sort-btn--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setSortBy(/** @type {typeof sortBy} */ (opt.id))}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="yds-portfolio-v2__table-wrap">
            <table className="yds-portfolio-v2__table yds-portfolio-v4__holdings-table yds-portfolio-v5__holdings-table">
              <thead>
                <tr>
                  <th scope="col">종목</th>
                  <th scope="col">평균단가</th>
                  <th scope="col">현재가</th>
                  <th scope="col">수익률</th>
                  <th scope="col">평가금액</th>
                  <th scope="col">평가손익</th>
                  <th scope="col">비중</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                      {row.ticker ? (
                        <span className="yds-portfolio-v2__ticker">{row.ticker}</span>
                      ) : null}
                      <span className="yds-portfolio-v4__country">
                        {row.country === "kr" ? " 🇰🇷" : " 🇺🇸"}
                      </span>
                      {row.priceReady && row.quantity > 0 ? (
                        <span className="yds-portfolio-v5__qty font-mono tabular-nums">
                          {row.quantity}주
                        </span>
                      ) : null}
                    </td>
                    <td className="font-mono tabular-nums">
                      {row.priceReady
                        ? formatUnitPrice(row.country, row.avgUnitPrice)
                        : formatKrw(row.costBasisKrw)}
                    </td>
                    <td className="font-mono tabular-nums">
                      {formatUnitPrice(row.country, row.currentPrice)}
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
                    <td className="font-mono tabular-nums">{formatKrw(row.marketValueKrw)}</td>
                    <td
                      className={[
                        "font-mono tabular-nums",
                        (row.unrealizedPnl ?? 0) > 0 ? "yds-portfolio-v2__up" : "",
                        (row.unrealizedPnl ?? 0) < 0 ? "yds-portfolio-v2__down" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {formatSignedKrw(row.unrealizedPnl)}
                    </td>
                    <td className="font-mono tabular-nums">{row.weightPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
