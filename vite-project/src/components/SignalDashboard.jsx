import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import DebugPanel from "./DebugPanel.jsx"
import { emitDebugEvent } from "../utils/debugLogger.js"
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
const AUTO_DATA_ENGINE_ENABLED = false
const APP_BUILD_VERSION = String(import.meta.env.VITE_APP_BUILD_ID ?? "dev")

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

function getLastMemoMeta() {
  if (typeof window === "undefined") return { id: null, ts: null }
  try {
    const raw = window.localStorage.getItem("yds-investment-memos-v1")
    const list = JSON.parse(raw || "[]")
    const row = Array.isArray(list) && list.length ? list[0] : null
    return { id: row?.id ?? null, ts: row?.createdAt ?? null }
  } catch {
    return { id: null, ts: null }
  }
}

function readRecentMemos(limit = 40) {
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

function buildMemoBriefLines(memos, panicData) {
  if (!Array.isArray(memos) || memos.length === 0) return []
  const sectorCounts = {}
  const sentimentCounts = { bullish: 0, neutral: 0, bearish: 0 }
  let vixRiskMentions = 0
  for (const memo of memos) {
    for (const sector of memo?.sectorTags ?? memo?.parsed?.sectors ?? []) {
      sectorCounts[sector] = (sectorCounts[sector] ?? 0) + 1
    }
    const sentiment = memo?.sentiment ?? memo?.parsed?.sentiment
    if (sentiment && sentiment in sentimentCounts) sentimentCounts[sentiment] += 1
    const signalJoined = (memo?.parsedSignals ?? memo?.parsed?.signal ?? []).join(" ")
    if (/VIX급등|리스크경고|과열경고/i.test(signalJoined) || /vix|위험|패닉/i.test(memo?.rawText ?? memo?.raw ?? "")) {
      vixRiskMentions += 1
    }
  }

  const topSectors = Object.entries(sectorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name, count]) => `${name}(${count})`)
  const lines = []
  if (topSectors.length) lines.push(`최근 섹터 메모 집중: ${topSectors.join(", ")}`)
  if (sentimentCounts.bullish > sentimentCounts.bearish) lines.push("bullish 흐름 우세, 눌림목 관찰 전략 유효")
  if (sentimentCounts.bearish >= Math.max(2, sentimentCounts.bullish)) lines.push("방어 심리 확대, 리스크 온 비중 축소 필요")
  if (vixRiskMentions >= 2 || Number(panicData?.vix) >= 24) lines.push("VIX/리스크 표현 확대, 과열·변동성 경계 필요")
  return lines.slice(0, 3)
}

function buildFlowEngineSignal(memos, panicData) {
  const rows = Array.isArray(memos) ? memos : []
  const recent = rows.slice(0, 20)
  if (!recent.length) {
    return { label: "데이터 축적중", tone: "text-slate-300", reason: "메모 누적 후 흐름 엔진이 활성화됩니다." }
  }
  let bullish = 0
  let riskSignals = 0
  let volumeSignals = 0
  for (const memo of recent) {
    const sentiment = memo?.sentiment ?? memo?.parsed?.sentiment
    if (sentiment === "bullish") bullish += 1
    const signals = memo?.parsedSignals ?? memo?.parsed?.signal ?? []
    if (signals.includes("리스크경고") || signals.includes("VIX급등") || signals.includes("과열경고")) riskSignals += 1
    if (signals.includes("거래량증가")) volumeSignals += 1
  }
  const vix = Number(panicData?.vix)
  if ((Number.isFinite(vix) && vix >= 24 && riskSignals >= 2) || (riskSignals >= 4 && bullish <= 3)) {
    return { label: "리스크 오프 가능성 증가", tone: "text-rose-300", reason: "VIX/위험 메모가 누적되고 bullish 강도가 둔화되었습니다." }
  }
  if (bullish >= 8 && riskSignals <= 2 && volumeSignals >= 3) {
    return { label: "리스크 온 유지", tone: "text-emerald-300", reason: "bullish + 거래량 시그널이 동반되어 추세가 유지됩니다." }
  }
  return { label: "중립 전환 구간", tone: "text-amber-300", reason: "방향성은 유지되지만 확인 신호가 더 필요합니다." }
}

