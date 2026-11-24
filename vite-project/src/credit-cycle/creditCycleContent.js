/** Static copy + analysis helpers for Credit Cycle UI — not trading signals. */

export const TABS = [
  { id: "overview", label: "종합 현황" },
  { id: "indicators", label: "지표 상세" },
  { id: "history", label: "과거 비교" },
  { id: "strategy", label: "전략 연결" },
]

export const ANALYSIS_LENSES = [
  { id: "fact", label: "확인된 사실" },
  { id: "interpretation", label: "해석" },
  { id: "unknown", label: "아직 확인 불가" },
]

export const REGIME_GUIDE = [
  {
    id: "Expansion",
    title: "Expansion",
    meaning: "신용 여건이 비교적 안정적이고 위험 점수가 낮은 구간으로 해석됩니다.",
    traits: "스프레드·연체·긴축 압력이 낮게 유지되는 경향",
    riskDirection: "시스템 신용위험이 낮은 편",
    investorCheck: "기존 매수 계획과 가격·유동성을 함께 확인",
  },
  {
    id: "Overheating",
    title: "Overheating",
    meaning: "위험이 중간대에서 상승하는 과열·경계 구간입니다.",
    traits: "일부 지표 악화, 아직 전면 위축은 아님",
    riskDirection: "악화 쪽으로 기울 수 있음",
    investorCheck: "주도 지표와 Coverage를 점검",
  },
  {
    id: "Tightening",
    title: "Tightening",
    meaning: "금융여건 긴축·신용위험 상승이 확인되는 구간입니다.",
    traits: "대출 태도 강화, 연체·스프레드 압력 동반 가능",
    riskDirection: "신용위험 상승",
    investorCheck: "매수 규모·분할과 유동성 버퍼 재검토",
  },
  {
    id: "Crisis",
    title: "Crisis",
    meaning: "신용·유동성 스트레스가 매우 높은 구간입니다.",
    traits: "다수 지표 동시 악화 가능",
    riskDirection: "금융시스템 위험 우선",
    investorCheck: "성급한 저점 확신 금지 · 시스템 리스크 확인",
  },
  {
    id: "Recovery",
    title: "Recovery",
    meaning: "스트레스 이후 위험이 완화되는 회복 구간입니다.",
    traits: "점수 하락·개선 모멘텀",
    riskDirection: "완화 방향이나 가격 선반영 가능",
    investorCheck: "완화 여부 vs 시장 가격을 분리해 확인",
  },
]

/** Reading frames only — not buy/sell rules. */
export const STRATEGY_FRAMES = [
  {
    id: "tightening_watch",
    title: "신용 긴축이 심해질 때",
    points: [
      "대출 태도·연체·은행 건전성 등 공급 측 지표가 함께 악화하는지 확인합니다.",
      "가격 하락만으로 저점을 단정하지 말고, 유동성·차입 여건을 함께 봅니다.",
      "Buy-the-Dip 분할 규모·간격을 재검토할 참고 자료로만 사용합니다.",
    ],
  },
  {
    id: "stable_credit",
    title: "신용 여건이 안정될 때",
    points: [
      "CCI·구성 지표가 안정적이어도 밸류에이션·수급·유동성은 별도로 확인합니다.",
      "데이터 발표 지연(분기 지표·STALE)이 없는지 Coverage와 품질을 봅니다.",
      "안정이 ‘매수 신호’가 되지 않도록 가격 계획과 분리해 읽습니다.",
    ],
  },
  {
    id: "price_with_credit",
    title: "신용 위험과 가격 하락을 함께 볼 때",
    points: [
      "가격 조정은 Panic·수급 요인일 수 있고, 신용 스트레스와 원인이 다를 수 있습니다.",
      "신용 지표 악화와 가격 하락이 동시에 나타나면 시스템 리스크를 우선 점검합니다.",
      "둘을 합산 점수로 만들지 말고, 각자 무엇을 말하는지 나란히 비교합니다.",
    ],
  },
  {
    id: "btd_role",
    title: "저점 매수 전략에서 신용 지표의 역할",
    points: [
      "Credit Cycle은 Buy-the-Dip의 보조 판단 자료입니다. 진입 트리거가 아닙니다.",
      "신용 환경이 악화·불확실하면 매수 규모와 현금 버퍼를 보수적으로 재검토합니다.",
      "CCI 하나로 매수·매도를 결정하는 기능은 제공하지 않습니다.",
    ],
  },
]

