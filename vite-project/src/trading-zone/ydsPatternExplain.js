/** 패턴 설명력 — Phase 6 입력 기반 (엔진 미수정) */

export const PATTERN_PROFILE = {
  lehman: {
    emoji: "🏦",
    title: "리먼형",
    tagline: "시스템 위기",
    explain: "신용·유동성 스트레스가 동시에 나타나는 금융위기 유형 패턴입니다.",
  },
  covid: {
    emoji: "😱",
    title: "코로나형",
    tagline: "공포 패닉",
    explain: "VIX·공포지수 급등과 유동성 경색이 겹치는 급락·패닉 국면 패턴입니다.",
  },
  tariff: {
    emoji: "📜",
    title: "관세형",
    tagline: "정책 충격",
    explain: "정책·관세 충격으로 변동성이 확대되고 성장주가 흔들리는 패턴입니다.",
  },
  svb: {
    emoji: "🏛️",
    title: "SVB형",
    tagline: "금융 사고",
    explain: "금융기관 스트레스와 채권·유동성 불안이 동반되는 사고형 패턴입니다.",
  },
  bull: {
    emoji: "🚀",
    title: "강세장형",
    tagline: "유동성 확대",
    explain: "공포 지표가 완화되고 위험자산 선호가 돌아오는 유동성 확대 패턴입니다.",
  },
  yen_carry: {
    emoji: "💴",
    title: "엔캐리형",
    tagline: "환율·금리",
    explain: "엔·달러 금리차와 캐리 청산이 시장 변동성을 키우는 패턴입니다.",
  },
}

/** @type {{ key: string; label: string }[]} */
export const PATTERN_METRIC_CONTRIBUTORS = [
  { key: "cnn", label: "CNN Fear & Greed" },
  { key: "vix", label: "VIX" },
  { key: "move", label: "MOVE" },
  { key: "highYield", label: "High Yield" },
  { key: "putCall", label: "Put/Call" },
  { key: "bofa", label: "BofA" },
  { key: "priA", label: "PRI-A (조기경보)" },
  { key: "priB", label: "PRI-B (충격)" },
]

/**
 * @param {string | null | undefined} patternId
 */
export function getPatternProfile(patternId) {
  if (!patternId) return null
  return PATTERN_PROFILE[/** @type {keyof typeof PATTERN_PROFILE} */ (patternId)] ?? null
}

/**
 * @param {{
 *   patternId: string
 *   similarity: number | null
 *   inputs?: Record<string, number | null | undefined>
 * }} row
 */
export function buildPatternExplainBlock(row) {
  const profile = getPatternProfile(row.patternId)
  /** @type {{ metric: string; note: string; weight: 'high' | 'mid' | 'low' }[]} */
  const contributors = []

  const inp = row.inputs ?? {}
  if (inp.vix != null && inp.vix >= 22) contributors.push({ metric: "VIX", note: `VIX ${inp.vix} — 변동성 확대`, weight: "high" })
  if (inp.cnn != null && inp.cnn <= 25) contributors.push({ metric: "CNN", note: `공포 ${inp.cnn} — 극단 공포`, weight: "high" })
  if (inp.move != null && inp.move >= 120) contributors.push({ metric: "MOVE", note: `MOVE ${inp.move} — 채권 변동`, weight: "mid" })
  if (inp.highYield != null && inp.highYield >= 5) contributors.push({ metric: "HY", note: `하이일드 ${inp.highYield}`, weight: "mid" })
  if (inp.priA != null && inp.priA >= 40) contributors.push({ metric: "PRI-A", note: `조기경보 ${inp.priA}`, weight: "high" })
  if (inp.priB != null && inp.priB >= 45) contributors.push({ metric: "PRI-B", note: `충격 ${inp.priB}`, weight: "high" })

  if (!contributors.length) {
    contributors.push({ metric: "복합", note: "9대 지표 조합 유사도", weight: "mid" })
  }

  return {
    profile,
    similarity: row.similarity,
    whyLines: [
      profile ? `${profile.emoji} ${profile.title} — ${profile.tagline}` : null,
      profile?.explain ?? null,
      row.similarity != null ? `역사 이벤트 대비 유사도 ${Math.round(row.similarity)}%` : null,
    ].filter(Boolean),
    contributors: contributors.slice(0, 5),
  }
}
