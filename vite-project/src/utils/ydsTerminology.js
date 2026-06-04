/** YDS V1 사용자-facing 용어 (엔진 ID는 유지 · UI 라벨만 통일) */

export const YDS_V1_VERSION = "YDS V1"
export const YDS_V1_RC_LABEL = "Release Candidate"

/** @type {Record<string, string>} */
export const TERM_REPLACE = {
  YDS: "시장 위치",
  "YDS 점수": "시장 위치 점수",
  "YDS SCORE": "시장 위치",
  "PRI-A": "조기경보",
  "PRI-B": "충격감지",
  "PRI-A/B": "조기경보 · 충격감지",
  Regime: "시장 국면",
  regime: "시장 국면",
  Pattern: "위험 패턴",
  pattern: "위험 패턴",
  "Pattern Radar": "위험 패턴 Radar",
  "Live Pattern Radar": "실시간 위험 패턴",
}

/** @type {{ id: string; title: string; body: string }[]} */
export const GLOSSARY_ENTRIES = [
  {
    id: "market-position",
    title: "시장 위치",
    body: "공포·탐욕 지표를 종합한 0~100 점수입니다. 높을수록 패닉에 가깝고, 낮을수록 과열에 가깝습니다.",
  },
  {
    id: "early-warning",
    title: "조기경보",
    body: "PRI-A에 해당합니다. CNN·채권·변동성 등이 아직 충분히 반영되지 않았을 때 상승하는 선행 경보입니다.",
  },
  {
    id: "shock-detect",
    title: "충격감지",
    body: "PRI-B에 해당합니다. 시장이 이미 급변한 뒤 확인되는 충격 신호입니다.",
  },
  {
    id: "regime",
    title: "시장 국면",
    body: "Regime에 해당합니다. 안정·전환·리스크·패닉 등 거시 환경 분류입니다.",
  },
  {
    id: "pattern",
    title: "위험 패턴",
    body: "Pattern에 해당합니다. 리먼·코로나·관세·SVB·강세장 등 역사적 패닉 프로파일과의 유사도입니다.",
  },
  { id: "lehman", title: "리먼형", body: "2008 금융위기형 패닉 프로파일." },
  { id: "covid", title: "코로나형", body: "2020 급락·급반등형 프로파일." },
  { id: "tariff", title: "관세형", body: "무역·정책 충격형 프로파일." },
  { id: "svb", title: "SVB형", body: "2023 지역은행·유동성 쇼크형 프로파일." },
  { id: "bull", title: "강세장형", body: "공포가 낮고 추세가 양호한 구간 프로파일." },
]

/**
 * @param {number | null | undefined} score
 * @returns {{ level: string; tone: 'high' | 'mid' | 'low' | 'warn' }}
 */
export function resolveConfidenceLevel(score) {
  if (score == null || !Number.isFinite(score)) {
    return { level: "보통", tone: "mid" }
  }
  if (score >= 85) return { level: "매우 높음", tone: "high" }
  if (score >= 70) return { level: "높음", tone: "high" }
  if (score >= 50) return { level: "보통", tone: "mid" }
  return { level: "주의", tone: "warn" }
}

/**
 * @param {string} text
 * @returns {string}
 */
export function applyTerminology(text) {
  if (!text || typeof text !== "string") return text
  let out = text
  const keys = Object.keys(TERM_REPLACE).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    out = out.split(key).join(TERM_REPLACE[key])
  }
  return out
}
