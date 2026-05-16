import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { createClient } from "@supabase/supabase-js"
import { isPanicHubEnabled, fetchPanicHubLatest } from "../config/api.js"
import { LIVE_JSON_GET_INIT, withNoStoreQuery } from "../config/liveDataFetch.js"
import { getSupabaseEnv, maskSecret } from "../lib/supabaseBrowser.js"
import { useAppDataStore } from "../store/appDataStore.js"
import { usePanicStore } from "../store/panicStore.js"
import {
  classifyDataFailure,
  debugError,
  debugLog,
  debugWarn,
  summarizeRows,
  withTimeout,
} from "../utils/supabaseDebugProbe.js"
import { isIosStandalone } from "../utils/pwaFreshness.js"

const QUERY_TIMEOUT_MS = 18_000

const SUPABASE_TABLE_PROBES = [
  {
    id: "panic_metrics",
    label: "public.panic_metrics",
    sqlHint: "select * from panic_metrics order by updated_at desc limit 5",
    table: "panic_metrics",
    order: { column: "updated_at", ascending: false },
  },
  {
    id: "panic_index_history",
    label: "public.panic_index_history",
    sqlHint: "select * from panic_index_history order by date desc limit 5",
    table: "panic_index_history",
    order: { column: "date", ascending: false },
  },
  {
    id: "panic_index_legacy",
    label: "public.panic_index (legacy — usually missing)",
    sqlHint: "select * from panic_index limit 5",
    table: "panic_index",
    order: { column: "date", ascending: false },
    optional: true,
  },
]

function detectPlatform() {
  if (typeof window === "undefined") return "ssr"
  const ua = navigator.userAgent || ""
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
  const standalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true
  if (standalone && isIosStandalone()) return "ios-pwa"
  if (standalone) return "pwa-standalone"
  if (mobile) return "mobile-web"
  return "desktop-web"
}

