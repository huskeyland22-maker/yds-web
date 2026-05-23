/**
 * @param {{
 *   label: string
 *   value: string
 *   accent?: string
 *   selected?: boolean
 *   onClick?: () => void
 *   variant?: "core" | "expert" | "highlight"
 *   fullWidth?: boolean
 * }} props
 */
export default function PanicMetricRow({
  label,
  value,
  accent = "#e2e8f0",
  selected = false,
  onClick,
  variant = "core",
  fullWidth = false,
}) {
  const Tag = onClick ? "button" : "div"
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={[
        "panic-metric-row",
        `panic-metric-row--${variant}`,
        fullWidth ? "panic-metric-row--full" : "",
        selected ? "is-selected" : "",
      ].join(" ")}
    >
      <span className="panic-metric-row__label">{label}</span>
      <span className="panic-metric-row__value font-mono tabular-nums" style={{ color: accent }}>
        {value}
      </span>
    </Tag>
  )
}
