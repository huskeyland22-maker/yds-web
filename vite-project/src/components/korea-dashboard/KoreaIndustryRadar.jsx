import { motion } from "framer-motion"
import { KOREA_RADAR_ITEMS } from "../../data/koreaGrowthSectorMap.js"
import { heatToRadarTemp, radarTempPillClass } from "../../utils/koreaValueChainHeat.js"

/**
 * @param {{
 *   heatById?: Record<string, string>
 *   selectedId: string | null
 *   onSelect: (sectorId: string) => void
 * }} props
 */
export default function KoreaIndustryRadar({ heatById = {}, selectedId, onSelect }) {
  return (
    <aside className="korea-dash-radar" aria-label="산업 레이더">
      <header className="korea-dash-panel-head">
        <p className="m-0 font-mono text-[8px] uppercase tracking-[0.18em] text-slate-500">Sector radar</p>
        <h2 className="m-0 mt-0.5 text-xs font-semibold text-slate-200">산업 레이더</h2>
      </header>

      <ul className="korea-radar-list m-0 list-none p-0">
        {KOREA_RADAR_ITEMS.map((item) => {
          const heat = heatById[item.sectorId]
          const temp = heatToRadarTemp(heat)
          const active = selectedId === item.sectorId
          return (
            <li key={item.sectorId}>
              <motion.button
                type="button"
                layout
                onClick={() => onSelect(item.sectorId)}
                className={["korea-radar-node group w-full text-left", active ? "is-active" : ""]
                  .filter(Boolean)
                  .join(" ")}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                <span className="korea-radar-ring" aria-hidden />
                <span className="korea-radar-node-label min-w-0 flex-1">
                  <span className="block font-semibold leading-snug text-slate-200 group-hover:text-slate-50">
                    {item.label}
                  </span>
                </span>
                <span
                  className={[
                    "korea-radar-temp shrink-0 rounded border px-1.5 py-0.5 font-mono font-semibold uppercase tracking-wide",
                    radarTempPillClass(temp),
                  ].join(" ")}
                >
                  {temp}
                </span>
              </motion.button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
