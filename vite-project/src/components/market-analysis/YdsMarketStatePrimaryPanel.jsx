import { useMemo } from "react"
import { Link } from "react-router-dom"
import { MARKET_LABEL_MARKET_STATE } from "../../content/ydsMarketStageLabels.js"
import { resolveMarketStateCenterView } from "../../content/ydsMarketStateCenter.js"
import { buildMarketPositionTimeline } from "../../content/ydsMarketPositionTimeline.js"
import YdsMarketStateTimeline from "./YdsMarketStateTimeline.jsx"
import { buildLiquidityEnvironmentCard } from "../../market-os/liquidityEnvironment.js"

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function metricRow(snapshot, key) {
  const rows = [
    ...(snapshot?.tieredMetrics?.tier1 ?? []),
    ...(snapshot?.tieredMetrics?.tier2 ?? []),
  ]
  return rows.find((row) => row.key === key) ?? null
}

function buildMarketStateDrivers(historyRows, panicData, snapshot) {
  const current = historyRows?.[historyRows.length - 1] ?? panicData ?? null
  const prev = historyRows?.length > 1 ? historyRows[historyRows.length - 2] : null
  const liquidity = buildLiquidityEnvironmentCard(snapshot, panicData, () => "—")
  const us10y = metricRow(snapshot, "US10Y")
  const cnnCurrent = toNum(current?.fearGreed)
  const cnnPrev = toNum(prev?.fearGreed)
  const vixCurrent = toNum(current?.vix)
  const vixPrev = toNum(prev?.vix)

  /** @type {{ tone: "plus" | "minus"; text: string }[]} */
  const drivers = []

  if (vixCurrent != null && vixPrev != null) {
    if (vixCurrent < vixPrev) drivers.push({ tone: "plus", text: "VIX 하락" })
    if (vixCurrent > vixPrev) drivers.push({ tone: "minus", text: "VIX 상승" })
  }

  if (us10y?.change1D != null) {
    if (us10y.change1D < 0) drivers.push({ tone: "plus", text: "10Y 금리 하락" })
    if (us10y.change1D > 0) drivers.push({ tone: "minus", text: "10Y 금리 상승" })
  }

  if (liquidity?.verdict?.label) {
    const tone = liquidity.verdict.id === "favorable" ? "plus" : liquidity.verdict.id === "alert" ? "minus" : null
    if (tone) drivers.push({ tone, text: `유동성 점수 ${liquidity.verdict.label}` })
  }

  if (cnnCurrent != null && cnnPrev != null) {
    if (cnnCurrent < cnnPrev) drivers.push({ tone: "minus", text: "CNN 공포 확대" })
    if (cnnCurrent > cnnPrev) drivers.push({ tone: "plus", text: "CNN 공포 완화" })
  }

  return drivers.slice(0, 5)
}

/**
 * V7 — 시장 상태 메인 카드 (70~80% 폭)
 * @param {{ panicData?: object | null; historyRows?: object[]; snapshot?: import("../../macro-risk/engine.js").MacroRiskSnapshot | null; className?: string; embedded?: boolean }} props
 */
export default function YdsMarketStatePrimaryPanel({
  panicData = null,
  historyRows = [],
  snapshot = null,
  className = "",
  embedded = false,
}) {
  const view = useMemo(() => resolveMarketStateCenterView(panicData), [panicData])
  const timeline = useMemo(
    () => buildMarketPositionTimeline(historyRows, 4),
    [historyRows],
  )
  const drivers = useMemo(
    () => buildMarketStateDrivers(historyRows, panicData, snapshot),
    [historyRows, panicData, snapshot],
  )

  if (!view) return null

  const pickPublicLabel = Number.isFinite(view.pickLimit)
    ? `${view.pickLimitLabel} 공개`
    : "전체 공개"

  const card = (
    <div className="yds-market-state-primary yds-market-state-primary--v7">
      <div className="yds-market-state-primary__hero">
        <p className="yds-market-state-primary__title">{MARKET_LABEL_MARKET_STATE}</p>
        <p className="yds-market-state-primary__score font-mono tabular-nums">
          {view.positionScore}
        </p>
        <p
          className="yds-market-state-primary__zone-label"
          style={{ "--hero-color": view.position.color }}
        >
          {view.position.emoji} {view.position.label}구간
        </p>
      </div>

      <article className="yds-market-state-primary__strategy" aria-label="현재 전략">
        <p className="yds-market-state-primary__layer-tag">현재 전략</p>
        <ul className="yds-market-state-primary__actions">
          {view.actions.map((item) => (
            <li key={item} className="yds-market-state-primary__action-item">
              ✓ {item}
            </li>
          ))}
        </ul>
      </article>

      <div className="yds-market-state-primary__pick-bridge">
        <p className="yds-market-state-primary__pick-line">
          {view.position.label}구간 · <strong>{pickPublicLabel}</strong>
        </p>
        <Link to="/stock-picks" className="yds-market-state-primary__pick-link">
          종목추천 보기 →
        </Link>
      </div>

      <YdsMarketStateTimeline steps={timeline} />

      {drivers.length ? (
        <article className="yds-market-state-primary__drivers" aria-label="시장 상태 Driver">
          <p className="yds-market-state-primary__layer-tag">시장 상태 Driver</p>
          <p className="yds-market-state-primary__drivers-title">
            왜 현재 시장 상태가 <strong>{view.positionScore}</strong>인지
          </p>
          <ul className="yds-market-state-primary__drivers-list">
            {drivers.map((driver) => (
              <li
                key={`${driver.tone}:${driver.text}`}
                className={`yds-market-state-primary__driver-item yds-market-state-primary__driver-item--${driver.tone}`}
              >
                {driver.tone === "plus" ? "+" : "-"} {driver.text}
              </li>
            ))}
          </ul>
        </article>
      ) : null}
    </div>
  )

  if (embedded) return card

  return (
    <section className={["yds-market-state-primary-wrap", className].filter(Boolean).join(" ")}>
      {card}
    </section>
  )
}
