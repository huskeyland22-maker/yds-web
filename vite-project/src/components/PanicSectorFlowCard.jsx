import { useMemo } from "react"
import { Link } from "react-router-dom"
import { sectorFlowFromPanic } from "../utils/sectorScoreEngine.js"
import { buildValueChainSectorUrl, sectorFlowStocks } from "../utils/sectorFlowNav.js"

const BUCKET_META = {
  leader: { title: "주도", accent: "text-emerald-300", chip: "border-emerald-500/35 bg-emerald-500/10 text-emerald-100" },
  watch: { title: "관찰", accent: "text-sky-300", chip: "border-sky-500/30 bg-sky-500/10 text-sky-100" },
  avoid: { title: "회피", accent: "text-rose-300", chip: "border-rose-500/30 bg-rose-500/10 text-rose-100/90" },
}

/**
 * @param {{
 *   panicData: object | null
 *   marketState?: { stateKey?: string; label?: string }
 * }} props
 */
export default function PanicSectorFlowCard({ panicData, marketState }) {
  const flow = useMemo(
    () => sectorFlowFromPanic(panicData, marketState),
    [panicData, marketState],
  )

  const buckets = useMemo(
    () => [
      { id: "leader", items: flow.leaderSector },
      { id: "watch", items: flow.watchSector },
      { id: "avoid", items: flow.avoidSector },
    ],
    [flow],
  )

  const allChips = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const b of buckets) {
      for (const s of b.items) {
        if (seen.has(s.id)) continue
        seen.add(s.id)
        out.push(s)
      }
    }
    return out
  }, [buckets])

  if (!panicData) {
    return (
      <section className="trading-card-shell px-3 py-3">
        <p className="m-0 text-[10px] text-slate-500">패닉 데이터 동기화 후 섹터 흐름이 표시됩니다.</p>
      </section>
    )
  }

  return (
    <section className="trading-card-shell overflow-hidden px-2.5 py-2.5 sm:px-3" aria-label="시장 섹터 흐름">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="m-0 text-[9px] font-semibold tracking-[0.14em] text-slate-500">MARKET FLOW</p>
          <h3 className="m-0 mt-0.5 text-[14px] font-bold text-slate-50">시장 → 섹터 흐름</h3>
        </div>
        <p className="m-0 text-right text-[9px] leading-snug text-slate-500">
          {flow.marketStateLabel}
          <br />
          심리 {flow.marketMoodLabel}
        </p>
      </div>

      <div className="panic-sector-chip-scroll mt-2 flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
        {allChips.map((s) => (
          <Link
            key={s.id}
            to={buildValueChainSectorUrl(s.id)}
            className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-slate-200"
          >
            {s.shortLabel}
          </Link>
        ))}
      </div>

      <div className="mt-2 space-y-2">
        {buckets.map((bucket) => {
          const meta = BUCKET_META[bucket.id]
          if (!bucket.items.length) return null
          return (
            <div key={bucket.id}>
              <p className={`m-0 text-[9px] font-bold tracking-wide ${meta.accent}`}>{meta.title}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {bucket.items.map((s) => (
                  <Link
                    key={s.id}
                    to={buildValueChainSectorUrl(s.id)}
                    className={[
                      "rounded-md border px-2 py-1 text-[10px] font-semibold transition hover:brightness-110",
                      meta.chip,
                    ].join(" ")}
                    title={s.reasons.join(" · ") || s.label}
                  >
                    {s.shortLabel}
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {flow.leaderSector[0] ? (
        <div className="mt-2.5 border-t border-white/[0.06] pt-2">
          <p className="m-0 text-[9px] font-semibold text-slate-500">
            {flow.leaderSector[0].shortLabel} 연결 종목
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {sectorFlowStocks(flow.leaderSector[0].id).map((st) => (
              <Link
                key={st.code}
                to={buildValueChainSectorUrl(flow.leaderSector[0].id, { stockCode: st.code })}
                className="rounded border border-white/[0.08] bg-black/25 px-2 py-1 text-[9px] text-slate-300 hover:border-cyan-500/30 hover:text-cyan-100"
              >
                {st.name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <p className="m-0 mt-2 text-[8px] text-slate-600">
        섹터·종목 탭 → 코리아 밸류체인 · V2: 매매 신호 연동 예정
      </p>
    </section>
  )
}
