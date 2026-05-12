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
      className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#0a0c12] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      aria-label="전일 미국시장 브리핑"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(100% 70% at 0% 0%, rgba(99,102,241,0.07), transparent 45%), linear-gradient(180deg, rgba(15,23,42,0.25) 0%, transparent 42%)",
        }}
        aria-hidden
      />

      <div className="relative border-l-[3px] border-indigo-500/50 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="m-0 font-mono text-[9px] font-medium uppercase tracking-[0.2em] text-slate-500">Overnight briefing</p>
            <h2 className="m-0 mt-1.5 text-[15px] font-semibold leading-snug tracking-tight text-slate-50 sm:text-base">
              전일 미국시장 브리핑
            </h2>
            <p className="m-0 mt-1 text-[10px] leading-normal text-slate-600">US close → Asia open 맥락</p>
          </div>
          {updatedLabel ? (
            <p className="m-0 font-mono text-[9px] uppercase tracking-wider text-slate-600">Feed · {updatedLabel} KST</p>
          ) : null}
        </div>

        {loading ? (
          <p className="m-0 mt-5 text-[12px] text-slate-500">시세 로딩 중…</p>
        ) : err ? (
          <p className="m-0 mt-5 text-[12px] text-rose-300/90">{err}</p>
        ) : briefing?.prose ? (
          <>
            <p className="m-0 mt-5 max-w-[68ch] text-[13px] leading-[1.72] tracking-[-0.01em] text-slate-200/95 sm:text-[14px] sm:leading-[1.75]">
              {briefing.prose}
            </p>

            <p className="m-0 mt-6 border-t border-white/[0.06] pt-3 font-mono text-[9px] leading-relaxed text-slate-600">
              Source: Yahoo Finance · 내부 규칙 기반 리캡 · 참고용
            </p>
          </>
        ) : null}
      </div>
    </section>
  )
}
