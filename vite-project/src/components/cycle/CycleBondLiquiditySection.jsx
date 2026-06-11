import { useEffect, useMemo, useRef } from "react"
import { formatCurrent } from "../../macro-risk/displayMetrics.js"
import { isMacroRiskEnabled } from "../../macro-risk/featureFlag.js"
import {
  bondStatusSummaryLine,
  buildLiquidityMetricLines,
  resolveBondCoreUiState,
} from "../../market-os/bondLiquidityReference.js"
import { resolveMarketUpdateTime } from "../../utils/marketUpdateTime.js"

const PANEL_TITLE = "장기 참고 지표 (미국장 종가 기준)"

/**
 * @param {string} key
 * @param {number | null} n
 * @param {string} [fmt]
 */
function fmtBondValue(key, n, fmt = "rate") {
  if (n == null || !Number.isFinite(n)) return "—"
  if ((key === "US10Y" || key === "US30Y" || key === "US2Y") && n <= 0.05) return "—"
  return formatCurrent(n, fmt)
}

/** @param {{ text: string }} props */
function BondStatusBadge({ text }) {
  return (
    <p className="m-0 cycle-bond-status-badge" role="status">
      {text}
    </p>
  )
}

/**
 * @param {import("../../market-os/bondLiquidityReference.js").BondCoreMetricLine} line
 */
function BondCoreMetricRow({ line }) {
  return (
    <div className="cycle-bond-core-line">
      <span className="cycle-bond-core-line__label">{line.label}</span>
      <span
        className={[
          "cycle-bond-core-line__value font-mono tabular-nums",
          line.stale ? "cycle-bond-core-line__value--stale" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {line.value}
      </span>
      {line.warn ? (
        <span className="cycle-bond-core-line__warn" aria-hidden>
          ⚠
        </span>
      ) : line.arrow ? (
        <span
          className={[
            "cycle-bond-core-line__arrow",
            line.arrow === "↑" ? "cycle-bond-core-line__arrow--up" : "",
            line.arrow === "↓" ? "cycle-bond-core-line__arrow--down" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden
        >
          {line.arrow}
        </span>
      ) : null}
    </div>
  )
}

/**
 * @param {import("../../market-os/bondLiquidityReference.js").BondCompactLine} line
 */
function LiquidityMetricRow({ line }) {
  const showArrow = line.arrow === "↑" || line.arrow === "↓"
  return (
    <div className="cycle-bond-core-line">
      <span className="cycle-bond-core-line__label">{line.shortLabel}</span>
      <span
        className={[
          "cycle-bond-core-line__value font-mono tabular-nums",
          line.stale ? "cycle-bond-core-line__value--stale" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {line.value}
      </span>
      {line.warn ? (
        <span className="cycle-bond-core-line__warn" aria-hidden>
          ⚠
        </span>
      ) : showArrow ? (
        <span
          className={[
            "cycle-bond-core-line__arrow",
            line.arrow === "↑" ? "cycle-bond-core-line__arrow--up" : "",
            line.arrow === "↓" ? "cycle-bond-core-line__arrow--down" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden
        >
          {line.arrow}
        </span>
      ) : null}
      <span className="cycle-bond-core-line__tag">{line.tag}</span>
    </div>
  )
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
  const lastLoggedPhaseRef = useRef(null)

  const marketUpdateTime = useMemo(() => resolveMarketUpdateTime(panicData), [panicData])

  const bondCore = useMemo(
    () =>
      resolveBondCoreUiState({
        loading,
        fetchFailed,
        error,
        timedOut,
        snapshot,
        formatValue: fmtBondValue,
      }),
    [loading, fetchFailed, error, timedOut, snapshot],
  )

  const liquidityLines = useMemo(
    () => buildLiquidityMetricLines(snapshot, fmtBondValue, panicData?.move),
    [snapshot, panicData?.move],
  )

  const statusLine = useMemo(() => bondStatusSummaryLine(snapshot), [snapshot])

  useEffect(() => {
    if (loading || bondCore.phase === "ready" || bondCore.phase === "collecting") {
      lastLoggedPhaseRef.current = null
      return
    }
    if (lastLoggedPhaseRef.current === bondCore.phase) return
    lastLoggedPhaseRef.current = bondCore.phase

    const bondErrors = snapshot?.bondCollection?.errors ?? []
    const payload = {
      fetchFailed,
      timedOut,
      error,
      liveFetchOk: snapshot?.liveDataStatus?.liveFetchOk,
      bondErrors,
      bondAsOfNy: snapshot?.bondAsOfNy ?? null,
    }

    if (bondCore.phase === "fetch_failed") {
      console.warn("[bond-liquidity] 채권 데이터 수집 실패", payload)
      return
    }

    console.warn("[bond-liquidity] 채권 데이터 없음 (미수신)", payload)
  }, [loading, bondCore.phase, fetchFailed, timedOut, error, snapshot])

  if (!enabled) return null

  return (
    <section
      id="bond-liquidity"
      className={[
        "cycle-bond-section",
        "cycle-bond-section--reference",
        "cycle-bond-section--always-open",
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
          "cycle-bond-panel--always-open",
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

        <div className="cycle-bond-panel__body cycle-bond-panel__body--compact">
          {bondCore.phase === "ready" ? (
            <p className="m-0 cycle-bond-status-summary" role="status">
              {statusLine}
            </p>
          ) : null}

          <div className="cycle-bond-split">
            <div className="cycle-bond-group">
              <p className="m-0 cycle-bond-group__title">채권</p>
              {bondCore.phase === "ready" ? (
                <div className="cycle-bond-core-grid">
                  {bondCore.lines.map((line) => (
                    <BondCoreMetricRow key={line.key} line={line} />
                  ))}
                </div>
              ) : bondCore.badge ? (
                <BondStatusBadge text={bondCore.badge} />
              ) : null}
            </div>

            {liquidityLines.length > 0 ? (
              <div className="cycle-bond-group">
                <p className="m-0 cycle-bond-group__title">유동성</p>
                <div className="cycle-bond-core-grid">
                  {liquidityLines.map((line) => (
                    <LiquidityMetricRow key={line.key} line={line} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
