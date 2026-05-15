/**
 * 시장 지표 붙여넣기 — CSV 표 + 기사/앱 원문 한 줄에서 숫자만 추출.
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

/** @type {{ key: string, patterns: RegExp[] }[]} */
export const METRIC_PASTE_RULES = [
  { key: "vix", patterns: [/\bVIX(?:\s*Index)?\b/i] },
  { key: "vxn", patterns: [/\bVXN(?:\s*Index)?\b/i] },
  {
    key: "fearGreed",
    patterns: [/(?:CNN\s*F&G|Fear\s*&\s*Greed|공포\s*탐욕|탐욕\s*지수|F&G(?:\s*Index)?)\b/i],
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
    patterns: [/(?:하이\s*일드|High\s*Yield|HY\s*스프레드|하이일드\s*스프레드)/i],
  },
  {
    key: "gsBullBear",
    patterns: [
      /(?:GS\s*B\s*\/\s*B|GS\s*Bull\s*(?:&|and)\s*Bear|Goldman(?:\s+Sachs)?\s*B\s*\/\s*B)/i,
    ],
  },
]

let EMOJI_AND_MARKERS_RE = null
let CHANGE_SPLIT_RE = null
let DATE_SLASH_RE = null
let DATE_ISO_RE = null
let SOURCE_NOISE_RE = null
let NUMBER_TOKEN_RE = null

function compilePasteRegexes() {
  if (EMOJI_AND_MARKERS_RE) return
  try {
    EMOJI_AND_MARKERS_RE =
      /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]|[▲▼↑↓📈📉🟢🟡🔴⚪◆◇■□]/gu
  } catch {
    EMOJI_AND_MARKERS_RE = /[▲▼↑↓📈📉🟢🟡🔴⚪◆◇■□]/g
  }
  CHANGE_SPLIT_RE = /[▲▼↑↓📈📉]|[,\s][+\u2212\u2013\u2014]\s*\d/
  DATE_SLASH_RE = /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g
  DATE_ISO_RE = /\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/g
  SOURCE_NOISE_RE =
    /\b(?:Yahoo\s*Finance|Reuters|Bloomberg|CNBC|MarketWatch|Investing\.com|Google\s*Finance)\b/gi
  NUMBER_TOKEN_RE = /(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+\.\d+)%?/g
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

/**
 * 붙여넣기 원문 정리 — emoji, ▲▼, 출처, 제어문자 제거.
 * @param {unknown} raw
 */
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
      .replace(/[^\w\s.,%+\-/&가-힣]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    return s
  } catch {
    return String(raw ?? "").slice(0, MAX_PASTE_CHARS)
  }
}

