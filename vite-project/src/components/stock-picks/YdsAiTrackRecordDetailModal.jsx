import { useEffect } from "react"
import { Link } from "react-router-dom"

/**
 * @param {{
 *   detail: import("../../content/ydsAiTrackRecordEngine.js").ReturnType<typeof import("../../content/ydsAiTrackRecordEngine.js").buildTrackRecordDetail>
 *   onClose: () => void
 * }} props
 */
export default function YdsAiTrackRecordDetailModal({ detail, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  if (!detail?.visible) return null

  return (
    <div
      className="yds-track-record-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="yds-track-record-modal-title"
      onClick={onClose}
    >
      <div
        className="yds-track-record-modal__panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="yds-track-record-modal__head">
          <div>
            <h2 id="yds-track-record-modal-title" className="yds-track-record-modal__title">
              {detail.name}
            </h2>
            <p className="yds-track-record-modal__sub font-mono tabular-nums">
              {detail.ticker} · {detail.country}
            </p>
          </div>
          <button type="button" className="yds-track-record-modal__close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        <section className="yds-track-record-modal__section">
          <h3>성과</h3>
          <dl className="yds-track-record-modal__grid">
            <div><dt>추천일</dt><dd className="font-mono tabular-nums">{detail.recommendedAtLabel}</dd></div>
            <div><dt>추천 생성일</dt><dd className="font-mono tabular-nums">{detail.createdAtLabel}</dd></div>
            <div><dt>경과</dt><dd className="font-mono tabular-nums">{detail.elapsedLabel}</dd></div>
            <div><dt>추천가</dt><dd className="font-mono tabular-nums">{detail.recommendedPriceLabel}</dd></div>
            <div><dt>현재가</dt><dd className="font-mono tabular-nums">{detail.currentPriceLabel}</dd></div>
            <div>
              <dt>추천 후 수익</dt>
              <dd className={["font-mono tabular-nums", `yds-track-record-modal__ret--${detail.returnTone}`].join(" ")}>
                {detail.returnLabel}
              </dd>
            </div>
            <div><dt>최고 수익</dt><dd className="font-mono tabular-nums yds-track-record-modal__ret--up">{detail.maxReturnLabel}</dd></div>
            <div><dt>최대 손실</dt><dd className="font-mono tabular-nums yds-track-record-modal__ret--down">{detail.minReturnLabel}</dd></div>
            <div><dt>현재 상태</dt><dd>{detail.statusLabel}</dd></div>
          </dl>
        </section>

        <section className="yds-track-record-modal__section">
          <h3>추천 당시 정보</h3>
          <dl className="yds-track-record-modal__grid">
            <div><dt>AI 점수</dt><dd className="font-mono tabular-nums">{detail.aiScoreLabel}</dd></div>
            <div><dt>AI 등급</dt><dd>{detail.aiGradeLabel}</dd></div>
            <div><dt>시장 상태</dt><dd>{detail.marketState}</dd></div>
            <div><dt>패닉 강도</dt><dd className="font-mono tabular-nums">{detail.panicIntensityLabel}</dd></div>
            <div><dt>시장 사이클</dt><dd>{detail.cycleLabel}</dd></div>
            <div><dt>VIX</dt><dd className="font-mono tabular-nums">{detail.vixLabel}</dd></div>
            <div><dt>CNN Fear &amp; Greed</dt><dd className="font-mono tabular-nums">{detail.cnnLabel}</dd></div>
            <div><dt>BofA Bull &amp; Bear</dt><dd className="font-mono tabular-nums">{detail.bofaLabel}</dd></div>
            <div className="yds-track-record-modal__grid-span"><dt>추천 이유</dt><dd>{detail.reasonLine}</dd></div>
          </dl>
        </section>

        {detail.badges?.length ? (
          <div className="yds-track-record-modal__badges">
            {detail.badges.map((badge) => (
              <span key={badge.label} className={`yds-track-record-modal__badge yds-track-record-modal__badge--${badge.tone}`}>
                {badge.emoji} {badge.label}
              </span>
            ))}
          </div>
        ) : null}

        <footer className="yds-track-record-modal__foot">
          <Link to={detail.detailLink} className="yds-track-record-modal__link">
            상세 검증 화면 →
          </Link>
          <Link to={`/stock-picks/${encodeURIComponent(detail.ticker)}`} className="yds-track-record-modal__link">
            현재 AI 분석 →
          </Link>
        </footer>
      </div>
    </div>
  )
}
