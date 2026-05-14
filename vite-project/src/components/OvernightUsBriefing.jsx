import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { fetchMarketData } from "../config/api.js"
import {
  formatAgeKorean,
  formatNySessionDate,
  formatRelativeKst,
  msUntilNextKst8am,
} from "../utils/macroBriefingKst.js"
import { buildInstitutionalMacroBriefing } from "../utils/overnightUsBriefing.js"

const BC_NAME = "yds-macro-briefing"

function fmtChgLine(chg) {
  if (chg == null || !Number.isFinite(Number(chg))) return "—"
  const v = Number(chg)
  const sign = v > 0 ? "+" : ""
  return `${sign}${v.toFixed(2)}%`
}

function sentimentPillClass(s) {
  if (s === "risk-on") return "border-emerald-500/35 bg-emerald-500/[0.12] text-emerald-200/95 shadow-[0_0_16px_rgba(52,211,153,0.18)]"
  if (s === "risk-off") return "border-amber-500/40 bg-amber-500/[0.1] text-amber-100/95 shadow-[0_0_16px_rgba(251,191,36,0.14)]"
  return "border-cyan-500/30 bg-cyan-500/[0.08] text-cyan-100/90 shadow-[0_0_14px_rgba(34,211,238,0.12)]"
}

/**
 * @param {{ panicData?: object | null }} props
 */
