import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useAppDataStore } from "../store/appDataStore.js"
import { diagnoseCycleMerge, mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import {
  buildPanicBuyForwardReturns,
  buildValidationBenchmarkSeries,
  runPanicIndexAllocationBacktest,
} from "../trading-zone/panicIndexValidationBacktest.js"
import { MACRO_STAGE_ALLOCATION } from "../trading-zone/macroStageAllocation.js"
import { getTradingZonePositions } from "../trading-zone/tacticalTradingZoneData.js"
import { buildRecommendationTrackRows } from "../trading-zone/tradingZoneRecommendationTrack.js"
import { analyzeYdsScoreDistributionWindows } from "../utils/ydsScoreValidation.js"
import {
  YDS_VALIDATION_EVENT_CATEGORY_LABEL,
  YDS_VALIDATION_EVENT_DATASET,
} from "../trading-zone/ydsHistoricalValidationEvents.js"
import YdsEventDetailPanel from "../components/validation/YdsEventDetailPanel.jsx"
import YdsPanicEventValidationSection from "../components/validation/YdsPanicEventValidationSection.jsx"
import YdsFearClimaxAnalysisSection from "../components/validation/YdsFearClimaxAnalysisSection.jsx"
import YdsEngineCandidateV3Section from "../components/validation/YdsEngineCandidateV3Section.jsx"
import YdsPrecursorValidationSection from "../components/validation/YdsPrecursorValidationSection.jsx"
import YdsPrecursorEnginePhase1Section from "../components/validation/YdsPrecursorEnginePhase1Section.jsx"
import YdsPrecursorEnginePhase2Section from "../components/validation/YdsPrecursorEnginePhase2Section.jsx"
import YdsPrecursorEnginePhase3Section from "../components/validation/YdsPrecursorEnginePhase3Section.jsx"
import YdsPrecursorEnginePhase4Section from "../components/validation/YdsPrecursorEnginePhase4Section.jsx"
import YdsPrecursorEnginePhase5Section from "../components/validation/YdsPrecursorEnginePhase5Section.jsx"
import YdsPrecursorEnginePhase6Section from "../components/validation/YdsPrecursorEnginePhase6Section.jsx"
import YdsPrecursorEnginePhase7Section from "../components/validation/YdsPrecursorEnginePhase7Section.jsx"
import YdsPrecursorEnginePhase8Section from "../components/validation/YdsPrecursorEnginePhase8Section.jsx"
import YdsPrecursorEnginePhase9Section from "../components/validation/YdsPrecursorEnginePhase9Section.jsx"
import YdsPrecursorEnginePhase10Section from "../components/validation/YdsPrecursorEnginePhase10Section.jsx"
import YdsPrecursorEnginePhase11Section from "../components/validation/YdsPrecursorEnginePhase11Section.jsx"
import YdsPrecursorEnginePhase18Section from "../components/validation/YdsPrecursorEnginePhase18Section.jsx"
import YdsPrecursorEnginePhase20Section from "../components/validation/YdsPrecursorEnginePhase20Section.jsx"
import ValidationPhaseAccordion, {
  VALIDATION_PHASE_SUBTITLES,
} from "../components/validation/ValidationPhaseAccordion.jsx"
import YdsPrecursorEnginePhase17Section from "../components/validation/YdsPrecursorEnginePhase17Section.jsx"
import YdsPrecursorEnginePhase16Section from "../components/validation/YdsPrecursorEnginePhase16Section.jsx"
import YdsPrecursorEnginePhase15Section from "../components/validation/YdsPrecursorEnginePhase15Section.jsx"
import YdsPrecursorEnginePhase13Section from "../components/validation/YdsPrecursorEnginePhase13Section.jsx"
import YdsProductionCandidateSection from "../components/validation/YdsProductionCandidateSection.jsx"
import YdsHyWeightSensitivityLabSection from "../components/validation/YdsHyWeightSensitivityLabSection.jsx"
import YdsTariffShockDeepValidationSection from "../components/validation/YdsTariffShockDeepValidationSection.jsx"
import YdsVixSensitivityLabSection from "../components/validation/YdsVixSensitivityLabSection.jsx"
import YdsPanicPeakRankingSection from "../components/validation/YdsPanicPeakRankingSection.jsx"
import YdsStageSimulationSection from "../components/validation/YdsStageSimulationSection.jsx"
import { isEventComplete } from "../trading-zone/ydsHistoricalEventCompletions.js"
import {
  CartesianGrid,
  Dot,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

function formatPct(v, digits = 1) {
  if (v == null || !Number.isFinite(v)) return "—"
  const sign = v > 0 ? "+" : ""
  return `${sign}${v.toFixed(digits)}%`
}

/**
 * @param {{
 *   label: string
 *   strategy: string
 *   spy: string
 *   strategyTone?: "up" | "down" | ""
 *   spyTone?: "up" | "down" | ""
 * }} props
 */
function VsMetricRow({ label, strategy, spy, strategyTone = "", spyTone = "" }) {
  return (
    <div className="panic-validation-vs__metric">
      <span className="panic-validation-vs__metric-label">{label}</span>
      <span
        className={[
          "panic-validation-vs__metric-val font-mono tabular-nums",
          strategyTone ? `panic-validation-vs__metric-val--${strategyTone}` : "",
        ].join(" ")}
      >
        {strategy}
      </span>
      <span
        className={[
          "panic-validation-vs__metric-val font-mono tabular-nums",
          spyTone ? `panic-validation-vs__metric-val--${spyTone}` : "",
        ].join(" ")}
      >
        {spy}
      </span>
    </div>
  )
}

function daysBetween(isoA, isoB) {
  const a = new Date(`${String(isoA).slice(0, 10)}T12:00:00`).getTime()
  const b = new Date(`${String(isoB).slice(0, 10)}T12:00:00`).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return Math.round((b - a) / 86_400_000)
}

export default function PanicIndexValidationPage() {
  const [ydsTab, setYdsTab] = useState("recent1y")
  const [selectedEventId, setSelectedEventId] = useState(() => YDS_VALIDATION_EVENT_DATASET[0]?.id ?? null)
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const history = useMemo(
    () => resolveCycleHistoryRows(mergeCycleRows(storeRows ?? [], [])),
    [storeRows],
  )
  const cycleDiag = useMemo(() => diagnoseCycleMerge(storeRows ?? [], []), [storeRows])

  const backtest = useMemo(() => runPanicIndexAllocationBacktest(history), [history])
  const panicBuyEvents = useMemo(() => buildPanicBuyForwardReturns(history, 8), [history])
  const benchmarkSeries = useMemo(() => buildValidationBenchmarkSeries(history), [history])
  const ydsDistribution = useMemo(() => analyzeYdsScoreDistributionWindows(history), [history])
  const ydsView = ydsDistribution[ydsTab] ?? ydsDistribution.recent1y
  useEffect(() => {
    if (typeof window === "undefined") return
    const src = ydsDistribution.source
    const samples = ydsDistribution.sampleCounts
    console.groupCollapsed("[YDS Distribution] source diagnostics")
    console.log("원본 데이터 건수:", src.totalRows)
    console.log("최초 날짜:", src.firstDate ?? "—")
    console.log("마지막 날짜:", src.lastDate ?? "—")
    console.log("최근1년 표본:", `${samples.recent1yRows}건`)
    console.log("최근3년 표본:", `${samples.recent3yRows}건`)
    console.log("전체 표본:", `${samples.allRows}건`)
    console.log("[Cycle Merge 진단] CYCLE_HISTORY_MAX:", cycleDiag.cycleHistoryMax)
    console.log("[Cycle Merge 진단] raw history =", cycleDiag.rawCount)
    console.log("[Cycle Merge 진단] after merge =", cycleDiag.mergedCount)
    console.log("[Cycle Merge 진단] after slice =", cycleDiag.slicedCount)
    console.log("[Cycle Merge 진단] slice 적용 전/후 =", {
      before: cycleDiag.mergedCount,
      after: cycleDiag.slicedCount,
    })
    console.log("[검증센터 데이터 소스]", {
      dailyHistory: "resolveCycleHistoryRows(...) 결과(history)",
      cycleHistory: "storeRows -> mergeCycleRows -> resolveCycleHistoryRows",
      stageHistory: "별도 배열 미사용(점수→단계 실시간 계산)",
    })
    console.log("[예상 건수 시뮬레이션]", {
      max365: cycleDiag.expectedByMax[365],
      max730: cycleDiag.expectedByMax[730],
      max2000: cycleDiag.expectedByMax[2000],
    })
    const recommendedMax =
      cycleDiag.mergedCount > 730 ? 2000 : cycleDiag.mergedCount > 365 ? 730 : 365
    console.log("[권장 CYCLE_HISTORY_MAX]", recommendedMax)
    console.groupEnd()
  }, [ydsDistribution, cycleDiag])
  useEffect(() => {
    if (typeof window === "undefined") return
    ;(async () => {
      try {
        const res = await fetch("/api/supabase/health?panic_verify=1", { cache: "no-store" })
        const json = await res.json()
        const checks = json?.checks ?? {}
        console.groupCollapsed("[YDS DB 진단] panic_index_history")
        console.log("DB 전체 row 수:", checks.totalHistoryCount?.count ?? "—")
        console.log("최초 created_at:", checks.createdAtRange?.minCreatedAt ?? "—")
        console.log("최종 created_at:", checks.createdAtRange?.maxCreatedAt ?? "—")
        console.log("실제 사용 row 수(cycle merge 후):", cycleDiag.slicedCount)
        console.groupEnd()
      } catch (e) {
        console.warn("[YDS DB 진단] supabase health fetch failed", e)
      }
    })()
  }, [cycleDiag.slicedCount])
  const recommendation30d = useMemo(() => {
    const rows = buildRecommendationTrackRows(getTradingZonePositions(), [], {})
    const today = new Date().toISOString().slice(0, 10)
    const recent = rows.filter((r) => {
      const diff = daysBetween(r.recommendedAt, today)
      return diff != null && diff >= 0 && diff <= 30
    })
    const withRet = recent.filter((r) => Number.isFinite(r.returnPct))
    const winCount = withRet.filter((r) => Number(r.returnPct) > 0).length
    const avg =
      withRet.length > 0 ? withRet.reduce((sum, r) => sum + Number(r.returnPct), 0) / withRet.length : null
    const sorted = [...withRet].sort((a, b) => Number(b.returnPct) - Number(a.returnPct))
    return {
      count: recent.length,
      winRate: withRet.length ? (winCount / withRet.length) * 100 : null,
      avgReturn: avg,
      best: sorted[0] ?? null,
      worst: sorted[sorted.length - 1] ?? null,
    }
  }, [])

  const strategyTotal = backtest.totalReturnPct
  const spyTotal = backtest.benchmarkReturnPct
  const strategyWin = backtest.winRatePct
  const spyWin = backtest.benchmarkWinRatePct
  const strategyMdd = backtest.mddPct
  const spyMdd = backtest.benchmarkMddPct

  const tone = (v) => (v == null || !Number.isFinite(v) ? "" : v > 0 ? "up" : v < 0 ? "down" : "")

  return (
    <div className="panic-validation-page min-w-0 px-3 py-4 sm:px-4">
      <header className="panic-validation-page__head">
        <div>
          <p className="panic-validation-page__lab-badge">[ LAB ] 시장 프록시 기반 연구용 검증</p>
          <h1 className="panic-validation-page__title">패닉지수 검증</h1>
          <p className="panic-validation-page__sub">
            YDS 패닉전략 백테스트 · {backtest.periodStart ?? "—"} ~ {backtest.periodEnd ?? "—"}
          </p>
          <p className="panic-validation-page__sub">
            현재 수치는 Fear&amp;Greed + VIX 기반 시장 프록시 시뮬레이션이며, 실제 SPX/SPY 종가 기반
            백테스트는 추후 구현 예정입니다.
          </p>
        </div>
        <Link to="/cycle" className="panic-validation-page__link">
          매매존으로
        </Link>
      </header>

      {!backtest.ok && backtest.reason === "insufficient_data" ? (
        <p className="panic-validation-panel__warn" role="status">
          표본이 부족합니다(주간 {backtest.sampleWeeks ?? 0}회). Cycle 히스토리를 더 쌓거나 확장 앵커 데이터를
          확인해 주세요.
        </p>
      ) : null}

      <section className="panic-validation-kpi" aria-label="핵심 지표 요약">
        <div className="panic-validation-kpi__card">
          <p className="panic-validation-kpi__label">누적 수익률</p>
          <p className={`panic-validation-kpi__value panic-validation-kpi__value--${tone(strategyTotal) || "flat"}`}>
            {formatPct(strategyTotal)}
          </p>
        </div>
        <div className="panic-validation-kpi__card">
          <p className="panic-validation-kpi__label">시장 프록시 대비</p>
          <p
            className={`panic-validation-kpi__value panic-validation-kpi__value--${
              tone(
                strategyTotal != null && spyTotal != null ? strategyTotal - spyTotal : null,
              ) || "flat"
            }`}
          >
            {strategyTotal != null && spyTotal != null
              ? formatPct(strategyTotal - spyTotal)
              : "—"}
          </p>
        </div>
        <div className="panic-validation-kpi__card">
          <p className="panic-validation-kpi__label">승률</p>
          <p className="panic-validation-kpi__value">{strategyWin != null ? `${strategyWin.toFixed(1)}%` : "—"}</p>
        </div>
        <div className="panic-validation-kpi__card">
          <p className="panic-validation-kpi__label">MDD</p>
          <p className="panic-validation-kpi__value panic-validation-kpi__value--down">
            {strategyMdd != null ? `-${strategyMdd.toFixed(1)}%` : "—"}
          </p>
        </div>
      </section>

      <section className="panic-validation-vs" aria-labelledby="panic-validation-vs-title">
        <h2 id="panic-validation-vs-title" className="panic-validation-vs__title">
          패닉지수 전략 VS 시장 프록시
        </h2>
        <p className="panic-validation-vs__sub">
          전략: 거시 구간별 주식·현금 비중 · 벤치마크: 동일 기간 100% 주식(시장 프록시)
        </p>

        <div className="panic-validation-vs__head-row" aria-hidden>
          <span />
          <span className="panic-validation-vs__col-head">패닉지수 전략</span>
          <span className="panic-validation-vs__col-head">시장 프록시</span>
        </div>

        <div className="panic-validation-vs__metrics">
          <VsMetricRow
            label="누적 수익률"
            strategy={formatPct(strategyTotal)}
            spy={formatPct(spyTotal)}
            strategyTone={tone(strategyTotal)}
            spyTone={tone(spyTotal)}
          />
          <VsMetricRow
            label="승률 (주간)"
            strategy={strategyWin != null ? `${strategyWin.toFixed(1)}%` : "—"}
            spy={spyWin != null ? `${spyWin.toFixed(1)}%` : "—"}
          />
          <VsMetricRow
            label="MDD"
            strategy={strategyMdd != null ? `-${strategyMdd.toFixed(1)}%` : "—"}
            spy={spyMdd != null ? `-${spyMdd.toFixed(1)}%` : "—"}
            strategyTone="down"
            spyTone="down"
          />
        </div>
      </section>

      <section className="panic-validation-panel" aria-labelledby="panic-validation-spy-chart">
        <h2 id="panic-validation-spy-chart" className="panic-validation-panel__h2">
          시장 프록시 검증 차트 (신호 마커)
        </h2>
        <div className="panic-validation-spy-chart">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={benchmarkSeries.points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(148,163,184,0.16)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: "rgba(148,163,184,0.9)", fontSize: 10 }} />
              <YAxis tick={{ fill: "rgba(148,163,184,0.9)", fontSize: 10 }} width={42} />
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(1)}`, "시장 프록시 지수(기준 100)"]}
                labelFormatter={(v) => `일자 ${v}`}
              />
              <Line
                type="monotone"
                dataKey="bench"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={(props) => {
                  const payload = props?.payload
                  const m = benchmarkSeries.markers.find((x) => x.date === payload?.date)
                  if (!m) return null
                  return (
                    <Dot
                      cx={props.cx}
                      cy={props.cy}
                      r={4}
                      fill={m.type === "panicBuy" ? "#ef4444" : "#f97316"}
                      stroke="#fff"
                      strokeWidth={1}
                    />
                  )
                }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="panic-validation-panel__note">
          ● 주황=분할매수 시점, ● 빨강=패닉매수 시점
        </p>
      </section>

      <section className="panic-validation-panel" aria-labelledby="panic-validation-reco-30d">
        <h2 id="panic-validation-reco-30d" className="panic-validation-panel__h2">
          추천종목 검증 시스템 (최근 30일)
        </h2>
        <div className="panic-validation-kpi">
          <div className="panic-validation-kpi__card">
            <p className="panic-validation-kpi__label">추천 횟수</p>
            <p className="panic-validation-kpi__value font-mono tabular-nums">{recommendation30d.count}회</p>
          </div>
          <div className="panic-validation-kpi__card">
            <p className="panic-validation-kpi__label">승률</p>
            <p className="panic-validation-kpi__value font-mono tabular-nums">
              {recommendation30d.winRate != null ? `${recommendation30d.winRate.toFixed(1)}%` : "—"}
            </p>
          </div>
          <div className="panic-validation-kpi__card">
            <p className="panic-validation-kpi__label">평균 수익률</p>
            <p
              className={`panic-validation-kpi__value panic-validation-kpi__value--${
                tone(recommendation30d.avgReturn) || "flat"
              } font-mono tabular-nums`}
            >
              {formatPct(recommendation30d.avgReturn)}
            </p>
          </div>
          <div className="panic-validation-kpi__card">
            <p className="panic-validation-kpi__label">최고/최악 종목</p>
            <p className="panic-validation-kpi__value text-[13px]">
              {recommendation30d.best
                ? `${recommendation30d.best.symbol} ${formatPct(recommendation30d.best.returnPct)}`
                : "—"}
              <span className="mx-1 text-slate-500">/</span>
              {recommendation30d.worst
                ? `${recommendation30d.worst.symbol} ${formatPct(recommendation30d.worst.returnPct)}`
                : "—"}
            </p>
          </div>
        </div>
      </section>

      <section className="panic-validation-panel" aria-labelledby="panic-validation-yearly">
        <h2 id="panic-validation-yearly" className="panic-validation-panel__h2">
          연도별 성과
        </h2>
        <table className="panic-validation-year-table panic-validation-year-table--vs">
          <thead>
            <tr>
              <th scope="col">연도</th>
              <th scope="col">패닉지수 전략</th>
              <th scope="col">시장 프록시</th>
              <th scope="col">차이</th>
            </tr>
          </thead>
          <tbody>
            {(backtest.yearlyComparison ?? []).map((row) => {
              const diff =
                row.strategyPct != null && row.spyPct != null ? row.strategyPct - row.spyPct : null
              return (
                <tr key={row.year}>
                  <td>{row.year}</td>
                  <td
                    className={
                      row.strategyPct != null && row.strategyPct > 0
                        ? "panic-validation-year-table__up"
                        : row.strategyPct != null && row.strategyPct < 0
                          ? "panic-validation-year-table__down"
                          : ""
                    }
                  >
                    {formatPct(row.strategyPct)}
                  </td>
                  <td
                    className={
                      row.spyPct != null && row.spyPct > 0
                        ? "panic-validation-year-table__up"
                        : row.spyPct != null && row.spyPct < 0
                          ? "panic-validation-year-table__down"
                          : ""
                    }
                  >
                    {formatPct(row.spyPct)}
                  </td>
                  <td
                    className={
                      diff != null && diff > 0
                        ? "panic-validation-year-table__up"
                        : diff != null && diff < 0
                          ? "panic-validation-year-table__down"
                          : ""
                    }
                  >
                    {formatPct(diff)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="panic-validation-panel__note">
          시장 수익은 Fear&amp;Greed·VIX 변화로 근사합니다. 월간 앵커·실측 히스토리 병합 · 표본 주{" "}
          {backtest.sampleWeeks ?? 0}
          {backtest.usesExtendedHistory ? " · 확장 앵커 포함" : ""}
        </p>
      </section>

      <section className="panic-validation-panel" aria-labelledby="panic-validation-allocation">
        <h2 id="panic-validation-allocation" className="panic-validation-panel__h2">
          거시 단계 → 권장 비중
        </h2>
        <p className="panic-validation-panel__bench">
          실전 매매존 시장 상태와 동일 규칙 · 중립구간 주식 70% / 패닉매수 주식 100% 등
        </p>
        <ul className="panic-validation-allocation">
          {Object.entries(MACRO_STAGE_ALLOCATION).map(([id, alloc]) => (
            <li key={id} className="panic-validation-allocation__item" data-regime={id}>
              <span className="panic-validation-allocation__regime">
                {id === "overheated"
                  ? "과열구간"
                  : id === "neutral"
                    ? "중립구간"
                    : id === "interest"
                      ? "관심구간"
                      : id === "dca"
                        ? "분할매수"
                        : "패닉매수"}
              </span>
              <span className="panic-validation-allocation__split">
                {alloc.stockLabel} · {alloc.cashLabel}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panic-validation-panel" aria-labelledby="panic-validation-yds-distribution">
        <h2 id="panic-validation-yds-distribution" className="panic-validation-panel__h2">
          YDS 점수 분포 검증 센터
        </h2>
        <p className="m-0 panic-validation-panel__note">
          원본 데이터: {cycleDiag.firstDate ?? "—"} ~ {cycleDiag.lastDate ?? "—"} · 총 {cycleDiag.mergedCount}건
        </p>
        <div className="panic-validation-yds-tabs" role="tablist" aria-label="YDS 분석 기간">
          <button
            type="button"
            className={ydsTab === "recent1y" ? "is-active" : ""}
            onClick={() => setYdsTab("recent1y")}
          >
            최근 1년
          </button>
          <button
            type="button"
            className={ydsTab === "recent3y" ? "is-active" : ""}
            onClick={() => setYdsTab("recent3y")}
          >
            최근 3년
          </button>
          <button
            type="button"
            className={ydsTab === "all" ? "is-active" : ""}
            onClick={() => setYdsTab("all")}
          >
            전체
          </button>
        </div>
        <p className="m-0 panic-validation-panel__note">
          사용 표본 수 · 최근1년 n={ydsDistribution.sampleCounts.recent1yRows} / 최근3년 n={ydsDistribution.sampleCounts.recent3yRows} / 전체 n={ydsDistribution.sampleCounts.allRows}
        </p>
        <article className="panic-validation-yds-window">
          <div className="panic-validation-kpi">
            <div className="panic-validation-kpi__card">
              <p className="panic-validation-kpi__label">최저 점수</p>
              <p className="panic-validation-kpi__value font-mono tabular-nums">
                {ydsView.minScore != null ? Math.round(ydsView.minScore) : "—"}
              </p>
            </div>
            <div className="panic-validation-kpi__card">
              <p className="panic-validation-kpi__label">최고 점수</p>
              <p className="panic-validation-kpi__value font-mono tabular-nums">
                {ydsView.maxScore != null ? Math.round(ydsView.maxScore) : "—"}
              </p>
            </div>
            <div className="panic-validation-kpi__card">
              <p className="panic-validation-kpi__label">평균 점수</p>
              <p className="panic-validation-kpi__value font-mono tabular-nums">
                {ydsView.avgScore != null ? ydsView.avgScore.toFixed(1) : "—"}
              </p>
            </div>
            <div className="panic-validation-kpi__card">
              <p className="panic-validation-kpi__label">중앙값</p>
              <p className="panic-validation-kpi__value font-mono tabular-nums">
                {ydsView.medianScore != null ? ydsView.medianScore.toFixed(1) : "—"}
              </p>
            </div>
            <div className="panic-validation-kpi__card">
              <p className="panic-validation-kpi__label">표준편차</p>
              <p className="panic-validation-kpi__value font-mono tabular-nums">
                {ydsView.stdDev != null ? ydsView.stdDev.toFixed(2) : "—"}
              </p>
            </div>
            <div className="panic-validation-kpi__card">
              <p className="panic-validation-kpi__label">표본</p>
              <p className="panic-validation-kpi__value font-mono tabular-nums">{ydsView.total}건</p>
            </div>
          </div>
          <p className="m-0 panic-validation-panel__h3">단계 비중</p>
          <div className="panic-validation-yds-distribution">
            {ydsView.stageStats.map((stage) => (
              <p key={stage.id} className="m-0 panic-validation-yds-distribution__row">
                <span>{stage.emoji} {stage.label}</span>
                <strong className="font-mono tabular-nums">{stage.pct.toFixed(1)}%</strong>
              </p>
            ))}
          </div>
          <p className="m-0 panic-validation-panel__h3">YDS 점수 히스토그램</p>
          <div className="panic-validation-yds-histogram">
            {ydsView.scoreBins.map((bin) => (
              <div key={bin.id} className="panic-validation-yds-histogram__row">
                <span className="panic-validation-yds-histogram__label">{bin.label}</span>
                <div className="panic-validation-yds-histogram__bar-wrap">
                  <span
                    className="panic-validation-yds-histogram__bar"
                    style={{ width: `${Math.max(4, Math.min(100, bin.pct))}%` }}
                  />
                </div>
                <span className="panic-validation-yds-histogram__value font-mono tabular-nums">
                  {bin.count}건 · {bin.pct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
          <div className="panic-validation-yds-grade">
            <p className="m-0 panic-validation-kpi__label">점수 체계 적합도</p>
            <p className="m-0 panic-validation-yds-grade__badge">{ydsView.fitnessGrade}</p>
            <p className="m-0 panic-validation-panel__note">{ydsView.recommendation}</p>
          </div>
          {ydsView.imbalanceWarnings.length ? (
            <div className="panic-validation-yds-distribution__suggestions">
              <p className="m-0 panic-validation-panel__h3">자동 평가 경고</p>
              {ydsView.imbalanceWarnings.map((line) => (
                <p key={line} className="m-0 panic-validation-panel__note panic-validation-panel__note--warn">
                  ⚠ {line}
                </p>
              ))}
            </div>
          ) : null}
        </article>
      </section>

      <section className="panic-validation-panel" aria-labelledby="panic-validation-panicbuy-forward">
        <h2 id="panic-validation-panicbuy-forward" className="panic-validation-panel__h2">
          패닉매수 발생 시점 이후 수익률
        </h2>
        <table className="panic-validation-year-table panic-validation-year-table--vs">
          <thead>
            <tr>
              <th scope="col">발생일</th>
              <th scope="col">점수</th>
              <th scope="col">1개월</th>
              <th scope="col">3개월</th>
              <th scope="col">6개월</th>
              <th scope="col">12개월</th>
            </tr>
          </thead>
          <tbody>
            {panicBuyEvents.length ? (
              panicBuyEvents.map((row) => (
                <tr key={row.date}>
                  <td className="font-mono tabular-nums">{row.date}</td>
                  <td className="font-mono tabular-nums">{row.score}</td>
                  <td className={row.returns.m1 != null && row.returns.m1 > 0 ? "panic-validation-year-table__up" : row.returns.m1 != null && row.returns.m1 < 0 ? "panic-validation-year-table__down" : ""}>
                    {formatPct(row.returns.m1)}
                  </td>
                  <td className={row.returns.m3 != null && row.returns.m3 > 0 ? "panic-validation-year-table__up" : row.returns.m3 != null && row.returns.m3 < 0 ? "panic-validation-year-table__down" : ""}>
                    {formatPct(row.returns.m3)}
                  </td>
                  <td className={row.returns.m6 != null && row.returns.m6 > 0 ? "panic-validation-year-table__up" : row.returns.m6 != null && row.returns.m6 < 0 ? "panic-validation-year-table__down" : ""}>
                    {formatPct(row.returns.m6)}
                  </td>
                  <td className={row.returns.m12 != null && row.returns.m12 > 0 ? "panic-validation-year-table__up" : row.returns.m12 != null && row.returns.m12 < 0 ? "panic-validation-year-table__down" : ""}>
                    {formatPct(row.returns.m12)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="text-slate-500">
                  패닉매수 시점 데이터 준비 중
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="panic-validation-panel__note">시장 프록시 기준 누적 수익률(주간 스텝 합성)</p>
      </section>

      <YdsEngineCandidateV3Section events={YDS_VALIDATION_EVENT_DATASET} />

      <div className="validation-phase-accordion-stack" aria-label="Precursor Engine Phase 1–20">
        <ValidationPhaseAccordion
          phase={20}
          subtitle={VALIDATION_PHASE_SUBTITLES[20]}
          defaultOpen
        >
          <YdsPrecursorEnginePhase20Section events={YDS_VALIDATION_EVENT_DATASET} />
        </ValidationPhaseAccordion>
        <ValidationPhaseAccordion phase={18} subtitle={VALIDATION_PHASE_SUBTITLES[18]}>
          <YdsPrecursorEnginePhase18Section
            events={YDS_VALIDATION_EVENT_DATASET}
            historyRows={history}
          />
        </ValidationPhaseAccordion>
        <ValidationPhaseAccordion phase={17} subtitle={VALIDATION_PHASE_SUBTITLES[17]}>
          <YdsPrecursorEnginePhase17Section
            events={YDS_VALIDATION_EVENT_DATASET}
            latestCycleRow={history[history.length - 1] ?? null}
          />
        </ValidationPhaseAccordion>
        <ValidationPhaseAccordion phase={16} subtitle={VALIDATION_PHASE_SUBTITLES[16]}>
          <YdsPrecursorEnginePhase16Section
            events={YDS_VALIDATION_EVENT_DATASET}
            latestCycleRow={history[history.length - 1] ?? null}
          />
        </ValidationPhaseAccordion>
        <ValidationPhaseAccordion phase={15} subtitle={VALIDATION_PHASE_SUBTITLES[15]}>
          <YdsPrecursorEnginePhase15Section
            events={YDS_VALIDATION_EVENT_DATASET}
            latestCycleRow={history[history.length - 1] ?? null}
          />
        </ValidationPhaseAccordion>
        <ValidationPhaseAccordion phase={13} subtitle={VALIDATION_PHASE_SUBTITLES[13]}>
          <YdsPrecursorEnginePhase13Section
            events={YDS_VALIDATION_EVENT_DATASET}
            latestCycleRow={history[history.length - 1] ?? null}
          />
        </ValidationPhaseAccordion>
        <ValidationPhaseAccordion phase={11} subtitle={VALIDATION_PHASE_SUBTITLES[11]}>
          <YdsPrecursorEnginePhase11Section
            events={YDS_VALIDATION_EVENT_DATASET}
            latestCycleRow={history[history.length - 1] ?? null}
          />
        </ValidationPhaseAccordion>
        <ValidationPhaseAccordion phase={10} subtitle={VALIDATION_PHASE_SUBTITLES[10]}>
          <YdsPrecursorEnginePhase10Section
            events={YDS_VALIDATION_EVENT_DATASET}
            latestCycleRow={history[history.length - 1] ?? null}
          />
        </ValidationPhaseAccordion>
        <ValidationPhaseAccordion phase={9} subtitle={VALIDATION_PHASE_SUBTITLES[9]}>
          <YdsPrecursorEnginePhase9Section
            events={YDS_VALIDATION_EVENT_DATASET}
            latestCycleRow={history[history.length - 1] ?? null}
          />
        </ValidationPhaseAccordion>
        <ValidationPhaseAccordion phase={8} subtitle={VALIDATION_PHASE_SUBTITLES[8]}>
          <YdsPrecursorEnginePhase8Section events={YDS_VALIDATION_EVENT_DATASET} />
        </ValidationPhaseAccordion>
        <ValidationPhaseAccordion phase={7} subtitle={VALIDATION_PHASE_SUBTITLES[7]}>
          <YdsPrecursorEnginePhase7Section events={YDS_VALIDATION_EVENT_DATASET} />
        </ValidationPhaseAccordion>
        <ValidationPhaseAccordion phase={6} subtitle={VALIDATION_PHASE_SUBTITLES[6]}>
          <YdsPrecursorEnginePhase6Section
            events={YDS_VALIDATION_EVENT_DATASET}
            latestCycleRow={history[history.length - 1] ?? null}
          />
        </ValidationPhaseAccordion>
        <ValidationPhaseAccordion phase={5} subtitle={VALIDATION_PHASE_SUBTITLES[5]}>
          <YdsPrecursorEnginePhase5Section
            events={YDS_VALIDATION_EVENT_DATASET}
            latestCycleRow={history[history.length - 1] ?? null}
          />
        </ValidationPhaseAccordion>
        <ValidationPhaseAccordion phase={4} subtitle={VALIDATION_PHASE_SUBTITLES[4]}>
          <YdsPrecursorEnginePhase4Section events={YDS_VALIDATION_EVENT_DATASET} />
        </ValidationPhaseAccordion>
        <ValidationPhaseAccordion phase={3} subtitle={VALIDATION_PHASE_SUBTITLES[3]}>
          <YdsPrecursorEnginePhase3Section
            events={YDS_VALIDATION_EVENT_DATASET}
            latestCycleRow={history[history.length - 1] ?? null}
          />
        </ValidationPhaseAccordion>
        <ValidationPhaseAccordion phase={2} subtitle={VALIDATION_PHASE_SUBTITLES[2]}>
          <YdsPrecursorEnginePhase2Section events={YDS_VALIDATION_EVENT_DATASET} />
        </ValidationPhaseAccordion>
        <ValidationPhaseAccordion phase={1} subtitle={VALIDATION_PHASE_SUBTITLES[1]}>
          <YdsPrecursorEnginePhase1Section events={YDS_VALIDATION_EVENT_DATASET} />
        </ValidationPhaseAccordion>
      </div>
      <YdsPrecursorValidationSection events={YDS_VALIDATION_EVENT_DATASET} />
      <YdsProductionCandidateSection
        events={YDS_VALIDATION_EVENT_DATASET}
        latestCycleRow={history[history.length - 1] ?? null}
      />
      <YdsHyWeightSensitivityLabSection events={YDS_VALIDATION_EVENT_DATASET} />
      <YdsTariffShockDeepValidationSection events={YDS_VALIDATION_EVENT_DATASET} />
      <YdsVixSensitivityLabSection events={YDS_VALIDATION_EVENT_DATASET} />
      <YdsPanicPeakRankingSection events={YDS_VALIDATION_EVENT_DATASET} />
      <YdsStageSimulationSection events={YDS_VALIDATION_EVENT_DATASET} />
      <YdsFearClimaxAnalysisSection events={YDS_VALIDATION_EVENT_DATASET} />
      <YdsPanicEventValidationSection events={YDS_VALIDATION_EVENT_DATASET} />

      <section className="panic-validation-panel" aria-labelledby="panic-validation-event-dataset">
        <h2 id="panic-validation-event-dataset" className="panic-validation-panel__h2">
          YDS 역사 검증 이벤트 데이터셋 (기초 설계)
        </h2>
        <p className="panic-validation-panel__note">
          카테고리별 대표 구간 {YDS_VALIDATION_EVENT_DATASET.length}건 · 실제 역사적 사건 기반 · 이벤트별 대표 날짜 5개 제공
        </p>
        {["panic", "dca", "interest", "overheated"].map((category) => {
          const rows = YDS_VALIDATION_EVENT_DATASET.filter((e) => e.category === category)
          return (
            <div key={category} className="mt-2">
              <p className="m-0 panic-validation-panel__h3">
                {YDS_VALIDATION_EVENT_CATEGORY_LABEL[category] ?? category} ({rows.length}건)
              </p>
              <table className="panic-validation-year-table panic-validation-year-table--vs">
                <thead>
                  <tr>
                    <th scope="col">이벤트명</th>
                    <th scope="col">시작일</th>
                    <th scope="col">종료일</th>
                    <th scope="col">대표 날짜 5개</th>
                    <th scope="col">상세</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {row.name}
                        {isEventComplete(row) ? (
                          <span className="panic-validation-event-complete" title="지표·성과 데이터 완성">
                            완성
                          </span>
                        ) : null}
                      </td>
                      <td className="font-mono tabular-nums">{row.startDate}</td>
                      <td className="font-mono tabular-nums">{row.endDate}</td>
                      <td className="font-mono tabular-nums">
                        시작 {row.milestones.start.date} · 상승 {row.milestones.rise.date}
                        <br />
                        공포확대 {row.milestones.fearExpansion.date} · 극점 {row.milestones.climax.date}
                        <br />
                        회복 {row.milestones.recovery.date} ({row.durationDays != null ? `${row.durationDays}일` : "—"})
                      </td>
                      <td>
                        <button
                          type="button"
                          className={selectedEventId === row.id ? "panic-validation-event-select is-active" : "panic-validation-event-select"}
                          onClick={() => setSelectedEventId(row.id)}
                        >
                          보기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
        <YdsEventDetailPanel
          eventItem={YDS_VALIDATION_EVENT_DATASET.find((item) => item.id === selectedEventId) ?? null}
        />
      </section>
    </div>
  )
}
