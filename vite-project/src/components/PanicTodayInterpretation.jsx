import { useState } from "react"
import PanicMarketReportPanel from "./PanicMarketReportPanel.jsx"
import SectionErrorBoundary from "./SectionErrorBoundary.jsx"

/**
 * 패닉 데스크 하단 — 상세 브리핑만 (접기, 기본 숨김). 오늘 해석 카드 제거.
 * @param {{
 *   deskMarketReport?: object | null
 *   deskMarketReportLoading?: boolean
 *   strategyBrief?: string
 *   marketPolicy?: object | null
 * }} props
 */
export default function PanicTodayInterpretation({
  deskMarketReport = null,
  deskMarketReportLoading = false,
  strategyBrief = "",
  marketPolicy = null,
}) {
  const [detailOpen, setDetailOpen] = useState(false)

  const hasBrief = Boolean(strategyBrief?.trim())
  const hasReport = Boolean(deskMarketReport?.summary) || deskMarketReportLoading
  if (!hasBrief && !hasReport) return null

  return (
    <div className="panic-today-wrap">
      <button
        type="button"
        onClick={() => setDetailOpen((v) => !v)}
        className="panic-today-detail-toggle"
        aria-expanded={detailOpen}
      >
        <span>상세 브리핑</span>
        <span className="cycle-data-basis__muted">{detailOpen ? "▲" : "▼"}</span>
      </button>

      {detailOpen ? (
        <div className="panic-today-detail space-y-0">
          {hasBrief ? (
            <div className="ai-brief ai-brief--compact" role="note">
              <p className="ai-brief__body">
                {strategyBrief.split(" · ").filter(Boolean).map((part, i) => (
                  <span key={`brief-${i}`} className="ai-brief__item">
                    {part}
                  </span>
                ))}
              </p>
            </div>
          ) : null}
          {hasReport ? (
            <SectionErrorBoundary label="시장 리포트">
              <PanicMarketReportPanel
                report={deskMarketReport}
                loading={deskMarketReportLoading}
                marketPolicy={marketPolicy}
              />
            </SectionErrorBoundary>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
