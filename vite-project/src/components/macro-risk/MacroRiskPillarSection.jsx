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
  const narrative = buildNarrative(pillar)

  return (
    <article
      className={[
        "macro-risk-pillar trading-card-shell flex min-h-0 flex-col px-3 py-3 sm:px-4 sm:py-3.5",
        accent,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 text-[12px] font-semibold leading-snug text-slate-100 sm:text-[13px]">{pillar.title}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${barCls}`}
              style={{ width: `${Math.min(100, Math.max(0, pillar.score))}%` }}
            />
          </div>
        </div>
        <PillarRing score={pillar.score} accentClass={ringCls} emoji={scoreEmoji(pillar.score)} />
      </div>

      <p className={`m-0 mt-2 font-mono text-[1.5rem] font-bold tabular-nums leading-none ${scoreTextClass(pillar.score)}`}>
        {pillar.score}
      </p>

      <div className="mt-3 space-y-0 border-y border-white/[0.05] py-3">
        <p className="m-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500">상태</p>
        <ul className="m-0 mt-1 flex list-none flex-col gap-1.5 p-0">
          {narrative.map((line, i) => (
            <li key={i} className="flex gap-2 text-[11px] leading-snug text-slate-300">
              <span className="shrink-0 text-slate-600" aria-hidden>
                ·
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="m-0 mt-3 border-t border-dashed border-white/[0.08] pt-3 text-[10px] text-slate-500">
        {pillar.lines.slice(0, 4).map((line) => (
          <span key={line.label} className="mr-3 inline-block">
            <span className="font-semibold text-slate-500">{line.label}</span> {line.text}
          </span>
        ))}
      </p>
    </article>
  )
}

/**
 * @param {{ score: number; accentClass: string; emoji: string }} props
 */
function PillarRing({ score, accentClass, emoji }) {
  const s = Math.min(100, Math.max(0, Number(score) || 0))
  const r = 22
  const c = 2 * Math.PI * r
  const dash = (s / 100) * c
  const gap = c - dash
  return (
    <div className="relative h-[52px] w-[52px] shrink-0">
      <svg className="-rotate-90" width="52" height="52" viewBox="0 0 52 52" aria-hidden>
        <circle cx="26" cy="26" r={r} fill="none" className="text-white/[0.08]" stroke="currentColor" strokeWidth="5" />
        <circle
          cx="26"
          cy="26"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          className={accentClass}
        />
      </svg>
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px]" aria-hidden>
        {emoji}
      </span>
    </div>
  )
}

/**
 * OS 스타일 짧은 서술 (지표 카드와 중복 최소화).
 * @param {import("../../macro-risk/pillars.js").ReturnType<import("../../macro-risk/pillars.js").scoreRatePressure>} pillar
 */
function buildNarrative(pillar) {
  if (pillar.id === "rate") {
    return [
      pillar.status,
      "장기금리·실질금리 방향을 함께 봅니다.",
      "MOVE 상승은 고정·성장주 베타를 압박합니다.",
    ]
  }
  if (pillar.id === "inflation") {
    return [
      pillar.status,
      "BEI·장기물이 동반 상방이면 인플레 리스크가 길어집니다.",
      "Core·PCE는 후행이므로 방향만 확인합니다.",
    ]
  }
  return [pillar.status, "달러·QT·유동성 축소가 리스크 자산에 전달됩니다.", "MOVE·VXN은 변동성 통로로 해석합니다."]
}