export const STRATEGY_LINK_INTRO = {
  role: "신용 사이클 분석은 YDS 저점 매수(Buy-the-Dip) 전략의 보조 맥락입니다. 시장 가격·심리(Panic)와 독립적으로 읽되, 점수를 합산하지 않습니다.",
  notSignal:
    "CCI·국면·체크리스트는 매매 신호가 아닙니다. 검증되지 않은 임계값으로 자동 매수·매도를 만들지 않습니다.",
  nextStep:
    "가격 조정 구간의 분할 매수 계획은 ETF 조정 매수·패닉·공포 매수 허브에서 확인하고, 여기서는 신용 여건만 점검합니다.",
}

export const HISTORY_COMPARE_COPY = {
  intro:
    "아래 시계열은 License-safe CCI의 과거 관측(주로 NON_PIT)입니다. 당시 투자자가 실시간으로 알 수 있었던 PIT 정보처럼 표현하지 않습니다.",
  limits: [
    "과거 구간과의 유사점은 형태 비교일 뿐, 침체·수익률 예측이 아닙니다.",
    "NON_PIT 수치는 이후 개정·발표 지연이 반영된 current vintage일 수 있습니다.",
    "연구용 위기 에피소드(COVID·2022–23·GFC)는 참고 레이어이며 상단 Staging 실데이터와 혼동하지 않습니다.",
  ],
  noForecast: "검증되지 않은 경기 침체 예측·미래 수익률 전망은 표시하지 않습니다.",
}

