import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getSupabaseEnv, maskSecret } from "../lib/supabaseBrowser.js"
import { usePanicStore } from "../store/panicStore.js"
import {
  runAllRawSupabaseProbes,
  shouldAutoShowSupabaseRawDebug,
  isSupabaseRawDebugVisible,
} from "../utils/supabaseRawProbes.js"

const STATUS_STYLE = {
  SUCCESS: "text-emerald-300 bg-emerald-500/20 border-emerald-500/40",
  EMPTY: "text-amber-200 bg-amber-500/15 border-amber-500/40",
  ERROR: "text-rose-200 bg-rose-500/20 border-rose-500/40",
  LOADING: "text-sky-200 bg-sky-500/15 border-sky-500/40",
  IDLE: "text-slate-400 bg-white/5 border-white/15",
}

function StatusBanner({ status }) {
  const cls = STATUS_STYLE[status] ?? STATUS_STYLE.IDLE
  return (
    <p className={`m-0 rounded border px-2 py-1 font-mono text-[11px] font-bold tracking-wider ${cls}`}>
      STATUS: {status}
    </p>
  )
}

function ProbeBlock({ probe }) {
  if (!probe) return null
  return (
    <article className="border-b border-white/[0.08] py-2.5 last:border-0">
      <StatusBanner status={probe.status} />
      <dl className="m-0 mt-2 grid grid-cols-[7.5rem_1fr] gap-x-2 gap-y-1 font-mono text-[10px] leading-snug text-slate-400">
        <dt>table</dt>
        <dd className="m-0 break-all text-slate-200">{probe.tableName}</dd>
        <dt>query</dt>
        <dd className="m-0 break-all text-violet-200/90">{probe.queryChain}</dd>
        <dt>row count</dt>
        <dd className="m-0 text-slate-200">{probe.rowCount}</dd>
        <dt>updated_at</dt>
        <dd className="m-0 break-all text-slate-200">{probe.latestUpdatedAt ?? "—"}</dd>
        <dt>response</dt>
        <dd className="m-0 text-slate-200">{probe.responseTimeMs != null ? `${probe.responseTimeMs}ms` : "—"}</dd>
        {probe.classification ? (
          <>
            <dt>classify</dt>
            <dd className="m-0 text-amber-200/90">{probe.classification}</dd>
          </>
        ) : null}
        {probe.errorMessage ? (
          <>
            <dt>error msg</dt>
            <dd className="m-0 break-all text-rose-200/90">{probe.errorMessage}</dd>
          </>
        ) : null}
        {probe.errorCode ? (
          <>
            <dt>error code</dt>
            <dd className="m-0 text-rose-200/90">{probe.errorCode}</dd>
          </>
        ) : null}
      </dl>
      {probe.classificationHint ? (
        <p className="m-0 mt-1 text-[10px] text-slate-500">{probe.classificationHint}</p>
      ) : null}
      {probe.queryError ? (
        <pre className="mt-1.5 max-h-24 overflow-auto rounded border border-rose-500/25 bg-rose-950/40 p-1.5 font-mono text-[9px] text-rose-100/90">
          query error (full):{"\n"}
          {JSON.stringify(probe.queryError, null, 2)}
        </pre>
      ) : null}
      <p className="m-0 mt-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600">RAW fetched rows</p>
      <pre className="mt-0.5 max-h-36 overflow-auto rounded border border-white/[0.08] bg-black/60 p-2 font-mono text-[9px] leading-relaxed text-emerald-100/95 whitespace-pre-wrap break-all">
        {probe.rawJson || "null"}
      </pre>
    </article>
  )
}

/**
 * 하단 고정 — Supabase 실제 query RAW 출력 (fallback 없음).
 * ?supabase-debug=1 · localStorage yds-supabase-raw-debug=1 · VITE_SUPABASE_RAW_DEBUG=1
 * 또는 허브 on + panicData 비어 있으면 자동 표시.
 */
export default function SupabaseRawDebugPanel() {
  const panicData = usePanicStore((s) => s.panicData)
  const panicInitialized = usePanicStore((s) => s.initialized)
  const env = getSupabaseEnv()

  const [visible, setVisible] = useState(() => shouldAutoShowSupabaseRawDebug(false, null))
  const [expanded, setExpanded] = useState(() => shouldAutoShowSupabaseRawDebug(false, null))
  const [loading, setLoading] = useState(false)
  const [probes, setProbes] = useState([])
  const [lastRunAt, setLastRunAt] = useState(null)
  const [runError, setRunError] = useState(null)

  useEffect(() => {
    const show = shouldAutoShowSupabaseRawDebug(panicInitialized, panicData)
    setVisible(show)
    if (show) setExpanded(true)
  }, [panicInitialized, panicData])

  const runProbes = useCallback(async () => {
    setLoading(true)
    setRunError(null)
    try {
      const results = await runAllRawSupabaseProbes()
      setProbes(results)
      setLastRunAt(Date.now())
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setRunError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!visible) return
    void runProbes()
    const id = window.setInterval(() => void runProbes(), 45_000)
    return () => window.clearInterval(id)
  }, [visible, runProbes])

  if (!visible && !isSupabaseRawDebugVisible()) {
    return (
      <button
        type="button"
        onClick={() => {
          try {
            window.localStorage.setItem("yds-supabase-raw-debug", "1")
          } catch {
            // ignore
          }
          setVisible(true)
          setExpanded(true)
        }}
        className="fixed bottom-[max(4.5rem,env(safe-area-inset-bottom))] left-3 z-[9200] rounded-full border border-violet-500/50 bg-violet-950/95 px-2.5 py-1 font-mono text-[10px] font-semibold text-violet-100 shadow-lg"
      >
        RAW DB
      </button>
    )
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="fixed bottom-0 left-0 right-0 z-[9200] border-t border-violet-500/40 bg-[#0a0612]/98 px-3 py-2 text-center font-mono text-[10px] font-semibold text-violet-200"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        Supabase RAW ▲ {loading ? "…" : probes[0]?.status ?? "—"} · tap to expand
      </button>
    )
  }

  return (
    <aside
      className="fixed bottom-0 left-0 right-0 z-[9200] flex max-h-[min(52vh,420px)] flex-col border-t border-violet-500/45 bg-[#07050f]/98 shadow-[0_-8px_32px_rgba(0,0,0,0.55)] backdrop-blur-md"
      style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/[0.08] px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[11px] font-bold text-violet-100">Supabase RAW (실데이터만)</p>
          <p className="m-0 truncate font-mono text-[9px] text-slate-500">
            {env.url ? maskSecret(env.url, 12) : "no URL"} ·{" "}
            {lastRunAt ? new Date(lastRunAt).toLocaleTimeString("ko-KR") : "—"}
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void runProbes()}
          className="rounded border border-violet-500/40 px-2 py-0.5 text-[10px] text-violet-100 disabled:opacity-50"
        >
          {loading ? "…" : "재실행"}
        </button>
        <Link to="/debug-data" className="text-[10px] text-slate-400 underline">
          full
        </Link>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-[10px] text-slate-500"
          aria-label="접기"
        >
          ▼
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-1">
        {runError ? (
          <pre className="text-[10px] text-rose-300">{runError}</pre>
        ) : loading && probes.length === 0 ? (
          <p className="font-mono text-[10px] text-sky-300">STATUS: LOADING — running queries…</p>
        ) : null}
        {probes.map((p) => (
          <ProbeBlock key={p.id} probe={p} />
        ))}
      </div>
    </aside>
  )
}
