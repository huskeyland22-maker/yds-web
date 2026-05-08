import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import {
  fetchPanicDataJson,
  getPanicDataUrlForDisplay,
  listPanicDataUrlAttemptsForDisplay,
} from "../config/api.js"
import { sendNotification, usePanicNotifications } from "../hooks/usePanicNotifications.js"
import {
  getAdvancedSignal,
  getConfidence,
  getSignal,
  getTotalSignalScore,
} from "../utils/panicMarketSignal.js"
import { getHistory, getTimingSignal, getTrend, saveHistory } from "../utils/panicScoreHistory.js"
import {
  buildCycleAnalysis,
  getDailyPanicHistory,
  getIntegrationHistory,
  saveDailyPanicHistory,
  saveIntegrationHistory,
  summarizeIntegrationFlow,
} from "../utils/panicIntegrationHistory.js"
import { validatePanicData } from "../utils/validatePanicData.js"
import BacktestPanel from "./BacktestPanel.jsx"
import SignalBacktestPanel from "./SignalBacktestPanel.jsx"
import BuyTop5Card from "./BuyTop5Card.jsx"
import CombinedSignalCard from "./CombinedSignalCard.jsx"
import MarketSummaryCard from "./MarketSummaryCard.jsx"
import PanicIndexCard from "./PanicIndexCard.jsx"
import PanicHistoryChartCard from "./PanicHistoryChartCard.jsx"
import PanicNotifyToolbar, { readNotifyOn } from "./PanicNotifyToolbar.jsx"
import SectorStrengthPanel from "./SectorStrengthPanel.jsx"
import SignalCard from "./SignalCard.jsx"
import StockRecommendCard from "./StockRecommendCard.jsx"
import StockRadarCard from "./StockRadarCard.jsx"
import {
  describeDynamicWeights,
  getAction,
  getFinalScore,
  getMidScore,
  getShortScore,
} from "../utils/tradingScores.js"
import { getTradingSignal } from "../utils/tradingStrategy.js"
import { buildAiMarketBrief } from "../utils/aiAnalysisEngine.js"

/** 자동 새로고침 주기 (5분) */
const PANIC_REFRESH_MS = 300_000
const PANIC_CACHE_STALE_MS = 600_000

const healthRowStyle = { marginTop: "10px", fontSize: "12px", color: "gray" }
const refreshBtnStyle = {
  marginTop: "10px",
  padding: "8px 12px",
  borderRadius: "8px",
  cursor: "pointer",
}
const topRefreshBtnStyle = {
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid #374151",
  background: "#1f2937",
  color: "#e5e7eb",
  cursor: "pointer",
}
const compactRefreshBtnStyle = {
  padding: "6px 10px",
  fontSize: "12px",
  borderRadius: "8px",
  background: "linear-gradient(135deg, #22c55e, #16a34a)",
  color: "white",
  border: "none",
  cursor: "pointer",
}

const summaryCardStyle = {
  marginTop: "20px",
  padding: "40px",
  background: "linear-gradient(135deg, #0f172a, #1e293b)",
  borderRadius: "24px",
  textAlign: "center",
  boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
  border: "1px solid rgba(255,255,255,0.05)",
}
/** StrictMode 이중 마운트에서도 직전 성공 응답을 바로 쓰기 위한 모듈 캐시 */
let panicDataCache = null

