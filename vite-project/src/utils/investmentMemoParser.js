import krxListed from "../data/koreanListedNames.json"

/** KRX 코스피·코스닥·ETF 등 병합명 + 사용자 별칭 */
const STOCK_EXTRA_ALIASES = ["에스티지", "두산 에너빌"]

const STOCK_DICTIONARY = [...new Set([...(krxListed?.names ?? []), ...STOCK_EXTRA_ALIASES])]
const STOCK_SET = new Set(STOCK_DICTIONARY)
/** 긴 이름 우선 포함 매칭(모듈 로드 시 한 번만 정렬) */
const SORTED_STOCK_BY_LEN = [...STOCK_DICTIONARY].sort(
  (a, b) => b.replace(/\s+/g, "").length - a.replace(/\s+/g, "").length,
)

const SECTOR_KEYWORDS = {
  반도체: ["반도체", "메모리", "HBM", "AI칩"],
  원전: ["원전", "SMR", "원자력"],
  "2차전지": ["2차전지", "배터리", "양극재", "리튬"],
  방산: ["방산", "탄약", "미사일", "군수"],
  자동차: ["자동차", "완성차", "전기차"],
}

const SIGNAL_RULES = [
  /** VIX·변동성 문맥 급등은 momentum과 분리 */
  { key: "VIX급등", re: /VIX\s*급등|변동성\s*급등|VIX.*급등|변동성.*급등/i, score: -2 },
  { key: "거래량증가", re: /거래량/, score: 1 },
  { key: "눌림목", re: /눌림|눌림목/, score: 1 },
  { key: "5일선지지", re: /5일선.*지지|오일선.*지지/i, score: 1 },
  { key: "20일선지지", re: /20일선.*지지|이십일선.*지지/i, score: 1 },
  { key: "돌파", re: /돌파|브레이크아웃/i, score: 1 },
  { key: "리스크경고", re: /위험|리스크|경계|조심/i, score: -1 },
  { key: "순환매", re: /순환매|섹터\s*로테이션/i, score: 1 },
  /** 조정 등 약세 키워드 — 눌림목 규칙과 겹치지 않게 후순위에서 제외 처리 */
  { key: "과열경고", re: /과열|너무\s*올랐|부담/i, score: -1 },
  { key: "힘강함", re: /힘\s*좋|쎄다|강함|강한|강하다/i, score: 1 },
  { key: "무거움", re: /무겁다|탄력\s*약|매물/i, score: -1 },
]

function uniqPush(arr, key) {
  if (!arr.includes(key)) arr.push(key)
}

const PANIC_KEYWORDS = ["VIX", "공포", "패닉", "위험", "급락", "하락"]
const MACRO_KEYWORDS = ["금리", "환율", "CPI", "FOMC", "고용", "유가", "달러", "국채"]
const TIME_KEYWORDS = ["오늘", "내일", "이번주", "단기", "중기", "장기", "당장"]
const STRENGTH_KEYWORDS = ["강하게", "매우", "급등", "확실", "강함", "강한"]

function includesAny(text, words) {
  return words.filter((w) => text.toLowerCase().includes(w.toLowerCase()))
}

/** 과열·위험은 별도 경고 칩으로도 노출 */
function inferWarningTags(text) {
  const tags = []
  if (/과열/.test(text)) tags.push("과열")
  if (/위험/.test(text)) tags.push("위험")
  return tags
}

/** VIX 및 거시 키워드 → 카테고리 칩 */
function inferMacroCategories(text) {
  const raw = String(text || "")
  const lower = raw.toLowerCase()
  const set = new Set()
  if (/vix/i.test(raw)) set.add("거시·VIX")
  for (const w of MACRO_KEYWORDS) {
    if (lower.includes(w.toLowerCase())) set.add(`거시·${w}`)
  }
  return [...set]
}

/** 메모 앞 단어에서 종목으로 쓰기 어려운 일반 키워드 */
const FIRST_TOKEN_STOCK_BLACKLIST = new Set([
  "눌림",
  "눌림목",
  "조정",
  "거래량",
  "거래량증가",
  "급등",
  "급락",
  "급증",
  "과열",
  "위험",
  "무겁다",
  "강함",
  "강한",
  "돌파",
  "순환매",
  "로테이션",
  "브레이크아웃",
  "변동성",
  "패닉",
  "공포",
  "지지",
  "이탈",
  "매수",
  "매도",
  "오늘",
  "내일",
  "이번주",
  "장중",
  "장마감",
  "VIX",
  "vix",
  "쎄다",
  "느낌",
  "체감",
  "보임",
  "듯",
  "같은",
  "같아",
  "같음",
  "좋네",
])

