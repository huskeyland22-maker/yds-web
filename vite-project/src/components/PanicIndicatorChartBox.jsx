import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

const boxStyle = {
  background: "#111827",
  padding: "20px",
  borderRadius: "12px",
  marginTop: "20px",
}

const tooltipStyle = {
  backgroundColor: "#0f172a",
  border: "1px solid #334155",
  borderRadius: "8px",
  fontSize: "12px",
}

/**
 * @param {{ title: string; data: Array<Record<string, unknown>>; dataKey: string }} props
 */
export default function PanicIndicatorChartBox({ title, data, dataKey }) {
  return (
    <div style={boxStyle}>
      <h3 className="m-0 mb-3 text-sm font-semibold text-gray-300">{title}</h3>

      <div className="h-[200px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="time" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} width={36} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#e2e8f0" }} />
            <Line type="monotone" dataKey={dataKey} stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
