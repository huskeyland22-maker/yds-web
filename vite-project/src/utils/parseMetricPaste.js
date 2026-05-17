/**
 * 시장 지표 붙여넣기 — 라인별 key,value 우선, canonical key 매핑.
 * 모든 공개 API는 throw 하지 않음 (실패 시 null·빈 결과 반환).
 */

export const METRIC_PASTE_KEYS = [
  "vix",
  "vxn",
  "fearGreed",
  "bofa",
  "move",
  "skew",
  "putCall",
  "highYield",
  "gsBullBear",
]

const MAX_PASTE_CHARS = 48_000
const MAX_REGEX_ITERATIONS = 200

/**
 * Normalized alias slug → canonical metric key.
 */
export const METRIC_CANONICAL_FROM_SLUG = {
  vix: "vix",
  vxn: "vxn",
  bofa: "bofa",
  move: "move",
  skew: "skew",
  putcall: "putCall",
  putcallratio: "putCall",
  pcr: "putCall",
  pcratio: "putCall",
  feargreed: "fearGreed",
  cnnfeargreed: "fearGreed",
  cnnfearandgreed: "fearGreed",
  cnnfg: "fearGreed",
  cnnfandg: "fearGreed",
  bofabb: "bofa",
  bofab: "bofa",
  vixindex: "vix",
  vxnindex: "vxn",
  hyoas: "highYield",
  hyoasfred: "highYield",
  highyield: "highYield",
  bamlh0a0hym2: "highYield",
  gssentiment: "gsBullBear",
  gsbb: "gsBullBear",
  gsbullbear: "gsBullBear",
  gsriskappetite: "gsBullBear",
  gssentimentindex: "gsBullBear",
  goldmansachssentiment: "gsBullBear",
  goldmansachsbullbear: "gsBullBear",
  goldmansachsriskappetite: "gsBullBear",
}

/** @type {{ alias: string, key: string }[]} */
const METRIC_ALIAS_ENTRIES = Object.entries(METRIC_CANONICAL_FROM_SLUG)
  .map(([alias, key]) => ({ alias, key }))
  .sort((a, b) => b.alias.length - a.alias.length)

/** @type {{ key: string, patterns: RegExp[] }[]} */
export const METRIC_PASTE_RULES = [
  { key: "vix", patterns: [/\bVIX(?:\s*Index)?\b/i] },
  { key: "vxn", patterns: [/\bVXN(?:\s*Index)?\b/i] },
  {
    key: "fearGreed",
    patterns: [
      /CNN\s*Fear\s*&\s*Greed/i,
      /CNN\s*FearGreed/i,
      /\bFear\s*&\s*Greed\b/i,
      /\bFearGreed\b/i,
      /(?:CNN\s*F&G|공포\s*탐욕|탐욕\s*지수|F&G(?:\s*Index)?)\b/i,
    ],
  },
  {
    key: "bofa",
    patterns: [/BofA(?:\s*Bull\s*(?:&|and)?\s*Bear|\s*B\s*&\s*B|\s*B&B)?/i, /\bBofA\b/i],
  },
  { key: "move", patterns: [/\bMOVE(?:\s*Index)?\b/i] },
  { key: "skew", patterns: [/\bSKEW(?:\s*Index)?\b/i] },
  {
    key: "putCall",
    patterns: [/(?:P\s*\/\s*C\s*Ratio|풋\s*\/\s*콜|Put\s*\/\s*Call|PutCall|풋콜|Put-Call)/i],
  },
  {
    key: "highYield",
    patterns: [
      /\bHY\b(?:\s*OAS)?/i,
      /HY\s*OAS(?:\s*\(\s*FRED\s*\))?/i,
      /\bHigh\s*Yield\b/i,
      /\bHighYield\b/i,
      /\bBAMLH0A0HYM2\b/i,
      /(?:하이\s*일드|HY\s*스프레드|하이일드\s*스프레드)/i,
    ],
  },
  {
    key: "gsBullBear",
    patterns: [
      /\bGS\s*Sentiment\b/i,
      /\bGS\s*Sentiment\s*Index\b/i,
      /\bGS\s*Risk\s*Appetite\b/i,
      /\bGS\s*B\s*\/\s*B\b/i,
      /\bGS\s*B\s*&\s*B\b/i,
      /Goldman\s*Sachs\s*Sentiment/i,
      /Goldman\s*Sachs\s*Risk\s*Appetite/i,
      /\bGS\s*Bull\s*Bear\b/i,
      /(?:GS\s*Bull\s*(?:&|and)\s*Bear|Goldman(?:\s+Sachs)?\s*B\s*\/\s*B)/i,
    ],
  },
]

