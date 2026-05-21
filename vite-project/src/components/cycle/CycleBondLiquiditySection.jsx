import { useEffect, useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"
import { formatCurrent } from "../../macro-risk/displayMetrics.js"
import { isMacroRiskEnabled } from "../../macro-risk/featureFlag.js"
import { metricDisplayLabel, metricShortLabel } from "../../macro-risk/metricLabels.js"
import { useMacroRiskSnapshot } from "../../macro-risk/useMacroRiskSnapshot.js"
import { buildMarketOsIntegrated } from "../../market-os/buildMarketOsIntegrated.js"
import { bondCoreCardHints, deriveBondLiquidityStatuses } from "../../market-os/bondLiquidityStatus.js"
import { resolveCyclePosition } from "../../market-os/positionLabels.js"
import { formatBondLastSyncKst, loadBondSyncMeta } from "../../macro-risk/bondSyncMeta.js"

const CORE_KEYS = ["US10Y", "US30Y", "DXY"]
const EXPERT_KEYS = ["REAL_YIELD", "BEI", "US2Y"]

/**
 * @param {{ panicData?: object | null; cycleScore?: number | null; basisDateTime?: string | null }} props
 */
export default function CycleBondLiquiditySection({
  panicData = null,
  cycleScore = null,
  basisDateTime = null,
}) {
  const enabled = isMacroRiskEnabled()
  const [detailOpen, setDetailOpen] = useState(false)
  const [expertOpen, setExpertOpen] = useState(false)
  const { snapshot, loading, syncingBond, refetchBond, lastBondSyncAt } = useMacroRiskSnapshot(panicData)

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#bond-liquidity") {
      setDetailOpen(true)
      setExpertOpen(true)
    }
  }, [])

  const cyclePos = useMemo(() => resolveCyclePosition(cycleScore), [cycleScore])
  const statuses = useMemo(() => deriveBondLiquidityStatuses(snapshot), [snapshot])
  const hints = useMemo(() => bondCoreCardHints(snapshot), [snapshot])
  const os = useMemo(
    () => (snapshot ? buildMarketOsIntegrated({ cycleScore, snapshot }) : null),
    [cycleScore, snapshot],
  )

  const tierByKey = useMemo(() => {
    const rows = [...(snapshot?.tieredMetrics?.tier1 ?? []), ...(snapshot?.tieredMetrics?.tier2 ?? [])]
    return Object.fromEntries(rows.map((r) => [r.key, r]))
  }, [snapshot])

  const syncLabel = formatBondLastSyncKst(lastBondSyncAt ?? loadBondSyncMeta()?.at ?? snapshot?.updatedAt)
  const basisLine = basisDateTime ? basisDateTime.replace(/^미국장 종가 기준 · /u, "") : syncLabel

  if (!enabled) return null

  return (
    <section id="bond-liquidity" className="cycle-bond-section scroll-mt-24" aria-label="채권·유동성 보조">
      <div className="cycle-bond-panel">
        <header className="cycle-bond-panel__header">
          <div className="cycle-bond-panel__accent" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <button
                type="button"
                onClick={() => setDetailOpen((v) => !v)}
                className="min-w-0 flex-1 text-left"
                aria-expanded={detailOpen}
              >
                <p className="m-0 text-[12px] font-bold tracking-tight text-cyan-100/95">
                  채권·유동성 <span className="text-[10px] font-semibold text-cyan-300/70">(보조)</span>
                  <span className="ml-1.5 text-[10px] font-normal text-slate-500">{detailOpen ? "▲" : "▼"}</span>
                </p>
              </button>
              <button
                type="button"
                onClick={() => refetchBond()}
                disabled={syncingBond || loading}
                className="cycle-bond-sync-btn shrink-0"
                aria-busy={syncingBond}
              >
                <RefreshCw size={11} className={syncingBond ? "animate-spin" : ""} />
                {syncingBond ? "동기화…" : "채권 동기화"}
              </button>
            </div>
            <p className="m-0 mt-1 text-[10px] text-slate-400">
              <span className="text-slate-500">미국장 기준</span>{" "}
              <span className="font-mono tabular-nums text-slate-300">{basisLine}</span>
            </p>
            <p className="m-0 mt-0.5 text-[9px] text-slate-500">
              Core: 10Y · 30Y · DXY
              <span className="mx-1 text-slate-600">|</span>
              전문가: REAL · BEI · 2Y
            </p>
          </div>
        </header>

        {loading && !snapshot ? (
          <p className="m-0 px-3 pb-3 text-[10px] text-slate-500">채권·유동성 불러오는 중…</p>
        ) : null}

        {snapshot ? (
          <div className="cycle-bond-panel__body">
            <div className="cycle-bond-status-lines" role="status">
              {statuses.slice(0, 3).map((s) => (
                <span key={s} className="cycle-bond-status-pill">
                  {s}
                </span>
              ))}
            </div>

            <div className="cycle-bond-core-grid">
              {CORE_KEYS.map((key) => {
                const row = tierByKey[key]
                const fmt = row?.format === "pct" ? "level" : row?.format ?? "rate"
                const value =
                  row?.current == null || !Number.isFinite(Number(row.current))
                    ? "—"
                    : formatCurrent(row.current, fmt)
                const title = metricShortLabel(key)
                return (
                  <article key={key} className="cycle-bond-core-card">
                    <p className="m-0 text-[10px] font-semibold text-slate-400">{title}</p>
                    <p className="m-0 mt-0.5 font-mono text-[16px] font-bold leading-none tabular-nums text-slate-50">
                      {value}
                    </p>
                    <p className="m-0 mt-1.5 text-[9px] font-medium leading-snug text-amber-200/90">
                      {hints[key] ?? "—"}
                    </p>
                  </article>
                )
              })}
            </div>

            {detailOpen ? (
              <div className="cycle-bond-detail-block space-y-2">
                {Number.isFinite(Number(cycleScore)) ? (
                  <p className="m-0 text-[10px] text-slate-300">
                    Cycle {Math.round(Number(cycleScore))} · {cyclePos.position}
                    <span className="text-slate-500"> → 채권·유동성 확인</span>
                  </p>
                ) : null}
                {os ? (
                  <p className="m-0 text-[10px] font-semibold text-cyan-200/90">
                    실전: {os.actionNow.today} · AI {os.actionNow.ai}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="cycle-bond-expert">
              <button
                type="button"
                onClick={() => setExpertOpen((v) => !v)}
                className="cycle-bond-expert-toggle"
                aria-expanded={expertOpen}
              >
                <span>전문가 보기</span>
                <span className="text-slate-500">{expertOpen ? "▲" : "▼"}</span>
              </button>
              {expertOpen ? (
                <div className="cycle-bond-expert-grid">
                  {EXPERT_KEYS.map((key) => {
                    const row = tierByKey[key]
                    const fmt = row?.format === "pct" ? "level" : row?.format ?? "rate"
                    const value =
                      row?.current == null || !Number.isFinite(Number(row.current))
                        ? "—"
                        : formatCurrent(row.current, fmt)
                    return (
                      <div key={key} className="cycle-bond-expert-card">
                        <p className="m-0 text-[9px] text-slate-500">{metricDisplayLabel(key)}</p>
                        <p className="m-0 font-mono text-[12px] font-semibold tabular-nums text-slate-300">
                          {value}
                        </p>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
