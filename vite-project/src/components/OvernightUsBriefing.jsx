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

  const proseParts = useMemo(() => {
    const p = briefing?.prose?.trim()
    if (!p) return { lead: "", rest: "" }
    const idx = p.indexOf(". ")
    if (idx < 0) return { lead: p, rest: "" }
    return { lead: p.slice(0, idx + 1), rest: p.slice(idx + 2).trim() }
  }, [briefing?.prose])

  return (
    <section
      className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#080a10] shadow-[0_0_0_1px_rgba(99,102,241,0.05),inset_0_1px_0_rgba(255,255,255,0.04)]"
      aria-label="전일 미국시장 브리핑"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(110% 65% at 0% 0%, rgba(99,102,241,0.09), transparent 48%), linear-gradient(185deg, rgba(15,23,42,0.35) 0%, transparent 46%)",
        }}
        aria-hidden
      />

      <div className="relative border-l-[3px] border-indigo-500/45 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="m-0 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Overnight market briefing
            </p>
            <h2 className="m-0 mt-1.5 font-display text-[16px] font-semibold leading-snug tracking-tight text-slate-50 sm:text-[17px]">
              전일 미국시장 브리핑
            </h2>
            <p className="m-0 mt-1 text-[10px] leading-normal text-slate-600">
              미국 마감 흐름을 아시아 개장 전 데스크 노트 톤으로 정리한다.
            </p>
          </div>
          {updatedLabel ? (
            <p className="m-0 font-mono text-[8px] uppercase tracking-wider text-slate-700">Feed · {updatedLabel} KST</p>
          ) : null}
        </div>

        {loading ? (
          <p className="m-0 mt-5 text-[12px] text-slate-500">시세 로딩 중…</p>
        ) : err ? (
          <p className="m-0 mt-5 text-[12px] text-rose-300/90">{err}</p>
        ) : briefing?.prose ? (
          <>
            {proseParts.lead ? (
              <p className="m-0 mt-5 max-w-[70ch] text-[14px] font-medium leading-[1.68] text-slate-100/95 sm:text-[15px] sm:leading-[1.7]">
                {proseParts.lead}
              </p>
            ) : null}
            {proseParts.rest ? (
              <p className="m-0 mt-3 max-w-[70ch] text-[13px] leading-[1.75] text-slate-300/95 sm:text-[14px] sm:leading-[1.78]">
                {proseParts.rest}
              </p>
            ) : null}

            <p className="m-0 mt-6 border-t border-white/[0.06] pt-3 font-mono text-[8px] leading-relaxed text-slate-700">
              Source: Yahoo Finance · 규칙 기반 리캡 · 참고용
            </p>
          </>
        ) : null}
      </div>
    </section>
  )
}
