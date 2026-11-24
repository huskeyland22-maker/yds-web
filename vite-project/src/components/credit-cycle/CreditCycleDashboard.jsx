import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { loadCreditCycleUiModel, UI_FEED_STATUS } from "../../credit-cycle/creditCycleBridge.js"
import {
  ANALYSIS_LENSES,
  HISTORY_COMPARE_COPY,
  INDICATOR_DETAIL_COPY,
  REGIME_GUIDE,
  STRATEGY_FRAMES,
  STRATEGY_LINK_INTRO,
  TABS,
  buildIndicatorAnalysis,
  buildSummaryAnalysis,
  summarizeCciPath,
} from "../../credit-cycle/creditCycleContent.js"

function fmt(n, suffix = "") {
  if (n == null || !Number.isFinite(Number(n))) return "—"
  return `${n}${suffix}`
}

function deltaClass(d) {
  if (d == null) return ""
  if (d > 0) return "yds-cc__delta--up"
  if (d < 0) return "yds-cc__delta--down"
  return ""
}

function AnalysisTriad({ analysis }) {
  if (!analysis) return null
  const blocks = [
    { id: "fact", label: ANALYSIS_LENSES[0].label, lines: analysis.facts },
    { id: "interpretation", label: ANALYSIS_LENSES[1].label, lines: analysis.interpretation },
    { id: "unknown", label: ANALYSIS_LENSES[2].label, lines: analysis.unknown },
  ]
  return (
    <div className="yds-cc__triad" aria-label="분석 구분">
      {blocks.map((b) => (
        <article key={b.id} className={`yds-cc__triad-card yds-cc__triad-card--${b.id}`}>
          <h3>{b.label}</h3>
          <ul>
            {(b.lines || []).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  )
}

export default function CreditCycleDashboard() {
  const [tab, setTab] = useState("overview")
  const [model, setModel] = useState(null)
  const [selectedIndicator, setSelectedIndicator] = useState("sloos")
  const [historyEpisode, setHistoryEpisode] = useState("STRESS_2022_23")
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const dto = await loadCreditCycleUiModel()
        if (!cancelled) setModel(dto)
      } catch (e) {
        if (!cancelled) {
          setLoadError(e?.message || "load_failed")
          setModel(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const chartData = useMemo(() => {
    const hist = model?.history?.[historyEpisode]
    if (!hist?.path?.length) return []
    return hist.path.map((p) => ({
      asOf: p.asOf,
      cci: p.cci,
    }))
  }, [model, historyEpisode])

  const overviewChartData = useMemo(() => {
    if (model?.cciPath?.length) {
      return model.cciPath
        .filter((p) => p.cci != null)
        .map((p) => ({ asOf: p.asOf, cci: p.cci }))
    }
    const stress = model?.history?.STRESS_2022_23?.path
    if (stress?.length) {
      return stress.map((p) => ({ asOf: p.asOf, cci: p.cci }))
    }
    return []
  }, [model])

  if (!model) {
    return (
      <div className="yds-cc" role="status">
        <p className="yds-cc__loading">
          {loadError ? `불러오기 실패: ${loadError}` : "신용 사이클 데이터 로드 중…"}
        </p>
      </div>
    )
  }

  const feedBadge =
    model.feedStatus === UI_FEED_STATUS.LICENSE_SAFE_LOCAL
      ? model.stagingConnected && model.testSeedOnly
        ? "License-safe 로컬 · Staging(테스트 시드만)"
        : "License-safe 로컬 · NON_PIT"
      : model.feedStatus === UI_FEED_STATUS.LOCAL_CACHE
        ? model.stagingConnected && model.testSeedOnly
          ? "로컬 캐시 · Staging 연결(테스트 시드만)"
          : "로컬 캐시 관측"
        : model.feedStatus === UI_FEED_STATUS.STAGING_API
          ? model.testSeedOnly
            ? "Staging · 실제 스냅샷 미적재"
            : "Staging API · License-safe"
          : model.feedStatus === UI_FEED_STATUS.RESEARCH_SNAPSHOT
            ? "연구 PIT 스냅샷"
            : model.feedStatus === UI_FEED_STATUS.PREPARING
              ? "데이터 준비 중"
              : model.feedStatus

  return (
    <div className="yds-cc">
      <header className="yds-cc__header">
        <div>
          <p className="yds-cc__eyebrow">CREDIT CYCLE · 투자 인사이트</p>
          <h1 className="yds-cc__title">신용 사이클</h1>
          <p className="yds-cc__sub">
            금융시스템 신용위험 분석 · Panic(VIX·CNN·Put/Call)과 독립 · License-safe CCI · 저점
            매수 전략의 보조 참고
          </p>
        </div>
        <div className="yds-cc__meta">
          <span className="yds-cc__badge">{feedBadge}</span>
          <span className="yds-cc__badge yds-cc__badge--pit">{model.pitLabel}</span>
          <p className="yds-cc__meta-line">기준일 {model.asOf || "—"}</p>
          <p className="yds-cc__meta-line muted">
            갱신 {model.updatedAt ? String(model.updatedAt).slice(0, 19) : "—"}
          </p>
        </div>
      </header>

      {(model.stagingApiNote || model.testSeedOnly) && (
        <aside className="yds-cc__banner" role="status">
          <p>
            {model.stagingApiNote ||
              "Staging API 검증용 테스트 시드가 감지되었습니다. 시장 데이터로 표시하지 않습니다."}
          </p>
          {model.testSeed?.asOf && (
            <p className="yds-cc__hint">
              테스트 시드 메타: asOf={model.testSeed.asOf}
              {model.testSeed.cci != null ? ` · CCI=${model.testSeed.cci}` : ""} · 시장 관측 아님
            </p>
          )}
        </aside>
      )}

      <aside className="yds-cc__signal-note" role="note">
        CCI는 매수·매도 신호가 아닙니다. 안전·위험·매수 구간으로 단정하지 않으며, Panic 점수와
        합산하지 않습니다.
      </aside>

      <nav className="yds-cc__tabs" aria-label="신용 사이클 섹션">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`yds-cc__tab${tab === t.id ? " is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <Overview
          model={model}
          chartData={overviewChartData}
          onSelectIndicator={(id) => {
            setSelectedIndicator(id)
            setTab("indicators")
          }}
        />
      )}
      {tab === "indicators" && (
        <IndicatorDetail
          model={model}
          selectedId={selectedIndicator}
          onSelect={setSelectedIndicator}
        />
      )}
      {tab === "history" && (
        <HistoryCompare
          model={model}
          episode={historyEpisode}
          setEpisode={setHistoryEpisode}
          chartData={chartData}
          livePath={overviewChartData}
        />
      )}
      {tab === "strategy" && <StrategyBridge model={model} />}
    </div>
  )
}

function Overview({ model, chartData, onSelectIndicator }) {
  const analysis = useMemo(() => buildSummaryAnalysis(model), [model])
  const staleRows = (model.indicators || []).filter(
    (r) => !r.licenseRestricted && String(r.quality).toUpperCase() === "STALE",
  )

  return (
    <>
      <section className="yds-cc__cards" aria-label="종합 현황">
        <article className="yds-cc__card yds-cc__card--score">
          <h2>신용위험 종합 점수 (CCI)</h2>
          <p className="yds-cc__score">{model.cci == null ? "—" : model.cci}</p>
          <p className={`yds-cc__delta ${deltaClass(model.cciDelta)}`}>
            이전 대비 {model.cciDelta == null ? "—" : `${model.cciDelta > 0 ? "+" : ""}${model.cciDelta}`}
          </p>
          <ul className="yds-cc__kv">
            <li>
              <span>기준일</span>
              <strong>{model.asOf || "—"}</strong>
            </li>
            <li>
              <span>Coverage</span>
              <strong>{fmt(model.coveragePct, "%")}</strong>
            </li>
            <li>
              <span>신뢰도</span>
              <strong>{model.confidence || "—"}</strong>
            </li>
            <li>
              <span>PIT / 상태</span>
              <strong>
                {model.pitLabel} · {model.statusLabel}
              </strong>
            </li>
          </ul>
          {model.hold && <p className="yds-cc__hold">HOLD · {model.holdReason || "해석 보류"}</p>}
        </article>

        <article className="yds-cc__card yds-cc__card--regime">
          <h2>데이터 신뢰도</h2>
          <p className="yds-cc__regime-name">{model.pitLabel || "—"}</p>
          <p className="yds-cc__body">
            {model.pitLabel === "NON_PIT"
              ? "현재 표시는 NON_PIT입니다. 이후 개정·지연 발표가 반영된 vintage일 수 있어, 당시 투자자 시점의 실시간 정보처럼 읽지 마세요."
              : model.pitLabel === "PIT"
                ? "PIT로 표기된 구간은 당시 가용 정보 기준 연구 경로입니다. 상단 실데이터와 혼동하지 마세요."
                : "PIT 구분이 명확하지 않으면 해석을 보수적으로 둡니다."}
          </p>
          {staleRows.length > 0 && (
            <p className="yds-cc__stale-callout">
              STALE 지표: {staleRows.map((r) => r.label).join(", ")} · 해당 채널의 최신성을 낮게
              봅니다.
            </p>
          )}
          <p className="yds-cc__hint">
            국면 가설: {model.regime?.label || "미확정"} · 국면 ≠ 경고·매매 신호
          </p>
        </article>

        <article className="yds-cc__card yds-cc__card--summary">
          <h2>신용 환경 한줄 요약</h2>
          <ul className="yds-cc__narrative">
            {(model.narrative || []).slice(0, 4).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="yds-cc__hint">아래 분석 블록에서 사실·해석·미확인을 구분합니다.</p>
        </article>
      </section>

      <section className="yds-cc__analysis" aria-label="종합 분석">
        <div className="yds-cc__panel-head">
          <h2>현재 데이터가 말하는 것 / 말하지 못하는 것</h2>
        </div>
        <AnalysisTriad analysis={analysis} />
      </section>

      <section className="yds-cc__mid" aria-label="추세와 지표">
        <div className="yds-cc__chart-panel">
          <div className="yds-cc__panel-head">
            <h2>License-safe CCI 추이</h2>
            <span className="yds-cc__hint">
              {model.feedStatus === UI_FEED_STATUS.LICENSE_SAFE_LOCAL
                ? "License-safe NON_PIT · FRED/FDIC 캐시 · 0–100"
                : model.feedStatus === UI_FEED_STATUS.LOCAL_CACHE
                  ? "로컬 캐시 NON_PIT · 0–100 · 단위 혼용 없음"
                  : model.feedStatus === UI_FEED_STATUS.STAGING_API
                    ? "Staging license-safe · 0–100 · 테스트 시드 제외"
                    : "연구 경로 · 0–100 · 단위 혼용 없음"}
            </span>
          </div>
          {chartData.length ? (
            <div className="yds-cc__chart">
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData} margin={{ top: 12, right: 16, left: 4, bottom: 8 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.15)" strokeDasharray="3 3" />
                  <XAxis dataKey="asOf" tick={{ fill: "#94a3b8", fontSize: 11 }} minTickGap={28} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} width={40} />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: 8,
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="cci"
                    name="CCI"
                    stroke="#c4b5fd"
                    strokeWidth={3}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="yds-cc__empty">시계열 데이터 준비 중 · 임의 수치 없음</p>
          )}
        </div>

        <div className="yds-cc__table-panel">
          <div className="yds-cc__panel-head">
            <h2>핵심 지표 현황</h2>
          </div>
          <div className="yds-cc__table-wrap">
            <table className="yds-cc__table">
              <thead>
                <tr>
                  <th>지표</th>
                  <th>현재값</th>
                  <th>Δ값</th>
                  <th>위험점수</th>
                  <th>관측일</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {model.indicators.map((row) => (
                  <tr
                    key={row.id}
                    className={
                      String(row.quality).toUpperCase() === "STALE" ? "yds-cc__row--stale" : undefined
                    }
                  >
                    <td>
                      <button
                        type="button"
                        className="yds-cc__linkish"
                        onClick={() => onSelectIndicator(row.id)}
                      >
                        {row.label}
                      </button>
                    </td>
                    <td>{row.licenseRestricted ? "비공개" : fmt(row.valueDisplay)}</td>
                    <td className={deltaClass(row.valueDelta ?? row.delta)}>
                      {row.licenseRestricted ? "—" : fmt(row.valueDelta ?? row.delta)}
                    </td>
                    <td>{row.licenseRestricted ? "비공개" : fmt(row.riskScore)}</td>
                    <td>{row.observationDate || row.asOf || "—"}</td>
                    <td>
                      <span
                        className={`yds-cc__pill yds-cc__pill--${row.quality?.toLowerCase() || "na"}`}
                      >
                        {row.statusLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="yds-cc__bottom" aria-label="국면 가이드와 체크리스트">
        <div className="yds-cc__guide">
          <h2>신용 사이클 국면 가이드</h2>
          <p className="yds-cc__hint">가설 프레임 · 확정 경고 단계 아님 · 현재 강조는 참고용</p>
          <div className="yds-cc__guide-grid">
            {REGIME_GUIDE.map((g) => (
              <article
                key={g.id}
                className={`yds-cc__guide-item${model.regime?.id === g.id ? " is-current" : ""}`}
              >
                <h3>{g.title}</h3>
                <p>{g.meaning}</p>
                <p className="yds-cc__hint">{g.investorCheck}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="yds-cc__checklist">
          <h2>관찰 체크리스트</h2>
          <p className="yds-cc__hint">
            사용자 저장 아님 · 연구 점수 기반 표시 · 확정 경고·매매 신호 아님
          </p>
          <ul>
            {(model.checklist || []).map((item) => (
              <li key={item.id} className={`yds-cc__check yds-cc__check--${item.state?.toLowerCase()}`}>
                <span className="yds-cc__check-box" aria-hidden="true" />
                <span>
                  <strong>{item.label}</strong>
                  <em>{item.stateLabel}</em>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="yds-cc__foot">
        <ul>
          {(model.disclaimers || []).map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <p className="yds-cc__hint">
          경고 정책: {model.warningPolicy?.evidence} · {model.warningPolicy?.note}
        </p>
      </footer>
    </>
  )
}

function IndicatorDetail({ model, selectedId, onSelect }) {
  const preferred =
    model.indicators.find((i) => i.id === selectedId) ||
    model.indicators.find((i) => !i.licenseRestricted) ||
    model.indicators[0]
  const row = preferred
  const analysis = useMemo(() => buildIndicatorAnalysis(model, row), [model, row])
  const copy = analysis.copy || INDICATOR_DETAIL_COPY[row?.id] || {}
  const seriesData = useMemo(() => {
    if (row?.licenseRestricted || !row?.seriesPoints?.length) return []
    return row.seriesPoints.map((p) => ({
      date: p.observationDate,
      value: p.value,
    }))
  }, [row])
  const isStale = String(row?.quality).toUpperCase() === "STALE"

  return (
    <section className="yds-cc__detail">
      <div className="yds-cc__detail-nav">
        {model.indicators.map((i) => (
          <button
            key={i.id}
            type="button"
            className={`yds-cc__chip${i.id === row.id ? " is-active" : ""}${
              String(i.quality).toUpperCase() === "STALE" ? " yds-cc__chip--stale" : ""
            }`}
            onClick={() => onSelect(i.id)}
          >
            {i.label}
            {String(i.quality).toUpperCase() === "STALE" ? " · STALE" : ""}
          </button>
        ))}
      </div>
      <article className="yds-cc__detail-panel">
        <h2>{row.label}</h2>
        <p>{copy.meaning}</p>
        <p className="yds-cc__body">{copy.market}</p>
        {isStale && (
          <p className="yds-cc__stale-callout" role="status">
            이 지표는 STALE 상태입니다. 최신 시장 상태를 대표한다고 단정하지 마세요. 관측일·갱신
            지연을 함께 확인하세요.
          </p>
        )}
        <ul className="yds-cc__kv yds-cc__kv--grid">
          <li>
            <span>위험점수</span>
            <strong>{row.licenseRestricted ? "비공개" : fmt(row.riskScore)}</strong>
          </li>
          <li>
            <span>데이터 상태</span>
            <strong>
              <span className={`yds-cc__pill yds-cc__pill--${row.quality?.toLowerCase() || "na"}`}>
                {row.statusLabel}
              </span>
            </strong>
          </li>
          <li>
            <span>관측일</span>
            <strong>{row.observationDate || row.asOf || "—"}</strong>
          </li>
          <li>
            <span>CCI 기여</span>
            <strong>{row.contribution == null ? "—" : row.contribution}</strong>
          </li>
          <li>
            <span>현재 관측값</span>
            <strong>{row.licenseRestricted ? "비공개(라이선스)" : fmt(row.valueDisplay)}</strong>
          </li>
          <li>
            <span>직전 대비 Δ</span>
            <strong className={deltaClass(row.valueDelta ?? row.delta)}>
              {row.licenseRestricted ? "—" : fmt(row.valueDelta ?? row.delta)}
            </strong>
          </li>
          <li>
            <span>주기 / 단위</span>
            <strong>
              {row.frequency || "—"}
              {row.unit ? ` · ${row.unit}` : ""}
            </strong>
          </li>
          <li>
            <span>출처 / PIT</span>
            <strong>
              {row.source || copy.source || "—"} · {row.pitLabel || model.pitLabel || "—"}
            </strong>
          </li>
        </ul>
        <p className="yds-cc__body">
          <strong>위험 점수의 의미.</strong> {copy.riskMeaning || copy.cciNote}
        </p>
        <p className="yds-cc__body">
          <strong>CCI에서의 역할.</strong> {copy.role || copy.cciNote}
        </p>
        <p className="yds-cc__caution">{copy.caution}</p>

        <div className="yds-cc__analysis yds-cc__analysis--nested">
          <h3 className="yds-cc__subhead">지표 분석 구분</h3>
          <AnalysisTriad analysis={analysis} />
        </div>

        {row.licenseRestricted && (
          <p className="yds-cc__empty">
            이 지표의 수치·시계열은 라이선스 확인 전까지 노출하지 않습니다.
          </p>
        )}
        {!row.licenseRestricted && seriesData.length > 0 && (
          <div className="yds-cc__chart" style={{ marginTop: "0.75rem" }}>
            <p className="yds-cc__hint">
              원시 시계열 ({row.frequency}) · 축 단위: {row.unit || "원천 단위"}
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={seriesData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.15)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} minTickGap={28} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} width={48} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: 8,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={row.label}
                  stroke="#a78bfa"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {!row.licenseRestricted && !seriesData.length && (
          <p className="yds-cc__empty">
            원천 시계열은 로컬 캐시 연결 시에만 표시됩니다. Staging 점수·관측일·품질은 위에
            반영됩니다.
          </p>
        )}
      </article>
    </section>
  )
}

function HistoryCompare({ model, episode, setEpisode, chartData, livePath }) {
  const hist = model.history || {}
  const ep = hist[episode]
  const pathStats = useMemo(() => summarizeCciPath(livePath), [livePath])
  const similarNotes = useMemo(() => {
    if (!pathStats.count || pathStats.latest?.cci == null || pathStats.max?.cci == null) {
      return ["비교 가능한 실데이터 시계열이 없어 형태 비교를 생략합니다."]
    }
    const latest = Number(pathStats.latest.cci)
    const peak = Number(pathStats.max.cci)
    const floor = Number(pathStats.min.cci)
    return [
      `현재(${pathStats.latest.asOf}) CCI ${latest}는 이 표본의 최저 ${floor}(${pathStats.min.asOf})~최고 ${peak}(${pathStats.max.asOf}) 사이에 있습니다.`,
      "표본 내 위치는 형태 비교일 뿐, 안전·위험·매수 구간 판정이 아닙니다.",
      "과거 최고·최저와의 거리가 완화 완료나 저점 매수 신호를 의미하지 않습니다.",
      model.pitLabel === "NON_PIT"
        ? "NON_PIT이므로 당시 투자자가 실시간으로 봤던 수치와 다를 수 있습니다."
        : "PIT/NON_PIT 구분을 확인한 뒤 해석합니다.",
    ]
  }, [pathStats, model.pitLabel])

  return (
    <section className="yds-cc__history">
      <p className="yds-cc__caution">{HISTORY_COMPARE_COPY.intro}</p>
      <p className="yds-cc__hint">{HISTORY_COMPARE_COPY.noForecast}</p>

      <div className="yds-cc__chart-panel" style={{ marginBottom: "1rem" }}>
        <div className="yds-cc__panel-head">
          <h2>실데이터 CCI 시계열</h2>
          <span className="yds-cc__hint">{pathStats.note}</span>
        </div>
        {livePath?.length ? (
          <div className="yds-cc__chart">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={livePath} margin={{ top: 12, right: 16, left: 4, bottom: 8 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.15)" strokeDasharray="3 3" />
                <XAxis dataKey="asOf" tick={{ fill: "#94a3b8", fontSize: 11 }} minTickGap={28} />
                <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} width={40} />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: 8,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="cci"
                  name="License-safe CCI"
                  stroke="#c4b5fd"
                  strokeWidth={3}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="yds-cc__empty">실데이터 시계열 없음</p>
        )}
        <div className="yds-cc__cards yds-cc__cards--compact" style={{ marginTop: "0.85rem" }}>
          <article className="yds-cc__card">
            <h2>관측 수</h2>
            <p className="yds-cc__regime-name">{pathStats.count || "—"}</p>
          </article>
          <article className="yds-cc__card">
            <h2>표본 최저 / 최고</h2>
            <p className="yds-cc__body">
              {pathStats.min
                ? `${pathStats.min.cci} (${pathStats.min.asOf})`
                : "—"}{" "}
              /{" "}
              {pathStats.max
                ? `${pathStats.max.cci} (${pathStats.max.asOf})`
                : "—"}
            </p>
          </article>
          <article className="yds-cc__card">
            <h2>현재</h2>
            <p className="yds-cc__body">
              {pathStats.latest
                ? `${pathStats.latest.cci} (${pathStats.latest.asOf})`
                : "—"}
            </p>
          </article>
        </div>
        <AnalysisTriad
          analysis={{
            facts: [
              pathStats.note,
              `데이터 PIT 표기: ${model.pitLabel || "—"}`,
              ...(HISTORY_COMPARE_COPY.limits.slice(0, 1) || []),
            ],
            interpretation: similarNotes,
            unknown: HISTORY_COMPARE_COPY.limits.slice(1),
          }}
        />
      </div>

      <h3 className="yds-cc__subhead">연구용 위기 에피소드 (참고)</h3>
      <p className="yds-cc__caution">
        아래는 Phase 4 연구 PIT/NON_PIT 자료입니다. 상단 Staging·License-safe 실관측과 혼동하지
        마세요. 선행 경고 성능을 주장하지 않습니다.
      </p>
      <div className="yds-cc__episode-tabs">
        {[
          { id: "COVID", label: "COVID (PIT)" },
          { id: "STRESS_2022_23", label: "2022–23 (PIT)" },
          { id: "GFC", label: "GFC (NON_PIT)" },
        ].map((e) => (
          <button
            key={e.id}
            type="button"
            className={`yds-cc__tab${episode === e.id ? " is-active" : ""}`}
            onClick={() => setEpisode(e.id)}
          >
            {e.label}
          </button>
        ))}
      </div>
      {!ep ? (
        <p className="yds-cc__empty">비교 데이터 없음 · 연구 스냅샷 미연결 시 정상일 수 있습니다.</p>
      ) : (
        <>
          <div className="yds-cc__cards yds-cc__cards--compact">
            <article className="yds-cc__card">
              <h2>모드</h2>
              <p className="yds-cc__regime-name">{ep.mode}</p>
              <p className="yds-cc__hint">이벤트 앵커(연구): {ep.eventDate || "—"}</p>
            </article>
            <article className="yds-cc__card">
              <h2>피크 CCI</h2>
              <p className="yds-cc__score">{ep.peak?.cci ?? "—"}</p>
              <p className="yds-cc__hint">@{ep.peak?.asOf || "—"}</p>
            </article>
            <article className="yds-cc__card">
              <h2>고지</h2>
              <p className="yds-cc__body">{ep.note}</p>
            </article>
          </div>
          {ep.mode === "NON_PIT" && (
            <p className="yds-cc__caution">
              GFC는 PIT 검증 불가입니다. NON_PIT 연구 참고만 표시하며 선행 경고 성능을 주장하지
              않습니다.
            </p>
          )}
          {chartData.length ? (
            <div className="yds-cc__chart-panel">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid stroke="rgba(148,163,184,0.15)" strokeDasharray="3 3" />
                  <XAxis dataKey="asOf" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} width={36} />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: 8,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cci"
                    name="License-safe CCI"
                    stroke="#a78bfa"
                    strokeWidth={2.5}
                    dot
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="yds-cc__empty">이 에피소드의 PIT 경로 시계열이 없습니다 (GFC 등).</p>
          )}
        </>
      )}
    </section>
  )
}

function StrategyBridge({ model }) {
  const analysis = useMemo(() => buildSummaryAnalysis(model), [model])

  return (
    <section className="yds-cc__strategy">
      <p className="yds-cc__caution">{STRATEGY_LINK_INTRO.notSignal}</p>
      <p className="yds-cc__body">{STRATEGY_LINK_INTRO.role}</p>
      <p className="yds-cc__hint">{STRATEGY_LINK_INTRO.nextStep}</p>

      <div className="yds-cc__cards yds-cc__cards--compact" style={{ margin: "1rem 0" }}>
        <article className="yds-cc__card">
          <h2>현재 CCI (참고)</h2>
          <p className="yds-cc__score">{model.cci == null ? "—" : model.cci}</p>
          <p className="yds-cc__hint">
            {model.asOf || "—"} · {model.pitLabel} · Coverage {fmt(model.coveragePct, "%")}
          </p>
        </article>
        <article className="yds-cc__card">
          <h2>Buy-the-Dip과의 관계</h2>
          <p className="yds-cc__body">
            신용 환경은 저점 매수 규모·속도를 재검토하는 맥락입니다. 가격 조정의 자동
            진입 조건이 아닙니다.
          </p>
        </article>
        <article className="yds-cc__card">
          <h2>함께 볼 화면</h2>
          <p className="yds-cc__body">
            ETF 조정 매수 · 패닉·공포 매수 허브에서 가격·심리 계획을 확인하고, 여기서는 신용
            여건만 점검합니다.
          </p>
        </article>
      </div>

      <h3 className="yds-cc__subhead">보조 판단 프레임</h3>
      <div className="yds-cc__guide-grid">
        {STRATEGY_FRAMES.map((f) => (
          <article key={f.id} className="yds-cc__guide-item">
            <h3>{f.title}</h3>
            <ul>
              {f.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="yds-cc__analysis" style={{ marginTop: "1rem" }}>
        <div className="yds-cc__panel-head">
          <h2>현재 신용 관측을 전략에 연결할 때</h2>
        </div>
        <AnalysisTriad
          analysis={{
            facts: analysis.facts.slice(0, 3),
            interpretation: [
              "신용 지표 악화·STALE·Coverage 저하가 보이면 분할 매수 규모를 보수적으로 재검토할 수 있습니다.",
              "지표가 안정적이어도 가격·유동성·Panic은 별도 확인이 필요합니다.",
              ...analysis.interpretation.slice(0, 2),
            ],
            unknown: [
              "CCI만으로 저점 여부·반등 시점을 알 수 없습니다.",
              ...analysis.unknown.slice(0, 2),
            ],
          }}
        />
      </div>

      <p className="yds-cc__footer-links">
        <Link to="/daily-bottom-buy">ETF 조정 매수</Link>
        <Link to="/panic-fear-buy">패닉·공포 매수 허브</Link>
        <Link to="/market-analysis">시장 브리핑</Link>
      </p>
    </section>
  )
}
