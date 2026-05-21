import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { buildSectorRotation, ROTATION_STATE_LABELS } from "../utils/buildSectorRotation.js"
import { buildValueChainSectorUrl } from "../utils/sectorFlowNav.js"

/** @type {Record<string, string>} */
const STATE_CARD_CLASS = {
  watch: "sector-rotation-card--watch",
  neutral: "sector-rotation-card--neutral",
  caution: "sector-rotation-card--caution",
  alert: "sector-rotation-card--alert",
}

/**
 * @param {{
 *   panicData?: object | null
 *   cycleScore?: number | null
 *   loading?: boolean
 * }} props
 */
export default function SectorRotationPanel({
  panicData = null,
  cycleScore = null,
  loading = false,
}) {
  const rotation = useMemo(
    () => buildSectorRotation({ panicData, cycleScore }),
    [panicData, cycleScore],
  )

  const [selectedId, setSelectedId] = useState(null)

  const activeId = selectedId ?? rotation.primaryWatchId
  const activeSector = useMemo(
    () => rotation.sectors.find((s) => s.id === activeId) ?? null,
    [rotation.sectors, activeId],
  )

  if (loading && !rotation.ready) {
    return (
      <section className="sector-rotation" aria-label="YDS Sector Rotation">
        <p className="m-0 px-3 py-4 text-[10px] text-slate-500">섹터 로테이션 계산 중…</p>
      </section>
    )
  }

  if (!rotation.ready) {
    return (
      <section className="sector-rotation" aria-label="YDS Sector Rotation">
        <p className="m-0 px-3 py-4 text-[10px] text-slate-500">
          Cycle·패닉·채권 입력 후 섹터·종목 연결이 표시됩니다.
        </p>
      </section>
    )
  }

  return (
    <section className="sector-rotation" aria-label="YDS Sector Rotation">
      <header className="sector-rotation__head">
        <div>
          <p className="m-0 text-[9px] font-bold tracking-[0.14em] text-violet-300/85">
            YDS SECTOR ROTATION
          </p>
          <p className="m-0 mt-0.5 text-[11px] font-semibold text-slate-200">{rotation.regimeLabel}</p>
        </div>
        <p className="m-0 text-right text-[8px] leading-snug text-slate-500">
          시장 → 섹터 → 종목 → 실전
        </p>
      </header>

      <div className="sector-rotation__summary">
        <p className="m-0 sector-rotation__summary-line">
          <span className="sector-rotation__summary-label">관심</span>
          <span className="text-cyan-200/95">{rotation.watchSummary}</span>
        </p>
        <p className="m-0 sector-rotation__summary-line">
          <span className="sector-rotation__summary-label">주의</span>
          <span className="text-amber-200/90">{rotation.cautionSummary}</span>
        </p>
      </div>

      <div className="sector-rotation__legend" aria-hidden>
        {Object.entries(ROTATION_STATE_LABELS).map(([key, label]) => (
          <span key={key} className={`sector-rotation__legend-item sector-rotation-card--${key}`}>
            {label}
          </span>
        ))}
      </div>

      <div className="sector-rotation__grid" role="list">
        {rotation.sectors.map((sector) => (
          <button
            key={sector.id}
            type="button"
            role="listitem"
            onClick={() => setSelectedId(sector.id)}
            className={[
              "sector-rotation-card",
              STATE_CARD_CLASS[sector.state],
              activeId === sector.id ? "sector-rotation-card--active" : "",
            ].join(" ")}
            aria-pressed={activeId === sector.id}
          >
            <span className="sector-rotation-card__label">{sector.label}</span>
            <span className="sector-rotation-card__state">{sector.stateLabel}</span>
          </button>
        ))}
      </div>

      {activeSector && activeSector.state === "watch" ? (
        <div className="sector-rotation__picks">
          <p className="m-0 sector-rotation__picks-title">
            {activeSector.label} · 종목 후보
            {activeSector.koreaSectorId ? (
              <Link
                to={buildValueChainSectorUrl(activeSector.koreaSectorId)}
                className="ml-2 text-[9px] font-semibold text-cyan-400/90 hover:text-cyan-300"
              >
                밸류체인 →
              </Link>
            ) : null}
          </p>
          <ul className="m-0 list-none p-0">
            {activeSector.picks.map((pick) => (
              <li key={`${activeSector.id}-${pick.name}`} className="sector-rotation__pick-row">
                <span className="font-semibold text-slate-100">{pick.name}</span>
                {pick.code ? (
                  <span className="font-mono text-[9px] tabular-nums text-slate-500">{pick.code}</span>
                ) : null}
                {pick.note ? <span className="text-[9px] text-slate-500">{pick.note}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : activeSector ? (
        <p className="m-0 px-3 pb-3 text-[9px] text-slate-500">
          {activeSector.label} — {activeSector.stateLabel}
          {activeSector.reasons[0] ? ` · ${activeSector.reasons[0]}` : ""}
        </p>
      ) : null}
    </section>
  )
}
