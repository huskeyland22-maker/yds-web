import { isPanicHubEnabled } from "../config/api.js"
import { useAppDataStore } from "../store/appDataStore.js"
import { usePanicStore } from "../store/panicStore.js"
import { isDataTraceUiEnabled, formatTraceTime } from "../utils/dataFlowTrace.js"

/**
 * 데이터 흐름 추적용 — ?data-trace=1 또는 localStorage yds-data-trace=1 시에만 표시
 */
export function PanicMetricsTraceBadge({ className = "" }) {
  const trace = usePanicStore((s) => s.panicDataTrace)
  const lastPanicFetchAt = usePanicStore((s) => s.lastPanicFetchAt)
  const rtAt = useAppDataStore((s) => s.realtimeLastEventAt)
  const rtN = useAppDataStore((s) => s.realtimeEventCount)
  if (!isDataTraceUiEnabled()) return null

  const source = trace.fetchSource ?? "—"
  const updated = formatTraceTime(lastPanicFetchAt)
  const payloadT = trace.lastPayloadBusinessAt
    ? String(trace.lastPayloadBusinessAt).slice(0, 16)
    : "—"
  const storeT = formatTraceTime(trace.lastStoreWriteAt)
  const cache = trace.usedLocalCacheHydration ? "true" : "false"
  const rtLine =
    isPanicHubEnabled() && rtAt != null
      ? `realtime: last ${formatTraceTime(rtAt)} (n=${rtN})`
      : isPanicHubEnabled()
        ? "realtime: (no event yet)"
        : "realtime: off"

  return (
    <div
      className={`rounded border border-amber-500/25 bg-amber-500/[0.06] px-2 py-1 font-mono text-trading-2xs leading-tight text-amber-100/90 ${className}`}
    >
      <span className="text-amber-400/80">panic</span> source: {String(source).toLowerCase()}
      <br />
      fetch: {updated} · payload: {payloadT}
      <br />
      store: {storeT} · cacheHydration: {cache}
      <br />
      {rtLine}
    </div>
  )
}

export function CycleHistoryTraceBadge({ className = "" }) {
  const staticAt = useAppDataStore((s) => s.cycleStaticFetchedAt)
  const bundleErr = useAppDataStore((s) => s.lastCycleBundleError)
  const hub = useAppDataStore((s) => s.panicIndexFetchedAt)
  if (!isDataTraceUiEnabled()) return null

  return (
    <div
      className={`rounded border border-sky-500/25 bg-sky-500/[0.06] px-2 py-1 font-mono text-trading-2xs leading-tight text-sky-100/90 ${className}`}
    >
      <span className="text-sky-400/80">cycle-chart</span> bundle: {formatTraceTime(staticAt)}
      {hub ? (
        <>
          <br />
          panic_index_history: {formatTraceTime(hub)}
        </>
      ) : null}
      {bundleErr ? (
        <>
          <br />
          <span className="text-rose-300/90">err: {bundleErr}</span>
        </>
      ) : null}
    </div>
  )
}

export function ValueChainHeatTraceBadge({ className = "" }) {
  const at = useAppDataStore((s) => s.sectorHeatFetchedAt)
  const err = useAppDataStore((s) => s.sectorHeatError)
  const loading = useAppDataStore((s) => s.sectorHeatLoading)
  if (!isDataTraceUiEnabled()) return null

  return (
    <div
      className={`rounded border border-violet-500/25 bg-violet-500/[0.06] px-2 py-1 font-mono text-trading-2xs leading-tight text-violet-100/90 ${className}`}
    >
      <span className="text-violet-400/80">value-chain-heat</span> network /value-chain-heat.json
      <br />
      fetch: {formatTraceTime(at)} · loading: {loading ? "yes" : "no"} · cache: false
      {err ? (
        <>
          <br />
          <span className="text-rose-300/90">err: {err}</span>
        </>
      ) : null}
    </div>
  )
}

export function RealtimeTraceBadge({ className = "" }) {
  const last = useAppDataStore((s) => s.realtimeLastEventAt)
  const n = useAppDataStore((s) => s.realtimeEventCount)
  const hub = isPanicHubEnabled()
  if (!isDataTraceUiEnabled()) return null

  return (
    <div
      className={`rounded border border-emerald-500/25 bg-emerald-500/[0.06] px-2 py-1 font-mono text-trading-2xs leading-tight text-emerald-100/90 ${className}`}
    >
      <span className="text-emerald-400/80">realtime</span>{" "}
      {hub ? "supabase panic_metrics · subscribed in App" : "hub off — no WS"}
      <br />
      last event: {formatTraceTime(last)} (n={n})
    </div>
  )
}

export function DataFlowPipelineHint() {
  if (!isDataTraceUiEnabled()) return null
  return (
    <div className="rounded border border-white/[0.08] bg-black/40 px-2 py-1.5 font-mono text-trading-2xs leading-snug text-slate-500">
      Supabase / API
      <br />
      ↓ fetch (api.js + panicStore.fetchPanicData)
      <br />
      ↓ Zustand panicStore + appDataStore
      <br />↓ UI
    </div>
  )
}
