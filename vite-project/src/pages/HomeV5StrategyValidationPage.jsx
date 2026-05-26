import { useMemo } from "react"
import { Link } from "react-router-dom"
import { useAppDataStore } from "../store/appDataStore.js"
import { mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import HomeV5StrategyValidationPanel from "../home-v5/HomeV5StrategyValidationPanel.jsx"
import { HOME_V5_VALIDATION_SCENARIOS } from "../home-v5/homeV5StrategyValidation.js"

export default function HomeV5StrategyValidationPage() {
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const history = useMemo(
    () => resolveCycleHistoryRows(mergeCycleRows(storeRows ?? [], [])),
    [storeRows],
  )

  return (
    <div className="home-v5-validation-page min-w-0 px-3 py-4 sm:px-4">
      <header className="home-v5-validation-page__head">
        <div>
          <h1 className="home-v5-validation-page__title">전략 연구실 LAB</h1>
          <p className="home-v5-validation-page__sub">과거 시장 재생 · dev 전용 · /cycle과 동일 패널</p>
        </div>
        <Link to="/cycle" className="home-v5-validation-page__link">
          홈으로
        </Link>
      </header>

      <HomeV5StrategyValidationPanel historyRows={history} defaultOpen />

      <section className="home-v5-validation-panel home-v5-validation-panel--events">
        <h2 className="home-v5-validation-panel__h2">검증 이벤트</h2>
        <ul className="home-v5-validation-events">
          {HOME_V5_VALIDATION_SCENARIOS.map((s) => (
            <li key={s.id}>
              <strong>{s.label}</strong>
              <span>
                {s.start} ~ {s.end}
              </span>
              <span className="home-v5-validation-events__anchors">앵커 {s.anchors.join(", ")}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
