import { useMemo, useState } from "react"
import { runBacktest } from "../utils/panicBacktest.js"

function EquityLineChart({ curve }) {
  const pts = Array.isArray(curve) ? curve : []
  if (pts.length < 2) return null

  const w = 320
  const h = 72
  const padX = 8
  const padY = 6
  const iw = w - padX * 2
  const ih = h - padY * 2
  const eq = pts.map((p) => p.equity)
  const lo = Math.min(...eq)
  const hi = Math.max(...eq)
  const span = Math.max(1e-6, hi - lo)

  const xs = eq.map((_, i) => padX + (eq.length === 1 ? iw / 2 : (i / (eq.length - 1)) * iw))
  const ys = eq.map((v) => padY + ih - ((v - lo) / span) * ih)

  const d = eq
    .map((_, i) => `${i === 0 ? "M" : "L"} ${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`)
    .join(" ")

  return (
    <div className="mt-3">
      <p className="mb-1 text-left text-[11px] font-medium text-gray-500">자산 추이 (합성 모델)</p>
      <div className="overflow-hidden rounded-lg border border-gray-800 bg-[#0b1222]">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-[76px] w-full" preserveAspectRatio="xMidYMid meet" role="img">
          <path
            d={d}
            fill="none"
            stroke="rgb(96, 165, 250)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  )
}

export default function BacktestPanel({ history }) {
  const [ranKey, setRanKey] = useState(0)
  const [hasRun, setHasRun] = useState(false)

  const result = useMemo(() => {
    if (!hasRun) return null
    void ranKey
    try {
      return runBacktest(history)
    } catch {
      return null
    }
  }, [history, ranKey, hasRun])

  return (
    <article className="rounded-2xl border border-gray-800/90 bg-[#111827] p-5 shadow-lg shadow-black/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">전략 백테스트</h3>
          <p className="mt-1 text-xs text-gray-500">
            점수 ≥65 매수 · ≤35 매도 · 합성가격(100+50−score) 기준 시뮬레이션
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setHasRun(true)
            setRanKey((k) => k + 1)
          }}
          className="min-h-[44px] shrink-0 rounded-lg bg-gradient-to-b from-sky-600 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-md ring-1 ring-sky-400/30 transition hover:from-sky-500 hover:to-blue-600 active:scale-[0.98] sm:min-h-0 sm:py-2"
        >
          백테스트 실행
        </button>
      </div>

      {!hasRun ? (
        <p className="mt-3 text-xs text-gray-500">버튼을 누르면 현재 히스토리(또는 더미)로 시뮬레이션합니다.</p>
      ) : null}

      {result?.usedDummy ? (
        <p className="mt-2 text-xs text-amber-200/90">
          저장된 히스토리가 부족해 <strong>더미 시계열</strong>로 대체했습니다. 실제 스냅샷이 쌓이면 자동으로 실데이터를
          사용합니다.
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-800 bg-[#0f172a]/80 px-3 py-2.5 text-sm">
            <p className="text-xs text-gray-500">수익률</p>
            <p
              className={
                result.totalReturn >= 0 ? "mt-0.5 font-mono text-lg text-emerald-400" : "mt-0.5 font-mono text-lg text-red-400"
              }
            >
              {result.totalReturn >= 0 ? "+" : ""}
              {result.totalReturn}%
            </p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-[#0f172a]/80 px-3 py-2.5 text-sm">
            <p className="text-xs text-gray-500">승률</p>
            <p className="mt-0.5 font-mono text-lg text-gray-100">{result.winRate}%</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-[#0f172a]/80 px-3 py-2.5 text-sm">
            <p className="text-xs text-gray-500">거래</p>
            <p className="mt-0.5 font-mono text-lg text-gray-100">{result.trades}회</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-[#0f172a]/80 px-3 py-2.5 text-sm">
            <p className="text-xs text-gray-500">최대 낙폭 (피크 대비)</p>
            <p className="mt-0.5 font-mono text-lg text-orange-300">-{result.maxDrawdown}%</p>
          </div>
        </div>
      ) : null}

      {result?.equityCurve ? <EquityLineChart curve={result.equityCurve} /> : null}

      <p className="mt-3 text-[10px] leading-relaxed text-gray-600">
        실제 주가·슬리피지·세금 미반영. 전략 민감도 확인용이며 투자 권유가 아닙니다.
      </p>
    </article>
  )
}
