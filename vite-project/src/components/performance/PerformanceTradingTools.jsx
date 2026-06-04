import PaperTradingPanel from "../trading/PaperTradingPanel.jsx"
import TradingJournalPanel from "../trading/TradingJournalPanel.jsx"

/**
 * @param {{
 *   entryRadar: import("../../trading-zone/ydsPrecursorEnginePhase27.js").buildEntryRadarFromPrecursorContext extends (...args: any) => infer R ? R : object
 *   tradingJournal: import("../../trading-zone/ydsPrecursorEnginePhase28.js").buildTradingJournalFromPrecursorContext extends (...args: any) => infer R ? R : object
 * }} props
 */
export default function PerformanceTradingTools({ entryRadar, tradingJournal }) {
  return (
    <section className="yds-perf-center__section" aria-labelledby="perf-trading-tools">
      <h2 id="perf-trading-tools" className="yds-perf-center__h2">
        트레이딩 도구
      </h2>
      <p className="yds-perf-center__note">
        시장분석 Hub에서 이동 · Paper Trading · Trading Journal (가상·기록)
      </p>
      <div className="yds-perf-tools">
        <div className="yds-perf-tools__block">
          <h3 className="yds-perf-tools__h3">Paper Trading</h3>
          <PaperTradingPanel entryRadar={entryRadar} compact />
        </div>
        <div className="yds-perf-tools__block">
          <h3 className="yds-perf-tools__h3">Trading Journal</h3>
          <TradingJournalPanel journal={tradingJournal} compact />
        </div>
      </div>
    </section>
  )
}
