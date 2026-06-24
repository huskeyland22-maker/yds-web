/**
 * 패닉 강도 산출 근거 — VIX·CNN·BofA·Put/Call·HY
 */

/** @param {unknown} v @param {number} [digits] */
function fmt(v, digits = 1) {
  const n = Number(v)
  if (!Number.isFinite(n)) return "—"
  return Number.isInteger(n) && digits === 0 ? String(n) : n.toFixed(digits)
}

/** @param {number} v */
function briefVix(v) {
  if (v < 18) return "안정"
  if (v < 22) return "보통"
  if (v < 30) return "확대"
  return "극대"
}

/** @param {number} v */
function briefCnn(v) {
  if (v >= 60) return "탐욕"
  if (v <= 40) return "공포"
  return "중립"
}

/** @param {number} v */
function briefBofa(v) {
  if (v >= 7) return "낙관"
  if (v >= 5) return "중립"
  return "보수"
}

/** @param {number} v */
function briefPutCall(v) {
  if (v >= 1.05) return "헷지"
  if (v <= 0.75) return "낙관"
  return "중립"
}

/** @param {number} v */
function briefHy(v) {
  if (v <= 4.2) return "양호"
  if (v <= 5.5) return "보통"
  return "부담"
}

/**
 * @param {object | null | undefined} panicData
 */
export function buildPanicEvidenceReport(panicData) {
  const vix = Number(panicData?.vix)
  const cnn = Number(panicData?.fearGreed)
  const bofa = Number(panicData?.bofa)
  const putCall = Number(panicData?.putCall)
  const hy = Number(panicData?.highYield ?? panicData?.hyOas)

  /** @type {Array<{ id: string; label: string; value: string; brief: string }>} */
  const metrics = [
    {
      id: "vix",
      label: "VIX",
      value: fmt(vix, 1),
      brief: Number.isFinite(vix) ? briefVix(vix) : "—",
    },
    {
      id: "cnn",
      label: "CNN",
      value: fmt(cnn, 0),
      brief: Number.isFinite(cnn) ? briefCnn(cnn) : "—",
    },
    {
      id: "bofa",
      label: "BofA",
      value: fmt(bofa, 1),
      brief: Number.isFinite(bofa) ? briefBofa(bofa) : "—",
    },
    {
      id: "putCall",
      label: "Put/Call",
      value: fmt(putCall, 2),
      brief: Number.isFinite(putCall) ? briefPutCall(putCall) : "—",
    },
    {
      id: "hy",
      label: "HY Spread",
      value: fmt(hy, 1),
      brief: Number.isFinite(hy) ? briefHy(hy) : "—",
    },
  ]

  const briefChips = metrics
    .filter((m) => m.brief !== "—")
    .map((m) => ({ id: m.id, text: `${m.label} ${m.brief}` }))

  const hasData = metrics.some((m) => m.value !== "—")

  return { metrics, briefChips, hasData }
}
