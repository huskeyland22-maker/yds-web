import { useMemo } from "react"
import {
  Activity,
  BarChart3,
  LineChart,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react"
import {
  actionModeBadgeClass,
  computeMarketAction,
  marketTemperatureBarClass,
  regimeToneClass,
} from "../utils/panicMarketActionEngine.js"

/** @type {Record<string, { chip: string; hover: string }>} */
const SECTOR_CHIP_STYLES = {
  AI: {
    chip: "border-violet-500/35 bg-violet-500/[0.12] text-violet-200",
    hover: "hover:border-violet-400/50 hover:bg-violet-500/20 hover:shadow-[0_0_12px_rgba(139,92,246,0.15)]",
  },
  반도체: {
    chip: "border-cyan-500/35 bg-cyan-500/[0.12] text-cyan-200",
    hover: "hover:border-cyan-400/50 hover:bg-cyan-500/20 hover:shadow-[0_0_12px_rgba(34,211,238,0.15)]",
  },
  성장주: {
    chip: "border-sky-500/35 bg-sky-500/[0.12] text-sky-200",
    hover: "hover:border-sky-400/50 hover:bg-sky-500/20",
  },
  사이클: {
    chip: "border-amber-500/35 bg-amber-500/[0.12] text-amber-200",
    hover: "hover:border-amber-400/50 hover:bg-amber-500/20",
  },
  대형주: {
    chip: "border-slate-400/30 bg-slate-500/[0.12] text-slate-200",
    hover: "hover:border-slate-300/45 hover:bg-slate-500/18",
  },
  ETF: {
    chip: "border-blue-500/30 bg-blue-500/[0.10] text-blue-200",
    hover: "hover:border-blue-400/45 hover:bg-blue-500/16",
  },
  현금: {
    chip: "border-emerald-500/30 bg-emerald-500/[0.10] text-emerald-200",
    hover: "hover:border-emerald-400/45 hover:bg-emerald-500/16",
  },
  채권: {
    chip: "border-teal-500/30 bg-teal-500/[0.10] text-teal-200",
    hover: "hover:border-teal-400/45 hover:bg-teal-500/16",
  },
  방어주: {
    chip: "border-rose-500/30 bg-rose-500/[0.10] text-rose-200",
    hover: "hover:border-rose-400/45 hover:bg-rose-500/16",
  },
  "방어 섹터 일부": {
    chip: "border-rose-500/25 bg-rose-500/[0.08] text-rose-200/90",
    hover: "hover:border-rose-400/40 hover:bg-rose-500/14",
  },
  배당: {
    chip: "border-indigo-500/30 bg-indigo-500/[0.10] text-indigo-200",
    hover: "hover:border-indigo-400/45 hover:bg-indigo-500/16",
  },
  필수소비재: {
    chip: "border-lime-500/25 bg-lime-500/[0.08] text-lime-200/90",
    hover: "hover:border-lime-400/40 hover:bg-lime-500/14",
  },
  "핵심 섹터 분산": {
    chip: "border-slate-400/25 bg-white/[0.04] text-slate-300",
    hover: "hover:border-slate-300/40 hover:bg-white/[0.07]",
  },
}

const DEFAULT_CHIP = {
  chip: "border-white/[0.10] bg-white/[0.04] text-slate-300",
  hover: "hover:border-white/20 hover:bg-white/[0.08]",
}

/** @param {import("../utils/panicMarketActionEngine.js").MarketActionGuide} guide */
function buildStrategyRows(guide) {
  const modeLabel =
    guide.actionMode === "Risk-on"
      ? "위험 선호"
      : guide.actionMode === "Risk-off"
        ? "방어 우선"
        : "균형 유지"

  const shortCompact = guide.shortTerm
    .replace(/눌림 매수 가능/g, "눌림")
    .replace(/매수 가능/g, "눌림")
    .replace(/,.*$/, "")
    .trim()
    .slice(0, 8)
  const midCompact = guide.midTerm
    .replace(/비중 확대 가능/g, "확대")
    .replace(/ 가능/g, "")
    .trim()
    .slice(0, 8)
  const longCompact = guide.longTerm
    .replace(/추세 추종 유효/g, "추세")
    .replace(/과열 전 — /g, "")
    .trim()
    .slice(0, 8)

  return [
    { Icon: TrendingUp, label: modeLabel, accent: true },
    { Icon: Target, label: guide.strategyThesis, accent: true },
    { Icon: Zap, label: `단기 ${shortCompact}` },
    { Icon: BarChart3, label: `중기 ${midCompact}` },
    { Icon: LineChart, label: `장기 ${longCompact}` },
  ]
}

/**
 * @param {{ panicData?: object | null }} props
 */
export default function PanicMarketActionPanel({ panicData = null }) {
  const guide = useMemo(() => computeMarketAction(panicData), [panicData])
  const strategyRows = useMemo(() => (guide ? buildStrategyRows(guide) : []), [guide])

  if (!guide) {
    return (
      <div className="border-t border-white/[0.06] px-3 py-2.5">
        <p className="m-0 text-[10px] text-slate-500">
          9대 지표 중 3개 이상 입력 시 시장 행동 가이드가 표시됩니다.
        </p>
      </div>
    )
  }

  const temp = guide.marketTemperature

  return (
    <div className="border-t border-white/[0.06] px-2 py-2.5 sm:px-2.5 sm:py-3">
      <p className="m-0 mb-2.5 border-l-2 border-cyan-400/40 pl-2 text-left text-[11px] font-bold tracking-[0.02em] text-slate-300">
        시장 액션
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2.5">
        <article className="rounded-md border border-white/[0.08] bg-[#070a10] px-2.5 py-2.5">
          <p className="m-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500">시장 상태</p>
          <p className={`m-0 mt-1.5 text-[16px] font-bold leading-tight ${regimeToneClass(guide.regime)}`}>
            {guide.regimeLabel}
          </p>
          <span
            className={[
              "mt-1.5 inline-block rounded border px-1.5 py-px text-[10px] font-bold",
              actionModeBadgeClass(guide.actionMode),
            ].join(" ")}
          >
            {guide.actionMode}
          </span>

          <div className="mt-3 border-t border-white/[0.06] pt-2.5">
            <div className="mb-1 flex items-center justify-between">
              <p className="m-0 flex items-center gap-1 text-[8px] font-semibold uppercase tracking-wide text-slate-500">
                <Activity size={10} className="text-slate-500" />
                시장 온도
              </p>
              <span className={`font-mono text-[15px] font-bold tabular-nums ${regimeToneClass(guide.regime)}`}>
                {temp}
              </span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-gradient-to-r from-rose-600/50 via-slate-500/35 to-cyan-500/55">
<div
                className={[
                  "absolute top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-white/90 shadow-md",
                  marketTemperatureBarClass(temp),
                ].join(" ")}
                style={{ left: `calc(${Math.max(4, Math.min(96, temp))}% - 7px)` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[8px] text-slate-600">
              <span>0 공포</span>
              <span>100 탐욕</span>
            </div>
          </div>
        </article>

        <article className="rounded-md border border-white/[0.08] bg-[#070a10] px-2.5 py-2.5">
          <p className="m-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500">행동 전략</p>
          <ul className="m-0 mt-2 list-none space-y-1.5 p-0">
            {strategyRows.map(({ Icon, label, accent }) => (
              <li key={label} className="flex items-start gap-2">
                <span
                  className={[
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                    accent
                      ? "border-cyan-500/25 bg-cyan-500/10 text-cyan-300"
                      : "border-white/[0.08] bg-white/[0.03] text-slate-400",
                  ].join(" ")}
                >
                  <Icon size={11} strokeWidth={2.25} />
                </span>
                <span
                  className={[
                    "text-[10px] leading-snug",
                    accent ? "font-semibold text-slate-100" : "text-slate-400",
                  ].join(" ")}
                >
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-md border border-white/[0.08] bg-[#070a10] px-2.5 py-2.5">
          <p className="m-0 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
            <Sparkles size={10} />
            우위 섹터
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {guide.sectors.map((s) => {
              const style = SECTOR_CHIP_STYLES[s] ?? DEFAULT_CHIP
              return (
                <span
                  key={s}
                  className={[
                    "cursor-default rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-tight transition duration-200",
                    style.chip,
                    style.hover,
                  ].join(" ")}
                >
                  {s}
                </span>
              )
            })}
          </div>
        </article>
      </div>
    </div>
  )
}
