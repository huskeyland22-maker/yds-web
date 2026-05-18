import { AnimatePresence, motion } from "framer-motion"
import { CYCLE_PHASES } from "../../data/koreaGrowthSectorMap.js"
import { heatToRadarTemp, radarTempPillClass } from "../../utils/koreaValueChainHeat.js"

const INSIGHT_FADE = { duration: 0.28, ease: [0.22, 1, 0.36, 1] }

export default function KoreaSectorInsightPanel({ sector, heat, onStockSelect }) {
  return (
    <aside className="korea-dash-insight live-insight insight-panel" aria-label="실시간 인사이트">
      <header className="korea-dash-panel-head korea-insight-head">
        <p className="m-0 font-mono text-[8px] uppercase tracking-[0.18em] text-slate-500">Live insight</p>
        <h2 className="m-0 mt-0.5 text-xs font-semibold text-slate-200">LIVE INSIGHT</h2>
      </header>

      <AnimatePresence mode="wait">
        {!sector ? (
          <motion.div
            key="insight-idle"
            className="insight-content insight-content--compact"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={INSIGHT_FADE}
          >
            <p className="m-0 text-[11px] leading-relaxed text-slate-500">
              산업을 선택하면 단계·온도·사이클·수혜 논리가 표시됩니다.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key={sector.id}
            className="insight-content insight-content--compact"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={INSIGHT_FADE}
          >
            <p className="korea-insight-sector-title m-0">
              <span aria-hidden>{sector.icon}</span> {sector.name}
            </p>

            <dl className="korea-insight-kv m-0">
              <motion.div className="korea-insight-kv__row">
                <dt>현재 단계</dt>
                <dd>{sector.currentStage}</dd>
              </motion.div>
              <motion.div className="korea-insight-kv__row">
                <dt>시장 온도</dt>
                <dd className="flex flex-wrap items-center gap-1.5">
                  <span>{sector.marketTemperature}</span>
                  <span
                    className={[
                      "rounded border px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wide",
                      radarTempPillClass(heatToRadarTemp(heat || sector.heat)),
                    ].join(" ")}
                  >
                    {heatToRadarTemp(heat || sector.heat)}
                  </span>
                </dd>
              </motion.div>
              <motion.div className="korea-insight-kv__row">
                <dt>사이클</dt>
                <dd>
                  {CYCLE_PHASES.find((p) => p.id === sector.cyclePhase)?.label ?? sector.cyclePosition}
                  <span className="korea-insight-cycle-pct"> · {sector.cyclePct}%</span>
                </dd>
              </motion.div>
            </dl>

            <motion.div className="korea-insight-reason">
              <p className="korea-insight-reason__label">수혜 논리</p>
              <p className="korea-insight-reason__text">{sector.beneficiaryReason}</p>
            </motion.div>

            <motion.div className="korea-insight-stocks">
              <p className="korea-insight-stocks__label">대표 종목</p>
              <ul className="m-0 list-none space-y-1.5 p-0">
                {sector.stocks.map((s) => (
                  <li key={s.code}>
                    <button
                      type="button"
                      title={s.tip || s.code}
                      className="korea-insight-stock-link"
                      onClick={() =>
                        onStockSelect({
                          stock: { name: s.name, code: s.code, tip: s.tip },
                          sectorName: sector.name,
                        })
                      }
                    >
                      <span className="font-medium text-slate-200">{s.name}</span>
                      {s.tip ? <span className="text-slate-500"> · {s.tip}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  )
}
