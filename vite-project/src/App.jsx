import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { LogIn } from "lucide-react"
import { Route, Routes, useLocation, useNavigate } from "react-router-dom"
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth"
import { doc, serverTimestamp, setDoc } from "firebase/firestore"
import { submitManualPanicData } from "./config/api.js"
import BuyTop5Card from "./components/BuyTop5Card.jsx"
import GlobalMarketBar from "./components/GlobalMarketBar.jsx"
import PwaInstallBar from "./components/PwaInstallBar.jsx"
import SignalDashboard from "./components/SignalDashboard.jsx"
import { auth, db, hasFirebaseConfig } from "./firebase.js"
import StrategyPage from "./pages/StrategyPage.jsx"
import { usePanicStore } from "./store/panicStore.js"

const MENU = [
  { label: "오늘의 시그널", path: "/", active: true },
  { label: "매매 전략", path: "/strategy", active: true },
  { label: "종목 발굴", path: "/finder", active: true },
  { label: "시장 사이클", active: false },
  { label: "종목 분석", active: false },
  { label: "인사이트", active: false },
]

const METRIC_DEFS = [
  { key: "vix", label: "VIX" },
  { key: "vxn", label: "VXN" },
  { key: "fearGreed", label: "Fear & Greed" },
  { key: "bofa", label: "BofA" },
  { key: "move", label: "MOVE" },
  { key: "skew", label: "SKEW" },
  { key: "putCall", label: "Put/Call" },
  { key: "highYield", label: "High Yield" },
  { key: "gsBullBear", label: "GS B/B" },
]
const METRIC_KEYS = ["vix", "vxn", "fearGreed", "bofa", "move", "skew", "putCall", "highYield", "gsBullBear"]
const APP_BUILD_ID = import.meta.env.VITE_APP_BUILD_ID ?? "dev"
const PWA_RESUME_RELOAD_COOLDOWN_MS = 10_000
const PANIC_TEXT_DRAFT_KEY = "yds-panic-text-draft-v1"
const PANIC_TEXT_PLACEHOLDER = `분류,지수 명칭,최종 확정 수치,전일 대비 (Δ),상태 등급
단기,1. VIX Index,17.38,📉 -0.63,🟢 안정
단기,2. VXN Index,22.45,📉 -0.43,🟢 안정
단기,3. 풋/콜 비율,0.62,📉 -0.01,🟢 안정
중기,4. CNN F&G,66,-,🟡 탐욕
중기,5. MOVE Index,77.92,📉 -0.19,🟢 안정
중기,6. BofA B&B,6.5,-,🟡 주의
장기,7. SKEW Index,141.65,📉 -0.47,🟡 주의
장기,8. 하이일드 스프레드,1.68%,-,🟢 안정
장기,9. GS B/B 지수,68.0%,-,🟡 주의`
const REQUIRED_KEYS = ["vix", "fearGreed", "bofa", "putCall", "highYield"]

const FIELD_LABELS = {
  vix: "VIX",
  vxn: "VXN",
  fearGreed: "Fear & Greed",
  bofa: "BofA",
  move: "MOVE",
  skew: "SKEW",
  putCall: "Put/Call",
  highYield: "High Yield",
  gsBullBear: "GS B/B",
}

function isIosStandalonePwa() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false
  const ua = navigator.userAgent || ""
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true
  return ios && standalone
}

function forceResumeReloadWithCooldown() {
  if (!isIosStandalonePwa() || typeof window === "undefined") return
  try {
    const key = "yds-pwa-resume-reload-at"
    const now = Date.now()
    const last = Number(window.sessionStorage.getItem(key) || "0")
    if (Number.isFinite(last) && now - last < PWA_RESUME_RELOAD_COOLDOWN_MS) return
    window.sessionStorage.setItem(key, String(now))
    window.location.reload()
  } catch {
    window.location.reload()
  }
}

