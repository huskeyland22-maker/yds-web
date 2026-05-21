import { useEffect, useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"
import { formatCurrent } from "../../macro-risk/displayMetrics.js"
import { isMacroRiskEnabled } from "../../macro-risk/featureFlag.js"
import { metricDisplayTooltip } from "../../macro-risk/metricLabels.js"
import {
  buildBondCompactLines,
  bondStatusSummaryLine,
} from "../../market-os/bondLiquidityReference.js"
import { formatBondLastSyncKst, loadBondSyncMeta } from "../../macro-risk/bondSyncMeta.js"
import { slopeArrow } from "../../macro-risk/seriesMath.js"

const EXPERT_KEYS = ["REAL_YIELD", "BEI", "MOVE"]

/**
 * @param {string} key
 * @param {number | null} n
 * @param {string} [fmt]
 */
function fmtBondValue(key, n, fmt = "rate") {
  if (n == null || !Number.isFinite(n)) return "—"
  return formatCurrent(n, fmt)
}

/**
 * @param {{
 *   basisDateTime?: string | null
 *   snapshot?: import("../../macro-risk/engine.js").MacroRiskSnapshot | null
 *   panicData?: object | null
 *   loading?: boolean
 *   syncingBond?: boolean
 *   refetchBond: () => void
 *   lastBondSyncAt?: string | null
 * }} props
 */
export default function CycleBondLiquiditySection({
  basisDateTime = null,
  snapshot = null,
  panicData = null,
  loading = false,
  syncingBond = false,
  refetchBond,
  lastBondSyncAt = null,
}) {
  const enabled = isMacroRiskEnabled()
  const [expertOpen, setExpertOpen] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#bond-liquidity") {
      setExpertOpen(true)
    }
  }, [])

  const compactLines = useMemo(
    () => buildBondCompactLines(snapshot, fmtBondValue),
    [snapshot],
  )

  const statusLine = useMemo(() => bondStatusSummaryLine(snapshot), [snapshot])

  const tierByKey = useMemo(() => {
    const rows = [...(snapshot?.tieredMetrics?.tier1 ?? []), ...(snapshot?.tieredMetrics?.tier2 ?? [])]
    return Object.fromEntries(rows.map((r) => [r.key, r]))
  }, [snapshot])

  const syncLabel = formatBondLastSyncKst(lastBondSyncAt ?? loadBondSyncMeta()?.at ?? snapshot?.updatedAt)
  const basisLine = basisDateTime ? basisDateTime.replace(/^미국장 종가 기준 · /u, "") : syncLabel

  if (!enabled) return null

  return (
    <section id="bond-liquidity" className="cycle-bond-section scroll-mt-24" aria-label="채권·유동성 요약">
      <div className="cycle-bond-panel cycle-bond-panel--compact">
        <header className="cycle-bond-panel__header cycle-bond-panel__header--compact">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 text-[12px] font-bold tracking-tight text-cyan-100/95">
                채권·유동성 요약
                <span className="ml-1.5 text-[10px] font-semibold text-cyan-300/75">참고</span>
              </p>
              <button
                type="button"
                onClick={() => refetchBond()}
                disabled={syncingBond || loading}
                className="cycle-bond-sync-btn shrink-0"
                aria-busy={syncingBond}
              >
                <RefreshCw size={11} className={syncingBond ? "animate-spin" : ""} />
                {syncingBond ? "…" : "동기화"}
              </button>
            </div>
            {basisLine && basisLine !== "—" ? (
              <p className="m-0 mt-0.5 font-mono text-[10px] font-semibold tabular-nums text-slate-300">
                {basisLine}
              </p>
            ) : null}
          </div>
        </header>

        {loading && !snapshot ? (
          <p className="m-0 cycle-bond-panel__body cycle-bond-placeholder">불러오는 중…</p>
        ) : null}

        {snapshot ? (
          <div className="cycle-bond-panel__body cycle-bond-panel__body--compact">
            <p className="m-0 cycle-bond-status-summary" role="status">
              {statusLine}
            </p>

            <div className="cycle-bond-compact-grid">
              {compactLines.map((line) => (
                <div key={line.key} className="cycle-bond-compact-line">
                  <span className="cycle-bond-compact-line__metric">{line.shortLabel}</span>
                  <span className="cycle-bond-compact-line__value font-mono tabular-nums">{line.value}</span>
                  <span
                    className={[
                      "cycle-bond-compact-line__arrow",
                      line.arrow === "↑" ? "cycle-bond-compact-line__arrow--up" : "",
                      line.arrow === "↓" ? "cycle-bond-compact-line__arrow--down" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {line.warn ? "⚠" : line.arrow}
                  </span>
                  <span className="cycle-bond-compact-line__tag">{line.tag}</span>
                </div>
              ))}
            </div>

            <div className="cycle-bond-expert">
              <button
                type="button"
                onClick={() => setExpertOpen((v) => !v)}
                className="cycle-bond-expert-toggle"
                aria-expanded={expertOpen}
              >
                <span>전문가 보기</span>
                <span className="cycle-data-basis__muted">{expertOpen ? "▲" : "▼"}</span>
              </button>
              {expertOpen ? (
                <div className="cycle-bond-expert-body">
                  <div className="cycle-bond-expert-grid">
                    {EXPERT_KEYS.map((key) => {
                      const row = tierByKey[key]
                      const fmt = row?.format === "pct" ? "level" : row?.format ?? (key === "MOVE" ? "index" : "rate")
                      let value = "—"
                      let slope = "flat"

                      if (key === "MOVE") {
                        const m = Number(panicData?.move)
                        if (Number.isFinite(m)) {
                          value = fmtBondValue("MOVE", m, "index")
                          if (m >= 120) slope = "up"
                          else if (m <= 90) slope = "down"
                        }
                      } else if (row?.current != null && Number.isFinite(Number(row.current))) {
                        value = fmtBondValue(key, Number(row.current), fmt)
                        slope = row.slope ?? "flat"
                      }

                      const title =
                        key === "REAL_YIELD" ? "REAL" : key === "BEI" ? "BEI" : "MOVE"
                      const hint = metricDisplayTooltip(key) ?? "—"

                      return (
                        <article key={key} className="cycle-bond-expert-card">
                          <p className="m-0 cycle-bond-expert-card__head">
                            <span className="font-bold text-slate-200">{title}</span>
                            <span className="font-mono tabular-nums text-slate-50">{value}</span>
                            <span className="text-slate-400">{slopeArrow(slope)}</span>
                          </p>
                          <p className="m-0 cycle-bond-expert-card__hint">{hint}</p>
                        </article>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
