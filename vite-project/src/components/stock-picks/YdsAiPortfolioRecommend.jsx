import { useMemo, useState } from "react"
import { useAppDataStore } from "../../store/appDataStore.js"
import { panicDataFromCycleRow } from "../../utils/cycleHistoryUtils.js"
import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"
import { buildAiPortfolioRecommendReport } from "../../content/ydsAiPortfolioEngine.js"
import { isMacroRiskEnabled } from "../../macro-risk/featureFlag.js"
import { useMacroRiskSnapshot } from "../../macro-risk/useMacroRiskSnapshot.js"
import { buildDualLiquidityReport } from "../../market-os/liquidityDualEngine.js"

/**
 * @param {{
 *   stocks?: import("../../content/ydsStockPickModel.js").StockPickView[]
 *   className?: string
 * }} props
 */
export default function YdsAiPortfolioRecommend({ stocks = [], className = "" }) {
  const [styleId, setStyleId] = useState("balanced")
  const marketContext = useYdsMarketContext()
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const panicData = useMemo(() => {
    const latest = storeRows?.[storeRows.length - 1] ?? null
    return latest ? panicDataFromCycleRow(latest) : null
  }, [storeRows])
  const macroRiskEnabled = isMacroRiskEnabled()
  const bondSnapshot = useMacroRiskSnapshot(macroRiskEnabled ? panicData : null)

  const dualLiquidity = useMemo(() => {
    if (!macroRiskEnabled) return null
    return buildDualLiquidityReport(bondSnapshot.snapshot, panicData)
  }, [macroRiskEnabled, bondSnapshot.snapshot, panicData])

  const report = useMemo(
    () =>
      buildAiPortfolioRecommendReport({
        stocks,
        marketContext: marketContext?.ready ? marketContext : null,
        dualLiquidity,
      }),
    [stocks, marketContext, dualLiquidity],
  )

  const plan = report.plans.find((p) => p.id === styleId) ?? report.plans[1]

  if (!report.visible || !plan) return null

  return (
    <section
      className={["yds-ai-portfolio", className].filter(Boolean).join(" ")}
      aria-label={report.title}
    >
      <div className="yds-ai-portfolio__head">
        <h2 className="yds-ai-portfolio__title">{report.title}</h2>
        <p className="yds-ai-portfolio__sub">
          {report.marketLabel}
          {report.panicScore != null ? ` · 패닉 ${report.panicScore}` : ""}
        </p>
      </div>

      <div className="yds-ai-portfolio__tabs" role="tablist">
        {report.plans.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={styleId === p.id}
            className={[
              "yds-ai-portfolio__tab",
              styleId === p.id ? "yds-ai-portfolio__tab--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setStyleId(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className="yds-ai-portfolio__summary">{plan.summaryLine}</p>

      <dl className="yds-ai-portfolio__alloc">
        <div>
          <dt>현금 비중</dt>
          <dd className="font-mono tabular-nums">{plan.cashPct}%</dd>
        </div>
        <div>
          <dt>주식 비중</dt>
          <dd className="font-mono tabular-nums">{plan.stockPct}%</dd>
        </div>
      </dl>

      <div className="yds-ai-portfolio__sectors">
        <p className="yds-ai-portfolio__sectors-title">섹터 비중</p>
        <ul className="yds-ai-portfolio__sector-list">
          {plan.sectorWeights.map((s) => (
            <li key={s.label} className="yds-ai-portfolio__sector-item">
              <span>{s.label}</span>
              <span className="font-mono tabular-nums">{s.pct}%</span>
            </li>
          ))}
        </ul>
      </div>

      <ol className="yds-ai-portfolio__holdings">
        {plan.holdings.map((h) => (
          <li key={h.ticker} className="yds-ai-portfolio__holding">
            <div className="yds-ai-portfolio__holding-head">
              <strong>{h.name}</strong>
              <span className="font-mono tabular-nums">{h.weightPct}%</span>
            </div>
            <p className="yds-ai-portfolio__holding-reason">{h.reason}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
