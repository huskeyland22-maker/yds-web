import { useMemo } from "react"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildVixSensitivityLabReport,
  CURRENT_PANIC_BUY_MIN,
  HISTORIC_PANIC_MIN,
  VIX_EXPERIMENT_ANCHORS,
  VIX_EXPERIMENT_NOTE,
} from "../../trading-zone/ydsVixSensitivityLab.js"

function formatDelta(delta) {
  if (delta == null || !Number.isFinite(delta)) return "—"
  return delta > 0 ? `+${delta}` : `${delta}`
}

function formatGap(current, experimental) {
  if (current == null || experimental == null) return "—"
  const widened = experimental > current
  return `${current} → ${experimental}${widened ? " (확대)" : experimental < current ? " (축소)" : ""}`
}

/**
 * @param {{ events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[] }} props
 */
export default function YdsVixSensitivityLabSection({ events = YDS_VALIDATION_EVENT_DATASET }) {
  const report = useMemo(() => buildVixSensitivityLabReport(events), [events])
  const { rows, validationGoals, notes } = report
  const { gapAnalysis, historicPanic, panicBuy } = validationGoals

  return (
    <section
      className="panic-validation-panel yds-vix-lab"
      aria-labelledby="yds-vix-lab-title"
    >
      <h2 id="yds-vix-lab-title" className="panic-validation-panel__h2">
        VIX 민감도 실험실
      </h2>
      <p className="panic-validation-panel__note">
        검증 페이지 전용 · `getFinalScore`·기존 UI·프로덕션 미반영
      </p>

      <article className="yds-vix-lab__experiment-a" aria-label="실험 A VIX 앵커">
        <p className="m-0 panic-validation-panel__h3">실험 A — VIX 극단 구간 점수</p>
        <table className="panic-validation-year-table yds-vix-lab__anchor-table">
          <thead>
            <tr>
              <th scope="col">VIX</th>
              <th scope="col">현재 (40+ 캡)</th>
              <th scope="col">실험 scoreVIX</th>
            </tr>
          </thead>
          <tbody>
            {VIX_EXPERIMENT_ANCHORS.filter((a) => a.vix >= 40).map((anchor) => (
              <tr key={anchor.vix}>
                <td className="font-mono tabular-nums">{anchor.vix}</td>
                <td className="font-mono tabular-nums">100</td>
                <td className="font-mono tabular-nums">{anchor.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="m-0 yds-event-detail__hint">{VIX_EXPERIMENT_NOTE}</p>
      </article>

      <div className="yds-panic-validation__block">
        <p className="m-0 panic-validation-panel__h3">실험 B — 패닉 6건 최고 YDS 재계산</p>
        <table className="panic-validation-year-table panic-validation-year-table--vs yds-panic-validation__table">
          <thead>
            <tr>
              <th scope="col">이벤트</th>
              <th scope="col">현재 YDS</th>
              <th scope="col">실험 YDS</th>
              <th scope="col">변화량</th>
              <th scope="col">최고 시점</th>
              <th scope="col">실험 구간(현재 밴드)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td className="font-mono tabular-nums">{row.currentMaxYds}</td>
                <td className="font-mono tabular-nums yds-vix-lab__exp-score">{row.experimentalMaxYds}</td>
                <td className="font-mono tabular-nums yds-vix-lab__delta">{formatDelta(row.delta)}</td>
                <td className="font-mono tabular-nums">
                  {row.peakMilestone} · {row.peakDate}
                </td>
                <td>
                  {row.experimentalStageCurrentBands?.emoji} {row.experimentalStageCurrentBands?.label ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <article className="yds-vix-lab__goals" aria-label="검증 목표">
        <p className="m-0 panic-validation-panel__h3">검증 목표</p>

        <div className="yds-vix-lab__goal-item">
          <p className="m-0 yds-vix-lab__goal-title">
            1. 리먼 &gt; 코로나 &gt; 엔캐리 격차 확대
          </p>
          <ul className="yds-vix-lab__insights">
            <li>
              리먼−코로나: {formatGap(gapAnalysis.lehmanMinusCovid.current, gapAnalysis.lehmanMinusCovid.experimental)}
            </li>
            <li>
              코로나−엔캐리: {formatGap(gapAnalysis.covidMinusYen.current, gapAnalysis.covidMinusYen.experimental)}
            </li>
            <li>
              리먼−엔캐리(전체 스팬):{" "}
              {formatGap(gapAnalysis.lehmanMinusYen.current, gapAnalysis.lehmanMinusYen.experimental)}
            </li>
            <li>
              순서 유지(실험): {validationGoals.orderPreserved ? "✓ 예" : "✗ 아니오"}
              · 코로나−엔캐리 격차: {validationGoals.covidYenGapWidened ? "✓ 확대" : "—"}
              · 전체 스팬: {validationGoals.spanWidened ? "✓ 확대" : "—"}
            </li>
          </ul>
        </div>

        <div className="yds-vix-lab__goal-item">
          <p className="m-0 yds-vix-lab__goal-title">
            2. 역사적패닉({HISTORIC_PANIC_MIN}+) 별도 구간 분리
          </p>
          <p className="m-0 yds-vix-lab__goal-verdict">
            {historicPanic.exists ? (
              <>
                <strong>분리 가능</strong> — 실험 최고 YDS {HISTORIC_PANIC_MIN}+ 이벤트 {historicPanic.count}건
              </>
            ) : (
              <>
                <strong>미분리</strong> — 표본 내 실험 최고 YDS가 {HISTORIC_PANIC_MIN} 미만
              </>
            )}
          </p>
          {historicPanic.events.length > 0 && (
            <ul className="yds-vix-lab__insights">
              {historicPanic.events.map((e) => (
                <li key={e.name}>
                  {e.name}: YDS {e.score} ({e.stage ?? "—"})
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="yds-vix-lab__goal-item">
          <p className="m-0 yds-vix-lab__goal-title">
            3. 패닉매수({CURRENT_PANIC_BUY_MIN}+) 발생 (현재 구간 기준 · 실험 점수)
          </p>
          <p className="m-0 yds-vix-lab__goal-verdict">
            {panicBuy.exists ? (
              <>
                <strong>발생</strong> — {panicBuy.count}건이 현재 밴드 패닉매수({CURRENT_PANIC_BUY_MIN}+) 해당
              </>
            ) : (
              <>
                <strong>미발생</strong> — 실험 최고 YDS도 {CURRENT_PANIC_BUY_MIN} 미만
              </>
            )}
          </p>
          {panicBuy.events.length > 0 && (
            <ul className="yds-vix-lab__insights">
              {panicBuy.events.map((e) => (
                <li key={e.name}>
                  {e.name}: YDS {e.score} → {e.stage}
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>

      <ul className="yds-vix-lab__notes">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  )
}
