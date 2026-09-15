import { useMemo } from "react"
import {
  buildPanicScoreV2Breakdown,
  getPanicScoreV2,
  PANIC_INDEX_STAGE_BANDS,
  resolvePanicIndexStatus,
} from "../../utils/tradingScores.js"

/** @param {number | null | undefined} n @param {number} [digits] */
function fmtNum(n, digits = 2) {
  if (n == null || !Number.isFinite(Number(n))) return "—"
  const x = Number(n)
  if (Number.isInteger(x)) return String(x)
  const f = 10 ** digits
  return String(Math.round(x * f) / f)
}

/**
 * /market-analysis 중심 — Panic Index (장기 투자 참고)
 * @param {{ panicData?: object | null; className?: string }} props
 */
export default function YdsPanicIndexCenter({ panicData = null, className = "" }) {
  const score = useMemo(() => getPanicScoreV2(panicData), [panicData])
  const status = useMemo(() => resolvePanicIndexStatus(score), [score])
  const breakdown = useMemo(() => buildPanicScoreV2Breakdown(panicData), [panicData])

  const asOfRaw = panicData?.date ?? panicData?.asOfDate ?? panicData?.updatedAt ?? null
  const asOfDate =
    asOfRaw && /^\d{4}-\d{2}-\d{2}/.test(String(asOfRaw)) ? String(asOfRaw).slice(0, 10) : null

  const markerPct = score != null ? Math.max(0, Math.min(100, score)) : null

  return (
    <section
      className={["yds-panic-center", className].filter(Boolean).join(" ")}
      aria-label="Panic Index"
    >
      {/* 1. Hero score */}
      <div className="yds-panic-center__hero">
        <p className="yds-panic-center__eyebrow">시장 공포·패닉</p>
        <h2 className="yds-panic-center__title">Panic Index</h2>
        {score != null && status ? (
          <>
            <p
              className="yds-panic-center__score font-mono tabular-nums"
              style={{ color: status.color }}
            >
              {score}
            </p>
            <p className="yds-panic-center__stage" style={{ color: status.color }}>
              {status.label}
              <span className="yds-panic-center__stage-range">
                {" "}
                ({status.min}~{status.max})
              </span>
            </p>
            <p className="yds-panic-center__lede">
              현재 시장의 공포 수준을 나타내는 지표입니다. 단기 매매 신호가 아니라 장기 투자
              판단을 보조합니다.
            </p>
          </>
        ) : (
          <div className="yds-panic-center__incomplete" role="status">
            <p className="yds-panic-center__incomplete-title">데이터 입력 필요</p>
            <p className="yds-panic-center__incomplete-body">
              VIX · CNN Fear &amp; Greed · Cboe Total P/C가 모두 있어야 Panic Index를 계산할 수
              있습니다.
            </p>
          </div>
        )}
        {asOfDate ? <p className="yds-panic-center__asof">기준일: {asOfDate}</p> : null}
      </div>

      {/* Stage bar */}
      <div className="yds-panic-center__bar-wrap" aria-hidden={score == null}>
        <div className="yds-panic-center__bar">
          {PANIC_INDEX_STAGE_BANDS.map((b) => {
            const widthPct = b.max - b.min + (b.max === 100 ? 1 : 0)
            return (
              <div
                key={b.id}
                className={[
                  "yds-panic-center__bar-seg",
                  status?.id === b.id ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{
                  width: `${widthPct}%`,
                  background: b.color,
                  opacity: status?.id === b.id ? 1 : 0.38,
                }}
                title={`${b.min}~${b.max} ${b.label}`}
              />
            )
          })}
          {markerPct != null ? (
            <span
              className="yds-panic-center__bar-marker"
              style={{ left: `calc(${markerPct}% - 7px)` }}
            />
          ) : null}
        </div>
        <div className="yds-panic-center__bar-labels">
          <span>0 평온</span>
          <span>20 경계</span>
          <span>40 공포</span>
          <span>60 강한 공포</span>
          <span>80 극심한 패닉</span>
          <span>100</span>
        </div>
      </div>

      {/* 2. Stage interpretation */}
      <div className="yds-panic-center__section">
        <h3 className="yds-panic-center__section-title">공포 수준 해석</h3>
        <ul className="yds-panic-center__stage-list">
          {PANIC_INDEX_STAGE_BANDS.map((b) => (
            <li
              key={b.id}
              className={[
                "yds-panic-center__stage-item",
                status?.id === b.id ? "is-current" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={status?.id === b.id ? { borderColor: b.color } : undefined}
            >
              <span className="yds-panic-center__stage-item-label" style={{ color: b.color }}>
                {b.min}~{b.max} {b.label}
              </span>
              <span className="yds-panic-center__stage-item-blurb">{b.blurb}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 3. Core metrics */}
      <div className="yds-panic-center__section">
        <h3 className="yds-panic-center__section-title">핵심 3개 지표</h3>
        <ul className="yds-panic-center__metrics">
          {(breakdown?.lines ?? []).map((line) => (
            <li key={line.id} className="yds-panic-center__metric">
              <div className="yds-panic-center__metric-head">
                <span className="yds-panic-center__metric-name">{line.label}</span>
                <span className="yds-panic-center__metric-src">출처: {line.source}</span>
              </div>
              <p className="yds-panic-center__metric-value font-mono tabular-nums">
                {line.value == null ? "—" : fmtNum(line.value)}
              </p>
              <div className="yds-panic-center__metric-meta">
                <span>
                  공포 점수{" "}
                  <strong className="font-mono tabular-nums">
                    {line.score == null ? "—" : fmtNum(line.score, 1)}
                  </strong>
                </span>
                <span>가중치 {Math.round(line.weight * 100)}%</span>
                <span>
                  기여{" "}
                  <strong className="font-mono tabular-nums">
                    {line.contrib == null ? "—" : fmtNum(line.contrib, 1)}
                  </strong>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* 4. Calculation */}
      <div className="yds-panic-center__section">
        <h3 className="yds-panic-center__section-title">계산 상세</h3>
        {breakdown?.ok ? (
          <p className="yds-panic-center__calc font-mono tabular-nums">
            {(breakdown.lines ?? [])
              .map((l) => `${fmtNum(l.score, 1)} × ${Math.round(l.weight * 100)}%`)
              .join(" + ")}
            <span className="yds-panic-center__calc-eq">
              {" "}
              = {breakdown.rawTotal != null ? fmtNum(breakdown.rawTotal, 2) : "—"}
              {breakdown.total != null ? (
                <>
                  {" "}
                  → 최종 <strong>{breakdown.total}</strong>
                </>
              ) : null}
            </span>
          </p>
        ) : (
          <p className="yds-panic-center__calc-missing">
            일부 지표 데이터가 없어 Panic Index를 계산할 수 없습니다.
          </p>
        )}
      </div>

      {/* 5. Life investment view */}
      <div className="yds-panic-center__section yds-panic-center__section--life">
        <h3 className="yds-panic-center__section-title">인생 투자 관점에서 보기</h3>
        <p className="yds-panic-center__life-lead">
          Panic Index는 단기 매매 신호가 아닙니다. 10년 이상 장기 투자에서 시장이 크게 흔들릴 때
          현재 공포 수준을 확인하는 참고 지표입니다.
        </p>
        <ul className="yds-panic-center__life-map">
          <li>
            <strong>기본 투자</strong>
            <span>매월 적립식 지속</span>
          </li>
          <li>
            <strong>추가 투입 판단</strong>
            <span>S&amp;P500 주봉 MA40</span>
          </li>
          <li>
            <strong>시장 공포 확인</strong>
            <span>Panic Index</span>
          </li>
          <li>
            <strong>추가 투입 자금</strong>
            <span>Strategy Reserve</span>
          </li>
        </ul>
        {status ? (
          <p className="yds-panic-center__life-now">
            <strong>현재 ({status.label})</strong> — {status.lifeView}
          </p>
        ) : null}
        <p className="yds-panic-center__life-note">
          Panic Index가 높다고 해서 자동 매수·매도나 Reserve 전액 투입이 되지 않습니다. 실행
          판단은 YDS 인생 투자전략의 MA40과 Strategy Reserve에서 합니다.
        </p>
      </div>
    </section>
  )
}
