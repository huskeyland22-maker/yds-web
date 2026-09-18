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
 * /market-analysis — Panic Index research desk (UI only)
 * 순서: 현재 점수 → History(slot) → Drivers → FEAR SCALE → Long-Term
 * @param {{
 *   panicData?: object | null
 *   className?: string
 *   historySlot?: import("react").ReactNode
 * }} props
 */
export default function YdsPanicIndexCenter({
  panicData = null,
  className = "",
  historySlot = null,
}) {
  const score = useMemo(() => getPanicScoreV2(panicData), [panicData])
  const status = useMemo(() => resolvePanicIndexStatus(score), [score])
  const breakdown = useMemo(() => buildPanicScoreV2Breakdown(panicData), [panicData])

  const asOfRaw = panicData?.date ?? panicData?.asOfDate ?? panicData?.updatedAt ?? null
  const asOfDate =
    asOfRaw && /^\d{4}-\d{2}-\d{2}/.test(String(asOfRaw)) ? String(asOfRaw).slice(0, 10) : null

  const markerPct = score != null ? Math.max(0, Math.min(100, score)) : null

  return (
    <article
      className={["yds-panic-center", "yds-panic-center--research", className]
        .filter(Boolean)
        .join(" ")}
      aria-label="Panic Index"
    >
      <header className="yds-panic-center__hero">
        <div className="yds-panic-center__hero-top">
          <p className="yds-panic-center__label">PANIC INDEX</p>
          {asOfDate ? (
            <p className="yds-panic-center__asof">As of {asOfDate}</p>
          ) : null}
        </div>

        {score != null && status ? (
          <div className="yds-panic-center__metric-stack">
            <p className="yds-panic-center__score font-mono tabular-nums">{score}</p>
            <div className="yds-panic-center__stage-row">
              <p
                className="yds-panic-center__stage"
                style={status.color ? { color: status.color } : undefined}
              >
                {status.label}
              </p>
              <p className="yds-panic-center__stage-range font-mono tabular-nums">
                {status.min}–{status.max}
              </p>
            </div>
            <p className="yds-panic-center__scale-hint font-mono tabular-nums">0–100</p>
          </div>
        ) : (
          <div className="yds-panic-center__incomplete" role="status">
            <p className="yds-panic-center__incomplete-title">데이터 입력 필요</p>
            <p className="yds-panic-center__incomplete-body">
              VIX · CNN Fear &amp; Greed · Cboe Total P/C가 모두 있어야 계산할 수 있습니다.
            </p>
          </div>
        )}

        <p className="yds-panic-center__lede">
          현재 시장의 공포 수준을 나타내는 장기 투자 참고 지표입니다. 단기 매매 신호가 아닙니다.
        </p>
      </header>

      <div className="yds-panic-center__scale" aria-hidden={score == null}>
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
                }}
                title={`${b.label} ${b.min}–${b.max}`}
              />
            )
          })}
          {markerPct != null ? (
            <span
              className="yds-panic-center__bar-marker"
              style={{ left: `${markerPct}%` }}
              title={`${score}`}
            />
          ) : null}
        </div>
        <div className="yds-panic-center__bar-labels font-mono tabular-nums">
          <span>0</span>
          <span>20</span>
          <span>40</span>
          <span>60</span>
          <span>80</span>
          <span>100</span>
        </div>
      </div>

      {historySlot ? (
        <div className="yds-panic-center__history-slot">{historySlot}</div>
      ) : null}

      <section className="yds-panic-center__block">
        <h3 className="yds-panic-center__block-label">PANIC DRIVERS</h3>
        <div className="yds-panic-center__drivers-wrap">
          <table className="yds-panic-center__drivers">
            <thead>
              <tr>
                <th scope="col">지표</th>
                <th scope="col" className="is-num">
                  Value
                </th>
                <th scope="col" className="is-num">
                  Score
                </th>
                <th scope="col" className="is-num">
                  Weight
                </th>
                <th scope="col" className="is-num">
                  Contribution
                </th>
              </tr>
            </thead>
            <tbody>
              {(breakdown?.lines ?? []).map((line) => (
                <tr key={line.id}>
                  <th scope="row">
                    <span className="yds-panic-center__driver-name">{line.label}</span>
                    <span className="yds-panic-center__driver-src">{line.source}</span>
                  </th>
                  <td className="is-num font-mono tabular-nums">
                    {line.value == null ? "—" : fmtNum(line.value)}
                  </td>
                  <td className="is-num font-mono tabular-nums">
                    {line.score == null ? "—" : fmtNum(line.score, 1)}
                  </td>
                  <td className="is-num font-mono tabular-nums">
                    {Math.round(line.weight * 100)}%
                  </td>
                  <td className="is-num font-mono tabular-nums">
                    {line.contrib == null ? "—" : fmtNum(line.contrib, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
            {breakdown?.ok ? (
              <tfoot>
                <tr>
                  <th scope="row">Weighted total</th>
                  <td colSpan={3} />
                  <td className="is-num font-mono tabular-nums">
                    {breakdown.rawTotal != null ? fmtNum(breakdown.rawTotal, 2) : "—"}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>

        <ul className="yds-panic-center__drivers-mobile">
          {(breakdown?.lines ?? []).map((line) => (
            <li key={line.id}>
              <div className="yds-panic-center__drivers-mobile-head">
                <span>{line.label}</span>
                <span className="yds-panic-center__driver-src">{line.source}</span>
              </div>
              <dl>
                <div>
                  <dt>Value</dt>
                  <dd className="font-mono tabular-nums">
                    {line.value == null ? "—" : fmtNum(line.value)}
                  </dd>
                </div>
                <div>
                  <dt>Score</dt>
                  <dd className="font-mono tabular-nums">
                    {line.score == null ? "—" : fmtNum(line.score, 1)}
                  </dd>
                </div>
                <div>
                  <dt>Weight</dt>
                  <dd className="font-mono tabular-nums">{Math.round(line.weight * 100)}%</dd>
                </div>
                <div>
                  <dt>Contrib.</dt>
                  <dd className="font-mono tabular-nums">
                    {line.contrib == null ? "—" : fmtNum(line.contrib, 1)}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>

        <div className="yds-panic-center__calc-block">
          <p className="yds-panic-center__block-label">SCORE CALCULATION</p>
          {breakdown?.ok ? (
            <pre className="yds-panic-center__calc font-mono tabular-nums">
              {(breakdown.lines ?? [])
                .map((l, i) => {
                  const term = `${fmtNum(l.score, 1)} × ${Math.round(l.weight * 100)}%`
                  return i === 0 ? term : `+ ${term}`
                })
                .join("\n")}
              {`\n= ${breakdown.rawTotal != null ? fmtNum(breakdown.rawTotal, 2) : "—"}`}
              {breakdown.total != null ? `  →  ${breakdown.total}` : ""}
            </pre>
          ) : (
            <p className="yds-panic-center__calc-missing">
              일부 지표가 없어 Panic Index를 계산할 수 없습니다.
            </p>
          )}
        </div>
      </section>

      <section className="yds-panic-center__block">
        <h3 className="yds-panic-center__block-label">FEAR SCALE</h3>
        <table className="yds-panic-center__scale-table">
          <tbody>
            {PANIC_INDEX_STAGE_BANDS.map((b) => {
              const isCurrent = status?.id === b.id
              return (
                <tr key={b.id} className={isCurrent ? "is-current" : undefined}>
                  <th scope="row">
                    <span className="yds-panic-center__stage-cell">
                      <span
                        className="yds-panic-center__dot"
                        style={{ background: b.color }}
                        aria-hidden
                      />
                      <span className="yds-panic-center__stage-name">{b.label}</span>
                      {isCurrent ? (
                        <span className="yds-panic-center__now-badge">현재</span>
                      ) : null}
                    </span>
                  </th>
                  <td className="yds-panic-center__td-range font-mono tabular-nums">
                    {b.min}–{b.max}
                  </td>
                  <td className="yds-panic-center__td-blurb">{b.blurb}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="yds-panic-center__block yds-panic-center__block--note">
        <h3 className="yds-panic-center__block-label">LONG-TERM INVESTOR VIEW</h3>
        <div className="yds-panic-center__life-card">
          <p className="yds-panic-center__life-kicker">참고 지표 · 매매 신호 아님</p>
          <p className="yds-panic-center__life-lead">
            Panic Index는 단기 매매 신호가 아닙니다. 10년 이상 장기 투자에서 시장이 크게 흔들릴 때
            공포 수준을 확인하는 참고 지표입니다.
          </p>
          <dl className="yds-panic-center__life-defs">
            <div>
              <dt>기본 투자</dt>
              <dd>매월 적립식 지속</dd>
            </div>
            <div>
              <dt>장기 추가 투입 기준</dt>
              <dd>S&amp;P500 주봉 MA40</dd>
            </div>
            <div>
              <dt>시장 공포 확인</dt>
              <dd>Panic Index</dd>
            </div>
            <div>
              <dt>추가 투입 자금</dt>
              <dd>Strategy Reserve</dd>
            </div>
          </dl>
          {status ? (
            <p className="yds-panic-center__life-now">
              현재 · {status.label} — {status.lifeView}
            </p>
          ) : null}
          <p className="yds-panic-center__life-note">
            Panic Index가 높다고 해서 자동 매수·매도나 Reserve 전액 투입이 되지 않습니다. 실행
            판단은 YDS 인생 투자전략의 MA40과 Strategy Reserve에서 합니다.
          </p>
        </div>
      </section>
    </article>
  )
}