export function normalizeNumberToken(raw) {
  try {
    if (raw == null || raw === "") return null
    const cleaned = String(raw).replace(/%/g, "").replace(/,/g, "").trim()
    if (!cleaned || cleaned === "-" || cleaned === "—") return null
    const parsed = parseFloat(cleaned)
    if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

/** @param {unknown} value */
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
  } catch {
    return []
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

function collectNumbersFromSegment(primarySegment) {
  const candidates = []
  try {
    compilePasteRegexes()
    const re = new RegExp(NUMBER_TOKEN_RE.source, NUMBER_TOKEN_RE.flags)
    let m
    let guard = 0
    while ((m = safeRegexExec(re, primarySegment)) && guard < MAX_REGEX_ITERATIONS) {
      guard += 1
      const n = normalizeNumberToken(m[1])
      if (n == null) continue
      candidates.push({ n, index: m.index ?? 0 })
      if (!re.global) break
    }
  } catch {
    return []
  }
  return candidates
}

export function extractPrimaryMetricValue(text, fromIndex) {
  try {
    if (!text || typeof fromIndex !== "number" || !Number.isFinite(fromIndex)) return null
    let tail = String(text).slice(fromIndex)
    const lineEnd = tail.search(/\r?\n/)
    if (lineEnd >= 0) tail = tail.slice(0, lineEnd)
    tail = tail.slice(0, 200)

    compilePasteRegexes()
    const changeAt = tail.search(CHANGE_SPLIT_RE)
    const primarySegment = stripPasteNoise(changeAt >= 0 ? tail.slice(0, changeAt) : tail)
    if (!primarySegment) return null

    const candidates = collectNumbersFromSegment(primarySegment)
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

export function extractMetricValueFromCsvLine(line) {
  try {
    const parts = splitCsvLine(line)
    if (parts.length < 2) return null
    const col0 = String(parts[0] ?? "").trim()
    const col1 = String(parts[1] ?? "").trim()

    if (/^\d+$/.test(col0) && parts.length >= 3) {
      const v = normalizeNumberToken(parts[2])
      if (v != null) return v
    }

    if (/^(단기|중기|장기)$/i.test(col0) && parts.length >= 3) {
      const v = normalizeNumberToken(parts[2])
      if (v != null) return v
    }

    if (/^\d+\.\s/.test(col1) && parts.length >= 3) {
      const v = normalizeNumberToken(parts[2])
      if (v != null) return v
    }

    const fromCol1 = normalizeNumberToken(col1)
    if (fromCol1 != null && !/[A-Za-z가-힣]/.test(col1)) return fromCol1

    if (parts.length >= 3) {
      const fallback = normalizeNumberToken(parts[2])
      if (fallback != null) return fallback
    }

    return fromCol1
  } catch {
    return null
  }
}

function findMetricInText(text, patterns) {
  try {
    if (!text || !Array.isArray(patterns)) return null
    for (const pattern of patterns) {
      if (!pattern?.source) continue
      const flags = String(pattern.flags || "i").includes("g") ? pattern.flags : `${pattern.flags || "i"}g`
      const re = new RegExp(pattern.source, flags)
      const m = safeRegexExec(re, text)
      if (m && typeof m.index === "number") {
        return { index: m.index, length: m[0]?.length ?? 0 }
      }
    }
  } catch {
    // ignore
  }
  return null
}

function parseLineForMetric(line, rule) {
  try {
    const { patterns } = rule ?? {}
    const hit = findMetricInText(line, patterns)
    if (!hit) return null

    if (String(line).includes(",")) {
      const csvVal = extractMetricValueFromCsvLine(line)
      if (csvVal != null) return csvVal
    }

    return extractPrimaryMetricValue(line, hit.index + hit.length)
  } catch {
    return null
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

    for (const line of lines) {
      for (const rule of METRIC_PASTE_RULES) {
        if (out[rule.key] != null) continue
        const n = parseLineForMetric(line, rule)
        if (n == null) continue
        out[rule.key] = n
      }
    }

    const blob = lines.join("\n")
    for (const rule of METRIC_PASTE_RULES) {
      if (out[rule.key] != null) continue
      const found = findMetricInText(blob, rule.patterns)
      if (!found) continue
      const n = extractPrimaryMetricValue(blob, found.index + found.length)
      if (n == null) continue
      out[rule.key] = n
    }

    return normalizeParseResult(out, requiredKeys)
  } catch (err) {
    console.warn("[parseMetricPasteText]", err)
    return emptyMetricPasteResult(requiredKeys)
  }
}

/**
 * @param {string} pasted
 */
export function normalizeMetricPasteForTextarea(pasted) {
  try {
    const raw = sanitizeMetricPasteText(pasted)
    if (!raw) return String(pasted ?? "")

    const looksLikeTable = raw.split(/\r?\n/).some((ln) => {
      const parts = splitCsvLine(ln)
      return parts.length >= 3 && /^(단기|중기|장기|\d+$)/i.test(parts[0] ?? "")
    })
    if (looksLikeTable) return String(pasted ?? "")

    const { data, hitCount } = parseMetricPasteText(raw)
    if (!hitCount) return String(pasted ?? "")

    const rows = METRIC_PASTE_RULES.filter((r) => data[r.key] != null).map((r) => {
      const v = data[r.key]
      return `${r.key.toUpperCase()},${typeof v === "number" ? v : ""}`
    })
    return rows.filter(Boolean).join("\n") || String(pasted ?? "")
  } catch (err) {
    console.warn("[normalizeMetricPasteForTextarea]", err)
    return String(pasted ?? "")
  }
}

/**
 * 붙여넣기 정규화 (throw 없음).
 * @returns {{ ok: boolean, text: string }}
 */
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

/** @param {unknown} value */
export function formatMetricValueForDisplay(value) {
  const n = coerceMetricValue(value)
  if (n == null) return "—"
  if (typeof n === "number" && Number.isFinite(n)) return String(n)
  return "—"
}
