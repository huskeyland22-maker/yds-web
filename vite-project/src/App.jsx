import { useState } from "react"
import { submitManualPanicData } from "./config/api.js"
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
  const [openInput, setOpenInput] = useState(false)
  const [inputData, setInputData] = useState({
    vix: "",
    fearGreed: "",
    putCall: "",
    bofa: "",
    highYield: "",
  })

  const submitInput = async () => {
    try {
      await submitManualPanicData(inputData)
      setOpenInput(false)
    } catch (err) {
      console.error("데이터 입력 저장 실패", err)
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
        </header>

        <main className="flex-1 overflow-auto px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <SignalDashboard />
        </main>
      </div>
      <div
        className={`fixed right-0 top-0 z-[9999] h-full w-[300px] bg-[#111827] p-5 shadow-[-4px_0_10px_rgba(0,0,0,0.3)] transition-transform duration-300 ${
          openInput ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <h3 className="text-base font-semibold text-gray-100">데이터 입력</h3>
        <input
          placeholder="VIX"
          value={inputData.vix}
          onChange={(e) => setInputData((prev) => ({ ...prev, vix: e.target.value }))}
          className="mt-2 w-full rounded-md border border-gray-700 bg-[#0f172a] px-2 py-2 text-sm text-gray-100"
        />
        <input
          placeholder="FearGreed"
          value={inputData.fearGreed}
          onChange={(e) => setInputData((prev) => ({ ...prev, fearGreed: e.target.value }))}
          className="mt-2 w-full rounded-md border border-gray-700 bg-[#0f172a] px-2 py-2 text-sm text-gray-100"
        />
        <input
          placeholder="Put/Call"
          value={inputData.putCall}
          onChange={(e) => setInputData((prev) => ({ ...prev, putCall: e.target.value }))}
          className="mt-2 w-full rounded-md border border-gray-700 bg-[#0f172a] px-2 py-2 text-sm text-gray-100"
        />
        <input
          placeholder="BofA"
          value={inputData.bofa}
          onChange={(e) => setInputData((prev) => ({ ...prev, bofa: e.target.value }))}
          className="mt-2 w-full rounded-md border border-gray-700 bg-[#0f172a] px-2 py-2 text-sm text-gray-100"
        />
        <input
          placeholder="HighYield"
          value={inputData.highYield}
          onChange={(e) => setInputData((prev) => ({ ...prev, highYield: e.target.value }))}
          className="mt-2 w-full rounded-md border border-gray-700 bg-[#0f172a] px-2 py-2 text-sm text-gray-100"
        />
        <button
          type="button"
          style={{ marginTop: "10px" }}
          onClick={submitInput}
          className="w-full rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          저장
        </button>
        <button
          type="button"
          style={{ marginTop: "10px" }}
          onClick={() => setOpenInput(false)}
          className="w-full rounded-md border border-gray-700 bg-[#0f172a] px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
        >
          닫기
        </button>
      </div>
    </div>
  )
}

export default App
