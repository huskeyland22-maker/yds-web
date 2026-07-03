import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useYdsMarketContext } from "../hooks/useYdsMarketContext.js"
import { useStockPickLiveData } from "../hooks/useStockPickLiveData.js"
import {
  buildAiTrackRecordReport,
  buildTrackRecordDetail,
  filterTrackRecordRows,
  TRACK_RECORD_FILTERS,
} from "../content/ydsAiTrackRecordEngine.js"
import YdsAiTrackRecordDetailModal from "../components/stock-picks/YdsAiTrackRecordDetailModal.jsx"
import "../styles/stock-picks-platform.css"

function AnalysisTable({ title, rows, emptyLabel = "데이터 부족" }) {
  if (!rows?.length) {
    return (
      <section className="yds-track-record__analysis">
        <h3 className="yds-track-record__analysis-title">{title}</h3>
        <p className="yds-track-record__empty">{emptyLabel}</p>
      </section>
    )
  }

  return (
    <section className="yds-track-record__analysis">
      <h3 className="yds-track-record__analysis-title">{title}</h3>
      <div className="yds-track-record__analysis-scroll">
        <table className="yds-track-record__analysis-table">
          <thead>
            <tr>
              <th>구간</th>
              <th>건수</th>
              <th>승률</th>
              <th>평균 수익</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.label}</td>
                <td className="font-mono tabular-nums">{row.count}</td>
                <td className="font-mono tabular-nums">
                  {row.winRate != null ? `${row.winRate}%` : "—"}
                </td>
                <td className="font-mono tabular-nums">
                  {row.avgReturn != null ? `${row.avgReturn > 0 ? "+" : ""}${row.avgReturn}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function AiTrackRecordPage() {
  const marketContext = useYdsMarketContext()
  const { stocks: liveStocks = [] } = useStockPickLiveData(marketContext?.ready ? marketContext : null)
  const [filterId, setFilterId] = useState("all")
  const [selectedPickId, setSelectedPickId] = useState(/** @type {string | null} */ (null))

  const report = useMemo(() => buildAiTrackRecordReport(liveStocks), [liveStocks])
  const filteredRows = useMemo(
    () => filterTrackRecordRows(report.rows ?? [], filterId),
    [report.rows, filterId],
  )
  const detail = useMemo(
    () => (selectedPickId ? buildTrackRecordDetail(selectedPickId, liveStocks) : { visible: false }),
    [selectedPickId, liveStocks],
  )

  const summary = report.summary

  return (
    <div className="yds-track-record-page min-w-0 px-3 py-4 sm:px-4">
      <Link to="/stock-picks" className="yds-spick-detail__back">
        ← 종목추천
      </Link>

      <header className="yds-track-record-page__head">
        <h1 className="yds-track-record-page__title">{report.title}</h1>
        <p className="yds-track-record-page__sub">{report.subtitle}</p>
        <div className="yds-track-record-page__links">
          <Link to="/performance-validation/dashboard" className="yds-track-record-page__link">
            성과 대시보드 →
          </Link>
          <Link to="/performance-validation/picks" className="yds-track-record-page__link">
            상세 검증 →
          </Link>
          <Link to="/performance-validation" className="yds-track-record-page__link">
            종합 검증 →
          </Link>
        </div>
      </header>

      {!report.visible ? (
        <p className="yds-track-record__empty">
          저장된 추천 이력이 없습니다. 종목추천 화면을 열면 자동 기록됩니다.
        </p>
      ) : (
        <>
          {summary ? (
            <dl className="yds-track-record__summary">
              <div><dt>전체 추천</dt><dd className="font-mono tabular-nums">{summary.totalCount}건</dd></div>
              <div><dt>진행 중</dt><dd className="font-mono tabular-nums">{summary.activeCount}건</dd></div>
              <div><dt>종료</dt><dd className="font-mono tabular-nums">{summary.endedCount ?? 0}건</dd></div>
              <div><dt>평균 수익률</dt><dd className="font-mono tabular-nums">{summary.avgReturnLabel}</dd></div>
              <div><dt>승률</dt><dd className="font-mono tabular-nums">{summary.winRateLabel}</dd></div>
              <div><dt>평균 보유</dt><dd className="font-mono tabular-nums">{summary.avgHoldDaysLabel ?? "—"}</dd></div>
            </dl>
          ) : null}

          <div className="yds-track-record__filters" role="tablist" aria-label="Track Record 필터">
            {TRACK_RECORD_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filterId === f.id}
                className={[
                  "yds-track-record__filter",
                  filterId === f.id ? "yds-track-record__filter--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setFilterId(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <section className="yds-track-record__history" aria-label="추천 이력">
            <div className="yds-track-record__history-head">
              <h2>추천 이력</h2>
              <span className="font-mono tabular-nums">{filteredRows.length}건</span>
            </div>

            {!filteredRows.length ? (
              <p className="yds-track-record__empty">해당 조건의 추천 이력이 없습니다.</p>
            ) : (
              <div className="yds-track-record__table-scroll">
                <table className="yds-track-record__table">
                  <thead>
                    <tr>
                      <th>추천일</th>
                      <th>종목</th>
                      <th>추천가</th>
                      <th>현재가</th>
                      <th>수익률</th>
                      <th>경과</th>
                      <th>AI점수</th>
                      <th>추천 사유</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr
                        key={row.pickId}
                        className="yds-track-record__row"
                        tabIndex={0}
                        onClick={() => setSelectedPickId(row.pickId)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            setSelectedPickId(row.pickId)
                          }
                        }}
                      >
                        <td className="font-mono tabular-nums">{row.recommendedAtLabel}</td>
                        <td>{row.name}</td>
                        <td className="font-mono tabular-nums">{row.recommendedPriceLabel}</td>
                        <td className="font-mono tabular-nums">{row.currentPriceLabel}</td>
                        <td className={["font-mono tabular-nums", `yds-track-record__ret--${row.returnTone}`].join(" ")}>
                          {row.returnLabel}
                        </td>
                        <td className="font-mono tabular-nums">{row.elapsedLabel}</td>
                        <td className="font-mono tabular-nums">{row.aiScoreLabel ?? "—"}</td>
                        <td className="yds-track-record__reason" title={row.reasonLine}>
                          {row.reasonLine}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="yds-track-record__analysis-grid">
            <AnalysisTable title="AI 점수별 성과" rows={report.analysis?.byScore} />
            <AnalysisTable title="시장 상태별 승률" rows={report.analysis?.byMarketState} />
            <AnalysisTable title="패닉 강도별 승률" rows={report.analysis?.byPanic} />
            <AnalysisTable title="섹터별 승률" rows={report.analysis?.bySector} />
            <AnalysisTable title="국가별 승률" rows={report.analysis?.byCountry} />
          </div>
        </>
      )}

      {detail.visible ? (
        <YdsAiTrackRecordDetailModal detail={detail} onClose={() => setSelectedPickId(null)} />
      ) : null}
    </div>
  )
}
