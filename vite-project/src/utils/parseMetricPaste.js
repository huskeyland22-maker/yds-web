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
  feargreed: "fearGreed",
  cnnfeargreed: "fearGreed",
  cnnfearandgreed: "fearGreed",
  cnnfg: "fearGreed",
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
  { key: "bofa", patterns: [/BofA(?:\s*Bull\s*(?:&|and)?\s*Bear|\s*B\s*&\s*B)?/i] },
  { key: "move", patterns: [/\bMOVE(?:\s*Index)?\b/i] },
  { key: "skew", patterns: [/\bSKEW(?:\s*Index)?\b/i] },
  {
    key: "putCall",
    patterns: [/(?:풋\s*\/\s*콜|Put\s*\/\s*Call|PutCall|풋콜|Put-Call)/i],
  },
  {
    key: "highYield",
    patterns: [
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
let METRIC_STATUS_WORDS_RE = null

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
  METRIC_STATUS_WORDS_RE =
    /(?:회복|주의|안정|탐욕|공포|과열|낙관|흔들림|패닉|극단|위험|급등|🟢|🟡|🔴|⚪)\b/giu
}

export function emptyMetricPasteResult(requiredKeys = []) {
  const data = Object.fromEntries(METRIC_PASTE_KEYS.map((k) => [k, null]))
  return {
    data,
    missingRequired: Array.isArray(requiredKeys) ? [...requiredKeys] : [],
    hitCount: 0,
    ok: true,
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

    if (parts.length >= 3 && /^(단기|중기|장기)$/i.test(parts[0])) {
      return { rawKey: parts[1], rawValue: parts[2] }
    }
    if (parts.length >= 3 && /^\d+$/.test(parts[0])) {
      return { rawKey: parts[1], rawValue: parts[2] }
    }
    if (parts.length >= 3 && /^\d+\.\s/.test(parts[1])) {
      return { rawKey: parts[1], rawValue: parts[2] }
    }

    const rawKey = parts[0]
    let rawValue = parts[1]
    if (parts.length > 2) {
      const numericPart = parts.slice(1).find((p) => normalizeNumberToken(p) != null)
      if (numericPart) rawValue = numericPart
    }
    return { rawKey, rawValue }
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

    const canonicalKey = resolveCanonicalMetricKey(pair.rawKey)
    if (!canonicalKey) return null

    const parsedNumber = normalizeNumberToken(pair.rawValue)
    if (parsedNumber == null) return null

    return { key: canonicalKey, value: parsedNumber }
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

function normalizeParseResult(out, requiredKeys) {
  const data = Object.fromEntries(
    METRIC_PASTE_KEYS.map((k) => [k, coerceMetricValue(out?.[k])]),
  )
  const keys = Array.isArray(requiredKeys) ? requiredKeys : []
  const missingRequired = keys.filter((key) => data[key] == null)
  const hitCount = METRIC_PASTE_KEYS.filter((k) => data[k] != null).length
  return { data, missingRequired, hitCount, ok: true }
}

/**
 * @param {string} text
 * @param {string[]} [requiredKeys]
 */
export function parseMetricPasteText(text, requiredKeys = []) {
  try {
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
        const kv = parseExplicitKeyValueLine(line)
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
    const raw = sanitizeMetricPasteText(pasted)
    if (!raw) return String(pasted ?? "")

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
