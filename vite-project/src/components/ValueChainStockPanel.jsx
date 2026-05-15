import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Link } from "react-router-dom"
import { X } from "lucide-react"
import MiniDailyStockChart from "./MiniDailyStockChart.jsx"
import { naverFinanceUrl } from "../utils/valueChainStockInsight.js"
import ChartSkeleton from "./ChartSkeleton.jsx"
import { fetchStockIndicators } from "../utils/stockIndicatorsApi.js"
import { readStockSnapCache, saveStockSnapCache } from "../utils/stockSnapCache.js"
import {
  afterKrxDataConfirmed,
  msUntilKrx16Kst,
  shouldRefetchDomesticStock,
} from "../utils/krxDomesticClose.js"
import { buildObjectiveStateSnapshot } from "../utils/valueChainObjectiveState.js"
import { buildValueChainTacticalSignal } from "../utils/valueChainTacticalSignal.js"

function volumeHeadlineToneClass(tier) {
  if (tier === "explosion" || tier === "inflow") return "text-emerald-200"
  if (tier === "lift") return "text-cyan-200/95"
  if (tier === "average") return "text-slate-200"
  if (tier === "down") return "text-amber-200/90"
  if (tier === "cold") return "text-rose-200/80"
  return "text-slate-200"
}

export default function ValueChainStockPanel({ stock, sectorName, onClose }) {
  const [snap, setSnap] = useState(null)
  const [loading, setLoading] = useState(false)
  /** @type {[{ title: string; detail: string; code?: string; technical?: string } | null, Function]} */
  const [err, setErr] = useState(null)
  const [staleSnap, setStaleSnap] = useState(false)

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

  const abortRef = useRef(null)

  const loadIndicators = useCallback(
    (opts = {}) => {
      if (!stock?.code) return () => {}
      const silent = opts.silent === true
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      if (!silent) {
        setLoading(true)
        setErr(null)
        setStaleSnap(false)
        if (!opts.keepSnap) {
          const cached = readStockSnapCache(stock.code)
          if (cached?.snap) {
            setSnap(cached.snap)
            setStaleSnap(true)
          } else {
            setSnap(null)
          }
        }
      }
      fetchStockIndicators({ code: stock.code, name: stock.name, signal: ac.signal })
        .then((data) => {
          if (!ac.signal.aborted) {
            setSnap(data)
            setStaleSnap(false)
            setErr(null)
            saveStockSnapCache(stock.code, data)
          }
        })
        .catch((e) => {
          if (!ac.signal.aborted) {
            console.error("[ValueChainStockPanel] stock fetch failed", stock?.code, e)
            const stockError = e?.stockError ?? {
              title: "데이터 연결 중 문제가 발생했습니다.",
              detail: "잠시 후 다시 시도해주세요.",
              code: "unknown",
              technical: "",
            }
            setErr(stockError)
            const cached = readStockSnapCache(stock.code)
            if (cached?.snap) {
              setSnap(cached.snap)
              setStaleSnap(true)
            }
          }
        })
        .finally(() => {
          if (!ac.signal.aborted && !silent) setLoading(false)
        })
      return () => ac.abort()
    },
    [stock?.code, stock?.name],
  )

  useEffect(() => {
    if (!stock?.code) {
      setSnap(null)
      setErr({
        title: "종목 코드가 없습니다.",
        detail: "종목 데이터를 확인해주세요.",
        code: "missing_code",
      })
      setLoading(false)
      return undefined
    }
    const cancel = loadIndicators()
    return () => {
      cancel?.()
    }
  }, [stock?.code, stock?.name, loadIndicators])

  useEffect(() => {
    if (!stock?.code) return undefined
    const ms = msUntilKrx16Kst()
    if (ms == null || ms <= 0) return undefined
    const t = window.setTimeout(() => {
      loadIndicators({ silent: true, keepSnap: true })
    }, ms + 2500)
    return () => window.clearTimeout(t)
  }, [stock?.code, loadIndicators])

  useEffect(() => {
    if (!stock?.code) return undefined
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      const meta = snap?.chartMeta
      if (shouldRefetchDomesticStock(meta) || (afterKrxDataConfirmed() && meta?.dataSource === "kis" && !meta?.confirmReady)) {
        loadIndicators({ silent: true, keepSnap: true })
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [stock?.code, loadIndicators, snap?.chartMeta])

  useEffect(() => {
    if (!stock?.code || !shouldRefetchDomesticStock(snap?.chartMeta)) return undefined
    let n = 0
    const maxPolls = 12
    const poll = window.setInterval(() => {
      n += 1
      if (n > maxPolls) {
        window.clearInterval(poll)
        return
      }
      loadIndicators({ silent: true, keepSnap: true })
    }, 120_000)
    return () => window.clearInterval(poll)
  }, [stock?.code, snap?.chartMeta?.needsReverify, snap?.chartMeta?.confirmReady, loadIndicators])

  if (!stock) return null

  const extUrl = naverFinanceUrl(stock)
  const panel = snap?.panel

  const objective = useMemo(() => buildObjectiveStateSnapshot(snap), [snap])

  const tactical = useMemo(
    () =>
      buildValueChainTacticalSignal(snap, {
        loading,
        error: Boolean(err) && !loading,
        stock,
      }),
    [snap, loading, err, stock],
  )

  const timingHref = `/value-chain#stock-signals`
  const tacticalBorder =
    tactical.tone === "ok"
      ? "border-violet-500/40 bg-gradient-to-b from-violet-950/[0.35] to-black/40 shadow-[0_0_36px_rgba(99,102,241,0.14),inset_0_1px_0_rgba(255,255,255,0.06)]"
      : tactical.tone === "warn"
        ? "border-amber-500/30 bg-amber-950/20"
        : "border-white/[0.08] bg-black/25"

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
            background: "radial-gradient(circle at 100% 0%, rgba(99,102,241,0.1), transparent 48%)",
          }}
          aria-hidden
        />
        <header className="relative z-[1] flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-5">
          <div>
            <p className="m-0 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">Terminal · 일봉</p>
            <h2 className="m-0 mt-2 font-display text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">{stock.name}</h2>
            <p className="m-0 mt-1 text-xs text-slate-500">{sectorName}</p>
            {stock.code ? <p className="m-0 mt-0.5 font-mono text-[11px] text-slate-600">{stock.code}</p> : null}
            {snap?.priceSummary?.dataSourceBadge || snap?.chartMeta?.dataSourceBadge ? (
              <div className="m-0 mt-2 flex flex-wrap gap-1.5">
                <span className="inline-flex rounded border border-blue-400/35 bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-blue-200/90">
                  {snap.priceSummary?.dataSourceBadge ?? snap.chartMeta?.dataSourceBadge}
                </span>
                {snap?.priceSummary?.sessionBadge ? (
                  <span className="inline-flex rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
                    {snap.priceSummary.sessionBadge}
                  </span>
                ) : null}
              </div>
            ) : null}
            {snap?.dataSource === "yahoo" && snap?.yahooSymbol ? (
              <p className="m-0 mt-1 text-[10px] text-slate-600">{snap.yahooSymbol}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">
            <a
              href={extUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-2 text-[11px] font-medium text-slate-100 transition hover:border-indigo-400/35 hover:bg-indigo-500/10"
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
          {loading && !snap?.chart?.bars?.length ? <ChartSkeleton className="mb-6" /> : null}
          {loading && snap?.chart?.bars?.length ? (
            <p className="m-0 mb-4 text-sm text-slate-400">최신 일봉을 불러오는 중…</p>
          ) : null}

          {err && !loading ? (
            <div className="mb-4 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-3 text-sm text-rose-100/95">
              <p className="m-0 font-medium">{err.title}</p>
              {err.detail ? <p className="m-0 mt-1 text-xs text-rose-200/80">{err.detail}</p> : null}
              {/kis/i.test(err.code || "") ? (
                <p className="m-0 mt-2 text-[10px] text-rose-200/70">
                  국내 종목은 KIS API만 사용합니다. Vercel 환경변수에 KIS_APP_KEY·KIS_APP_SECRET을 설정하세요.
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => loadIndicators()}
                className="mt-3 rounded-lg border border-rose-400/35 bg-rose-500/15 px-3 py-1.5 text-[11px] font-medium text-rose-100 transition hover:bg-rose-500/25"
              >
                다시 시도
              </button>
            </div>
          ) : null}

          {staleSnap && snap ? (
            <p className="m-0 mb-4 rounded border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-[10px] text-amber-200/90">
              마지막으로 저장된 데이터를 표시 중입니다. 연결 복구 후 자동 갱신됩니다.
            </p>
          ) : null}

          {snap && (panel || snap.chart?.bars?.length) ? (
            <>
              {snap.chart?.bars?.length ? (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                  className="mb-8"
                >
                  <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">일봉 캔들</p>
                  <p className="m-0 mt-1 text-[10px] leading-relaxed text-slate-600">
                    최근 약 3개월 · 캔들·거래량·MA20/60 · 휠·핀치 확대
                  </p>
                  <div className="mt-3">
                    <MiniDailyStockChart
                      bars={snap.chart.bars}
                      chartMeta={snap.chartMeta}
                      priceSummary={snap.priceSummary}
                    />
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

              {panel ? (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">보조지표 · 확인용</p>
                <p className="m-0 mt-2 text-[10px] text-slate-600">
                  종가 {typeof snap.price === "number" ? snap.price.toLocaleString("ko-KR") : "—"}
                  {snap.barsUsed ? ` · 일봉 ${snap.barsUsed}봉` : ""}
                </p>
                <ul className="m-0 mt-4 list-none space-y-4 p-0">
                  <li>
                    <p className="m-0 text-[11px] font-medium text-cyan-200/90">거래량 · 수급 강도</p>
                    {panel.volumeHeadline != null && panel.volumeDetail != null ? (
                      <>
                        <p
                          className={`m-0 mt-1.5 text-sm font-semibold leading-snug ${volumeHeadlineToneClass(panel.volumeTier)}`}
                        >
                          {panel.volumeHeadline}
                        </p>
                        <p className="m-0 mt-1 text-[12px] leading-snug text-slate-300">{panel.volumeSubline}</p>
                        <p className="m-0 mt-1.5 text-[11px] leading-relaxed text-slate-500">{panel.volumeDetail}</p>
                      </>
                    ) : (
                      <p className="m-0 mt-1 text-sm leading-snug text-slate-200">{panel.volumeLine}</p>
                    )}
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
              ) : null}

              {objective ? (
                <div className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-4">
                  <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">객관 상태</p>
                  <p className="m-0 mt-1 text-[10px] leading-relaxed text-slate-600">차트·수급·추세 요약 (해석 최소)</p>
                  <dl className="m-0 mt-4 space-y-3 p-0">
                    <div>
                      <dt className="m-0 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">수급·거래</dt>
                      <dd className="m-0 mt-1 text-sm font-medium leading-snug text-slate-100">{objective.liquidity}</dd>
                    </div>
                    <div>
                      <dt className="m-0 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">추세 골격</dt>
                      <dd className="m-0 mt-1 text-sm font-medium leading-snug text-slate-100">{objective.structure}</dd>
                    </div>
                    <div>
                      <dt className="m-0 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">단기 변동</dt>
                      <dd className="m-0 mt-1 text-sm font-medium leading-snug text-slate-100">{objective.pulse}</dd>
                    </div>
                  </dl>
                </div>
              ) : null}
            </>
          ) : null}

          {stock.tip ? (
            <p className="m-0 mt-6 border-t border-white/[0.05] pt-5 text-xs leading-relaxed text-slate-500">{stock.tip}</p>
          ) : null}

          <div className="mt-8 border-t border-white/[0.06] pt-5">
            <div className={`rounded-xl border px-4 py-4 ${tacticalBorder}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="m-0 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-violet-300/85">
                    Tactical signal
                  </p>
                  <p className="m-0 mt-0.5 text-[10px] text-slate-500">실전 대응 · 리스크 관리</p>
                </div>
                <span className="rounded border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-violet-200/95">
                  {tactical.tone === "ok" ? "Active" : tactical.tone === "warn" ? "Check" : "Sync"}
                </span>
              </div>
              <p className="m-0 mt-4 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">현재 전략</p>
              <p className="m-0 mt-1 text-[13px] font-semibold leading-snug tracking-tight text-slate-50">{tactical.strategy}</p>

              <p className="m-0 mt-4 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">체크 포인트</p>
              <ul className="m-0 mt-2 list-none space-y-2 p-0">
                {(tactical.checkpoints ?? []).map((line) => (
                  <li
                    key={line}
                    className="relative m-0 border-l border-violet-500/25 pl-3 text-[12px] leading-relaxed text-slate-300"
                  >
                    {line}
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link
                  to={timingHref}
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-lg border border-violet-400/35 bg-violet-600/[0.15] px-3 py-2 text-[11px] font-medium text-violet-100 transition hover:border-violet-300/50 hover:bg-violet-600/[0.22]"
                >
                  종목 시그널 보기
                </Link>
                <span className="font-mono text-[9px] text-slate-600">CTX · signals</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