const METRIC_LOG_LABEL = {
  vix: "VIX",
  vxn: "VXN",
  fearGreed: "FEAR_GREED",
  bofa: "BOFA",
  move: "MOVE",
  skew: "SKEW",
  putCall: "PUTCALL",
  highYield: "HIGH_YIELD",
  gsBullBear: "GSBB",
}

let EMOJI_AND_MARKERS_RE = null
let CHANGE_SPLIT_RE = null
let DATE_SLASH_RE = null
let DATE_ISO_RE = null
let SOURCE_NOISE_RE = null
let NUMBER_TOKEN_RE = null
let SIGNED_NUMBER_RE = null
let RELAXED_NUMBER_RE = null
let METRIC_STATUS_WORDS_RE = null
let CSV_INDEX_PREFIX_RE = null

/** Δ·상태 등급 구간만 자르고, 본값 "+0.8" 은 유지 */
const CHANGE_SPLIT_RE_SOURCE = String.raw`[▲▼↑↓📈📉]|,\s*[+\u2212\u2013\u2014]\s*\d`

function compilePasteRegexes() {
  if (EMOJI_AND_MARKERS_RE) return
  try {
    EMOJI_AND_MARKERS_RE =
      /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]|[▲▼↑↓📈📉🟢🟡🔴⚪◆◇■□]/gu
  } catch {
    EMOJI_AND_MARKERS_RE = /[▲▼↑↓📈📉🟢🟡🔴⚪◆◇■□]/g
  }
  CHANGE_SPLIT_RE = new RegExp(CHANGE_SPLIT_RE_SOURCE)
  DATE_SLASH_RE = /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g
  DATE_ISO_RE = /\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/g
  SOURCE_NOISE_RE =
    /\b(?:Yahoo\s*Finance|Reuters|Bloomberg|CNBC|MarketWatch|Investing\.com|Google\s*Finance)\b/gi
  NUMBER_TOKEN_RE = /[-+]?(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d*\.?\d+)/g
  SIGNED_NUMBER_RE = /[-+]?\d*\.?\d+/g
  RELAXED_NUMBER_RE = /[-+]?\d+(?:\.\d+)?/g
  CSV_INDEX_PREFIX_RE = /^\d+\.\s*/
  METRIC_STATUS_WORDS_RE =
    /(?:회복|주의|안정|탐욕|공포|과열|낙관|흔들림|패닉|극단|위험|급등|🟢|🟡|🔴|⚪)\b/giu
}

