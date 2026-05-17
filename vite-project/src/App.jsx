import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { ChevronDown, LogIn } from "lucide-react"
import { Navigate, NavLink, Route, Routes } from "react-router-dom"
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth"
import { doc, serverTimestamp, setDoc } from "firebase/firestore"
import { isPanicHubEnabled, submitManualPanicData } from "./config/api.js"
import { appendPanicIndexHistory } from "./utils/panicIndexHistory.js"
import { CYCLE_HISTORY_MAX } from "./utils/cycleHistoryUtils.js"
import { calendarKeyFromPanic } from "./utils/cycleHistoryHygiene.js"
import { LIVE_JSON_GET_INIT, withNoStoreQuery } from "./config/liveDataFetch.js"
import { AUTO_DATA_ENGINE_ENABLED } from "./config/dataEngine.js"
import {
  CycleHistoryTraceBadge,
  DataFlowPipelineHint,
  PanicMetricsTraceBadge,
  RealtimeTraceBadge,
  ValueChainHeatTraceBadge,
} from "./components/DataTraceBadge.jsx"
import PanicSyncDebugPanel from "./components/PanicSyncDebugPanel.jsx"
import PwaRuntimeDebugOverlay from "./components/PwaRuntimeDebugOverlay.jsx"
import SupabaseRawDebugPanel from "./components/SupabaseRawDebugPanel.jsx"
import SectionErrorBoundary from "./components/SectionErrorBoundary.jsx"
import ValueChainPage from "./components/ValueChainPage.jsx"
import TradingLogPage from "./pages/TradingLogPage.jsx"
import DebugDataPage from "./pages/DebugDataPage.jsx"
import PanicDeskDashboard from "./components/PanicDeskDashboard.jsx"
import MobileAppHeader from "./components/layout/MobileAppHeader.jsx"
import MobileBottomNav from "./components/layout/MobileBottomNav.jsx"
import MobileDrawer from "./components/layout/MobileDrawer.jsx"
import MobileShellDebugOverlay from "./components/layout/MobileShellDebugOverlay.jsx"
import { useIsMobileLayout } from "./hooks/useIsMobileLayout.js"
import { isDevMode } from "./utils/devMode.js"
import { auth, db, hasFirebaseConfig } from "./firebase.js"
import { subscribePanicHubRealtime } from "./lib/panicHubRealtime.js"
import { useAppDataStore } from "./store/appDataStore.js"
import { usePanicStore } from "./store/panicStore.js"
import { isDataTraceUiEnabled, logRealtime } from "./utils/dataFlowTrace.js"
import { buildMarketSidebarPulse } from "./utils/macroTerminalPulse.js"
import { resolveMarketState } from "./utils/marketStateEngine.js"
import MetricInputErrorBoundary from "./components/MetricInputErrorBoundary.jsx"
import {
  coerceMetricValue,
  emptyMetricPasteResult,
  formatMetricValueForDisplay,
  parseMetricPasteText,
  safeNormalizeMetricPasteForTextarea,
} from "./utils/parseMetricPaste.js"
import { getToastChannel, toast } from "./utils/toast.js"

/* 미국장 매크로 브리핑(OvernightUsBriefing): 프로덕션 복구 동안 비활성 — 재개 시 import + /cycle 하단 섹션 추가 */

const MENU = [
  { label: "01 시장 사이클", path: "/cycle", active: true },
  { label: "02 코리아 밸류체인", path: "/value-chain", active: true },
  { label: "03 트레이딩 로그", path: "/trading-log", active: true },
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
const APP_VERSION_LABEL = String(import.meta.env.VITE_APP_VERSION_LABEL ?? "").trim()
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
  if (!AUTO_DATA_ENGINE_ENABLED) return
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

function parseTextPanicData(text) {
  try {
    return parseMetricPasteText(text, REQUIRED_KEYS)
  } catch (err) {
    console.warn("[parseTextPanicData]", err)
    return emptyMetricPasteResult(REQUIRED_KEYS)
  }
}

function readRecentMemos(limit = 80) {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem("yds-investment-memos-v1")
    const list = JSON.parse(raw || "[]")
    if (!Array.isArray(list)) return []
    return list.slice(0, limit)
  } catch {
    return []
  }
}

function getLongPositionLabel(score) {
  const n = Number(score)
  if (!Number.isFinite(n)) return "중립"
  if (n <= 15) return "패닉"
  if (n <= 30) return "공포"
  if (n <= 45) return "반등초기"
  if (n <= 60) return "중립"
  if (n <= 75) return "순환매"
  if (n <= 90) return "과열"
  return "버블"
}

function interpretMetricState(key, rawValue) {
  const v = Number(rawValue)
  if (!Number.isFinite(v)) return "데이터 대기"
  switch (key) {
    case "vix":
      if (v >= 30) return "변동성 급등 · 공포 구간"
      if (v >= 24) return "경계 구간 · 변동성 확대"
      if (v <= 16) return "안정 구간 · 리스크 온"
      return "중립 구간"
    case "fearGreed":
      if (v >= 75) return "탐욕 과열 · 조정 경계"
      if (v >= 60) return "위험 선호 우세"
      if (v <= 30) return "공포 심리 우세"
      return "중립 심리"
    case "bofa":
      if (v >= 7) return "낙관 과열 · 리스크 경계"
      if (v <= 3) return "비관 우세 · 방어 선호"
      return "중립"
    case "putCall":
      if (v >= 1.05) return "헤지 수요 증가 · 방어 우세"
      if (v <= 0.7) return "추격 심리 확대 · 과열 주의"
      return "균형 구간"
    case "highYield":
      if (v >= 5.5) return "신용 리스크 확대"
      if (v <= 4.2) return "신용 안정 · 리스크 온"
      return "보통"
    case "vxn":
      return v >= 30 ? "나스닥 변동성 확대" : "나스닥 변동성 안정"
    case "move":
      return v >= 110 ? "채권 변동성 경고" : "채권 변동성 완화"
    case "skew":
      return v >= 145 ? "꼬리위험 헤지 수요 증가" : "꼬리위험 수요 안정"
    case "gsBullBear":
      return v >= 75 ? "강한 낙관 · 과열 주의" : v <= 35 ? "비관 우세" : "중립"
    default:
      return "중립"
  }
}

function getCycleStepSequence() {
  return ["공포", "회복", "낙관", "과열", "흔들림", "패닉"]
}

