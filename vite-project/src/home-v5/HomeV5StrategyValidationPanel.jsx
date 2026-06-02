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
 * @param {{ row: object; active?: boolean; onSelect?: () => void }} props
 */
function StrategyResultCard({ row, active = false, onSelect }) {
  const dateText = row.date?.length >= 7 ? row.date.slice(0, 7) : row.dateLabel ?? row.date
  const lines = row.rationaleLines ?? (row.rationale ? [row.rationale] : [])

  return (
    <article
      className={[
        "home-v5-strategy-hist-card",
        row.missing ? "home-v5-strategy-hist-card--missing" : "",
        row.regimeId ? `home-v5-strategy-hist-card--${row.regimeId}` : "",
        active ? "home-v5-strategy-hist-card--active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onSelect}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onSelect()
              }
            }
          : undefined
      }
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <p className="home-v5-strategy-hist-card__date">{dateText}</p>
      <div className="home-v5-strategy-hist-card__status">
        <span className="home-v5-strategy-hist-card__label-k">상태</span>
        <span className="home-v5-strategy-hist-card__status-v">
          {row.statusEmoji} {row.statusLabel}
        </span>
      </div>
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
 * @param {{
 *   scenario: { label: string }
 *   timeline: { emoji: string; label: string; dateDisplay?: string; dateLabel: string; durationDays?: number | null; regimeId?: string; date: string; missing?: boolean }[]
 *   currentIndex?: number
 *   onStepSelect?: (index: number) => void
 * }} props
 */
function RegimeTimeline({ scenario, timeline, currentIndex = -1, onStepSelect }) {
  if (!timeline?.length) return null
  const current = currentIndex >= 0 && currentIndex < timeline.length ? currentIndex : timeline.length - 1

  return (
    <div className="home-v5-strategy-validation__timeline-block">
      <p className="home-v5-strategy-validation__timeline-scenario">{scenario.label}</p>
      <div className="home-v5-strategy-validation__timeline-rail" aria-label="국면 변화 타임라인">
        {timeline.map((step, idx) => {
          const isCurrent = idx === current
          return (
            <div key={`${step.date}-${idx}`} className="home-v5-strategy-validation__timeline-unit">
              <button
                type="button"
                className={[
                  "home-v5-strategy-validation__timeline-node",
                  step.regimeId ? `home-v5-strategy-validation__timeline-node--${step.regimeId}` : "",
                  step.missing ? "is-missing" : "",
                  isCurrent ? "is-current" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                title={step.date}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => onStepSelect?.(idx)}
              >
                {(step.dateDisplay ?? step.dateLabel) ? (
                  <span className="home-v5-strategy-validation__timeline-date">
                    {step.dateDisplay ?? step.dateLabel}
                  </span>
                ) : null}
                <span className="home-v5-strategy-validation__timeline-status">
                  <span className="home-v5-strategy-validation__timeline-dot" aria-hidden>
                    {step.emoji}
                  </span>
                  <span className="home-v5-strategy-validation__timeline-label">{step.label}</span>
                </span>
                {step.durationDays != null ? (
                  <span
                    className={[
                      "home-v5-strategy-validation__timeline-duration",
                      step.regimeId
                        ? `home-v5-strategy-validation__timeline-duration--${step.regimeId}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    [유지 {step.durationDays}일]
                  </span>
                ) : null}
                {isCurrent ? (
                  <span className="home-v5-strategy-validation__timeline-now">현재</span>
                ) : null}
              </button>
              {idx < timeline.length - 1 ? (
                <span className="home-v5-strategy-validation__timeline-bridge" aria-hidden>
                  <span className="home-v5-strategy-validation__timeline-bridge-line" />
                  <span className="home-v5-strategy-validation__timeline-bridge-arrow">▶</span>
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
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
  const [replayed, setReplayed] = useState(false)
  const [timelineStepIndex, setTimelineStepIndex] = useState(-1)
  const [cardsOpen, setCardsOpen] = useState(false)
  const [logTick, setLogTick] = useState(0)

  const historyMeta = useMemo(() => {
    if (!historyRows.length) return { count: 0, from: "—", to: "—" }
    const dates = historyRows.map((r) => String(r.date ?? "").slice(0, 10)).filter(Boolean).sort()
    return { count: historyRows.length, from: dates[0], to: dates[dates.length - 1] }
  }, [historyRows])

  const grouped = useMemo(() => groupValidationByScenario(results), [results])

  const activeGroup = useMemo(() => {
    if (!grouped.length) return null
    return grouped.find((g) => g.scenario.id === scenarioId) ?? grouped[0]
  }, [grouped, scenarioId])

  const usesMock = useMemo(
    () => results.some((r) => r.dataSource === "mock" && !r.missing),
    [results],
  )

  const runValidation = useCallback(() => {
    if (!scenarioId) return
    const out = runHomeV5StrategyValidation(historyRows, "anchors", {
      persistLog: true,
      scenarioId,
      useMockFallback: true,
    })
    setResults(out)
    setCardsOpen(false)
    setReplayed(true)
    setLogTick((t) => t + 1)
    const groupedOut = groupValidationByScenario(out)
    const g = groupedOut.find((x) => x.scenario.id === scenarioId) ?? groupedOut[0]
    setTimelineStepIndex(g?.timeline?.length ? g.timeline.length - 1 : -1)
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
            <span>{open ? "전략 연구실 닫기" : "전략 연구실 보기"}</span>
            <span className="home-v5-strategy-validation__lab-tag">LAB</span>
          </span>
        </span>
        <span className="home-v5-strategy-validation__hint">{open ? "전략 검증 / 백테스트" : "기본 접힘"}</span>
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
            disabled={!scenarioId}
            onClick={runValidation}
          >
            ▶ 재생
          </button>
        </div>

        {activeGroup?.timeline?.length ? (
          <RegimeTimeline
            scenario={activeGroup.scenario}
            timeline={activeGroup.timeline}
            currentIndex={timelineStepIndex}
            onStepSelect={setTimelineStepIndex}
          />
        ) : null}

        {grouped.length > 0 ? (
          <div className="home-v5-strategy-validation__cards-toggle-wrap">
            <button
              type="button"
              className="home-v5-strategy-validation__cards-toggle"
              onClick={() => setCardsOpen((v) => !v)}
              aria-expanded={cardsOpen}
            >
              {cardsOpen ? "결과 카드 접기" : "결과 카드 펼치기"}
            </button>
          </div>
        ) : null}

        {grouped.length === 0 ? (
          <p className="home-v5-strategy-validation__empty">
            {replayed
              ? "재생 결과가 없습니다. 다른 이벤트를 선택해 보세요."
              : "이벤트를 선택한 뒤 ▶ 재생을 누르면 국면 타임라인·결과 카드가 표시됩니다."}
          </p>
        ) : cardsOpen ? (
          <div className="home-v5-strategy-validation__scenarios">
            {grouped.map(({ scenario, results: rows }) => (
              <div key={scenario.id} className="home-v5-strategy-validation__scenario">
                <div className="home-v5-strategy-validation__scenario-head">
                  <h3 className="home-v5-strategy-validation__scenario-title">재생 결과</h3>
                  <span className="home-v5-strategy-validation__scenario-range">
                    {rows.filter((r) => !r.missing).length}건 · {scenario.start} ~ {scenario.end}
                  </span>
                </div>

                <div className="home-v5-strategy-validation__cards home-v5-strategy-validation__cards--stack">
                  {rows.map((row, idx) => (
                    <StrategyResultCard
                      key={`${row.scenarioId}-${row.date}`}
                      row={row}
                      active={idx === timelineStepIndex}
                      onSelect={() => setTimelineStepIndex(idx)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="home-v5-strategy-validation__empty home-v5-strategy-validation__empty--cards-collapsed">
            타임라인 확인 후 필요할 때 결과 카드를 펼쳐보세요.
          </p>
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
