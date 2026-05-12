import { useCallback, useEffect, useMemo, useState } from "react"
import { fetchMarketData } from "../config/api.js"
import { buildOvernightUsBriefing } from "../utils/overnightUsBriefing.js"

function formatUpdated(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export default function OvernightUsBriefing() {
  const [payload, setPayload] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const data = await fetchMarketData()
      setPayload({
        parsedData: data.parsedData ?? {},
        changeData: data.changeData ?? {},
        updatedAt: data.updatedAt ?? null,
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : "load failed")
      setPayload(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const briefing = useMemo(() => {
    if (!payload) return null
    return buildOvernightUsBriefing(payload)
  }, [payload])

  const updatedLabel = formatUpdated(payload?.updatedAt)

  return (
    <section
      className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#060a10] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_20px_50px_rgba(0,0,0,0.35)]"
      aria-label="전일 미국시장 브리핑"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(120% 80% at 100% 0%, rgba(56,189,248,0.06), transparent 50%), linear-gradient(180deg, rgba(15,23,42,0.35) 0%, transparent 45%)",
        }}
        aria-hidden
      />

      <div className="relative border-l-[3px] border-sky-500/45 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="m-0 text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">Overnight Market Briefing</p>
            <h2 className="m-0 mt-2 text-base font-semibold tracking-tight text-slate-100 sm:text-lg">전일 미국시장 브리핑</h2>
          </div>
          {updatedLabel ? (
            <p className="m-0 font-mono text-[9px] uppercase tracking-wider text-slate-600">Feed · {updatedLabel} KST</p>
          ) : null}
        </div>

        {loading ? (
          <p className="m-0 mt-6 text-[13px] text-slate-500">시세 로딩 중…</p>
        ) : err ? (
          <p className="m-0 mt-6 text-[13px] text-rose-300/90">{err}</p>
        ) : briefing ? (
          <>
            {briefing.chips.length ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {briefing.chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium tracking-wide text-slate-300"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-6 space-y-6">
              <div>
                <p className="m-0 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600">1 · 미국시장 요약</p>
                <p className="m-0 mt-2 text-[13px] leading-[1.65] text-slate-200 sm:text-[14px]">{briefing.usMarket}</p>
              </div>
              <div>
                <p className="m-0 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600">2 · 금리 / 달러 / 변동성</p>
                <p className="m-0 mt-2 text-[13px] leading-[1.65] text-slate-200 sm:text-[14px]">{briefing.ratesFxVol}</p>
              </div>
              <div>
                <p className="m-0 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600">3 · 섹터 강약</p>
                <p className="m-0 mt-2 text-[13px] leading-[1.65] text-slate-200 sm:text-[14px]">{briefing.sector}</p>
              </div>
              <div>
                <p className="m-0 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600">4 · 오늘 체크포인트</p>
                <ul className="m-0 mt-2 list-none space-y-2 p-0">
                  {briefing.checkpoints.map((line) => (
                    <li key={line} className="relative pl-3.5 text-[13px] leading-[1.6] text-slate-300 sm:text-[14px]">
                      <span className="absolute left-0 top-[0.55em] h-1 w-1 rounded-full bg-sky-400/70" aria-hidden />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="m-0 mt-6 border-t border-white/[0.05] pt-4 text-[10px] leading-relaxed text-slate-600">
              출처: Yahoo Finance 시세(지수·VIX·금리·환율·SOXX). 해석은 규칙 기반 자동 생성이며 투자 권유가 아니다.
            </p>
          </>
        ) : null}
      </div>
    </section>
  )
}