function buildMemoInsightRows(memos) {
  const memoList = Array.isArray(memos) ? memos : []
  if (!memoList.length) return ["메모 누적 후 AI 인사이트가 강화됩니다."]
  const sectorCounts = {}
  let bullish = 0
  let bearish = 0
  let riskWords = 0
  for (const memo of memoList) {
    const sentiment = memo?.sentiment ?? memo?.parsed?.sentiment
    if (sentiment === "bullish") bullish += 1
    if (sentiment === "bearish") bearish += 1
    const sectors = memo?.sectorTags ?? memo?.parsed?.sectors ?? []
    for (const sector of sectors) sectorCounts[sector] = (sectorCounts[sector] ?? 0) + 1
    const text = String(memo?.rawText ?? memo?.raw ?? "")
    if (/위험|리스크|패닉|vix|과열/i.test(text)) riskWords += 1
  }
  const topSectors = Object.entries(sectorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name, n]) => `${name}(${n})`)
  const out = []
  if (topSectors.length) out.push(`최근 섹터 흐름: ${topSectors.join(" → ")}`)
  out.push(
    bullish >= bearish
      ? "bullish 표현이 우세하며 risk-on 심리가 유지되는 구간"
      : "bearish 표현이 증가하며 방어 심리 전환 가능성",
  )
  if (riskWords >= 3) out.push("위험 표현 증가: 변동성 확대 구간 경계 필요")
  return out.slice(0, 4)
}

function buildMemoFlowStats(memos) {
  const rows = Array.isArray(memos) ? memos : []
  const recent = rows.slice(0, 40)
  let bullish = 0
  let bearish = 0
  let risk = 0
  const sectorCounts = {}
  for (const memo of recent) {
    const sentiment = memo?.sentiment ?? memo?.parsed?.sentiment
    if (sentiment === "bullish") bullish += 1
    if (sentiment === "bearish") bearish += 1
    const text = String(memo?.rawText ?? memo?.raw ?? "")
    if (/위험|리스크|패닉|과열|vix/i.test(text)) risk += 1
    for (const sector of memo?.sectorTags ?? memo?.parsed?.sectors ?? []) {
      sectorCounts[sector] = (sectorCounts[sector] ?? 0) + 1
    }
  }
  const rotation = Object.entries(sectorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name]) => name)
  return { bullish, bearish, risk, rotation }
}

function buildKeywordFrequency(memos) {
  const rows = Array.isArray(memos) ? memos : []
  const recent = rows.slice(0, 60)
  const keywords = ["원전", "전력", "눌림목", "과열", "거래량증가", "반도체", "리스크경고", "VIX급등"]
  const counts = Object.fromEntries(keywords.map((k) => [k, 0]))
  for (const memo of recent) {
    const text = String(memo?.rawText ?? memo?.raw ?? "")
    const signals = memo?.parsedSignals ?? memo?.parsed?.signal ?? []
    const sectors = memo?.sectorTags ?? memo?.parsed?.sectors ?? []
    for (const k of keywords) {
      if (text.includes(k) || signals.includes(k) || sectors.includes(k)) counts[k] += 1
    }
  }
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
}

function buildSentimentTrend(memos) {
  const rows = Array.isArray(memos) ? memos : []
  const recent = rows.slice(0, 40)
  const older = rows.slice(40, 80)
  const count = (list, key) =>
    list.filter((memo) => (memo?.sentiment ?? memo?.parsed?.sentiment) === key).length
  const recentBull = count(recent, "bullish")
  const recentBear = count(recent, "bearish")
  const olderBull = count(older, "bullish")
  const olderBear = count(older, "bearish")
  return {
    bullishDelta: recentBull - olderBull,
    bearishDelta: recentBear - olderBear,
    recentBull,
    recentBear,
  }
}

function buildInsightWarnings({ flowStats, panicData, keywordTop }) {
  const warnings = []
  const rotation = Array.isArray(flowStats?.rotation) ? flowStats.rotation : []
  const riskN = Number(flowStats?.risk)
  const risk = Number.isFinite(riskN) ? riskN : 0
  const vix = Number(panicData?.vix)
  const fearGreed = Number(panicData?.fearGreed)
  const top = Array.isArray(keywordTop) ? (keywordTop[0]?.[0] ?? null) : null
  if ((Number.isFinite(vix) && vix >= 24) || risk >= 4) {
    warnings.push("주의: 위험 표현 및 변동성 경계 구간 확대")
  }
  if (Number.isFinite(fearGreed) && fearGreed >= 75) {
    warnings.push("주의: 탐욕 과열 신호 유지")
  }
  if (rotation.length >= 3 && top) {
    warnings.push(`주의: ${top} 중심 과집중 가능성 점검`)
  }
  return warnings.slice(0, 3)
}

function isRiskOffMarketState(stateKey) {
  return stateKey === "fear_dominant" || stateKey === "volatility_expansion" || stateKey === "defensive"
}

function buildInsightCards({ marketStateKey, flowStats, trend, keywordTop }) {
  const rotation = Array.isArray(flowStats?.rotation) ? flowStats.rotation : []
  const kw = Array.isArray(keywordTop) ? keywordTop : []
  const tr =
    trend && typeof trend === "object"
      ? trend
      : { bearishDelta: 0, bullishDelta: 0, recentBull: 0, recentBear: 0 }
  const cards = []
  cards.push({
    title: "오늘의 시장 흐름",
    body:
      marketStateKey === "risk_on"
        ? "위험선호 확대 · 추격보다 리스크 관리 우선"
        : isRiskOffMarketState(marketStateKey)
          ? "리스크 오프 가능성 확대 · 방어 비중 점검"
          : "중립~탐욕 사이클 · 선별 대응 구간",
    confidence: 0.74,
    tone: "중립",
    chips: rotation.slice(0, 3),
  })
  cards.push({
    title: "순환매 흐름 변화",
    body: rotation.length ? `${rotation.slice(0, 4).join(" → ")} 중심으로 시장 관심 이동` : "순환매 흐름 데이터 축적중",
    confidence: 0.69,
    tone: "관찰",
    chips: rotation.slice(0, 3),
  })
  cards.push({
    title: "감정 흐름",
    body:
      tr.bearishDelta > tr.bullishDelta
        ? "bearish 흐름 확대로 방어 심리 증가 가능성"
        : "bullish 흐름 유지, 다만 과열 표현 동반 여부 점검 필요",
    confidence: 0.66,
    tone: tr.bearishDelta > tr.bullishDelta ? "주의" : "완만",
    chips: kw.slice(0, 2).map(([k]) => k),
  })
  return cards
}

