import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useAppDataStore } from "../store/appDataStore.js"
import { usePanicStore } from "../store/panicStore.js"
import { panicDataFromCycleRow, latestCycleHistoryRow } from "../utils/cycleHistoryUtils.js"
import AppReleaseEnvBadge from "../components/AppReleaseEnvBadge.jsx"
import { checkCycleHistoryIntegrity } from "../admin/adminDataIntegrity.js"
import {
  fetchBuildMeta,
  probeApiHealth,
  readNavigationTiming,
  readCacheStatus,
  buildPanicMetricStatus,
} from "../admin/adminDashboardProbes.js"
import { ADMIN_FUTURE_METRICS } from "../admin/adminFutureMetrics.js"
import { isPanicHubEnabled } from "../config/api.js"

const AI_REPORT_COUNT_KEY = "yds-admin-ai-report-success-count"

function formatTs(value) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 19)
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
}

function toneClass(tone) {
  if (tone === "ok") return "yds-admin__tone--ok"
  if (tone === "warn") return "yds-admin__tone--warn"
  if (tone === "critical") return "yds-admin__tone--critical"
  return "yds-admin__tone--neutral"
}

function MetricCell({ label, value, sub, tone = "neutral" }) {
  return (
    <div className={`yds-admin__metric ${toneClass(tone)}`}>
      <span className="yds-admin__metric-key">{label}</span>
      <strong className="yds-admin__metric-val">{value}</strong>
      {sub ? <span className="yds-admin__metric-sub">{sub}</span> : null}
    </div>
  )
}

function Section({ title, sub, children, className = "" }) {
  return (
    <section className={["yds-admin__section", className].filter(Boolean).join(" ")}>
      <div className="yds-admin__section-head">
        <h2 className="yds-admin__section-title">{title}</h2>
        {sub ? <p className="yds-admin__section-sub">{sub}</p> : null}
      </div>
      {children}
    </section>
  )
}

