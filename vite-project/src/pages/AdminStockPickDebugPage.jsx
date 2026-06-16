import { Link } from "react-router-dom"
import { useStockPickLiveData } from "../hooks/useStockPickLiveData.js"
import { useYdsMarketContext } from "../hooks/useYdsMarketContext.js"

function DebugMetric({ label, value }) {
  return (
    <div className="yds-admin__metric">
      <span className="yds-admin__metric-key">{label}</span>
      <strong className="yds-admin__metric-val">{String(value ?? "—")}</strong>
    </div>
  )
}

export default function AdminStockPickDebugPage() {
  const marketContext = useYdsMarketContext()
  const {
    allStocks,
    loadStats,
    pipelineDebug,
    loading,
    refreshing,
    fromCache,
    errors,
    lastSyncAt,
  } = useStockPickLiveData(marketContext)

  return (
    <div className="yds-admin min-w-0 px-3 py-3 sm:px-4">
      <header className="yds-admin__header">
        <div>
          <p className="yds-admin__kicker">YDS Operations</p>
          <h1 className="yds-admin__title">Stock Picks Debug</h1>
          <p className="yds-admin__sub">사용자 화면 비노출 · 운영자 전용</p>
        </div>
        <div className="yds-admin__header-actions">
          <Link to="/admin" className="yds-admin__link">
            /admin
          </Link>
          <Link to="/stock-picks" className="yds-admin__link">
            /stock-picks
          </Link>
        </div>
      </header>

      <section className="yds-admin__section">
        <div className="yds-admin__section-head">
          <h2 className="yds-admin__section-title">Pipeline</h2>
        </div>
        <div className="yds-admin__grid yds-admin__grid--6">
          <DebugMetric label="Raw US" value={pipelineDebug.rawUs} />
          <DebugMetric label="Raw KR" value={pipelineDebug.rawKr} />
          <DebugMetric label="Scored" value={pipelineDebug.scored} />
          <DebugMetric label="Filtered" value={pipelineDebug.filtered} />
          <DebugMetric label="Fetch Err" value={pipelineDebug.fetchErrors} />
          <DebugMetric label="Fallback" value={pipelineDebug.fallbackAfterScore} />
        </div>
      </section>

      <section className="yds-admin__section">
        <div className="yds-admin__section-head">
          <h2 className="yds-admin__section-title">Runtime Status</h2>
        </div>
        <div className="yds-admin__grid yds-admin__grid--4">
          <DebugMetric label="Loading" value={loading ? "yes" : "no"} />
          <DebugMetric label="Refreshing" value={refreshing ? "yes" : "no"} />
          <DebugMetric label="Cache Status" value={fromCache ? "cache" : "live"} />
          <DebugMetric label="Last Sync" value={lastSyncAt ?? "—"} />
          <DebugMetric label="US Live" value={loadStats.live.US} />
          <DebugMetric label="KR Live" value={loadStats.live.KR} />
          <DebugMetric label="Total Live" value={loadStats.totalLive} />
          <DebugMetric label="Missing" value={loadStats.totalMissing} />
        </div>
      </section>

      <section className="yds-admin__section">
        <div className="yds-admin__section-head">
          <h2 className="yds-admin__section-title">API Response</h2>
        </div>
        <pre className="yds-admin__api-row" style={{ whiteSpace: "pre-wrap" }}>
          {JSON.stringify(
            {
              errors,
              sample: allStocks.slice(0, 10).map((row) => ({
                ticker: row.ticker,
                country: row.country,
                dataSource: row.dataSource,
                quoteSource: row.quoteSource,
              })),
            },
            null,
            2,
          )}
        </pre>
      </section>
    </div>
  )
}