function buildFinderCandidates(memos, marketStateKey) {
  const rows = Array.isArray(memos) ? memos : []
  const bag = new Map()
  for (const memo of rows.slice(0, 80)) {
    const stock = memo?.parsedStocks?.[0] ?? memo?.parsed?.stock
    if (!stock) continue
    if (!bag.has(stock)) {
      bag.set(stock, {
        name: stock,
        mentions: 0,
        bullish: 0,
        bearish: 0,
        sectors: new Set(),
        signals: new Set(),
      })
    }
    const row = bag.get(stock)
    row.mentions += 1
    const sentiment = memo?.sentiment ?? memo?.parsed?.sentiment
    if (sentiment === "bullish") row.bullish += 1
    if (sentiment === "bearish") row.bearish += 1
    for (const sector of memo?.sectorTags ?? memo?.parsed?.sectors ?? []) row.sectors.add(sector)
    for (const signal of memo?.parsedSignals ?? memo?.parsed?.signal ?? []) row.signals.add(signal)
  }
  const cycleBias = isRiskOffMarketState(marketStateKey)
    ? "패닉 후 회복 후보 관찰"
    : marketStateKey === "risk_on"
      ? "추격 금지 · 눌림 대기"
      : "순환매 초기 흐름 탐색"
  return [...bag.values()]
    .map((row) => {
      const signalArr = [...row.signals]
      const hasPullback = signalArr.includes("눌림목")
      const hasVolume = signalArr.includes("거래량증가")
      const hasRotation = signalArr.includes("순환매")
      const confidence = Math.max(
        45,
        Math.min(92, 48 + row.mentions * 8 + row.bullish * 5 + (hasVolume ? 8 : 0) + (hasPullback ? 7 : 0)),
      )
      const risk =
        row.bearish > row.bullish
          ? "주의"
          : marketStateKey === "risk_on"
            ? "중간"
            : "낮음"
      const flow = hasRotation
        ? "순환매 초기 진입"
        : hasPullback && hasVolume
          ? "눌림 + 거래량 증가"
          : hasPullback
            ? "눌림목 후보"
            : hasVolume
              ? "거래량 증가 초기"
              : "관찰 후보"
      return {
        ...row,
        sectors: [...row.sectors],
        signals: signalArr,
        confidence,
        risk,
        flow,
        cycleBias,
      }
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8)
}

function App() {
  const panicData = usePanicStore((s) => s.panicData)
  const panicDataStale = usePanicStore((s) => s.panicDataStale)
  const manualMode = usePanicStore((s) => s.manualMode)
  const panicInitialized = usePanicStore((s) => s.initialized)
  const initializePanicData = usePanicStore((s) => s.initializePanicData)
  const applyServerPanicSnapshot = usePanicStore((s) => s.applyServerPanicSnapshot)
  const savePanicMetricsHub = usePanicStore((s) => s.savePanicMetricsHub)
  const startAutoRefresh = usePanicStore((s) => s.startAutoRefresh)
  const stopAutoRefresh = usePanicStore((s) => s.stopAutoRefresh)
  const syncOnAppResume = usePanicStore((s) => s.syncOnAppResume)
  const [isInputPanelOpen, setIsInputPanelOpen] = useState(false)
  const [inputText, setInputText] = useState("")
  const [user, setUser] = useState(null)
  const [saveToast, setSaveToast] = useState("")
  const [appToast, setAppToast] = useState(null)
  const [inputPanelFlash, setInputPanelFlash] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const textareaRef = useRef(null)
  const [isSaving, setIsSaving] = useState(false)
  const [inputError, setInputError] = useState("")
  const [buildVersion, setBuildVersion] = useState(
    () => APP_VERSION_LABEL || `build-${String(APP_BUILD_ID).slice(-8)}`,
  )
  const [pwaLastSyncLabel, setPwaLastSyncLabel] = useState("")
  const isMobileLayout = useIsMobileLayout()
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [hubSaveGlow, setHubSaveGlow] = useState(false)
  const cycleMetricHistory = useAppDataStore((s) => s.cycleMetricHistory)
  const cycleHistorySource = useAppDataStore((s) => s.cycleHistorySource)
  const [recentMemos, setRecentMemos] = useState(() => readRecentMemos())

  const parseResult = useMemo(() => {
    try {
      return parseTextPanicData(inputText)
    } catch (err) {
      console.warn("[App] parse memo failed", err)
      return emptyMetricPasteResult(REQUIRED_KEYS)
    }
  }, [inputText])
  const parsedData = parseResult?.data ?? emptyMetricPasteResult(REQUIRED_KEYS).data
  const missingRequired = Array.isArray(parseResult?.missingRequired) ? parseResult.missingRequired : REQUIRED_KEYS
  const missingFields = useMemo(
    () => METRIC_DEFS.filter(({ key }) => parsedData?.[key] == null).map(({ key }) => key),
    [parsedData],
  )
  const parsedFieldCount = useMemo(
    () => METRIC_DEFS.filter(({ key }) => parsedData?.[key] != null).length,
    [parsedData],
  )

  const inputReady = useMemo(() => {
    try {
      const { vix, fearGreed, bofa, putCall, highYield } = parsedData ?? {}
      return [vix, fearGreed, bofa, putCall, highYield].every((v) => coerceMetricValue(v) != null)
    } catch {
      return false
    }
  }, [parsedData])

  const resetAiReportInput = useCallback(() => {
    setInputText("")
    setInputError("")
    setPreviewKey((k) => k + 1)
    try {
      window.localStorage.removeItem(PANIC_TEXT_DRAFT_KEY)
    } catch {
      // ignore
    }
    try {
      textareaRef.current?.blur?.()
    } catch {
      // ignore
    }
  }, [])

  /** 패널을 열 때마다 빈 폼 — 이전 붙여넣기·parsed·preview·LS 드래프트 제거 */
  const openInputPanel = useCallback(() => {
    resetAiReportInput()
    setIsInputPanelOpen(true)
    requestAnimationFrame(() => {
      try {
        textareaRef.current?.focus?.()
      } catch {
        // ignore
      }
    })
  }, [resetAiReportInput])

  /** 배경·X 닫기 + blur overlay·스크롤 잠금 해제(useEffect cleanup) + iOS 키보드 dismiss */
  const closeInputPanel = useCallback(() => {
    try {
      if (typeof document !== "undefined" && document.activeElement && typeof document.activeElement.blur === "function") {
        document.activeElement.blur()
      }
    } catch {
      // ignore
    }
    try {
      textareaRef.current?.blur?.()
    } catch {
      // ignore
    }
    flushSync(() => {
      setIsInputPanelOpen(false)
    })
  }, [])

  const pulseSaveFeedback = () => {
    setInputPanelFlash(true)
    setHubSaveGlow(true)
    window.setTimeout(() => {
      setInputPanelFlash(false)
      setHubSaveGlow(false)
    }, 900)
  }

  const submitInput = async () => {
    let vix
    let vxn
    let fearGreed
    let bofa
    let move
    let skew
    let putCall
    let highYield
    let gsBullBear
    try {
      vix = coerceMetricValue(parsedData?.vix)
      vxn = coerceMetricValue(parsedData?.vxn)
      fearGreed = coerceMetricValue(parsedData?.fearGreed)
      bofa = coerceMetricValue(parsedData?.bofa)
      move = coerceMetricValue(parsedData?.move)
      skew = coerceMetricValue(parsedData?.skew)
      putCall = coerceMetricValue(parsedData?.putCall)
      highYield = coerceMetricValue(parsedData?.highYield)
      gsBullBear = coerceMetricValue(parsedData?.gsBullBear)
    } catch (err) {
      console.warn("[submitInput] coerce failed", err)
      toast.error("입력 형식을 확인해주세요")
      return
    }
    if (vix == null || fearGreed == null || bofa == null || putCall == null || highYield == null) {
      const requiredMissingLabels = missingRequired.map((key) => FIELD_LABELS[key] ?? key)
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

    setIsSaving(true)
    let usedHubSavePath = false
    let saveSucceeded = false
    try {
      if (isPanicHubEnabled() && typeof savePanicMetricsHub === "function") {
        usedHubSavePath = true
        const result = await savePanicMetricsHub(normalizedParsedData)
        if (!result?.ok) {
          const msg = result?.error instanceof Error ? result.error.message : String(result?.error ?? "저장 실패")
          setInputError(msg)
        } else {
          saveSucceeded = true
        }
      } else {
        try {
          const serverData = await submitManualPanicData(normalizedParsedData)
          applyServerPanicSnapshot(serverData)
          saveSucceeded = true
        } catch (err) {
          console.error("패닉지수 서버 저장 실패", err)
          setInputError(err instanceof Error ? err.message : "저장에 실패했습니다")
        }
      }

      if (saveSucceeded) {
        const savedAt = new Date().toISOString()
        appendPanicIndexHistory({ ...normalizedParsedData, updatedAt: savedAt })
        console.log("SAVE_SUCCESS", { hub: usedHubSavePath })
        resetAiReportInput()
        pulseSaveFeedback()
        setSaveToast("Market metrics updated")

        if (db) {
          void (async () => {
            try {
              const reportId = String(Date.now())
              await setDoc(doc(db, "panic_reports", reportId), {
                ...normalizedParsedData,
                source: usedHubSavePath ? "panic_hub" : "ai_report",
                createdAt: serverTimestamp(),
              })
            } catch (fireErr) {
              console.error("panic_reports 저장 실패", fireErr)
            }
          })()
        }

        closeInputPanel()
        console.log("PANEL_CLOSED")

        void usePanicStore
          .getState()
          .fetchPanicData(usedHubSavePath ? "hub-post-save" : "manual-api-post-save", { force: true })
          .then(() => {
            if (import.meta.env.DEV) {
              try {
                const live = usePanicStore.getState().panicData
                console.table([
                  { stage: "submitted", ...normalizedParsedData },
                  {
                    stage: "after_refetch",
                    vix: live?.vix,
                    vxn: live?.vxn,
                    move: live?.move,
                    skew: live?.skew,
                    gsBullBear: live?.gsBullBear,
                    highYield: live?.highYield,
                    fearGreed: live?.fearGreed,
                    bofa: live?.bofa,
                    putCall: live?.putCall,
                  },
                ])
              } catch {
                // ignore
              }
            }
          })
          .catch((e) => {
            console.warn("[panic] post-save refresh", e)
          })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    useAppDataStore.getState().purgeLegacyCycleStorage()
  }, [])

  useEffect(() => {
    if (!panicData) return
    appendPanicIndexHistory(panicData)
    useAppDataStore.getState().syncCycleHistoryFromPanic(panicData)
  }, [panicData])

  useEffect(() => {
    void useAppDataStore.getState().loadCycleHistoryBundle({ limit: CYCLE_HISTORY_MAX })
  }, [])

  useEffect(() => {
    void useAppDataStore.getState().fetchSectorHeat()
  }, [])

  useEffect(() => {
    if (!isPanicHubEnabled()) return undefined
    const unsub = subscribePanicHubRealtime({
      onChange: (evt) => {
        const table = evt?.table ?? "panic_metrics"
        logRealtime("postgres_change", { table })
        useAppDataStore.getState().markRealtimeEvent()
        void usePanicStore.getState().fetchPanicData("supabase-realtime", { force: true })
        if (table === "panic_index_history") {
          void useAppDataStore.getState().loadCycleHistoryBundle()
        }
      },
    })
    return () => {
      try {
        unsub()
      } catch {
        // ignore
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const refreshMemos = () => {
      const next = readRecentMemos()
      setRecentMemos(Array.isArray(next) ? next : [])
    }
    refreshMemos()
    window.addEventListener("yds:memo-saved", refreshMemos)
    window.addEventListener("storage", refreshMemos)
    return () => {
      window.removeEventListener("yds:memo-saved", refreshMemos)
      window.removeEventListener("storage", refreshMemos)
    }
  }, [])

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
    try {
      const raw = sessionStorage.getItem("yds-pwa-last-check-at")
      const n = Number(raw)
      if (Number.isFinite(n)) {
        setPwaLastSyncLabel(
          new Date(n).toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }),
        )
      }
    } catch {
      // ignore
    }
    const onSync = (e) => {
      const at = e?.detail?.at
      if (at != null && Number.isFinite(Number(at))) {
        const n = Number(at)
        setPwaLastSyncLabel(
          new Date(n).toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }),
        )
      }
      if (typeof e?.detail?.version === "string" && e.detail.version.trim()) {
        setBuildVersion(e.detail.version.trim())
      }
    }
    window.addEventListener("yds:build-version-synced", onSync)
    return () => window.removeEventListener("yds:build-version-synced", onSync)
  }, [])

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
        const res = await fetch(withNoStoreQuery("/build-version.json"), LIVE_JSON_GET_INIT)
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
        if (!manualMode) forceResumeReloadWithCooldown()
      }
    }
    const onFocus = () => {
      runResumeSync()
      if (!manualMode) forceResumeReloadWithCooldown()
    }
    const onPageShow = () => {
      runResumeSync()
      if (!manualMode) forceResumeReloadWithCooldown()
    }

    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onFocus)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [syncOnAppResume, manualMode])


  useEffect(() => {
    if (!saveToast) return
    const timer = window.setTimeout(() => setSaveToast(""), 4200)
    return () => window.clearTimeout(timer)
  }, [saveToast])

  useEffect(() => {
    if (typeof window === "undefined") return undefined
    const channel = getToastChannel()
    const onToast = (event) => {
      const detail = event?.detail
      if (!detail?.message) return
      setAppToast({ type: detail.type ?? "info", message: String(detail.message) })
    }
    window.addEventListener(channel, onToast)
    return () => window.removeEventListener(channel, onToast)
  }, [])

  useEffect(() => {
    if (!appToast?.message) return undefined
    const timer = window.setTimeout(() => setAppToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [appToast])

  useEffect(() => {
    if (typeof document === "undefined") return undefined
    if (!isInputPanelOpen) {
      document.body.style.overflow = ""
      return undefined
    }
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [isInputPanelOpen])


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
  const marketState = useMemo(() => resolveMarketState(panicData), [panicData])
  const marketCycleStage = marketState.label
  const safeRecentMemos = Array.isArray(recentMemos) ? recentMemos : []
  const sidebarPulse = useMemo(() => buildMarketSidebarPulse(panicData, marketCycleStage), [panicData, marketCycleStage])
  const insightRows = useMemo(() => buildMemoInsightRows(safeRecentMemos), [recentMemos])
  const flowStats = useMemo(() => buildMemoFlowStats(safeRecentMemos), [recentMemos])
  const cycleSteps = useMemo(() => getCycleStepSequence(), [])
  const keywordTop = useMemo(() => buildKeywordFrequency(safeRecentMemos), [recentMemos])
  const sentimentTrend = useMemo(() => buildSentimentTrend(safeRecentMemos), [recentMemos])
  const insightWarnings = useMemo(
    () => buildInsightWarnings({ flowStats, panicData, keywordTop }),
    [flowStats, panicData, keywordTop],
  )
  const insightCards = useMemo(
    () => buildInsightCards({ marketStateKey: marketState.stateKey, flowStats, trend: sentimentTrend, keywordTop }),
    [marketState.stateKey, flowStats, sentimentTrend, keywordTop],
  )
  const finderCandidates = useMemo(
    () => buildFinderCandidates(safeRecentMemos, marketState.stateKey),
    [recentMemos, marketState.stateKey],
  )
  const metricCards = useMemo(
    () =>
      METRIC_DEFS.map(({ key, label }) => ({
        key,
        label,
        value: panicData?.[key] ?? "-",
        state: interpretMetricState(key, panicData?.[key]),
      })),
    [panicData],
  )
  const tacticalView = useMemo(() => {
    const vix = Number(panicData?.vix)
    const vxn = Number(panicData?.vxn)
    const putCall = Number(panicData?.putCall)
    const state =
      (Number.isFinite(vix) && vix >= 24) || (Number.isFinite(vxn) && vxn >= 30)
        ? "단기 변동성 확대"
        : "단기 공포 완화"
    const action =
      (Number.isFinite(vix) && vix >= 24) || (Number.isFinite(putCall) && putCall >= 1.05)
        ? "변동성 주의 · 추격 금지"
        : "선별 눌림 매수 가능"
    return { state, action, metrics: [{ k: "VIX", v: panicData?.vix }, { k: "VXN", v: panicData?.vxn }, { k: "Put/Call", v: panicData?.putCall }] }
  }, [panicData])
  const strategicView = useMemo(() => {
    const fg = Number(panicData?.fearGreed)
    const move = Number(panicData?.move)
    const bofa = Number(panicData?.bofa)
    const state =
      Number.isFinite(fg) && fg >= 75
        ? "탐욕 단계 진입"
        : Number.isFinite(fg) && fg <= 35
          ? "공포 우세 구간"
          : "중립~탐욕 구간"
    const action =
      Number.isFinite(fg) && fg >= 75
        ? "주식 60~70% · 일부 현금화 고려"
        : Number.isFinite(fg) && fg <= 35
          ? "분할 진입 · 현금 탄력 운용"
          : "선택적 risk-on 가능"
    return { state, action, metrics: [{ k: "Fear&Greed", v: panicData?.fearGreed }, { k: "MOVE", v: panicData?.move }, { k: "BofA B/B", v: panicData?.bofa }], move, bofa }
  }, [panicData])
  const macroView = useMemo(() => {
    const skew = Number(panicData?.skew)
    const hy = Number(panicData?.highYield)
    const gs = Number(panicData?.gsBullBear)
    const highRisk =
      (Number.isFinite(skew) && skew >= 145) || (Number.isFinite(hy) && hy >= 5.5) || (Number.isFinite(gs) && gs >= 75)
    const state = highRisk ? "구조적 리스크 경계" : "시스템 리스크 낮음"
    const action = highRisk ? "방어 비중 확대 필요" : "장기 과열 경고 없음"
    return { state, action, metrics: [{ k: "SKEW", v: panicData?.skew }, { k: "하이일드", v: panicData?.highYield }, { k: "GS B/B", v: panicData?.gsBullBear }] }
  }, [panicData])
  const heroSummary = useMemo(
    () => ({
      stage: marketCycleStage,
      mid: strategicView.action,
      short: tacticalView.action,
      long: macroView.state,
    }),
    [marketCycleStage, strategicView.action, tacticalView.action, macroView.state],
  )
  const cycleDeskMeta = useMemo(() => {
    const rows = cycleMetricHistory ?? []
    const panicDay =
      panicData?.updatedAt && !Number.isNaN(new Date(panicData.updatedAt).getTime())
        ? calendarKeyFromPanic(panicData)
        : null
    const last = rows[rows.length - 1]
    const asOfDateLabel = panicDay ?? (last?.ts ? String(last.ts).slice(0, 10) : "—")

    let feedKind = "confirmed"
    let feedLabel = "확정"
    let sourceLine = "데이터 기준 · 확정 종가"

    if (panicData && (panicData.isStale === true || panicData.__isStale === true)) {
      feedKind = "delayed"
      feedLabel = "지연"
      sourceLine = "데이터 기준 · 스냅샷 지연"
    } else if (panicData?.updatedAt) {
      const t = new Date(panicData.updatedAt).getTime()
      if (Number.isFinite(t)) {
        const ageMin = (Date.now() - t) / 60000
        if (ageMin < 4) {
          feedKind = "live"
          feedLabel = "실시간"
          sourceLine = "데이터 기준 · 실시간 갱신"
        } else if (ageMin > 36 * 60) {
          feedKind = "delayed"
          feedLabel = "지연"
          sourceLine = "데이터 기준 · 파일 지연"
        }
      }
    }

    let updatedLine = "업데이트 —"
    if (panicData?.updatedAt) {
      const d = new Date(panicData.updatedAt)
      if (!Number.isNaN(d.getTime())) {
        const hh = d.toLocaleString("ko-KR", {
          timeZone: "Asia/Seoul",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
        updatedLine = `업데이트 ${hh} (KST)`
      }
    }

    const historySourceLine =
      cycleHistorySource && cycleHistorySource !== "none"
        ? `히스토리 · ${cycleHistorySource}`
        : rows.length
          ? "히스토리 · local"
          : "히스토리 · 실제 데이터 없음"

    return { asOfDateLabel, updatedLine, sourceLine, feedKind, feedLabel, historySourceLine }
  }, [cycleMetricHistory, panicData, cycleHistorySource])
  return (
    <div
      className={[
        "flex min-h-[100dvh] min-h-svh flex-col overflow-x-hidden bg-[#0B0E14] text-slate-200 antialiased transition-shadow duration-700 lg:flex-row",
        hubSaveGlow && !isMobileLayout ? "shadow-[inset_0_0_40px_rgba(34,211,238,0.05)]" : "",
      ].join(" ")}
    >
      <aside className="hidden w-[10rem] shrink-0 flex-col overflow-y-auto border-r border-white/[0.06] bg-[#0B0E14] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] lg:flex lg:h-[100dvh]">
        <div className="shrink-0 px-2 pb-2 pt-2.5 lg:border-b lg:border-white/[0.06] lg:px-2.5 lg:pb-2.5 lg:pt-3">
          <p className="m-0 font-display text-base font-semibold leading-none tracking-tight text-slate-50">Y&apos;ds</p>
          <p className="m-0 mt-1 text-trading-2xs font-medium tracking-[0.12em] text-slate-500">매크로 터미널</p>
        </div>
        <nav className="flex flex-col gap-0.5 px-2 py-2" aria-label="주요 메뉴">
          {MENU.map((item, i) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                [
                  "flex w-full items-center gap-1.5 rounded-card border px-2 py-1.5 text-[11px] transition",
                  isActive
                    ? "border-indigo-500/30 bg-indigo-500/[0.14] text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                    : "border-transparent text-slate-400 hover:border-white/[0.06] hover:bg-white/[0.03] hover:text-slate-200",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`font-mono text-trading-2xs tabular-nums ${isActive ? "text-indigo-300/95" : "text-slate-600"}`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 truncate font-medium leading-tight tracking-tight">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto hidden lg:block lg:border-t lg:border-white/[0.06] lg:px-2 lg:pb-3 lg:pt-2.5">
          <p className="m-0 text-trading-2xs font-semibold tracking-[0.1em] text-slate-500">시장 상태</p>
          <dl className="m-0 mt-2 space-y-1.5 text-trading-xs leading-snug">
            <div className="flex justify-between gap-2 border-b border-white/[0.04] pb-2">
              <dt className="shrink-0 text-slate-500">위험 선호</dt>
              <dd
                className={
                  sidebarPulse.riskAppetite === "ON"
                    ? "text-right font-medium text-emerald-300/95"
                    : sidebarPulse.riskAppetite === "OFF"
                      ? "text-right font-medium text-rose-300/90"
                      : "text-right text-amber-200/85"
                }
              >
                {sidebarPulse.riskAppetite === "ON"
                  ? "선호 우위"
                  : sidebarPulse.riskAppetite === "OFF"
                    ? "회피 우위"
                    : sidebarPulse.riskAppetite}
              </dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-white/[0.04] pb-2">
              <dt className="shrink-0 text-slate-500">시장 분위기</dt>
              <dd className="text-right text-slate-200">{sidebarPulse.marketMood}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-white/[0.04] pb-2">
              <dt className="shrink-0 text-slate-500">주도 섹터</dt>
              <dd className="max-w-[9rem] truncate text-right text-slate-200">{sidebarPulse.leadingSector}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-white/[0.04] pb-2">
              <dt className="shrink-0 text-slate-500">변동성</dt>
              <dd className="text-right text-slate-200">{sidebarPulse.volatility}</dd>
            </div>
            <div className="flex justify-between gap-2 pt-0.5">
              <dt className="shrink-0 text-slate-500">시장 사이클</dt>
              <dd className="text-right text-indigo-200/90">{sidebarPulse.cycleStage}</dd>
            </div>
          </dl>
          {sidebarPulse.updateTimestampLine ? (
            <p className="m-0 mt-2 text-[9px] leading-relaxed text-slate-500">{sidebarPulse.updateTimestampLine}</p>
          ) : null}
          {sidebarPulse.basisLine ? (
            <p className="m-0 mt-0.5 text-[9px] leading-relaxed text-slate-500">{sidebarPulse.basisLine}</p>
          ) : null}
          <p className="m-0 mt-3 font-mono text-[9px] leading-relaxed text-slate-600">
            VIX {Number.isFinite(Number(panicData?.vix)) ? Number(panicData.vix).toFixed(2) : "—"} · F&amp;G{" "}
            {Number.isFinite(Number(panicData?.fearGreed)) ? Math.round(Number(panicData.fearGreed)) : "—"}
          </p>
          <button
            type="button"
            onClick={openInputPanel}
            className="mt-3 w-full rounded-lg border border-violet-500/25 bg-violet-500/[0.08] px-2 py-2 text-[11px] font-medium text-violet-200/95 transition hover:border-violet-400/35 hover:bg-violet-500/[0.14]"
          >
            AI 리포트 입력
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileAppHeader
          onMenuOpen={() => setMobileDrawerOpen(true)}
          user={user}
          onLogin={login}
          onLogout={logout}
        />
        <header className="hidden min-h-[44px] shrink-0 flex-wrap items-center justify-end gap-1.5 border-b border-white/[0.06] bg-[#0B0E14]/95 px-3 py-2 backdrop-blur-sm sm:px-4 lg:flex lg:pt-[calc(0.5rem+env(safe-area-inset-top))]">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-card border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 transition hover:border-white/[0.12]">
                  {user ? (
                    <>
                      <img
                        src={user.photoURL || "https://placehold.co/72x72/0f172a/e2e8f0?text=U"}
                        alt="사용자 프로필"
                        className="h-8 w-8 rounded-full border border-white/15 object-cover"
                      />
                      <div className="leading-tight">
                        <span className="max-w-[120px] truncate text-trading-sm font-semibold text-white">
                          {user.displayName || user.email || "로그인 유저"}
                        </span>
                        <div className="text-trading-2xs text-slate-500">Premium access</div>
                      </div>
                      <button
                        type="button"
                        onClick={logout}
                        className="rounded-md bg-red-500/10 px-1.5 py-0.5 text-trading-xs text-red-300 transition hover:bg-red-500/20"
                      >
                        로그아웃
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={login}
                      className="flex items-center gap-1.5 text-trading-sm font-medium text-slate-200 transition hover:text-white"
                      style={{ width: "auto" }}
                    >
                      <LogIn size={16} />
                      로그인
                    </button>
                  )}
                </div>
              </div>
              {isDevMode() ? (
                <span
                  className="flex max-w-[min(42vw,14rem)] flex-col items-end gap-0.5 rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 font-mono text-trading-2xs text-slate-400"
                  title={`id ${APP_BUILD_ID}`}
                >
                  <span className="truncate text-slate-300">{buildVersion}</span>
                  <span className="text-[9px] font-normal leading-tight text-slate-500">
                    {pwaLastSyncLabel ? `sync ${pwaLastSyncLabel}` : "sync …"}
                  </span>
                </span>
              ) : null}
          </div>
        </header>

        {isDevMode() && isDataTraceUiEnabled() ? (
          <div className="flex flex-wrap items-start gap-2 border-b border-amber-500/20 bg-[#070a0f]/95 px-3 py-2">
            <DataFlowPipelineHint />
            <PanicMetricsTraceBadge />
            <CycleHistoryTraceBadge />
            <ValueChainHeatTraceBadge />
            <RealtimeTraceBadge />
          </div>
        ) : null}

        <main className="flex-1 overflow-y-auto overscroll-y-contain px-2.5 py-2 pb-[calc(3.75rem+env(safe-area-inset-bottom))] sm:px-4 lg:px-6 lg:py-5 lg:pb-5">
          <Routes>
            <Route path="/" element={<Navigate to="/cycle" replace />} />
            <Route
              path="/cycle"
              element={
                <div id="desk" className="min-w-0">
                  <SectionErrorBoundary label="패닉 데스크">
                    <PanicDeskDashboard
                      panicData={panicData}
                      cycleMetricHistory={cycleMetricHistory}
                      isStale={panicDataStale}
                      asOfDateLabel={cycleDeskMeta.asOfDateLabel}
                      tacticalView={tacticalView}
                      strategicView={strategicView}
                      macroView={macroView}
                      marketState={marketState}
                    />
                  </SectionErrorBoundary>
                </div>
              }
            />
            <Route
              path="/value-chain"
              element={
                <SectionErrorBoundary label="코리아 밸류체인">
                  <ValueChainPage
                    panicData={panicData}
                    marketCycleStage={marketCycleStage}
                    finderCandidates={finderCandidates}
                    insightWarnings={insightWarnings}
                  />
                </SectionErrorBoundary>
              }
            />
            <Route path="/timing" element={<Navigate to="/value-chain#stock-signals" replace />} />
            <Route
              path="/trading-log"
              element={
                <SectionErrorBoundary label="트레이딩 로그">
                  <TradingLogPage />
                </SectionErrorBoundary>
              }
            />
            <Route path="/insights" element={<Navigate to="/value-chain" replace />} />
            <Route
              path="/debug-data"
              element={
                <SectionErrorBoundary label="Supabase 디버그">
                  <DebugDataPage />
                </SectionErrorBoundary>
              }
            />
            <Route path="*" element={<Navigate to="/cycle" replace />} />
          </Routes>
        </main>
      </div>
      {isInputPanelOpen ? (
        <>
          <button
            type="button"
            aria-label="입력 패널 배경 닫기"
            className="fixed inset-0 z-[9998] bg-slate-950/55 backdrop-blur-[2px] transition-opacity"
            onClick={closeInputPanel}
          />
          <MetricInputErrorBoundary>
          <div
            className={`fixed top-0 right-[env(safe-area-inset-right)] z-[9999] flex h-[100dvh] min-h-0 w-[min(100vw,22rem)] sm:w-[24rem] flex-col overflow-hidden border-l border-white/[0.08] bg-[#070a10]/92 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-3 pr-3 shadow-[-12px_0_40px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-[box-shadow,ring-color] duration-500 sm:pl-4 sm:pr-4 ${
              inputPanelFlash ? "ring-2 ring-emerald-400/50 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.2),-16px_0_56px_rgba(16,185,129,0.12)]" : ""
            }`}
            style={{
              background: "linear-gradient(165deg, rgba(15,23,42,0.94) 0%, rgba(2,6,23,0.97) 45%, rgba(2,6,23,0.99) 100%)",
              boxShadow: "inset 1px 0 0 rgba(139,92,246,0.12), -16px 0 48px rgba(0,0,0,0.5)",
            }}
          >
            <header className="mb-2 flex shrink-0 items-start justify-between gap-2 border-b border-white/[0.06] pb-2">
              <div className="min-w-0">
                <h3 className="m-0 text-[15px] font-semibold tracking-tight text-slate-50">시장 지표 입력</h3>
                <p className="m-0 mt-1 text-[11px] leading-snug text-slate-500">
                  표(CSV) 또는 기사 한 줄 붙여넣기 — 지표명·숫자만 자동 추출합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={closeInputPanel}
                aria-label="입력 창 닫기"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-slate-400 transition hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-slate-100"
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  ×
                </span>
              </button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col">
              <textarea
                ref={textareaRef}
                value={inputText}
                onPaste={(e) => {
                  try {
                    const pasted = e.clipboardData?.getData?.("text/plain") ?? ""
                    if (!pasted.trim()) return
                    const { ok, text: normalized } = safeNormalizeMetricPasteForTextarea(pasted)
                    if (!ok) {
                      toast.error("입력 형식을 확인해주세요")
                      return
                    }
                    if (normalized === pasted) return
                    e.preventDefault()
                    const el = textareaRef.current
                    const start = Number(el?.selectionStart ?? inputText.length)
                    const end = Number(el?.selectionEnd ?? inputText.length)
                    const next = `${inputText.slice(0, start)}${normalized}${inputText.slice(end)}`
                    setInputText(next)
                    if (inputError) setInputError("")
                    requestAnimationFrame(() => {
                      try {
                        if (!el) return
                        const pos = start + String(normalized).length
                        el.selectionStart = pos
                        el.selectionEnd = pos
                      } catch {
                        // ignore
                      }
                    })
                  } catch (err) {
                    console.warn("[onPaste]", err)
                    toast.error("입력 형식을 확인해주세요")
                  }
                }}
                onChange={(e) => {
                  setInputText(e.target.value)
                  if (inputError) setInputError("")
                }}
                placeholder={PANIC_TEXT_PLACEHOLDER}
                className="min-h-[10rem] w-full flex-1 resize-none rounded-lg border border-white/[0.08] bg-slate-950/80 px-3 py-2.5 font-mono text-[12px] leading-relaxed text-slate-200 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.35),inset_0_1px_12px_rgba(0,0,0,0.25)] outline-none ring-violet-500/0 transition placeholder:text-slate-600 focus:border-violet-500/35 focus:shadow-[inset_0_0_20px_rgba(124,58,237,0.06),0_0_0_1px_rgba(167,139,250,0.2)] focus:ring-1 focus:ring-violet-500/30"
                spellCheck={false}
              />
            </div>

            <div className="mt-1.5 flex shrink-0 items-center justify-between gap-2 font-mono text-[10px] text-slate-500">
              <span className="tabular-nums">
                {inputText.trim()
                  ? `필드 ${parsedFieldCount}/${METRIC_DEFS.length}`
                  : "입력 대기"}
              </span>
              {inputText.trim() && missingRequired.length > 0 ? (
                <span className="text-amber-200/80">필수 {missingRequired.length}건 미충족</span>
              ) : inputText.trim() ? (
                <span className="text-emerald-500/75">반영 준비됨</span>
              ) : null}
            </div>

            {inputError ? (
              <div
                className="mt-2 shrink-0 border-l-2 border-rose-400/70 bg-rose-500/[0.07] py-2 pl-2.5 pr-2 text-[11px] leading-snug text-rose-100/95"
                role="alert"
              >
                {inputError}
              </div>
            ) : null}

            <details key={previewKey} className="group mt-1.5 shrink-0 rounded-md border border-white/[0.05] bg-black/20">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2 py-1 font-mono text-[10px] text-slate-500 transition hover:bg-white/[0.03] hover:text-slate-400 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-1.5">
                  <span className="tracking-wide">추출 상세</span>
                  {missingFields.length > 0 ? (
                    <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1 py-px text-[9px] text-amber-200/90">
                      {missingFields.length} 미인식
                    </span>
                  ) : inputText.trim() ? (
                    <span className="text-emerald-500/80">완료</span>
                  ) : null}
                </span>
                <ChevronDown
                  size={14}
                  className="shrink-0 text-slate-600 transition group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="border-t border-white/[0.05] px-2 py-2 font-mono text-[10px] leading-relaxed text-slate-500">
                <ul className="m-0 list-none space-y-1 p-0">
                  {METRIC_DEFS.map(({ key, label }) => {
                    const v = parsedData?.[key]
                    const display = formatMetricValueForDisplay(v)
                    const ok = display !== "—"
                    return (
                      <li key={key} className="flex justify-between gap-2 border-b border-white/[0.04] pb-1 last:border-0 last:pb-0">
                        <span className={ok ? "text-slate-400" : "text-slate-600"}>{label}</span>
                        <span className={ok ? "tabular-nums text-slate-300" : "text-amber-200/70"}>{display}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </details>

            <footer className="mt-2.5 shrink-0 border-t border-white/[0.06] pt-2.5">
              <button
                type="button"
                onClick={submitInput}
                disabled={isSaving || !inputReady}
                aria-busy={isSaving}
                className={`relative w-full overflow-hidden rounded-lg border border-violet-400/30 bg-gradient-to-b from-violet-600/95 to-violet-800/95 py-2.5 text-[13px] font-semibold text-white shadow-[0_0_20px_rgba(124,58,237,0.25)] transition hover:border-violet-300/40 hover:from-violet-500 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-45 ${
                  isSaving ? "animate-pulse" : ""
                }`}
              >
                {isSaving ? "반영 중…" : "대시보드에 반영"}
              </button>
            </footer>
          </div>
          </MetricInputErrorBoundary>
        </>
      ) : null}
      {saveToast ? (
        <div
          role="status"
          className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-[10000] max-w-[min(92vw,22rem)] -translate-x-1/2 rounded-xl border border-emerald-400/35 bg-[rgba(6,24,18,0.92)] px-4 py-2.5 text-center text-[13px] font-medium leading-snug text-emerald-100 shadow-[0_12px_40px_rgba(16,185,129,0.2),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md"
        >
          {saveToast}
        </div>
      ) : null}
      {appToast?.message ? (
        <div
          role="alert"
          className={
            appToast.type === "error"
              ? "fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 z-[10001] max-w-[min(92vw,22rem)] -translate-x-1/2 rounded-xl border border-rose-400/40 bg-[rgba(48,12,18,0.94)] px-4 py-2.5 text-center text-[13px] font-medium text-rose-100 shadow-lg backdrop-blur-md"
              : "fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 z-[10001] max-w-[min(92vw,22rem)] -translate-x-1/2 rounded-xl border border-emerald-400/35 bg-[rgba(6,24,18,0.92)] px-4 py-2.5 text-center text-[13px] font-medium text-emerald-100 shadow-lg backdrop-blur-md"
          }
        >
          {appToast.message}
        </div>
      ) : null}
      <MobileBottomNav
        onAi={openInputPanel}
        onSettings={() => setMobileDrawerOpen(true)}
      />
      <MobileDrawer
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        onOpenInput={openInputPanel}
        buildVersion={isDevMode() ? buildVersion : null}
      />
      <MobileShellDebugOverlay />
      {isDevMode() ? (
        <>
          <PanicSyncDebugPanel />
          <SupabaseRawDebugPanel />
          <PwaRuntimeDebugOverlay />
        </>
      ) : null}
    </div>
  )
}

export default App
