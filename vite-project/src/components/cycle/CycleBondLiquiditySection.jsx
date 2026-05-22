import { useEffect, useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"
import { formatCurrent } from "../../macro-risk/displayMetrics.js"
import { isMacroRiskEnabled } from "../../macro-risk/featureFlag.js"
import { metricDisplayTooltip } from "../../macro-risk/metricLabels.js"
import {
  buildBondLiquidityGroups,
  bondStatusSummaryLine,
} from "../../market-os/bondLiquidityReference.js"
import { formatBondLastSyncKst, loadBondSyncMeta } from "../../macro-risk/bondSyncMeta.js"
import { slopeArrow } from "../../macro-risk/seriesMath.js"

const EXPERT_KEYS = ["REAL_YIELD", "BEI"]

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
 * @param {import("../../market-os/bondLiquidityReference.js").BondCompactLine} line
 */
function CompactMetricLine({ line }) {
  return (
    <div className="cycle-bond-compact-line">
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
  )
}

/**
 * @param {{ title: string; lines: import("../../market-os/bondLiquidityReference.js").BondCompactLine[] }} props
 */
function MetricGroup({ title, lines }) {
  if (!lines.length) return null
  return (
    <div className="cycle-bond-group">
      <p className="m-0 cycle-bond-group__title">{title}</p>
      <div className="cycle-bond-compact-grid">
        {lines.map((line) => (
          <CompactMetricLine key={line.key} line={line} />
        ))}
      </div>
    </div>
  )
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

  const groups = useMemo(
    () => buildBondLiquidityGroups(snapshot, fmtBondValue, panicData?.move),
    [snapshot, panicData?.move],
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
    <section
      id="bond-liquidity"
      className="cycle-bond-section cycle-bond-section--reference scroll-mt-24"
      aria-label="채권·유동성 참고"
    >
      <div className="cycle-bond-panel cycle-bond-panel--compact cycle-bond-panel--reference">
        <header className="cycle-bond-panel__header cycle-bond-panel__header--compact">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 cycle-bond-panel__title-ref">채권·유동성 참고</p>
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

            <div className="cycle-bond-split">
              <MetricGroup title="채권" lines={groups.bond} />
              <MetricGroup title="유동성" lines={groups.liquidity} />
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
                      const fmt = row?.format === "pct" ? "level" : row?.format ?? "rate"
                      const value =
                        row?.current != null && Number.isFinite(Number(row.current))
                          ? fmtBondValue(key, Number(row.current), fmt)
                          : "—"
                      const title = key === "REAL_YIELD" ? "REAL" : "BEI"
                      const hint = metricDisplayTooltip(key) ?? "—"

                      return (
                        <article key={key} className="cycle-bond-expert-card">
                          <p className="m-0 cycle-bond-expert-card__head">
                            <span className="font-bold text-slate-200">{title}</span>
                            <span className="font-mono tabular-nums text-slate-50">{value}</span>
                            <span className="text-slate-400">{slopeArrow(row?.slope ?? "flat")}</span>
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
