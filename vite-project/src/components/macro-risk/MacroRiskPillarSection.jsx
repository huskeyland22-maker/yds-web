import { scoreEmoji } from "../../macro-risk/seriesMath.js"

const ACCENT = {
  rate: "macro-risk-pillar--rate",
  inflation: "macro-risk-pillar--inflation",
  liquidity: "macro-risk-pillar--liquidity",
}

/**
 * @param {{ pillar: import("../../macro-risk/pillars.js").ReturnType<import("../../macro-risk/pillars.js").scoreRatePressure> }} props
 */
export default function MacroRiskPillarSection({ pillar }) {
  const accent = ACCENT[pillar.id] ?? ""
  return (
    <article
      className={[
        "macro-risk-pillar trading-card-shell flex h-full flex-col px-[18px] py-5 sm:px-6 sm:py-6",
        accent,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="m-0 text-[12px] font-semibold leading-snug text-slate-200 sm:text-[13px]">{pillar.title}</p>
        <p className="m-0 shrink-0 text-right font-mono text-[1.35rem] font-bold tabular-nums leading-none text-slate-50 sm:text-[1.45rem]">
          {pillar.score}
          <span className="ml-1 text-[12px]" aria-hidden>
            {scoreEmoji(pillar.score)}
          </span>
        </p>
      </div>
      <ul className="m-0 mt-4 flex min-h-0 flex-1 flex-col gap-2 list-none p-0">
        {pillar.lines.map((line) => (
          <li key={line.label} className="flex gap-2 text-[11px] leading-relaxed text-slate-300">
            <span className="shrink-0 font-semibold text-slate-500">{line.label}</span>
            <span className="min-w-0">{line.text}</span>
          </li>
        ))}
      </ul>
      <p className="m-0 mt-5 border-t border-white/[0.06] pt-4 text-[11px] font-medium leading-snug text-cyan-200/90">
        상태: {pillar.status}
      </p>
    </article>
  )
}