function inferSentiment(text) {
  const raw = String(text || "")
  if (!raw.trim()) return "neutral"
  /** 눌림 관찰 + 체감 표현은 ‘관심 종목 긍정 후보’ 톤으로 */
  if (
    /(눌림|눌림목)/.test(raw) &&
    /(?:느낌|체감|보임|듯|(?:같(?:아|네|음|네요|은)?))/.test(raw)
  )
    return "bullish"
  /** 급등·강함·돌파 → bullish 우선 */
  if (/(급등|강함|돌파)/.test(raw)) return "bullish"
  if (/(좋다|강세|상승|매수|기회|지지|힘\s*좋|강한|쎄다)/i.test(raw)) return "bullish"
  /** 위험·과열·무겁다 → bearish (경고 칩과 병행) */
  if (/(위험|과열|무겁다)/.test(raw)) return "bearish"
  if (/(나쁘다|약세|하락|매도|이탈|붕괴|쎄하)/i.test(raw)) return "bearish"
  return "neutral"
}

/** 짧은 한글 종목명은 "토큰 단위"로만 인정 — "두산 에너빌" 이 "두산"만 먼저 잡히는 오탐 방지 */
function rawHasDictionaryName(name, raw) {
  const n = String(name || "").trim()
  if (!n) return false
  if (raw.includes(n)) return true
  if (n.length <= 4 && /[가-힣]/.test(n)) {
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return new RegExp(`(^|\\s)${esc}(?=\\s|$)`).test(raw)
  }
  return false
}

/** 원문·공백 축약 문자열로 사전 매칭. 가장 구체적으로 맞는(긴) 종목을 고른다 */
function inferStockIncluded(text) {
  const raw = String(text || "").trim()
  if (!raw) return null
  const hay = raw.replace(/\s+/g, "")
  const sorted = SORTED_STOCK_BY_LEN

  let best = null
  let bestScore = 0
  const consider = (name, score) => {
    if (score > bestScore) {
      bestScore = score
      best = name
    }
  }

  for (const name of sorted) {
    const needle = name.replace(/\s+/g, "")
    if (!needle.length) continue
    if (rawHasDictionaryName(name, raw)) consider(name, needle.length)
  }

  for (const name of sorted) {
    const needle = name.replace(/\s+/g, "")
    if (needle.length && hay.includes(needle)) consider(name, needle.length)
  }

  for (const name of sorted) {
    const needle = name.replace(/\s+/g, "")
    if (needle.length < 3) continue
    let maxSub = 0
    for (let L = needle.length; L >= 2; L--) {
      const sub = needle.slice(0, L)
      if (hay.includes(sub)) {
        maxSub = L
        break
      }
    }
    if (!maxSub) continue
    if (maxSub < Math.ceil(needle.length * 0.45)) continue
    consider(name, maxSub + needle.length * 0.01)
  }
  return best
}

/** 토큰 중 사전 정확 일치 중 가장 긴 종목명 */
function inferExactListedToken(text) {
  const raw = String(text || "").trim()
  if (!raw) return null
  const tokens = raw.split(/\s+/).map((t) => t.trim()).filter(Boolean)
  let best = null
  let bestLen = 0
  for (const t of tokens) {
    if (STOCK_SET.has(t) && t.length > bestLen) {
      best = t
      bestLen = t.length
    }
  }
  return best
}

/** 임의 토큰이 사전 접두와 유일하게 맞으면 종목 확정 — "급등 효성중공업" 등 문장 속 배치 허용 */
function inferStockUniquePrefixAny(text) {
  const raw = String(text || "").trim()
  const tokens = raw.split(/\s+/).map((t) => t.trim()).filter(Boolean)
  for (const tok of tokens) {
    if (tok.length < 2 || FIRST_TOKEN_STOCK_BLACKLIST.has(tok)) continue
    const norm = tok.toLowerCase()
    const matches = STOCK_DICTIONARY.filter((name) => name.toLowerCase().startsWith(norm))
    if (matches.length === 1) return matches[0]
  }
  return null
}

/** 사전 미매칭 시 길이 순으로 토큰 후보 — 기술 키워드·감탄어는 블랙리스트 */
function inferTrailingEntityHint(text) {
  const tokens = String(text || "")
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
  const sorted = [...tokens].sort(
    (a, b) => b.replace(/\s+/g, "").length - a.replace(/\s+/g, "").length,
  )
  for (const tok of sorted) {
    if (tok.length < 2 || FIRST_TOKEN_STOCK_BLACKLIST.has(tok)) continue
    if (!/[A-Za-z\uAC00-\uD7AF]/.test(tok)) continue
    if (/^[\d.]+%?$/.test(tok)) continue
    return tok
  }
  return null
}

