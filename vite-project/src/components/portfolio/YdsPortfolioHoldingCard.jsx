import { useMemo, useState } from "react"
import { derivePortfolioHoldingAction } from "../../content/ydsPortfolioHoldingAction.js"
import YdsPortfolioQuoteBadge from "./YdsPortfolioQuoteBadge.jsx"

/** @typedef {import("../../content/ydsPortfolioV5Engine.js").HoldingRow} HoldingRow */
/** @typedef {import("../../content/ydsMarketAdapter.js").YdsMarketAdapterContext} YdsMarketAdapterContext */

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

function toneFromNumber(n) {
  if (n == null || !Number.isFinite(n) || n === 0) return ""
  return n > 0 ? "up" : "down"
}

const REVIEW_FIELDS = [
  { key: "buyReason", label: "매수 이유", placeholder: "왜 샀는지" },
  { key: "sellReason", label: "매도 이유", placeholder: "왜 팔았는지 (보유 중이면 계획)" },
  { key: "lessons", label: "배운 점", placeholder: "이 종목에서 배운 것" },
  { key: "nextAction", label: "다음 행동", placeholder: "이번 주 할 일" },
]

/**
 * @param {{
 *   row: HoldingRow
 *   marketContext: YdsMarketAdapterContext
 *   getReview: (positionId: string) => import("../../content/ydsPortfolioStockReviewStorage.js").PortfolioStockReview
 *   updateReview: (positionId: string, patch: Partial<import("../../content/ydsPortfolioStockReviewStorage.js").PortfolioStockReview>) => void
 * }} props
 */
export default function YdsPortfolioHoldingCard({ row, marketContext, getReview, updateReview }) {
  const [reviewOpen, setReviewOpen] = useState(false)
  const review = getReview(row.id)

  const action = useMemo(
    () => derivePortfolioHoldingAction(row, marketContext),
    [row, marketContext],
  )

  const returnTone = toneFromNumber(row.returnPct)
  const pnlTone = toneFromNumber(row.unrealizedPnl)

  return (
    <article className="yds-portfolio-v64__card" aria-label={`${row.name} 보유`}>
      <header className="yds-portfolio-v64__card-head">
        <div className="yds-portfolio-v64__card-title">
          <strong>{row.name}</strong>
          {row.ticker ? (
            <span className="yds-portfolio-v2__ticker font-mono tabular-nums">{row.ticker}</span>
          ) : null}
          <span className="yds-portfolio-v4__country">{row.country === "kr" ? " 🇰🇷" : " 🇺🇸"}</span>
        </div>
        {row.priceStatus ? (
          <YdsPortfolioQuoteBadge status={row.priceStatus} stale={row.priceStale} compact />
        ) : null}
      </header>

      <div className="yds-portfolio-v64__card-metrics">
        <div className="yds-portfolio-v64__card-metric">
          <span className="yds-portfolio-v64__card-label">수익률</span>
          <strong
            className={[
              "yds-portfolio-v64__card-value font-mono tabular-nums",
              returnTone === "up" ? "yds-portfolio-v2__up" : "",
              returnTone === "down" ? "yds-portfolio-v2__down" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {formatSignedPct(row.returnPct)}
          </strong>
        </div>
        <div className="yds-portfolio-v64__card-metric">
          <span className="yds-portfolio-v64__card-label">평가손익</span>
          <strong
            className={[
              "yds-portfolio-v64__card-value font-mono tabular-nums",
              pnlTone === "up" ? "yds-portfolio-v2__up" : "",
              pnlTone === "down" ? "yds-portfolio-v2__down" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {formatSignedKrw(row.unrealizedPnl)}
          </strong>
        </div>
        <div className="yds-portfolio-v64__card-metric">
          <span className="yds-portfolio-v64__card-label">비중</span>
          <strong className="yds-portfolio-v64__card-value font-mono tabular-nums">
            {row.weightPct}%
          </strong>
        </div>
      </div>

      <div className="yds-portfolio-v64__card-yds">
        <div className="yds-portfolio-v64__card-status">
          <span className="yds-portfolio-v64__card-label">현재 상태</span>
          <span>
            {action.stockStatus.emoji} {action.stockStatus.label}
          </span>
        </div>
        <div className="yds-portfolio-v64__card-action">
          <span className="yds-portfolio-v64__card-label">행동</span>
          <strong>
            {action.stockAction.emoji} {action.stockAction.label}
          </strong>
        </div>
      </div>

      <p className="yds-portfolio-v64__card-reason">{action.actionReason}</p>

      {row.realizedPnl !== 0 ? (
        <p className="yds-portfolio-v64__card-realized font-mono tabular-nums">
          실현손익 {formatSignedKrw(row.realizedPnl)}
        </p>
      ) : null}

      <button
        type="button"
        className="yds-portfolio-v64__card-review-toggle"
        aria-expanded={reviewOpen}
        onClick={() => setReviewOpen((v) => !v)}
      >
        {reviewOpen ? "복기 접기" : "종목 복기"}
      </button>

      {reviewOpen ? (
        <div className="yds-portfolio-v64__card-review">
          {REVIEW_FIELDS.map((field) => (
            <label key={field.key} className="yds-portfolio-v2__review-field">
              <span>{field.label}</span>
              <textarea
                rows={2}
                value={review[field.key]}
                onChange={(e) =>
                  updateReview(row.id, {
                    [field.key]: e.target.value,
                    stockName: row.name,
                    ticker: row.ticker ?? "",
                  })
                }
                placeholder={field.placeholder}
              />
            </label>
          ))}
        </div>
      ) : null}
    </article>
  )
}
