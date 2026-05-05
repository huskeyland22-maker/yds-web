import { getStatus } from "../utils/panicIndicatorStatus.js"

const cardStyle = {
  background: "#111827",
  padding: "20px",
  borderRadius: "12px",
  textAlign: "center",
  color: "white",
  boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
}

/**
 * @param {{ title: string; value: unknown; type?: string }} props
 */
export default function PanicMetricCard({ title, value, type }) {
  const status = getStatus(type, value)
  const display = value == null || (typeof value === "number" && Number.isNaN(value)) ? "-" : String(value)

  return (
    <div style={cardStyle}>
      <h3 className="m-0 text-sm font-semibold text-gray-400">{title}</h3>

      <p className="mb-1 mt-2 font-mono text-white" style={{ fontSize: "22px", fontWeight: "bold" }}>
        {display}
      </p>

      <span className="text-sm font-medium" style={{ color: status.color }}>
        {status.text}
      </span>
    </div>
  )
}