function getPhaseLabel(score) {
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

function phaseColorClass(label) {
  switch (label) {
    case "패닉":
      return "text-rose-300"
    case "반등초기":
      return "text-sky-300"
    case "순환매":
      return "text-blue-300"
    case "과열":
      return "text-amber-300"
    case "버블":
      return "text-violet-300"
    default:
      return "text-gray-300"
  }
}

function clearPanicDataCache() {
  panicDataCache = null
}

function parseUpdatedAtMs(value) {
  if (!value) return null
  const raw = String(value).trim()
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T")
  const t = Date.parse(normalized)
  return Number.isFinite(t) ? t : null
}

export default function SignalDashboard({ externalData = null, externalOnly = false }) {
  const [data, setData] = useState(null)
  const [isPro, setIsPro] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [retryKey, setRetryKey] = useState(0)
  /** STEP 0: 클라이언트에서 마지막으로 네트워크 응답을 받은 시각 */
  const [updatedAt, setUpdatedAt] = useState(null)
  const [history, setHistory] = useState(() => getHistory())
  const [integrationHistory, setIntegrationHistory] = useState(() => getIntegrationHistory())
  const [dailyPanicHistory, setDailyPanicHistory] = useState(() => getDailyPanicHistory())
  const [alertOn, setAlertOn] = useState(false)
  const [prevScore, setPrevScore] = useState(null)
  const [lastAlertType, setLastAlertType] = useState(null)
  const [lastAlertTime, setLastAlertTime] = useState(0)
  const [notifyEnabled, setNotifyEnabled] = useState(() =>
    typeof window !== "undefined" ? readNotifyOn() : false,
  )
  const notifyEdgeRef = useRef({
    vixAbove30: false,
    strongBuy: false,
    strongSell: false,
  })
  const lastIntegrationSaveKeyRef = useRef("")
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  )
  const staleMode = Boolean(data?.isStale ?? data?.__isStale)

  /**
   * 패닉 데이터 로드 (원격 API 우선, fallback seed 없음).
   * @param {{ silent?: boolean; useMemoryCache?: boolean; isCancelled?: () => boolean }} [opts]
   * - silent: true면 로딩 UI 없이 조용히 갱신(실패 시 기존 데이터 유지).
   * - useMemoryCache: true면 메모리 캐시가 있으면 네트워크 생략.
   */
  const fetchData = useCallback(async (opts = {}) => {
    const { silent = false, useMemoryCache = false, isCancelled } = opts
    if (externalOnly) {
      if (isCancelled?.()) return
      return
    }
    // 외부에서 최신 데이터(수동 입력/동기화 데이터)를 주입받은 경우
    // 대시보드 내부 자동 fetch가 값을 다시 덮어쓰지 않도록 우선순위를 고정합니다.
    if (externalData && validatePanicData(externalData)) {
      if (isCancelled?.()) return
      setData(externalData)
      setIsPro(externalData?.accessTier === "pro")
      setLoadError(null)
      setError(false)
      setUpdatedAt(externalData?.updatedAt ?? externalData?.updated_at ?? new Date().toLocaleTimeString())
      if (!silent) setLoading(false)
      return
    }

    if (useMemoryCache && panicDataCache?.data) {
      const cachedAgeMs = Date.now() - Number(panicDataCache.savedAt ?? 0)
      const sourceUpdatedAt = panicDataCache.data?.updatedAt ?? panicDataCache.data?.updated_at ?? null
      const sourceUpdatedAtMs = parseUpdatedAtMs(sourceUpdatedAt)
      const sourceStaleMs = sourceUpdatedAtMs ? Date.now() - sourceUpdatedAtMs : null
      if (cachedAgeMs > PANIC_CACHE_STALE_MS || (sourceStaleMs != null && sourceStaleMs > PANIC_CACHE_STALE_MS)) {
        console.log("[PWA] stale memory cache detected; refetch", { cachedAgeMs, sourceStaleMs })
        panicDataCache = null
      } else if (!validatePanicData(panicDataCache.data)) {
        console.warn("[YDS] 캐시 데이터 검증 실패 — 네트워크로 다시 불러옵니다")
        panicDataCache = null
      } else {
        if (isCancelled?.()) return
        setData(panicDataCache.data)
        setIsPro(panicDataCache.data?.accessTier === "pro")
        setLoadError(null)
        setError(false)
        setLoading(false)
        console.log("[BOOT] cache source", {
          cacheSource: "memory",
          isStale: Boolean(panicDataCache.data?.isStale ?? panicDataCache.data?.__isStale),
          updatedAt: panicDataCache.data?.updatedAt ?? panicDataCache.data?.updated_at ?? null,
        })
        return
      }
    }

    if (!silent) {
      if (!isCancelled?.()) {
        setLoading(true)
        setError(false)
        setLoadError(null)
      }
    }

    try {
      const json = await fetchPanicDataJson({ debugLog: !silent })
      if (isCancelled?.()) return
      if (!validatePanicData(json)) {
        throw new Error("데이터 이상 감지")
      }
      panicDataCache = { data: json, savedAt: Date.now() }
      setData(json)
      setIsPro(json?.accessTier === "pro")
      setLoadError(null)
      setError(false)
      setUpdatedAt(json?.updatedAt ?? json?.updated_at ?? new Date().toLocaleTimeString())
    } catch (err) {
      if (isCancelled?.()) return
      const message = err instanceof Error ? err.message : String(err)
      console.error("[YDS SignalDashboard] 패닉 데이터 로드 실패", err)
      if (silent) {
        console.warn("[YDS] 자동 새로고침 실패 — 이전 데이터 유지:", message)
        return
      }
      setLoadError(message)
      setData(null)
      setIsPro(false)
      setError(true)
    } finally {
      if (!silent && !isCancelled?.()) {
        setLoading(false)
      }
    }
  }, [externalData, externalOnly])

  useEffect(() => {
    if (externalOnly) {
      setLoading(false)
      return
    }
    let cancelled = false
    const isCancelled = () => cancelled
    void fetchData({ useMemoryCache: true, silent: false, isCancelled })
    return () => {
      cancelled = true
    }
  }, [retryKey, fetchData, externalOnly])

  useEffect(() => {
    if (externalOnly) return
    if (externalData && validatePanicData(externalData)) return
    let cancelled = false
    const isCancelled = () => cancelled
    const id = setInterval(() => {
      void fetchData({ silent: true, useMemoryCache: false, isCancelled })
      console.log("자동 새로고침 실행")
    }, PANIC_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [fetchData, externalData, externalOnly])

  useEffect(() => {
    if (!loading) return
    const t = window.setTimeout(() => {
      console.warn("서버 슬립 상태 가능 (Render cold start 등으로 응답이 지연될 수 있음)")
    }, 5000)
    return () => window.clearTimeout(t)
  }, [loading])

  useEffect(() => {
    if (typeof document !== "undefined") {
      console.log("현재 탭 활성 상태:", document.visibilityState)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    if (!externalData || !validatePanicData(externalData)) return
    setData(externalData)
    setIsPro(externalData?.accessTier === "pro")
    setUpdatedAt(externalData?.updatedAt ?? externalData?.updated_at ?? new Date().toLocaleTimeString())
    setLoading(false)
    setError(false)
    setLoadError(null)
  }, [externalData])

  const manualRefresh = useCallback(() => {
    clearPanicDataCache()
    setLoading(true)
    setRetryKey((k) => k + 1)
  }, [])

  useEffect(() => {
    if (!data) return
    setHistory(saveHistory(data))
  }, [data])

  const finalScore = useMemo(() => {
    if (!data) return NaN
    if (externalOnly) {
      const locked = Number(data?.manualFinalScore)
      if (Number.isFinite(locked)) return locked
    }
    return getFinalScore(data)
  }, [data, externalOnly])

  const headlineSignal = useMemo(() => {
    if (!data || !validatePanicData(data)) {
      return { text: "—", color: "gray" }
    }
    return getAdvancedSignal(data)
  }, [data])

  const headlineConfidence = useMemo(() => {
    if (!data || !validatePanicData(data)) return 0
    return getConfidence(data)
  }, [data])

  const headlineReferenceTotal = useMemo(() => {
    if (!data || !validatePanicData(data)) return 0
    return getTotalSignalScore(data)
  }, [data])

  const headlineReferenceLabel = useMemo(() => getSignal(headlineReferenceTotal), [headlineReferenceTotal])
  const aiBrief = useMemo(() => buildAiMarketBrief(data), [data])
  const integrationFlowText = summarizeIntegrationFlow(integrationHistory)
  const cycleAnalysisLines = useMemo(() => buildCycleAnalysis(dailyPanicHistory), [dailyPanicHistory])

  useEffect(() => {
    if (!aiBrief?.integration) return
    const saveKey = JSON.stringify({
      score: aiBrief.integration.sentimentScore,
      state: aiBrief.integration.currentState,
      risk: aiBrief.integration.riskLevel,
      flow: aiBrief.integration.stateFlow,
    })
    if (lastIntegrationSaveKeyRef.current === saveKey) return
    try {
      lastIntegrationSaveKeyRef.current = saveKey
      setIntegrationHistory(saveIntegrationHistory(aiBrief.integration, data))
      setDailyPanicHistory(saveDailyPanicHistory(aiBrief.integration, data))
    } catch {
      // 히스토리 저장 실패 시에도 UI 렌더는 유지
    }
  }, [aiBrief, data])

  const notificationsActive =
    notifyEnabled &&
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted"

  usePanicNotifications(finalScore, notificationsActive && data != null)

  const sendRealtimeNotification = useCallback((title, body) => {
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission === "granted") {
      sendNotification(title, body)
    }
  }, [])

  useEffect(() => {
    if (!data || !alertOn) return

    const score = Number(data?.score ?? finalScore ?? 0)
    if (!Number.isFinite(score)) return

    const now = Date.now()

    // 최초 실행 시점에는 알림 없이 기준 점수만 기록
    if (prevScore === null) {
      setPrevScore(score)
      return
    }

    // 점수 변화가 없으면 아무것도 하지 않음
    if (score === prevScore) return

    // 60초 쿨타임
    if (now - lastAlertTime < 60_000) {
      setPrevScore(score)
      return
    }

    // 과열 구간
    if (score >= 70 && lastAlertType !== "hot") {
      sendRealtimeNotification("🚀 과열", "과열 구간 진입")
      setLastAlertType("hot")
      setLastAlertTime(now)
    }
    // 공포 구간
    else if (score <= 30 && lastAlertType !== "fear") {
      sendRealtimeNotification("💀 공포", "공포 구간 진입")
      setLastAlertType("fear")
      setLastAlertTime(now)
    }
    // 급변 구간
    else if (Math.abs(score - prevScore) >= 10) {
      sendRealtimeNotification("⚠️ 급변", "10 이상 변화 발생")
      setLastAlertTime(now)
    }

    // 중립 구간 진입 시 상태 초기화
    if (score > 30 && score < 70) {
      setLastAlertType("neutral")
    }

    setPrevScore(score)
  }, [data, alertOn, finalScore, lastAlertTime, lastAlertType, prevScore, sendRealtimeNotification])

  useEffect(() => {
    if (!data) return
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission !== "granted") return

    const vix = Number(data?.vix)
    if (Number.isFinite(vix) && vix > 30) {
      if (!notifyEdgeRef.current.vixAbove30) {
        sendNotification("🚨 시장 위험", "VIX 급등 발생!")
        notifyEdgeRef.current.vixAbove30 = true
      }
    } else {
      notifyEdgeRef.current.vixAbove30 = false
    }

    const signalText = String(headlineSignal?.text ?? "")
    if (signalText.includes("강한 매수")) {
      if (!notifyEdgeRef.current.strongBuy) {
        sendNotification("🟢 매수 기회", "강한 매수 신호 발생!")
        notifyEdgeRef.current.strongBuy = true
      }
    } else {
      notifyEdgeRef.current.strongBuy = false
    }

    if (signalText.includes("강한 매도")) {
      if (!notifyEdgeRef.current.strongSell) {
        sendNotification("🔴 매도 경고", "시장 과열 상태")
        notifyEdgeRef.current.strongSell = true
      }
    } else {
      notifyEdgeRef.current.strongSell = false
    }
  }, [data, headlineSignal])

  useEffect(() => {
    if (!data) return
    console.log("[BOOT] runtime status", {
      cacheSource: panicDataCache?.data ? "memory-or-network" : "network",
      apiSource: data?.__fetchUrl ?? "unknown",
      isStale: staleMode,
      updatedAt: data?.updatedAt ?? data?.updated_at ?? null,
    })
  }, [data, staleMode])

  if (loading) {
    const displayUrl = getPanicDataUrlForDisplay()
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 rounded-2xl border border-gray-800 bg-[#111827]/40 px-6 py-16 text-center text-gray-400">
        <p className="text-lg">🚀 서버 깨우는 중... (최대 30초)</p>
        <p className="text-xs text-gray-500">API에서 데이터를 불러오는 중입니다.</p>
        {displayUrl ? (
          <p className="text-xs text-gray-500">
            <code className="break-all text-gray-500">{displayUrl}</code>
          </p>
        ) : null}
        <div style={healthRowStyle}>상태: 로딩중</div>
        <div style={healthRowStyle}>마지막 업데이트: {updatedAt ?? "-"}</div>
        <button type="button" style={refreshBtnStyle} onClick={manualRefresh}>
          🔄 새로고침
        </button>
      </div>
    )
  }

  if (error) {
    const tried = listPanicDataUrlAttemptsForDisplay()
    const triedLine = tried.length ? tried.join(" → ") : "(설정된 API URL 없음)"
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-16 text-center text-red-300">
        <p className="text-lg">❌ 서버 연결 실패 (잠시 후 다시 시도)</p>
        <p className="text-sm opacity-90">{loadError ?? "알 수 없는 오류"}</p>
        <p className="max-w-md text-xs text-gray-400">원격 패닉 데이터 API를 읽지 못했습니다. 서버 상태를 확인하세요.</p>
        <p className="text-xs text-gray-600">시도한 주소: {triedLine}</p>
        <div style={healthRowStyle}>상태: 에러</div>
        <div style={healthRowStyle}>마지막 업데이트: {updatedAt ?? "-"}</div>
        <button type="button" style={refreshBtnStyle} onClick={manualRefresh}>
          🔄 새로고침
        </button>
        <button
          type="button"
          className="min-h-[44px] rounded-lg bg-red-500/20 px-5 py-3 text-sm font-medium text-red-200 ring-1 ring-red-500/40 transition hover:bg-red-500/30 sm:min-h-0 sm:py-2"
          onClick={() => {
            clearPanicDataCache()
            setLoadError(null)
            setError(false)
            setData(null)
            setIsPro(false)
            setLoading(true)
            setRetryKey((k) => k + 1)
          }}
        >
          다시 시도
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 rounded-2xl border border-gray-800 bg-[#111827]/40 px-6 py-16 text-center text-gray-400">
        <p className="text-lg">준비 중…</p>
        <p className="text-xs text-gray-500">잠시만 기다려 주세요.</p>
        <div style={healthRowStyle}>상태: {loading ? "로딩중" : error ? "에러" : "정상"}</div>
        <div style={healthRowStyle}>마지막 업데이트: {updatedAt ?? "-"}</div>
        <button type="button" style={refreshBtnStyle} onClick={manualRefresh}>
          🔄 새로고침
        </button>
      </div>
    )
  }

  if (!validatePanicData(data)) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-950/25 px-6 py-16 text-center text-amber-100">
        <p className="text-lg font-semibold">⚠️ 데이터 이상 감지</p>
        <p className="max-w-md text-xs text-amber-200/80">
          VIX 또는 공포·탐욕 지수가 허용 범위(0~100)를 벗어났거나 숫자가 아닙니다. 잠시 후 새로고침 하세요.
        </p>
        <button type="button" style={refreshBtnStyle} onClick={manualRefresh}>
          🔄 새로고침
        </button>
      </div>
    )
  }

  const shortScore = getShortScore(data.vix, data.putCall)
  const midScore = getMidScore(data.fearGreed, data.bofa, data.highYield)
  const action = getAction(finalScore)
  const weightsDescription = describeDynamicWeights(data.vix, data.highYield)
  const tradingSignal = getTradingSignal(data)
  const trend = getTrend(history)
  const timing = getTimingSignal(finalScore, trend)
  const mobileSummaryCardStyle = {
    ...summaryCardStyle,
    padding: isMobile ? "16px" : "40px",
  }
  const riskToneClass =
    aiBrief.risk === "매우 높음" || aiBrief.risk === "높음"
      ? "text-rose-300"
      : aiBrief.risk === "주의" || aiBrief.risk === "보통"
        ? "text-amber-300"
        : "text-emerald-300"
  const feedDotClass = loadError
    ? "bg-rose-400 shadow-rose-400/50"
    : updatedAt
      ? "bg-emerald-400 shadow-emerald-400/50"
      : "bg-amber-300 shadow-amber-300/50"
  const feedLabel = loadError ? "DELAYED" : updatedAt ? "LIVE" : "SYNCING"
  const shortPhase = getPhaseLabel(shortScore)
  const midPhase = getPhaseLabel(midScore)
  const longPhase = getPhaseLabel(finalScore)
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 lg:px-6">
      {staleMode ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
          마지막 정상 데이터 사용 중 (일부 실시간 데이터 소스 지연)
        </div>
      ) : null}
      <div
        className="sticky top-0 z-20 rounded-xl border border-cyan-500/15 bg-[#060b14]/85 px-3 py-2 backdrop-blur-md sm:px-4 sm:py-2.5"
        style={{ marginBottom: isMobile ? "10px" : "16px" }}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-400/25">
              ⬢
            </div>
            <div className="min-w-0">
              <p className="m-0 truncate text-sm font-semibold tracking-wide text-slate-100">Market Pulse AI</p>
              <p className="m-0 text-[10px] uppercase tracking-[0.16em] text-cyan-300/80">Sentiment Engine</p>
            </div>
          </div>

          <div className="min-w-0">
            <p className="m-0 text-sm font-semibold text-gray-100 sm:text-[15px]">
              시장 상태: <span className="font-bold" style={{ color: aiBrief.stateColor }}>{aiBrief.state}</span>
            </p>
            <p className="m-0 mt-0.5 text-xs text-gray-300">
              위험도: <span className={`font-semibold ${riskToneClass}`}>{aiBrief.risk}</span>{" "}
              <span className="text-[11px] font-medium text-gray-400/80">
                (
                단기: <span className={phaseColorClass(shortPhase)}>{shortPhase}</span> · 중기:{" "}
                <span className={phaseColorClass(midPhase)}>{midPhase}</span> · 장기:{" "}
                <span className={phaseColorClass(longPhase)}>{longPhase}</span>
                )
              </span>
            </p>
            <p className="m-0 mt-0.5 flex items-center gap-1.5 text-[11px] tracking-wide text-cyan-300">
              <span className={`inline-block h-2 w-2 rounded-full shadow ${feedDotClass}`} />
              {feedLabel}
            </p>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <motion.button
            type="button"
            onClick={() => {
              const next = !alertOn
              setAlertOn(next)
              if (next && typeof window !== "undefined" && "Notification" in window) {
                Notification.requestPermission().then((permission) => {
                  if (permission === "granted") {
                    new Notification("🔔 알림 활성화", {
                      body: "이제 알림이 작동합니다",
                    })
                  }
                })
              }
            }}
            style={{
              padding: "6px 10px",
              borderRadius: "8px",
              background: alertOn ? "linear-gradient(135deg, #22c55e, #16a34a)" : "linear-gradient(135deg, #4b5563, #374151)",
              color: "white",
              border: "none",
              cursor: "pointer",
              fontSize: "12px",
            }}
            whileTap={{ scale: 0.95 }}
          >
            {alertOn ? "🔔 알림 ON" : "🔕 알림 OFF"}
          </motion.button>
          <motion.button
            type="button"
            onClick={manualRefresh}
            style={{ ...compactRefreshBtnStyle, fontSize: "12px" }}
            whileTap={{ scale: 0.95 }}
          >
            🔄 Sync
          </motion.button>
        </div>
      </div>
      <MarketSummaryCard brief={aiBrief} integrationFlowText={integrationFlowText} />
      <PanicHistoryChartCard history={dailyPanicHistory} analysisLines={cycleAnalysisLines} />
      <PanicIndexCard
        data={data}
        isPro={isPro}
        finalScore={finalScore}
        action={action}
        weightsDescription={weightsDescription}
        tradingSignal={tradingSignal}
        history={history}
        trend={trend}
        timing={timing}
      />
      <SectorStrengthPanel sectors={aiBrief.sectors} />
      <PanicNotifyToolbar notifyEnabled={notifyEnabled} setNotifyEnabled={setNotifyEnabled} />
      <motion.div
        className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-5"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <p className="m-0 text-2xl font-bold text-emerald-300">🔥 지금 전략: {headlineSignal.text}</p>
        <p className="m-0 mt-2 text-base text-emerald-100">👉 추천 행동: {action}</p>
      </motion.div>
      <motion.div
        style={mobileSummaryCardStyle}
        className="border border-gray-800 px-4 py-4 sm:px-5 sm:py-5"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        whileHover={{ scale: 1.05 }}
      >
        <h2 style={{ fontSize: "16px", marginBottom: "10px" }} className="m-0 font-semibold text-gray-300">
          현재 시장 상태
        </h2>
        <h1
          className="m-0 font-bold leading-tight"
          style={{
            fontSize: isMobile ? "24px" : "40px",
            fontWeight: "bold",
            letterSpacing: "-1px",
            color: headlineSignal.color,
          }}
        >
          {headlineSignal.text}
        </h1>
        <p style={{ marginTop: "10px", fontSize: "14px", color: "#9ca3af" }} className="m-0">
          신뢰도 {headlineConfidence}/4 · 자동 분석
        </p>
        <p className="m-0 mt-2 text-xs text-gray-500">
          참고 합산(MVP): {headlineReferenceTotal} — {headlineReferenceLabel.text}
        </p>
        <p className="m-0 mt-2 text-xs text-gray-500">
          단기 {shortScore} · 중기 {midScore} · 최종 {finalScore}
        </p>
      </motion.div>
      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <SignalCard
          title="단기"
          score={shortScore}
          description="수급·변동 기반 단기 상태"
        />
        <SignalCard
          title="중기"
          score={midScore}
          description="심리·신용 기반 중기 상태"
        />
        <SignalCard
          title="장기"
          score={finalScore}
          description="통합 점수 기반 장기 상태"
        />
      </div>
      <StockRadarCard brief={aiBrief} score={finalScore} />
      <BuyTop5Card />
      <StockRecommendCard score={finalScore} />
      <div
        className="rounded-lg border border-gray-800 bg-[#111827]/60 px-4 py-3 text-left"
        style={{ fontSize: "12px", color: "gray" }}
      >
        <div style={{ marginTop: 0 }}>상태: 정상</div>
        <div style={{ marginTop: "10px" }}>마지막 업데이트(클라이언트): {updatedAt ?? "-"}</div>
        {data?.updatedAt ? (
          <div style={{ marginTop: "6px" }} className="text-gray-500">
            서버 시각: <span className="font-mono text-gray-400">{String(data.updatedAt)}</span>
          </div>
        ) : null}
        <button type="button" style={refreshBtnStyle} onClick={manualRefresh}>
          🔄 새로고침
        </button>
      </div>
      <CombinedSignalCard
        shortScore={shortScore}
        midScore={midScore}
        description="단기·중기 가중 결합 종합 판독"
      />
      <SignalBacktestPanel />
      <BacktestPanel history={history} />
    </div>
  )
}
