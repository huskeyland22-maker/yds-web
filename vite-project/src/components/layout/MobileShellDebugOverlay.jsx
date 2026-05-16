import { useEffect, useState } from "react"
import { usePanicStore } from "../../store/panicStore.js"
import { readHtmlBuildId } from "../../utils/pwaFreshness.js"

export function isMobileShellDebugVisible() {
  if (typeof window === "undefined") return false
  try {
    if (new URLSearchParams(window.location.search).get("mobile-debug") === "1") return true
    if (window.localStorage?.getItem("yds-mobile-shell-debug") === "1") return true
  } catch {
    // ignore
  }
  return import.meta.env.DEV
}

/**
 * iOS/PWA 먹통 진단 — hydration·overflow·패널 상태 (CSR 전용, SSR 없음).
 * `?mobile-debug=1` 또는 `localStorage yds-mobile-shell-debug=1`
 */
export default function MobileShellDebugOverlay() {
  const [visible, setVisible] = useState(() => isMobileShellDebugVisible())
  const [open, setOpen] = useState(true)
  const [tick, setTick] = useState(0)
  const [lastError, setLastError] = useState(null)

  const panicInitialized = usePanicStore((s) => s.initialized)
  const lastPanicFetchError = usePanicStore((s) => s.lastPanicFetchError)

  useEffect(() => {
    const id = window.setInterval(() => setVisible(isMobileShellDebugVisible()), 2000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!visible) return undefined
    const id = window.setInterval(() => setTick((t) => t + 1), 1500)
    return () => window.clearInterval(id)
  }, [visible])

  useEffect(() => {
    if (!visible || typeof window === "undefined") return undefined
    const onErr = (msg, _src, _line, _col, err) => {
      setLastError(err?.message ?? String(msg ?? "error"))
    }
    const onRej = (ev) => {
      const reason = ev?.reason
      setLastError(reason instanceof Error ? reason.message : String(reason ?? "unhandled rejection"))
    }
    window.addEventListener("error", onErr)
    window.addEventListener("unhandledrejection", onRej)
    return () => {
      window.removeEventListener("error", onErr)
      window.removeEventListener("unhandledrejection", onRej)
    }
  }, [visible])

  if (!visible) return null

  const root = typeof document !== "undefined" ? document.getElementById("root") : null
  const bodyOverflow =
    typeof document !== "undefined" ? document.body?.style?.overflow || "(css default)" : "—"
  const vw =
    typeof window !== "undefined"
      ? `${Math.round(window.innerWidth)}×${Math.round(window.innerHeight)}`
      : "—"
  const standalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)")?.matches === true || window.navigator.standalone === true)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-2 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-[9050] rounded-full border border-sky-400/40 bg-[#0a0d12]/95 px-2 py-1 text-[10px] font-medium text-sky-100 shadow-lg lg:hidden"
      >
        모바일 진단
      </button>
    )
  }

  return (
    <section
      className="fixed left-2 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-[9050] max-h-[40vh] w-[min(92vw,300px)] overflow-auto rounded-lg border border-sky-500/35 bg-[#0a0d12]/96 p-2 text-[10px] leading-tight text-slate-200 shadow-xl lg:hidden"
      aria-label="모바일 셸 진단"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="m-0 font-semibold text-sky-100">모바일 셸</p>
        <button
          type="button"
          className="rounded border border-white/15 px-1.5 py-0.5 text-[9px]"
          onClick={() => setOpen(false)}
        >
          접기
        </button>
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 font-mono">
        <dt className="text-slate-500">viewport</dt>
        <dd className="m-0">{vw}</dd>
        <dt className="text-slate-500">standalone</dt>
        <dd className="m-0">{standalone ? "yes" : "no"}</dd>
        <dt className="text-slate-500">#root kids</dt>
        <dd className="m-0">{root?.childElementCount ?? 0}</dd>
        <dt className="text-slate-500">body overflow</dt>
        <dd className="m-0 break-all text-amber-100/90">{bodyOverflow}</dd>
        <dt className="text-slate-500">panic init</dt>
        <dd className="m-0">{panicInitialized ? "yes" : "no"}</dd>
        <dt className="text-slate-500">panic err</dt>
        <dd className="m-0 break-all text-rose-200/90">{lastPanicFetchError ?? "—"}</dd>
        <dt className="text-slate-500">build meta</dt>
        <dd className="m-0 break-all">{readHtmlBuildId() || "—"}</dd>
        <dt className="text-slate-500">window err</dt>
        <dd className="m-0 break-all text-rose-200/90">{lastError ?? "—"}</dd>
        <dt className="text-slate-500">tick</dt>
        <dd className="m-0 tabular-nums">{tick}</dd>
      </dl>
      <p className="m-0 mt-1 border-t border-white/10 pt-1 text-[9px] text-slate-500">
        ?mobile-debug=1 · CSR only (no hydration)
      </p>
    </section>
  )
}
