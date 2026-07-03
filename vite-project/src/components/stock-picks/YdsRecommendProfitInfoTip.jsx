import { useId, useState } from "react"

/**
 * 추천 후 수익률 설명 (ⓘ)
 * @param {{ className?: string }} props
 */
export default function YdsRecommendProfitInfoTip({ className = "" }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div
      className={["yds-spick-recommend-profit-info", className].filter(Boolean).join(" ")}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="yds-spick-recommend-profit-info__btn"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="추천 후 수익률 설명"
        onClick={() => setOpen((value) => !value)}
      >
        ⓘ
      </button>

      {open ? (
        <div id={panelId} className="yds-spick-recommend-profit-info__panel" role="tooltip">
          추천가 대비 현재가 기준의 누적 수익률입니다.
        </div>
      ) : null}
    </div>
  )
}
