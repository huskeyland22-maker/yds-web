import { useEffect, useMemo, useState } from "react"
import { getDebugEventChannel, getRecentDebugLogs, isDebugModeEnabled } from "../utils/debugLogger.js"

const CHECKLIST_ITEMS = [
  "입력 즉시 저장",
  "카드 즉시 생성",
  "새로고침 유지",
  "모바일 브라우저 유지",
  "키보드 포커스 안정",
  "스크롤 튐 없음",
  "중복 저장 없음",
  "콘솔 에러 없음",
  "저장 속도 1초 이내",
]

function readMemosCount() {
  if (typeof window === "undefined") return 0
  try {
    const raw = window.localStorage.getItem("yds-investment-memos-v1")
    const list = JSON.parse(raw || "[]")
    return Array.isArray(list) ? list.length : 0
  } catch {
    return 0
  }
}

export default function DebugPanel({ metrics = {} }) {
  const [enabled, setEnabled] = useState(() => isDebugModeEnabled())
  const [open, setOpen] = useState(true)
  const [events, setEvents] = useState([])
  const [swInfo, setSwInfo] = useState({ active: false, version: "n/a", cacheCount: 0 })
  const [memoCount, setMemoCount] = useState(() => readMemosCount())
  const [checks, setChecks] = useState(() => Object.fromEntries(CHECKLIST_ITEMS.map((x) => [x, "pending"])))
  const [appState, setAppState] = useState({
    online: true,
    visibility: "visible",
    standalone: false,
    safeAreaBottom: 0,
    keyboardOpen: false,
    viewport: "-",
  })

  useEffect(() => {
    setEnabled(isDebugModeEnabled())
  }, [])

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return
    const channel = getDebugEventChannel()
    const onEvent = (ev) => {
      const row = ev?.detail
      if (!row) return
      setEvents((prev) => [row, ...prev].slice(0, 40))
      setMemoCount(readMemosCount())
    }
    window.addEventListener(channel, onEvent)
    const seed = getRecentDebugLogs()
    if (seed.length) setEvents(seed.slice(0, 40))
    return () => window.removeEventListener(channel, onEvent)
  }, [enabled])

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof document === "undefined") return
    let baseHeight = window.innerHeight
    const update = () => {
      const standalone =
        window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true
      const probe = document.createElement("div")
      probe.style.cssText = "position:fixed;bottom:0;visibility:hidden;padding-bottom:env(safe-area-inset-bottom);"
      document.body.appendChild(probe)
      const safeAreaBottom = parseFloat(getComputedStyle(probe).paddingBottom || "0") || 0
      probe.remove()
      setAppState({
        online: navigator.onLine,
        visibility: document.visibilityState,
        standalone,
        safeAreaBottom,
        keyboardOpen: window.innerHeight < baseHeight - 120,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      })
    }
    const onResize = () => {
      if (window.innerHeight > baseHeight) baseHeight = window.innerHeight
      update()
    }
    update()
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    document.addEventListener("visibilitychange", update)
    window.addEventListener("resize", onResize)
    window.addEventListener("pageshow", update)
    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
      document.removeEventListener("visibilitychange", update)
      window.removeEventListener("resize", onResize)
      window.removeEventListener("pageshow", update)
    }
  }, [enabled, events.length])

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return
    let cancelled = false
    void (async () => {
      try {
        const regs = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistrations() : []
        const cacheCount = "caches" in window ? (await caches.keys()).length : 0
        if (!cancelled) {
          setSwInfo({
            active: regs.length > 0,
            version: regs[0]?.active?.scriptURL ?? "disabled",
            cacheCount,
          })
        }
      } catch {
        if (!cancelled) setSwInfo({ active: false, version: "error", cacheCount: 0 })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, events.length])

  const duplicateCount = useMemo(() => {
    if (typeof window === "undefined") return 0
    try {
      const raw = window.localStorage.getItem("yds-investment-memos-v1")
      const list = JSON.parse(raw || "[]")
      if (!Array.isArray(list)) return 0
      const seen = new Set()
      let dup = 0
      for (const row of list) {
        const key = `${row?.raw ?? ""}::${String(row?.createdAt ?? "").slice(0, 16)}`
        if (seen.has(key)) dup += 1
        seen.add(key)
      }
      return dup
    } catch {
      return 0
    }
  }, [events.length, memoCount])

  const copyDebugReport = async () => {
    const report = {
      generatedAt: new Date().toISOString(),
      metrics,
      appState,
      serviceWorker: swInfo,
      memoCount,
      duplicateCount,
      checks,
      recentEvents: events.slice(0, 30),
    }
    const text = JSON.stringify(report, null, 2)
    try {
      await navigator.clipboard.writeText(text)
      setEvents((prev) => [{ ts: new Date().toISOString(), tag: "DEBUG_REPORT_COPIED", level: "info", payload: {} }, ...prev])
    } catch {
      // noop
    }
  }

  if (!enabled) return null

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[9000] rounded-full border border-amber-300/40 bg-amber-900/70 px-3 py-2 text-[11px] text-amber-100 backdrop-blur"
      >
        🛠 DEBUG
      </button>
    )
  }

  return (
    <section className="fixed bottom-3 right-3 z-[9000] max-h-[78vh] w-[min(92vw,420px)] overflow-auto rounded-2xl border border-amber-500/30 bg-amber-950/85 px-4 py-4 text-xs text-amber-100 shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <p className="m-0 font-semibold">DEBUG PANEL (개발 모드)</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={copyDebugReport}
            className="rounded-md border border-amber-400/40 px-2 py-0.5 text-[11px]"
          >
            Copy Debug Report
          </button>
          <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-amber-400/40 px-2 py-0.5 text-[11px]">
            접기
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-amber-400/20 bg-black/20 px-3 py-2">
          <p className="m-0 text-amber-300">앱 상태</p>
          <p className="m-0 mt-1">build: {metrics.buildVersion ?? "-"}</p>
          <p className="m-0">online: {String(appState.online)}</p>
          <p className="m-0">visibility: {appState.visibility}</p>
          <p className="m-0">standalone: {String(appState.standalone)}</p>
          <p className="m-0">keyboard: {String(appState.keyboardOpen)}</p>
          <p className="m-0">viewport: {appState.viewport}</p>
          <p className="m-0">safe-area: {appState.safeAreaBottom}px</p>
        </div>
        <div className="rounded-lg border border-amber-400/20 bg-black/20 px-3 py-2">
          <p className="m-0 text-amber-300">저장 상태</p>
          <p className="m-0 mt-1">success: {String(metrics.saveOk ?? "-")}</p>
          <p className="m-0">last save: {metrics.lastSaveAt ?? "-"}</p>
          <p className="m-0">source: {metrics.lastSaveSource ?? "-"}</p>
          <p className="m-0">pending: {String(metrics.pendingSave ?? false)}</p>
          <p className="m-0">latency: {metrics.saveLatencyMs ?? "-"}ms</p>
        </div>
        <div className="rounded-lg border border-amber-400/20 bg-black/20 px-3 py-2">
          <p className="m-0 text-amber-300">Hydration</p>
          <p className="m-0 mt-1">hydrated: {String(metrics.hydrated ?? false)}</p>
          <p className="m-0">persist loading: {String(metrics.persistLoading ?? false)}</p>
          <p className="m-0">duration: {metrics.hydrationDurationMs ?? "-"}ms</p>
        </div>
        <div className="rounded-lg border border-amber-400/20 bg-black/20 px-3 py-2">
          <p className="m-0 text-amber-300">Service Worker</p>
          <p className="m-0 mt-1">active: {String(swInfo.active)}</p>
          <p className="m-0 break-all">version: {swInfo.version}</p>
          <p className="m-0">cache count: {swInfo.cacheCount}</p>
          <p className="m-0">stale: {String(Boolean(metrics.cacheStale))}</p>
        </div>
        <div className="rounded-lg border border-amber-400/20 bg-black/20 px-3 py-2">
          <p className="m-0 text-amber-300">데이터 상태</p>
          <p className="m-0 mt-1">memo count: {memoCount}</p>
          <p className="m-0">last data ts: {metrics.lastDataTs ?? "-"}</p>
          <p className="m-0">duplicate: {duplicateCount}</p>
          <p className="m-0">last memo id: {metrics.lastMemoId ?? "-"}</p>
        </div>
        <div className="rounded-lg border border-amber-400/20 bg-black/20 px-3 py-2">
          <p className="m-0 text-amber-300">렌더링 상태</p>
          <p className="m-0 mt-1">render count: {metrics.renderCount ?? 0}</p>
          <p className="m-0">fetch count: {metrics.fetchCount ?? 0}</p>
          <p className="m-0">rerender burst: {String(Boolean(metrics.rerenderBurst))}</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-amber-400/20 bg-black/20 px-3 py-2">
        <p className="m-0 mb-1 text-amber-300">테스트 체크리스트 (PASS/FAIL)</p>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {CHECKLIST_ITEMS.map((item) => (
            <div key={item} className="flex items-center gap-2">
              <span className="flex-1">{item}</span>
              <button
                type="button"
                onClick={() => setChecks((prev) => ({ ...prev, [item]: "pass" }))}
                className="rounded border border-emerald-400/40 px-1.5 py-0 text-[10px]"
              >
                PASS
              </button>
              <button
                type="button"
                onClick={() => setChecks((prev) => ({ ...prev, [item]: "fail" }))}
                className="rounded border border-rose-400/40 px-1.5 py-0 text-[10px]"
              >
                FAIL
              </button>
              <span className="w-12 text-right text-[10px]">{checks[item].toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-amber-400/20 bg-black/20 px-3 py-2">
        <p className="m-0 mb-1 text-amber-300">최근 이벤트</p>
        <div className="max-h-36 space-y-1 overflow-auto">
          {events.slice(0, 10).map((ev, idx) => (
            <p key={`${ev.ts}-${idx}`} className="m-0 break-all">
              [{ev.tag}] {ev.ts} ({ev.payload?.source ?? "n/a"})
            </p>
          ))}
          {!events.length ? <p className="m-0 text-amber-200/70">이벤트 없음</p> : null}
        </div>
      </div>
    </section>
  )
}

