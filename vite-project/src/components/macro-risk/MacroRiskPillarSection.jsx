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
    <article className={["macro-risk-pillar trading-card-shell px-3 py-2.5 sm:px-3.5 sm:py-3", accent].filter(Boolean).join(" ")}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="m-0 text-[12px] font-semibold text-slate-200">{pillar.title}</p>
        <p className="m-0 font-mono text-[1.35rem] font-bold tabular-nums text-slate-50">
          {pillar.score}
          <span className="ml-1 text-[12px]" aria-hidden>
            {scoreEmoji(pillar.score)}
          </span>
        </p>
      </div>
      <ul className="m-0 mt-2 list-none space-y-1 p-0">
        {pillar.lines.map((line) => (
          <li key={line.label} className="flex gap-2 text-[11px] leading-snug text-slate-300">
            <span className="shrink-0 font-semibold text-slate-500">{line.label}</span>
            <span className="min-w-0">{line.text}</span>
          </li>
        ))}
      </ul>
      <p className="m-0 mt-2 border-t border-white/[0.06] pt-2 text-[11px] font-medium text-cyan-200/90">
        상태: {pillar.status}
      </p>
    </article>
  )
}
