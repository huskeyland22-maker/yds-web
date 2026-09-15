/**
 * 추가 참고자료 — 기본 접힘 (유동성·이벤트·종목 링크 등)
 * @param {{
 *   children?: import("react").ReactNode
 *   className?: string
 *   title?: string
 * }} props
 */
export default function YdsMarketAnalysisReferenceFold({
  children,
  className = "",
  title = "추가 참고자료",
}) {
  if (!children) return null

  return (
    <details
      className={["yds-market-ref-fold", className].filter(Boolean).join(" ")}
    >
      <summary className="yds-market-ref-fold__summary">
        <span>{title}</span>
        <span className="yds-market-ref-fold__hint">유동성 · 이벤트 · 종목 등 · 기본 접힘</span>
      </summary>
      <div className="yds-market-ref-fold__body">{children}</div>
    </details>
  )
}
