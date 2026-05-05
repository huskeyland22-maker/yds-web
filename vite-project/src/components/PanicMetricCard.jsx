import { getStatus } from "../utils/panicIndicatorStatus.js"

const cardStyle = {
  background: "#1f2937",
  padding: "16px",
  borderRadius: "14px",
  textAlign: "center",
  color: "white",
  boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
  transition: "all 0.2s ease",
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
        e.currentTarget.style.transform = "translateY(-6px)"
        e.currentTarget.style.boxShadow = "0 15px 40px rgba(0,0,0,0.6)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)"
        e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.35)"
      }}
    >
      <h3 className="m-0 text-xs font-semibold text-gray-400 sm:text-sm">{title}</h3>

      <p
        className="mb-1 mt-2 font-mono text-lg font-bold sm:text-xl"
        style={{ fontSize: "20px", fontWeight: "bold", color: status.color }}
      >
        {display}
      </p>

      <span
        style={{
          padding: "4px 8px",
          borderRadius: "8px",
          fontSize: "12px",
          background: status.color,
          color: "white",
        }}
      >
        {status.text}
      </span>
    </div>
  )
}
