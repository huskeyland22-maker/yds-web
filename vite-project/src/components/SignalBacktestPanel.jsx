import { useEffect, useState } from "react"
import { fetchHistorySample, fetchOptimizeResult } from "../config/api.js"
import { runAdvancedSignalBacktest } from "../utils/advancedSignalBacktest.js"

const boxStyle = {
  marginTop: "30px",
  padding: "20px",
  background: "#111",
  borderRadius: "12px",
}

/**
 * STEP 17: `/history` + 전략 시그널 백테스트 (최종 자산·거래·승률·MDD)
 */
export default function SignalBacktestPanel() {
  const [backtestResult, setBacktestResult] = useState(null)
  const [aiResult, setAiResult] = useState(null)
  const [backtestError, setBacktestError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const rows = await fetchHistorySample({ debugLog: true })
        if (cancelled) return
        if (!rows?.length) {
          setBacktestError("실제 데이터 없음 — 레거시 history.json 비활성화")
          return
        }
        const result = runAdvancedSignalBacktest(rows)
        setBacktestResult(result)
        console.log("백테스트 결과:", result)

        const optimized = await fetchOptimizeResult({ debugLog: true })
        if (cancelled) return
        setAiResult(optimized)
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e)
          setBacktestError(msg)
          console.warn("[YDS] 백테스트 실패:", e)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div style={boxStyle} className="border border-gray-800 text-left">
      <h2 className="m-0 text-lg font-semibold text-white">📈 백테스트 결과</h2>
      {loading ? (
        <p className="mt-3 text-sm text-gray-500">과거 샘플(/history) 불러오는 중…</p>
      ) : backtestError ? (
        <p className="mt-3 text-sm text-amber-200/90">불러오기 실패: {backtestError}</p>
      ) : backtestResult ? (
        <div className="mt-3 space-y-2 text-sm text-gray-300">
          <p className="m-0">
            최종 자산:{" "}
            <span className="font-mono text-lg font-semibold text-sky-300">
              {backtestResult.finalValue.toFixed(2)}
            </span>
          </p>
          <p className="m-0">거래 횟수: {backtestResult.trades}</p>
          <p className="m-0">승률: {backtestResult.winRate.toFixed(1)}%</p>
          <p className="m-0">MDD: {backtestResult.mdd.toFixed(1)}%</p>
          <p className="m-0 text-xs text-gray-500">(시작 자금 100 · 합성 /history 50일)</p>
        </div>
      ) : null}

      {aiResult ? (
        <div
          style={{
            marginTop: "30px",
            padding: "20px",
            background: "#1f2937",
            borderRadius: "12px",
          }}
        >
          <h2 className="m-0 text-base font-semibold text-gray-100">🤖 AI 최적 전략</h2>
          <p className="mb-0 mt-2 text-sm text-gray-300">최종 수익: {aiResult.best_score}</p>
          <pre className="mt-3 overflow-auto rounded-md border border-gray-700 bg-black/30 p-3 text-xs text-gray-300">
            {JSON.stringify(aiResult.strategy, null, 2)}
          </pre>
        </div>
      ) : null}
      <p className="mb-0 mt-3 text-[10px] leading-relaxed text-gray-600">
        실제 주가·수수료·슬리피지 미반영. 전략 검증용이며 투자 권유가 아닙니다.
      </p>
    </div>
  )
}
