import { useState } from "react"
import { useRegisterSW } from "virtual:pwa-register/react"
import { getToken } from "firebase/messaging"
import { submitManualPanicData } from "./config/api.js"
import { getFirebaseMessagingSafe, hasFirebaseConfig } from "./firebase.js"
import PwaInstallBar from "./components/PwaInstallBar.jsx"
import SignalDashboard from "./components/SignalDashboard.jsx"

const MENU = [
  "시그널 데스크",
  "오늘의 시그널",
  "시장 사이클",
  "종목 발굴",
  "종목 분석",
  "매매 전략",
  "인사이트",
]

function App() {
  useRegisterSW()
  const [openInput, setOpenInput] = useState(false)
  const [inputText, setInputText] = useState("")

  const sendNotification = (title, body) => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body })
    } else {
      console.warn("알림 권한 없음 또는 미지원")
    }
  }

  const submitInput = async () => {
    try {
      const parsed = JSON.parse(inputText)
      await submitManualPanicData(parsed)
      window.alert("✅ 저장 완료")
      setOpenInput(false)
    } catch (err) {
      window.alert("JSON 형식이 올바르지 않습니다")
      console.error("데이터 입력 저장 실패", err)
    }
  }

  const requestPushPermission = async () => {
    try {
      if (typeof window === "undefined" || !("Notification" in window)) {
        alert("이 브라우저는 알림을 지원하지 않습니다.")
        return
      }
      if (!hasFirebaseConfig()) {
        alert("Firebase 환경변수(VITE_FIREBASE_*)를 먼저 설정하세요.")
        return
      }
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        alert("알림 권한이 허용되지 않았습니다.")
        return
      }
      const messaging = await getFirebaseMessagingSafe()
      if (!messaging) {
        alert("이 브라우저/환경에서는 Firebase Messaging을 사용할 수 없습니다.")
        return
      }
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
      if (!vapidKey) {
        alert("VITE_FIREBASE_VAPID_KEY를 설정하세요.")
        return
      }
      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: await navigator.serviceWorker.register("/firebase-messaging-sw.js"),
      })
      console.log("토큰:", token)
      alert(token ? "푸시 알림 활성화 완료" : "토큰 발급 실패")
    } catch (err) {
      console.error("푸시 알림 활성화 실패", err)
      alert("푸시 알림 활성화 중 오류가 발생했습니다.")
    }
  }

  return (
    <div className="flex min-h-[100dvh] min-h-screen flex-col bg-[#0b0f1a] text-gray-200 lg:flex-row">
      <aside className="flex w-full shrink-0 flex-row gap-1 overflow-x-auto border-b border-gray-800/80 bg-[#0f172a] px-2 py-3 lg:h-[100dvh] lg:w-60 lg:flex-col lg:border-b-0 lg:border-r lg:px-2 lg:py-4">
        <div className="mb-0 shrink-0 px-2 py-1 lg:mb-4 lg:px-3">
          <p className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.2em] text-purple-400">
            Signal Flow
          </p>
        </div>
        <nav className="flex min-h-[48px] flex-1 flex-row items-stretch gap-1 lg:flex-col lg:items-stretch lg:px-2">
          {MENU.map((label, i) => (
            <div
              key={label}
              role="presentation"
              className={
                i === 0
                  ? "flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg bg-purple-600 px-4 py-3 text-sm font-medium text-white lg:min-w-0 lg:justify-start lg:px-3 lg:py-3"
                  : "flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg px-4 py-3 text-sm text-gray-300 transition-colors hover:bg-gray-800/60 lg:min-w-0 lg:justify-start lg:px-3 lg:py-3"
              }
            >
              <span className="whitespace-nowrap">{label}</span>
            </div>
          ))}
        </nav>
        <div className="hidden lg:block lg:mt-auto lg:px-2 lg:pt-5">
          <button
            type="button"
            onClick={() => setOpenInput(true)}
            className="w-full rounded-lg border border-violet-500/40 bg-violet-500/20 px-2 py-2 text-xs text-violet-300 transition-colors hover:bg-violet-500/30"
          >
            📥 데이터 입력
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-[52px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-800/80 bg-[#0b0f1a] px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-400 sm:text-xs">
            <span>
              <span className="text-gray-500">KOSPI </span>
              <span className="font-mono text-gray-200">2,612.34</span>
              <span className="ml-1 font-mono text-green-400">+0.42%</span>
            </span>
            <span>
              <span className="text-gray-500">NASDAQ </span>
              <span className="font-mono text-gray-200">18,204.12</span>
              <span className="ml-1 font-mono text-red-400">-0.18%</span>
            </span>
            <span>
              <span className="text-gray-500">USD/KRW </span>
              <span className="font-mono text-gray-200">1,384.50</span>
            </span>
          </div>
          <PwaInstallBar />
          <button
            type="button"
            onClick={requestPushPermission}
            style={{
              marginTop: "10px",
              padding: "10px",
              borderRadius: "10px",
              background: "#16a34a",
              color: "white",
              border: "none",
              cursor: "pointer",
            }}
          >
            🔔 푸시 알림 활성화
          </button>
          <button
            type="button"
            onClick={() => {
              if (!("Notification" in window)) return
              console.log("Notification 상태:", Notification.permission)
              Notification.requestPermission().then((permission) => {
                console.log("권한:", permission)
                if (permission === "granted") {
                  sendNotification("알림 허용 완료", "이제 알림이 정상 작동합니다")
                }
              })
            }}
            style={{
              marginTop: "10px",
              padding: "10px",
              borderRadius: "10px",
              background: "#2563eb",
              color: "white",
              border: "none",
              cursor: "pointer",
            }}
          >
            🔔 알림 켜기
          </button>
          <button
            type="button"
            onClick={() => {
              if ("Notification" in window) {
                console.log("Notification 상태:", Notification.permission)
              }
              sendNotification("테스트 알림", "정상 작동 확인")
            }}
            style={{
              marginTop: "10px",
              padding: "10px",
              borderRadius: "10px",
              background: "#2563eb",
              color: "white",
              border: "none",
              cursor: "pointer",
            }}
          >
            🔔 알림 테스트
          </button>
        </header>

        <main className="flex-1 overflow-auto px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <SignalDashboard />
        </main>
      </div>
      <div
        className={`fixed right-0 top-0 z-[9999] h-full w-[300px] bg-[#111827] p-5 shadow-[-4px_0_10px_rgba(0,0,0,0.3)] transition-transform duration-300 ${
          openInput ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          width: "360px",
          background: "linear-gradient(180deg, #0f172a, #020617)",
          boxShadow: "-6px 0 20px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ marginBottom: "15px" }}>
          <h3 style={{ color: "#c4b5fd", marginBottom: "5px" }}>⚙️ 데이터 입력</h3>
          <p style={{ fontSize: "12px", color: "#64748b" }}>JSON 형식으로 전체 데이터 입력</p>
        </div>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`{
  "vix": 18.2,
  "fearGreed": 45,
  "putCall": 0.9,
  "bofa": 3.2,
  "highYield": 4.1
}`}
          style={{
            flex: 1,
            background: "#020617",
            color: "#e2e8f0",
            border: "1px solid #1e293b",
            borderRadius: "10px",
            padding: "14px",
            fontFamily: "monospace",
            fontSize: "13px",
            lineHeight: "1.5",
            outline: "none",
            boxShadow: "inset 0 0 10px rgba(0,0,0,0.4)",
          }}
        />
        <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
          <button
            type="button"
            onClick={submitInput}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              background: "#7c3aed",
              color: "white",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            💾 저장
          </button>
          <button
            type="button"
            onClick={() => setOpenInput(false)}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              background: "#1e293b",
              color: "#94a3b8",
              border: "none",
              cursor: "pointer",
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
