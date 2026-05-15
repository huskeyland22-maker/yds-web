import { useMemo } from "react"
import { curatedBySector } from "../utils/valueChainTree.js"
import { timingBadgeClass, timingSignalForItem } from "../utils/valueChainTiming.js"

const CHECKLIST = ["눌림목", "거래량 증가", "단기 시그널", "중기 흐름", "보조지표 확인"]

const BUCKET_META = {
  hot: { title: "과열주의", sub: "추격 자제 · 익절·비중 점검", accent: "rose" },
  wait: { title: "눌림대기", sub: "지지 확인 후 분할 접근", accent: "amber" },
  good: { title: "추세", sub: "주도 흐름 유지 구간", accent: "emerald" },
}

function collectSignalsByTone(sectors) {
  const buckets = { hot: [], wait: [], good: [] }
  const seen = new Set()

  for (const sector of sectors) {
    const curated = curatedBySector(sector)
    for (const item of curated.all) {
      const key = `${item.code || ""}:${item.name}`
      if (seen.has(key)) continue
      seen.add(key)
      const sig = timingSignalForItem(item, sector.sections?.[0] || "생산단")
      const row = { ...item, sectorName: sector.name, sectorHeat: sector.heat, signal: sig }
      if (sig.tone === "hot") buckets.hot.push(row)
      else if (sig.tone === "wait") buckets.wait.push(row)
      else buckets.good.push(row)
    }
  }

  const cap = 8
  return {
    hot: buckets.hot.slice(0, cap),
    wait: buckets.wait.slice(0, cap),
    good: buckets.good.slice(0, cap),
  }
}

function BucketCard({ meta, rows, onPick }) {
  const border =
    meta.accent === "rose"
      ? "border-rose-500/25"
      : meta.accent === "amber"
        ? "border-amber-500/25"
        : "border-emerald-500/25"

  return (
    <div className={`rounded-xl border bg-black/25 px-3 py-3 ${border}`}>
      <p className="m-0 text-xs font-semibold text-slate-100">{meta.title}</p>
      <p className="m-0 mt-0.5 text-[10px] text-slate-500">{meta.sub}</p>
      <ul className="m-0 mt-3 max-h-[220px] list-none space-y-1.5 overflow-y-auto p-0">
        {rows.length === 0 ? (
          <li className="text-[11px] text-slate-600">해당 구간 종목 없음</li>
        ) : (
          rows.map((row) => (
            <li key={`${row.code}-${row.name}`}>
              <button
                type="button"
                onClick={() => onPick?.(row)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-left transition hover:border-indigo-400/30 hover:bg-indigo-500/10"
              >
                <span className="min-w-0 truncate text-[11px] text-slate-200">
                  {row.name}
                  <span className="ml-1 font-mono text-[9px] text-slate-600">{row.code}</span>
                </span>
                <span
                  className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] ${timingBadgeClass(row.signal.tone)}`}
                >
                  {row.signal.label}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

export default function ValueChainStockSignals({
  sectors,
  finderCandidates = [],
  insightWarnings = [],
  onSelectStock,
}) {
  const buckets = useMemo(() => collectSignalsByTone(sectors), [sectors])
  const picks = useMemo(
    () => (Array.isArray(finderCandidates) ? finderCandidates : []).slice(0, 6),
    [finderCandidates],
  )

  return (
    <section
      id="stock-signals"
      className="scroll-mt-24 rounded-2xl border border-cyan-500/20 bg-[linear-gradient(145deg,rgba(8,14,24,0.95),rgba(6,10,18,0.98))] px-4 py-5 shadow-[0_0_32px_rgba(34,211,238,0.06)] md:px-6"
    >
      <p className="m-0 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-300/85">
        Stock desk · timing
      </p>
      <h2 className="m-0 mt-1 text-base font-semibold text-slate-50 md:text-lg">종목 탐색 · 과열 / 눌림 / 추세 시그널</h2>
      <p className="m-0 mt-1 max-w-2xl text-[11px] leading-relaxed text-slate-500 md:text-xs">
        시장 사이클 확인 후 섹터 맥락에서 종목을 고릅니다. 보조지표는 확인용이며, 핵심은 흐름과 수급입니다.
      </p>

      {insightWarnings?.length ? (
        <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
          <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">시장 경고</p>
          <ul className="m-0 mt-1.5 list-inside list-disc space-y-0.5 text-[11px] text-amber-100/90">
            {insightWarnings.slice(0, 3).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        {CHECKLIST.map((item) => (
          <span
            key={item}
            className="rounded-lg border border-white/[0.08] bg-black/30 px-2 py-2 text-center text-[10px] text-slate-400"
          >
            {item}
          </span>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <BucketCard meta={BUCKET_META.hot} rows={buckets.hot} onPick={onSelectStock} />
        <BucketCard meta={BUCKET_META.wait} rows={buckets.wait} onPick={onSelectStock} />
        <BucketCard meta={BUCKET_META.good} rows={buckets.good} onPick={onSelectStock} />
      </div>

      <div className="mt-6 border-t border-white/[0.06] pt-5">
        <p className="m-0 text-xs font-semibold text-violet-200">추천 · 메모 기반 후보</p>
        <p className="m-0 mt-1 text-[10px] text-slate-500">투자 메모·시그널에서 자동 추출된 관심 종목</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {picks.length === 0 ? (
            <p className="m-0 text-sm text-slate-500 sm:col-span-2">
              후보 데이터 축적 중입니다. AI 리포트·메모를 입력해 주세요.
            </p>
          ) : (
            picks.map((candidate) => (
              <article
                key={candidate.name}
                className="rounded-xl border border-indigo-500/20 bg-[#0b1220]/80 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="m-0 text-sm font-semibold text-slate-100">{candidate.name}</p>
                  <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[9px] text-cyan-200">
                    {candidate.confidence}
                  </span>
                </div>
                <p className="m-0 mt-1 text-[11px] text-cyan-300/90">{candidate.flow}</p>
                <p className="m-0 mt-1 text-[10px] text-slate-400">위험 {candidate.risk}</p>
                <p className="m-0 mt-1 text-[10px] text-slate-500">
                  {(candidate.signals || []).slice(0, 3).join(" · ") || "관찰중"}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(candidate.sectors || []).slice(0, 3).map((sector) => (
                    <span
                      key={sector}
                      className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-1.5 py-0.5 text-[9px] text-indigo-200"
                    >
                      {sector}
                    </span>
                  ))}
                </div>
                <p className="m-0 mt-2 text-[10px] text-slate-600">{candidate.cycleBias}</p>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
