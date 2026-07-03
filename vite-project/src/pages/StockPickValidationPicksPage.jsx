import { useMemo } from "react"
import { Link } from "react-router-dom"
import { useYdsMarketContext } from "../hooks/useYdsMarketContext.js"
import { useStockPickLiveData } from "../hooks/useStockPickLiveData.js"
import { buildValidationPickListReport } from "../content/ydsPickValidationDetailEngine.js"
import "../styles/stock-picks-platform.css"

export default function StockPickValidationPicksPage() {
  const marketContext = useYdsMarketContext()
  const { stocks: liveStocks = [] } = useStockPickLiveData(marketContext?.ready ? marketContext : null)
  const report = useMemo(() => buildValidationPickListReport(liveStocks), [liveStocks])

  return (
    <div className="yds-spick-validation-page min-w-0 px-3 py-4 sm:px-4">
      <Link to="/stock-picks" className="yds-spick-detail__back">
        ← 종목추천
      </Link>
      <header className="yds-spick-validation-page__head">
        <h1 className="yds-spick-validation-page__title">{report.title}</h1>
        <p className="yds-spick-validation-page__sub">
          추천 종목별 상세 검증 · AI 신뢰성 확인
        </p>
        <div className="yds-spick-validation-page__links">
          <Link to="/performance-validation/track-record" className="yds-spick-validation-page__link">
            Track Record →
          </Link>
          <Link to="/performance-validation/backtest" className="yds-spick-validation-page__link">
            백테스트 →
          </Link>
          <Link to="/performance-validation" className="yds-spick-validation-page__link">
            종합 검증 →
          </Link>
        </div>
      </header>

      {!report.visible ? (
        <p className="yds-spick-empty">저장된 추천 기록이 없습니다. 종목추천 화면을 열면 자동 기록됩니다.</p>
      ) : (
        <div className="yds-spick-validation-page__table-wrap">
          <table className="yds-spick-validation-page__table">
            <thead>
              <tr>
                <th>추천일</th>
                <th>종목</th>
                <th>추천 AI점수</th>
                <th>수익률</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.pickId}>
                  <td className="font-mono tabular-nums">{row.recommendedAt}</td>
                  <td>{row.name}</td>
                  <td className="font-mono tabular-nums">{row.recommendedScore ?? "—"}</td>
                  <td className="font-mono tabular-nums">{row.returnLabel}</td>
                  <td>
                    <Link
                      to={`/performance-validation/pick/${encodeURIComponent(row.pickId)}`}
                      className="yds-spick-validation-page__detail-link"
                    >
                      상세 검증 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
