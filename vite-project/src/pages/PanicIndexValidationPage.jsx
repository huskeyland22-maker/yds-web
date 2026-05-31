import { useMemo } from "react"
import { Link } from "react-router-dom"
import { useAppDataStore } from "../store/appDataStore.js"
import { mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import { runPanicIndexAllocationBacktest } from "../trading-zone/panicIndexValidationBacktest.js"
import { MACRO_STAGE_ALLOCATION } from "../trading-zone/macroStageAllocation.js"

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

export default function PanicIndexValidationPage() {
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const history = useMemo(
    () => resolveCycleHistoryRows(mergeCycleRows(storeRows ?? [], [])),
    [storeRows],
  )

  const backtest = useMemo(() => runPanicIndexAllocationBacktest(history), [history])

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
          <h1 className="panic-validation-page__title">패닉지수 검증</h1>
          <p className="panic-validation-page__sub">
            {backtest.periodStart ?? "—"} ~ {backtest.periodEnd ?? "—"} · 동일 시장 프록시 기준
          </p>
        </div>
        <Link to="/cycle" className="panic-validation-page__link">
          매매존으로
        </Link>
      </header>

      <section className="panic-validation-vs" aria-labelledby="panic-validation-vs-title">
        <h2 id="panic-validation-vs-title" className="panic-validation-vs__title">
          패닉지수 전략 VS S&amp;P500
        </h2>
        <p className="panic-validation-vs__sub">
          전략: 거시 구간별 주식·현금 비중 · 벤치마크: 동일 기간 100% 주식(시장 프록시)
        </p>

        <div className="panic-validation-vs__head-row" aria-hidden>
          <span />
          <span className="panic-validation-vs__col-head">패닉지수 전략</span>
          <span className="panic-validation-vs__col-head">S&amp;P500</span>
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

      <section className="panic-validation-panel" aria-labelledby="panic-validation-yearly">
        <h2 id="panic-validation-yearly" className="panic-validation-panel__h2">
          연도별 성과
        </h2>
        <table className="panic-validation-year-table panic-validation-year-table--vs">
          <thead>
            <tr>
              <th scope="col">연도</th>
              <th scope="col">패닉지수 전략</th>
              <th scope="col">S&amp;P500</th>
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
        </p>
      </section>

      <section className="panic-validation-panel" aria-labelledby="panic-validation-allocation">
        <h2 id="panic-validation-allocation" className="panic-validation-panel__h2">
          거시 단계 → 권장 비중
        </h2>
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
    </div>
  )
}
