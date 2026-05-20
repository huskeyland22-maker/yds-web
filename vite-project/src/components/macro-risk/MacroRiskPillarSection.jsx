import { scoreEmoji } from "../../macro-risk/seriesMath.js"
import { scoreBarClass, scoreRingClass, scoreTextClass } from "../../macro-risk/macroRiskUiTone.js"

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
  const barCls = scoreBarClass(pillar.score)
  const ringCls = scoreRingClass(pillar.score)
  const badge = statusBadgeLine(pillar)

  return (
    <article
      className={[
        "macro-risk-pillar trading-card-shell flex min-h-0 flex-col px-4 py-4",
        accent,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[11px] font-semibold leading-snug text-slate-200">{pillar.title}</p>
          <p className="m-0 mt-1 line-clamp-1 rounded-md border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-slate-200">
            {badge}
          </p>
          <p
            className={`m-0 mt-1.5 font-mono text-[1.75rem] font-bold tabular-nums leading-none sm:text-[2rem] ${scoreTextClass(pillar.score)}`}
          >
            {pillar.score}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${barCls}`}
              style={{ width: `${Math.min(100, Math.max(0, pillar.score))}%` }}
            />
          </div>
        </div>
        <PillarRing score={pillar.score} accentClass={ringCls} emoji={scoreEmoji(pillar.score)} />
      </div>
    </article>
  )
}

/**
 * @param {{ score: number; accentClass: string; emoji: string }} props
 */
function PillarRing({ score, accentClass, emoji }) {
  const s = Math.min(100, Math.max(0, Number(score) || 0))
  const r = 12
  const c = 2 * Math.PI * r
  const dash = (s / 100) * c
  const gap = c - dash
  return (
    <div className="relative h-8 w-8 shrink-0">
      <svg className="-rotate-90" width="32" height="32" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r={r} fill="none" className="text-white/[0.08]" stroke="currentColor" strokeWidth="3" />
        <circle
          cx="16"
          cy="16"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          className={accentClass}
        />
      </svg>
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[8px]" aria-hidden>
        {emoji}
      </span>
    </div>
  )
}

/**
 * @param {import("../../macro-risk/pillars.js").ReturnType<import("../../macro-risk/pillars.js").scoreRatePressure>} pillar
 */
function statusBadgeLine(pillar) {
  if (pillar.id === "rate") return pillar.status
  if (pillar.id === "inflation") {
    if (/재가속/.test(pillar.status)) return "재가속 우려"
    if (/기대인플/.test(pillar.status)) return "기대인플 상방"
    return pillar.status.length > 14 ? pillar.status.slice(0, 14) : pillar.status
  }
  const dxy = pillar.lines.find((l) => l.label === "달러")
  if (dxy?.text === "강세") return "달러 강세"
  return pillar.status.length > 12 ? pillar.status.slice(0, 12) : pillar.status
}