function normalizeNumberToken(raw) {
  if (!raw) return null
  const cleaned = String(raw).replace(/%/g, "").replace(/,/g, "").trim()
  const parsed = parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function extractLineValue(line) {
  const parts = String(line).split(",").map((p) => p.trim()).filter(Boolean)
  for (let i = 0; i < parts.length; i += 1) {
    const n = normalizeNumberToken(parts[i])
    if (n != null) return n
  }
  const fallback = String(line).match(/[-+]?\d+(?:\.\d+)?%?/)
  return normalizeNumberToken(fallback?.[0] ?? null)
}

function parseTextPanicData(text) {
  const source = String(text || "")
  const lines = source.split(/\r?\n/).map((ln) => ln.trim()).filter(Boolean)
  const out = Object.fromEntries(METRIC_KEYS.map((k) => [k, null]))
  const hit = new Set()

  const applyByPattern = (pattern, key) => {
    const line = lines.find((ln) => pattern.test(ln))
    if (!line) return
    const n = extractLineValue(line)
    if (n == null) return
    out[key] = n
    hit.add(key)
  }

  applyByPattern(/\bVIX\b/i, "vix")
  applyByPattern(/\bVXN\b/i, "vxn")
  applyByPattern(/(?:풋\/콜|Put\/Call|PutCall|풋콜)/i, "putCall")
  applyByPattern(/(?:CNN\s*F&G|Fear\s*&\s*Greed|공포탐욕|탐욕지수)/i, "fearGreed")
  applyByPattern(/\bMOVE\b/i, "move")
  applyByPattern(/BofA(?:\s*B&B)?/i, "bofa")
  applyByPattern(/\bSKEW\b/i, "skew")
  applyByPattern(/(?:하이일드|HY\s*스프레드|High\s*Yield)/i, "highYield")
  applyByPattern(/(?:GS\s*B\/B|GS\s*Bull\s*Bear)/i, "gsBullBear")

  return {
    data: out,
    missingRequired: REQUIRED_KEYS.filter((key) => out[key] == null),
    hitCount: hit.size,
  }
}

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const panicData = usePanicStore((s) => s.panicData)
  const manualMode = usePanicStore((s) => s.manualMode)
  const panicInitialized = usePanicStore((s) => s.initialized)
  const initializePanicData = usePanicStore((s) => s.initializePanicData)
  const applyManualPanicData = usePanicStore((s) => s.applyManualPanicData)
  const releaseManualMode = usePanicStore((s) => s.releaseManualMode)
  const startAutoRefresh = usePanicStore((s) => s.startAutoRefresh)
  const stopAutoRefresh = usePanicStore((s) => s.stopAutoRefresh)
  const syncOnAppResume = usePanicStore((s) => s.syncOnAppResume)
  const [openInput, setOpenInput] = useState(false)
  const [inputText, setInputText] = useState("")
  const [user, setUser] = useState(null)
  const [saveToast, setSaveToast] = useState("")
  const [saveDone, setSaveDone] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [inputError, setInputError] = useState("")
  const [buildVersion, setBuildVersion] = useState(`v1.0.${String(APP_BUILD_ID).slice(-6)}`)
  const valueMapIframeRef = useRef(null)
  const [valueMapHeight, setValueMapHeight] = useState(800)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  )

  const parseResult = useMemo(() => parseTextPanicData(inputText), [inputText])
  const parsedData = parseResult.data
  const missingFields = useMemo(() => METRIC_DEFS.filter(({ key }) => parsedData[key] === null).map(({ key }) => key), [parsedData])
  const previewTone = useMemo(() => {
    const { vix, fearGreed } = parsedData
    if (!Number.isFinite(vix) || !Number.isFinite(fearGreed)) return "분석 대기"
    if (fearGreed <= 25 || vix >= 30) return "패닉"
    if (fearGreed <= 45 || vix >= 22) return "관망"
    if (fearGreed <= 70 || vix >= 16) return "중립"
    return "공격"
  }, [parsedData])

  const syncValueMapHeight = useCallback(() => {
    const frame = valueMapIframeRef.current
    if (!frame) return
    try {
      const doc = frame.contentWindow?.document
      const bodyHeight = doc?.body?.scrollHeight ?? 0
      const htmlHeight = doc?.documentElement?.scrollHeight ?? 0
      const nextHeight = Math.max(bodyHeight, htmlHeight, isMobile ? 1200 : 800)
      setValueMapHeight(nextHeight)
    } catch {
      setValueMapHeight(isMobile ? 1200 : 800)
    }
  }, [isMobile])

  const handleValueMapLoad = useCallback(() => {
    syncValueMapHeight()
    // iframe 내부의 비동기 렌더(데이터 fetch) 완료 후 높이 재동기화
    window.setTimeout(syncValueMapHeight, 250)
    window.setTimeout(syncValueMapHeight, 1000)
  }, [syncValueMapHeight])

  const submitInput = () => {
    const { vix, vxn, fearGreed, bofa, move, skew, putCall, highYield, gsBullBear } = parsedData
    if (
      vix === null ||
      fearGreed === null ||
      bofa === null ||
      putCall === null ||
      highYield === null
    ) {
      const requiredMissingLabels = parseResult.missingRequired.map((key) => FIELD_LABELS[key] ?? key)
      setInputError(`${requiredMissingLabels.join(", ")} 값을 찾을 수 없습니다. 입력 텍스트를 확인해 주세요.`)
      return
    }
    setInputError("")

    const normalizedParsedData = {
      vix,
      vxn,
      fearGreed,
      bofa,
      move,
      skew,
      putCall,
      highYield,
      gsBullBear,
    }

    try {
      setIsSaving(true)
      console.log("manualData:", normalizedParsedData)

      // 1) 중앙 store를 통한 단일 업데이트 경로
      applyManualPanicData(normalizedParsedData)
      const current = usePanicStore.getState?.().panicData ?? null
      console.log("renderData:", current)

      // 2) UI 즉시 종료
      setSaveDone(true)
      setSaveToast("✅ 패닉지수 저장 완료")
      setIsSaving(false)
      setOpenInput(false)
      window.setTimeout(() => {
        setOpenInput(false)
      }, 100)

      // 3) 서버 저장은 백그라운드 처리 (UI 블로킹 금지)
      void (async () => {
        try {
          // 서버 동기화는 수행하되, 로컬 스냅샷 우선 정책을 위해
          // 응답으로 클라이언트 상태를 덮어쓰지 않습니다.
          await submitManualPanicData(normalizedParsedData)
        } catch (err) {
          console.error("AI 리포트 저장 실패", err)
        }
      })()

      if (db) {
        void (async () => {
          try {
            const reportId = String(Date.now())
            await setDoc(doc(db, "panic_reports", reportId), {
              ...normalizedParsedData,
              source: "ai_report",
              createdAt: serverTimestamp(),
            })
          } catch (fireErr) {
            console.error("panic_reports 저장 실패", fireErr)
          }
        })()
      }
    } catch (err) {
      console.error(err)
      setIsSaving(false)
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const savedDraft = window.localStorage.getItem(PANIC_TEXT_DRAFT_KEY)
      if (savedDraft) setInputText(savedDraft)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      if (inputText.trim()) {
        window.localStorage.setItem(PANIC_TEXT_DRAFT_KEY, inputText)
      } else {
        window.localStorage.removeItem(PANIC_TEXT_DRAFT_KEY)
      }
    } catch {
      // ignore
    }
  }, [inputText])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await initializePanicData()
      if (cancelled) return
      startAutoRefresh()
    })()
    return () => {
      cancelled = true
      stopAutoRefresh()
    }
  }, [initializePanicData, startAutoRefresh, stopAutoRefresh])

  useEffect(() => {
    if (!auth) return
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser || null)
    })
    return () => unsubscribe()
  }, [auth])

  useEffect(() => {
    let cancelled = false
    async function loadBuildVersion() {
      try {
        const res = await fetch(`/build-version.json?t=${Date.now()}`, { cache: "no-store" })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled && typeof json?.version === "string" && json.version) {
          setBuildVersion(json.version)
        }
      } catch {
        // ignore
      }
    }
    void loadBuildVersion()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const onResize = () => syncValueMapHeight()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [syncValueMapHeight])

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return
    let lastRun = 0
    const MIN_INTERVAL_MS = 10_000
    const runResumeSync = () => {
      const now = Date.now()
      if (now - lastRun < MIN_INTERVAL_MS) return
      lastRun = now
      void syncOnAppResume()
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        runResumeSync()
        forceResumeReloadWithCooldown()
      }
    }
    const onFocus = () => {
      runResumeSync()
      forceResumeReloadWithCooldown()
    }
    const onPageShow = () => {
      runResumeSync()
      forceResumeReloadWithCooldown()
    }

    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onFocus)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [syncOnAppResume])


  useEffect(() => {
    if (!saveDone) return
    const timer = window.setTimeout(() => {
      setOpenInput(false)
      setInputText("")
      setSaveDone(false)
      setSaveToast("")
      setIsSaving(false)
    }, 600)
    return () => window.clearTimeout(timer)
  }, [saveDone])


  const login = async () => {
    if (!hasFirebaseConfig()) {
      window.alert("Firebase 환경변수 설정이 필요합니다 (.env.local 확인)")
      return
    }
    if (!auth) return
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
    } catch (err) {
      console.error("로그인 실패", err)
      window.alert("로그인에 실패했습니다")
    }
  }

  const logout = async () => {
    if (!auth) return
    try {
      await signOut(auth)
    } catch (err) {
      console.error("로그아웃 실패", err)
      window.alert("로그아웃에 실패했습니다")
    }
  }

  const saveMyData = async () => {
    if (!user) {
      window.alert("로그인 후 저장할 수 있습니다")
      return
    }
    if (!panicData) {
      window.alert("저장할 데이터가 아직 없습니다")
      return
    }
    if (!db) return
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          email: user.email ?? null,
          displayName: user.displayName ?? null,
          lastData: panicData,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
      window.alert("💾 내 데이터 저장 완료")
    } catch (err) {
      console.error("Firestore 저장 실패", err)
      window.alert("저장에 실패했습니다")
    }
  }

  return (
    <div className="flex min-h-[100dvh] min-h-screen flex-col overflow-x-hidden bg-[#0b0f1a] text-gray-200 lg:flex-row">
      <aside className="flex w-full shrink-0 flex-row gap-1 overflow-x-auto border-b border-gray-800/80 bg-[#0f172a] px-2 py-3 lg:h-[100dvh] lg:w-60 lg:flex-col lg:border-b-0 lg:border-r lg:px-2 lg:py-4">
        <div className="mb-0 shrink-0 px-2 py-1 lg:mb-4 lg:px-3">
          <p className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.2em] text-purple-400">
            Signal Flow
          </p>
        </div>
        <nav className="flex min-h-[48px] flex-1 flex-row items-stretch gap-1 lg:flex-col lg:items-stretch lg:px-2">
          {MENU.map((item) => (
            <div
              key={item.label}
              role="presentation"
              onClick={() => {
                if (item.active) {
                  navigate(item.path)
                } else {
                  alert("준비 중입니다")
                }
              }}
              className={
                item.active && location.pathname === item.path
                  ? "flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg bg-purple-600 font-medium text-white lg:min-w-0 lg:justify-start"
                  : "flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-gray-800/60 lg:min-w-0 lg:justify-start"
              }
              style={{
                fontSize: isMobile ? "14px" : "18px",
                padding: isMobile ? "10px 14px" : "14px 24px",
              }}
            >
              <span className="whitespace-nowrap">{item.label}</span>
            </div>
          ))}
        </nav>
        <div className="hidden lg:block lg:mt-auto lg:px-2 lg:pt-5">
          <button
            type="button"
            onClick={() => setOpenInput(true)}
            className="w-full rounded-lg border border-violet-500/40 bg-violet-500/20 px-2 py-2 text-xs text-violet-300 transition-colors hover:bg-violet-500/30"
          >
            🤖 AI 리포트 입력
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex min-h-[52px] shrink-0 gap-3 border-b border-gray-800/80 bg-[#0b0f1a] px-4 py-3 sm:px-6"
          style={{
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "flex-start",
            justifyContent: "space-between",
            overflowX: "hidden",
          }}
        >
          <div className="min-w-0 flex-1">
            <GlobalMarketBar isMobile={isMobile} />
          </div>
          <div className="flex items-start justify-between" style={{ marginTop: "12px", width: isMobile ? "100%" : "auto" }}>
            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: "8px",
                width: "100%",
                alignItems: isMobile ? "stretch" : "center",
                justifyContent: isMobile ? "center" : "flex-start",
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="
                  flex items-center gap-3
                  rounded-2xl
                  border border-cyan-400/20
                  bg-white/5
                  px-4 py-2
                  shadow-[0_0_20px_rgba(0,255,255,0.08)]
                  backdrop-blur-md
                  transition-all duration-300
                  hover:border-cyan-300/40
                "
                >
                  {user ? (
                    <>
                      <img
                        src={user.photoURL || "https://placehold.co/72x72/0f172a/e2e8f0?text=U"}
                        alt="사용자 프로필"
                        className="h-9 w-9 rounded-full border border-cyan-400/30 object-cover"
                      />
                      <div className="leading-tight">
                        <span className="max-w-[140px] truncate text-sm font-semibold text-white">
                          {user.displayName || user.email || "로그인 유저"}
                        </span>
                        <div className="text-[11px] text-cyan-300/70">Premium Access</div>
                      </div>
                      <button
                        type="button"
                        onClick={logout}
                        className="rounded-lg bg-red-500/10 px-2 py-1 text-xs text-red-300 transition hover:bg-red-500/20"
                      >
                        로그아웃
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={login}
                      className="flex items-center gap-2 text-sm font-medium text-cyan-100 transition hover:text-white"
                      style={{ width: isMobile ? "100%" : "auto" }}
                    >
                      <LogIn size={16} />
                      로그인
                    </button>
                  )}
                </div>
              </div>
              <PwaInstallBar isMobile={isMobile} />
              <span className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-200">
                {buildVersion}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <Routes>
            <Route path="/" element={<SignalDashboard externalData={panicData} externalOnly={manualMode || !panicInitialized} />} />
            <Route
              path="/strategy"
              element={<StrategyPage data={panicData} user={user} onSaveData={saveMyData} />}
            />
            <Route
              path="/finder"
              element={
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-200">종목 발굴</h2>
                  <BuyTop5Card />
                  <div
                    style={{
                      marginTop: "60px",
                      position: isMobile ? "relative" : "sticky",
                      top: isMobile ? "auto" : "16px",
                    }}
                  >
                    <h2
                      style={{
                        fontSize: isMobile ? "18px" : "28px",
                        marginBottom: "12px",
                        color: "#9ca3af",
                      }}
                    >
                      🗺️ 국내 주식 밸류체인 맵
                    </h2>

                    <iframe
                      ref={valueMapIframeRef}
                      src="/value-map.html"
                      title="국내 주식 밸류체인 맵"
                      onLoad={handleValueMapLoad}
                      style={{
                        width: "100%",
                        height: `${valueMapHeight}px`,
                        border: "none",
                        borderRadius: "16px",
                      }}
                    />
                  </div>
                </div>
              }
            />
          </Routes>
        </main>
      </div>
      {openInput ? (
      <div
        className="fixed right-0 top-0 z-[9999] h-full w-[300px] bg-[#111827] p-5 shadow-[-4px_0_10px_rgba(0,0,0,0.3)] transition-transform duration-300 translate-x-0"
        style={{
          width: "360px",
          background: "linear-gradient(180deg, #0f172a, #020617)",
          boxShadow: "-6px 0 20px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          pointerEvents: "auto",
        }}
      >
        <div className="mb-4 rounded-2xl border border-cyan-500/10 bg-[#0b1220] p-3">
          <h3 style={{ color: "#c4b5fd", marginBottom: "5px" }}>패닉지수 텍스트 붙여넣기</h3>
          <p style={{ fontSize: "12px", color: "#64748b" }}>표 형태 텍스트를 그대로 붙여넣으면 자동으로 수치를 추출합니다.</p>
        </div>
        <textarea
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value)
            if (inputError) setInputError("")
          }}
          placeholder={PANIC_TEXT_PLACEHOLDER}
          style={{
            flex: 1,
            background: "#020617",
            color: "#e2e8f0",
            border: "1px solid #1e293b",
            borderRadius: "10px",
            padding: "14px",
            fontFamily: "Inter, Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
            fontSize: "13px",
            lineHeight: "1.5",
            outline: "none",
            boxShadow: "inset 0 0 10px rgba(0,0,0,0.4)",
          }}
        />
        {inputError ? (
          <div className="mt-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {inputError}
          </div>
        ) : null}
        <div className="mt-3 rounded-2xl border border-cyan-500/10 bg-[#0b1220] p-3 text-xs text-gray-300">
          <p className="mb-2 text-cyan-200">자동 분석 미리보기: {previewTone}</p>
          <div className="space-y-1">
            {METRIC_DEFS.map(({ key, label }) => (
              <div key={key}>
                {label}: {parsedData[key] ?? "-"}
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1 text-[11px]">
            {METRIC_DEFS.map(({ key, label }) => (
              <p key={`debug-${key}`}>
                {parsedData[key] !== null ? `✅ ${label}: ${parsedData[key]}` : `❌ ${label} not found`}
              </p>
            ))}
          </div>
          {missingFields.length > 0 ? (
            <div className="mt-2 space-y-1 text-amber-300">
              {missingFields.map((name) => (
                <p key={name}>⚠️ {name} 값을 찾지 못했습니다</p>
              ))}
            </div>
          ) : null}
        </div>
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
              pointerEvents: "auto",
            }}
            className="cursor-pointer pointer-events-auto"
          >
            저장
          </button>
          {manualMode ? (
            <button
              type="button"
              onClick={() => {
                void releaseManualMode()
                setSaveToast("✅ 자동 데이터 모드로 전환")
              }}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "8px",
                background: "#0f172a",
                color: "#93c5fd",
                border: "1px solid #1d4ed8",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              자동 데이터 다시 사용
            </button>
          ) : null}
        </div>
      </div>
      ) : null}
      {saveToast ? (
        <div className="fixed bottom-6 left-1/2 z-[10000] -translate-x-1/2 rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-200 shadow-lg">
          {saveToast}
        </div>
      ) : null}
    </div>
  )
}

export default App
