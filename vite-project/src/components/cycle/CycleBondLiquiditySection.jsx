import { useEffect, useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"
import { formatCurrent } from "../../macro-risk/displayMetrics.js"
import { isMacroRiskEnabled } from "../../macro-risk/featureFlag.js"
import { metricDisplayLabel, metricShortLabel } from "../../macro-risk/metricLabels.js"
import { useMacroRiskSnapshot } from "../../macro-risk/useMacroRiskSnapshot.js"
import { buildMarketOsIntegrated } from "../../market-os/buildMarketOsIntegrated.js"
import { bondCoreCardHints, deriveBondLiquidityStatuses } from "../../market-os/bondLiquidityStatus.js"
import { BOND_MONITOR_SHORT, BOND_MONITOR_SUBTITLE } from "../../market-os/bondMonitorLabels.js"
import { resolveCyclePosition } from "../../market-os/positionLabels.js"
import { formatBondLastSyncKst, loadBondSyncMeta } from "../../macro-risk/bondSyncMeta.js"

const CORE_KEYS = ["US10Y", "US30Y", "DXY"]
const EXPERT_KEYS = ["REAL_YIELD", "BEI", "US2Y"]

/**
 * @param {{ panicData?: object | null; cycleScore?: number | null }} props
 */
export default function CycleBondLiquiditySection({ panicData = null, cycleScore = null }) {
  const enabled = isMacroRiskEnabled()
  const [sectionOpen, setSectionOpen] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#bond-liquidity") {
      setSectionOpen(true)
    }
  }, [])
  const [expertOpen, setExpertOpen] = useState(false)
  const { snapshot, loading, syncingBond, refetchBond, lastBondSyncAt } = useMacroRiskSnapshot(panicData)

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

  const bondLinkLines = useMemo(() => {
    if (!snapshot) return []
    const lines = []
    if (Number.isFinite(Number(cycleScore))) lines.push(`Cycle ${Math.round(Number(cycleScore))} · ${cyclePos.position}`)
    else lines.push(`Cycle · ${cyclePos.position}`)
    lines.push("채권·유동성 확인")
    const us10 = tierByKey.US10Y
    const us30 = tierByKey.US30Y
    if (us10?.slope === "up") lines.push("10Y 상승")
    if (Number.isFinite(Number(us30?.current)) && Number(us30.current) > 5) lines.push("30Y > 5")
    return lines
  }, [snapshot, cycleScore, cyclePos.position, tierByKey])

  const syncLabel = formatBondLastSyncKst(lastBondSyncAt ?? loadBondSyncMeta()?.at ?? snapshot?.updatedAt)

  if (!enabled) return null

  return (
    <section id="bond-liquidity" className="cycle-bond-section scroll-mt-20">
      <button
        type="button"
        onClick={() => setSectionOpen((v) => !v)}
        className="flex w-full min-h-[2.5rem] items-center justify-between gap-2 rounded-md border border-amber-500/25 bg-amber-500/[0.06] px-2.5 py-2 text-left"
        aria-expanded={sectionOpen}
      >
        <span className="min-w-0">
          <span className="block text-[11px] font-bold text-amber-100/95">채권·유동성 (보조)</span>
          {!sectionOpen ? (
            <span className="mt-0.5 block truncate text-[9px] text-slate-500">
              {statuses.slice(0, 2).join(" · ") || BOND_MONITOR_SUBTITLE}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-[10px] text-slate-400">{sectionOpen ? "▲" : "▼"}</span>
      </button>

      {sectionOpen ? (
        <div className="mt-1.5 space-y-2 rounded-md border border-white/[0.06] bg-black/20 px-2 py-2 sm:px-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-[9px] text-slate-500">
              {BOND_MONITOR_SHORT} · 마지막 갱신 {syncLabel}
            </p>
            <button
              type="button"
              onClick={() => refetchBond()}
              disabled={syncingBond || loading}
              className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-100/90 disabled:opacity-50"
            >
              <RefreshCw size={10} className={syncingBond ? "animate-spin" : ""} />
              {syncingBond ? "동기화…" : "채권 동기화"}
            </button>
          </div>

          {loading && !snapshot ? (
            <p className="m-0 text-[10px] text-slate-500">채권·유동성 불러오는 중…</p>
          ) : null}

          {snapshot ? (
            <>
              {bondLinkLines.length > 0 ? (
                <div className="rounded border border-indigo-500/20 bg-indigo-500/[0.06] px-2 py-1.5 text-[10px] leading-snug text-slate-200">
                  {bondLinkLines.map((line) => (
                    <p key={line} className="m-0">
                      {line}
                    </p>
                  ))}
                  {os ? (
                    <p className="m-0 mt-1 font-semibold text-cyan-200/90">
                      실전: {os.actionNow.today} · AI {os.actionNow.ai}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <ul className="m-0 flex list-none flex-wrap gap-1 p-0">
                {statuses.slice(0, 4).map((s) => (
                  <li
                    key={s}
                    className="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-100/90"
                  >
                    {s}
                  </li>
                ))}
              </ul>

              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                {CORE_KEYS.map((key) => {
                  const row = tierByKey[key]
                  const fmt = row?.format === "pct" ? "level" : row?.format ?? "rate"
                  const value =
                    row?.current == null || !Number.isFinite(Number(row.current))
                      ? "—"
                      : formatCurrent(row.current, fmt)
                  const title = metricShortLabel(key)
                  return (
                    <article
                      key={key}
                      className="rounded-md border border-white/[0.08] bg-[#070a10] px-2 py-2"
                    >
                      <p className="m-0 text-[10px] font-semibold text-slate-300">{title}</p>
                      <p className="m-0 mt-0.5 font-mono text-[15px] font-bold tabular-nums text-slate-50">
                        {value}
                      </p>
                      <p className="m-0 mt-1 text-[9px] font-medium text-amber-200/85">{hints[key] ?? "—"}</p>
                    </article>
                  )
                })}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setExpertOpen((v) => !v)}
                  className="flex w-full items-center justify-between rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-left"
                >
                  <span className="text-[10px] font-semibold text-slate-400">전문가 보기 {expertOpen ? "▲" : "▼"}</span>
                </button>
                {expertOpen ? (
                  <div className="mt-1.5 grid grid-cols-1 gap-1 sm:grid-cols-3">
                    {EXPERT_KEYS.map((key) => {
                      const row = tierByKey[key]
                      const fmt = row?.format === "pct" ? "level" : row?.format ?? "rate"
                      const value =
                        row?.current == null || !Number.isFinite(Number(row.current))
                          ? "—"
                          : formatCurrent(row.current, fmt)
                      return (
                        <div
                          key={key}
                          className="rounded border border-white/[0.05] bg-black/30 px-2 py-1.5 opacity-90"
                        >
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
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