export const INDICATOR_DETAIL_COPY = {
  hy: {
    meaning: "투기등급 회사채 신용 스프레드. 위험선호와 부도 우려에 민감합니다.",
    market: "확대 시 신용 스트레스·위험회피 심화를 시사할 수 있습니다.",
    role: "Research CCI 구성 후보이나, License-safe 제품 경로에서는 수치를 노출하지 않습니다.",
    riskMeaning: "위험 점수·원시값이 비공개이므로 현재 CCI에 직접 기여하지 않은 것으로 표시됩니다.",
    fact: "HY 수치는 ICE 라이선스 확인 전까지 화면에 표시하지 않습니다.",
    interpretation: "스프레드 확대는 일반적으로 위험회피·부도 우려와 관련되나, 여기서는 관측값을 확인할 수 없습니다.",
    unknown: "현재 HY가 License-safe CCI에 미쳤을 가상의 기여도는 알 수 없습니다.",
    cciNote: "Research CCI에만 포함. License-safe 제품 수치에는 미포함.",
    source: "ICE BofA via FRED (라이선스 확인 필요)",
    caution: "ICE 라이선스 해소 전까지 일반 화면에 수치·시계열을 노출하지 않습니다.",
  },
  bbb: {
    meaning: "BBB 등급 회사채 스프레드. 투자등급 채널의 신용 프리미엄입니다.",
    market: "HY보다 완만하나 시스템 스트레스 시 동반 확대될 수 있습니다.",
    role: "Research CCI 구성 후보이나, License-safe 제품 경로에서는 수치를 노출하지 않습니다.",
    riskMeaning: "위험 점수·원시값이 비공개이므로 현재 CCI에 직접 기여하지 않은 것으로 표시됩니다.",
    fact: "BBB 수치는 ICE 라이선스 확인 전까지 화면에 표시하지 않습니다.",
    interpretation: "투자등급 스프레드는 시스템 스트레스의 완만한 채널로 읽히나, 여기서는 관측값을 확인할 수 없습니다.",
    unknown: "현재 BBB가 License-safe CCI에 미쳤을 가상의 기여도는 알 수 없습니다.",
    cciNote: "Research CCI에만 포함. License-safe 제품 수치에는 미포함.",
    source: "ICE BofA via FRED (라이선스 확인 필요)",
    caution: "ICE 라이선스 해소 전까지 일반 화면에 수치·시계열을 노출하지 않습니다.",
  },
  sloos: {
    meaning: "연준 SLOOS 기업대출 태도. 은행이 대출 조건을 강화하는지 보여줍니다.",
    market: "강화(상승)는 신용공급 긴축·실물 부담 확대를 시사할 수 있습니다.",
    role: "신용 공급 여건을 대표하는 License-safe CCI 구성 지표입니다.",
    riskMeaning:
      "위험 점수가 높을수록 은행 대출 태도 긴축이 상대적으로 강한 쪽으로 해석됩니다. 절대 임계값은 확정되지 않았습니다.",
    fact: "분기 공표 지표로, 일별 시장 분위기와 시차가 있습니다.",
    interpretation: "대출 기준 강화는 신용 공급 축소와 실물 부담 확대의 맥락으로 읽을 수 있습니다.",
    unknown: "다음 분기 발표 전 태도 변화, 또는 개별 은행 행태는 이 지표만으로 알 수 없습니다.",
    cciNote: "License-safe CCI 구성 지표. 분기 발표·지연이 큽니다.",
    source: "FRED DRTSCILM",
    caution: "분기 데이터이므로 일별 시장 분위기와 시차가 있습니다.",
  },
  cpff: {
    meaning: "CP−EFFR 등 단기 자금시장 스트레스 대리 지표입니다.",
    market: "급등 시 CP·단기 유동성 긴장을 나타낼 수 있습니다.",
    role: "단기 자금시장 유동성 긴장을 License-safe CCI에 반영합니다.",
    riskMeaning:
      "위험 점수가 높을수록 단기 자금시장 스트레스가 상대적으로 큰 쪽으로 해석됩니다. 단독 과대해석을 피합니다.",
    fact: "CP와 정책금리 사이의 스프레드 계열을 사용합니다.",
    interpretation: "급등은 CP·단기 유동성 긴장의 맥락으로 볼 수 있으나, 평시에는 변동이 작을 수 있습니다.",
    unknown: "개별 발행사·시장 미시구조 충격은 포착하지 못할 수 있습니다.",
    cciNote: "License-safe CCI 구성 지표.",
    source: "FRED CPFF 계열",
    caution: "위기 시에 의미가 커질 수 있어 단독 과대해석을 피합니다.",
  },
  bank: {
    meaning: "FDIC 산업집계 기반 은행 건전성 위험 점수입니다.",
    market: "자본·연체·상각·충당 압력이 커지면 상승합니다.",
    role: "은행 시스템 건전성 채널을 License-safe CCI에 반영합니다. 개별 은행 추천이 아닙니다.",
    riskMeaning:
      "위험 점수는 FDIC 산업집계 비율을 합성한 0–100 점수입니다. 개별 종목 추천·예금 안전 판정이 아닙니다.",
    fact: "관측이 STALE이면 최신 분기 반영이 늦었을 수 있어 신선도가 떨어집니다.",
    interpretation: "산업집계 악화는 시스템 건전성 압력의 맥락으로 읽되, STALE이면 해석을 보수적으로 둡니다.",
    unknown: "개별 은행·지역 편차, 차기 분기 개선·악화는 이 점수만으로 확정할 수 없습니다.",
    cciNote: "License-safe CCI. Σnum/Σden 산업집계. 개별 은행 추천이 아닙니다.",
    source: "FDIC SOD/Call Report aggregates",
    caution: "STALE 상태에서는 ‘최신 건전성’으로 단정하지 마세요. 시대별 자본 지표 정의 차이도 있습니다.",
  },
  cre: {
    meaning: "상업용 부동산 대출 연체율입니다.",
    market: "CRE 담보·지역은행 채널 위험을 반영합니다.",
    role: "상업용 부동산 신용 악화 압력을 License-safe CCI에 반영합니다.",
    riskMeaning:
      "위험 점수가 높을수록 CRE 연체 압력이 상대적으로 큰 쪽으로 해석됩니다. 지역·용도별 편차는 포함되지 않습니다.",
    fact: "분기 발표 지연이 있는 연체율 계열입니다.",
    interpretation: "CRE 연체 상승은 담보·지역은행 채널 위험의 맥락으로 읽을 수 있습니다.",
    unknown: "특정 도시·자산 유형의 부실 집중 여부는 이 지표만으로 알 수 없습니다.",
    cciNote: "License-safe CCI 구성 지표.",
    source: "FRED DRCRELEXFACBS",
    caution: "분기 발표 지연을 감안해 해석합니다.",
  },
  corp_delinq: {
    meaning: "기업(사업) 대출 연체율입니다.",
    market: "실물 기업 신용 악화 신호를 봅니다.",
    role: "기업 대출 연체 채널을 License-safe CCI에 반영합니다.",
    riskMeaning:
      "위험 점수가 높을수록 기업 연체 압력이 상대적으로 큰 쪽으로 해석됩니다. Charge-off와 이중 가중하지 않습니다.",
    fact: "사업 대출 연체율 계열을 사용하며, 상각과 중복 가중하지 않습니다.",
    interpretation: "연체 상승은 실물 기업 신용 악화의 맥락으로 읽을 수 있습니다.",
    unknown: "업종별·규모별 부실 분포와 회수 전망은 알 수 없습니다.",
    cciNote: "License-safe CCI. Charge-off와 이중 가중하지 않습니다.",
    source: "FRED DRBLACBS",
    caution: "연체와 상각을 같은 가중으로 중복 반영하지 않습니다.",
  },
}