/** AI 입력 고정 포맷 (9대 패닉 지수) */
export const PANIC_NINE_BLOCK_TEMPLATE = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 9대 패닉 지수 | YYYY-MM-DD 뉴욕 종가
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
① VIX        18.43
② VXN        24.08
③ P/C Ratio   0.51
④ CNN F&G       63
⑤ MOVE       70.24
⑥ BofA B&B     6.6
⑦ SKEW      141.51
⑧ HY OAS     2.82%
⑨ GS B/B       70%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`

const NINE_PANIC_HEADER_RE = /9대\s*패닉\s*지수|패닉\s*지수\s*\|/i
const NINE_CIRCLED_PREFIX_RE = /^[\s①②③④⑤⑥⑦⑧⑨\d.]+/u

/** @type {{ key: string; label: RegExp }[]} */
const NINE_PANIC_LINE_RULES = [
  { key: "vix", label: /\bVIX\b/i },
  { key: "vxn", label: /\bVXN\b/i },
  { key: "putCall", label: /P\s*\/\s*C\s*Ratio|Put\s*\/\s*Call|풋\s*\/\s*콜/i },
  { key: "fearGreed", label: /CNN\s*F\s*&\s*G|CNN\s*Fear\s*&\s*Greed/i },
  { key: "move", label: /\bMOVE\b/i },
  { key: "bofa", label: /BofA\s*B\s*&\s*B|BofA\s*B\s*\/\s*B|\bBofA\b/i },
  { key: "skew", label: /\bSKEW\b/i },
  { key: "highYield", label: /\bHY\s*OAS\b/i },
  { key: "gsBullBear", label: /\bGS\s*B\s*\/\s*B|\bGS\s*B\s*&\s*B/i },
]

export function isNinePanicDeskFormat(text) {
  const s = String(text ?? "")
  if (!s.trim()) return false
  return NINE_PANIC_HEADER_RE.test(s) && NINE_PANIC_LINE_RULES.some((r) => r.label.test(s))
}

/**
 * @param {string} line
 * @returns {number | null}
 */
function extractNinePanicLineValue(line) {
  try {
    compilePasteRegexes()
    const withoutPrefix = String(line ?? "")
      .trim()
      .replace(NINE_CIRCLED_PREFIX_RE, "")
      .trim()
    const cleaned = withoutPrefix.replace(/%/g, " ").replace(/,/g, "")
    const nums = extractRelaxedNumbers(cleaned)
    if (!nums.length) return null
    return coerceMetricValue(nums[nums.length - 1].n)
  } catch {
    return null
  }
}

/**
 * 9대 패닉 지수 블록 파싱
 * @param {string} text
 * @returns {{ data: Record<string, number | null>, tradeDate: string | null } | null}
 */
export function parseNinePanicDeskFormat(text) {
  try {
    const raw = String(text ?? "")
    if (!isNinePanicDeskFormat(raw)) return null

    const dateMatch = raw.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
    const tradeDate = dateMatch?.[1] && /^\d{4}-\d{2}-\d{2}$/.test(dateMatch[1]) ? dateMatch[1] : null

    const out = Object.fromEntries(METRIC_PASTE_KEYS.map((k) => [k, null]))
    const lines = raw.split(/\r?\n/).map((ln) => ln.trim()).filter(Boolean)

    for (const line of lines) {
      if (/^━+$/.test(line.replace(/\s/g, ""))) continue
      if (NINE_PANIC_HEADER_RE.test(line)) continue
      if (/뉴욕\s*종가/i.test(line) && !NINE_PANIC_LINE_RULES.some((r) => r.label.test(line))) continue

      for (const rule of NINE_PANIC_LINE_RULES) {
        if (!rule.label.test(line)) continue
        const value = extractNinePanicLineValue(line)
        if (value == null) break
        if (out[rule.key] == null) {
          out[rule.key] = value
          logMetricParse(rule.key, value)
        }
        break
      }
    }

    const hitCount = METRIC_PASTE_KEYS.filter((k) => out[k] != null).length
    if (hitCount < 3) return null

    return { data: out, tradeDate }
  } catch {
    return null
  }
}

export function emptyMetricPasteResult(requiredKeys = []) {
  const data = Object.fromEntries(METRIC_PASTE_KEYS.map((k) => [k, null]))
  return {
    data,
    missingRequired: Array.isArray(requiredKeys) ? [...requiredKeys] : [],
    hitCount: 0,
    ok: true,
    tradeDate: null,
  }
}

export function normalizeMetricLabel(raw) {
  try {
    return String(raw ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/&/g, "")
      .replace(/[()\-/.,:;_]/g, "")
      .replace(/[^\w가-힣]/g, "")
  } catch {
    return ""
  }
}

export function resolveCanonicalMetricKey(slugOrKey) {
  try {
    const s = normalizeMetricLabel(slugOrKey)
    if (!s) return null
    if (METRIC_CANONICAL_FROM_SLUG[s]) return METRIC_CANONICAL_FROM_SLUG[s]
    for (const k of METRIC_PASTE_KEYS) {
      if (normalizeMetricLabel(k) === s) return k
    }
    return null
  } catch {
    return null
  }
}

function logMetricParse(canonicalKey, value) {
  try {
    const label = METRIC_LOG_LABEL[canonicalKey] ?? String(canonicalKey).toUpperCase()
    console.log(`[${label}] -> ${value}`)
  } catch {
    // ignore
  }
}

function logParserFail(line) {
  try {
    const text = String(line ?? "").trim()
    if (!text) return
    console.warn(`[Parser Fail]\n${text}`)
  } catch {
    // ignore
  }
}

function stripMetricStatusWords(segment) {
  try {
    compilePasteRegexes()
    return String(segment || "")
      .replace(METRIC_STATUS_WORDS_RE, " ")
      .replace(/\s+/g, " ")
      .trim()
  } catch {
    return String(segment || "").trim()
  }
}

export function sanitizeMetricPasteText(raw) {
  try {
    compilePasteRegexes()
    let s = String(raw ?? "")
    if (!s.trim()) return ""
    if (s.length > MAX_PASTE_CHARS) s = s.slice(0, MAX_PASTE_CHARS)
    s = s.replace(/\0/g, "")
    try {
      s = s.replace(EMOJI_AND_MARKERS_RE, " ")
    } catch {
      s = s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, " ")
    }
    s = s
      .replace(SOURCE_NOISE_RE, " ")
      .replace(/[^\S\r\n]+/g, " ")
      .replace(/[▲▼↑↓📈📉🟢🟡🔴⚪]/g, " ")
      .replace(/[^\w\s.,%+\-/&가-힣\r\n]/g, " ")
      .replace(/[ \t]+/g, " ")
      .trim()
    return s
  } catch {
    return String(raw ?? "").slice(0, MAX_PASTE_CHARS)
  }
}

export function normalizeNumberToken(raw) {
  try {
    if (raw == null || raw === "") return null
    let cleaned = String(raw)
      .trim()
      .replace(/%/g, "")
      .replace(/,/g, "")
      .replace(/\u2212|\u2013|\u2014/g, "-")
    if (!cleaned || cleaned === "-" || cleaned === "—" || cleaned === "+") return null
    if (/^[-+]\.$/.test(cleaned)) return null
    const parsed = parseFloat(cleaned)
    if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

export function coerceMetricValue(value) {
  if (value == null) return null
  if (typeof value === "number") {
    return Number.isFinite(value) && !Number.isNaN(value) ? value : null
  }
  return normalizeNumberToken(value)
}

function splitCsvLine(line) {
  try {
    return String(line ?? "")
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
  } catch {
    return []
  }
}

/** CSV 라벨 셀: "1. VIX Index" → "VIX", 상태·Index 접미 제거 */
function cleanRawMetricKey(raw) {
  try {
    compilePasteRegexes()
    let s = String(raw ?? "").trim()
    s = s.replace(CSV_INDEX_PREFIX_RE, "")
    s = s.replace(/\s+Index\s*$/i, "")
    return stripMetricStatusWords(s)
  } catch {
    return String(raw ?? "").trim()
  }
}

/** 완화 숫자 추출: [-+]?\d+(\.\d+)? */
function extractRelaxedNumbers(segment) {
  const candidates = []
  try {
    compilePasteRegexes()
    const re = new RegExp(RELAXED_NUMBER_RE.source, RELAXED_NUMBER_RE.flags)
    let m
    let guard = 0
    while ((m = safeRegexExec(re, segment)) && guard < MAX_REGEX_ITERATIONS) {
      guard += 1
      const n = normalizeNumberToken(m[0])
      if (n == null) continue
      candidates.push({ n, index: m.index ?? 0 })
      if (!re.global) break
    }
  } catch {
    return []
  }
  return candidates
}

/** CSV 값 열: "-", 상태문구 건너뛰고 첫 유효 숫자 */
function pickValueFromCsvParts(parts, keyIndex) {
  try {
    for (let i = keyIndex + 1; i < parts.length; i++) {
      const cell = String(parts[i] ?? "").trim()
      if (!cell || cell === "-" || cell === "—" || cell === "–") continue
      const cleaned = stripMetricStatusWords(cell)
      if (!cleaned || cleaned === "-") continue
      const direct = normalizeNumberToken(cleaned)
      if (direct != null) return direct
      const fromRelaxed = extractRelaxedNumbers(cleaned)
      if (fromRelaxed.length) return fromRelaxed[0].n
    }
    return null
  } catch {
    return null
  }
}

/** 라벨 → canonical key (slug · 패턴) */
function resolveMetricKeyFromLabel(label) {
  try {
    const cleaned = cleanRawMetricKey(label)
    if (!cleaned) return null
    const fromSlug = resolveCanonicalMetricKey(cleaned)
    if (fromSlug) return fromSlug
    for (const rule of METRIC_PASTE_RULES) {
      if (findMetricInText(cleaned, rule.patterns)) return rule.key
    }
    return null
  } catch {
    return null
  }
}

/**
 * 한 줄에서 rawKey / rawValue 분리 (표 형식·단순 KEY,VALUE).
 * @returns {{ rawKey: string, rawValue: string } | null}
 */
function splitLineKeyValue(line) {
  try {
    const trimmed = String(line ?? "").trim()
    if (!trimmed || !trimmed.includes(",")) return null

    const parts = splitCsvLine(trimmed)
    if (parts.length < 2) return null

    let keyIndex = 0
    if (parts.length >= 3 && /^(단기|중기|장기)$/i.test(parts[0])) keyIndex = 1
    else if (parts.length >= 3 && /^\d+$/.test(parts[0])) keyIndex = 1

    const rawKey = parts[keyIndex]
    const picked = pickValueFromCsvParts(parts, keyIndex)
    if (picked != null) {
      return { rawKey, rawValue: String(picked) }
    }

    if (keyIndex > 0) return null

    const fallbackKey = parts[0]
    const fallbackVal = pickValueFromCsvParts(parts, 0)
    if (fallbackVal != null) {
      return { rawKey: fallbackKey, rawValue: String(fallbackVal) }
    }
    return null
  } catch {
    return null
  }
}

/**
 * 명시적 KEY,VALUE 라인 — 이 줄만 처리, 다른 지표와 값 공유 없음.
 * @returns {{ key: string, value: number } | null}
 */
function parseExplicitKeyValueLine(line) {
  try {
    const pair = splitLineKeyValue(line)
    if (!pair) return null

    const canonicalKey = resolveMetricKeyFromLabel(pair.rawKey)
    if (!canonicalKey) return null

    let parsedNumber = normalizeNumberToken(pair.rawValue)
    if (parsedNumber == null) {
      const relaxed = extractRelaxedNumbers(pair.rawValue)
      if (relaxed.length) parsedNumber = relaxed[0].n
    }
    if (parsedNumber == null) return null

    return { key: canonicalKey, value: parsedNumber }
  } catch {
    return null
  }
}

/**
 * CSV 한 줄 — 라벨 매칭 후 숫자만 추출 (번호·Index·상태문구 제거)
 * @returns {{ key: string, value: number } | null}
 */
function parseRelaxedCsvMetricLine(line) {
  try {
    const trimmed = String(line ?? "").trim()
    if (!trimmed.includes(",")) return null

    const parts = splitCsvLine(trimmed)
    if (parts.length < 2) return null

    let keyIndex = 0
    if (parts.length >= 3 && /^(단기|중기|장기)$/i.test(parts[0])) keyIndex = 1
    else if (parts.length >= 3 && /^\d+$/.test(parts[0])) keyIndex = 1

    const key = resolveMetricKeyFromLabel(parts[keyIndex])
    if (!key) return null

    const value = pickValueFromCsvParts(parts, keyIndex)
    if (value == null) return null

    return { key, value }
  } catch {
    return null
  }
}

function stripPasteNoise(segment) {
  try {
    compilePasteRegexes()
    return String(segment || "")
      .replace(EMOJI_AND_MARKERS_RE, " ")
      .replace(SOURCE_NOISE_RE, " ")
      .replace(DATE_SLASH_RE, " ")
      .replace(DATE_ISO_RE, " ")
      .replace(/\s+/g, " ")
      .trim()
  } catch {
    return String(segment || "").trim()
  }
}

function safeRegexExec(re, text) {
  try {
    if (!re || typeof text !== "string") return null
    re.lastIndex = 0
    return re.exec(text)
  } catch {
    return null
  }
}

function findMetricInText(text, patterns) {
  try {
    if (!text || !Array.isArray(patterns)) return null
    let best = null
    for (const pattern of patterns) {
      if (!pattern?.source) continue
      const flags = String(pattern.flags || "i").includes("g") ? pattern.flags : `${pattern.flags || "i"}g`
      const re = new RegExp(pattern.source, flags)
      const m = safeRegexExec(re, text)
      if (m && typeof m.index === "number") {
        const len = m[0]?.length ?? 0
        if (!best || len > best.length) {
          best = { index: m.index, length: len }
        }
      }
    }
    return best
  } catch {
    return null
  }
}

function collectNumbersFromSegment(primarySegment) {
  const candidates = []
  try {
    compilePasteRegexes()
    const re = new RegExp(NUMBER_TOKEN_RE.source, NUMBER_TOKEN_RE.flags)
    let m
    let guard = 0
    while ((m = safeRegexExec(re, primarySegment)) && guard < MAX_REGEX_ITERATIONS) {
      guard += 1
      const n = normalizeNumberToken(m[0] ?? m[1])
      if (n == null) continue
      candidates.push({ n, index: m.index ?? 0 })
      if (!re.global) break
    }
  } catch {
    return []
  }
  return candidates
}

/** 기사형 한 줄 — 매치 위치 이후 구간에서만 숫자 추출 (index 0 fallback 없음) */
export function extractPrimaryMetricValue(text, fromIndex) {
  try {
    if (!text || typeof fromIndex !== "number" || !Number.isFinite(fromIndex)) return null
    let tail = String(text).slice(fromIndex)
    const lineEnd = tail.search(/\r?\n/)
    if (lineEnd >= 0) tail = tail.slice(0, lineEnd)
    tail = tail.slice(0, 200)

    compilePasteRegexes()
    const changeAt = tail.search(CHANGE_SPLIT_RE)
    let primarySegment = stripPasteNoise(changeAt >= 0 ? tail.slice(0, changeAt) : tail)
    primarySegment = stripMetricStatusWords(primarySegment)
    if (!primarySegment) return null

    let candidates = collectNumbersFromSegment(primarySegment)
    if (!candidates.length) {
      candidates = extractRelaxedNumbers(primarySegment)
    }
    if (!candidates.length) {
      compilePasteRegexes()
      const signed = safeRegexExec(
        new RegExp(SIGNED_NUMBER_RE.source, SIGNED_NUMBER_RE.flags),
        primarySegment,
      )
      if (signed?.[0]) {
        const n = normalizeNumberToken(signed[0])
        if (n != null) candidates = [{ n, index: signed.index ?? 0 }]
      }
    }
    if (!candidates.length) return null

    const filtered = candidates.filter((c, i) => {
      if (i !== 0) return true
      if (c.n >= 1 && c.n <= 9) {
        const before = primarySegment.slice(Math.max(0, c.index - 4), c.index + 2)
        if (/^\d+\.\s*$/.test(before) || /,\s*\d+\./.test(before)) return false
      }
      return true
    })

    return coerceMetricValue((filtered[0] ?? candidates[0])?.n)
  } catch {
    return null
  }
}

function normalizeLineForAliasMatch(line) {
  try {
    compilePasteRegexes()
    const labelPart = String(line ?? "").replace(NUMBER_TOKEN_RE, " ")
    return normalizeMetricLabel(labelPart)
  } catch {
    return normalizeMetricLabel(line)
  }
}

function findMetricByAliasOnLine(line) {
  try {
    const norm = normalizeLineForAliasMatch(line)
    if (!norm) return null
    for (const { alias, key } of METRIC_ALIAS_ENTRIES) {
      if (norm.includes(alias)) return { key, alias }
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * 기사/라벨 한 줄 (콤마 KEY,VALUE 아님) — 이 줄에서 단일 지표·단일 값만.
 */
function parseArticleMetricLine(line) {
  try {
    const trimmed = String(line ?? "").trim()
    if (!trimmed || trimmed.includes(",")) return null

    const aliasHit = findMetricByAliasOnLine(trimmed)
    if (aliasHit) {
      const slugIdx = normalizeLineForAliasMatch(trimmed).indexOf(aliasHit.alias)
      const approxStart = slugIdx >= 0 ? slugIdx : 0
      const value = extractPrimaryMetricValue(trimmed, approxStart + aliasHit.alias.length)
      if (value != null) return { key: aliasHit.key, value }
      logParserFail(trimmed)
      return null
    }

    let best = null
    let matchedRule = null
    for (const rule of METRIC_PASTE_RULES) {
      const hit = findMetricInText(trimmed, rule.patterns)
      if (!hit) continue
      matchedRule = rule
      const value = extractPrimaryMetricValue(trimmed, hit.index + hit.length)
      if (value == null) continue
      if (!best || hit.length > best.hit.length) {
        best = { key: rule.key, value, hit }
      }
    }
    if (!best && matchedRule) logParserFail(trimmed)
    return best ? { key: best.key, value: best.value } : null
  } catch {
    return null
  }
}

function isLikelyKeyValuePaste(lines) {
  try {
    let kv = 0
    for (const line of lines) {
      if (parseExplicitKeyValueLine(line)) kv += 1
    }
    return kv >= 1
  } catch {
    return false
  }
}

/**
 * @param {Record<string, unknown>} out
 * @param {string[]} requiredKeys
 * @param {{ tradeDate?: string | null }} [meta]
 */
function normalizeParseResult(out, requiredKeys, meta = {}) {
  const data = Object.fromEntries(
    METRIC_PASTE_KEYS.map((k) => [k, coerceMetricValue(out?.[k])]),
  )
  const keys = Array.isArray(requiredKeys) ? requiredKeys : []
  const missingRequired = keys.filter((key) => data[key] == null)
  const hitCount = METRIC_PASTE_KEYS.filter((k) => data[k] != null).length
  const tradeDate =
    typeof meta.tradeDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(meta.tradeDate)
      ? meta.tradeDate
      : null
  return { data, missingRequired, hitCount, ok: true, tradeDate }
}

/**
 * @param {string} text
 * @param {string[]} [requiredKeys]
 */
export function parseMetricPasteText(text, requiredKeys = []) {
  try {
    const nine = parseNinePanicDeskFormat(text)
    if (nine) {
      return normalizeParseResult(nine.data, requiredKeys, { tradeDate: nine.tradeDate })
    }

    const source = sanitizeMetricPasteText(text)
    if (!source) return emptyMetricPasteResult(requiredKeys)

    const lines = source
      .split(/\r?\n/)
      .map((ln) => ln.trim())
      .filter(Boolean)

    const out = Object.fromEntries(METRIC_PASTE_KEYS.map((k) => [k, null]))
    const preferKeyValue = isLikelyKeyValuePaste(lines)

    for (const line of lines) {
      if (preferKeyValue || line.includes(",")) {
        const kv = parseExplicitKeyValueLine(line) ?? parseRelaxedCsvMetricLine(line)
        if (kv) {
          if (out[kv.key] == null) {
            out[kv.key] = kv.value
            logMetricParse(kv.key, kv.value)
          }
          continue
        }
        if (preferKeyValue) continue
      }

      const article = parseArticleMetricLine(line)
      if (article && out[article.key] == null) {
        out[article.key] = article.value
        logMetricParse(article.key, article.value)
      }
    }

    return normalizeParseResult(out, requiredKeys)
  } catch (err) {
    console.warn("[parseMetricPasteText]", err)
    return emptyMetricPasteResult(requiredKeys)
  }
}

export function normalizeMetricPasteForTextarea(pasted) {
  try {
    const original = String(pasted ?? "")
    if (isNinePanicDeskFormat(original)) return original

    const raw = sanitizeMetricPasteText(pasted)
    if (!raw) return original

    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const looksLikeTable = lines.some((ln) => {
      const parts = splitCsvLine(ln)
      return parts.length >= 3 && /^(단기|중기|장기|\d+$)/i.test(parts[0] ?? "")
    })
    if (looksLikeTable) return String(pasted ?? "")

    const { data, hitCount } = parseMetricPasteText(raw)
    if (!hitCount) return String(pasted ?? "")

    const rows = METRIC_PASTE_KEYS.filter((k) => data[k] != null).map((k) => {
      const label = METRIC_LOG_LABEL[k] ?? k.toUpperCase()
      const v = data[k]
      return `${label},${typeof v === "number" ? v : ""}`
    })
    return rows.filter(Boolean).join("\n") || String(pasted ?? "")
  } catch (err) {
    console.warn("[normalizeMetricPasteForTextarea]", err)
    return String(pasted ?? "")
  }
}

export function safeNormalizeMetricPasteForTextarea(pasted) {
  try {
    const original = String(pasted ?? "")
    if (!original.trim()) return { ok: true, text: original }
    const text = normalizeMetricPasteForTextarea(original)
    return { ok: true, text }
  } catch (err) {
    console.warn("[safeNormalizeMetricPasteForTextarea]", err)
    return { ok: false, text: String(pasted ?? "") }
  }
}

export function formatMetricValueForDisplay(value) {
  const n = coerceMetricValue(value)
  if (n == null) return "—"
  if (typeof n === "number" && Number.isFinite(n)) return String(n)
  return "—"
}

/** @deprecated 라인별 parse 사용 — 하위 호환 */
export function extractMetricValueFromCsvLine(line) {
  const kv = parseExplicitKeyValueLine(line)
  return kv?.value ?? null
}
