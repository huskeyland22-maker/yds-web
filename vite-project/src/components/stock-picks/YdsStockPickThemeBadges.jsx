/**
 * @param {{ themes: string[]; className?: string }} props
 */
export default function YdsStockPickThemeBadges({ themes, className = "" }) {
  if (!themes?.length) return null

  return (
    <div className={["yds-spick-theme-badges", className].filter(Boolean).join(" ")}>
      {themes.map((theme) => (
        <span key={theme} className="yds-spick-theme-badge">
          {theme}
        </span>
      ))}
    </div>
  )
}
