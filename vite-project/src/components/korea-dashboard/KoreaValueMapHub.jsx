import { AnimatePresence, motion } from "framer-motion"

const MAP_FADE = { duration: 0.32, ease: [0.22, 1, 0.36, 1] }

/**
 * @param {{
 *   sector: import("../../data/koreaGrowthSectorMap.js").KoreaSectorCard | null
 *   onStockSelect: (p: { stock: { name: string; code: string; tip?: string }; sectorName: string }) => void
 * }} props
 */
export default function KoreaValueMapHub({ sector, onStockSelect }) {
  const subChains =
    sector?.subChains?.length > 0
      ? sector.subChains
      : sector?.nodes?.length
        ? [{ id: "nodes", label: sector.name, stocks: sector.stocks }]
        : []

  return (
    <section id="industry-map" className="korea-dash-map valuechain-section" aria-label="??? ?? ?">
      <header className="korea-dash-panel-head mb-3">
        <p className="m-0 font-mono text-[8px] uppercase tracking-[0.18em] text-slate-500">Strategy map</p>
        <h2 className="m-0 mt-0.5 text-xs font-semibold text-slate-200">??? ?? ?</h2>
      </header>

      <motion.div className="korea-map-stage relative min-h-[360px] rounded-xl border border-white/[0.06] bg-[rgba(6,8,12,0.65)] p-4 md:min-h-[420px] md:p-6">
        <div
          className="pointer-events-none absolute inset-0 rounded-xl opacity-[0.28]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
          aria-hidden
        />

        <AnimatePresence mode="wait">
          {!sector ? (
            <motion.div
              key="hub-idle"
              className="relative z-[1] flex min-h-[300px] flex-col items-center justify-center text-center md:min-h-[360px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={MAP_FADE}
            >
              <motion.div
                className="korea-map-root-node korea-map-root-node--idle"
                initial={{ scale: 0.94 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="m-0 font-mono text-[9px] uppercase tracking-[0.28em] text-slate-500">Korea</p>
                <p className="m-0 mt-1 text-sm font-semibold tracking-[0.12em] text-slate-100 md:text-base">
                  VALUE MAP
                </p>
              </motion.div>
              <p className="m-0 mt-5 max-w-[16rem] text-[11px] leading-relaxed text-slate-500">
                ?? ?? ????? ??? ???? ???? ???? ?????.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={sector.id}
              className="relative z-[1] flex flex-col items-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={MAP_FADE}
            >
              <motion.div
                className="korea-map-root-node korea-map-root-node--active"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.28, delay: 0.04 }}
              >
                <span className="korea-map-root-icon" aria-hidden>
                  {sector.icon}
                </span>
                <span className="korea-map-root-title">{sector.name}</span>
              </motion.div>

              <motion.div
                className="korea-map-vline korea-map-vline--root"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.35, delay: 0.1 }}
                style={{ originY: 0 }}
                aria-hidden
              />

              {subChains.length > 0 ? (
                <motion.div
                  className="korea-map-tier-row"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.12 }}
                >
                  {subChains.map((sub, i) => (
                    <motion.div
                      key={sub.id}
                      className="korea-map-column"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, delay: 0.14 + i * 0.06 }}
                    >
                      <motion.div className="korea-map-chain-node">{sub.label}</motion.div>
                      <motion.div
                        className="korea-map-vline korea-map-vline--short"
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.28, delay: 0.18 + i * 0.06 }}
                        style={{ originY: 0 }}
                        aria-hidden
                      />
                      <p className="korea-map-tier-label">?? ??</p>
                      <div className="korea-map-stocks">
                        {sub.stocks.map((stock, si) => (
                          <motion.button
                            key={stock.code}
                            type="button"
                            title={`${stock.name} (${stock.code})`}
                            className="korea-map-stock-card"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.22, delay: 0.22 + i * 0.06 + si * 0.04 }}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() =>
                              onStockSelect({
                                stock: { name: stock.name, code: stock.code, tip: stock.tip },
                                sectorName: `${sector.name} ? ${sub.label}`,
                              })
                            }
                          >
                            <span className="korea-map-stock-card__name">{stock.name}</span>
                            <span className="korea-map-stock-card__role">{stock.tip || "\uB300\uD45C\uC8FC"}</span>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </section>
  )
}