/**
 * 종목 문자열 하나로 통합. tier는 UI 힌트용.
 */
export function inferStockUnified(text) {
  const incl = inferStockIncluded(text)
  if (incl) return { stock: incl, tier: "dict_includes", stockConfidenceNote: null }

  const exactTok = inferExactListedToken(text)
  if (exactTok) return { stock: exactTok, tier: "dict_token", stockConfidenceNote: null }

  const prefAny = inferStockUniquePrefixAny(text)
  if (prefAny) return { stock: prefAny, tier: "dict_prefix", stockConfidenceNote: null }

  const hint = inferTrailingEntityHint(text)
  if (hint) {
    return {
      stock: hint,
      tier: "trailing_hint",
      stockConfidenceNote: "문장에서 추출한 후보 · 사전 미일치 가능",
    }
  }

  return { stock: null, tier: null, stockConfidenceNote: null }
}

function inferStockConfidenceBonus(tier) {
  if (tier === "dict_includes") return 0.15
  if (tier === "dict_token") return 0.14
  if (tier === "dict_prefix") return 0.12
  if (tier === "trailing_hint") return 0.07
  return 0
}

/** 카드 노출용 자연어 라벨(내부 키는 유지) */
const SIGNAL_NATURAL_LABEL = {
  momentum: "급등",
  VIX급등: "VIX 급등",
  거래량증가: "거래량",
}

export function naturalizeSignals(signals) {
  const arr = Array.isArray(signals) ? signals : []
  return arr.map((s) => SIGNAL_NATURAL_LABEL[s] ?? s)
}

function inferSectors(text) {
  const out = []
  for (const [sector, words] of Object.entries(SECTOR_KEYWORDS)) {
    if (words.some((w) => text.toLowerCase().includes(w.toLowerCase()))) out.push(sector)
  }
  return out
}

function inferSignals(text) {
  const raw = String(text || "")
  const out = []
  let score = 0
  for (const rule of SIGNAL_RULES) {
    if (!rule.re.test(raw)) continue
    if (rule.key === "눌림목") {
      if (/조정/.test(raw) && !/눌림|눌림목/.test(raw)) continue
      uniqPush(out, "눌림목")
      score += rule.score
      continue
    }
    uniqPush(out, rule.key)
    score += rule.score
  }

  /** 일반 급등 → momentum (VIX·변동성 급등 제외) */
  const vix급등 = /VIX\s*급등|변동성\s*급등/i.test(raw) || out.includes("VIX급등")
  if (/급등/.test(raw) && !vix급등) {
    uniqPush(out, "momentum")
    score += 1
  }

  return { signals: out, score }
}

export function suggestStocksByPrefix(input) {
  const q = String(input || "").trim().toLowerCase()
  if (!q) return []
  const out = []
  for (const name of STOCK_DICTIONARY) {
    if (name.toLowerCase().includes(q)) {
      out.push(name)
      if (out.length >= 12) break
    }
  }
  return out
}

export function suggestHashTags(input) {
  const text = String(input || "")
  const tags = new Set()
  if (/(반도체|HBM|메모리)/i.test(text)) tags.add("#반도체")
  if (/(원전|SMR|원자력)/i.test(text)) tags.add("#원전")
  if (/(VIX|변동성|패닉)/i.test(text)) tags.add("#리스크")
  if (/(눌림|지지|돌파|거래량)/i.test(text)) tags.add("#기술적분석")
  if (/(순환매|로테이션)/i.test(text)) tags.add("#순환매")
  return [...tags].slice(0, 4)
}

function inferMarketPhase(panicData, sentiment, signalScore) {
  const vix = Number(panicData?.vix)
  const fearGreed = Number(panicData?.fearGreed)
  if (Number.isFinite(vix) && vix >= 32) return "패닉"
  if (Number.isFinite(vix) && vix >= 24) return "공포"
  if (Number.isFinite(fearGreed) && fearGreed >= 75) return "과열"
  if (signalScore >= 2 && sentiment === "bullish") return "순환매 활발"
  return "중립"
}

function inferIntensity(signalScore, confidence) {
  const weighted = signalScore + confidence * 2
  if (weighted >= 2.2) return "강"
  if (weighted >= 1.2) return "중"
  return "약"
}