async function fetchBuildVersion() {
  try {
    const res = await fetch(withNoStoreQuery("/build-version.json"), LIVE_JSON_GET_INIT)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function runSupabaseTableProbe(client, spec) {
  debugLog("query:start", { table: spec.table, sql: spec.sqlHint })
  const started = performance.now()
  let q = client.from(spec.table).select("*").limit(5)
  if (spec.order?.column) {
    q = q.order(spec.order.column, { ascending: Boolean(spec.order.ascending) })
  }
  const { data, error, status, statusText } = await withTimeout(q, QUERY_TIMEOUT_MS, spec.table)
  const elapsedMs = Math.round(performance.now() - started)
  if (error) {
    debugError("query:fail", {
      table: spec.table,
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      status,
      statusText,
      elapsedMs,
    })
    throw error
  }
  const rows = Array.isArray(data) ? data : []
  const summary = summarizeRows(rows)
  debugLog("query:success", { table: spec.table, ...summary, elapsedMs })
  if (rows.length === 0) debugWarn("query:empty", { table: spec.table })
  return { rows, summary, elapsedMs }
}

function StatusPill({ status }) {
  const cls =
    status === "success"
      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
      : status === "loading"
        ? "border-sky-500/40 bg-sky-500/15 text-sky-200"
        : status === "timeout"
          ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
          : status === "error"
            ? "border-rose-500/40 bg-rose-500/15 text-rose-200"
            : "border-white/15 bg-white/5 text-slate-400"
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${cls}`}>
      {status}
    </span>
  )
}

function ProbeCard({ title, sqlHint, status, failure, summary, rows, elapsedMs }) {
  return (
    <section className="rounded-lg border border-white/[0.08] bg-[#0a0d12] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="m-0 text-sm font-semibold text-slate-100">{title}</h2>
          <p className="m-0 mt-0.5 font-mono text-[10px] text-slate-500">{sqlHint}</p>
        </div>
        <StatusPill status={status} />
      </div>
      {elapsedMs != null ? <p className="m-0 mb-2 font-mono text-[10px] text-slate-500">{elapsedMs}ms</p> : null}
      {failure ? (
        <div className="mb-2 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px]">
          <p className="m-0 font-semibold text-rose-200">{failure.code}</p>
          <p className="m-0 mt-1 text-rose-100/90">{failure.message}</p>
          <p className="m-0 mt-1 text-slate-400">{failure.hint}</p>
        </div>
      ) : null}
      {summary ? (
        <dl className="m-0 mb-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 font-mono text-[10px] text-slate-400">
          <dt>rows</dt>
          <dd className="m-0 text-slate-200">{summary.rowCount}</dd>
          <dt>latest updated</dt>
          <dd className="m-0 break-all text-slate-200">{summary.latestUpdatedAt ?? "—"}</dd>
          <dt>null fields</dt>
          <dd className="m-0 break-all text-slate-300">
            {Object.entries(summary.nullCounts)
              .filter(([, n]) => n > 0)
              .map(([k, n]) => `${k}:${n}`)
              .join(", ") || "none"}
          </dd>
        </dl>
      ) : null}
      {rows?.length ? (
        <pre className="mt-2 max-h-48 overflow-auto rounded border border-white/[0.06] bg-black/50 p-2 font-mono text-[10px] leading-relaxed text-emerald-100/90">
          {JSON.stringify(rows, null, 2)}
        </pre>
      ) : status === "success" ? (
        <p className="m-0 mt-2 text-[11px] text-amber-200/90">실제 데이터 없음 (0 rows)</p>
      ) : null}
    </section>
  )
}

export default function DebugDataPage() {
  const env = useMemo(() => getSupabaseEnv(), [])
  const platform = useMemo(() => detectPlatform(), [])
  const [buildMeta, setBuildMeta] = useState(null)
  const [running, setRunning] = useState(false)
  const [hubProbe, setHubProbe] = useState({
    status: "idle",
    data: null,
    failure: null,
    elapsedMs: null,
  })
  const [tableProbes, setTableProbes] = useState(() =>
    Object.fromEntries(
      SUPABASE_TABLE_PROBES.map((p) => [
        p.id,
        { status: "idle", rows: null, summary: null, failure: null, elapsedMs: null },
      ]),
    ),
  )
  const [realtime, setRealtime] = useState({
    status: "idle",
    connected: false,
    lastEventAt: null,
    eventCount: 0,
    channelState: "—",
    error: null,
  })

  const panicData = usePanicStore((s) => s.panicData)
  const lastPanicFetchAt = usePanicStore((s) => s.lastPanicFetchAt)
  const lastPanicFetchError = usePanicStore((s) => s.lastPanicFetchError)
  const lastPanicFetchSource = usePanicStore((s) => s.lastPanicFetchSource)
  const storeRealtimeAt = useAppDataStore((s) => s.realtimeLastEventAt)
  const storeRealtimeN = useAppDataStore((s) => s.realtimeEventCount)

  const realtimeRef = useRef(null)
  const runIdRef = useRef(0)

  const runHubApiProbe = useCallback(async () => {
    debugLog("hub-api:start", { hubEnabled: isPanicHubEnabled() })
    setHubProbe({ status: "loading", data: null, failure: null, elapsedMs: null })
    const started = performance.now()
    try {
      if (!isPanicHubEnabled()) {
        throw new Error("VITE_PANIC_HUB is not enabled")
      }
      const data = await withTimeout(fetchPanicHubLatest({ debugLog: true }), QUERY_TIMEOUT_MS, "hub-api")
      const elapsedMs = Math.round(performance.now() - started)
      debugLog("hub-api:success", { updatedAt: data?.updatedAt, elapsedMs })
      setHubProbe({ status: "success", data, failure: null, elapsedMs })
    } catch (e) {
      const elapsedMs = Math.round(performance.now() - started)
      const msg = e instanceof Error ? e.message : String(e)
      const status = msg.startsWith("timeout:") ? "timeout" : "error"
      const failure = classifyDataFailure(e, { rowCount: 0 })
      debugError("hub-api:fail", { message: msg, ...failure, elapsedMs })
      setHubProbe({ status, data: null, failure, elapsedMs })
    }
  }, [])

  const runTableProbes = useCallback(async () => {
    const { url, anonKey, configured } = getSupabaseEnv()
    if (!configured) {
      const failure = classifyDataFailure(new Error("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing"))
      debugError("supabase:not_configured", failure)
      setTableProbes((prev) => {
        const next = { ...prev }
        for (const p of SUPABASE_TABLE_PROBES) {
          next[p.id] = { status: "error", rows: null, summary: null, failure, elapsedMs: null }
        }
        return next
      })
      return
    }

    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    for (const spec of SUPABASE_TABLE_PROBES) {
      setTableProbes((prev) => ({
        ...prev,
        [spec.id]: { ...prev[spec.id], status: "loading", failure: null },
      }))
      try {
        const { rows, summary, elapsedMs } = await runSupabaseTableProbe(client, spec)
        const failure = rows.length === 0 ? classifyDataFailure(null, { rowCount: 0 }) : null
        setTableProbes((prev) => ({
          ...prev,
          [spec.id]: { status: "success", rows, summary, failure, elapsedMs },
        }))
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        const status = msg.startsWith("timeout:") ? "timeout" : "error"
        const failure = classifyDataFailure(e, { rowCount: 0 })
        setTableProbes((prev) => ({
          ...prev,
          [spec.id]: {
            status: spec.optional && failure.code === "table_not_found" ? "success" : status,
            rows: [],
            summary: summarizeRows([]),
            failure: spec.optional && failure.code === "table_not_found" ? failure : failure,
            elapsedMs: null,
          },
        }))
      }
    }
  }, [])

  const startRealtimeProbe = useCallback(() => {
    const { url, anonKey, configured } = getSupabaseEnv()
    if (!configured) {
      setRealtime((r) => ({
        ...r,
        status: "error",
        connected: false,
        error: "Supabase env missing",
        channelState: "OFF",
      }))
      return
    }

    if (realtimeRef.current) {
      try {
        realtimeRef.current()
      } catch {
        // ignore
      }
      realtimeRef.current = null
    }

    debugLog("realtime:subscribe", { table: "panic_metrics" })
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const channel = client
      .channel(`yds-debug-panic-metrics-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "panic_metrics" }, (payload) => {
        const t = Date.now()
        debugLog("realtime:event", { eventType: payload?.eventType })
        setRealtime((prev) => ({
          ...prev,
          lastEventAt: t,
          eventCount: prev.eventCount + 1,
        }))
      })
      .subscribe((status, err) => {
        debugLog("realtime:status", { status, err: err?.message ?? null })
        const connected = status === "SUBSCRIBED"
        setRealtime((prev) => ({
          ...prev,
          status: connected ? "success" : status === "CHANNEL_ERROR" ? "error" : "loading",
          connected,
          channelState: status,
          error: err?.message ?? null,
        }))
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          debugError("realtime:fail", { status, message: err?.message })
        }
      })

    realtimeRef.current = () => {
      try {
        void client.removeChannel(channel)
      } catch {
        // ignore
      }
      try {
        client.realtime.disconnect()
      } catch {
        // ignore
      }
    }
  }, [])

  const runAll = useCallback(async () => {
    const runId = ++runIdRef.current
    setRunning(true)
    debugLog("run-all:start", { platform, runId })
    await runHubApiProbe()
    await runTableProbes()
    if (runId === runIdRef.current) startRealtimeProbe()
    setRunning(false)
    debugLog("run-all:done", { runId })
  }, [platform, runHubApiProbe, runTableProbes, startRealtimeProbe])

  useEffect(() => {
    void fetchBuildVersion().then(setBuildMeta)
    void runAll()
    return () => {
      if (realtimeRef.current) realtimeRef.current()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, [])

  const appVersion =
    buildMeta?.version ?? (String(import.meta.env.VITE_APP_VERSION_LABEL ?? "").trim() || "—")
  const buildId = buildMeta?.buildId ?? import.meta.env.VITE_APP_BUILD_ID ?? "—"

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24 pt-2 text-slate-200">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div>
          <h1 className="m-0 text-lg font-semibold text-amber-100">Supabase 데이터 연결 테스트</h1>
          <p className="m-0 mt-1 text-xs text-slate-500">/debug-data — 모바일·PWA에서 query·realtime 확인</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={running}
            onClick={() => void runAll()}
            className="rounded border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-100 disabled:opacity-50"
          >
            {running ? "실행 중…" : "다시 실행"}
          </button>
          <Link
            to="/cycle"
            className="rounded border border-white/15 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
          >
            ← 데스크
          </Link>
        </div>
      </header>

      <section className="rounded-lg border border-white/[0.08] bg-[#0a0d12] p-3 font-mono text-[10px] leading-relaxed">
        <h2 className="m-0 mb-2 text-xs font-semibold text-slate-300">연결 정보</h2>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
          <dt className="text-slate-500">SUPABASE_URL</dt>
          <dd className="m-0 break-all text-slate-200">{env.url || "(empty)"}</dd>
          <dt className="text-slate-500">ANON_KEY</dt>
          <dd className="m-0 text-slate-300">{maskSecret(env.anonKey)}</dd>
          <dt className="text-slate-500">VITE_PANIC_HUB</dt>
          <dd className="m-0">{env.panicHub ? "1 (on)" : "off"}</dd>
          <dt className="text-slate-500">isPanicHubEnabled()</dt>
          <dd className="m-0">{isPanicHubEnabled() ? "true" : "false"}</dd>
          <dt className="text-slate-500">environment</dt>
          <dd className="m-0">{import.meta.env.MODE}</dd>
          <dt className="text-slate-500">build version</dt>
          <dd className="m-0">
            {appVersion} <span className="text-slate-600">({buildId})</span>
          </dd>
          <dt className="text-slate-500">platform</dt>
          <dd className="m-0">{platform}</dd>
          <dt className="text-slate-500">online</dt>
          <dd className="m-0">{typeof navigator !== "undefined" && navigator.onLine ? "yes" : "no"}</dd>
        </dl>
      </section>

      <ProbeCard
        title="Vercel Hub API — GET /api/panic/latest"
        sqlHint="Server: SUPABASE_SERVICE_ROLE → panic_metrics"
        status={hubProbe.status}
        failure={hubProbe.failure}
        summary={
          hubProbe.data
            ? {
                rowCount: 1,
                latestUpdatedAt: hubProbe.data.updatedAt ?? null,
                nullCounts: {},
                sampleKeys: Object.keys(hubProbe.data),
              }
            : null
        }
        rows={hubProbe.data ? [hubProbe.data] : null}
        elapsedMs={hubProbe.elapsedMs}
      />

      {SUPABASE_TABLE_PROBES.map((spec) => {
        const p = tableProbes[spec.id]
        return (
          <ProbeCard
            key={spec.id}
            title={`Direct Supabase — ${spec.label}`}
            sqlHint={spec.sqlHint}
            status={p?.status ?? "idle"}
            failure={p?.failure}
            summary={p?.summary}
            rows={p?.rows}
            elapsedMs={p?.elapsedMs}
          />
        )
      })}

      <section className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-sm font-semibold text-emerald-100">Realtime — panic_metrics</h2>
          <StatusPill status={realtime.connected ? "success" : realtime.status} />
        </div>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 font-mono text-[10px] text-slate-400">
          <dt>connected</dt>
          <dd className="m-0 text-slate-200">{realtime.connected ? "yes" : "no"}</dd>
          <dt>channel state</dt>
          <dd className="m-0">{realtime.channelState}</dd>
          <dt>last event (this page)</dt>
          <dd className="m-0">
            {realtime.lastEventAt
              ? new Date(realtime.lastEventAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
              : "—"}
          </dd>
          <dt>events (this page)</dt>
          <dd className="m-0">{realtime.eventCount}</dd>
          <dt>App store realtime</dt>
          <dd className="m-0">
            {storeRealtimeAt
              ? `${new Date(storeRealtimeAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} (n=${storeRealtimeN})`
              : "—"}
          </dd>
        </dl>
        {realtime.error ? <p className="mt-2 text-[11px] text-rose-300">{realtime.error}</p> : null}
        <p className="m-0 mt-2 text-[10px] text-slate-500">
          Replication: Supabase → Database → Replication → panic_metrics
        </p>
      </section>

      <section className="rounded-lg border border-white/[0.08] bg-[#0a0d12] p-3">
        <h2 className="m-0 mb-2 text-xs font-semibold text-slate-300">panicStore (앱 전역)</h2>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 font-mono text-[10px]">
          <dt className="text-slate-500">panicData</dt>
          <dd className="m-0">{panicData ? "loaded" : "null"}</dd>
          <dt className="text-slate-500">updatedAt</dt>
          <dd className="m-0 break-all">{panicData?.updatedAt ?? "—"}</dd>
          <dt className="text-slate-500">last fetch</dt>
          <dd className="m-0">
            {lastPanicFetchAt ? new Date(lastPanicFetchAt).toISOString() : "—"} · {lastPanicFetchSource ?? "—"}
          </dd>
          <dt className="text-slate-500">fetch error</dt>
          <dd className="m-0 text-rose-300">{lastPanicFetchError ?? "—"}</dd>
        </dl>
        {panicData ? (
          <pre className="mt-2 max-h-40 overflow-auto rounded border border-white/[0.06] bg-black/50 p-2 font-mono text-[10px] text-slate-300">
            {JSON.stringify(panicData, null, 2)}
          </pre>
        ) : null}
      </section>

      <p className="text-center text-[10px] text-slate-600">
        콘솔 필터: <code className="text-slate-400">YDS_DEBUG_DATA</code>
      </p>
    </div>
  )
}
