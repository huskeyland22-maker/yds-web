import { useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { getKoreaSectorById } from "../../data/koreaGrowthSectorMap.js"
import {
  buildAllSectorSignalCounts,
  buildSectorSignalRows,
  SIGNAL_STATUS_META,
} from "../../utils/koreaIndustrySignal.js"

const LIST_FADE = { duration: 0.28, ease: [0.22, 1, 0.36, 1] }

const COUNT_KEYS = [
  { key: "overheat", label: "과열" },
  { key: "pullback", label: "누림" },
  { key: "trend", label: "추세" },
  { key: "watch", label: "관망" },
]

export default function KoreaIndustrySignalBoard({ selectedId, heatById = {}, onStockSelect }) {
  const sector = useMemo(() => getKoreaSectorById(selectedId), [selectedId])
  const sectorHeat = heatById[selectedId] || sector?.heat
  const rows = useMemo(() => buildSectorSignalRows(sector, sectorHeat), [sector, sectorHeat])
  const sectorCounts = useMemo(() => buildAllSectorSignalCounts(heatById), [heatById])

  return (
    <section id="industry-signal-board" className="korea-signal-board scroll-mt-24" aria-label="산업 시그널 보드">
      <header className="korea-signal-board__head">
        <p className="korea-signal-board__eyebrow">Industry signal desk</p>
        <h2 className="korea-signal-board__title">산업 시그널 보드</h2>
        <p className="korea-signal-board__sub">산업 흐름 기반 종목 탐색</p>
      </header>
      <div className="korea-signal-flow">
        <span className="korea-signal-flow__label">선택 산업</span>
        <span className="korea-signal-flow__arrow" aria-hidden>↓</span>
        <span className="korea-signal-flow__pill">{sector?.name ?? "—"}</span>
        <span className="korea-signal-flow__arrow" aria-hidden>↓</span>
        <span className="korea-signal-flow__label korea-signal-flow__label--muted">자동 필터 · 종목 {rows.length}개</span>
      </div>
      <div className="korea-signal-sector-summary">
        <p className="korea-signal-sector-summary__title">산업별 시그널 요약</p>
        <ul className="korea-signal-sector-summary__grid m-0 list-none p-0">
          {sectorCounts.map((item) => {
            const active = item.sectorId === selectedId
            return (
              <li
                key={item.sectorId}
                className={["korea-signal-summary-card", active ? "is-active" : ""].filter(Boolean).join(" ")}
              >
                <p className="korea-signal-summary-card__name">{item.fullLabel}</p>
                <ul className="korea-signal-summary-card__counts m-0 list-none p-0">
                  {COUNT_KEYS.map(({ key, label }) => (
                    <li key={key} className="korea-signal-summary-card__count-row">
                      <span className="korea-signal-summary-card__count-label">{label}</span>
                      <span className="korea-signal-summary-card__count-value">{item.counts[key]}</span>
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedId}
          className="korea-signal-card-grid"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={LIST_FADE}
        >
          {rows.length === 0 ? (
            <p className="m-0 text-sm text-slate-500">선택한 산업의 종목 데이터가 없습니다.</p>
          ) : (
            rows.map((row, i) => (
              <motion.article
                key={row.code}
                className="korea-signal-card"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: i * 0.03 }}
              >
                <button
                  type="button"
                  className="korea-signal-card__hit"
                  onClick={() =>
                    onStockSelect({
                      stock: { name: row.name, code: row.code, tip: row.tip },
                      sectorName: row.sectorName,
                    })
                  }
                >
                  <div className="korea-signal-card__body">
                    <div className="korea-signal-card__main">
                      <p className="korea-signal-card__name">{row.name}</p>
                      <p className="korea-signal-card__code">{row.code}</p>
                      {row.tip ? <p className="korea-signal-card__role">{row.tip}</p> : null}
                      <dl className="korea-signal-card__meta m-0">
                        <div className="korea-signal-card__meta-row">
                          <dt>현재 상태</dt>
                          <dd>{row.status}</dd>
                        </div>
                        <div className="korea-signal-card__meta-row">
                          <dt>시장 온도</dt>
                          <dd>
                            <span className={`korea-signal-temp korea-signal-temp--${row.marketTemp.toLowerCase()}`}>
                              {row.marketTemp}
                            </span>
                          </dd>
                        </div>
                      </dl>
                      <div className="korea-signal-card__aux">
                        <span>거래량 {row.aux.volume}</span>
                        <span>10일선 {row.aux.ma10}</span>
                        <span>20일선 {row.aux.ma20}</span>
                        <span>52주 {row.aux.w52}</span>
                      </div>
                    </div>
                    <span
                      className={`korea-signal-badge korea-signal-badge--${row.statusId}`}
                      title={SIGNAL_STATUS_META[row.statusId].badge}
                    >
                      {row.badge}
                    </span>
                  </div>
                </button>
              </motion.article>
            ))
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
