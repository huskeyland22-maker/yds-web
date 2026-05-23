import { useEffect, useId, useState } from "react"

const EXPERT_HINT = "MOVE / SKEW / BofA / GS / VXN"
const DESKTOP_MQ = "(min-width: 1024px)"

/**
 * 모바일: 접힘 기본 · 250ms height 전환
 * 데스크톱(1024px+): 항상 펼침, 기존 섹션 라벨 유지
 *
 * @param {{ children: import("react").ReactNode }} props
 */
export default function PanicExpertMetricsAccordion({ children }) {
  const [open, setOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const panelId = useId()

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ)
    const sync = () => setIsDesktop(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  const expanded = isDesktop || open

  return (
    <div className={`panic-expert-accordion${expanded ? " is-open" : ""}`}>
      <div className="panic-expert-accordion__label-desktop">
        <p className="m-0 border-l-2 border-slate-500/50 pl-2 text-left text-[11px] font-bold tracking-[0.02em] text-slate-300">
          전문가 리스크 지표
        </p>
        <span className="mt-1.5 block h-px w-full bg-white/[0.03]" />
      </div>

      <button
        type="button"
        className="panic-expert-accordion__toggle"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="panic-expert-accordion__toggle-main">
          <span className="panic-expert-accordion__title">전문가 리스크 지표</span>
          <span className="panic-expert-accordion__chevron" aria-hidden>
            {open ? "▲" : "▼"}
          </span>
        </span>
        {!open ? (
          <span className="panic-expert-accordion__hint">{EXPERT_HINT}</span>
        ) : null}
      </button>

      <div
        id={panelId}
        className="panic-expert-accordion__panel"
        role="region"
        aria-label="전문가 리스크 지표"
        aria-hidden={!expanded}
      >
        <div className="panic-expert-accordion__inner">
          <section className="panic-expert-accordion__body">{children}</section>
        </div>
      </div>
    </div>
  )
}
