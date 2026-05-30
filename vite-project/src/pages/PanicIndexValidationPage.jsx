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

export default function PanicIndexValidationPage() {
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const history = useMemo(
    () => resolveCycleHistoryRows(mergeCycleRows(storeRows ?? [], [])),
    [storeRows],
  )

  const backtest = useMemo(() => runPanicIndexAllocationBacktest(history), [history])

  return (
    <div className="panic-validation-page min-w-0 px-3 py-4 sm:px-4">
      <header className="panic-validation-page__head">
        <div>
          <h1 className="panic-validation-page__title">패닉지수 검증</h1>
          <p className="panic-validation-page__sub">
            거시 구간별 권장 비중 · {backtest.periodStart ?? "—"} ~ {backtest.periodEnd ?? "—"} (
            {backtest.spanYears != null ? `${backtest.spanYears.toFixed(1)}년` : "—"} 구간)
          </p>
        </div>
        <Link to="/cycle" className="panic-validation-page__link">
          매매존으로
        </Link>
      </header>

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

      <section className="panic-validation-panel" aria-labelledby="panic-validation-backtest">
        <h2 id="panic-validation-backtest" className="panic-validation-panel__h2">
          5년+ 백테스트 (주간 리밸런싱)
        </h2>
        <p className="panic-validation-panel__note">
          패닉지수(동적 VIX·CNN·BofA·HY)로 거시 구간을 판정하고, 구간별 주식·현금 비중을 적용한
          시뮬레이션입니다. 시장 수익은 Fear&amp;Greed·VIX 변화로 근사하며, 월간 앵커 히스토리와
          저장된 실측 히스토리를 병합합니다.
        </p>

        {!backtest.ok && backtest.reason === "insufficient_data" ? (
          <p className="panic-validation-panel__warn">표본이 부족해 요약을 계산하지 못했습니다.</p>
        ) : null}

        <div className="panic-validation-kpi">
          <div className="panic-validation-kpi__card">
            <p className="panic-validation-kpi__label">평균 수익률 (연)</p>
            <p className="panic-validation-kpi__value font-mono tabular-nums">
              {formatPct(backtest.avgReturnPct)}
            </p>
          </div>
          <div className="panic-validation-kpi__card">
            <p className="panic-validation-kpi__label">최대 낙폭 (MDD)</p>
            <p className="panic-validation-kpi__value font-mono tabular-nums text-amber-300">
              {backtest.mddPct != null ? `-${backtest.mddPct.toFixed(1)}%` : "—"}
            </p>
          </div>
          <div className="panic-validation-kpi__card">
            <p className="panic-validation-kpi__label">승률 (주간)</p>
            <p className="panic-validation-kpi__value font-mono tabular-nums">
              {backtest.winRatePct != null ? `${backtest.winRatePct.toFixed(1)}%` : "—"}
            </p>
          </div>
          <div className="panic-validation-kpi__card">
            <p className="panic-validation-kpi__label">누적 (전략)</p>
            <p className="panic-validation-kpi__value font-mono tabular-nums text-emerald-300">
              {formatPct(backtest.totalReturnPct)}
            </p>
          </div>
        </div>

        <p className="panic-validation-panel__bench">
          동일 기간 100% 주식 벤치마크 근사: {formatPct(backtest.benchmarkReturnPct)} · 표본 주{" "}
          {backtest.sampleWeeks ?? 0}
        </p>

        <h3 className="panic-validation-panel__h3">연도별 성과</h3>
        {backtest.yearlyReturns?.length ? (
          <table className="panic-validation-year-table">
            <thead>
              <tr>
                <th scope="col">연도</th>
                <th scope="col">수익률</th>
              </tr>
            </thead>
            <tbody>
              {backtest.yearlyReturns.map((row) => (
                <tr key={row.year}>
                  <td>{row.year}</td>
                  <td
                    className={
                      row.returnPct > 0
                        ? "panic-validation-year-table__up"
                        : row.returnPct < 0
                          ? "panic-validation-year-table__down"
                          : ""
                    }
                  >
                    {formatPct(row.returnPct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="panic-validation-panel__warn">연도별 데이터 없음</p>
        )}
      </section>
    </div>
  )
}