/** 카드 노출용 high / medium / low */
function deriveStrength({
  sentiment,
  signals,
  warningTags,
  intensityKo,
}) {
  if (sentiment === "bullish" && signals.includes("momentum")) return "high"
  if (sentiment === "bullish" && (signals.includes("돌파") || signals.includes("거래량증가"))) {
    return intensityKo === "약" ? "medium" : "high"
  }
  if (warningTags?.length >= 2 || (sentiment === "bearish" && signals.includes("리스크경고"))) {
    return "high"
  }
  if (sentiment === "bearish" || warningTags?.length) return "medium"
  const map = { 강: "high", 중: "medium", 약: "low" }
  return map[intensityKo] ?? "low"
}

function buildAiSummary({
  parsedStocks,
  signalLabels,
  sentiment,
  sectorTags,
  marketPhase,
  warningTags,
  macroCategories,
}) {
  const stockLine = parsedStocks.length ? parsedStocks.join(", ") : "종목 미탐지"
  const signalLine = signalLabels?.length ? signalLabels.join(", ") : "시그널 약함"
  const sectorLine = sectorTags.length ? sectorTags.join(", ") : "섹터 미지정"
  const warnLine = warningTags?.length ? `경고:${warningTags.join("/")}` : ""
  const macroLine = macroCategories?.length ? `거시:${macroCategories.join("/")}` : ""
  const extras = [warnLine, macroLine].filter(Boolean).join(" · ")
  const base = `${stockLine} · ${sentiment} · ${signalLine} · ${sectorLine} · 시장:${marketPhase}`
  return extras ? `${base} · ${extras}` : base
}

export function parseInvestmentMemo(text, context = {}) {
  const raw = String(text || "").trim()
  const { stock, tier: stockMatchTier, stockConfidenceNote } = inferStockUnified(raw)
  const sectors = inferSectors(raw)
  const { signals, score } = inferSignals(raw)
  const sentiment = inferSentiment(raw)
  const warningTags = inferWarningTags(raw)
  const macroCategories = inferMacroCategories(raw)
  const panicKeywords = includesAny(raw, PANIC_KEYWORDS)
  const macroKeywords = [...includesAny(raw, MACRO_KEYWORDS), ...(/vix/i.test(raw) ? ["VIX"] : [])].filter(
    (v, i, arr) => arr.indexOf(v) === i,
  )
  const timeExpressions = includesAny(raw, TIME_KEYWORDS)
  const strengthExpressions = includesAny(raw, STRENGTH_KEYWORDS)
  const confidence = Math.max(
    0.35,
    Math.min(
      0.97,
      0.45 +
        (stock ? inferStockConfidenceBonus(stockMatchTier) : 0) +
        Math.min(signals.length * 0.08, 0.24) +
        Math.min(sectors.length * 0.05, 0.1),
    ),
  )
  const confidenceFixed = Number(confidence.toFixed(2))
  const parsedStocks = stock ? [stock] : []
  const parsedSignals = signals
  const signalsNatural = naturalizeSignals(signals)
  const primarySignalLabel = signalsNatural[0] ?? "—"
  const sectorTags = sectors
  const panicTags = panicKeywords
  const marketPhase = inferMarketPhase(context?.panicData, sentiment, score)
  const aiSummary = buildAiSummary({
    parsedStocks,
    signalLabels: signalsNatural,
    sentiment,
    sectorTags,
    marketPhase,
    warningTags,
    macroCategories,
  })
  const intensity = inferIntensity(score, confidenceFixed)
  const strength = deriveStrength({
    sentiment,
    signals,
    warningTags,
    intensityKo: intensity,
  })

  return {
    id: context?.id ?? null,
    createdAt: context?.createdAt ?? null,
    rawText: raw,
    parsedStocks,
    parsedSignals,
    signalsNatural,
    primarySignalLabel,
    stock,
    sectors,
    signal: signals,
    sentiment,
    confidence: confidenceFixed,
    category: [
      ...(sectors.length ? ["섹터"] : []),
      ...(signals.length ? ["기술적분석"] : []),
      ...(macroCategories.length ? ["거시"] : []),
      ...(warningTags.length ? ["경고"] : []),
      "투자메모",
    ],
    panicTags,
    macroKeywords,
    warningTags,
    macroCategories,
    timeExpressions,
    strengthExpressions,
    signalScore: score,
    sectorTags,
    marketPhase,
    aiSummary,
    intensity,
    strength,
    stockMatchTier,
    stockConfidenceNote,
    riskLevel:
      marketPhase === "패닉" || marketPhase === "공포" || sentiment === "bearish"
        ? "high"
        : marketPhase === "과열" || warningTags.length > 0
          ? "medium"
          : "low",
  }
}

