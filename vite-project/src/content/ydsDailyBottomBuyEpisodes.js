/**
 * Daily Bottom Buy — client episode state (localStorage).
 * Same-correction 3→4 as one episode; no auto orders.
 */
const STORAGE_KEY = "yds.dailyBottomBuy.episodes.v1"

/**
 * @typedef {{
 *   openDate: string,
 *   reached4: boolean,
 *   notedPrimary: boolean,
 *   notedAdd: boolean,
 *   lastCount: number,
 * }} EpisodeState
 */

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function writeAll(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore quota */
  }
}

/**
 * Sync episode map from live card counts.
 * @param {Array<{ symbol: string, count: number, asOfDate?: string|null }>} cards
 * @returns {Record<string, EpisodeState & { uiNote: string }>}
 */
export function syncDailyBottomEpisodes(cards) {
  const map = readAll()
  const today = new Date().toISOString().slice(0, 10)
  /** @type {Record<string, EpisodeState & { uiNote: string }>} */
  const out = {}

  for (const card of cards || []) {
    const sym = card.symbol
    const count = Number(card.count) || 0
    let ep = map[sym] || null

    if (count < 2) {
      if (ep) delete map[sym]
      out[sym] = {
        openDate: "",
        reached4: false,
        notedPrimary: false,
        notedAdd: false,
        lastCount: count,
        uiNote: "",
      }
      continue
    }

    if (count >= 3) {
      if (!ep || ep.lastCount < 2) {
        ep = {
          openDate: card.asOfDate || today,
          reached4: count >= 4,
          notedPrimary: false,
          notedAdd: false,
          lastCount: count,
        }
      } else {
        ep = {
          ...ep,
          lastCount: count,
          reached4: ep.reached4 || count >= 4,
        }
      }
      map[sym] = ep

      let uiNote = ""
      if (count >= 4) {
        uiNote = ep.notedAdd
          ? "에피소드 진행 중 · 추가(50%) 검토 완료로 표시"
          : "추가 매수 후보 (50%) · 동일 조정 에피소드"
      } else {
        uiNote = ep.notedPrimary
          ? "에피소드 진행 중 · 1차(50%) 후 4개 대기"
          : "1차 매수 후보 (50%) · 새 조정 에피소드"
      }
      out[sym] = { ...ep, uiNote }
      continue
    }

    // count === 2: watch — keep episode if already open, else none
    if (ep && ep.lastCount >= 3) {
      ep = { ...ep, lastCount: count }
      map[sym] = ep
      out[sym] = {
        ...ep,
        uiNote: ep.reached4
          ? "에피소드 종료 임박 · 관심 구간"
          : "에피소드 완화 · 잔여 50% 자동 미사용",
      }
    } else {
      if (ep) delete map[sym]
      out[sym] = {
        openDate: "",
        reached4: false,
        notedPrimary: false,
        notedAdd: false,
        lastCount: count,
        uiNote: "",
      }
    }
  }

  writeAll(map)
  return out
}

/**
 * User acknowledges a tranche suggestion (UI only).
 * @param {string} symbol
 * @param {'primary'|'add'} kind
 */
export function acknowledgeEpisodeTranche(symbol, kind) {
  const map = readAll()
  const ep = map[symbol]
  if (!ep) return
  if (kind === "primary") ep.notedPrimary = true
  if (kind === "add") ep.notedAdd = true
  map[symbol] = ep
  writeAll(map)
}
