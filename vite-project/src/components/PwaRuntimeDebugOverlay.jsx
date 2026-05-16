import { useEffect, useMemo, useState } from "react"
import { isPanicHubEnabled } from "../config/api.js"
import { usePanicStore } from "../store/panicStore.js"
import { getDebugEventChannel, getRecentDebugLogs } from "../utils/debugLogger.js"
import { getServiceWorkerDebugInfo, isIosStandalone, readHtmlBuildId } from "../utils/pwaFreshness.js"
import { isPanicBusinessDataStale } from "../utils/validatePanicData.js"

export function isPwaRuntimeDebugOverlayVisible() {
  if (typeof window === "undefined") return false
  if (import.meta.env.DEV) return true
  try {
    if (new URLSearchParams(window.location.search).get("pwa-debug") === "1") return true
    if (window.localStorage?.getItem("yds-pwa-runtime-debug") === "1") return true
  } catch {
    // ignore
  }
  return false
}

/**
 * PWA·빌드·SW·CSR 부트 진단 — `?pwa-debug=1` 또는 `yds-pwa-runtime-debug=1` 또는 dev.
 * (React SSR hydration 아님: 앱은 CSR이며 panicStore HYDRATION_* 이벤트 기준으로 표시)
 */
export default function PwaRuntimeDebugOverlay() {
  const [visible, setVisible] = useState(() => isPwaRuntimeDebugOverlayVisible())
  const [open, setOpen] = useState(true)
  const [tick, setTick] = useState(0)
  const [swInfo, setSwInfo] = useState(null)

  const panicData = usePanicStore((s) => s.panicData)
  const initialized = usePanicStore((s) => s.initialized)
  const lastPanicFetchAt = usePanicStore((s) => s.lastPanicFetchAt)
  const lastPanicFetchUrl = usePanicStore((s) => s.lastPanicFetchUrl)
  const lastPanicFetchSource = usePanicStore((s) => s.lastPanicFetchSource)
  const lastPanicFetchError = usePanicStore((s) => s.lastPanicFetchError)

  useEffect(() => {
    const id = window.setInterval(() => setVisible(isPwaRuntimeDebugOverlayVisible()), 3000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!visible) return
    const id = window.setInterval(() => setTick((t) => t + 1), 2500)
    return () => window.clearInterval(id)
  }, [visible])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    void (async () => {
      const info = await getServiceWorkerDebugInfo()
      if (!cancelled) setSwInfo(info)
    })()
    return () => {
      cancelled = true
    }
  }, [visible, tick])

  useEffect(() => {
    if (!visible || typeof window === "undefined") return
    const ch = getDebugEventChannel()
    const onEv = () => setTick((t) => t + 1)
    window.addEventListener(ch, onEv)
    return () => window.removeEventListener(ch, onEv)
  }, [visible])

  const hydrationRow = useMemo(() => {
    const logs = getRecentDebugLogs()
    const done = logs.find((r) => r.tag === "HYDRATION_DONE")
    return {
      lastDone: done?.ts ?? null,
      durationMs: done?.payload?.durationMs ?? null,
      restored: done?.payload?.restored,
    }
  }, [tick, initialized])

  const standalone = useMemo(() => {
    if (typeof window === "undefined") return false
    return (
      window.matchMedia?.("(display-mode: standalone)")?.matches === true || window.navigator.standalone === true
    )
  }, [tick])

  const probe = typeof window !== "undefined" && window.__YDS_BUILD_CHECK ? window.__YDS_BUILD_CHECK : {}

  const buildMismatch =
    probe?.mismatch ||
    (probe?.remoteBuildId &&
    probe?.htmlBuildId &&
    String(probe.remoteBuildId) !== String(probe.htmlBuildId)
      ? "html-vs-remote"
      : null)

  const viteBuild = String(import.meta.env.VITE_APP_BUILD_ID ?? "dev")
  const viteVersionLabel = String(import.meta.env.VITE_APP_VERSION_LABEL ?? "").trim() || "dev"

  const dataStale = Boolean(panicData && isPanicBusinessDataStale(panicData))

  if (!visible) return null

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-3 bottom-3 z-[9300] rounded-full border border-amber-400/40 bg-slate-950/92 px-2 py-1 text-[10px] font-medium text-amber-100 shadow-lg backdrop-blur"
      >
        PWA 빌드
      </button>
    )
  }

  const lastFetchIso = lastPanicFetchAt ? new Date(lastPanicFetchAt).toISOString() : "(없음)"

  return (
    <section className="fixed right-3 bottom-3 z-[9300] max-h-[52vh] w-[min(94vw,320px)] overflow-auto rounded-lg border border-amber-500/30 bg-[#0a0d12]/96 p-2.5 text-[10px] text-slate-200 shadow-2xl backdrop-blur">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="m-0 font-semibold text-amber-100">PWA / 빌드 런타임</p>
        <button
          type="button"
          className="rounded border border-white/15 px-1.5 py-0.5 text-[9px]"
          onClick={() => setOpen(false)}
        >
          접기
        </button>
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 font-mono leading-tight">
        <dt className="text-slate-500">app version</dt>
        <dd className="m-0 break-all text-amber-50/95">{viteVersionLabel}</dd>
        <dt className="text-slate-500">VITE build id</dt>
        <dd className="m-0 break-all text-amber-50/95">{viteBuild}</dd>
        <dt className="text-slate-500">HTML meta build</dt>
        <dd className="m-0 break-all">{readHtmlBuildId() || "(none)"}</dd>
        <dt className="text-slate-500">remote build</dt>
        <dd className="m-0 break-all">{probe.remoteBuildId != null ? String(probe.remoteBuildId) : "-"}</dd>
        <dt className="text-slate-500">remote version</dt>
        <dd className="m-0 break-all">{probe.remoteVersion ?? "-"}</dd>
        <dt className="text-slate-500">mismatch</dt>
        <dd className="m-0 text-rose-200/90">{buildMismatch ?? (probe.aligned ? "none" : probe.probeNote ?? "-")}</dd>
        <dt className="text-slate-500">remote cacheId</dt>
        <dd className="m-0 break-all">{probe.remoteCacheId ?? "-"}</dd>
        <dt className="text-slate-500">Workbox cacheId (srv)</dt>
        <dd className="m-0 break-all">{probe.remoteSwWorkboxCacheId ?? "-"}</dd>
        <dt className="text-slate-500">API source</dt>
        <dd className="m-0 break-all text-emerald-100/90">
          {isPanicHubEnabled() ? "HUB /api/panic/latest" : String(lastPanicFetchUrl ?? "legacy")}
        </dd>
        <dt className="text-slate-500">last fetch</dt>
        <dd className="m-0 break-all">{lastFetchIso}</dd>
        <dt className="text-slate-500">fetch src</dt>
        <dd className="m-0">{lastPanicFetchSource ?? "-"}</dd>
        <dt className="text-slate-500">data stale?</dt>
        <dd className="m-0">{dataStale ? "yes" : "no"}</dd>
        <dt className="text-slate-500">fetch err</dt>
        <dd className="m-0 break-all text-rose-200/80">{lastPanicFetchError ?? "-"}</dd>
        <dt className="text-slate-500">SW regs</dt>
        <dd className="m-0">{swInfo?.registrations ?? "…"}</dd>
        <dt className="text-slate-500">SW control</dt>
        <dd className="m-0 break-all text-slate-300">{swInfo?.controlling ?? "(none)"}</dd>
        <dt className="text-slate-500">SW waiting</dt>
        <dd className="m-0 break-all text-slate-400">{swInfo?.waiting ?? "-"}</dd>
        <dt className="text-slate-500">CSR boot</dt>
        <dd className="m-0">
          init:{initialized ? "yes" : "no"} done:{hydrationRow.lastDone ? "ok" : "pending"}
        </dd>
        <dt className="text-slate-500">panic hydrate</dt>
        <dd className="m-0 text-slate-300">
          {hydrationRow.lastDone ?? "-"}
          {hydrationRow.durationMs != null ? ` (${hydrationRow.durationMs}ms)` : ""}
        </dd>
        <dt className="text-slate-500">PWA standalone</dt>
        <dd className="m-0">{standalone ? "yes" : "no"}</dd>
        <dt className="text-slate-500">iOS standalone</dt>
        <dd className="m-0">{isIosStandalone() ? "yes" : "no"}</dd>
      </dl>
      <p className="mt-1.5 border-t border-white/10 pt-1.5 text-[9px] text-slate-500">
        ?pwa-debug=1 또는 localStorage <code className="text-slate-400">yds-pwa-runtime-debug=1</code>
      </p>
    </section>
  )
}
