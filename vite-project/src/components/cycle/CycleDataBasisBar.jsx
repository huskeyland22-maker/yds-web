import { useMemo, useState } from "react"
import { resolveMarketUpdateTime } from "../../utils/marketUpdateTime.js"

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
  const marketTime = useMemo(() => resolveMarketUpdateTime({ updatedAt }), [updatedAt])
  const ts = marketTime.kstLabel ?? "—"

  return (
    <div className="cycle-data-basis">
      <div className="cycle-data-basis__compact">
        <p className="m-0 cycle-data-basis__line font-mono tabular-nums">
          <span className="cycle-data-basis__muted">업데이트:</span> {ts}
          <span className="cycle-data-basis__muted"> · </span>
          <span>{marketTime.basisNote}</span>
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
          <span className="cycle-data-basis__muted">{open ? "▲" : "▼"}</span>
        </button>
      </div>

      {open ? (
        <div className="cycle-data-basis__detail" role="region" aria-label="데이터 기준 상세">
          <p className="m-0">미국장 종가</p>
          <p className="m-0">한국시간 오전 8시</p>
          <p className="m-0">
            <span className="cycle-data-basis__muted">Cycle:</span> {cycleSource}
          </p>
          <p className="m-0">
            <span className="cycle-data-basis__muted">채권:</span> {bondSource}
          </p>
        </div>
      ) : null}
    </div>
  )
}