export default function AdminDashboardPage() {
  const cycleMetricHistory = useAppDataStore((s) => s.cycleMetricHistory)
  const cycleHistoryUpdatedAt = useAppDataStore((s) => s.cycleHistoryUpdatedAt)
  const cycleHistorySource = useAppDataStore((s) => s.cycleHistorySource)
  const panicIndexFetchedAt = useAppDataStore((s) => s.panicIndexFetchedAt)
  const hubPanicMetrics = useAppDataStore((s) => s.hubPanicMetrics)
  const deskMarketReport = useAppDataStore((s) => s.deskMarketReport)
  const deskMarketReportKey = useAppDataStore((s) => s.deskMarketReportKey)
  const deskMarketReportLoading = useAppDataStore((s) => s.deskMarketReportLoading)
  const deskMarketReportDegraded = useAppDataStore((s) => s.deskMarketReportDegraded)
  const deskMarketReportWarning = useAppDataStore((s) => s.deskMarketReportWarning)
  const lastCycleBundleError = useAppDataStore((s) => s.lastCycleBundleError)
  const panicData = usePanicStore((s) => s.panicData)

  const [buildMeta, setBuildMeta] = useState(null)
  const [apiHealth, setApiHealth] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshAt, setLastRefreshAt] = useState(null)

  const latestRow = useMemo(
    () => latestCycleHistoryRow(cycleMetricHistory),
    [cycleMetricHistory],
  )
  const latestPanic = useMemo(
    () => panicDataFromCycleRow(latestRow) ?? panicData,
    [latestRow, panicData],
  )

  const integrity = useMemo(
    () => checkCycleHistoryIntegrity(cycleMetricHistory),
    [cycleMetricHistory],
  )

  const panicMetrics = useMemo(
    () => buildPanicMetricStatus(latestRow, latestPanic, hubPanicMetrics),
    [latestRow, latestPanic, hubPanicMetrics],
  )

  const navTiming = useMemo(() => readNavigationTiming(), [lastRefreshAt])
  const cacheStatus = useMemo(() => readCacheStatus(), [lastRefreshAt])

  const aiReportStatus = useMemo(() => {
    const report = deskMarketReport
    const generatedAt =
      report?.generated_at ??
      report?.created_at ??
      report?.updated_at ??
      report?.as_of ??
      null
    const hasSummary = Boolean(report?.summary)
    let successCount = 0
    try {
      successCount = Number.parseInt(localStorage.getItem(AI_REPORT_COUNT_KEY) ?? "0", 10) || 0
    } catch {
      successCount = 0
    }
    if (hasSummary && !deskMarketReportDegraded) {
      try {
        const key = `yds-admin-ai-last-key`
        const prev = localStorage.getItem(key)
        if (prev !== deskMarketReportKey) {
          localStorage.setItem(key, deskMarketReportKey ?? "")
          localStorage.setItem(AI_REPORT_COUNT_KEY, String(successCount + 1))
          successCount += 1
        }
      } catch {
        // ignore
      }
    }
    return {
      generatedAt,
      generatedLabel: formatTs(generatedAt),
      success: hasSummary && !deskMarketReportDegraded,
      loading: deskMarketReportLoading,
      degraded: deskMarketReportDegraded,
      warning: deskMarketReportWarning,
      reportKey: deskMarketReportKey,
      successCount,
    }
  }, [
    deskMarketReport,
    deskMarketReportKey,
    deskMarketReportLoading,
    deskMarketReportDegraded,
    deskMarketReportWarning,
  ])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const [meta, apis] = await Promise.all([fetchBuildMeta(), probeApiHealth()])
      setBuildMeta(meta)
      setApiHealth(apis)
      setLastRefreshAt(new Date().toISOString())
      if (isPanicHubEnabled()) {
        void useAppDataStore.getState().loadCycleHistoryBundle({ force: true })
        void useAppDataStore.getState().loadDeskMarketReport(
          latestRow?.date ?? new Date().toISOString().slice(0, 10),
        )
      }
    } finally {
      setRefreshing(false)
    }
  }, [latestRow?.date])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), 60_000)
    return () => window.clearInterval(id)
  }, [refresh])

  const apiSummaryTone = apiHealth?.panicLatest?.ok ? "ok" : apiHealth ? "critical" : "neutral"
  const dataUpdatedAt = cycleHistoryUpdatedAt ?? panicIndexFetchedAt ?? latestRow?.ts ?? null

  return (
    <div className="yds-admin min-w-0 px-3 py-3 sm:px-4">
      <header className="yds-admin__header">
        <div>
          <p className="yds-admin__kicker">YDS Operations</p>
          <h1 className="yds-admin__title">운영자 대시보드</h1>
          <p className="yds-admin__sub">
            {lastRefreshAt ? `갱신 ${formatTs(lastRefreshAt)}` : "초기화 중…"}
            {refreshing ? " · 동기화" : ""}
          </p>
        </div>
        <div className="yds-admin__header-actions">
          <AppReleaseEnvBadge />
          <button type="button" className="yds-admin__btn" onClick={() => void refresh()} disabled={refreshing}>
            새로고침
          </button>
          <Link to="/market-analysis" className="yds-admin__link">
            사이트
          </Link>
        </div>
      </header>

      <Section title="시스템 상태" sub="Build · Deploy · API">
        <div className="yds-admin__grid yds-admin__grid--6">
          <MetricCell
            label="Build Version"
            value={buildMeta?.buildVersion ?? "—"}
            sub={buildMeta?.buildId ? buildMeta.buildId.slice(-20) : null}
          />
          <MetricCell
            label="Last Deploy"
            value={buildMeta?.lastDeployTime ?? "—"}
            sub={buildMeta?.lastDeployIso?.slice(0, 10) ?? null}
          />
          <MetricCell label="Git Commit" value={buildMeta?.gitCommit ?? "—"} />
          <MetricCell
            label="Environment"
            value={buildMeta?.environment ?? "—"}
            tone={
              buildMeta?.environment === "PROD"
                ? "ok"
                : buildMeta?.environment === "RC"
                  ? "warn"
                  : "neutral"
            }
          />
          <MetricCell
            label="API (Panic)"
            value={apiHealth ? `${apiHealth.panicLatest.status} · ${apiHealth.panicLatest.ms}ms` : "—"}
            sub={apiHealth?.panicLatest?.ok ? "OK" : apiHealth?.panicLatest?.error ?? "대기"}
            tone={apiSummaryTone}
          />
          <MetricCell
            label="데이터 갱신"
            value={formatTs(dataUpdatedAt)}
            sub={`source ${cycleHistorySource}`}
            tone={integrity.stats.lastDate ? "ok" : "warn"}
          />
        </div>
        {apiHealth ? (
          <div className="yds-admin__api-row">
            <span>
              Hub {apiHealth.hubEnabled ? "ON" : "OFF"} · build {apiHealth.buildJson.ms}ms · AI{" "}
              {apiHealth.aiDaily.ms}ms
            </span>
            {lastCycleBundleError ? (
              <span className="yds-admin__api-err">{String(lastCycleBundleError)}</span>
            ) : null}
          </div>
        ) : null}
      </Section>

      <Section title="패닉지수 상태" sub="최신 스냅샷 · 지표별">
        <div className="yds-admin__grid yds-admin__grid--5">
          {panicMetrics.map((m) => (
            <MetricCell
              key={m.key}
              label={m.label}
              value={m.display}
              sub={`갱신 ${m.updatedAt}`}
              tone={m.ok ? "ok" : "warn"}
            />
          ))}
        </div>
      </Section>

      <div className="yds-admin__split">
        <Section title="데이터 무결성" sub="자동 검사">
          {integrity.issues.length ? (
            <ul className="yds-admin__alerts">
              {integrity.issues.map((issue) => (
                <li
                  key={issue.id}
                  className={[
                    "yds-admin__alert",
                    issue.level === "critical" ? "yds-admin__alert--critical" : "yds-admin__alert--warn",
                  ].join(" ")}
                >
                  {issue.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="yds-admin__ok-line">이상 없음 · {integrity.stats.rowCount}행</p>
          )}
          <p className="yds-admin__meta-line">
            {integrity.stats.firstDate} → {integrity.stats.lastDate}
          </p>
        </Section>

        <Section title="AI 리포트" sub="데스크 브리핑">
          <div className="yds-admin__grid yds-admin__grid--2">
            <MetricCell
              label="최근 생성"
              value={aiReportStatus.generatedLabel}
              tone={aiReportStatus.success ? "ok" : "warn"}
            />
            <MetricCell
              label="생성 성공"
              value={aiReportStatus.success ? "성공" : aiReportStatus.loading ? "로딩" : "실패/없음"}
              sub={aiReportStatus.degraded ? aiReportStatus.warning ?? "degraded" : null}
              tone={aiReportStatus.success ? "ok" : "critical"}
            />
            <MetricCell label="누적 성공(로컬)" value={String(aiReportStatus.successCount)} />
            <MetricCell label="Report Key" value={aiReportStatus.reportKey ?? "—"} />
          </div>
        </Section>

        <Section title="성능 · 캐시" sub="Navigation · API · PWA">
          <div className="yds-admin__grid yds-admin__grid--2">
            <MetricCell label="DOM Ready" value={navTiming.domContentLoadedMs != null ? `${navTiming.domContentLoadedMs}ms` : "—"} />
            <MetricCell label="Load Event" value={navTiming.loadEventMs != null ? `${navTiming.loadEventMs}ms` : "—"} />
            <MetricCell label="TTFB" value={navTiming.ttfbMs != null ? `${navTiming.ttfbMs}ms` : "—"} />
            <MetricCell
              label="Panic API"
              value={apiHealth ? `${apiHealth.panicLatest.ms}ms` : "—"}
              tone={apiHealth?.panicLatest?.ok ? "ok" : "warn"}
            />
            <MetricCell
              label="Service Worker"
              value={cacheStatus.swActive ? "active" : "none"}
              sub={cacheStatus.controllerState ?? undefined}
            />
            <MetricCell
              label="PWA Check"
              value={cacheStatus.lastPwaCheck ? formatTs(Number(cacheStatus.lastPwaCheck)) : "—"}
            />
          </div>
        </Section>
      </div>

      <Section title="향후 확장" sub="Analytics 슬롯 (구조만)">
        <div className="yds-admin__grid yds-admin__grid--4">
          {ADMIN_FUTURE_METRICS.map((slot) => (
            <div key={slot.id} className="yds-admin__future-slot">
              <span className="yds-admin__future-label">{slot.label}</span>
              <span className="yds-admin__future-badge">planned</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
