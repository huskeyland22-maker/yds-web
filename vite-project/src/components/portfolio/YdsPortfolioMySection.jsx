import { usePortfolioHoldings } from "../../hooks/usePortfolioHoldings.js"
import { usePortfolioStockReviews } from "../../hooks/usePortfolioStockReviews.js"
import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"
import { formatQuoteUpdatedAt } from "../../content/ydsPortfolioQuoteTypes.js"
import YdsPortfolioHoldingCard from "./YdsPortfolioHoldingCard.jsx"

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

function MetricValue({ children, tone = "", large = false }) {
  return (
    <p
      className={[
        large ? "yds-portfolio-v64__hero-value" : "yds-portfolio-v3__metric-value",
        "font-mono tabular-nums",
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
  const marketContext = useYdsMarketContext()
  const { getReview, updateReview } = usePortfolioStockReviews()
  const { portfolio, sortBy, setSortBy, quotesLoading, quotesFetchedAt, quotesError } =
    usePortfolioHoldings()
  const {
    rows = [],
    totalAssets = 0,
    totalPnl = 0,
    totalReturnPct = null,
    cashPct = 0,
    cashAmount = 0,
    totalRealizedPnl = 0,
    totalUnrealizedPnl = 0,
  } = portfolio ?? {}

  const hasAccount = totalAssets > 0 || rows.length > 0 || cashAmount > 0

  return (
    <section
      className="yds-portfolio__section yds-portfolio-v2__section yds-portfolio-v64__my"
      aria-labelledby="pf-my"
    >
      <h2 id="pf-my" className="yds-portfolio__section-title">
        1 · 내 포트폴리오
      </h2>

      <p className="yds-portfolio-v2__hint-inline">
        실제 계좌 모드 · FIFO 실현손익 · 현재 현금 + 주식 평가
        {marketContext?.ready ? (
          <span>
            {" "}
            · 시장 {marketContext.strategyEmoji} {marketContext.strategyLabel}
          </span>
        ) : null}
        {quotesLoading ? " · 시세 조회 중…" : null}
        {!quotesLoading && quotesFetchedAt ? (
          <span className="yds-portfolio-v6__sync font-mono tabular-nums">
            {" "}
            · 갱신 {formatQuoteUpdatedAt(quotesFetchedAt)}
          </span>
        ) : null}
        {quotesError ? <span className="yds-portfolio-v6__sync-error"> · 시세 지연</span> : null}
      </p>

      <div className="yds-portfolio-v64__hero" aria-label="계좌 핵심 4지표">
        <div className="yds-portfolio-v64__hero-metric yds-portfolio-v64__hero-metric--primary">
          <p className="yds-portfolio-v64__hero-label">총자산</p>
          <MetricValue large>
            {totalAssets > 0 ? (
              <>
                {totalAssets.toLocaleString("ko-KR")}
                <span className="yds-portfolio-v3__metric-unit">원</span>
              </>
            ) : (
              "—"
            )}
          </MetricValue>
        </div>
        <div className="yds-portfolio-v64__hero-metric">
          <p className="yds-portfolio-v64__hero-label">총손익</p>
          <MetricValue large tone={toneFromNumber(totalPnl)}>
            {hasAccount && totalPnl !== 0 ? formatSignedKrw(totalPnl) : hasAccount ? "0원" : "—"}
          </MetricValue>
        </div>
        <div className="yds-portfolio-v64__hero-metric">
          <p className="yds-portfolio-v64__hero-label">총수익률</p>
          <MetricValue large tone={toneFromNumber(totalReturnPct)}>
            {totalReturnPct != null ? formatSignedPct(totalReturnPct) : "—"}
          </MetricValue>
        </div>
        <div className="yds-portfolio-v64__hero-metric">
          <p className="yds-portfolio-v64__hero-label">현금비중</p>
          <MetricValue large>{totalAssets > 0 ? `${cashPct}%` : "—"}</MetricValue>
        </div>
      </div>

      <div className="yds-portfolio-v64__pnl-strip" aria-label="손익 분리">
        <div className="yds-portfolio-v64__pnl-item">
          <span className="yds-portfolio-v64__pnl-label">실현손익</span>
          <MetricValue tone={toneFromNumber(totalRealizedPnl)}>
            {totalRealizedPnl !== 0 ? formatSignedKrw(totalRealizedPnl) : "—"}
          </MetricValue>
        </div>
        <div className="yds-portfolio-v64__pnl-item">
          <span className="yds-portfolio-v64__pnl-label">미실현손익</span>
          <MetricValue tone={toneFromNumber(totalUnrealizedPnl)}>
            {totalUnrealizedPnl !== 0 ? formatSignedKrw(totalUnrealizedPnl) : "—"}
          </MetricValue>
        </div>
      </div>

      {!rows.length && cashAmount <= 0 ? (
        <p className="yds-portfolio-v2__empty">
          현재 현금과 거래 기록을 입력하면 10초 안에 계좌 상태를 확인할 수 있습니다.
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

          <div className="yds-portfolio-v64__cards">
            {rows.map((row) => (
              <YdsPortfolioHoldingCard
                key={row.id}
                row={row}
                marketContext={marketContext}
                getReview={getReview}
                updateReview={updateReview}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
