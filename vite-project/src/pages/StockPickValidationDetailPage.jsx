import { useMemo } from "react"
import { Link, useParams } from "react-router-dom"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useYdsMarketContext } from "../hooks/useYdsMarketContext.js"
import { useStockPickLiveData } from "../hooks/useStockPickLiveData.js"
import {
  buildPickValidationDetailReport,
  findValidationPickById,
} from "../content/ydsPickValidationDetailEngine.js"
import "../styles/stock-picks-platform.css"

function MiniLineChart({ data, dataKey, color = "#38bdf8", suffix = "" }) {
  if (!data?.length) return <p className="yds-spick-empty">차트 데이터 없음</p>
  return (
    <div className="yds-spick-validation-chart">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(100,116,139,0.2)" strokeDasharray="3 3" />
          <XAxis dataKey="axisLabel" tick={{ fontSize: 10, fill: "#64748b" }} />
          <YAxis tick={{ fontSize: 10, fill: "#64748b" }} width={36} />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontSize: 11 }}
            formatter={(v) => [`${v}${suffix}`, ""]}
          />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function StockPickValidationDetailPage() {
  const { pickId = "" } = useParams()
  const marketContext = useYdsMarketContext()
  const { liveStocks } = useStockPickLiveData(marketContext?.ready ? marketContext : null)
  const pick = useMemo(() => findValidationPickById(pickId), [pickId])
  const liveStock = useMemo(
    () => liveStocks.find((s) => s.ticker.toUpperCase() === String(pick?.ticker ?? "").toUpperCase()) ?? null,
    [liveStocks, pick],
  )
  const report = useMemo(
    () => (pick ? buildPickValidationDetailReport(pick, liveStock) : { visible: false }),
    [pick, liveStock],
  )

  if (!pick || !report.visible) {
    return (
      <div className="yds-spick-validation-page min-w-0 px-3 py-4 sm:px-4">
        <Link to="/performance-validation/picks" className="yds-spick-detail__back">
          ← 상세 검증 목록
        </Link>
        <p className="yds-spick-empty">추천 기록을 찾을 수 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="yds-spick-validation-page min-w-0 px-3 py-4 sm:px-4">
      <Link to="/performance-validation/picks" className="yds-spick-detail__back">
        ← 상세 검증 목록
      </Link>

      <header className="yds-spick-validation-page__head">
        <h1 className="yds-spick-validation-page__title">{report.name}</h1>
        <p className="yds-spick-validation-page__sub font-mono tabular-nums">
          {report.ticker} · 추천 {report.recommendedAt} · {report.regimeLabel}
        </p>
        <Link to={`/stock-picks/${report.ticker}`} className="yds-spick-validation-page__link">
          현재 AI 분석 →
        </Link>
      </header>

      <dl className="yds-spick-validation-kpi">
        <div><dt>추천일</dt><dd className="font-mono tabular-nums">{report.recommendedAt}</dd></div>
        <div><dt>추천가</dt><dd className="font-mono tabular-nums">{report.recommendedPrice}</dd></div>
        <div><dt>현재가</dt><dd className="font-mono tabular-nums">{report.currentPrice}</dd></div>
        <div><dt>최고가</dt><dd className="font-mono tabular-nums">{report.highPrice}</dd></div>
        <div><dt>최저가</dt><dd className="font-mono tabular-nums">{report.lowPrice}</dd></div>
        <div><dt>현재 수익률</dt><dd className="font-mono tabular-nums">{report.currentReturnLabel}</dd></div>
        <div><dt>최고 수익(MFE)</dt><dd className="font-mono tabular-nums">{report.mfeLabel}</dd></div>
        <div><dt>최대 손실(MAE)</dt><dd className="font-mono tabular-nums">{report.maeLabel}</dd></div>
        <div><dt>보유기간</dt><dd>{report.daysHeld}</dd></div>
        <div><dt>추천 AI점수</dt><dd className="font-mono tabular-nums">{report.recAiScore}</dd></div>
        <div><dt>현재 AI점수</dt><dd className="font-mono tabular-nums">{report.currentAiScore}</dd></div>
        <div>
          <dt>점수 변화</dt>
          <dd className="font-mono tabular-nums">
            {report.scoreDelta
              ? `${report.scoreDelta.previous} → ${report.scoreDelta.current} (${report.scoreDelta.display})`
              : "—"}
          </dd>
        </div>
      </dl>

      <section className="yds-spick-validation-section">
        <h2 className="yds-spick-validation-section__title">가격 변화</h2>
        <MiniLineChart data={report.priceSeries} dataKey="returnPct" suffix="%" color="#4ade80" />
      </section>

      <section className="yds-spick-validation-section">
        <h2 className="yds-spick-validation-section__title">AI 점수 변화</h2>
        <MiniLineChart data={report.scoreSeries} dataKey="score" color="#38bdf8" />
      </section>

      <section className="yds-spick-validation-section">
        <h2 className="yds-spick-validation-section__title">추천 상태 타임라인</h2>
        <ol className="yds-spick-validation-timeline">
          {report.statusTimeline.map((item) => (
            <li key={`${item.date}-${item.statusId}`} className="yds-spick-validation-timeline__item">
              <span className="font-mono tabular-nums">{item.dateLabel}</span>
              <span>{item.statusLabel}</span>
              <span className="font-mono tabular-nums">{item.score}점</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="yds-spick-validation-section">
        <h2 className="yds-spick-validation-section__title">추천 이유</h2>
        <ul className="yds-spick-validation-reasons">
          {report.recommendReasons.length
            ? report.recommendReasons.map((r) => <li key={r}>{r}</li>)
            : <li>당시 스냅샷 기록 없음</li>}
        </ul>
      </section>

      <section className="yds-spick-validation-section">
        <h2 className="yds-spick-validation-section__title">현재 평가</h2>
        <p className="yds-spick-validation-eval">{report.currentEvaluation}</p>
      </section>
    </div>
  )
}