/**
 * Structured summary analysis from live UI model.
 * Does not invent buy/sell zones or unverified cutoffs for CCI.
 * @param {object} model
 */
export function buildSummaryAnalysis(model) {
  const exposed = (model?.indicators || []).filter((i) => i.exposed && !i.licenseRestricted)
  const stale = exposed.filter((i) => String(i.quality).toUpperCase() === "STALE")
  const valid = exposed.filter((i) => String(i.quality).toUpperCase() === "VALID")
  const leaders = [...exposed]
    .filter((i) => i.riskScore != null)
    .sort((a, b) => Number(b.riskScore) - Number(a.riskScore))
    .slice(0, 2)

  const facts = []
  if (model?.cci != null) {
    facts.push(
      `기준일 ${model.asOf || "—"} 기준 License-safe CCI는 ${model.cci}입니다 (0–100 스케일).`,
    )
  } else {
    facts.push("현재 License-safe CCI를 확정 표시할 수 없습니다.")
  }
  if (model?.coveragePct != null) {
    facts.push(`Coverage ${model.coveragePct}% · 구성 가중치가 관측에 반영된 비중입니다.`)
  }
  facts.push(`데이터 모드: ${model?.pitLabel || "UNKNOWN"} · ${model?.statusLabel || "상태 미확인"}`)
  if (valid.length || stale.length) {
    facts.push(
      `공개 지표 품질: VALID ${valid.length}개` +
        (stale.length ? ` · STALE ${stale.map((s) => s.label).join(", ")}` : "") +
        ".",
    )
  }
  facts.push("HY·BBB 수치는 라이선스 제한으로 비공개이며 License-safe CCI에 포함되지 않습니다.")

  const interpretation = []
  if (model?.cci != null) {
    interpretation.push(
      "CCI는 여러 license-safe 지표의 위험 점수를 가중 종합한 관측값입니다. 특정 구간을 안전·위험·매수로 단정하지 않습니다.",
    )
  }
  if (model?.cciDelta != null && model.cci != null) {
    interpretation.push(
      model.cciDelta > 0
        ? `직전 대비 ${model.cciDelta}p 상승은 위험 점수 합산이 높아진 방향입니다.`
        : model.cciDelta < 0
          ? `직전 대비 ${Math.abs(model.cciDelta)}p 하락은 위험 점수 합산이 낮아진 방향입니다.`
          : "직전 대비 CCI 변화가 크지 않습니다.",
    )
  }
  if (leaders.length) {
    interpretation.push(
      `상대적으로 위험 점수가 높은 공개 지표: ${leaders
        .map((l) => `${l.label}(${l.riskScore})`)
        .join(", ")}.`,
    )
  }
  if (stale.length) {
    interpretation.push(
      `${stale.map((s) => s.label).join(", ")}이(가) STALE이므로 해당 채널의 최신성을 낮게 보고 해석합니다.`,
    )
  }
  if (model?.regime?.id) {
    interpretation.push(
      `엔진 국면 가설: ${model.regime.id}. 국면은 경고 단계·매매 신호와 다른 개념입니다.`,
    )
  } else {
    interpretation.push("국면이 미확정이므로 국면 라벨에 의존하지 않고 지표·Coverage를 직접 확인합니다.")
  }

  const unknown = [
    "이 CCI가 향후 수익률·경기 침체를 예측하는지는 검증되지 않았습니다.",
    "PIT(당시 가용 정보) 기준이면 수치가 달라질 수 있으며, 현재 표시는 NON_PIT일 수 있습니다.",
    "HY·BBB 채널과 Panic(VIX·CNN·Put/Call) 기여는 이 화면에서 확인·합산하지 않습니다.",
    "생산용 경고 임계값은 INSUFFICIENT_EVIDENCE로 확정되지 않았습니다.",
  ]

  return { facts, interpretation, unknown }
}

