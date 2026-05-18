import { AnimatePresence, motion } from "framer-motion"

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
    <section id="industry-map" className="korea-dash-map valuechain-section" aria-label="코리아 산업 맵">
      <header className="korea-dash-panel-head mb-3">
        <p className="m-0 font-mono text-[8px] uppercase tracking-[0.18em] text-slate-500">Strategy map</p>
        <h2 className="m-0 mt-0.5 text-xs font-semibold text-slate-200">코리아 산업 맵</h2>
      </header>

      <motion.div
        className="korea-map-stage relative min-h-[280px] rounded-xl border border-white/[0.06] bg-[rgba(6,8,12,0.65)] p-4 md:min-h-[340px] md:p-5"
        layout
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.28] rounded-xl"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
          aria-hidden
        />

        <AnimatePresence mode="wait">
          {!sector ? (
            <motion.div
              key="hub-idle"
              className="relative z-[1] flex min-h-[240px] flex-col items-center justify-center text-center md:min-h-[300px]"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              <motion.div
                className="flex flex-col items-center rounded-2xl border border-white/[0.1] bg-[rgba(8,10,14,0.92)] px-8 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                initial={{ scale: 0.92 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="m-0 font-mono text-[9px] uppercase tracking-[0.28em] text-slate-500">Korea</p>
                <p className="m-0 mt-1 text-sm font-semibold tracking-[0.14em] text-slate-100 md:text-base">
                  VALUE MAP
                </p>
              </motion.div>
              <p className="m-0 mt-4 max-w-[14rem] text-[10px] leading-relaxed text-slate-500">
                좌측 산업 레이더에서 섹터를 선택하면 밸류체인 연결망이 표시됩니다.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={sector.id}
              className="relative z-[1] flex flex-col items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <motion.div
                className="korea-map-root-node"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <span className="text-[8px] font-mono uppercase tracking-[0.16em] text-slate-500">{sector.icon}</span>
                <span className="mt-0.5 block text-[12px] font-semibold text-slate-100 md:text-[13px]">
                  {sector.name}
                </span>
              </motion.div>

              <motion.div
                className="korea-map-vline"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.35, delay: 0.08 }}
                style={{ originY: 0 }}
                aria-hidden
              />

              {subChains.length > 0 ? (
                <div className="mt-1 flex w-full max-w-full flex-wrap items-start justify-center gap-3 md:gap-4">
                  {subChains.map((sub, i) => (
                    <motion.div
                      key={sub.id}
                      className="korea-map-column flex min-w-[72px] max-w-[108px] flex-col items-center"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, delay: 0.1 + i * 0.05 }}
                    >
                      <motion.div className="korea-map-chain-node">{sub.label}</motion.div>
                      <motion.div
                        className="korea-map-vline korea-map-vline--short"
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.3, delay: 0.15 + i * 0.05 }}
                        style={{ originY: 0 }}
                        aria-hidden
                      />
                      <div className="mt-1 flex w-full flex-col items-center gap-1.5">
                        {sub.stocks.map((stock, si) => (
                          <motion.button
                            key={stock.code}
                            type="button"
                            title={stock.tip || stock.code}
                            className="korea-map-stock-node"
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.22, delay: 0.2 + i * 0.05 + si * 0.03 }}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() =>
                              onStockSelect({
                                stock: { name: stock.name, code: stock.code, tip: stock.tip },
                                sectorName: `${sector.name} · ${sub.label}`,
                              })
                            }
                          >
                            {stock.name}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </section>
  )
}
