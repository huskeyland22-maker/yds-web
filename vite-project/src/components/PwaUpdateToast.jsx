import { useCallback, useEffect, useState } from "react"
import {
  applyPwaUpdate,
  dismissPwaUpdateToast,
  isPwaUpdateToastDismissed,
  PWA_UPDATE_EVENT,
} from "../utils/pwaFreshness.js"

/**
 * 신규 배포 감지 시 하단 토스트 — "지금 업데이트" 시 SW·캐시 정리 후 reload.
 */
export default function PwaUpdateToast() {
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [remoteBuildId, setRemoteBuildId] = useState(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const onUpdate = (event) => {
      const id = event?.detail?.remoteBuildId != null ? String(event.detail.remoteBuildId) : null
      if (id && isPwaUpdateToastDismissed(id)) return
      if (id) setRemoteBuildId(id)
      setVisible(true)
      setBusy(false)
    }
    window.addEventListener(PWA_UPDATE_EVENT, onUpdate)
    return () => window.removeEventListener(PWA_UPDATE_EVENT, onUpdate)
  }, [])

  const onDismiss = useCallback(() => {
    if (remoteBuildId) dismissPwaUpdateToast(remoteBuildId)
    setVisible(false)
    setBusy(false)
  }, [remoteBuildId])

  const onApply = useCallback(() => {
    if (busy) return
    setBusy(true)
    setVisible(false)
    void applyPwaUpdate().catch(() => {
      window.location.replace(
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
      )
    })
  }, [busy])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 z-[10002] w-[min(92vw,22rem)] -translate-x-1/2 rounded-xl border border-sky-400/35 bg-[rgba(8,20,36,0.96)] px-3 py-2.5 shadow-lg backdrop-blur-md"
    >
      <p className="m-0 text-center text-[13px] font-medium text-sky-100">새 버전 업데이트 가능</p>
      <button
        type="button"
        disabled={busy}
        onClick={onApply}
        className="mt-2 w-full rounded-lg border border-sky-400/40 bg-sky-500/20 py-2 text-[13px] font-semibold text-sky-50 transition active:bg-sky-500/35 disabled:opacity-60"
      >
        {busy ? "업데이트 중…" : "지금 업데이트"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onDismiss}
        className="mt-1.5 w-full py-1 text-[11px] text-slate-500 underline-offset-2 hover:text-slate-400"
      >
        나중에
      </button>
    </div>
  )
}
