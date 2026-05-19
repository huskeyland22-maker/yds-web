import {
  KOREA_GROWTH_SECTOR_MAP,
  KOREA_RADAR_ITEMS,
  getKoreaSectorById,
} from "../data/koreaGrowthSectorMap.js"

/** @typedef {{ name: string; code: string; tip?: string }} KoreaStockRef */
/** @typedef {'overheat'|'pullback'|'trend'|'watch'} SignalStatusId */
/** @typedef {{ volume: string; ma10: string; ma20: string; w52: string }} AuxSignals */

export const SIGNAL_STATUS_META = {
  overheat: { id: "overheat", status: "과열", badge: "과열", shortBadge: "과열" },
  pullback: { id: "pullback", status: "눌림", badge: "눌림대기", shortBadge: "주의" },
  trend: { id: "trend", status: "추세", badge: "추세유지", shortBadge: "추천유지" },
  watch: { id: "watch", status: "관망", badge: "관망", shortBadge: "관망" },
}

/** @param {string} key */
function hashScore(key) {
  const s = String(key || "")
  let score = 0
  for (let i = 0; i < s.length; i++) score += s.charCodeAt(i)
  return score
}

/** @param {string} code @returns {SignalStatusId} */
export function deriveSignalStatus(code) {
  const bucket = hashScore(code) % 4
  if (bucket === 0) return "trend"
  if (bucket === 1) return "pullback"
  if (bucket === 2) return "overheat"
  return "watch"
}

/** @param {string} code @param {string} [sectorHeat] */
export function deriveMarketTemp(code, sectorHeat) {
  const h = String(sectorHeat || "").toUpperCase()
  if (h === "VERY HOT" || h === "HOT") return "HOT"
  if (h === "WARM") return "WARM"
  if (h === "COOL") return "COOL"
  return ["HOT", "WARM", "COOL"][hashScore(code) % 3]
}

/** @param {string} code @returns {AuxSignals} */
export function deriveAuxSignals(code) {
  const s = hashScore(code)
  return {
    volume: ["증가", "보통", "감소"][s % 3],
    ma10: ["상회", "하회", "근접"][(s >> 2) % 3],
    ma20: ["상회", "하회", "근접"][(s >> 4) % 3],
    w52: ["상단", "중단", "하단"][(s >> 6) % 3],
  }
}

/**
 * @param {import("../data/koreaGrowthSectorMap.js").KoreaSectorCard | null} sector
 * @returns {KoreaStockRef[]}
 */
export function collectSectorStocks(sector) {
  if (!sector) return []
  /** @type {Map<string, KoreaStockRef>} */
  const byCode = new Map()

  const add = (stock) => {
    if (!stock?.code) return
    if (!byCode.has(stock.code)) byCode.set(stock.code, stock)
  }

  for (const s of sector.stocks || []) add(s)
  for (const sub of sector.subChains || []) {
    for (const s of sub.stocks || []) add(s)
  }
  return [...byCode.values()]
}

/**
 * @param {KoreaStockRef} stock
 * @param {{ sectorName: string; sectorHeat?: string; subLabel?: string; live?: object }} ctx
 */
export function buildStockSignalRow(stock, ctx) {
  if (ctx.live?.statusId) {
    const statusId = ctx.live.statusId
    const meta = SIGNAL_STATUS_META[statusId] ?? SIGNAL_STATUS_META.watch
    return {
      ...stock,
      sectorName: ctx.subLabel ? `${ctx.sectorName} · ${ctx.subLabel}` : ctx.sectorName,
      statusId,
      status: ctx.live.status ?? meta.status,
      badge: ctx.live.badge ?? meta.badge,
      shortBadge: ctx.live.shortBadge ?? meta.shortBadge,
      marketTemp: ctx.live.marketTemp ?? deriveMarketTemp(stock.code, ctx.sectorHeat),
      aux: ctx.live.aux ?? deriveAuxSignals(stock.code),
      signalLive: true,
    }
  }

  const statusId = deriveSignalStatus(stock.code)
  const meta = SIGNAL_STATUS_META[statusId]
  return {
    ...stock,
    sectorName: ctx.subLabel ? `${ctx.sectorName} · ${ctx.subLabel}` : ctx.sectorName,
    statusId,
    status: meta.status,
    badge: meta.badge,
    shortBadge: meta.shortBadge,
    marketTemp: deriveMarketTemp(stock.code, ctx.sectorHeat),
    aux: deriveAuxSignals(stock.code),
    signalLive: false,
  }
}

/**
 * @param {import("../data/koreaGrowthSectorMap.js").KoreaSectorCard | null} sector
 * @param {string} [sectorHeat]
 */
export function buildSectorSignalGroups(sector, sectorHeat) {
  if (!sector) return []

  if (sector.subChains?.length) {
    return sector.subChains
      .map((sub) => ({
        id: sub.id,
        label: sub.label,
        rows: (sub.stocks || []).map((stock) =>
          buildStockSignalRow(stock, {
            sectorName: sector.name,
            sectorHeat,
            subLabel: sub.label,
          }),
        ),
      }))
      .filter((g) => g.rows.length > 0)
  }

  return [
    {
      id: "main",
      label: sector.name,
      rows: buildSectorSignalRows(sector, sectorHeat),
    },
  ]
}

/**
 * @param {import("../data/koreaGrowthSectorMap.js").KoreaSectorCard | null} sector
 * @param {string} [sectorHeat]
 */
export function buildSectorSignalRows(sector, sectorHeat) {
  if (!sector) return []
  return collectSectorStocks(sector).map((stock) =>
    buildStockSignalRow(stock, { sectorName: sector.name, sectorHeat }),
  )
}

/** @param {Record<string, string>} [heatById] */
export function buildAllSectorSignalCounts(heatById = {}) {
  return KOREA_RADAR_ITEMS.map((item) => {
    const sector = getKoreaSectorById(item.sectorId)
    const heat = heatById[item.sectorId] || sector?.heat
    const counts = { overheat: 0, pullback: 0, trend: 0, watch: 0 }
    for (const stock of collectSectorStocks(sector)) {
      counts[deriveSignalStatus(stock.code)] += 1
    }
    return {
      sectorId: item.sectorId,
      label: item.shortLabel,
      fullLabel: item.label,
      counts,
      total: collectSectorStocks(sector).length,
    }
  })
}

export { KOREA_GROWTH_SECTOR_MAP }
