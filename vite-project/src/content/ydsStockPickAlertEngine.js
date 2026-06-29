/**
 * GO #85 — AI 추천 알림 감지 엔진
 */

import { resolveStockPickCardAction } from "./ydsStockPickCardAction.js"
import { getRecommendScoreDelta } from "./ydsStockPickScoreHistory.js"
import { buildStockPickDetailPanelReport } from "./ydsStockPickDetailPanelEngine.js"
import {
  appendPickAlert,
  isAlertEnabled,
} from "./ydsStockPickAlertStorage.js"
import { calcRecommendReturnPct } from "../trading-zone/tradingZoneRecommendationTrack.js"

/** @typedef {import("./ydsStockPickModel.js").StockPickView} StockPickView */

const WATCH_KEY = "yds-stock-pick-alert-watch-v1"

/** @returns {Record<string, { statusId: string; cardActionId: string; aiScore: number; returnPct: number | null }>} */
function readWatch() {
  try {
    const raw = localStorage.getItem(WATCH_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/** @param {Record<string, unknown>} map */
function writeWatch(map) {
  localStorage.setItem(WATCH_KEY, JSON.stringify(map))
}

/**
 * @param {StockPickView} stock
 * @param {Set<string>} subscribed
 */
function snapshotFromStock(stock) {
  const price = Number(stock.snapshot?.price ?? stock.snapshot?.close)
  const pick = stock.trustReport
  const recPrice = stock.pickMeta?.recommendedPrice ?? null
  return {
    statusId: stock.v4Score?.recommendStatusId ?? "",
    cardActionId: resolveStockPickCardAction(stock).id,
    aiScore: Math.round(stock.recommendEngine?.compositeScore ?? stock.score ?? 0),
    returnPct: recPrice != null ? calcRecommendReturnPct(recPrice, price) : null,
  }
}

/**
 * @param {StockPickView} stock
 * @param {PickAlertType} type
 * @param {string} message
 */
function makeAlert(stock, type, message) {
  return /** @type {PickAlertRecord} */ ({
    id: `${stock.ticker}:${type}:${Date.now()}`,
    ticker: stock.ticker,
    name: stock.name,
    type,
    message,
    createdAt: Date.now(),
    read: false,
  })
}

/**
 * @param {StockPickView[]} liveStocks
 * @param {Set<string>} subscribed
 */
export function scanStockPickAlerts(liveStocks, subscribed) {
  if (!subscribed.size) return []

  const prev = readWatch()
  /** @type {typeof prev} */
  const next = { ...prev }
  /** @type {PickAlertRecord[]} */
  const created = []

  for (const stock of liveStocks) {
    if (!subscribed.has(stock.ticker)) continue
    const snap = snapshotFromStock(stock)
    const before = prev[stock.ticker]

    const push = (type, message) => {
      if (!isAlertEnabled(stock.ticker, type)) return
      const alert = makeAlert(stock, type, message)
      appendPickAlert(alert)
      created.push(alert)
    }

    if (!before) {
      push("recommendStart", `${stock.name} AI 추천 시작 · ${snap.aiScore}점`)
    } else {
      const delta = getRecommendScoreDelta(stock.ticker)
      if (delta?.delta != null && delta.delta >= 3) {
        push("scoreUp", `AI 점수 ${delta.previous}→${delta.current} (▲+${delta.delta})`)
      }
      if (delta?.delta != null && delta.delta <= -3) {
        push("scoreDown", `AI 점수 ${delta.previous}→${delta.current} (▼${delta.delta})`)
      }

      if (before.cardActionId !== "entry" && snap.cardActionId === "entry") {
        push("entryReady", "매수 가능 진입 구간")
      }

      if (before.statusId && snap.statusId && before.statusId !== snap.statusId) {
        if (snap.statusId === "exclude" || snap.statusId === "noChase") {
          push("recommendEnd", `추천 해제 · ${before.statusId}→${snap.statusId}`)
        }
      }

      const detail = buildStockPickDetailPanelReport(stock, null)
      const price = Number(stock.snapshot?.price ?? stock.snapshot?.close)
      const target1 = detail.priceLevels?.target1
      if (target1 && target1 !== "—" && Number.isFinite(price)) {
        const targetNum = parseFloat(String(target1).replace(/[^0-9.]/g, ""))
        if (targetNum > 0 && price >= targetNum * 0.98) {
          push("targetHit", `목표가 ${target1} 근접/도달`)
        }
      }

      const stop = detail.priceLevels?.stopLoss
      if (stop && stop !== "—" && Number.isFinite(price)) {
        const stopNum = parseFloat(String(stop).replace(/[^0-9.]/g, ""))
        if (stopNum > 0 && price <= stopNum * 1.02) {
          push("stopSignal", `손절 기준 ${stop} 근접`)
        }
      }
    }

    next[stock.ticker] = snap
  }

  writeWatch(next)
  return created
}

/** @param {PickAlertRecord} alert */
export function notifyPickAlertBrowser(alert) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return
  try {
    new Notification(`YDS · ${alert.name}`, {
      body: alert.message,
      tag: alert.id,
    })
  } catch {
    /* ignore */
  }
}

export function requestPickAlertPermission() {
  if (typeof Notification === "undefined") return Promise.resolve("unsupported")
  if (Notification.permission === "granted") return Promise.resolve("granted")
  if (Notification.permission === "denied") return Promise.resolve("denied")
  return Notification.requestPermission()
}
