import { scoreBarClass, scoreTextClass } from "../../macro-risk/macroRiskUiTone.js"

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
  const badge = statusBadgeLine(pillar)
  const hoverDetail = pillar.lines.map((l) => `${l.label} ${l.text}`).join(" · ")

  return (
    <article
      title={hoverDetail || undefined}
      className={[
        "macro-risk-pillar trading-card-shell flex flex-col justify-between overflow-hidden",
        accent,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="m-0 text-[10px] font-semibold text-slate-300">{pillar.title}</p>
        <p
          className={`m-0 font-mono text-[1.35rem] font-bold tabular-nums leading-none ${scoreTextClass(pillar.score)}`}
        >
          {pillar.score}
        </p>
      </div>

      <p className="m-0 line-clamp-1 text-[10px] font-semibold text-slate-200">{badge}</p>

      <div className="h-1 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barCls}`}
          style={{ width: `${Math.min(100, Math.max(0, pillar.score))}%` }}
        />
      </div>

    </article>
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
