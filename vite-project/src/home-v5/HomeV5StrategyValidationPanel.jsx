import { useCallback, useId, useMemo, useState } from "react"
import {
  HOME_V5_VALIDATION_SCENARIOS,
  groupValidationByScenario,
  runHomeV5StrategyValidation,
} from "./homeV5StrategyValidation.js"
import {
  clearHomeV5StrategyLogs,
  loadHomeV5StrategyLogs,
} from "./homeV5StrategyLogPersist.js"

/**
 * @param {{ row: object }} props
 */
function StrategyResultCard({ row }) {
  const dateText = row.date?.length >= 7 ? row.date.slice(0, 7) : row.dateLabel ?? row.date
  const lines = row.rationaleLines ?? (row.rationale ? [row.rationale] : [])

  return (
    <article
      className={[
        "home-v5-strategy-hist-card",
        row.missing ? "home-v5-strategy-hist-card--missing" : "",
        row.regimeId ? `home-v5-strategy-hist-card--${row.regimeId}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="home-v5-strategy-hist-card__date">{dateText}</p>
      <p className="home-v5-strategy-hist-card__regime">
        {row.statusEmoji} {row.statusLabel}
      </p>
      <div className="home-v5-strategy-hist-card__action">
        <span className="home-v5-strategy-hist-card__label-k">행동</span>
        <span className="home-v5-strategy-hist-card__action-v">{row.action}</span>
      </div>
      <div className="home-v5-strategy-hist-card__rationale">
        <span className="home-v5-strategy-hist-card__label-k">근거</span>
        <ul className="home-v5-strategy-hist-card__rationale-list">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </article>
  )
}

/**
 * @param {{ historyRows?: object[]; defaultOpen?: boolean; compact?: boolean }} props
 */
export default function HomeV5StrategyValidationPanel({
  historyRows = [],
  defaultOpen = false,
  compact = false,
}) {
  const panelId = useId()
  const [open, setOpen] = useState(defaultOpen)
  const [scenarioId, setScenarioId] = useState(HOME_V5_VALIDATION_SCENARIOS[0]?.id ?? "")
  const [results, setResults] = useState([])
  const [logTick, setLogTick] = useState(0)

  const historyMeta = useMemo(() => {
    if (!historyRows.length) return { count: 0, from: "—", to: "—" }
    const dates = historyRows.map((r) => String(r.date ?? "").slice(0, 10)).filter(Boolean).sort()
    return { count: historyRows.length, from: dates[0], to: dates[dates.length - 1] }
  }, [historyRows])

  const grouped = useMemo(() => groupValidationByScenario(results), [results])

  const runValidation = useCallback(() => {
    if (!historyRows.length || !scenarioId) return
    const out = runHomeV5StrategyValidation(historyRows, "anchors", {
      persistLog: true,
      scenarioId,
    })
    setResults(out)
    setLogTick((t) => t + 1)
  }, [historyRows, scenarioId])

  const logCount = useMemo(() => loadHomeV5StrategyLogs().length, [results, logTick])

  return (
    <section
      className={[
        "home-v5-strategy-validation",
        compact ? "home-v5-strategy-validation--compact" : "",
        open ? "is-open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="전략 연구실 LAB"
    >
      <button
        type="button"
        className="home-v5-strategy-validation__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="home-v5-strategy-validation__toggle-main">
          <span className="home-v5-strategy-validation__title">
            <span className="home-v5-strategy-validation__chevron" aria-hidden>
              {open ? "▲" : "▼"}
            </span>
            <span>전략 연구실</span>
            <span className="home-v5-strategy-validation__lab-tag">LAB</span>
          </span>
        </span>
        <span className="home-v5-strategy-validation__hint">전략 검증 / 백테스트</span>
      </button>

      <div id={panelId} className="home-v5-strategy-validation__panel" hidden={!open}>
        <p className="home-v5-strategy-validation__meta">
          히스토리 {historyMeta.count}행 · {historyMeta.from} ~ {historyMeta.to}
          {logCount > 0 ? ` · 로그 ${logCount}건` : ""}
        </p>

        <div className="home-v5-strategy-validation__controls home-v5-strategy-validation__controls--simple">
          <label className="home-v5-strategy-validation__field">
            <span>이벤트</span>
            <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
              {HOME_V5_VALIDATION_SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="home-v5-strategy-validation__run"
            disabled={!historyRows.length || !scenarioId}
            onClick={runValidation}
          >
            ▶ 재생
          </button>
        </div>

        {grouped.length === 0 ? (
          <p className="home-v5-strategy-validation__empty">
            {historyRows.length
              ? "이벤트를 선택한 뒤 ▶ 재생을 누르면 판정·타임라인이 표시됩니다."
              : "히스토리 데이터가 없습니다. 시장 엔진 히스토리 로드 후 다시 시도하세요."}
          </p>
        ) : (
          <div className="home-v5-strategy-validation__scenarios">
            {grouped.map(({ scenario, results: rows, timeline }) => (
              <div key={scenario.id} className="home-v5-strategy-validation__scenario">
                <div className="home-v5-strategy-validation__scenario-head">
                  <h3 className="home-v5-strategy-validation__scenario-title">{scenario.label}</h3>
                  <span className="home-v5-strategy-validation__scenario-range">
                    재생 결과 {rows.filter((r) => !r.missing).length}건 · {scenario.start} ~ {scenario.end}
                  </span>
                </div>

                <div className="home-v5-strategy-validation__cards home-v5-strategy-validation__cards--stack">
                  {rows.map((row) => (
                    <StrategyResultCard key={`${row.scenarioId}-${row.date}`} row={row} />
                  ))}
                </div>

                {timeline.length > 0 ? (
                  <div className="home-v5-strategy-validation__timeline-wrap">
                    <p className="home-v5-strategy-validation__timeline-k">국면 흐름</p>
                    <div className="home-v5-strategy-validation__timeline" aria-label="국면 타임라인">
                      {timeline.map((step, idx) => (
                        <span
                          key={`${step.date}-${step.regimeId}-${idx}`}
                          className="home-v5-strategy-validation__timeline-step"
                        >
                          {idx > 0 ? (
                            <span className="home-v5-strategy-validation__timeline-arrow" aria-hidden>
                              →
                            </span>
                          ) : null}
                          <span className="home-v5-strategy-validation__timeline-emoji" title={step.date}>
                            {step.emoji}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {!compact ? (
          <div className="home-v5-strategy-validation__foot">
            <button
              type="button"
              className="home-v5-strategy-validation__link-btn"
              onClick={() => {
                clearHomeV5StrategyLogs()
                setLogTick((t) => t + 1)
              }}
            >
              저장 로그 삭제
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
