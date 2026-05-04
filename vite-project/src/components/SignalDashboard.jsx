import { useEffect, useMemo, useState } from "react"
import {
  fetchPanicDataJson,
  getApiBase,
  getPanicDataUrlForDisplay,
  listPanicDataUrlAttemptsForDisplay,
} from "../config/api.js"
import { usePanicNotifications } from "../hooks/usePanicNotifications.js"
import { getHistory, getTimingSignal, getTrend, saveHistory } from "../utils/panicScoreHistory.js"
import BacktestPanel from "./BacktestPanel.jsx"
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

/** StrictMode 이중 마운트에서도 직전 성공 응답을 바로 쓰기 위한 모듈 캐시 */
let panicDataCache = null

function clearPanicDataCache() {
  panicDataCache = null
}

export default function SignalDashboard() {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [retryKey, setRetryKey] = useState(0)
  const [history, setHistory] = useState(() => getHistory())
  const [notifyEnabled, setNotifyEnabled] = useState(() =>
    typeof window !== "undefined" ? readNotifyOn() : false,
  )

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      if (panicDataCache) {
        if (!cancelled) {
          setData(panicDataCache)
          setLoadError(null)
        }
        return
      }

      try {
        const json = await fetchPanicDataJson()
        if (!cancelled) {
          panicDataCache = json
          setData(json)
          setLoadError(null)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error("[YDS SignalDashboard] 패닉 데이터 로드 실패", err)
        if (!cancelled) {
          setLoadError(message)
          setData(null)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [retryKey])

  useEffect(() => {
    if (!data) return
    setHistory(saveHistory(data))
  }, [data])

  const finalScore = useMemo(() => {
    if (!data) return NaN
    return getFinalScore(data)
  }, [data])

  const notificationsActive =
    notifyEnabled &&
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted"

  usePanicNotifications(finalScore, notificationsActive && data != null)

  if (loadError != null) {
    const isProd = import.meta.env.PROD
    const hasApiBase = Boolean(getApiBase())
    const tried = listPanicDataUrlAttemptsForDisplay()
    const triedLine = tried.length ? tried.join(" → ") : "(설정된 API URL 없음)"
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-16 text-center text-red-300">
        <p className="text-lg">불러오기 실패</p>
        <p className="text-sm opacity-90">{loadError}</p>
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
        ) : (
          <p className="text-xs text-gray-500">
            <code className="text-gray-400">vite-project</code> 폴더에서{" "}
            <code className="text-gray-400">npm run dev:full</code> 로 웹+API를 같이 띄우거나, 별도 터미널에서{" "}
            <code className="text-gray-400">python server.py</code> (프로젝트 루트)로 Flask가{" "}
            <code className="text-gray-400">5000</code> 포트에 있는지 확인하세요.
          </p>
        )}
        <p className="text-xs text-gray-600">시도한 주소: {triedLine}</p>
        <button
          type="button"
          className="min-h-[44px] rounded-lg bg-red-500/20 px-5 py-3 text-sm font-medium text-red-200 ring-1 ring-red-500/40 transition hover:bg-red-500/30 sm:min-h-0 sm:py-2"
          onClick={() => {
            clearPanicDataCache()
            setLoadError(null)
            setData(null)
            setRetryKey((k) => k + 1)
          }}
        >
          다시 시도
        </button>
      </div>
    )
  }

  if (!data) {
    const displayUrl = getPanicDataUrlForDisplay()
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 rounded-2xl border border-gray-800 bg-[#111827]/40 px-6 py-16 text-center text-gray-400">
        <p className="text-lg">로딩 중…</p>
        <p className="text-xs text-gray-500">API에서 데이터를 불러오는 중입니다.</p>
        {displayUrl ? (
          <p className="text-xs text-gray-500">
            <code className="break-all text-gray-500">{displayUrl}</code>
          </p>
        ) : null}
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
      <PanicIndexCard
        data={data}
        finalScore={finalScore}
        action={action}
        weightsDescription={weightsDescription}
        tradingSignal={tradingSignal}
        history={history}
        trend={trend}
        timing={timing}
      />
      <StockRecommendCard score={finalScore} />
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
