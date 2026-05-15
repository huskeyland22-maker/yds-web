const TOAST_CHANNEL = "yds:toast"

/**
 * @param {{ type?: string, message?: string }} detail
 */
function emitToast(detail) {
  if (typeof window === "undefined") return
  try {
    window.dispatchEvent(
      new CustomEvent(TOAST_CHANNEL, {
        detail: {
          type: detail?.type ?? "info",
          message: String(detail?.message ?? ""),
        },
      }),
    )
  } catch {
    // ignore
  }
}

export const toast = {
  error(message) {
    emitToast({ type: "error", message })
  },
  success(message) {
    emitToast({ type: "success", message })
  },
}

export function getToastChannel() {
  return TOAST_CHANNEL
}