export default function OvernightUsBriefing({ panicData = null }) {
  const [payload, setPayload] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchedAt, setFetchedAt] = useState(null)
  const [aiLines, setAiLines] = useState(null)
  const [aiMeta, setAiMeta] = useState({ used: false, error: null })
  const bcRef = useRef(null)
  const lastKst8KeyRef = useRef("")
  /** 같은 탭이 보낸 BC 메시지는 무시 (postMessage가 자기 자신에게도 전달됨 → load 무한 루프 방지) */
  const bcTabIdRef = useRef(`tb-${Math.random().toString(36).slice(2, 11)}`)
  /** 패닉 스토어가 자주 새 객체를 넣어도 load 콜백 ID가 바뀌지 않도록 최신만 유지 */
  const panicDataRef = useRef(panicData)
  panicDataRef.current = panicData

  const useAiClient = import.meta.env.VITE_MACRO_BRIEFING_AI === "1" || import.meta.env.VITE_MACRO_BRIEFING_AI === "true"

  const load = useCallback(async (opts = {}) => {
    const silent = Boolean(opts.silent)
    if (!silent) {
      setLoading(true)
      setErr(null)
    }
    try {
      const data = await fetchMarketData()
      const base = {
        parsedData: data.parsedData ?? {},
        changeData: data.changeData ?? {},
        updatedAt: data.updatedAt ?? null,
        panicData: panicDataRef.current,
      }
      setPayload(base)
      setFetchedAt(Date.now())
      if (silent) setErr(null)

      const desk = buildInstitutionalMacroBriefing(base)
      setAiLines(null)
      setAiMeta({ used: false, error: null })

      if (useAiClient) {
        try {
          const facts = {
            nySession: formatNySessionDate(data.updatedAt),
            sentiment: desk.sentiment,
            ticks: desk.ticks,
            ruleBullets: desk.bullets,
            composite: desk.composite,
            updatedAt: data.updatedAt,
          }
          const res = await fetch("/api/macro-briefing-ai", {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ facts }),
          })
          const j = await res.json().catch(() => ({}))
          if (Array.isArray(j.lines) && j.lines.length) {
            setAiLines(j.lines)
            setAiMeta({ used: Boolean(j.usedAi), error: j.error ?? null })
          } else {
            setAiMeta({ used: false, error: j.error ?? null })
          }
        } catch (aiErr) {
          setAiMeta({ used: false, error: aiErr instanceof Error ? aiErr.message : "ai" })
        }
      }

      try {
        bcRef.current?.postMessage({
          type: "macro-briefing-refresh",
          t: Date.now(),
          from: bcTabIdRef.current,
        })
      } catch {
        /* ignore */
      }
    } catch (e) {
      if (!silent) setErr(e instanceof Error ? e.message : "load failed")
      setPayload(null)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [useAiClient])

  useEffect(() => {
    void load({ silent: false })
  }, [load])

  useEffect(() => {
    const poll = window.setInterval(() => void load({ silent: true }), 12 * 60 * 1000)
    const kst8 = window.setInterval(() => {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(new Date())
      const y = parts.find((p) => p.type === "year")?.value
      const mo = parts.find((p) => p.type === "month")?.value
      const da = parts.find((p) => p.type === "day")?.value
      const h = Number(parts.find((p) => p.type === "hour")?.value)
      const m = Number(parts.find((p) => p.type === "minute")?.value)
      const hm = h * 60 + m
      const key = `${y}-${mo}-${da}`
      if (hm >= 8 * 60 && hm < 8 * 60 + 6 && lastKst8KeyRef.current !== key) {
        lastKst8KeyRef.current = key
        void load({ silent: true })
      }
    }, 60 * 1000)

    const idBoot = window.setTimeout(() => void load({ silent: true }), msUntilNextKst8am())

    const onVis = () => {
      if (document.visibilityState === "visible") void load({ silent: true })
    }
    const onFocus = () => void load({ silent: true })
    document.addEventListener("visibilitychange", onVis)
    window.addEventListener("focus", onFocus)
    let bc = null
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel(BC_NAME)
        bcRef.current = bc
        bc.onmessage = (ev) => {
          if (ev?.data?.from === bcTabIdRef.current) return
          void load({ silent: true })
        }
      }
    } catch {
      /* ignore */
    }
    return () => {
      window.clearInterval(poll)
      window.clearInterval(kst8)
      window.clearTimeout(idBoot)
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("focus", onFocus)
      try {
        bc?.close()
      } catch {
        /* ignore */
      }
    }
  }, [load])

  const briefing = useMemo(() => {
    if (!payload) return null
    return buildInstitutionalMacroBriefing({
      parsedData: payload.parsedData,
      changeData: payload.changeData,
      updatedAt: payload.updatedAt,
      panicData: panicDataRef.current,
    })
  }, [payload, panicData])

  const displayBullets = useMemo(() => {
    if (aiLines?.length) return aiLines
    return briefing?.bullets ?? []
  }, [aiLines, briefing?.bullets])

  const nyDate = formatNySessionDate(payload?.updatedAt)
  const feedKst = formatRelativeKst(fetchedAt ?? undefined)
  const ageLabel = formatAgeKorean(fetchedAt ?? NaN)

  return (
    <section
      className="relative overflow-hidden rounded-xl border border-white/[0.09] bg-[#060910] shadow-[0_0_0_1px_rgba(34,211,238,0.06),inset_0_1px_0_rgba(255,255,255,0.05),0_20px_56px_rgba(0,0,0,0.45)]"
      aria-label="Institutional macro briefing"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-95"
        style={{
          background:
            "radial-gradient(120% 70% at 0% 0%, rgba(34,211,238,0.07), transparent 50%), radial-gradient(90% 55% at 100% 0%, rgba(99,102,241,0.06), transparent 45%), linear-gradient(185deg, rgba(15,23,42,0.4) 0%, transparent 50%)",
        }}
        aria-hidden
      />

      <div className="relative border-l-[3px] border-cyan-500/50 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="m-0 font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Institutional macro briefing
            </p>
            <h2 className="m-0 mt-1.5 font-display text-[16px] font-semibold leading-snug tracking-tight text-slate-50 sm:text-[17px]">
              전일 미국장 · 매크로 데스크 노트
            </h2>
            <p className="m-0 mt-1 max-w-[62ch] text-[10px] leading-normal text-slate-600">
              나스닥·S&P·SOXX·VIX·금리·달러·원화. Yahoo 실시간 피드 + 패닉 보드 합성. KST 08:00·주기 갱신.
            </p>
          </div>
          <div className="flex flex-shrink-0 flex-col items-end gap-2">
            {briefing ? (
              <span
                className={`inline-flex items-center rounded-md border px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.18em] ${sentimentPillClass(briefing.sentiment)}`}
              >
                {briefing.sentimentLabel}
              </span>
            ) : null}
            <div className="text-right font-mono text-[8px] uppercase leading-relaxed tracking-wider text-slate-600">
              {nyDate ? <p className="m-0">REF · NY {nyDate}</p> : null}
              {feedKst ? <p className="m-0">PULLED · {feedKst} KST</p> : null}
              {ageLabel ? <p className="m-0 text-cyan-600/90">LIVE · {ageLabel}</p> : null}
              {aiMeta.used ? (
                <p className="m-0 text-emerald-600/90">AI · ON</p>
              ) : useAiClient ? (
                <p className="m-0 text-slate-700">AI · RULE FALLBACK</p>
              ) : null}
            </div>
          </div>
        </div>

        {briefing?.ticks?.length ? (
          <div className="mt-4 flex flex-wrap gap-2 border-y border-white/[0.05] py-3">
            {briefing.ticks.map((t) => (
              <div
                key={t.key}
                className="min-w-[7.5rem] flex-1 rounded-md border border-white/[0.06] bg-black/30 px-2.5 py-1.5 sm:min-w-0 sm:flex-1"
              >
                <p className="m-0 font-mono text-[8px] font-semibold uppercase tracking-wider text-slate-600">{t.label}</p>
                <p
                  className={`m-0 mt-0.5 font-mono text-[12px] font-semibold tabular-nums ${
                    t.chg == null
                      ? "text-slate-600"
                      : t.chg > 0
                        ? "text-emerald-300/95"
                        : t.chg < 0
                          ? "text-rose-300/95"
                          : "text-slate-300"
                  }`}
                >
                  {fmtChgLine(t.chg)}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {loading ? (
          <p className="m-0 mt-5 text-[12px] text-slate-500">피드 동기화 중…</p>
        ) : err ? (
          <p className="m-0 mt-5 text-[12px] text-rose-300/90">{err}</p>
        ) : displayBullets.length ? (
          <>
            <ul className="m-0 mt-4 list-none space-y-2.5 p-0">
              {displayBullets.map((line) => (
                <li
                  key={line}
                  className="relative pl-3 text-[12.5px] leading-snug text-slate-200/95 before:absolute before:left-0 before:top-[0.45em] before:h-1.5 before:w-1 before:rounded-sm before:bg-cyan-400/55 sm:text-[13px]"
                >
                  {line}
                </li>
              ))}
            </ul>
            <p className="m-0 mt-5 border-t border-white/[0.06] pt-3 font-mono text-[8px] leading-relaxed text-slate-700">
              Source · Yahoo Finance (query1) · no-store · PWA 동일 피드. Desk rules + optional OpenAI.
            </p>
          </>
        ) : null}
      </div>
    </section>
  )
}
