import { useMemo } from "react"
import { formatCurrent } from "../../macro-risk/displayMetrics.js"
import { isMacroRiskEnabled } from "../../macro-risk/featureFlag.js"
import { hasBondLiquiditySpotCache, getBondLiquiditySpotCache } from "../../macro-risk/bondLiquiditySpotCache.js"
import {
  bondDataDelayed,
  buildBondLiquidityGroups,
  bondStatusSummaryLine,
} from "../../market-os/bondLiquidityReference.js"
import { resolveMarketUpdateTime } from "../../utils/marketUpdateTime.js"
const EXPERT_KEYS = ["REAL_YIELD", "BEI"]

const PANEL_TITLE = "장기 참고 지표 (미국장 종가 기준)"

/** @type {Record<string, string>} */
const EXPERT_TAG = {
  REAL_YIELD: "실질금리",
  BEI: "인플레 기대",
}

/**
 * @param {string} key
 * @param {number | null} n
 * @param {string} [fmt]
 */
function fmtBondValue(key, n, fmt = "rate") {
  if (n == null || !Number.isFinite(n)) return "—"
  if ((key === "US10Y" || key === "US30Y" || key === "US2Y") && n <= 0.05) return "데이터 없음"
  return formatCurrent(n, fmt)
}

/**
 * @param {import("../../market-os/bondLiquidityReference.js").BondCompactLine} line
 */
function CompactMetricLine({ line }) {
  return (
    <div className="cycle-bond-compact-line">
      <span className="cycle-bond-compact-line__metric">{line.shortLabel}</span>
      <span
        className={[
          "cycle-bond-compact-line__value font-mono tabular-nums",
          line.missing ? "cycle-bond-compact-line__value--missing" : "",
          line.stale ? "cycle-bond-compact-line__value--stale" : "",
          line.failed ? "cycle-bond-compact-line__value--failed" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {line.value}
      </span>
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
 * @param {Record<string, object>} tierByKey
 * @param {(key: string, n: number | null, fmt?: string) => string} formatValue
 * @returns {import("../../market-os/bondLiquidityReference.js").BondCompactLine[]}
 */
function buildExpertCompactLines(tierByKey, formatValue) {
  return EXPERT_KEYS.map((key) => {
    const row = tierByKey[key]
    const fmt = row?.format === "pct" ? "level" : row?.format ?? "rate"
    const live = row?.current != null && Number.isFinite(Number(row.current)) ? Number(row.current) : null
    const cached = live == null ? getBondLiquiditySpotCache(key) : null
    const n = live ?? cached
    const fromCache = live == null && cached != null
    const slope = row?.slope ?? "flat"
    const arrow = slope === "up" ? "↑" : slope === "down" ? "↓" : "→"
    const base = n != null ? formatValue(key, n, fmt) : "—"

    return {
      key,
      shortLabel: key === "REAL_YIELD" ? "REAL" : "BEI",
      value: fromCache ? `${base} (최근 저장값)` : base,
      arrow,
      warn: false,
      tag: EXPERT_TAG[key] ?? key,
      missing: n == null,
      stale: fromCache,
    }
  })
}

/**
 * @param {{
 *   snapshot?: import("../../macro-risk/engine.js").MacroRiskSnapshot | null
 *   panicData?: object | null
 *   loading?: boolean
 *   fetchFailed?: boolean
 *   timedOut?: boolean
 *   error?: string | null
 *   variant?: "default" | "desk"
 * }} props
 */
export default function CycleBondLiquiditySection({
  snapshot = null,
  panicData = null,
  loading = false,
  fetchFailed = false,
  timedOut = false,
  error = null,
  variant = "default",
}) {
  const enabled = isMacroRiskEnabled()
  const isDesk = variant === "desk"

  const marketUpdateTime = useMemo(() => resolveMarketUpdateTime(panicData), [panicData])

  const groups = useMemo(
    () => buildBondLiquidityGroups(snapshot, fmtBondValue, panicData?.move),
    [snapshot, panicData?.move],
  )

  const tierByKey = useMemo(() => {
    const rows = [...(snapshot?.tieredMetrics?.tier1 ?? []), ...(snapshot?.tieredMetrics?.tier2 ?? [])]
    return Object.fromEntries(rows.map((r) => [r.key, r]))
  }, [snapshot])

  const expertLines = useMemo(() => buildExpertCompactLines(tierByKey, fmtBondValue), [tierByKey])

  const bondLines = useMemo(() => [...groups.bond, ...expertLines], [groups.bond, expertLines])

  const statusLine = useMemo(() => bondStatusSummaryLine(snapshot), [snapshot])

  const hasFallback =
    hasBondLiquiditySpotCache() || Number.isFinite(Number(panicData?.move))
  const showInitialLoading = loading && !snapshot && !hasFallback
  const showBody = !showInitialLoading

  const dataDelayed = useMemo(
    () => fetchFailed || timedOut || Boolean(error) || bondDataDelayed(snapshot),
    [fetchFailed, timedOut, error, snapshot],
  )

  if (!enabled) return null

  return (
    <section
      id="bond-liquidity"
      className={[
        "cycle-bond-section",
        "cycle-bond-section--reference",
        isDesk ? "cycle-bond-section--desk" : "",
        "scroll-mt-24",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={isDesk ? "채권 · 유동성" : PANEL_TITLE}
    >
      <div
        className={[
          "cycle-bond-panel",
          "cycle-bond-panel--compact",
          "cycle-bond-panel--reference",
          isDesk ? "cycle-bond-panel--desk" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {!isDesk ? (
          <header className="cycle-bond-panel__header cycle-bond-panel__header--compact">
            <div className="min-w-0 flex-1">
              <p className="m-0 cycle-bond-panel__title-ref">{PANEL_TITLE}</p>
              <div className="mt-0.5">
                <p className="m-0 text-[9px] font-medium text-slate-500">{marketUpdateTime.basisNote}</p>
                <p className="m-0 font-mono text-[10px] font-semibold tabular-nums text-slate-300">
                  {marketUpdateTime.kstLabel ?? "—"}
                </p>
              </div>
            </div>
          </header>
        ) : (
          <p className="m-0 cycle-bond-panel__desk-meta">
            <span className="cycle-bond-panel__desk-meta-note">{marketUpdateTime.basisNote}</span>
            <span className="cycle-bond-panel__desk-meta-time font-mono tabular-nums">
              {marketUpdateTime.kstLabel ?? "—"}
            </span>
          </p>
        )}

        {showInitialLoading ? (
          <p className="m-0 cycle-bond-panel__body cycle-bond-placeholder" role="status">
            불러오는 중…
          </p>
        ) : null}

        {showBody ? (
          <div className="cycle-bond-panel__body cycle-bond-panel__body--compact">
            {dataDelayed ? (
              <p className="m-0 cycle-bond-delay-hint" role="status">
                ⚠ 실시간 데이터 지연
              </p>
            ) : null}
            <p className="m-0 cycle-bond-status-summary" role="status">
              {statusLine}
            </p>

            <div className="cycle-bond-split">
              <MetricGroup title="채권" lines={bondLines} />
              <MetricGroup title="유동성" lines={groups.liquidity} />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
