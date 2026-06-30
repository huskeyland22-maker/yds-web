import { useMemo } from "react"
import { MARKET_LABEL_MARKET_STATE } from "../../content/ydsMarketStageLabels.js"
import { computeMarketPositionScore, resolveMarketPositionId } from "../../content/ydsMarketPositionEngine.js"
import { resolveMarketStateCenterView } from "../../content/ydsMarketStateCenter.js"
import {
  resolveUnifiedMarketStateLabel,
} from "../../content/ydsUnifiedMarketState.js"
import { buildMarketStateChangeTimeline } from "../../content/ydsMarketStateRecentChanges.js"
import { buildMarketCycleStrip, buildMarketStateInvestmentAction } from "../../content/ydsMarketStateCycleVisual.js"
import YdsMarketCycleStrip from "./YdsMarketCycleStrip.jsx"
import YdsMarketStateRecentChanges from "./YdsMarketStateRecentChanges.jsx"
import YdsMarketJudgmentCard from "./YdsMarketJudgmentCard.jsx"
import YdsTodayActionCard from "./YdsTodayActionCard.jsx"

/** @param {object[]} historyRows */
function resolveScoreDelta(historyRows, currentScore) {
  if (!Array.isArray(historyRows) || historyRows.length < 2) return 0
  const sorted = [...historyRows]
    .filter((r) => r?.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const prev = sorted[sorted.length - 2]
  const cnn = Number(prev?.fearGreed)
  const vix = Number(prev?.vix)
  const bofa = Number(prev?.bofa)
  if (!Number.isFinite(cnn) && !Number.isFinite(vix)) return 0
  const prevId = resolveMarketPositionId(
    Number.isFinite(cnn) ? cnn : null,
    Number.isFinite(vix) ? vix : null,
    Number.isFinite(bofa) ? bofa : null,
  )
  const prevScore = computeMarketPositionScore(
    Number.isFinite(cnn) ? cnn : null,
    Number.isFinite(vix) ? vix : null,
    Number.isFinite(bofa) ? bofa : null,
    prevId,
  )
  return currentScore - prevScore
}

/**
 * V7 — 시장 상태 투자 대시보드
 */
export default function YdsMarketStatePrimaryPanel({
  panicData = null,
  historyRows = [],
  cycleFlow = null,
  dualLiquidity = null,
  etfContext = null,
  className = "",
  embedded = false,
}) {
  const stateContext = useMemo(
    () => ({ etfContext, dualLiquidity }),
    [etfContext, dualLiquidity],
  )

  const view = useMemo(
    () => resolveMarketStateCenterView(panicData, stateContext),
    [panicData, stateContext],
  )

  const unifiedLabel = useMemo(
    () => resolveUnifiedMarketStateLabel(cycleFlow, view?.position?.label ?? "—"),
    [cycleFlow, view?.position?.label],
  )

  const delta = useMemo(
    () => (view ? resolveScoreDelta(historyRows, view.positionScore) : 0),
    [historyRows, view],
  )

  const timelineReport = useMemo(
    () =>
      buildMarketStateChangeTimeline(historyRows, cycleFlow, panicData, dualLiquidity, {
        etfContext,
      }),
    [historyRows, cycleFlow, panicData, dualLiquidity, etfContext],
  )

  const cycleStrip = useMemo(
    () =>
      buildMarketCycleStrip(
        unifiedLabel,
        view?.positionScore ?? timelineReport.segments.at(-1)?.snapshot?.marketScore ?? null,
      ),
    [unifiedLabel, view?.positionScore, timelineReport.segments],
  )

  const actionLines = useMemo(() => {
    const text = buildMarketStateInvestmentAction(unifiedLabel)
    return text.split("\n").filter(Boolean)
  }, [unifiedLabel])

  if (!view) return null

  const deltaSign = delta > 0 ? "▲" : delta < 0 ? "▼" : "•"
  const deltaText = `${deltaSign} ${delta >= 0 ? "+" : ""}${delta}`

  const card = (
    <div className="yds-market-state-primary yds-market-state-primary--dashboard">
      <div className="yds-market-state-primary__hero yds-market-state-primary__hero--compact">
        <p className="yds-market-state-primary__title">{MARKET_LABEL_MARKET_STATE}</p>
        <div className="yds-market-state-primary__hero-row">
          <p className="yds-market-state-primary__score font-mono tabular-nums">
            {view.positionScore}
          </p>
          <p
            className="yds-market-state-primary__zone-label"
            style={{ "--hero-color": view.position.color }}
          >
            {view.position.emoji} {unifiedLabel}
          </p>
          <p className="yds-market-state-primary__delta">
            전일 <span className="font-mono tabular-nums">{deltaText}</span>
          </p>
        </div>
      </div>

      <YdsMarketCycleStrip
        cycleStrip={cycleStrip}
        compact
        className="yds-market-state-primary__cycle"
        description={{
          label: unifiedLabel,
          lines: actionLines,
        }}
      />

      <YdsMarketStateRecentChanges
        historyRows={historyRows}
        cycleFlow={cycleFlow}
        panicData={panicData}
        dualLiquidity={dualLiquidity}
        etfContext={etfContext}
        variant="mini"
        className="yds-market-state-primary__recent-changes"
      />

      <div className="yds-market-dashboard__row">
        <YdsMarketJudgmentCard
          panicData={panicData}
          cycleFlow={cycleFlow}
          dualLiquidity={dualLiquidity}
          etfContext={etfContext}
        />
        <YdsTodayActionCard
          panicData={panicData}
          historyRows={historyRows}
          cycleFlow={cycleFlow}
          dualLiquidity={dualLiquidity}
          etfContext={etfContext}
        />
      </div>
    </div>
  )

  if (embedded) return card

  return (
    <section className={["yds-market-state-primary-wrap", className].filter(Boolean).join(" ")}>
      {card}
    </section>
  )
}
