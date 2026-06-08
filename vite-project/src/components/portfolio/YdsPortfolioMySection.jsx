import { usePortfolioHoldings } from "../../hooks/usePortfolioHoldings.js"
import { formatKrw } from "../../content/ydsPortfolioV2Engine.js"
import { formatQuoteUpdatedAt } from "../../content/ydsPortfolioQuoteTypes.js"
import YdsPortfolioQuoteBadge from "./YdsPortfolioQuoteBadge.jsx"

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

function MetricValue({ children, tone = "" }) {
  return (
    <p
      className={[
        "yds-portfolio-v3__metric-value font-mono tabular-nums",
        tone === "up" ? "yds-portfolio-v2__up" : "",
        tone === "down" ? "yds-portfolio-v2__down" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </p>
  )
}

function toneFromNumber(n) {
  if (n == null || !Number.isFinite(n) || n === 0) return ""
  return n > 0 ? "up" : "down"
}

const SORT_OPTIONS = [
  { id: "returnPct", label: "수익률" },
  { id: "unrealizedPnl", label: "손익" },
  { id: "weightPct", label: "비중" },
]

export default function YdsPortfolioMySection() {
  const { portfolio, sortBy, setSortBy, quotesLoading, quotesFetchedAt, quotesError } =
    usePortfolioHoldings()
  const {
    rows = [],
    totalAssets = 0,
    stockTotal = 0,
    totalCostKrw = 0,
    totalPnl = 0,
    totalReturnPct = null,
    cashAmount = 0,
    cashPct = 0,
    totalRealizedPnl = 0,
    totalUnrealizedPnl = 0,
  } = portfolio ?? {}

  return (
    <section
      className="yds-portfolio__section yds-portfolio-v2__section yds-portfolio-v3__my yds-portfolio-v4__my yds-portfolio-v5__my yds-portfolio-v6__my"
      aria-labelledby="pf-my"
    >
      <h2 id="pf-my" className="yds-portfolio__section-title">
        1 · 내 포트폴리오
      </h2>

      <p className="yds-portfolio-v2__hint-inline">
        현재 현금 + 주식 평가 = 총자산 · FIFO 실현손익 · YDS 비중 비교
        {quotesLoading ? " · 시세 조회 중…" : null}
        {!quotesLoading && quotesFetchedAt ? (
          <span className="yds-portfolio-v6__sync font-mono tabular-nums">
            {" "}
            · 갱신 {formatQuoteUpdatedAt(quotesFetchedAt)}
          </span>
        ) : null}
        {quotesError ? <span className="yds-portfolio-v6__sync-error"> · 시세 지연</span> : null}
      </p>

      <div className="yds-portfolio-v6__hero" aria-label="포트폴리오 요약">
        <div className="yds-portfolio-v3__metric yds-portfolio-v3__metric--primary">
          <p className="yds-portfolio-v3__metric-label">총자산</p>
          <MetricValue>
            {totalAssets > 0 ? totalAssets.toLocaleString("ko-KR") : "—"}
            {totalAssets > 0 ? <span className="yds-portfolio-v3__metric-unit">원</span> : null}
          </MetricValue>
        </div>
        <div className="yds-portfolio-v3__metric">
          <p className="yds-portfolio-v3__metric-label">주식 평가</p>
          <MetricValue>
            {stockTotal > 0 ? stockTotal.toLocaleString("ko-KR") : "—"}
            {stockTotal > 0 ? <span className="yds-portfolio-v3__metric-unit">원</span> : null}
          </MetricValue>
        </div>
        <div className="yds-portfolio-v3__metric">
          <p className="yds-portfolio-v3__metric-label">현금</p>
          <MetricValue>
            {cashAmount > 0 ? cashAmount.toLocaleString("ko-KR") : "—"}
            {cashAmount > 0 ? <span className="yds-portfolio-v3__metric-unit">원</span> : null}
          </MetricValue>
          <p className="yds-portfolio-v5__hero-sub font-mono tabular-nums">
            비중 {totalAssets > 0 ? `${cashPct}%` : "—"}
          </p>
        </div>
        <div className="yds-portfolio-v3__metric">
          <p className="yds-portfolio-v3__metric-label">총 투자금</p>
          <MetricValue>
            {totalCostKrw > 0 ? totalCostKrw.toLocaleString("ko-KR") : "—"}
            {totalCostKrw > 0 ? <span className="yds-portfolio-v3__metric-unit">원</span> : null}
          </MetricValue>
        </div>
        <div className="yds-portfolio-v3__metric">
          <p className="yds-portfolio-v3__metric-label">실현손익</p>
          <MetricValue tone={toneFromNumber(totalRealizedPnl)}>
            {totalRealizedPnl !== 0 ? formatSignedKrw(totalRealizedPnl) : "—"}
          </MetricValue>
        </div>
        <div className="yds-portfolio-v3__metric">
          <p className="yds-portfolio-v3__metric-label">미실현손익</p>
          <MetricValue tone={toneFromNumber(totalUnrealizedPnl)}>
            {totalUnrealizedPnl !== 0 ? formatSignedKrw(totalUnrealizedPnl) : "—"}
          </MetricValue>
        </div>
        <div className="yds-portfolio-v3__metric">
          <p className="yds-portfolio-v3__metric-label">총 손익</p>
          <MetricValue tone={toneFromNumber(totalPnl)}>
            {totalAssets > 0 || totalPnl !== 0 ? formatSignedKrw(totalPnl) : "—"}
          </MetricValue>
        </div>
        <div className="yds-portfolio-v3__metric">
          <p className="yds-portfolio-v3__metric-label">총 수익률</p>
          <MetricValue tone={toneFromNumber(totalReturnPct)}>
            {totalReturnPct != null ? formatSignedPct(totalReturnPct) : "—"}
          </MetricValue>
        </div>
      </div>

      {!rows.length && cashAmount <= 0 ? (
        <p className="yds-portfolio-v2__empty">
          현재 현금과 거래 기록을 입력하면 실제 계좌 기준 포트폴리오가 생성됩니다.
        </p>
      ) : !rows.length ? (
        <p className="yds-portfolio-v2__empty">현금만 보유 중입니다. 종목 거래를 기록해 보세요.</p>
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
                  <th scope="col">실현손익</th>
                  <th scope="col">비중</th>
                  <th scope="col">시세</th>
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
                      <div className="yds-portfolio-v6__price-cell">
                        {formatUnitPrice(row.country, row.currentPrice)}
                        {row.priceStatus ? (
                          <YdsPortfolioQuoteBadge
                            status={row.priceStatus}
                            stale={row.priceStale}
                            compact
                          />
                        ) : null}
                      </div>
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
                    <td
                      className={[
                        "font-mono tabular-nums",
                        row.realizedPnl > 0 ? "yds-portfolio-v2__up" : "",
                        row.realizedPnl < 0 ? "yds-portfolio-v2__down" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {row.realizedPnl !== 0 ? formatSignedKrw(row.realizedPnl) : "—"}
                    </td>
                    <td className="font-mono tabular-nums">{row.weightPct}%</td>
                    <td>
                      <YdsPortfolioQuoteBadge
                        status={row.priceStatus}
                        stale={row.priceStale}
                        updatedAt={row.priceUpdatedAt}
                      />
                    </td>
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