function buildMoatInsights(memos) {
  const rows = Array.isArray(memos) ? memos : []
  if (!rows.length) {
    return {
      thoughtAssetScore: 0,
      styleLine: "메모 축적 후 투자 스타일 분석이 시작됩니다.",
      recoveryLine: "복기 데이터가 쌓이면 실수 패턴 탐지가 가능합니다.",
      sectorRotation: "흐름 데이터 수집중",
    }
  }
  const recent = rows.slice(0, 60)
  let panicMentions = 0
  let defensiveBias = 0
  let earlyRotationSense = 0
  const sectorCounts = {}
  for (const memo of recent) {
    const text = String(memo?.rawText ?? memo?.raw ?? "").toLowerCase()
    const signals = memo?.parsedSignals ?? memo?.parsed?.signal ?? []
    const sentiment = memo?.sentiment ?? memo?.parsed?.sentiment
    if (/vix|패닉|공포|위험|과열/.test(text) || signals.includes("VIX급등") || signals.includes("리스크경고")) panicMentions += 1
    if (sentiment === "bearish") defensiveBias += 1
    if (signals.includes("순환매")) earlyRotationSense += 1
    for (const sector of memo?.sectorTags ?? memo?.parsed?.sectors ?? []) {
      sectorCounts[sector] = (sectorCounts[sector] ?? 0) + 1
    }
  }
  const topSectors = Object.entries(sectorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name)
  const thoughtAssetScore = Math.min(100, Math.round(recent.length * 1.2 + topSectors.length * 8 + earlyRotationSense * 1.5))
  const styleLine =
    panicMentions >= Math.max(3, Math.round(recent.length * 0.18))
      ? "VIX/리스크 민감형 성향: 변동성 구간에서 방어 전환이 빠른 편"
      : defensiveBias <= Math.round(recent.length * 0.25)
        ? "공격 유지형 성향: 추세 구간에서 risk-on 유지 확률이 높음"
        : "균형형 성향: 위험 구간과 추세 구간을 병행 관찰"
  const recoveryLine =
    defensiveBias >= Math.max(5, Math.round(recent.length * 0.35))
      ? "복기 포인트: 공포 구간에서 과도한 방어 전환 여부 점검"
      : "복기 포인트: 과열 구간에서 추격 진입 빈도 점검"
  return {
    thoughtAssetScore,
    styleLine,
    recoveryLine,
    sectorRotation: topSectors.length ? topSectors.join(" → ") : "흐름 데이터 수집중",
  }
}

function buildPanicCycleStage(data, flowLabel) {
  const vix = Number(data?.vix)
  const fearGreed = Number(data?.fearGreed)
  if (Number.isFinite(vix) && vix >= 32) return "패닉"
  if (Number.isFinite(vix) && vix >= 24) return "공포"
  if (Number.isFinite(fearGreed) && fearGreed >= 75) return "과열"
  if (flowLabel?.includes("리스크 온")) return "탐욕"
  return "중립"
}

