import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useAppDataStore } from "../store/appDataStore.js"
import { usePanicStore } from "../store/panicStore.js"
import { panicDataFromCycleRow, mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import { HISTORY_WINDOW_OPTIONS, resolveHistoryWindow } from "../utils/chartDateFormat.js"
import {
  classifyPanicScoreState,
  latestCollectedHistoryRow,
  panicAsOfDate,
  panicFreshnessNotice,
  resolveLivePanicData,
} from "../utils/panicDataFreshness.js"
import {
  PANIC_SPX_VALIDATION_SERIES_URL,
  mergeLiveHistoryIntoPanicSpxSeries,
} from "../content/ydsPanicSpxValidationSeries.js"
import MarketAnalysisDeskCore from "../components/market-analysis/MarketAnalysisDeskCore.jsx"
import YdsMarketAnalysisOpsMeta from "../components/market-analysis/YdsMarketAnalysisOpsMeta.jsx"
import YdsMarketEnvStrip from "../components/market-analysis/YdsMarketEnvStrip.jsx"
import YdsMarketTickerBar from "../components/market-analysis/YdsMarketTickerBar.jsx"

export default function CurrentMarketAnalysisPage() {
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const deskPanic = useAppDataStore((s) => s.deskResolvedPanicData)
  const hubPanic = useAppDataStore((s) => s.hubPanicMetrics)
  const storePanic = usePanicStore((s) => s.panicData)

  const history = useMemo(
    () => resolveCycleHistoryRows(mergeCycleRows(storeRows ?? [], [])),
    [storeRows],
  )
  const latestCycleRow = latestCollectedHistoryRow(history)

  const historyPanic = useMemo(() => {
    if (!latestCycleRow) return null
    const panic = panicDataFromCycleRow(latestCycleRow)
    const rowDate = String(latestCycleRow.date ?? "").slice(0, 10)
    if (panic) {
      return {
        ...latestCycleRow,
        ...panic,
        date: /^\d{4}-\d{2}-\d{2}$/.test(rowDate) ? rowDate : latestCycleRow.date,
      }
    }
    return latestCycleRow
  }, [latestCycleRow])

  const panicData = useMemo(
    () => resolveLivePanicData(historyPanic, deskPanic ?? hubPanic, storePanic),
    [historyPanic, deskPanic, hubPanic, storePanic],
  )

  const showDesk = history.length > 0 || Boolean(panicData)
  const [historyWindowId, setHistoryWindowId] = useState("3m")
  const [chartSeries, setChartSeries] = useState(/** @type {object[] | null} */ (null))
  const [chartSeriesState, setChartSeriesState] = useState("loading")
  const selectedWindow =
    HISTORY_WINDOW_OPTIONS.find((option) => option.id === historyWindowId) ??
    HISTORY_WINDOW_OPTIONS[0]

  useEffect(() => {
    let cancelled = false
    fetch(PANIC_SPX_VALIDATION_SERIES_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        if (cancelled) return
        const merged = mergeLiveHistoryIntoPanicSpxSeries(json, history)
        setChartSeries(Array.isArray(merged?.rows) ? merged.rows : [])
        setChartSeriesState("ready")
      })
      .catch(() => {
        if (cancelled) return
        setChartSeries(null)
        setChartSeriesState("error")
      })
    return () => {
      cancelled = true
    }
  }, [history])

  const chartWindow = useMemo(
    () => resolveHistoryWindow(chartSeries ?? [], selectedWindow.months),
    [chartSeries, selectedWindow.months],
  )
  const chartRangeNote = (() => {
    if (chartSeriesState === "loading") return "차트 기간을 확인하고 있습니다."
    if (chartSeriesState === "error" || chartSeries == null) return "차트 날짜를 확인하지 못했습니다."
    if (!chartWindow.seriesEnd) return "차트에 저장된 날짜가 없습니다."
    if (!chartWindow.start || !chartWindow.end) {
      return `차트 마지막 데이터 ${chartWindow.seriesEnd}. 이 기간에 표시할 데이터가 없습니다.`
    }
    return `히스토리 차트 ${chartWindow.start} ~ ${chartWindow.end}. 차트 마지막 데이터 ${chartWindow.seriesEnd}.`
  })()
  const cardAsOf = panicAsOfDate(panicData)
  const cardDateNote = cardAsOf ? `최신 카드 기준일 ${cardAsOf}.` : "최신 카드 기준일 없음."

  return (
    <div className="yds-market-analysis min-w-0 w-full">
      <header className="yds-market-analysis__header">
        <div className="yds-market-analysis__header-main">
          <div className="yds-market-analysis__title-row">
            <h1 className="yds-market-analysis__title">시장 위험 분석</h1>
            {showDesk ? <YdsMarketAnalysisOpsMeta panicData={panicData} /> : null}
          </div>
          <p className="yds-market-analysis__subtitle">
            저장된 시장 지표로 계산한 위험 지수입니다. 예시 수치는 쓰지 않습니다.
          </p>
        </div>
        <div className="yds-market-analysis__header-actions">
          <div className="yds-market-analysis__range-wrap">
            <label className="yds-market-analysis__range">
              <svg className="yds-market-analysis__range-icon" viewBox="0 0 16 16" aria-hidden>
                <rect x="2" y="3" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <path d="M2 6.5h12M5.5 2v2.5M10.5 2v2.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <select
                value={historyWindowId}
                aria-label="히스토리 차트 기간"
                aria-describedby="market-range-note"
                onChange={(event) => setHistoryWindowId(event.target.value)}
              >
                {HISTORY_WINDOW_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p id="market-range-note" className="yds-market-analysis__range-note">
              {cardDateNote} {chartRangeNote}{" "}
              {classifyPanicScoreState(panicData) === "LIVE"
                ? "위 위험 점수는 수집된 최신 스냅샷이며 이 기간으로 바뀌지 않습니다."
                : `${panicFreshnessNotice(classifyPanicScoreState(panicData))} 기간 선택은 히스토리 차트만 바꿉니다.`}
            </p>
          </div>
          <Link to="/ai-daily-report" className="yds-ai-cta yds-market-analysis__ai-cta">
            AI 시장 리포트
          </Link>
        </div>
      </header>

      <YdsMarketEnvStrip className="yds-market-analysis__env" panicData={panicData} />
      <YdsMarketTickerBar className="yds-market-analysis__ticker" />

      {!showDesk ? (
        <div className="yds-market-analysis__loading" role="status" aria-live="polite">
          <span className="yds-market-analysis__loading-dot" aria-hidden />
          시장 지표를 동기화하고 있습니다. 잠시만 기다려 주세요.
        </div>
      ) : (
        <div className="yds-market-analysis__body">
          <MarketAnalysisDeskCore
            panicData={panicData}
            cycleMetricHistory={history}
            historyWindowMonths={selectedWindow.months}
          />
        </div>
      )}
    </div>
  )
}
