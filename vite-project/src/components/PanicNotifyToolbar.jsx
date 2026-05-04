import { useCallback, useEffect, useState } from "react"
import { requestNotificationPermission } from "../hooks/usePanicNotifications.js"

const LS_ON = "yds-panic-notify-on"

export function readNotifyOn() {
  try {
    return localStorage.getItem(LS_ON) === "1"
  } catch {
    return false
  }
}

export function writeNotifyOn(on) {
  try {
    if (on) localStorage.setItem(LS_ON, "1")
    else localStorage.removeItem(LS_ON)
  } catch {
    /* ignore */
  }
}

const btnClass =
  "min-h-[44px] rounded-lg bg-gradient-to-b from-purple-500 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(168,85,247,0.45)] ring-2 ring-purple-400/40 transition hover:from-purple-400 hover:to-violet-500 hover:shadow-[0_0_28px_rgba(192,132,252,0.55)] active:scale-[0.98] sm:min-h-0 sm:py-2"

export default function PanicNotifyToolbar({ notifyEnabled, setNotifyEnabled }) {
  const [perm, setPerm] = useState(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "denied",
  )

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return
    setPerm(Notification.permission)
  }, [notifyEnabled])

  const unsupported = typeof window === "undefined" || !("Notification" in window)

  const onActivate = useCallback(async () => {
    if (unsupported) return
    try {
      await requestNotificationPermission()
      setPerm(Notification.permission)
      if (Notification.permission === "granted") {
        setNotifyEnabled(true)
        writeNotifyOn(true)
      }
    } catch {
      /* ignore */
    }
  }, [setNotifyEnabled, unsupported])

  const onDisable = useCallback(() => {
    setNotifyEnabled(false)
    writeNotifyOn(false)
  }, [setNotifyEnabled])

  const onResume = useCallback(() => {
    setNotifyEnabled(true)
    writeNotifyOn(true)
  }, [setNotifyEnabled])

  if (unsupported) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-800/80 bg-[#0f172a]/60 px-3 py-2 text-xs text-gray-500">
        이 브라우저에서는 알림을 사용할 수 없습니다.
      </div>
    )
  }

  const granted = perm === "granted"
  const active = granted && notifyEnabled
  const denied = perm === "denied"

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-purple-500/25 bg-gradient-to-r from-[#1e1033]/90 to-[#0f172a]/90 px-4 py-4 shadow-[0_0_24px_rgba(168,85,247,0.12)] sm:py-3">
      <div className="text-left text-xs text-gray-400">
        <p className="font-medium text-purple-200/90">실시간 알림</p>
        <p className="mt-0.5 text-[11px] text-gray-500">
          점수 70↑ / 30↓ / 10p 이상 변동 시 알림 (1분 쿨타임)
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {active ? (
          <>
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-500/30">
              알림 켜짐
            </span>
            <button
              type="button"
              onClick={onDisable}
              className="min-h-[44px] rounded-lg border border-gray-600 bg-gray-800/80 px-4 py-2 text-xs font-medium text-gray-300 transition hover:bg-gray-700 sm:min-h-0 sm:py-1.5"
            >
              끄기
            </button>
          </>
        ) : denied ? (
          <span className="max-w-[220px] text-right text-[11px] text-amber-200/90">
            브라우저 설정에서 이 사이트 알림을 허용해 주세요.
          </span>
        ) : granted && !notifyEnabled ? (
          <button type="button" onClick={onResume} className={btnClass}>
            🔔 알림 다시 켜기
          </button>
        ) : (
          <button type="button" onClick={onActivate} className={btnClass}>
            🔔 알림 활성화
          </button>
        )}
      </div>
    </div>
  )
}
