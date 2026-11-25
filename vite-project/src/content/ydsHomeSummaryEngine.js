/**
 * YDS 전용 홈 — 표시용 요약 조립만.
 * Panic / CCI / DBB 점수를 합산하지 않는다. 엔진·임계값 변경 없음.
 */

/** Cboe Total Put/Call Ratio로 해석 가능한 범위 (점수식 0.92~1.39 주변). */
export const PUT_CALL_RATIO_MIN = 0.35
export const PUT_CALL_RATIO_MAX = 2.5

/**
 * @param {unknown} value
 * @returns {number | null}
 */
export function readFiniteOrNull(value) {
  if (value == null || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Put/Call: API 원본이 비율(약 0.5~2)일 때만 표시. 그 외는 확인 필요.
 * @param {unknown} raw
 * @returns {{
 *   ok: boolean
 *   value: number | null
 *   display: string
 *   unit: "ratio" | "unknown"
 *   reason: string | null
 * }}
 */
export function resolveHomePutCallDisplay(raw) {
  const n = readFiniteOrNull(raw)
  if (n == null) {
    return {
      ok: false,
      value: null,
      display: "데이터 없음",
      unit: "unknown",
      reason: "missing",
    }
  }
  if (n < PUT_CALL_RATIO_MIN || n > PUT_CALL_RATIO_MAX) {
    return {
      ok: false,
      value: n,
      display: "확인 필요",
      unit: "unknown",
      reason: "out_of_ratio_range",
    }
  }
  return {
    ok: true,
    value: n,
    display: n.toFixed(2),
    unit: "ratio",
    reason: null,
  }
}

/**
 * HY/BBB·highYield 센티널(0 포함)을 홈에 수치로 쓰지 않는다.
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isLicenseRestrictedYieldLike(raw) {
  const n = readFiniteOrNull(raw)
  if (n == null) return true
  if (n === 0) return true
  return false
}

/**
 * @param {string | null | undefined} isoOrDate
 * @returns {string | null}
 */
export function homeDayKey(isoOrDate) {
  const text = String(isoOrDate ?? "").trim()
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null
}

/**
 * UI DTO regime is often `{ id, label, status, reasons, knownIds }`.
 * @param {unknown} regime
 * @returns {string | null}
 */
export function resolveHomeRegimeLabel(regime) {
  if (regime == null) return null
  if (typeof regime === "string" || typeof regime === "number") {
    const text = String(regime).trim()
    return text || null
  }
  if (typeof regime === "object") {
    const label = regime.label ?? regime.id ?? regime.regime ?? null
    if (label == null) return null
    const text = String(label).trim()
    return text || null
  }
  return null
}

/**
 * @param {object | null | undefined} panicData
 */
export function buildHomeFearSummary(panicData) {
  const asOf =
    homeDayKey(panicData?.date) ||
    homeDayKey(panicData?.asOfDate) ||
    homeDayKey(panicData?.updatedAt) ||
    homeDayKey(panicData?.updated_at)

  const vix = readFiniteOrNull(panicData?.vix)
  const cnn = readFiniteOrNull(panicData?.fearGreed ?? panicData?.cnn)
  const bofa = readFiniteOrNull(panicData?.bofa)
  const putCall = resolveHomePutCallDisplay(panicData?.putCall)

  const hyRaw = panicData?.highYield ?? panicData?.hyOas
  const hyHidden = isLicenseRestrictedYieldLike(hyRaw)

  return {
    asOf,
    staleHint: Boolean(asOf),
    vix: {
      display: vix == null ? "데이터 없음" : vix.toFixed(2),
      value: vix,
      missing: vix == null,
    },
    cnn: {
      display: cnn == null ? "데이터 없음" : String(Math.round(cnn)),
      value: cnn,
      missing: cnn == null,
    },
    putCall,
    bofa: {
      display: bofa == null ? "데이터 없음" : bofa.toFixed(1),
      value: bofa,
      missing: bofa == null,
    },
    highYieldHidden: hyHidden,
    ready: vix != null || cnn != null || putCall.ok || bofa != null,
  }
}

/**
 * @param {object | null | undefined} creditModel — creditCycleBridge UI DTO
 */
export function buildHomeCreditSummary(creditModel) {
  if (!creditModel || typeof creditModel !== "object") {
    return {
      ready: false,
      loading: false,
      cciDisplay: "—",
      cci: null,
      regime: null,
      coverageDisplay: "—",
      pitLabel: null,
      statusLabel: null,
      asOf: null,
      staleNames: [],
      hold: true,
      testSeedOnly: false,
    }
  }

  if (creditModel.testSeedOnly) {
    return {
      ready: false,
      loading: false,
      cciDisplay: "—",
      cci: null,
      regime: null,
      coverageDisplay: "—",
      pitLabel: creditModel.pitLabel || null,
      statusLabel: "테스트 시드 · 표시 보류",
      asOf: null,
      staleNames: [],
      hold: true,
      testSeedOnly: true,
    }
  }

  const cci = readFiniteOrNull(creditModel.cci ?? creditModel.cciScore)
  const coverage = readFiniteOrNull(creditModel.coveragePct ?? creditModel.coverage)
  const coveragePct =
    coverage == null ? null : coverage <= 1 ? Math.round(coverage * 100) : Math.round(coverage)

  /** @type {string[]} */
  let staleNames = []
  if (Array.isArray(creditModel.staleIndicatorNames)) {
    staleNames = creditModel.staleIndicatorNames.filter(Boolean)
  } else if (Array.isArray(creditModel.staleNames)) {
    staleNames = creditModel.staleNames.filter(Boolean)
  } else if (Array.isArray(creditModel.indicators)) {
    staleNames = creditModel.indicators
      .filter(
        (i) =>
          i &&
          i.exposed &&
          !i.licenseRestricted &&
          String(i.quality || "").toUpperCase() === "STALE",
      )
      .map((i) => i.label || i.id)
      .filter(Boolean)
  }

  return {
    ready: cci != null || Boolean(creditModel.asOf || creditModel.asOfDate),
    loading: false,
    cciDisplay: cci == null ? "—" : String(Math.round(cci)),
    cci,
    regime:
      resolveHomeRegimeLabel(creditModel.regime) ||
      resolveHomeRegimeLabel(creditModel.regimeLabel) ||
      null,
    coverageDisplay: coveragePct == null ? "—" : `${coveragePct}%`,
    pitLabel: creditModel.pitLabel || creditModel.pitStatus || null,
    statusLabel: creditModel.statusLabel || creditModel.feedStatus || null,
    asOf: homeDayKey(creditModel.asOf || creditModel.asOfDate),
    staleNames,
    hold: Boolean(creditModel.hold) || cci == null,
    testSeedOnly: false,
  }
}

/**
 * @param {object | null | undefined} dbbPayload
 */
export function buildHomeEtfDbbSummary(dbbPayload) {
  if (!dbbPayload || typeof dbbPayload !== "object") {
    return {
      ready: false,
      loading: false,
      asOf: null,
      candidateCount: 0,
      watchCount: 0,
      topLines: [],
      message: "데이터 없음",
    }
  }

  const rows = Array.isArray(dbbPayload.all) ? dbbPayload.all : []
  const candidates = rows.filter((row) => row?.ok && Number(row.count) >= 3)
  const watch = rows.filter((row) => row?.ok && Number(row.count) === 2)
  const topLines = candidates
    .slice()
    .sort((a, b) => Number(b.count) - Number(a.count))
    .slice(0, 3)
    .map((row) => `${row.symbol} ${row.count}/4`)

  const asOf =
    homeDayKey(dbbPayload.updatedAt) ||
    homeDayKey(rows.find((r) => r?.asOfDate)?.asOfDate) ||
    homeDayKey(rows.find((r) => r?.date)?.date)

  return {
    ready: true,
    loading: false,
    asOf,
    candidateCount: candidates.length,
    watchCount: watch.length,
    topLines,
    message:
      candidates.length > 0
        ? `후보 ${candidates.length}종 · 관심(2/4) ${watch.length}종`
        : watch.length > 0
          ? `매수 후보 없음 · 관심(2/4) ${watch.length}종`
          : "매수 후보 없음",
  }
}

/**
 * @param {object | null | undefined} equityPayload
 */
export function buildHomeEquityDbbSummary(equityPayload) {
  if (!equityPayload || typeof equityPayload !== "object") {
    return {
      ready: false,
      loading: false,
      asOf: null,
      universeCount: 0,
      message: "데이터 없음",
    }
  }

  const universe = Array.isArray(equityPayload.universe) ? equityPayload.universe : []
  const asOf =
    homeDayKey(equityPayload.asOf) ||
    homeDayKey(equityPayload.updatedAt) ||
    homeDayKey(equityPayload.view?.asOf)

  const view = equityPayload.view
  const score = readFiniteOrNull(view?.score)
  const symbol = view?.symbol || null

  let message = "워치리스트 확인"
  if (universe.length > 0) {
    message = `워치리스트 ${universe.length}종`
  }
  if (symbol && score != null && view?.ok) {
    message = `${message} · 선택 ${symbol} ${score}/4`
  } else if (equityPayload.message) {
    message = String(equityPayload.message)
  }

  return {
    ready: Boolean(equityPayload.ok) || universe.length > 0,
    loading: false,
    asOf,
    universeCount: universe.length,
    message,
  }
}

/**
 * Part 1 판단 요약 — 상태·기준일만. Panic/CCI/DBB 점수·수치 합산 금지.
 * @param {{
 *   fear: ReturnType<typeof buildHomeFearSummary>
 *   credit: ReturnType<typeof buildHomeCreditSummary>
 *   fearAsOf?: string | null
 *   creditAsOf?: string | null
 *   today?: string | null
 * }} parts
 */
export function buildHomeJudgmentNarrative(parts) {
  const fear = parts?.fear
  const credit = parts?.credit
  const fearAsOf = homeDayKey(parts?.fearAsOf ?? fear?.asOf)
  const creditAsOf = homeDayKey(parts?.creditAsOf ?? credit?.asOf)
  const today = homeDayKey(parts?.today)

  const fearReady = Boolean(
    fear && (!fear.vix?.missing || !fear.cnn?.missing || fear.putCall?.ok),
  )
  const creditReady = Boolean(credit && credit.cci != null && !credit.testSeedOnly)
  const creditHold = Boolean(credit?.hold) || !creditReady
  const creditStale = Boolean(credit?.staleNames?.length)

  /** @type {string[]} */
  const lines = []

  if (fearReady) {
    lines.push("시장 공포 지표를 확인할 수 있습니다. 상세 수치는 아래 시장 공포에서 봅니다.")
  } else {
    lines.push("시장 공포 핵심 지표가 부족해 이 축의 판단을 유보합니다.")
  }

  if (creditReady) {
    const bits = ["신용 사이클(License-safe) 관측이 있습니다"]
    if (credit.pitLabel) bits.push(String(credit.pitLabel))
    if (creditStale) bits.push("일부 채널 STALE")
    if (creditHold) bits.push("해석 보류 상태")
    lines.push(`${bits.join(" · ")}. Panic·DBB와 점수를 합산하지 않습니다.`)
  } else if (credit?.testSeedOnly) {
    lines.push("신용 사이클은 테스트 시드만 있어 시장 관측으로 표시하지 않습니다.")
  } else if (credit?.loading) {
    lines.push("신용 사이클 데이터를 불러오는 중입니다.")
  } else {
    lines.push("신용 사이클을 아직 확정할 수 없어 이 축의 판단을 유보합니다.")
  }

  if (fearAsOf && creditAsOf && fearAsOf !== creditAsOf) {
    lines.push(
      `공포 기준일 ${fearAsOf}, 신용 기준일 ${creditAsOf}로 시점이 다릅니다. 최신 업데이트를 확인해 주세요.`,
    )
  } else if (fearAsOf || creditAsOf) {
    const asOf = fearAsOf || creditAsOf
    const delayed = today && asOf && asOf < today
    lines.push(
      delayed
        ? `데이터 기준일 ${asOf} · 오늘(${today}) 대비 지연이 있습니다.`
        : `데이터 기준일 ${asOf} 기준으로 축별 상태를 확인하세요.`,
    )
  } else {
    lines.push("축별 기준일을 아직 확정하지 못했습니다.")
  }

  const deferred = !fearReady || !creditReady
  let headline
  if (!fearReady && !creditReady) {
    headline = "현재 데이터만으로 종합 판단하기 어렵습니다."
  } else if (deferred) {
    headline = "일부 축 데이터가 부족해 종합 판단을 유보합니다."
  } else if (fearAsOf && creditAsOf && fearAsOf !== creditAsOf) {
    headline = "일부 데이터의 기준일이 다르므로 최신 업데이트를 확인해 주세요."
  } else {
    headline = "시장 공포 지표와 신용 사이클을 각각 확인할 수 있습니다."
  }

  return {
    deferred,
    fearReady,
    creditReady,
    fearAsOf,
    creditAsOf,
    lines,
    headline,
  }
}

/**
 * 헤더용 기준일 안내 문구.
 * @param {{
 *   fearAsOf?: string | null
 *   creditAsOf?: string | null
 *   today?: string | null
 * }} input
 */
export function buildHomeHeaderAsOfLabel(input) {
  const fearAsOf = homeDayKey(input?.fearAsOf)
  const creditAsOf = homeDayKey(input?.creditAsOf)
  const today = homeDayKey(input?.today)
  const latest = pickHomeHeaderAsOf([fearAsOf, creditAsOf])

  if (!latest) {
    return {
      text: "데이터 기준일을 확인하는 중…",
      delayed: false,
      asOf: null,
      mixed: false,
    }
  }

  const mixed = Boolean(fearAsOf && creditAsOf && fearAsOf !== creditAsOf)
  const delayed = Boolean(today && latest < today)

  if (mixed) {
    return {
      text: `공포 ${fearAsOf} · 신용 ${creditAsOf}${delayed ? ` · 지연 (오늘 ${today})` : ""}`,
      delayed,
      asOf: latest,
      mixed: true,
    }
  }

  return {
    text: delayed
      ? `데이터 기준일 ${latest} · 지연 (오늘 ${today})`
      : `데이터 기준일 ${latest}`,
    delayed,
    asOf: latest,
    mixed: false,
  }
}

/**
 * @param {{
 *   isLoggedIn: boolean
 *   holdingCount: number
 *   cashBalance: number | null
 *   syncMode?: string | null
 * }} input
 */
export function buildHomePortfolioSummary(input) {
  const isLoggedIn = Boolean(input?.isLoggedIn)
  const holdingCount = Math.max(0, Number(input?.holdingCount) || 0)
  const cash = readFiniteOrNull(input?.cashBalance)

  if (!isLoggedIn) {
    return {
      mode: "guest",
      title: "내 투자",
      body: "로그인하면 실제 보유·매매 요약을 확인할 수 있습니다.",
      cta: "포트폴리오 열기",
      holdingCount: 0,
      showNumbers: false,
    }
  }

  if (holdingCount <= 0 && cash == null) {
    return {
      mode: "empty",
      title: "내 투자",
      body: "등록된 보유가 없습니다. 포트폴리오에서 계좌를 확인하세요.",
      cta: "포트폴리오 열기",
      holdingCount: 0,
      showNumbers: false,
    }
  }

  return {
    mode: "ready",
    title: "내 투자",
    body: `보유 ${holdingCount}종${cash != null ? " · 현금 입력됨" : ""}`,
    cta: "포트폴리오 상세",
    holdingCount,
    showNumbers: true,
    syncMode: input?.syncMode || null,
  }
}

/**
 * @param {Array<string | null | undefined>} dates
 */
export function pickHomeHeaderAsOf(dates) {
  const keys = (Array.isArray(dates) ? dates : [])
    .map((d) => homeDayKey(d))
    .filter(Boolean)
    .sort()
  if (!keys.length) return null
  return keys[keys.length - 1]
}
