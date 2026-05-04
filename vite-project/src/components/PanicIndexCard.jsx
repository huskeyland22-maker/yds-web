import Gauge from "./Gauge.jsx"
import ScoreHistorySparkline from "./ScoreHistorySparkline.jsx"
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

function fmt(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "—"
  return String(v)
}

export default function PanicIndexCard({
  data,
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

  return (
    <article className="relative z-0 rounded-2xl bg-[#111827] p-6 text-center shadow-lg shadow-black/20 transition duration-200 ease-out hover:z-10 hover:scale-105 hover:shadow-xl">
      <h3 className="text-lg font-semibold text-white">패닉 지수</h3>
      <p className="mt-1 text-xs text-gray-500">
        지표별 0~100 → 단기·중기 → 동적 가중 최종 점수 → 매매 행동
      </p>
      {data.updatedAt ? (
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

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-left text-xs sm:grid-cols-3">
          <div className="rounded-lg border border-gray-800 bg-[#0f172a]/80 px-2 py-2">
            <dt className="text-gray-500">VIX</dt>
            <dd className="font-mono text-gray-200">{fmt(data.vix)}</dd>
          </div>
          <div className="rounded-lg border border-gray-800 bg-[#0f172a]/80 px-2 py-2">
            <dt className="text-gray-500">Put/Call</dt>
            <dd className="font-mono text-gray-200">{fmt(data.putCall)}</dd>
          </div>
          <div className="rounded-lg border border-gray-800 bg-[#0f172a]/80 px-2 py-2">
            <dt className="text-gray-500">Fear &amp; Greed</dt>
            <dd className="font-mono text-gray-200">{fmt(data.fearGreed)}</dd>
          </div>
          <div className="rounded-lg border border-gray-800 bg-[#0f172a]/80 px-2 py-2">
            <dt className="text-gray-500">BofA</dt>
            <dd className="font-mono text-gray-200">{fmt(data.bofa)}</dd>
          </div>
          <div className="rounded-lg border border-gray-800 bg-[#0f172a]/80 px-2 py-2">
            <dt className="text-gray-500">High yield</dt>
            <dd className="font-mono text-gray-200">{fmt(data.highYield)}</dd>
          </div>
        </dl>
      </div>
    </article>
  )
}
