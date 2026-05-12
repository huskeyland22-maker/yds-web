import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Link } from "react-router-dom"
import { X } from "lucide-react"
import MiniDailyStockChart from "./MiniDailyStockChart.jsx"
import { naverFinanceUrl } from "../utils/valueChainStockInsight.js"
import { fetchStockIndicators } from "../utils/stockIndicatorsApi.js"
import { buildValueChainTacticalSignal, timingPageSearchParams } from "../utils/valueChainTacticalSignal.js"

export default function ValueChainStockPanel({ stock, sectorName, onClose }) {
  const [snap, setSnap] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!stock) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [stock])

  useEffect(() => {
    if (!stock) return
    const onKey = (e) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [stock, onClose])

  useEffect(() => {
    if (!stock?.code) {
      setSnap(null)
      setErr(new Error("종목 코드가 없습니다."))
      return
    }
    let cancelled = false
    setLoading(true)
    setErr(null)
    setSnap(null)
    fetchStockIndicators({ code: stock.code, name: stock.name })
      .then((data) => {
        if (!cancelled) setSnap(data)
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e : new Error(String(e)))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [stock?.code, stock?.name])

  if (!stock) return null

  const extUrl = naverFinanceUrl(stock)
  const narrative = snap?.narrative
  const panel = snap?.panel

  const tactical = useMemo(
    () =>
      buildValueChainTacticalSignal(snap, {
        loading,
        error: Boolean(err) && !loading,
        stock,
      }),
    [snap, loading, err, stock],
  )

  const timingHref = `/timing${timingPageSearchParams(stock)}`
  const tacticalBorder =
    tactical.tone === "ok"
      ? "border-cyan-500/20 shadow-[inset_0_1px_0_rgba(34,211,238,0.07)]"
      : tactical.tone === "warn"
        ? "border-amber-500/20"
        : "border-white/[0.08]"

  return (
    <div className="fixed inset-0 z-[6000] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity"
        aria-label="패널 닫기"
        onClick={onClose}
      />
      <aside
        className="relative flex h-full w-full max-w-[min(100%,420px)] flex-col border-l border-white/[0.08] bg-[#0a0f18]/92 shadow-[-24px_0_80px_rgba(0,0,0,0.55)] backdrop-blur-xl"
        style={{
          background: "linear-gradient(195deg, rgba(14,22,38,0.96) 0%, rgba(6,10,18,0.98) 55%, rgba(8,12,22,0.99) 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background: "radial-gradient(circle at 100% 0%, rgba(34,211,238,0.12), transparent 45%)",
          }}
          aria-hidden
        />
        <header className="relative z-[1] flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-5">
          <div>
            <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/75">일봉 데이터 엔진</p>
            <h2 className="m-0 mt-2 font-['Playfair_Display',Georgia,serif] text-2xl font-semibold tracking-tight text-slate-50">{stock.name}</h2>
            <p className="m-0 mt-1 text-xs text-slate-500">{sectorName}</p>
            {stock.code ? <p className="m-0 mt-0.5 font-mono text-[11px] text-slate-600">{stock.code}</p> : null}
            {snap?.dataSource === "kis" ? (
              <p className="m-0 mt-1 text-[10px] text-emerald-200/70">데이터 · 한국투자증권 일봉 (KIS)</p>
            ) : null}
            {snap?.dataSource === "yahoo" && snap?.yahooSymbol ? (
              <p className="m-0 mt-1 text-[10px] text-slate-600">소스 심볼 {snap.yahooSymbol} (Yahoo 폴백)</p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">
            <a
              href={extUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-[11px] font-medium text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-500/15"
            >
              시세
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:border-white/20 hover:text-white"
              aria-label="닫기"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
        </header>

        <div className="relative z-[1] flex-1 overflow-y-auto px-5 py-6">
          {loading ? (
            <p className="m-0 text-sm text-slate-400">최신 일봉을 불러오는 중…</p>
          ) : null}

          {err && !loading ? (
            <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-3 text-sm text-rose-100/95">
              <p className="m-0 font-medium">데이터를 가져오지 못했습니다</p>
              <p className="m-0 mt-1 text-xs text-rose-200/80">{err.message}</p>
            </div>
          ) : null}

          {!loading && snap && narrative && panel ? (
            <>
              {snap.chart?.bars?.length ? (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                  className="mb-8"
                >
                  <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">미니 캔들 (일봉)</p>
                  <p className="m-0 mt-1 text-[10px] leading-relaxed text-slate-600">
                    최근 약 3~6개월 · OHLC·20/60 MA·거래량 (호버 시 시가·고가·저가·종가·등락률)
                  </p>
                  <div className="mt-3">
                    <MiniDailyStockChart bars={snap.chart.bars} />
                  </div>
                </motion.section>
              ) : (
                <section className="mb-8 rounded-xl border border-cyan-400/15 bg-cyan-500/[0.04] px-4 py-4">
                  <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">미니 캔들 (일봉)</p>
                  <p className="m-0 mt-3 text-sm font-medium tracking-tight text-slate-200">차트 데이터 준비 중</p>
                  <p className="m-0 mt-2 text-[11px] leading-relaxed text-slate-500">
                    캔들 차트는 API에 chart 필드(OHLC·거래량)가 포함된 뒤 표시됩니다. 재배포 직후에는 캐시를 비우고 강력 새로고침하거나 시크릿 창에서
                    확인해 주세요.
                  </p>
                </section>
              )}

              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">보조지표 · 확인용</p>
                <p className="m-0 mt-2 text-[10px] text-slate-600">
                  종가 {typeof snap.price === "number" ? snap.price.toLocaleString("ko-KR") : "—"}
                  {snap.barsUsed ? ` · 일봉 ${snap.barsUsed}봉` : ""}
                </p>
                <ul className="m-0 mt-4 list-none space-y-4 p-0">
                  <li>
                    <p className="m-0 text-[11px] font-medium text-cyan-200/90">거래량</p>
                    <p className="m-0 mt-1 text-sm leading-snug text-slate-200">{panel.volumeLine}</p>
                  </li>
                  <li>
                    <p className="m-0 text-[11px] font-medium text-cyan-200/90">RSI</p>
                    <p className="m-0 mt-1 text-sm leading-snug text-slate-200">{panel.rsiLine}</p>
                  </li>
                  <li>
                    <p className="m-0 text-[11px] font-medium text-cyan-200/90">MACD</p>
                    <p className="m-0 mt-1 text-sm leading-snug text-slate-200">{panel.macdLine}</p>
                  </li>
                  <li>
                    <p className="m-0 text-[11px] font-medium text-cyan-200/90">이평선 배열</p>
                    <p className="m-0 mt-1 text-sm leading-snug text-slate-200">{panel.maLine}</p>
                  </li>
                </ul>
              </div>

              <div className="mt-8 space-y-5">
                <section>
                  <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">현재 상태</p>
                  <p className="m-0 mt-1.5 text-sm leading-relaxed text-slate-100">{narrative.status}</p>
                </section>
                <section>
                  <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">시장 위치</p>
                  <p className="m-0 mt-1.5 text-sm leading-relaxed text-slate-100">{narrative.position}</p>
                </section>
                <section>
                  <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">단기 흐름</p>
                  <p className="m-0 mt-1.5 text-sm leading-relaxed text-slate-100">{narrative.flow}</p>
                </section>
              </div>
            </>
          ) : null}

          {stock.tip ? (
            <p className="m-0 mt-6 border-t border-white/[0.05] pt-5 text-xs leading-relaxed text-slate-500">{stock.tip}</p>
          ) : null}

          <div className="mt-8 border-t border-white/[0.06] pt-5">
            <div className={`rounded-xl border bg-black/20 ${tacticalBorder} px-4 py-4`}>
              <p className="m-0 text-[10px] font-semibold tracking-[0.12em] text-cyan-200/60">{"Y'ds Tactical Signal"}</p>
              <p className="m-0 mt-3 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">현재 전략</p>
              <p className="m-0 mt-1 text-sm font-semibold tracking-tight text-slate-100">{tactical.strategy}</p>

              {tactical.positionLine ? (
                <p className="m-0 mt-2 text-[12px] leading-snug text-slate-400">
                  <span className="text-slate-500">현재 위치</span> · {tactical.positionLine}
                </p>
              ) : null}
              {tactical.flowLine ? (
                <p className="m-0 mt-1 text-[12px] leading-snug text-slate-400">
                  <span className="text-slate-500">단기 흐름</span> · {tactical.flowLine}
                </p>
              ) : null}

              <ul className="m-0 mt-3 list-none space-y-2 border-t border-white/[0.06] p-0 pt-3">
                {tactical.bullets.map((line) => (
                  <li key={line} className="relative m-0 pl-3 text-[12px] leading-relaxed text-slate-300 before:absolute before:left-0 before:top-[0.55em] before:h-1 before:w-1 before:rounded-full before:bg-cyan-400/50 before:content-['']">
                    {line}
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link
                  to={timingHref}
                  className="inline-flex items-center justify-center rounded-lg border border-cyan-400/25 bg-cyan-500/[0.08] px-3 py-2 text-[11px] font-medium text-cyan-100/95 transition hover:border-cyan-300/40 hover:bg-cyan-500/[0.12]"
                >
                  매매 시그널 보기
                </Link>
                <span className="text-[10px] text-slate-600">시장·체크리스트 맥락</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
