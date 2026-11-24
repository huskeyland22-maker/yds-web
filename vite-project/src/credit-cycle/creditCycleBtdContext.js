/**
 * Credit Cycle × Buy-the-Dip joint context — side-by-side only.
 * Never merges CCI into DBB N/4 score. Never invents auto buy/sell rules.
 */

/** FREE-visible macro context on Buy-the-Dip pages. */
export const CC_BTD_FREE_VISIBLE = Object.freeze([
  "cci_level",
  "as_of_date",
  "coverage_pct",
  "pit_label",
  "stale_indicator_names",
  "credit_summary_lines",
  "joint_compare_note",
  "link_to_credit_cycle",
  "independence_disclaimer",
])

/**
 * Future Premium cross-analysis surface — structured for gating later.
 * Phase 14 does NOT lock payment or redact these server-side.
 */
export const CC_BTD_PREMIUM_ONLY = Object.freeze([
  "cross_regime_vs_dbb_stage",
  "indicator_weight_breakdown",
  "historical_similar_credit_windows",
  "buy_stage_credit_risk_notes",
])

export const CC_BTD_INDEPENDENCE = Object.freeze({
  scoresMerged: false,
  cciIsBuySellSignal: false,
  note:
    "시장 매수 기회(DBB N/4)와 신용 위험 환경(CCI)은 독립 축입니다. 점수를 더하거나 빼지 않습니다.",
})

/**
 * @param {object | null | undefined} ccModel — loadCreditCycleUiModel() DTO
 * @param {{
 *   product?: "etf" | "equity" | "generic",
 *   symbol?: string | null,
 *   scoreNOf4?: number | null,
 *   stageLabel?: string | null,
 *   buyOk?: boolean,
 *   priceAsOf?: string | null,
 * } | null} [buySide]
 */
export function buildCreditCycleBtdContext(ccModel, buySide = null) {
  const credit = buildCreditEnvironment(ccModel)
  const market = buildMarketOpportunity(buySide)
  const joint = buildJointReference(credit, market)

  return {
    schemaVersion: 1,
    independence: { ...CC_BTD_INDEPENDENCE },
    marketOpportunity: market,
    creditEnvironment: credit,
    jointReference: joint,
    premium: {
      /** Design flag only — UI may show teaser; no payment lock in Phase 14. */
      gateEnabled: false,
      freeVisible: [...CC_BTD_FREE_VISIBLE],
      premiumOnly: [...CC_BTD_PREMIUM_ONLY],
      teaserTitle: "Premium 교차 분석 (예정)",
      teaserBody:
        "향후 Premium에서 신용 환경×매수 단계 교차 해석, 지표 가중 분해, 유사 환경 비교를 제공할 수 있도록 구조를 열어 두었습니다. 지금은 잠금·결제를 적용하지 않습니다.",
      items: [
        "신용 위험과 시장 매수 기회의 교차 분석",
        "지표별 가중 분석",
        "과거 유사 환경 비교",
        "매수 단계별 위험 설명",
      ],
    },
    links: {
      creditCycle: "/credit-cycle",
      dailyBottomBuy: "/daily-bottom-buy",
      equityDailyBottomBuy: "/equity-daily-bottom-buy",
    },
  }
}

function buildMarketOpportunity(buySide) {
  if (!buySide || typeof buySide !== "object") {
    return {
      available: false,
      product: "generic",
      symbol: null,
      scoreNOf4: null,
      stageLabel: null,
      priceAsOf: null,
      summary: "선택된 종목의 Buy-the-Dip 결과가 있으면 여기에 표시됩니다.",
    }
  }
  const score =
    buySide.scoreNOf4 == null || !Number.isFinite(Number(buySide.scoreNOf4))
      ? null
      : Number(buySide.scoreNOf4)
  const ok = buySide.buyOk !== false && score != null
  return {
    available: ok,
    product: buySide.product || "generic",
    symbol: buySide.symbol || null,
    scoreNOf4: score,
    stageLabel: buySide.stageLabel || null,
    priceAsOf: buySide.priceAsOf || null,
    summary: ok
      ? `${buySide.symbol || "종목"} · DBB ${score}/4` +
        (buySide.stageLabel ? ` · ${buySide.stageLabel}` : "")
      : "Buy-the-Dip 상세를 아직 확정할 수 없습니다.",
  }
}

