import { useCallback, useEffect, useState } from "react"
import { applyPwaUpdate } from "../utils/pwaFreshness.js"

const PWA_UPDATE_EVENT = "yds:pwa-update-available"

/**
 * 신규 배포 감지 시 하단 토스트 — "지금 업데이트" 시 reload / SW skipWaiting.
 */
export default function PwaUpdateToast() {
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const onUpdate = () => setVisible(true)
    window.addEventListener(PWA_UPDATE_EVENT, onUpdate)
    return () => window.removeEventListener(PWA_UPDATE_EVENT, onUpdate)
  }, [])

  const onApply = useCallback(() => {
    if (busy) return
    setBusy(true)
    const safetyReload = window.setTimeout(() => {
      window.location.reload()
    }, 3500)
    void applyPwaUpdate()
      .catch(() => window.location.reload())
      .finally(() => window.clearTimeout(safetyReload))
  }, [busy])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 z-[10002] w-[min(92vw,22rem)] -translate-x-1/2 rounded-xl border border-sky-400/35 bg-[rgba(8,20,36,0.96)] px-3 py-2.5 shadow-lg backdrop-blur-md"
    >
      <p className="m-0 text-center text-[13px] font-medium text-sky-100">새 버전 발견</p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onApply()}
        className="mt-2 w-full rounded-lg border border-sky-400/40 bg-sky-500/20 py-2 text-[13px] font-semibold text-sky-50 transition active:bg-sky-500/35 disabled:opacity-60"
      >
        {busy ? "업데이트 중…" : "지금 업데이트"}
      </button>
    </div>
  )
}