export default function SignalDashboard({ externalData = null, externalOnly = false }) {
  const renderCountRef = useRef(0)
  const fetchCountRef = useRef(0)
  renderCountRef.current += 1
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
  const [memoCount, setMemoCount] = useState(() => {
    if (typeof window === "undefined") return 0
    try {
      const raw = window.localStorage.getItem("yds-investment-memos-v1")
      const rows = JSON.parse(raw || "[]")
      return Array.isArray(rows) ? rows.length : 0
    } catch {
      return 0
    }
  })
  const [recentMemos, setRecentMemos] = useState(() => readRecentMemos())
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
      fetchCountRef.current += 1
      emitDebugEvent("FETCH_START", {
        source: silent ? "silent-refresh" : "dashboard",
        count: fetchCountRef.current,
      })
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
      emitDebugEvent("FETCH_SUCCESS", {
        source: silent ? "silent-refresh" : "dashboard",
        updatedAt: json?.updatedAt ?? json?.updated_at ?? null,
      })
    } catch (err) {
      if (isCancelled?.()) return
      const message = err instanceof Error ? err.message : String(err)
      console.error("[YDS SignalDashboard] 패닉 데이터 로드 실패", err)
      if (silent) {
        console.warn("[YDS] 자동 새로고침 실패 — 이전 데이터 유지:", message)
        emitDebugEvent("FETCH_FAIL", { source: "silent-refresh", message }, "warn")
        return
      }
      setLoadError(message)
      setData(null)
      setIsPro(false)
      setError(true)
      emitDebugEvent("FETCH_FAIL", { source: "dashboard", message, stack: err instanceof Error ? err.stack : String(err) }, "error")
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
    if (!AUTO_DATA_ENGINE_ENABLED) {
      setLoading(false)
      setError(false)
      setLoadError(null)
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
    if (!AUTO_DATA_ENGINE_ENABLED) return
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
    const refreshMemoCount = () => {
      try {
        const raw = window.localStorage.getItem("yds-investment-memos-v1")
        const rows = JSON.parse(raw || "[]")
        setMemoCount(Array.isArray(rows) ? rows.length : 0)
        setRecentMemos(Array.isArray(rows) ? rows.slice(0, 40) : [])
      } catch {
        setMemoCount(0)
        setRecentMemos([])
      }
    }
    refreshMemoCount()
    window.addEventListener("yds:memo-saved", refreshMemoCount)
    window.addEventListener("storage", refreshMemoCount)
    return () => {
      window.removeEventListener("yds:memo-saved", refreshMemoCount)
      window.removeEventListener("storage", refreshMemoCount)
    }
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
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pb-8 lg:px-6">
        <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-[11px] text-cyan-100">
          패닉지수 기반 AI 투자 운영 시스템 · 동기화중 · SYNCING
        </div>
        <div className="rounded-2xl border border-slate-800/90 bg-[#0b1220]/90 px-4 py-4 sm:px-5">
          <p className="m-0 text-[11px] uppercase tracking-[0.14em] text-slate-400">1. 시장 상태</p>
          <p className="m-0 mt-1 text-lg font-semibold text-slate-100">데이터 동기화 중 · 중립</p>
          <p className="m-0 mt-1 text-sm text-slate-300">시장 흐름을 불러오는 동안에도 메모 기록은 즉시 가능합니다.</p>
          {displayUrl ? (
            <p className="mt-3 text-xs text-gray-500">
              <code className="break-all text-gray-500">{displayUrl}</code>
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-slate-800/90 bg-[#0b1220]/90 px-4 py-4 sm:px-5">
          <p className="m-0 text-[11px] uppercase tracking-[0.14em] text-slate-400">AI 흐름</p>
          <p className="m-0 mt-1 text-sm text-slate-200">최근 메모 기반 흐름 분석 준비중 · 첫 입력부터 바로 누적됩니다.</p>
          <div className="mt-3 h-2 animate-pulse rounded-full bg-slate-800">
            <div className="h-2 w-1/3 rounded-full bg-cyan-500/60" />
          </div>
        </div>
        <DebugPanel
          metrics={{
            buildVersion: APP_BUILD_VERSION,
            hydrated: false,
            persistLoading: true,
            renderCount: renderCountRef.current,
            fetchCount: fetchCountRef.current,
          }}
        />
      </div>
    )
  }

  if (error) {
    const tried = listPanicDataUrlAttemptsForDisplay()
    const triedLine = tried.length ? tried.join(" → ") : "(설정된 API URL 없음)"
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pb-8 lg:px-6">
        <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-[11px] text-cyan-100">
          패닉지수 기반 AI 투자 운영 시스템 · 연결 지연 · DELAYED
        </div>
        <div className="rounded-2xl border border-slate-800/90 bg-[#0b1220]/90 px-4 py-4 sm:px-5">
          <p className="m-0 text-[11px] uppercase tracking-[0.14em] text-slate-400">1. 시장 상태</p>
          <p className="m-0 mt-1 text-lg font-semibold text-slate-100">네트워크 지연 · 로컬 메모 모드</p>
          <p className="m-0 mt-1 text-sm text-slate-300">연결이 불안정해도 메모 기록과 AI 구조화는 계속 가능합니다.</p>
        </div>
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
        <DebugPanel
          metrics={{
            hydrated: true,
            persistLoading: false,
            lastDataTs: updatedAt ?? null,
            renderCount: renderCountRef.current,
            fetchCount: fetchCountRef.current,
            rerenderBurst: false,
          }}
        />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pb-8 lg:px-6">
        <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-[11px] text-cyan-100">
          패닉지수 기반 AI 투자 운영 시스템 · 로컬 학습 모드 · READY
        </div>
        <div className="rounded-2xl border border-slate-800/90 bg-[#0b1220]/90 px-4 py-4 sm:px-5">
          <p className="m-0 text-[11px] uppercase tracking-[0.14em] text-slate-400">1. 시장 상태</p>
          <p className="m-0 mt-1 text-lg font-semibold text-slate-100">시장 데이터 대기중 · 메모 기반 흐름 분석 활성화</p>
          <p className="m-0 mt-1 text-sm text-slate-300">
            {memoCount > 0
              ? "누적 메모를 기반으로 AI 흐름 분석을 먼저 제공합니다."
              : "첫 메모를 입력하면 사고 데이터 축적이 즉시 시작됩니다."}
          </p>
        </div>
        <PanicHistoryChartCard history={dailyPanicHistory} analysisLines={cycleAnalysisLines} />
        <DebugPanel
          metrics={{
            hydrated: true,
            persistLoading: false,
            lastDataTs: updatedAt ?? null,
            renderCount: renderCountRef.current,
            fetchCount: fetchCountRef.current,
            rerenderBurst: false,
          }}
        />
      </div>
    )
  }

  if (!validatePanicData(data)) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pb-8 lg:px-6">
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-950/25 px-6 py-16 text-center text-amber-100">
          <p className="text-lg font-semibold">⚠️ 데이터 이상 감지</p>
          <p className="max-w-md text-xs text-amber-200/80">
            VIX 또는 공포·탐욕 지수가 허용 범위(0~100)를 벗어났거나 숫자가 아닙니다. 잠시 후 새로고침 하세요.
          </p>
          <button type="button" style={refreshBtnStyle} onClick={manualRefresh}>
            🔄 새로고침
          </button>
        </div>
        <DebugPanel
          metrics={{
            hydrated: true,
            persistLoading: false,
            lastDataTs: updatedAt ?? null,
            renderCount: renderCountRef.current,
            fetchCount: fetchCountRef.current,
            rerenderBurst: false,
          }}
        />
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
  const lastMemoMeta = getLastMemoMeta()
  const online = typeof navigator === "undefined" ? true : navigator.onLine
  const statusBadge = !online ? "● 오프라인" : loading ? "● 동기화중" : staleMode ? "● 캐시 지연" : "● 저장됨"
  const memoBriefLines = buildMemoBriefLines(recentMemos, data)
  const flowEngine = buildFlowEngineSignal(recentMemos, data)
  const moatInsights = buildMoatInsights(recentMemos)
  const cycleStage = buildPanicCycleStage(data, flowEngine.label)
  const todayMemos = (() => {
    const today = new Date().toDateString()
    return recentMemos.filter((memo) => {
      const t = memo?.createdAt ? new Date(memo.createdAt) : null
      return t && t.toDateString() === today
    })
  })()
  const todayRiskOpportunity = (() => {
    const vix = Number(data?.vix)
    const fearGreed = Number(data?.fearGreed)
    const risk =
      (Number.isFinite(vix) && vix >= 24) || flowEngine.label.includes("리스크 오프")
        ? "오늘의 위험: 변동성 재확대 가능성"
        : "오늘의 위험: 과열 추격 진입"
    const chance =
      (Number.isFinite(fearGreed) && fearGreed <= 35) || flowEngine.label.includes("중립 전환")
        ? "오늘의 기회: 패닉 후 회복 신호 선별"
        : "오늘의 기회: 순환매 초기 섹터 눌림 구간"
    return { risk, chance }
  })()
  const dailyReviewLines = (() => {
    const sectorCounts = {}
    let riskMentions = 0
    let bullishMentions = 0
    for (const memo of todayMemos) {
      const sentiment = memo?.sentiment ?? memo?.parsed?.sentiment
      if (sentiment === "bullish") bullishMentions += 1
      const text = String(memo?.rawText ?? memo?.raw ?? "")
      const wTags = memo?.warningTags ?? memo?.parsed?.warningTags ?? []
      if (/위험|리스크|vix|과열|패닉/i.test(text) || wTags.length) riskMentions += 1
      for (const sector of memo?.sectorTags ?? memo?.parsed?.sectors ?? []) {
        sectorCounts[sector] = (sectorCounts[sector] ?? 0) + 1
      }
    }
    const topSectors = Object.entries(sectorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([name]) => name)
    return [
      topSectors.length ? `${topSectors.join("/")} 메모 증가` : "섹터 메모는 아직 적습니다",
      riskMentions >= 2 ? "위험 표현 확대 관측" : "위험 표현은 안정권",
      bullishMentions >= 2 ? "bullish 흐름 유지" : "bullish 흐름 둔화 가능성",
    ]
  })()
  const debugMetrics = {
    buildVersion: APP_BUILD_VERSION,
    saveOk: null,
    lastSaveAt: data?.manualSavedAt ?? null,
    lastSaveSource: externalOnly ? "manualSnapshot" : "network",
    pendingSave: false,
    saveLatencyMs: null,
    hydrated: !loading,
    persistLoading: loading,
    lastDataTs: data?.updatedAt ?? data?.updated_at ?? null,
    lastMemoId: lastMemoMeta.id,
    hydrationDurationMs: null,
    cacheStale: staleMode,
    renderCount: renderCountRef.current,
    fetchCount: fetchCountRef.current,
    rerenderBurst: renderCountRef.current > 25 && fetchCountRef.current < 2,
  }
  const shellCardClass = "rounded-2xl border border-slate-800/90 bg-[#0b1220]/90 px-4 py-4 sm:px-5"
  const mutedLabelClass = "text-[11px] uppercase tracking-[0.14em] text-slate-400"
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pb-8 lg:px-6">
      <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-[11px] text-cyan-100">
        패닉지수 기반 AI 투자 운영 시스템 · {statusBadge} · {feedLabel}
      </div>
      <section className={shellCardClass}>
        <p className={mutedLabelClass}>Investor Operating System</p>
        <p className="m-0 mt-1 text-sm font-semibold text-slate-100">
          시장 심리 관측 · 투자 사고 기록 · AI 흐름 해석 · 순환매 탐지 · 복기 학습을 하나로 연결합니다.
        </p>
      </section>
      <section className={shellCardClass}>
        <p className={mutedLabelClass}>Daily Loop</p>
        <p className="m-0 mt-1 text-sm text-slate-200">
          아침 시장 확인 → 장중 한 줄 메모 → AI 흐름 반영 → 장마감 복기 → 다음 판단
        </p>
        <p className="m-0 mt-2 text-xs text-cyan-300/90">
          매일 켜는 이유: 메모가 쌓일수록 내 투자 사고 패턴과 시장 심리 변화가 함께 선명해집니다.
        </p>
      </section>
      <section className={shellCardClass}>
        <p className={mutedLabelClass}>현재 우선순위</p>
        <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-300 md:grid-cols-5">
          <p className="m-0 rounded-lg border border-slate-700/80 bg-slate-900/60 px-2.5 py-2">입력 UX</p>
          <p className="m-0 rounded-lg border border-slate-700/80 bg-slate-900/60 px-2.5 py-2">저장 안정성</p>
          <p className="m-0 rounded-lg border border-slate-700/80 bg-slate-900/60 px-2.5 py-2">AI 분석 체감</p>
          <p className="m-0 rounded-lg border border-slate-700/80 bg-slate-900/60 px-2.5 py-2">메모 타임라인</p>
          <p className="m-0 rounded-lg border border-slate-700/80 bg-slate-900/60 px-2.5 py-2">흐름 브리핑</p>
        </div>
      </section>
      {staleMode ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
          마지막 정상 데이터 사용 중 (일부 실시간 데이터 소스 지연)
        </div>
      ) : null}
      <section className={shellCardClass}>
        <p className={mutedLabelClass}>1. 시장 상태</p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <p className="m-0 text-lg font-semibold text-slate-100">
              {aiBrief.state} · <span className={riskToneClass}>{aiBrief.risk}</span>
            </p>
            <p className="m-0 mt-1 text-sm text-slate-300">{aiBrief.headline}</p>
            <p className="m-0 mt-2 flex items-center gap-1.5 text-[11px] tracking-wide text-cyan-300">
              <span className={`inline-block h-2 w-2 rounded-full shadow ${feedDotClass}`} />
              {feedLabel}
            </p>
          </div>
          <button type="button" style={compactRefreshBtnStyle} onClick={manualRefresh}>
            Sync
          </button>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-300 md:grid-cols-2">
          <p className="m-0 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-2 text-rose-100">
            {todayRiskOpportunity.risk}
          </p>
          <p className="m-0 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-emerald-100">
            {todayRiskOpportunity.chance}
          </p>
        </div>
      </section>

      <section className={shellCardClass}>
        <p className={mutedLabelClass}>AI 브리핑</p>
        <p className="m-0 mt-1 text-sm font-semibold text-slate-100">{aiBrief.headline}</p>
        <div className="mt-2 space-y-1.5 text-xs text-slate-300">
          {(memoBriefLines.length ? memoBriefLines : (aiBrief.briefingLines ?? []).slice(0, 3)).map((line) => (
            <p key={line} className="m-0 rounded-lg border border-slate-700/80 bg-slate-900/60 px-2.5 py-2">
              {line}
            </p>
          ))}
        </div>
      </section>
      <section className={shellCardClass}>
        <p className={mutedLabelClass}>장마감 복기</p>
        <p className="m-0 mt-1 text-sm font-semibold text-slate-100">
          오늘 메모 {todayMemos.length}건 · 시장 흐름 요약
        </p>
        <div className="mt-2 space-y-1 text-xs text-slate-300">
          {dailyReviewLines.map((line) => (
            <p key={line} className="m-0 rounded-lg border border-slate-700/80 bg-slate-900/60 px-2.5 py-2">
              {line}
            </p>
          ))}
        </div>
      </section>

      <section className={shellCardClass}>
        <p className={mutedLabelClass}>4. 핵심 시그널</p>
        <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <SignalCard title="단기" score={shortScore} description="수급·변동 기반 단기 상태" />
          <SignalCard title="중기" score={midScore} description="심리·신용 기반 중기 상태" />
          <SignalCard title="장기" score={finalScore} description="통합 점수 기반 장기 상태" />
        </div>
        <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          지금 전략: {headlineSignal.text} · 추천 행동: {action}
        </div>
        <div className="mt-2 rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2 text-sm">
          <p className={`m-0 font-semibold ${flowEngine.tone}`}>흐름 엔진: {flowEngine.label}</p>
          <p className="m-0 mt-1 text-xs text-slate-400">{flowEngine.reason}</p>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-300 sm:grid-cols-2">
          {(aiBrief.bullets ?? []).slice(0, 4).map((line) => (
            <p key={line} className="m-0 rounded-lg border border-slate-700/80 bg-slate-900/60 px-2.5 py-2">
              {line}
            </p>
          ))}
        </div>
      </section>
      <section className={shellCardClass}>
        <p className={mutedLabelClass}>5. 차트 / 히스토리</p>
        <p className="m-0 mt-1 text-xs text-slate-400">시장 사이클: {integrationFlowText || "누적 데이터 수집중"}</p>
        <div className="mt-3">
          <PanicHistoryChartCard history={dailyPanicHistory} analysisLines={cycleAnalysisLines} />
        </div>
      </section>

      <details className="rounded-2xl border border-slate-800/80 bg-[#0b1220]/70 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-200">고급 분석 보기</summary>
        <div className="mt-3 flex flex-col gap-4">
          <section className="rounded-xl border border-slate-700/80 bg-slate-900/60 px-3 py-3">
            <p className="m-0 text-xs uppercase tracking-[0.14em] text-slate-400">사고 데이터 축적</p>
            <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-300 md:grid-cols-2">
              <p className="m-0 rounded-lg border border-slate-700/80 bg-[#0b1220] px-2.5 py-2">
                사고 자산 점수: <span className="font-semibold text-cyan-300">{moatInsights.thoughtAssetScore}</span>
              </p>
              <p className="m-0 rounded-lg border border-slate-700/80 bg-[#0b1220] px-2.5 py-2">
                패닉 사이클 단계: <span className="font-semibold text-amber-300">{cycleStage}</span>
              </p>
              <p className="m-0 rounded-lg border border-slate-700/80 bg-[#0b1220] px-2.5 py-2">
                투자 성향: {moatInsights.styleLine}
              </p>
              <p className="m-0 rounded-lg border border-slate-700/80 bg-[#0b1220] px-2.5 py-2">
                순환매 흐름: {moatInsights.sectorRotation}
              </p>
            </div>
            <p className="m-0 mt-2 text-xs text-slate-400">{moatInsights.recoveryLine}</p>
          </section>
          <MarketSummaryCard brief={aiBrief} integrationFlowText={integrationFlowText} />
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
          <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            <StockRadarCard brief={aiBrief} score={finalScore} />
            <BuyTop5Card />
            <StockRecommendCard score={finalScore} />
          </div>
          <CombinedSignalCard
            shortScore={shortScore}
            midScore={midScore}
            description="단기·중기 가중 결합 종합 판독"
          />
          <SignalBacktestPanel />
          <BacktestPanel history={history} />
        </div>
      </details>
      <DebugPanel metrics={debugMetrics} />
    </div>
  )
}
