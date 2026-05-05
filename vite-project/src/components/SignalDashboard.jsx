import { useCallback, useEffect, useMemo, useState } from "react"
import {
  fetchPanicDataJson,
  getApiBase,
  getPanicDataUrlForDisplay,
  listPanicDataUrlAttemptsForDisplay,
} from "../config/api.js"
import { usePanicNotifications } from "../hooks/usePanicNotifications.js"
import {
  getAdvancedSignal,
  getConfidence,
  getSignal,
  getTotalSignalScore,
} from "../utils/panicMarketSignal.js"
import { getHistory, getTimingSignal, getTrend, saveHistory } from "../utils/panicScoreHistory.js"
import { validatePanicData } from "../utils/validatePanicData.js"
import BacktestPanel from "./BacktestPanel.jsx"
import SignalBacktestPanel from "./SignalBacktestPanel.jsx"
import BuyTop5Card from "./BuyTop5Card.jsx"
import CombinedSignalCard from "./CombinedSignalCard.jsx"
import PanicIndexCard from "./PanicIndexCard.jsx"
import PanicNotifyToolbar, { readNotifyOn } from "./PanicNotifyToolbar.jsx"
import SignalCard from "./SignalCard.jsx"
import StockRecommendCard from "./StockRecommendCard.jsx"
import {
  describeDynamicWeights,
  getAction,
  getFinalScore,
  getMidScore,
  getShortScore,
} from "../utils/tradingScores.js"
import { getTradingSignal } from "../utils/tradingStrategy.js"

/** 자동 새로고침 주기 (5분) */
const PANIC_REFRESH_MS = 300_000

const healthRowStyle = { marginTop: "10px", fontSize: "12px", color: "gray" }
const refreshBtnStyle = {
  marginTop: "10px",
  padding: "8px 12px",
  borderRadius: "8px",
  cursor: "pointer",
}

const summaryCardStyle = {
  padding: "20px",
  background: "#111",
  borderRadius: "12px",
  marginBottom: "20px",
  textAlign: "center",
}

/** StrictMode 이중 마운트에서도 직전 성공 응답을 바로 쓰기 위한 모듈 캐시 */
let panicDataCache = null

function clearPanicDataCache() {
  panicDataCache = null
}

