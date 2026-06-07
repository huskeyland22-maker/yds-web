/** YDS V1.8 사용자-facing 용어 (엔진 ID는 유지 · UI 라벨만 통일) */

import {
  YDS_BRAND_HERO_TITLE,
  YDS_CYCLE_TAGLINE,
  YDS_STAGE_RAIL_LABELS,
} from "../content/ydsCyclePhilosophy.js"
import {
  YDS_CYCLE_RAIL_LABELS,
  YDS_LABEL_PANIC_SCORE,
  YDS_PANIC_RAIL_LABELS,
} from "../content/ydsLanguage.js"
import { YDS_OG_DESCRIPTION } from "../content/ydsLaunchContent.js"

export const YDS_V1_VERSION = "YDS V1.8"
export const YDS_V1_RC_LABEL = "Release Candidate"

/** @type {Record<string, string>} */
export const TERM_REPLACE = {
  "YDS 총점": YDS_LABEL_PANIC_SCORE,
  "YDS 점수": YDS_LABEL_PANIC_SCORE,
  "YDS SCORE": YDS_LABEL_PANIC_SCORE,
  YDS: YDS_LABEL_PANIC_SCORE,
  과열구간: "공포 없음",
  중립구간: "공포 부족",
  준비구간: "관심",
  관심구간: "관심",
  패닉매수: "인생 타점",
  과열주의: "사이클 후반",
  "PRI-A": "조기경보",
  "PRI-B": "충격감지",
  "PRI-A/B": "조기경보 · 충격감지",
  Regime: "시장 국면",
  regime: "시장 국면",
  Pattern: "위험 패턴",
  pattern: "위험 패턴",
  "Stock Radar": "종목 추천",
  "Sector Radar": "추천 섹터",
  "Entry Radar": "진입 신호",
  Watchlist: "관심종목",
  Research: "연구실",
  Confidence: "신뢰도",
  "Live Pattern Radar": "실시간 위험 패턴",
}

/** @type {{ id: string; title: string; body: string }[]} */
export const GLOSSARY_ENTRIES = [
  {
    id: "cycle-system",
    title: "시장 사이클 투자 시스템",
    body: `${YDS_BRAND_HERO_TITLE}. ${YDS_CYCLE_TAGLINE} 패닉지수만 보는 도구가 아니라, ${YDS_PANIC_RAIL_LABELS} 5단계로 매수 기회를 안내합니다.`,
  },
  {
    id: "market-position",
    title: YDS_LABEL_PANIC_SCORE,
    body: "공포·탐욕 지표를 종합한 0~100 점수입니다. 높을수록 매수 기회에 가깝고, 낮을수록 공포 없음에 가깝습니다. 사이클 위치(100−점수)와 함께 확인하세요.",
  },
  {
    id: "cycle-position",
    title: "사이클 위치",
    body: `${YDS_CYCLE_RAIL_LABELS}. 시장이 경기 사이클 어디쯤 왔는지를 나타냅니다.`,
  },
  {
    id: "prep-zone",
    title: "관심",
    body: "패닉 강도 40–59 구간(엔진 ID: interest). 분할매수 전 단계로 종목 발굴·현금 확보·매수 준비를 권장합니다.",
  },
  {
    id: "five-stages",
    title: "패닉 5단계",
    body: `${YDS_STAGE_RAIL_LABELS}. 🔵 공포 없음=리스크 관리 · 🟢 공포 부족=관찰 · 🟡 관심=쌓기 · 🟠 분할매수=실행 · 🔴 인생 타점=보너스.`,
  },
  {
    id: "cycle-tagline",
    title: "YDS 철학",
    body: YDS_CYCLE_TAGLINE,
  },
  {
    id: "og-share",
    title: "공유용 설명",
    body: YDS_OG_DESCRIPTION,
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
  {
    id: "stock-radar",
    title: "종목 추천 점수",
    body: "V1은 전략 기반 점수입니다. 종합 = 0.4×시장적합 + 0.25×섹터 + 0.2×기술추세 + 0.15×거래량점수. 거래량·RSI·이평은 Trading Zone·PRI 기반 추정이며 실시간 시세는 Phase 26.1 예정입니다. 상세: docs/STOCK_RADAR_SCORING.md",
  },
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
