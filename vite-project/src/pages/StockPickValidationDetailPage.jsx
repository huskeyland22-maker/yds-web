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
  const series = data ?? []
  if (!series.length) return <p className="yds-spick-empty">데이터 없음</p>
  return (
    <div className="yds-spick-validation-chart">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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

function ValidationSection({ title, children, empty = false, emptyLabel = "데이터 없음" }) {
  return (
    <section className="yds-spick-validation-section">
      <h2 className="yds-spick-validation-section__title">{title}</h2>
      {empty ? <p className="yds-spick-empty">{emptyLabel}</p> : children}
    </section>
  )
}

export default function StockPickValidationDetailPage() {
  const { pickId = "" } = useParams()
  const marketContext = useYdsMarketContext()
  const { stocks: liveStocks = [] } = useStockPickLiveData(
    marketContext?.ready ? marketContext : null,
  )
  const pick = useMemo(() => findValidationPickById(pickId), [pickId])
  const liveStock = useMemo(() => {
    const list = liveStocks ?? []
    const sym = String(pick?.ticker ?? "").toUpperCase()
    if (!sym) return null
    return list.find((s) => String(s?.ticker ?? "").toUpperCase() === sym) ?? null
  }, [liveStocks, pick])
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

  const priceSeries = report.priceSeries ?? []
  const scoreSeries = report.scoreSeries ?? []
  const statusTimeline = report.statusTimeline ?? []
  const recommendReasons = report.recommendReasons ?? []

  return (
    <div className="yds-spick-validation-page min-w-0 px-3 py-4 sm:px-4">
      <Link to="/performance-validation/picks" className="yds-spick-detail__back">
        ← 상세 검증 목록
      </Link>

      <header className="yds-spick-validation-page__head">
        <h1 className="yds-spick-validation-page__title">{report.name ?? "—"}</h1>
        <p className="yds-spick-validation-page__sub font-mono tabular-nums">
          {report.ticker ?? "—"} · 추천 {report.recommendedAt ?? "—"} · {report.regimeLabel ?? "—"}
        </p>
        <p className="yds-spick-validation-page__lifecycle">
          {report.lifecycleLabel ?? "—"}
          {report.resultBadge ? (
            <span className="yds-spick-validation-page__badge">{report.resultBadge}</span>
          ) : null}
        </p>
        {report.ticker ? (
          <Link to={`/stock-picks/${report.ticker}`} className="yds-spick-validation-page__link">
            현재 AI 분석 →
          </Link>
        ) : null}
      </header>

      <dl className="yds-spick-validation-kpi">
        <div><dt>추천일시</dt><dd className="font-mono tabular-nums">{report.recommendedAtIso ?? report.recommendedAt ?? "—"}</dd></div>
        <div><dt>추천일</dt><dd className="font-mono tabular-nums">{report.recommendedAt ?? "—"}</dd></div>
        <div><dt>추천가</dt><dd className="font-mono tabular-nums">{report.recommendedPrice ?? "—"}</dd></div>
        <div><dt>현재가</dt><dd className="font-mono tabular-nums">{report.currentPrice ?? "—"}</dd></div>
        <div><dt>최고가</dt><dd className="font-mono tabular-nums">{report.highPrice ?? "—"}</dd></div>
        <div><dt>최저가</dt><dd className="font-mono tabular-nums">{report.lowPrice ?? "—"}</dd></div>
        <div><dt>현재 수익률</dt><dd className="font-mono tabular-nums">{report.currentReturnLabel ?? "—"}</dd></div>
        <div><dt>최고 수익</dt><dd className="font-mono tabular-nums">{report.maxReturnLabel ?? report.mfeLabel ?? "—"}</dd></div>
        <div><dt>최대 손실</dt><dd className="font-mono tabular-nums">{report.minReturnLabel ?? report.maeLabel ?? "—"}</dd></div>
        <div><dt>보유기간</dt><dd>{report.daysHeld ?? "—"}</dd></div>
        <div><dt>추천 AI점수</dt><dd className="font-mono tabular-nums">{report.recAiScore ?? "—"}</dd></div>
        <div><dt>AI 등급</dt><dd>{report.recommendGrade ?? "—"}</dd></div>
        <div><dt>현재 AI점수</dt><dd className="font-mono tabular-nums">{report.currentAiScore ?? "—"}</dd></div>
        <div>
          <dt>점수 변화</dt>
          <dd className="font-mono tabular-nums">
            {report.scoreDelta
              ? `${report.scoreDelta.previous} → ${report.scoreDelta.current} (${report.scoreDelta.display})`
              : "—"}
          </dd>
        </div>
        {report.closedAt ? (
          <div>
            <dt>종료일</dt>
            <dd className="font-mono tabular-nums">{report.closedAt}</dd>
          </div>
        ) : null}
      </dl>

      <ValidationSection title="추천 당시 시장 정보">
        <dl className="yds-spick-validation-kpi">
          <div><dt>시장 상태</dt><dd>{report.marketStateLabel ?? "—"}</dd></div>
          <div>
            <dt>패닉 강도</dt>
            <dd className="font-mono tabular-nums">
              {report.panicIntensityLabel != null ? Math.round(report.panicIntensityLabel) : "—"}
            </dd>
          </div>
          <div><dt>시장 사이클</dt><dd>{report.cycleLabel ?? "—"}</dd></div>
          <div><dt>VIX</dt><dd className="font-mono tabular-nums">{report.vixLabel ?? "—"}</dd></div>
          <div><dt>CNN Fear &amp; Greed</dt><dd className="font-mono tabular-nums">{report.cnnLabel ?? "—"}</dd></div>
          <div><dt>BofA Bull &amp; Bear</dt><dd className="font-mono tabular-nums">{report.bofaLabel ?? "—"}</dd></div>
          <div><dt>원장 상태</dt><dd>{report.ledgerState ?? "—"}</dd></div>
        </dl>
      </ValidationSection>

      <ValidationSection title="가격 변화" empty={!priceSeries.length}>
        <MiniLineChart data={priceSeries} dataKey="returnPct" suffix="%" color="#4ade80" />
      </ValidationSection>

      <ValidationSection title="AI 점수 변화" empty={!scoreSeries.length}>
        <MiniLineChart data={scoreSeries} dataKey="score" color="#38bdf8" />
      </ValidationSection>

      <ValidationSection title="추천 상태 타임라인" empty={!statusTimeline.length}>
        <ol className="yds-spick-validation-timeline">
          {statusTimeline.map((item) => (
            <li key={`${item.date}-${item.statusId}`} className="yds-spick-validation-timeline__item">
              <span className="font-mono tabular-nums">{item.dateLabel}</span>
              <span>{item.statusLabel}</span>
              <span className="font-mono tabular-nums">{item.score}점</span>
            </li>
          ))}
        </ol>
      </ValidationSection>

      <ValidationSection title="추천 이유" empty={!recommendReasons.length} emptyLabel="당시 스냅샷 기록 없음">
        <ul className="yds-spick-validation-reasons">
          {recommendReasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </ValidationSection>

      <ValidationSection title="현재 평가" empty={!report.currentEvaluation}>
        <p className="yds-spick-validation-eval">{report.currentEvaluation}</p>
      </ValidationSection>

      {report.closeReason ? (
        <ValidationSection title="종료 사유">
          <p className="yds-spick-validation-eval">{report.closeReason}</p>
        </ValidationSection>
      ) : null}
    </div>
  )
}
