/**
 * 시장분석 데스크 — 통일 카드 셸 (이벤트·유동성·행동가이드)
 * @param {{
 *   title: string
 *   titleId: string
 *   headerExtra?: import("react").ReactNode
 *   children: import("react").ReactNode
 *   className?: string
 * }} props
 */
export default function YdsDeskCard({ title, titleId, headerExtra, children, className = "" }) {
  return (
    <section
      className={["yds-desk-card", className].filter(Boolean).join(" ")}
      aria-labelledby={titleId}
    >
      <div className="yds-desk-card__head">
        <h2 id={titleId} className="yds-desk-card__title">
          {title}
        </h2>
        {headerExtra ?? null}
      </div>
      {children}
    </section>
  )
}
