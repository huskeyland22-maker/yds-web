import { useMemo } from "react"
import { Link } from "react-router-dom"
import { useAppDataStore } from "../store/appDataStore.js"
import { mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import {
  buildPanicBuyForwardReturns,
  buildValidationBenchmarkSeries,
  runPanicIndexAllocationBacktest,
} from "../trading-zone/panicIndexValidationBacktest.js"
import { MACRO_STAGE_ALLOCATION } from "../trading-zone/macroStageAllocation.js"
import { getTradingZonePositions } from "../trading-zone/tacticalTradingZoneData.js"
import { buildRecommendationTrackRows } from "../trading-zone/tradingZoneRecommendationTrack.js"
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
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const history = useMemo(
    () => resolveCycleHistoryRows(mergeCycleRows(storeRows ?? [], [])),
    [storeRows],
  )

  const backtest = useMemo(() => runPanicIndexAllocationBacktest(history), [history])
  const panicBuyEvents = useMemo(() => buildPanicBuyForwardReturns(history, 8), [history])
  const benchmarkSeries = useMemo(() => buildValidationBenchmarkSeries(history), [history])
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
    </div>
  )
}
