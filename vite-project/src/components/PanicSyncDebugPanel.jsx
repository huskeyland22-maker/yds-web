import { useEffect, useMemo, useState } from "react"
import { getPanicDataUrlForDisplay, isPanicHubEnabled, listPanicDataUrlAttemptsForDisplay } from "../config/api.js"
import { LIVE_JSON_GET_INIT, withNoStoreQuery } from "../config/liveDataFetch.js"
import { usePanicStore } from "../store/panicStore.js"
import { readHtmlBuildId } from "../utils/pwaFreshness.js"
import { isPanicBusinessDataStale } from "../utils/validatePanicData.js"

export function isPanicSyncDebugPanelVisible() {
  if (typeof window === "undefined") return false
  if (import.meta.env.DEV) return true
  try {
    if (new URLSearchParams(window.location.search).get("panic-debug") === "1") return true
    if (window.localStorage?.getItem("yds-panic-sync-debug") === "1") return true
  } catch {
    // ignore
  }
  return false
}

function detectPlatform() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "unknown"
  const ua = navigator.userAgent || ""
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  const pwa =
    window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true
  if (pwa && ios) return "ios_pwa"
  if (pwa) return "pwa"
  if (ios) return "ios_safari"
  if (/Android/i.test(ua)) return "android"
  if (window.innerWidth <= 768) return "mobile_web"
  return "desktop_web"
}

/**
 * 패닉 동기화 진단용 임시 패널 — `?panic-debug=1` 또는 localStorage `yds-panic-sync-debug=1` 또는 dev.
 */
export default function PanicSyncDebugPanel() {
  const [open, setOpen] = useState(true)
  const [visible, setVisible] = useState(() => isPanicSyncDebugPanelVisible())
  const [remoteVersion, setRemoteVersion] = useState("-")
  const panicData = usePanicStore((s) => s.panicData)
  const manualMode = usePanicStore((s) => s.manualMode)
  const lastPanicFetchAt = usePanicStore((s) => s.lastPanicFetchAt)
  const lastPanicFetchUrl = usePanicStore((s) => s.lastPanicFetchUrl)
  const lastPanicFetchSource = usePanicStore((s) => s.lastPanicFetchSource)
  const lastPanicPayloadUpdatedAt = usePanicStore((s) => s.lastPanicPayloadUpdatedAt)
  const lastPanicFetchError = usePanicStore((s) => s.lastPanicFetchError)

  useEffect(() => {
    const id = window.setInterval(() => setVisible(isPanicSyncDebugPanelVisible()), 3000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(withNoStoreQuery("/build-version.json"), LIVE_JSON_GET_INIT)
        const j = await res.json().catch(() => ({}))
        if (!cancelled && typeof j?.version === "string") setRemoteVersion(j.version)
      } catch {
        if (!cancelled) setRemoteVersion("(fetch failed)")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [lastPanicFetchAt])

  const hub = isPanicHubEnabled()
  const hubEnv = String(import.meta.env.VITE_PANIC_HUB ?? "")

  const apiEndpointLabel = useMemo(() => {
    if (hub) return "GET /api/panic/latest · POST /api/panic/update (Supabase 허브)"
    const primary = getPanicDataUrlForDisplay()
    const attempts = listPanicDataUrlAttemptsForDisplay()
    return [primary, ...(attempts || []).filter((u) => u !== primary)].join(" → ")
  }, [hub])

  const mockOrFallback = useMemo(() => {
    if (manualMode) return "manual_snapshot (로컬 수동 스냅샷)"
    if (lastPanicFetchError) return `fetch_error: ${lastPanicFetchError}`
    if (panicData && isPanicBusinessDataStale(panicData)) return "stale_timestamp (구형/샘플 의심)"
    if (panicData && (panicData.__isStale === true || panicData.isStale === true)) return "api_flagged_stale"
    if (hub && lastPanicFetchSource === "API") return "unexpected: 허브 ON인데 API 소스"
    return "none"
  }, [manualMode, lastPanicFetchError, panicData, hub, lastPanicFetchSource])

  const platform = useMemo(() => detectPlatform(), [lastPanicFetchAt])

  if (!visible) return null

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-14 z-[9400] rounded-full border border-cyan-400/35 bg-slate-950/90 px-2.5 py-1 text-[10px] font-medium text-cyan-100 shadow-lg backdrop-blur"
      >
        📡 패닉동기
      </button>
    )
  }

  const lastFetchStr = lastPanicFetchAt ? new Date(lastPanicFetchAt).toISOString() : "(없음)"

  return (
    <section className="fixed left-3 top-14 z-[9400] max-h-[70vh] w-[min(96vw,380px)] overflow-auto rounded-xl border border-cyan-500/25 bg-[#070b12]/95 p-3 text-[11px] text-slate-200 shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="m-0 font-semibold text-cyan-100">패닉 동기화 디버그</p>
        <button type="button" className="rounded border border-white/15 px-2 py-0.5 text-[10px] text-slate-300" onClick={() => setOpen(false)}>
          접기
        </button>
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1.5 font-mono text-[10px]">
        <dt className="text-slate-500">platform</dt>
        <dd className="m-0 text-cyan-100/95">{platform}</dd>
        <dt className="text-slate-500">VITE_PANIC_HUB</dt>
        <dd className="m-0 break-all">{hubEnv || "(unset)"}</dd>
        <dt className="text-slate-500">hub enabled</dt>
        <dd className="m-0">{hub ? "yes" : "no"}</dd>
        <dt className="text-slate-500">API / 소스</dt>
        <dd className="m-0 break-all text-emerald-100/90">{apiEndpointLabel}</dd>
        <dt className="text-slate-500">build (HTML)</dt>
        <dd className="m-0 break-all">{readHtmlBuildId() || "(no meta)"}</dd>
        <dt className="text-slate-500">build (remote)</dt>
        <dd className="m-0 break-all">{remoteVersion}</dd>
        <dt className="text-slate-500">last fetch (ISO)</dt>
        <dd className="m-0">{lastFetchStr}</dd>
        <dt className="text-slate-500">last fetch URL</dt>
        <dd className="m-0 break-all text-slate-300">{lastPanicFetchUrl ?? "-"}</dd>
        <dt className="text-slate-500">data source</dt>
        <dd className="m-0 text-violet-100/90">{lastPanicFetchSource ?? (manualMode ? "MANUAL" : "-")}</dd>
        <dt className="text-slate-500">payload updatedAt</dt>
        <dd className="m-0 break-all">{String(panicData?.updatedAt ?? lastPanicPayloadUpdatedAt ?? "-")}</dd>
        <dt className="text-slate-500">mock / fallback</dt>
        <dd className="m-0 text-amber-100/90">{mockOrFallback}</dd>
        <dt className="text-slate-500">manualMode</dt>
        <dd className="m-0">{manualMode ? "yes" : "no"}</dd>
      </dl>
      <p className="mt-2 border-t border-white/10 pt-2 text-[10px] leading-snug text-slate-500">
        끄려면: URL에서 panic-debug 제거 후{" "}
        <button
          type="button"
          className="text-cyan-300 underline"
          onClick={() => {
            try {
              window.localStorage.removeItem("yds-panic-sync-debug")
            } catch {
              // ignore
            }
            window.location.reload()
          }}
        >
          localStorage 키 삭제·새로고침
        </button>
      </p>
    </section>
  )
}
