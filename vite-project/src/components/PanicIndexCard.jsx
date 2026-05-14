import { useEffect, useMemo, useRef, useState } from "react"
import Gauge from "./Gauge.jsx"
import PanicIndicatorChartBox from "./PanicIndicatorChartBox.jsx"
import PanicMetricCard from "./PanicMetricCard.jsx"
import ScoreHistorySparkline from "./ScoreHistorySparkline.jsx"
import { groupPanicData } from "../utils/groupPanicData.js"
import {
  getAdvancedSignal,
  getConfidence,
  getSignal,
  getTotalSignalScore,
} from "../utils/panicMarketSignal.js"
import { getActionTone } from "../utils/tradingScores.js"

const PANEL_RING = {
  buy: "border-emerald-500/45 bg-emerald-500/[0.08] ring-1 ring-emerald-500/20",
  neutral: "border-amber-500/45 bg-amber-500/[0.07] ring-1 ring-amber-500/20",
  danger: "border-red-500/45 bg-red-500/[0.08] ring-1 ring-red-500/20",
}

const PANEL_HEAD = {
  buy: "text-emerald-300",
  neutral: "text-amber-200",
  danger: "text-red-200",
}

const TREND_TEXT = {
  up: "text-emerald-400",
  down: "text-red-400",
  flat: "text-amber-300",
}

const TIMING_TEXT = {
  buy: "text-emerald-400",
  neutral: "text-amber-300",
  danger: "text-red-400",
}

function pickSn(x) {
  if (x == null) return null
  if (typeof x === "number") return Number.isFinite(x) ? x : null
  const n = Number(x)
  return Number.isFinite(n) ? n : null
}

/** 시계열 API 없을 때: 현재 스냅샷 수치로 평평한 스파크(더미 난수 없음) */
function buildLiveMetricSparkFromData(data) {
  if (!data || typeof data !== "object") return []
  const row = {
    vix: pickSn(data.vix),
    putCall: pickSn(data.putCall),
    bofa: pickSn(data.bofa),
    fearGreed: pickSn(data.fearGreed),
    highYield: pickSn(data.highYield),
  }
  if (row.vix == null && row.putCall == null && row.fearGreed == null && row.bofa == null && row.highYield == null) {
    return []
  }
  return [1, 2, 3, 4, 5].map((t) => ({ time: String(t), ...row }))
}

const SHORT_METRICS = [
  { key: "vix", title: "VIX", type: "vix" },
  { key: "vxn", title: "VXN", type: "vxn" },
  { key: "putCall", title: "Put/Call", type: "putCall" },
]

const MID_METRICS = [
  { key: "fearGreed", title: "공포탐욕지수", type: "fearGreed" },
  { key: "move", title: "MOVE Index", type: "move" },
  { key: "bofa", title: "BofA", type: "bofa" },
]

const LONG_METRICS = [
  { key: "skew", title: "SKEW", type: "skew" },
  { key: "highYield", title: "하이일드", type: "highYield" },
  { key: "gsBullBear", title: "GS Bull/Bear", type: "gsBullBear" },
]

