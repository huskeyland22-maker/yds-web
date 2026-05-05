import { getStatus } from "../utils/panicIndicatorStatus.js"

const cardStyle = {
  background: "#1f2937",
  padding: "16px",
  borderRadius: "12px",
  textAlign: "center",
  color: "white",
  boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
  transition: "0.2s",
}

/**
 * @param {{ title: string; value: unknown; type?: string }} props
 */
export default function PanicMetricCard({ title, value, type }) {
  const safe = (v) => (v !== undefined && v !== null ? v : "-")
  const status = getStatus(type, value)
  const raw = safe(value)
  const display = typeof raw === "number" && Number.isNaN(raw) ? "-" : String(raw)

  return (
    <div
      style={cardStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.05)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)"
      }}
    >
      <h3 className="m-0 text-xs font-semibold text-gray-400 sm:text-sm">{title}</h3>

      <p
        className="mb-1 mt-2 font-mono text-lg font-bold sm:text-xl"
        style={{ fontSize: "20px", fontWeight: "bold", color: status.color }}
      >
        {display}
      </p>

      <span className="text-xs font-medium sm:text-sm" style={{ color: status.color }}>
        {status.text}
      </span>
    </div>
  )
}