function buildCreditEnvironment(ccModel) {
  if (!ccModel || typeof ccModel !== "object") {
    return {
      available: false,
      asOf: null,
      cci: null,
      coveragePct: null,
      pitLabel: null,
      feedStatus: null,
      statusLabel: "신용 데이터 준비 중",
      hold: true,
      staleIndicators: [],
      validIndicators: [],
      hyBbbRestricted: true,
      testSeedOnly: false,
      summaryLines: [
        "신용 사이클 관측을 불러오지 못했습니다. 임의 추정하지 않습니다.",
      ],
    }
  }

  const exposed = (ccModel.indicators || []).filter(
    (i) => i && i.exposed && !i.licenseRestricted,
  )
  const staleIndicators = exposed
    .filter((i) => String(i.quality).toUpperCase() === "STALE")
    .map((i) => ({ id: i.id, label: i.label || i.id }))
  const validIndicators = exposed
    .filter((i) => String(i.quality).toUpperCase() === "VALID")
    .map((i) => ({ id: i.id, label: i.label || i.id }))

  const available =
    !ccModel.testSeedOnly &&
    ccModel.cci != null &&
    Number.isFinite(Number(ccModel.cci))

  /** @type {string[]} */
  const summaryLines = []
  if (ccModel.testSeedOnly) {
    summaryLines.push(
      "Staging 테스트 시드만 감지되어 시장 신용 관측으로 표시하지 않습니다.",
    )
  } else if (available) {
    summaryLines.push(
      `License-safe CCI ${ccModel.cci} · 기준일 ${ccModel.asOf || "—"} · ${ccModel.pitLabel || "PIT 미확인"}`,
    )
  } else {
    summaryLines.push("CCI를 확정 표시할 수 없어 신용 환경을 보류합니다.")
  }
  if (ccModel.coveragePct != null) {
    summaryLines.push(`Coverage ${ccModel.coveragePct}%`)
  }
  if (staleIndicators.length) {
    summaryLines.push(
      `STALE: ${staleIndicators.map((s) => s.label).join(", ")} · 해당 채널 최신성 주의`,
    )
  }
  if (validIndicators.length) {
    summaryLines.push(`VALID 공개 지표 ${validIndicators.length}개`)
  }
  summaryLines.push("HY·BBB 수치는 비공개 · License-safe 경로에 미포함")
  summaryLines.push("CCI는 매수·매도 신호가 아닙니다.")

  return {
    available,
    asOf: ccModel.asOf || null,
    cci: available ? ccModel.cci : null,
    coveragePct: ccModel.coveragePct ?? null,
    pitLabel: ccModel.pitLabel || null,
    feedStatus: ccModel.feedStatus || null,
    statusLabel: ccModel.statusLabel || null,
    hold: Boolean(ccModel.hold) || !available,
    staleIndicators,
    validIndicators,
    hyBbbRestricted: true,
    testSeedOnly: Boolean(ccModel.testSeedOnly),
    feedIsStaging: String(ccModel.feedStatus || "") === "STAGING_API",
    summaryLines,
  }
}

function buildJointReference(credit, market) {
  const compareLines = [
    "왼쪽(또는 상단): Buy-the-Dip 가격·기술 조건. 오른쪽(또는 하단): 신용 사이클 환경.",
    CC_BTD_INDEPENDENCE.note,
  ]
  if (market.available) {
    compareLines.push(`시장 매수 기회 요약: ${market.summary}`)
  }
  if (credit.available) {
    compareLines.push(
      `신용 환경 요약: CCI ${credit.cci} (${credit.asOf || "—"}) · ${credit.pitLabel || "—"}`,
    )
  } else {
    compareLines.push("신용 환경 데이터가 없으므로 매수 기회만 독립적으로 해석하세요.")
  }

  /** Always-on investor checks — not auto rules keyed to CCI cutoffs. */
  const additionalChecks = [
    "가격 하락 원인(수급·심리·펀더멘털)과 신용 지표 변화를 같은 점수로 합치지 마세요.",
    "분할 매수 규모·간격은 DBB 단계와 별도로, 유동성·레버리지·보유 비중을 확인하세요.",
    "Panic 심리 지표와도 합산하지 않습니다.",
  ]

  const whenCreditDataWeak = []
  if (credit.hold || !credit.available) {
    whenCreditDataWeak.push(
      "신용 CCI가 없거나 HOLD이면 신용 환경은 ‘확인 불가’로 두고, 매수 기회만으로 저점을 단정하지 마세요.",
    )
  }
  if (credit.staleIndicators?.length) {
    whenCreditDataWeak.push(
      `STALE 지표(${credit.staleIndicators.map((s) => s.label).join(", ")})가 있으면 은행·분기 채널의 최신성을 추가로 확인하세요.`,
    )
  }
  if (credit.pitLabel === "NON_PIT") {
    whenCreditDataWeak.push(
      "NON_PIT 표시이므로 당시 실시간 가용 정보와 다를 수 있습니다.",
    )
  }

  const whenReviewingDip = [
    "신용 긴축·건전성·연체 채널이 동시에 악화하는 징후가 있으면 매수 규모를 보수적으로 재검토하세요.",
    "신용 여건이 안정적으로 보여도 밸류에이션·유동성·DBB 조건은 그대로 확인하세요.",
    "신용 위험 개선과 가격 선반영은 별개일 수 있습니다.",
  ]

  return {
    compareLines,
    additionalChecks,
    whenCreditDataWeak,
    whenReviewingDip,
    noAutoAction:
      "검증되지 않은 임계값으로 자동 매수·매도 조건을 만들지 않습니다.",
  }
}

/**
 * Assert joint context never invents a merged score field.
 * @param {ReturnType<typeof buildCreditCycleBtdContext>} ctx
 */
export function assertBtdCreditIndependence(ctx) {
  if (!ctx || ctx.independence?.scoresMerged !== false) return false
  if (ctx.independence?.cciIsBuySellSignal !== false) return false
  const blob = JSON.stringify(ctx)
  if (/"mergedScore"\s*:/.test(blob) || /"cciAdjustedBuyScore"\s*:/.test(blob)) {
    return false
  }
  return true
}