export default function PanicIndexCard({
  data,
  isPro = false,
  finalScore,
  action,
  weightsDescription,
  tradingSignal,
  history = [],
  trend,
  timing,
}) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  )
  useEffect(() => {
    if (typeof window === "undefined") return
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const tone = getActionTone(finalScore)
  const pt = tradingSignal?.panelTone ?? "neutral"
  const ring = PANEL_RING[pt] ?? PANEL_RING.neutral
  const headC = PANEL_HEAD[pt] ?? PANEL_HEAD.neutral
  const trendDir = trend?.direction ?? "flat"
  const trendCls =
    trend?.insufficient === true
      ? "text-gray-400"
      : TREND_TEXT[trendDir] ?? TREND_TEXT.flat
  const timingCls = timing?.tone ? TIMING_TEXT[timing.tone] ?? TIMING_TEXT.neutral : TIMING_TEXT.neutral

  const panicData = useMemo(() => groupPanicData(data), [data])

  const totalScore = useMemo(() => getTotalSignalScore(data), [data])
  const referenceMvpSignal = useMemo(() => getSignal(totalScore), [totalScore])
  const strategySignal = useMemo(() => getAdvancedSignal(data), [data])
  const confidence = useMemo(() => getConfidence(data), [data])
  const indicatorSpark = useMemo(() => buildLiveMetricSparkFromData(data), [data])

  /** 구간 진입 시에만 브라우저 alert (폴링마다 반복되지 않도록) */
  const alertOnceRef = useRef({ vixAbove30: false, strongBuy: false, strongSell: false })

  useEffect(() => {
    if (!data || !isPro) return

    const checkAlert = () => {
      const vix = Number(data.vix)
      if (Number.isFinite(vix) && vix > 30) {
        if (!alertOnceRef.current.vixAbove30) {
          alert("🚨 VIX 급등! 시장 위험 상태")
          alertOnceRef.current.vixAbove30 = true
        }
      } else {
        alertOnceRef.current.vixAbove30 = false
      }

      const ts = getTotalSignalScore(data)
      if (ts >= 3) {
        if (!alertOnceRef.current.strongBuy) {
          alert("🟢 강한 매수 구간")
          alertOnceRef.current.strongBuy = true
        }
      } else {
        alertOnceRef.current.strongBuy = false
      }

      if (ts <= -3) {
        if (!alertOnceRef.current.strongSell) {
          alert("🔴 강한 매도 구간")
          alertOnceRef.current.strongSell = true
        }
      } else {
        alertOnceRef.current.strongSell = false
      }
    }

    checkAlert()
  }, [data, isPro])

  return (
    <article
      className="relative z-0 min-w-0 w-full rounded-2xl bg-[#111827] text-center shadow-lg shadow-black/20 transition duration-200 ease-out lg:hover:z-10 lg:hover:scale-[1.02] lg:hover:shadow-xl"
      style={{
        padding: isMobile ? "12px" : "24px",
      }}
    >
      <h3 className="text-lg font-semibold text-white">패닉 지수</h3>
      <p className="mt-1 text-xs font-medium text-amber-200/90">
        {isPro ? "PRO — 차트·고급 시그널·브라우저 알림 사용 중" : "무료 — 지표·기본 시그널만 (PRO는 VITE_PRO_API_KEY + 서버 PRO_API_KEY 일치)"}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        단기·중기·장기 지표 → 0~100 환산 → 동적 가중 최종 점수 → 매매 행동
      </p>
      {data?.updatedAt ? (
        <p className="mt-1 text-xs text-gray-500">
          업데이트:{" "}
          <span className="font-mono text-gray-300">{data.updatedAt}</span>
        </p>
      ) : null}

      <div className="mt-4">
        <Gauge score={finalScore} width={isMobile ? 180 : 280} height={isMobile ? 110 : 160} />
        <p className="mt-1 text-sm text-gray-500">
          <span className="font-mono text-gray-300">{finalScore}</span>
          <span className="text-gray-500"> / 100</span>
          <span className="ml-2 text-xs text-gray-600">(최종)</span>
        </p>

        {trend && timing ? (
          <div className="mt-4 rounded-lg border border-gray-800/90 bg-[#0f172a]/55 px-3 py-2.5 text-left">
            <p className={`text-sm font-semibold ${trendCls}`}>추세: {trend.label}</p>
            {!trend.insufficient &&
            Number.isFinite(trend.avgRecent) &&
            Number.isFinite(trend.avgPrev) ? (
              <p className="mt-1 text-[11px] text-gray-500">
                최근 3회 평균 <span className="font-mono text-gray-400">{trend.avgRecent.toFixed(1)}</span>
                <span className="mx-1 text-gray-600">vs</span>
                직전 3회 평균 <span className="font-mono text-gray-400">{trend.avgPrev.toFixed(1)}</span>
              </p>
            ) : null}
            <p className={`mt-2 text-sm font-semibold ${timingCls}`}>타이밍: {timing.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">{timing.detail}</p>
          </div>
        ) : null}

        <p className={`mt-3 text-lg font-semibold ${tone}`}>{action}</p>
        {weightsDescription ? (
          <p className="mt-1 text-xs text-gray-500">{weightsDescription}</p>
        ) : null}

        {tradingSignal ? (
          <div
            className={`mt-5 rounded-xl border px-4 py-3 text-left text-sm ${ring}`}
          >
            <p className={`font-semibold ${headC}`}>{tradingSignal.strategyHeadline}</p>
            <p className="mt-2 text-xs text-gray-400">
              리스크: <span className="text-gray-200">{tradingSignal.riskLevel}</span>
            </p>
            {tradingSignal.riskAdj?.note ? (
              <p className="mt-1 text-xs text-amber-200/90">{tradingSignal.riskAdj.note}</p>
            ) : null}
            <p className="mt-2 text-xs leading-relaxed text-gray-300">
              추천: {tradingSignal.strategyHint}
            </p>
            {tradingSignal.sellStrategy?.level !== "none" ? (
              <p className="mt-2 border-t border-white/10 pt-2 text-xs font-medium text-red-300/95">
                방어: {tradingSignal.sellStrategy.label} — {tradingSignal.sellStrategy.message}
              </p>
            ) : null}
            <p className="mt-2 text-xs leading-relaxed text-gray-500">
              {tradingSignal.buyStep.message}
            </p>
          </div>
        ) : null}

        <ScoreHistorySparkline history={history} />

        <div className="mt-6 text-left">
          <h2
            style={{ marginTop: "30px", fontSize: "18px", borderBottom: "1px solid #374151", paddingBottom: "5px" }}
            className="m-0 font-semibold tracking-tight text-gray-100"
          >
            단기 (Tactical)
          </h2>
          <p className="mt-2 text-xs text-gray-300" style={{ lineHeight: 1.7, letterSpacing: "-0.02em", opacity: 0.92 }}>
            실전 매매 타점 포착: 시장의 즉각적인 공포와 옵션 수급의 쏠림을 반영하며, 며칠~2주 내 진입/탈출
            타이밍 포착에 사용합니다. 해당 지표: VXN, VIX, Put/Call Ratio.
          </p>
          <div className="mb-6 mt-3 grid w-full gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {SHORT_METRICS.map((metric) => (
              <PanicMetricCard
                key={metric.key}
                title={metric.title}
                value={panicData.short[metric.key]}
                type={metric.type}
              />
            ))}
          </div>

          <h2
            style={{ marginTop: "30px", fontSize: "18px", borderBottom: "1px solid #374151", paddingBottom: "5px" }}
            className="m-0 font-semibold tracking-tight text-gray-100"
          >
            중기 (Strategic)
          </h2>
          <p className="mt-2 text-xs text-gray-300" style={{ lineHeight: 1.7, letterSpacing: "-0.02em", opacity: 0.92 }}>
            전략적 비중 조절: 시장 전체 심리와 추세 온도를 확인하고, 2주~수개월 흐름 분석에 활용합니다.
            해당 지표: Fear & Greed, MOVE, BofA Bull & Bear.
          </p>
          <div className="mb-6 mt-3 grid w-full gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {MID_METRICS.map((metric) => (
              <PanicMetricCard
                key={metric.key}
                title={metric.title}
                value={panicData.mid[metric.key]}
                type={metric.type}
              />
            ))}
          </div>

          <h2
            style={{ marginTop: "30px", fontSize: "18px", borderBottom: "1px solid #374151", paddingBottom: "5px" }}
            className="m-0 font-semibold tracking-tight text-gray-100"
          >
            장기 (Macro)
          </h2>
          <p className="mt-2 text-xs text-gray-300" style={{ lineHeight: 1.7, letterSpacing: "-0.02em", opacity: 0.92 }}>
            거시 리스크 및 시스템 방어: 블랙스완 및 신용위기 탐지에 사용합니다. 해당 지표: SKEW, High Yield
            Spread, GS Bull/Bear.
          </p>
          <div className="mb-0 mt-3 grid w-full gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {LONG_METRICS.map((metric) => (
              <PanicMetricCard
                key={metric.key}
                title={metric.title}
                value={panicData.long[metric.key]}
                type={metric.type}
              />
            ))}
          </div>

          {isPro ? (
            <>
              <p className="mt-8 text-xs text-gray-500">
                아래 차트는 <span className="text-gray-300">현재 API 스냅샷</span> 기준입니다. (누적 시계열 연동 시 변동 그래프로 확장)
              </p>
              {indicatorSpark.length ? (
                <>
                  <PanicIndicatorChartBox title="VIX 흐름" data={indicatorSpark} dataKey="vix" />
                  <PanicIndicatorChartBox title="Put/Call 흐름" data={indicatorSpark} dataKey="putCall" />
                  <PanicIndicatorChartBox title="BofA 흐름" data={indicatorSpark} dataKey="bofa" />
                  <PanicIndicatorChartBox title="Fear & Greed 흐름" data={indicatorSpark} dataKey="fearGreed" />
                  <PanicIndicatorChartBox title="하이일드 흐름" data={indicatorSpark} dataKey="highYield" />
                </>
              ) : (
                <p className="mt-4 text-xs text-gray-500">표시할 지표 스냅샷이 없습니다. 패닉 데이터를 불러온 뒤 다시 확인해 주세요.</p>
              )}
            </>
          ) : (
            <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-950/25 px-4 py-8 text-center text-amber-100/95">
              <p className="m-0 text-base font-semibold">🔒 PRO 전용 기능입니다</p>
              <p className="mx-auto mt-2 max-w-sm text-xs text-amber-200/80">
                전체 차트·시계열·실시간 브라우저 알림은 PRO 요금제에서 제공됩니다.
              </p>
            </div>
          )}

          <div
            style={{
              marginTop: "30px",
              padding: "20px",
              background: "#1f2937",
              borderRadius: "12px",
              textAlign: "center",
            }}
          >
            <h2 className="m-0 text-base font-semibold text-gray-200">📊 시장 시그널</h2>
            {isPro ? (
              <>
                <h1 className="my-3 text-2xl font-bold leading-tight" style={{ color: strategySignal.color }}>
                  {strategySignal.text}
                </h1>
                <p className="m-0 text-sm text-gray-300">신뢰도: {confidence} / 4</p>
                {data?.proFeatures?.advancedSignal ? (
                  <p className="m-0 mt-2 text-xs text-sky-300/90">PRO 기능 플래그: 고급 분석·차트·알림</p>
                ) : null}
                <p className="m-0 mt-2 text-sm text-gray-500">
                  참고 합산(MVP): {totalScore} — {referenceMvpSignal.text}
                </p>
              </>
            ) : (
              <>
                <h1 className="my-3 text-2xl font-bold leading-tight" style={{ color: strategySignal.color }}>
                  {strategySignal.text}
                </h1>
                <p className="m-0 text-sm text-gray-300">신뢰도: {confidence} / 4</p>
                <p className="m-0 mt-2 text-sm text-gray-500">
                  참고 합산(MVP): {totalScore} — {referenceMvpSignal.text}
                </p>
                <p className="mt-2 text-xs text-gray-500">PRO: 전체 차트·브라우저 알림 등</p>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
