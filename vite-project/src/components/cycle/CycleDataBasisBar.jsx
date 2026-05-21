import { useState } from "react"
import { formatUpdateTimestampKst } from "../../utils/formatDataAge.js"

/**
 * @param {{
 *   updatedAt?: string | number | Date | null
 *   cycleSource?: string
 *   bondSource?: string
 * }} props
 */
export default function CycleDataBasisBar({
  updatedAt = null,
  cycleSource = "수동 입력",
  bondSource = "FRED",
}) {
  const [open, setOpen] = useState(false)
  const ts = formatUpdateTimestampKst(updatedAt) ?? "—"

  return (
    <div className="cycle-data-basis">
      <div className="cycle-data-basis__compact">
        <p className="m-0 cycle-data-basis__line font-mono tabular-nums text-slate-200">
          <span className="text-slate-500">업데이트:</span> {ts}
          <span className="text-slate-600"> · </span>
          <span className="text-slate-400">미국장 마감 기준</span>
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="cycle-data-basis__toggle"
          aria-expanded={open}
          aria-label="데이터 기준 상세"
        >
          <span className="cycle-data-basis__toggle-icon" aria-hidden>
            ⓘ
          </span>
          <span>데이터 기준</span>
          <span className="text-slate-500">{open ? "▲" : "▼"}</span>
        </button>
      </div>

      {open ? (
        <div className="cycle-data-basis__detail" role="region" aria-label="데이터 기준 상세">
          <p className="m-0">미국장 종가</p>
          <p className="m-0">한국시간 오전 8시</p>
          <p className="m-0">
            <span className="text-slate-500">Cycle:</span> {cycleSource}
          </p>
          <p className="m-0">
            <span className="text-slate-500">채권:</span> {bondSource}
          </p>
        </div>
      ) : null}
    </div>
  )
}
