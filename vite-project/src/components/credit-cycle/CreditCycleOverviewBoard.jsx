/**
 * Credit Cycle Overview Board — reference 4-zone layout.
 * Independent of CreditCycleDashboard.jsx / yds-credit-cycle.css (protected).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { loadIntegratedCreditAnalysis } from "../../credit-cycle/integratedCreditAnalysisAdapter.js"
import { buildCreditCycleOverviewFromIntegrated } from "../../credit-cycle/creditCycleOverviewAdapter.js"
import { HISTORY_COMPARE_COPY, STRATEGY_FRAMES } from "../../credit-cycle/creditCycleContent.js"
import YdsPositionGauge from "../home/YdsPositionGauge.jsx"
import "../../styles/yds-credit-cycle-overview.css"

export default function CreditCycleOverviewBoard() {
  const [tab, setTab] = useState("overview")
  const [integrated, setIntegrated] = useState(null)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState("CREDIT_SUPPLY_SLOOS_CI_STANDARDS_LARGE_MEDIUM")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const dto = await loadIntegratedCreditAnalysis()
        if (!cancelled) setIntegrated(dto)
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "load_failed")
          setIntegrated(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const view = useMemo(
    () => buildCreditCycleOverviewFromIntegrated(integrated),
    [integrated],
  )

  if (!view.ready) {
    return (
      <div className="yds-cco" role="status">
        <p className="yds-cco__loading">
          {error ? `불러오기 실패: ${error}` : "신용 사이클 데이터 로드 중…"}
        </p>
      </div>
    )
  }

  return (
    <div className="yds-cco" data-section="credit-cycle-overview-board">
      <header className="yds-cco__header">
        <div className="yds-cco__header-main">
          <span className="yds-cco__shield" aria-hidden>
            ◈
          </span>
          <div>
            <h1 className="yds-cco__title">
              신용 사이클 <span className="yds-cco__title-en">Credit Cycle</span>
            </h1>
            <p className="yds-cco__sub">
              신용 경색을 미리 감지하는 금융시장 신용 위험 모니터링
            </p>
          </div>
        </div>
        <div className="yds-cco__meta">
          <p className="yds-cco__stamp">
            CORE 관측: <strong>{view.dateSplit?.core_observation || view.asOf || "—"}</strong>
            {view.dateSplit?.core_retrieval ? (
              <>
                {" "}
                · 수집 <strong>{view.dateSplit.core_retrieval}</strong>
              </>
            ) : null}
          </p>
          <p className="yds-cco__stamp">
            SOFR: <strong>{view.dateSplit?.sofr_observation || "—"}</strong>
            {" · "}
            ON RRP: <strong>{view.dateSplit?.on_rrp_observation || "—"}</strong>
            <em> (날짜 분리 · 단일 최신 주장 없음)</em>
          </p>
          <span className="yds-cco__badge">{view.feedBadge}</span>
          {view.pitLabel ? <span className="yds-cco__badge">{view.pitLabel}</span> : null}
        </div>
      </header>

      {view.stagingNote ? (
        <aside className="yds-cco__banner" role="status">
          {view.stagingNote}
        </aside>
      ) : null}

      <nav className="yds-cco__tabs" aria-label="신용 사이클 섹션">
        {view.tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`yds-cco__tab${tab === t.id ? " is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <OverviewZones
          view={view}
          onSelectIndicator={(id) => {
            setSelectedId(id)
            setTab("indicators")
          }}
        />
      )}
      {tab === "indicators" && (
        <IndicatorsTab
          view={view}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      )}
      {tab === "history" && <HistoryTab view={view} />}
      {tab === "strategy" && <RiskReportTab view={view} />}
    </div>
  )
}

function OverviewZones({ view, onSelectIndicator }) {
  return (
    <>
      <section className="yds-cco__hero" aria-label="핵심 대시보드">
        <article className="yds-cco__card">
          <h2>신용 사이클 위험 지수</h2>
          <div className="yds-cco__gauge-wrap">
            <YdsPositionGauge model={view.gauge} title="" size="panel" />
          </div>
          <p className="yds-cco__note">
            주엔진 CORE R_core · λ=0(유동성 미합산) · CCI와 합산하지 않음 · Panic 제외 ·{" "}
            {view.pitLabel || "—"}
            {view.statusLabel ? ` · ${view.statusLabel}` : ""}
          </p>
        </article>

        <article className="yds-cco__card">
          <h2>신용 사이클 국면</h2>
          <p className={`yds-cco__regime-line is-${view.regime.tone}`}>
            <span className="yds-cco__dot" aria-hidden />
            <strong>
              {view.regime.labelKo}
              {view.regime.id ? ` (${view.regime.id === "Expansion" ? "Expanding" : view.regime.id})` : ""}
            </strong>
          </p>
          <p className="yds-cco__regime-body">{view.regime.meaning}</p>
          {view.regime.investorCheck ? (
            <p className="yds-cco__hint">{view.regime.investorCheck}</p>
          ) : null}
          <dl className="yds-cco__kv">
            <div>
              <dt>Coverage</dt>
              <dd>{fmtPct(view.coveragePct)}</dd>
            </div>
            <div>
              <dt>PIT</dt>
              <dd>{view.pitLabel || "—"}</dd>
            </div>
            <div>
              <dt>상태</dt>
              <dd>{view.statusLabel || "—"}</dd>
            </div>
          </dl>
        </article>

        <article className="yds-cco__card">
          <h2>
            핵심 요약 <em>(직전 대비)</em>
          </h2>
          <ul className="yds-cco__summary">
            {view.summary.map((m) => (
              <li key={m.id} className={`is-${m.tone}`}>
                <button
                  type="button"
                  className="yds-cco__summary-btn"
                  onClick={() => m.available && onSelectIndicator(m.id)}
                  disabled={!m.available}
                >
                  <span className="mark" aria-hidden>
                    {m.mark}
                  </span>
                  <span className="label">{m.label}</span>
                  <span className="status">{m.status}</span>
                  <span className="detail">{m.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="yds-cco__mid" aria-label="추세와 지표">
        <article className="yds-cco__card">
          <h2>신용 위험 주요 지표 추이</h2>
          <ul className="yds-cco__legend" aria-label="범례">
            {view.chartLegend.map((item) => (
              <li key={item.id} className={`is-${item.id}`}>
                {item.label}
                {item.state === "license"
                  ? " · 비공개"
                  : item.id === "hy" && item.state === "unwired"
                    ? " · 표 요약"
                    : item.state === "unwired"
                      ? " · 미연결"
                      : item.state === "connected"
                        ? " · 연결"
                        : " · 없음"}
              </li>
            ))}
          </ul>
          <CciChart
            points={view.chartPoints}
            yDomain={view.engine === "CORE_PRIMARY" ? ["auto", "auto"] : [0, 100]}
            seriesName={view.engine === "CORE_PRIMARY" ? "SOFR %" : "CCI"}
          />
          {view.coreHistoryPoints?.length >= 2 ? (
            <>
              <p className="yds-cco__hint" style={{ marginTop: "0.75rem" }}>
                CORE R_core 이력 (점수 0–100 · SOFR와 축 분리)
                {view.historyMeta?.comparability_warning
                  ? ` · ${view.historyMeta.comparability_warning}`
                  : ""}
              </p>
              <CciChart
                points={view.coreHistoryPoints}
                yDomain={[0, 100]}
                seriesName="R_core"
              />
            </>
          ) : null}
          {view.chartUnitNote ? <p className="yds-cco__chart-unit">{view.chartUnitNote}</p> : null}
        </article>

        <article className="yds-cco__card">
          <h2>핵심 지표 현황</h2>
          <div className="yds-cco__table-wrap">
            <table className="yds-cco__table">
              <thead>
                <tr>
                  <th>지표</th>
                  <th>현재값</th>
                  <th>직전대비</th>
                  <th>위험도</th>
                </tr>
              </thead>
              <tbody>
                {view.tableRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.label}</td>
                    <td>{row.value}</td>
                    <td className={row.deltaTone ? `is-${row.deltaTone}` : undefined}>
                      {row.delta}
                    </td>
                    <td>
                      <span className={`yds-cco__pill yds-cco__pill--${row.riskTone || "muted"}`}>
                        {row.risk}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="yds-cco__bottom" aria-label="국면 가이드와 체크리스트">
        <article className="yds-cco__card">
          <h2>신용 사이클 단계 가이드</h2>
          <ol className="yds-cco__chevrons">
            {view.diagramSteps.map((step) => (
              <li
                key={step.id}
                className={`is-${step.tone}${step.active ? " is-active" : ""}`}
              >
                <strong>
                  {step.label} <em>({step.en})</em>
                </strong>
                <span>{step.blurb}</span>
              </li>
            ))}
          </ol>
        </article>

        <article className="yds-cco__card">
          <h2>
            체크리스트 <em>| 신용 경색 사전 감지 TOP 6</em>
          </h2>
          <p className="yds-cco__hint">보조 관찰 · 저장/자동 경고 없음 · 확정 신호 아님</p>
          <ul className="yds-cco__checks">
            {view.checklist.map((item) => (
              <li
                key={item.id}
                className={`yds-cco__check yds-cco__check--${String(item.state || "").toLowerCase()}`}
              >
                <span className="yds-cco__check-box" aria-hidden />
                <span>
                  <strong>{item.label}</strong>
                  <em>{item.stateLabel}</em>
                </span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <footer className="yds-cco__foot">
        <p className="yds-cco__hint">
          실제 엔진 데이터만 표시 · 이미지 예시 수치 복사 없음 · HY/BBB는 사이클 영역만 · Panic 제외
        </p>
      </footer>
    </>
  )
}

function IndicatorsTab({ view, selectedId, onSelect }) {
  const row =
    view.indicators.find((i) => i.id === selectedId) ||
    view.indicators.find((i) => !i.licenseRestricted) ||
    view.indicators[0]
  const insight = view.insight

  return (
    <section className="yds-cco__secondary" aria-label="지표 상세">
      <article className="yds-cco__card">
        <h2>지표 상세 · CORE 8 + 유동성 2</h2>
        <p className="yds-cco__hint">
          신용 공급·대출 규모·실제 부실·SOFR·ON RRP. 개요는 4영역 요약만 유지합니다.
        </p>
        {insight ? (
          <p className="yds-cco__hint">
            {insight.core_level} · {insight.liquidity} · 다음:{" "}
            {(insight.next_watch || []).join(" / ")}
          </p>
        ) : null}
        <div className="yds-cco__chip-row">
          {view.indicators.map((i) => (
            <button
              key={i.id}
              type="button"
              className={`yds-cco__chip${row?.id === i.id ? " is-active" : ""}`}
              onClick={() => onSelect(i.id)}
            >
              {i.domain ? `${i.domain}·` : ""}
              {i.label}
            </button>
          ))}
        </div>
        {row ? (
          <>
            <dl className="yds-cco__kv">
              <div>
                <dt>지표</dt>
                <dd>{row.label}</dd>
              </div>
              <div>
                <dt>영역</dt>
                <dd>{row.domain || "—"}</dd>
              </div>
              <div>
                <dt>현재값/점수</dt>
                <dd>{row.licenseRestricted ? "비공개" : row.valueDisplay ?? "—"}</dd>
              </div>
              <div>
                <dt>관측일</dt>
                <dd>{row.licenseRestricted ? "—" : row.observationDate || row.asOf || "—"}</dd>
              </div>
              <div>
                <dt>수집일</dt>
                <dd>{row.licenseRestricted ? "—" : row.retrievalDate || "—"}</dd>
              </div>
              <div>
                <dt>발표일</dt>
                <dd>{row.licenseRestricted ? "—" : row.releaseDate || "미확인"}</dd>
              </div>
              <div>
                <dt>출처</dt>
                <dd>{row.source || "—"}</dd>
              </div>
              <div>
                <dt>품질·신선도</dt>
                <dd>
                  {row.licenseRestricted
                    ? "제한"
                    : [row.quality, row.freshnessStatus].filter(Boolean).join(" · ") || "—"}
                </dd>
              </div>
              <div>
                <dt>권리</dt>
                <dd>{row.rightsStatus || "—"}</dd>
              </div>
              <div>
                <dt>상태</dt>
                <dd>{row.statusLabel || "—"}</dd>
              </div>
            </dl>
            {row.interpretation ? (
              <p className="yds-cco__hint">해석: {row.interpretation}</p>
            ) : null}
            {Array.isArray(row.limits) && row.limits.length ? (
              <p className="yds-cco__hint">한계: {row.limits.join(" · ")}</p>
            ) : null}
          </>
        ) : (
          <p className="yds-cco__hint">표시할 지표가 없습니다.</p>
        )}
      </article>
    </section>
  )
}

function HistoryTab({ view }) {
  const episodes = Object.keys(view.history || {})
  const [episode, setEpisode] = useState(episodes[0] || "")
  const active = episode || episodes[0] || ""
  const path = view.history?.[active]?.path || []
  const points = path
    .filter((p) => p?.cci != null)
    .map((p) => ({ asOf: String(p.asOf || "").slice(0, 10), cci: Number(p.cci) }))

  return (
    <section className="yds-cco__secondary" aria-label="과거 사이클 비교">
      <article className="yds-cco__card">
        <h2>과거 사이클 비교</h2>
        <p className="yds-cco__hint">
          {HISTORY_COMPARE_COPY?.intro ||
            "확보된 이력 구간만 표시합니다. 데이터가 없으면 임의 에피소드를 만들지 않습니다."}
        </p>
        {view.historyMeta?.comparability_warning ? (
          <p className="yds-cco__hint">{view.historyMeta.comparability_warning}</p>
        ) : null}
        {view.historyMeta ? (
          <p className="yds-cco__hint">
            시계열 n={view.historyMeta.series_n} · R_core n={view.historyMeta.r_core_n} ·
            부분커버={view.historyMeta.partial_n}
          </p>
        ) : null}
        {episodes.length ? (
          <div className="yds-cco__chip-row">
            {episodes.map((id) => (
              <button
                key={id}
                type="button"
                className={`yds-cco__chip${active === id ? " is-active" : ""}`}
                onClick={() => setEpisode(id)}
              >
                {view.history?.[id]?.label || id}
              </button>
            ))}
          </div>
        ) : (
          <p className="yds-cco__hint">과거 에피소드 데이터가 아직 없습니다.</p>
        )}
        <CciChart
          points={points.length ? points : []}
          yDomain={points.length ? [0, 100] : ["auto", "auto"]}
          seriesName={points.length ? "R_core" : "—"}
        />
        {!points.length ? (
          <p className="yds-cco__hint">이력 포인트 부족 — 가짜 데이터를 표시하지 않습니다.</p>
        ) : null}
      </article>
    </section>
  )
}

function RiskReportTab({ view }) {
  const insight = view.insight
  return (
    <section className="yds-cco__secondary" aria-label="리스크 리포트">
      <article className="yds-cco__card">
        <h2>리스크 리포트</h2>
        <p className="yds-cco__hint">
          규칙 기반 인사이트 · 매수·매도 신호 아님 · Soft State 미반영 · λ=0
        </p>
        {insight ? (
          <ul className="yds-cco__summary">
            <li className="is-neutral">
              <div className="yds-cco__summary-btn" style={{ cursor: "default" }}>
                <span className="mark">•</span>
                <span className="label">CORE</span>
                <span className="status">참고</span>
                <span className="detail">{insight.core_level}</span>
              </div>
            </li>
            <li className="is-warn">
              <div className="yds-cco__summary-btn" style={{ cursor: "default" }}>
                <span className="mark">!</span>
                <span className="label">취약 영역</span>
                <span className="status">주의</span>
                <span className="detail">{insight.weakest_domain || "—"}</span>
              </div>
            </li>
            <li className="is-neutral">
              <div className="yds-cco__summary-btn" style={{ cursor: "default" }}>
                <span className="mark">•</span>
                <span className="label">유동성</span>
                <span className="status">분리</span>
                <span className="detail">{insight.liquidity}</span>
              </div>
            </li>
            <li className="is-neutral">
              <div className="yds-cco__summary-btn" style={{ cursor: "default" }}>
                <span className="mark">•</span>
                <span className="label">공급·규모·부실</span>
                <span className="status">CORE</span>
                <span className="detail">
                  {[insight.supply_quantity, insight.realized].filter(Boolean).join(" · ") || "—"}
                </span>
              </div>
            </li>
            <li className="is-good">
              <div className="yds-cco__summary-btn" style={{ cursor: "default" }}>
                <span className="mark">✓</span>
                <span className="label">한계</span>
                <span className="status">고지</span>
                <span className="detail">{(insight.limits || []).join(" · ")}</span>
              </div>
            </li>
          </ul>
        ) : (
          <ul className="yds-cco__summary">
            {(STRATEGY_FRAMES || []).slice(0, 4).map((frame) => (
              <li key={frame.id} className="is-neutral">
                <div className="yds-cco__summary-btn" style={{ cursor: "default" }}>
                  <span className="mark">•</span>
                  <span className="label">{frame.title}</span>
                  <span className="status">참고</span>
                  <span className="detail">{(frame.points || [])[0] || ""}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>
      {view.liquidityGuide ? (
        <article className="yds-cco__card" style={{ marginTop: "0.9rem" }}>
          <h2>유동성 해석 가이드</h2>
          <p className="yds-cco__hint">{view.liquidityGuide.principle}</p>
          <ul className="yds-cco__summary">
            <li className="is-neutral">
              <div className="yds-cco__summary-btn" style={{ cursor: "default" }}>
                <span className="mark">•</span>
                <span className="label">SOFR</span>
                <span className="status">관찰</span>
                <span className="detail">
                  {view.liquidityGuide.sofr?.observed} · {view.liquidityGuide.sofr?.cannot_alone}
                </span>
              </div>
            </li>
            <li className="is-neutral">
              <div className="yds-cco__summary-btn" style={{ cursor: "default" }}>
                <span className="mark">•</span>
                <span className="label">ON RRP</span>
                <span className="status">관찰</span>
                <span className="detail">
                  {view.liquidityGuide.on_rrp?.observed} · {view.liquidityGuide.on_rrp?.cannot_alone}
                </span>
              </div>
            </li>
            <li className="is-good">
              <div className="yds-cco__summary-btn" style={{ cursor: "default" }}>
                <span className="mark">✓</span>
                <span className="label">함께 확인</span>
                <span className="status">다음</span>
                <span className="detail">
                  {(view.liquidityGuide.together?.next_check || []).join(" · ")}
                </span>
              </div>
            </li>
          </ul>
        </article>
      ) : null}

      <article className="yds-cco__card" style={{ marginTop: "0.9rem" }}>
        <h2>사전 감지 체크리스트</h2>
        <ul className="yds-cco__checks">
          {view.checklist.map((item) => (
            <li
              key={item.id}
              className={`yds-cco__check yds-cco__check--${String(item.state || "").toLowerCase()}`}
            >
              <span className="yds-cco__check-box" aria-hidden />
              <span>
                <strong>{item.label}</strong>
                <em>{item.stateLabel}</em>
              </span>
            </li>
          ))}
        </ul>
      </article>
    </section>
  )
}

function useElementWidth(minWidth = 1) {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const update = () => {
      const next = Math.floor(el.getBoundingClientRect().width)
      setWidth(next >= minWidth ? next : 0)
    }
    update()
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null
    ro?.observe(el)
    window.addEventListener("resize", update)
    return () => {
      ro?.disconnect()
      window.removeEventListener("resize", update)
    }
  }, [minWidth])
  return [ref, width]
}

function CciChart({ points, yDomain = [0, 100], seriesName = "CCI" }) {
  const [wrapRef, width] = useElementWidth(40)
  const data = Array.isArray(points) ? points : []
  if (!data.length) {
    return (
      <div className="yds-cco__chart-empty" role="status">
        <p>시계열 데이터 미연결</p>
        <span>확보된 시계열만 표시합니다. 단위가 다른 지표는 같은 축에 억지로 올리지 않습니다.</span>
      </div>
    )
  }
  return (
    <div className="yds-cco__chart" ref={wrapRef}>
      {width > 0 ? (
        <AreaChart
          width={width}
          height={280}
          data={data}
          margin={{ top: 12, right: 16, left: 4, bottom: 8 }}
        >
          <defs>
            <linearGradient id="ydsCcoCciFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#a855f7" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(148,163,184,0.14)" vertical={false} />
          <XAxis
            dataKey="asOf"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            minTickGap={36}
            tickFormatter={(v) => String(v).slice(0, 7)}
          />
          <YAxis domain={yDomain} tick={{ fill: "#94a3b8", fontSize: 11 }} width={40} />
          <Tooltip
            contentStyle={{
              background: "#12162a",
              border: "1px solid rgba(148,163,184,0.25)",
              borderRadius: 8,
            }}
            formatter={(value) => [`${value}`, seriesName]}
            labelFormatter={(label) => `기준 ${label}`}
          />
          <Area
            type="monotone"
            dataKey="cci"
            name={seriesName}
            stroke="#c084fc"
            strokeWidth={2.5}
            fill="url(#ydsCcoCciFill)"
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
        </AreaChart>
      ) : (
        <div className="yds-cco__chart-empty">차트 영역 준비 중…</div>
      )}
      <p className="yds-cco__chart-unit">단위: {seriesName}</p>
    </div>
  )
}

function fmtPct(v) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  return `${v}%`
}