export default function SignalDashboard() {
  const [data, setData] = useState(null)
  const [isPro, setIsPro] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [retryKey, setRetryKey] = useState(0)
  /** STEP 0: 클라이언트에서 마지막으로 네트워크 응답을 받은 시각 */
  const [updatedAt, setUpdatedAt] = useState(null)
  const [history, setHistory] = useState(() => getHistory())
  const [notifyEnabled, setNotifyEnabled] = useState(() =>
    typeof window !== "undefined" ? readNotifyOn() : false,
  )

  /**
   * 패닉 데이터 로드 (네트워크는 `fetchPanicDataJson` → VITE_API_BASE + `/panic-data`).
   * @param {{ silent?: boolean; useMemoryCache?: boolean; isCancelled?: () => boolean }} [opts]
   * - silent: true면 로딩 UI 없이 조용히 갱신(실패 시 기존 데이터 유지).
   * - useMemoryCache: true면 메모리 캐시가 있으면 네트워크 생략.
   */
  const fetchData = useCallback(async (opts = {}) => {
    const { silent = false, useMemoryCache = false, isCancelled } = opts

    if (useMemoryCache && panicDataCache) {
      if (!validatePanicData(panicDataCache)) {
        console.warn("[YDS] 캐시 데이터 검증 실패 — 네트워크로 다시 불러옵니다")
        panicDataCache = null
      } else {
        if (isCancelled?.()) return
        setData(panicDataCache)
        setIsPro(panicDataCache?.accessTier === "pro")
        setLoadError(null)
        setError(false)
        setLoading(false)
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
      panicDataCache = json
      setData(json)
      setIsPro(json?.accessTier === "pro")
      setLoadError(null)
      setError(false)
      setUpdatedAt(new Date().toLocaleTimeString())
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
  }, [])

  useEffect(() => {
    let cancelled = false
    const isCancelled = () => cancelled
    void fetchData({ useMemoryCache: true, silent: false, isCancelled })
    return () => {
      cancelled = true
    }
  }, [retryKey, fetchData])

  useEffect(() => {
    let cancelled = false
    const isCancelled = () => cancelled
    const id = setInterval(() => {
      void fetchData({ silent: true, useMemoryCache: false, isCancelled })
    }, PANIC_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [fetchData])

  useEffect(() => {
    if (!loading) return
    const t = window.setTimeout(() => {
      console.warn("서버 슬립 상태 가능 (Render cold start 등으로 응답이 지연될 수 있음)")
    }, 5000)
    return () => window.clearTimeout(t)
  }, [loading])

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
    return getFinalScore(data)
  }, [data])

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

  const notificationsActive =
    notifyEnabled &&
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted"

  usePanicNotifications(finalScore, notificationsActive && data != null)

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
    const isProd = import.meta.env.PROD
    const hasApiBase = Boolean(getApiBase())
    const tried = listPanicDataUrlAttemptsForDisplay()
    const triedLine = tried.length ? tried.join(" → ") : "(설정된 API URL 없음)"
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-16 text-center text-red-300">
        <p className="text-lg">❌ 서버 연결 실패 (잠시 후 다시 시도)</p>
        <p className="text-sm opacity-90">{loadError ?? "알 수 없는 오류"}</p>
        {isProd && !hasApiBase ? (
          <p className="max-w-md text-xs text-gray-400">
            인터넷에 있는 사이트는 당신 PC의 <code className="text-gray-500">localhost</code>에 연결할 수 없습니다.{" "}
            <code className="text-gray-500">server.py</code>(Flask)를 Render·Railway 등에 올리고, Vercel 프로젝트 →
            Settings → Environment Variables에 <code className="text-gray-500">VITE_API_BASE</code>를 그 API의
            https 주소(끝 슬래시 없이)로 넣은 뒤 <strong className="text-gray-300">Redeploy</strong> 하세요. (빌드 시
            값이 들어갑니다.)
          </p>
        ) : isProd && hasApiBase ? (
          <p className="max-w-md text-xs text-gray-400">
            API 서버(<code className="text-gray-500">{getApiBase()}</code>)가 켜져 있는지, 브라우저에서{" "}
            <code className="text-gray-500">{getPanicDataUrlForDisplay()}</code> 가 JSON으로 열리는지 확인하세요.
            환경 변수를 바꿨다면 Vercel에서 <strong className="text-gray-300">Redeploy</strong>가 필요합니다.
          </p>
        ) : !isProd && !hasApiBase ? (
          <div className="max-w-lg space-y-2 text-left text-xs text-gray-400">
            <p className="text-center text-gray-300">
              지금은 <strong>로컬 개발</strong> 모드이고, <code className="text-gray-500">VITE_API_BASE</code>도 없어서{" "}
              <strong className="text-gray-300">PC의 5000번 Flask</strong>만 찾고 있어요. 서버가 꺼져 있으면{" "}
              <code className="text-gray-500">Failed to fetch</code>가 납니다.
            </p>
            <ol className="list-decimal space-y-1.5 pl-5 text-gray-500">
              <li>
                <strong className="text-gray-400">방법 A</strong> — 상위 폴더{" "}
                <code className="text-gray-500">yds web</code>에서{" "}
                <code className="rounded bg-black/30 px-1 py-0.5 text-gray-400">python server.py</code> 실행 (5000
                포트). 그다음 <code className="text-gray-500">vite-project</code>에서{" "}
                <code className="rounded bg-black/30 px-1 py-0.5 text-gray-400">npm run dev</code>만 켜도 됩니다.
              </li>
              <li>
                <strong className="text-gray-400">방법 B</strong> —{" "}
                <code className="rounded bg-black/30 px-1 py-0.5 text-gray-400">npm run dev:full</code> 한 번으로 웹
                + API 같이 실행.
              </li>
              <li>
                <strong className="text-gray-400">방법 C</strong> — Flask 없이 Render만 쓰려면{" "}
                <code className="text-gray-500">vite-project/.env.local</code> 파일에{" "}
                <code className="break-all text-gray-500">VITE_API_BASE=https://(Render주소)</code> 넣고{" "}
                <strong className="text-gray-400">dev 서버를 껐다가 다시</strong> 켜세요. (
                <code className="text-gray-600">.env.example</code> 참고)
              </li>
            </ol>
          </div>
        ) : (
          <p className="max-w-md text-xs text-gray-400">
            <code className="text-gray-500">VITE_API_BASE</code>로 지정한 API가 켜져 있는지 확인하세요.{" "}
            <code className="text-gray-500">.env.local</code>을 바꿨다면 Vite 개발 서버를 재시작해야 합니다.
          </p>
        )}
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

  return (
    <div className="flex flex-col gap-6">
      <PanicNotifyToolbar notifyEnabled={notifyEnabled} setNotifyEnabled={setNotifyEnabled} />
      <div style={summaryCardStyle} className="border border-gray-800">
        <h2 className="m-0 text-base font-semibold text-gray-300">📊 현재 시장 상태</h2>
        <h1 className="m-0 mt-3 text-2xl font-bold leading-tight" style={{ color: headlineSignal.color }}>
          {headlineSignal.text}
        </h1>
        <p className="m-0 mt-3 text-sm text-gray-400">신뢰도: {headlineConfidence} / 4</p>
        <p className="m-0 mt-2 text-xs text-gray-500">
          참고 합산(MVP): {headlineReferenceTotal} — {headlineReferenceLabel.text}
        </p>
      </div>
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
      <StockRecommendCard score={finalScore} />
      <SignalBacktestPanel />
      <BacktestPanel history={history} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SignalCard
          title="단기 시그널"
          score={shortScore}
          description="수급·캔들 기반 단기 과열/지지 확인"
        />
        <SignalCard
          title="중기 시그널"
          score={midScore}
          description="이평·변동성 필터로 중기 방향성 점검"
        />
        <CombinedSignalCard
          shortScore={shortScore}
          midScore={midScore}
          description="단기·중기 가중 결합 종합 판독"
        />
      </div>
      <BuyTop5Card />
    </div>
  )
}