/**
 * Descriptive stats for CCI path — no forecasts.
 * @param {Array<{ asOf?: string, cci?: number|null }>|null|undefined} path
 */
export function summarizeCciPath(path) {
  const pts = (path || []).filter((p) => p && p.cci != null && Number.isFinite(Number(p.cci)))
  if (!pts.length) {
    return {
      count: 0,
      min: null,
      max: null,
      latest: null,
      earliest: null,
      note: "비교 가능한 CCI 시계열이 없습니다.",
    }
  }
  let min = pts[0]
  let max = pts[0]
  for (const p of pts) {
    if (Number(p.cci) < Number(min.cci)) min = p
    if (Number(p.cci) > Number(max.cci)) max = p
  }
  const latest = pts[pts.length - 1]
  const earliest = pts[0]
  return {
    count: pts.length,
    min: { asOf: min.asOf, cci: min.cci },
    max: { asOf: max.asOf, cci: max.cci },
    latest: { asOf: latest.asOf, cci: latest.cci },
    earliest: { asOf: earliest.asOf, cci: earliest.cci },
    note: `${pts.length}개 관측 · 최저 ${min.cci}(${min.asOf}) · 최고 ${max.cci}(${max.asOf}) · 형태 비교용이며 예측이 아닙니다.`,
  }
}

/**
 * @param {object} model
 * @param {object} row indicator row
 */
export function buildIndicatorAnalysis(model, row) {
  const copy = INDICATOR_DETAIL_COPY[row?.id] || {}
  const facts = []
  const interpretation = []
  const unknown = []

  if (row?.licenseRestricted) {
    facts.push(copy.fact || "이 지표의 수치는 라이선스 제한으로 비공개입니다.")
    interpretation.push(copy.interpretation || copy.market || "")
    unknown.push(copy.unknown || "비공개 채널의 현재 기여도는 알 수 없습니다.")
    return { facts: facts.filter(Boolean), interpretation: interpretation.filter(Boolean), unknown: unknown.filter(Boolean), copy }
  }

  if (row?.riskScore != null) {
    facts.push(`현재 위험 점수 ${row.riskScore} (0–100).`)
  } else {
    facts.push("현재 위험 점수를 표시할 수 없습니다.")
  }
  facts.push(`데이터 상태: ${row?.statusLabel || row?.quality || "—"}`)
  facts.push(`관측일: ${row?.observationDate || row?.asOf || model?.asOf || "—"}`)
  if (row?.contribution != null) {
    facts.push(`CCI 가중 기여(표시용): ${row.contribution}`)
  }
  if (String(row?.quality).toUpperCase() === "STALE") {
    facts.push("품질 STALE: 관측이 기준일 대비 오래되었거나 갱신이 지연된 상태입니다.")
  }
  if (copy.fact) facts.push(copy.fact)

  if (copy.riskMeaning) interpretation.push(copy.riskMeaning)
  if (copy.interpretation) interpretation.push(copy.interpretation)
  if (copy.role) interpretation.push(`CCI 역할: ${copy.role}`)

  if (copy.unknown) unknown.push(copy.unknown)
  unknown.push("위험 점수의 특정 구간을 매수·매도 기준으로 쓰지 않습니다.")
  if (model?.pitLabel === "NON_PIT") {
    unknown.push("NON_PIT 표시이므로 당시 실시간 가용 정보와 다를 수 있습니다.")
  }

  return { facts, interpretation, unknown, copy }
}
