import { useEffect } from "react"

const LS_PREV = "yds-panic-notify-prev-score"
const LS_LAST = "yds-panic-notify-last-ms"
const COOLDOWN_MS = 60_000

function readPrev() {
  try {
    const s = localStorage.getItem(LS_PREV)
    if (s == null || s === "") return null
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

function writePrev(n) {
  try {
    localStorage.setItem(LS_PREV, String(n))
  } catch {
    /* ignore */
  }
}

function cooldownAllowsSend() {
  try {
    const last = Number(localStorage.getItem(LS_LAST) || 0)
    if (Date.now() - last < COOLDOWN_MS) return false
    localStorage.setItem(LS_LAST, String(Date.now()))
    return true
  } catch {
    return true
  }
}

/** @returns {Promise<NotificationPermission | 'unsupported'>} */
export async function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported"
  }
  try {
    return await Notification.requestPermission()
  } catch {
    return "denied"
  }
}

export function sendNotification(title, body) {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission !== "granted") return
    new Notification(title, { body: body || "", silent: false })
  } catch {
    /* ignore */
  }
}

/**
 * @param {number} finalScore
 * @param {boolean} active — 사용자가 알림을 켠 경우만 true
 */
export function usePanicNotifications(finalScore, active) {
  useEffect(() => {
    if (!active) return
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission !== "granted") return

    const score = Number(finalScore)
    if (!Number.isFinite(score)) return

    let prev
    try {
      prev = readPrev()
    } catch {
      return
    }

    if (prev === null) {
      writePrev(score)
      return
    }

    let title = null
    let body = null

    if (score <= 30 && prev > 30) {
      title = "⚠️ 위험 구간 진입"
      body = `패닉 지수 ${score} — 위험·익절 구간을 점검하세요.`
    } else if (score >= 70 && prev < 70) {
      title = "📈 매수 기회 발생"
      body = `패닉 지수 ${score} — 매수 타이밍 신호를 확인하세요.`
    } else if (Math.abs(score - prev) >= 10) {
      title = "⚡ 급격한 시장 변화"
      const d = score - prev
      body = `점수 ${prev} → ${score} (${d >= 0 ? "+" : ""}${d})`
    }

    writePrev(score)

    if (!title) return
    if (!cooldownAllowsSend()) return
    sendNotification(title, body)
  }, [finalScore, active])
}
