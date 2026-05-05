import { useEffect, useMemo, useRef } from "react"
import { PANIC_DUMMY_CHART_ROWS } from "../data/panicDummyCharts.js"
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
    <article className="relative z-0 rounded-2xl bg-[#111827] p-4 text-center shadow-lg shadow-black/20 transition duration-200 ease-out sm:p-6 lg:hover:z-10 lg:hover:scale-[1.02] lg:hover:shadow-xl">
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
        <Gauge score={finalScore} />
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
          <h2 className="m-0 text-base font-semibold tracking-tight text-gray-100">단기 (Tactical)</h2>
          <div className="mb-6 mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            <PanicMetricCard title="VIX" value={panicData.short.vix} type="vix" />
            <PanicMetricCard title="Put/Call" value={panicData.short.putCall} type="putCall" />
            <PanicMetricCard title="VXN" value={panicData.short.vxn} />
          </div>

          <h2 className="m-0 mt-2 text-base font-semibold tracking-tight text-gray-100">중기 (Strategic)</h2>
          <div className="mb-6 mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            <PanicMetricCard title="공포탐욕지수" value={panicData.mid.fearGreed} type="fearGreed" />
            <PanicMetricCard title="BofA" value={panicData.mid.bofa} type="bofa" />
            <PanicMetricCard title="MOVE" value={panicData.mid.move} />
          </div>

          <h2 className="m-0 mt-2 text-base font-semibold tracking-tight text-gray-100">장기 (Macro)</h2>
          <div className="mb-0 mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            <PanicMetricCard title="SKEW" value={panicData.long.skew} />
            <PanicMetricCard title="하이일드" value={panicData.long.highYield} type="highYield" />
            <PanicMetricCard title="GS 지수" value={panicData.long.gs} />
          </div>

          {isPro ? (
            <>
              <p className="mt-8 text-xs text-gray-500">
                아래 차트는 API 시계열 연결 전 <span className="text-gray-400">샘플 데이터</span>입니다.
              </p>
              <PanicIndicatorChartBox title="VIX 흐름" data={PANIC_DUMMY_CHART_ROWS} dataKey="vix" />
              <PanicIndicatorChartBox title="Put/Call 흐름" data={PANIC_DUMMY_CHART_ROWS} dataKey="putCall" />
              <PanicIndicatorChartBox title="BofA 흐름" data={PANIC_DUMMY_CHART_ROWS} dataKey="bofa" />
              <PanicIndicatorChartBox title="Fear & Greed 흐름" data={PANIC_DUMMY_CHART_ROWS} dataKey="fearGreed" />
              <PanicIndicatorChartBox title="하이일드 흐름" data={PANIC_DUMMY_CHART_ROWS} dataKey="highYield" />
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
