import { useCallback, useEffect, useRef, useState } from "react"

function isIOS() {
  if (typeof navigator === "undefined") return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

function isStandalone() {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  )
}

export default function PwaInstallBar({ isMobile = false }) {
  const deferredRef = useRef(null)
  const [canInstall, setCanInstall] = useState(false)
  const [installed, setInstalled] = useState(() => isStandalone())
  const [showIosHint, setShowIosHint] = useState(false)

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true)
      return
    }
    const onPrompt = (e) => {
      e.preventDefault()
      deferredRef.current = e
      setCanInstall(true)
    }
    const onInstalled = () => {
      deferredRef.current = null
      setCanInstall(false)
      setInstalled(true)
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  useEffect(() => {
    if (installed || canInstall) return
    if (isIOS() && !isStandalone()) {
      setShowIosHint(true)
    }
  }, [installed, canInstall])

  const onInstall = useCallback(async () => {
    const ev = deferredRef.current
    if (!ev) return
    try {
      await ev.prompt()
      await ev.userChoice
    } catch {
      /* ignore */
    }
    deferredRef.current = null
    setCanInstall(false)
  }, [])

  if (installed) {
    return (
      <span className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-500/30 sm:text-xs">
        앱 모드
      </span>
    )
  }

  if (canInstall) {
    return (
      <button
        type="button"
        onClick={onInstall}
        className="min-h-[44px] shrink-0 rounded-lg bg-gradient-to-b from-fuchsia-600 to-purple-700 px-5 py-3 text-sm font-semibold text-white shadow-md ring-2 ring-fuchsia-400/35 active:scale-[0.98] sm:min-h-0 sm:px-4 sm:py-2"
      >
        앱 설치
      </button>
    )
  }

  if (showIosHint) {
    return (
      <span
        className="max-w-[210px] leading-snug text-gray-400 sm:max-w-none sm:text-xs"
        style={{
          fontSize: isMobile ? "12px" : "14px",
          textAlign: isMobile ? "center" : "left",
        }}
      >
        Safari <span className="text-purple-300">공유</span> → 홈 화면에 추가
      </span>
    )
  }

  return (
    <span className="hidden text-[10px] text-gray-600 sm:inline sm:text-xs">Chrome·Edge에서 설치 가능</span>
  )
}
