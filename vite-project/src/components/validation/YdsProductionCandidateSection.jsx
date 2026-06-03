import { useMemo, useState } from "react"
import { panicDataFromCycleRow } from "../../utils/cycleHistoryUtils.js"
import {
  isUseVixV3EngineEnabled,
  setVixV3EngineLocalOverride,
  VIX_V3_ENGINE_FLAG_KEY,
} from "../../trading-zone/ydsEngineFeatureFlag.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildProductionCandidateReport,
} from "../../trading-zone/ydsProductionCandidateReport.js"
import {
  PRODUCTION_CANDIDATE_V3_LABEL,
  PRODUCTION_CANDIDATE_V3_NOTE,
} from "../../trading-zone/ydsProductionCandidateV3.js"

function verdictYesNo(pass) {
  return pass ? "✓ 통과" : "✗ 미달"
}

/**
 * @param {{
 *   events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[]
 *   latestCycleRow?: Record<string, unknown> | null
 *   latestPanic?: Record<string, unknown> | null
 * }} props
 */
export default function YdsProductionCandidateSection({
  events = YDS_VALIDATION_EVENT_DATASET,
  latestCycleRow = null,
  latestPanic = null,
}) {
  const [flagOverride, setFlagOverride] = useState(() => isUseVixV3EngineEnabled())

  const latestSnapshot = useMemo(() => {
    if (latestPanic && typeof latestPanic === "object") {
      return {
        vix: latestPanic.vix,
        fearGreed: latestPanic.fearGreed,
        bofa: latestPanic.bofa,
        putCall: latestPanic.putCall,
        highYield: latestPanic.highYield,
        date: latestPanic.tradeDate ?? latestPanic.updatedAt ?? null,
      }
    }
    if (latestCycleRow) {
      const panic = panicDataFromCycleRow(latestCycleRow)
      if (panic) return { ...latestCycleRow, ...panic }
    }
    return null
  }, [latestCycleRow, latestPanic])

  const report = useMemo(
    () => buildProductionCandidateReport(events, { latestSnapshot }),
    [events, latestSnapshot],
  )

  const {
    allRows,
    panicRows,
    categoryGroups,
    categoryLabels,
    currentMarket,
    currentMarketInputs,
    stageBands,
    judgments,
    verdict,
    featureFlag,
    summary,
    notes,
  } = report

  const onToggleFlag = () => {
    const next = !flagOverride
    setVixV3EngineLocalOverride(next)
    setFlagOverride(next)
  }

  const activeFlag = flagOverride || featureFlag.envEnabled

  return (
    <section
      className="panic-validation-panel yds-production-candidate"
      aria-labelledby="yds-production-candidate-title"
    >
      <h2 id="yds-production-candidate-title" className="panic-validation-panel__h2">
        {PRODUCTION_CANDIDATE_V3_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        Engine Candidate #1 승격 · Feature Flag 분리 · legacy getFinalScore 기본 유지
      </p>

      <article className="yds-production-candidate__flag" aria-label="Feature Flag">
        <p className="m-0 panic-validation-panel__h3">Feature Flag — {VIX_V3_ENGINE_FLAG_KEY}</p>
        <ul className="yds-production-candidate__flag-list">
          <li>
            빌드 env: <strong>{featureFlag.envEnabled ? "ON" : "OFF"}</strong>
          </li>
          <li>
            localStorage override: <strong>{featureFlag.localOverride ? "ON" : "OFF"}</strong>
          </li>
          <li>
            활성 엔진: <strong>{activeFlag ? "VIX V3" : "Legacy (getFinalScore)"}</strong>
          </li>
        </ul>
        <button type="button" className="yds-production-candidate__flag-btn" onClick={onToggleFlag}>
          {activeFlag ? "로컬 Flag OFF (legacy)" : "로컬 Flag ON (V3 테스트)"}
        </button>
        <p className="m-0 yds-event-detail__hint">
          검증 페이지는 항상 legacy vs V3 dual 비교. 프로덕션 기본값은 Flag OFF.
        </p>
      </article>

      <article className="yds-engine-candidate__bands" aria-label="V3 후보 단계 체계">
        <p className="m-0 panic-validation-panel__h3">V3 Production Candidate 단계 (6단계)</p>
        <ul className="yds-engine-candidate__band-list">
          {stageBands.map((band) => (
            <li key={band.id} className="font-mono tabular-nums">
              {band.emoji} {band.label}{" "}
              {band.max != null ? `${band.min}~${band.max}` : `${band.min}+`}
            </li>
          ))}
        </ul>
        <p className="m-0 yds-event-detail__hint">{PRODUCTION_CANDIDATE_V3_NOTE}</p>
      </article>

      <div className="yds-panic-validation__block">
        <p className="m-0 panic-validation-panel__h3">
          패닉 6건 — 현재 엔진 vs V3 (점수·단계)
        </p>
        <table className="panic-validation-year-table panic-validation-year-table--vs yds-panic-validation__table">
          <thead>
            <tr>
              <th scope="col">이벤트</th>
              <th scope="col">현재 YDS</th>
              <th scope="col">현재 단계</th>
              <th scope="col">V3 YDS</th>
              <th scope="col">V3 단계</th>
              <th scope="col">Δ</th>
            </tr>
          </thead>
          <tbody>
            {panicRows.map((row) => (
              <tr
                key={row.id}
                className={row.stageChanged ? "yds-engine-candidate__row-changed" : ""}
              >
                <td>{row.name}</td>
                <td className="font-mono tabular-nums">{row.currentYds}</td>
                <td>{row.currentStageLabel}</td>
                <td className="font-mono tabular-nums yds-engine-candidate__v3-score">
                  {row.v3Yds}
                </td>
                <td>{row.v3StageLabel}</td>
                <td className="font-mono tabular-nums">
                  {row.delta != null ? (row.delta > 0 ? `+${row.delta}` : row.delta) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {Object.entries(categoryGroups).map(([category, rows]) => (
        <div key={category} className="yds-panic-validation__block">
          <p className="m-0 panic-validation-panel__h3">
            {categoryLabels[category] ?? category} — 단계 재분류 ({rows.length}건)
          </p>
          <table className="panic-validation-year-table panic-validation-year-table--vs yds-panic-validation__table">
            <thead>
              <tr>
                <th scope="col">이벤트</th>
                <th scope="col">현재 YDS</th>
                <th scope="col">현재 단계</th>
                <th scope="col">V3 YDS</th>
                <th scope="col">V3 단계</th>
                <th scope="col">변경</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={row.stageChanged ? "yds-engine-candidate__row-changed" : ""}
                >
                  <td>{row.name}</td>
                  <td className="font-mono tabular-nums">{row.ydsComputable ? row.currentYds : "—"}</td>
                  <td>{row.ydsComputable ? row.currentStageLabel : "—"}</td>
                  <td className="font-mono tabular-nums">{row.ydsComputable ? row.v3Yds : "—"}</td>
                  <td>{row.ydsComputable ? row.v3StageLabel : "—"}</td>
                  <td>{!row.ydsComputable ? "미입력" : row.stageChanged ? "변경" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {currentMarket.ydsComputable ? (
        <article className="yds-v3-prod-sim__current" aria-label="현재 시장">
          <p className="m-0 panic-validation-panel__h3">현재 시장 — legacy vs V3</p>
          <table className="panic-validation-year-table yds-v3-prod-sim__input-table">
            <thead>
              <tr>
                <th scope="col">VIX</th>
                <th scope="col">CNN</th>
                <th scope="col">BofA</th>
                <th scope="col">HY</th>
                <th scope="col">Put/Call</th>
                <th scope="col">현재</th>
                <th scope="col">V3</th>
                <th scope="col">단계 변화</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {currentMarketInputs.map((cell) => (
                  <td key={cell.key} className="font-mono tabular-nums">
                    {cell.value}
                  </td>
                ))}
                <td className="font-mono tabular-nums">{currentMarket.currentYds}</td>
                <td className="font-mono tabular-nums yds-engine-candidate__v3-score">
                  {currentMarket.v3Yds}
                </td>
                <td>
                  {currentMarket.stageChanged
                    ? `${currentMarket.currentStageLabel} → ${currentMarket.v3StageLabel}`
                    : `${currentMarket.currentStageLabel} (유지)`}
                </td>
              </tr>
            </tbody>
          </table>
        </article>
      ) : null}

      <article className="yds-engine-candidate__validation" aria-label="최종 판정">
        <p className="m-0 panic-validation-panel__h3">최종 리포트</p>
        <ol className="yds-engine-candidate__check-list">
          <li>
            <strong>단계 설명력 증가</strong> — {verdictYesNo(judgments.explainabilityIncreased.pass)}
            <span className="yds-engine-candidate__check-detail">
              {judgments.explainabilityIncreased.detail}
            </span>
          </li>
          <li>
            <strong>역사적 패닉 분리</strong> — {verdictYesNo(judgments.historicPanicSeparated.pass)}
            <span className="yds-engine-candidate__check-detail">
              {judgments.historicPanicSeparated.detail}
            </span>
          </li>
          <li>
            <strong>현재 시장 왜곡 없음</strong> — {verdictYesNo(judgments.currentMarketOk.pass)}
            <span className="yds-engine-candidate__check-detail">
              {judgments.currentMarketOk.detail}
            </span>
          </li>
          <li>
            <strong>사용자 철학 일치</strong> — {verdictYesNo(judgments.philosophyAligned.pass)}
            <span className="yds-engine-candidate__check-detail">
              {judgments.philosophyAligned.detail}
            </span>
          </li>
        </ol>
        <p className="m-0 yds-event-detail__hint">
          전체 {summary.totalEvents}건 · 계산 가능 {summary.computableEvents}건 · 단계 변경{" "}
          {summary.stageChangedCount}건 · 현재 5단계 vs V3 6단계
        </p>
      </article>

      <article
        className={`yds-engine-candidate__verdict yds-engine-candidate__verdict--${verdict.id === "A" ? "adopt" : verdict.id === "C" ? "reject" : "needs_validation"}`}
        aria-label="프로덕션 승격 판정"
      >
        <p className="m-0 panic-validation-panel__h3">프로덕션 승격 판정</p>
        <p className="m-0 yds-engine-candidate__verdict-label">
          {verdict.emoji} {verdict.label}
        </p>
        <p className="m-0 yds-engine-candidate__verdict-summary">
          {verdict.summary} ({verdict.passCount}/{verdict.totalChecks})
        </p>
      </article>

      <ul className="yds-engine-candidate__notes">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  )
}
