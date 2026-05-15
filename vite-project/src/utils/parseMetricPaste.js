/**
 * 시장 지표 붙여넣기 — CSV 표 + 기사/앱 원문 한 줄에서 숫자만 추출.
 * 날짜(M/D), 출처, 이모지, ▲▼ 변동 기호는 무시하고 지표명 직후 주 수치를 사용.
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

/** @type {{ key: string, patterns: RegExp[] }[]} */
export const METRIC_PASTE_RULES = [
  { key: "vix", patterns: [/\bVIX(?:\s+Index)?\b/i] },
  { key: "vxn", patterns: [/\bVXN(?:\s+Index)?\b/i] },
  {
    key: "fearGreed",
    patterns: [/(?:CNN\s*F&G|Fear\s*&\s*Greed|공포\s*탐욕|탐욕\s*지수|F&G\s*Index)\b/i],
  },
  { key: "bofa", patterns: [/BofA(?:\s*Bull\s*(?:&|and)?\s*Bear|\s*B\s*&\s*B)?/i] },
  { key: "move", patterns: [/\bMOVE(?:\s+Index)?\b/i] },
  { key: "skew", patterns: [/\bSKEW(?:\s+Index)?\b/i] },
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

const EMOJI_AND_MARKERS_RE =
  /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]|[▲▼↑↓📈📉🟢🟡🔴⚪◆◇■□]/gu
/** 변동폭(▲▼, ±, 📉 -0.63) 앞에서 끊음 — 일반 공백+숫자(지표값)는 포함하지 않음 */
const CHANGE_SPLIT_RE = /[▲▼↑↓📈📉]|[,\s][+\u2212\u2013\u2014]\s*\d/
const DATE_SLASH_RE = /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g
const DATE_ISO_RE = /\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/g
const SOURCE_NOISE_RE =
  /\b(?:Yahoo\s*Finance|Reuters|Bloomberg|CNBC|MarketWatch|Investing\.com|Google\s*Finance)\b/gi
const NUMBER_TOKEN_RE = /(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+\.\d+)%?/g

export function normalizeNumberToken(raw) {
  if (raw == null || raw === "") return null
  const cleaned = String(raw).replace(/%/g, "").replace(/,/g, "").trim()
  if (!cleaned || cleaned === "-" || cleaned === "—") return null
  const parsed = parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function splitCsvLine(line) {
  return String(line)
    .split(",")
    .map((p) => p.trim())
}

function stripPasteNoise(segment) {
  return String(segment || "")
    .replace(EMOJI_AND_MARKERS_RE, " ")
    .replace(SOURCE_NOISE_RE, " ")
    .replace(DATE_SLASH_RE, " ")
    .replace(DATE_ISO_RE, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * 지표명 매치 직후 구간에서 주 수치(첫 유효 숫자) 추출. ▲▼ 뒤 변동폭·날짜 숫자는 제외.
 * @param {string} text
 * @param {number} fromIndex — 매치 끝 위치
 */
export function extractPrimaryMetricValue(text, fromIndex) {
  if (!text) return null
  let tail = text.slice(fromIndex)
  const lineEnd = tail.search(/\r?\n/)
  if (lineEnd >= 0) tail = tail.slice(0, lineEnd)
  tail = tail.slice(0, 200)

  const changeAt = tail.search(CHANGE_SPLIT_RE)
  const primarySegment = stripPasteNoise(changeAt >= 0 ? tail.slice(0, changeAt) : tail)
  if (!primarySegment) return null

  const candidates = []
  let m
  const re = new RegExp(NUMBER_TOKEN_RE.source, NUMBER_TOKEN_RE.flags)
  while ((m = re.exec(primarySegment))) {
    const n = normalizeNumberToken(m[1])
    if (n == null) continue
    candidates.push({ n, index: m.index, raw: m[0] })
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

  return (filtered[0] ?? candidates[0]).n
}

/**
 * CSV 한 줄(표 형식)에서 수치 열 추출.
 */
export function extractMetricValueFromCsvLine(line) {
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
}

function findMetricInText(text, patterns) {
  for (const pattern of patterns) {
    const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`)
    const m = re.exec(text)
    if (m) return { index: m.index, length: m[0].length }
  }
  return null
}

function parseLineForMetric(line, rule) {
  const { key, patterns } = rule
  const hit = findMetricInText(line, patterns)
  if (!hit) return null

  const csvLike = line.includes(",")
  if (csvLike) {
    const csvVal = extractMetricValueFromCsvLine(line)
    if (csvVal != null) return csvVal
  }

  return extractPrimaryMetricValue(line, hit.index + hit.length)
}

/**
 * @param {string} text
 * @param {string[]} [requiredKeys]
 */
export function parseMetricPasteText(text, requiredKeys = []) {
  const source = String(text || "")
  const lines = source.split(/\r?\n/).map((ln) => ln.trim()).filter(Boolean)
  const out = Object.fromEntries(METRIC_PASTE_KEYS.map((k) => [k, null]))
  const hit = new Set()

  for (const line of lines) {
    for (const rule of METRIC_PASTE_RULES) {
      if (out[rule.key] != null) continue
      const n = parseLineForMetric(line, rule)
      if (n == null) continue
      out[rule.key] = n
      hit.add(rule.key)
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
    hit.add(rule.key)
  }

  const missingRequired = requiredKeys.filter((key) => out[key] == null)
  return {
    data: out,
    missingRequired,
    hitCount: hit.size,
  }
}

/**
 * 붙여넣기 직후 textarea에 넣을 정규화 문자열 (표 형식이 아니고 지표가 추출되면 한 줄 요약).
 * @param {string} pasted
 */
export function normalizeMetricPasteForTextarea(pasted) {
  const raw = String(pasted || "").trim()
  if (!raw) return pasted

  const looksLikeTable = raw.split(/\r?\n/).some((ln) => {
    const parts = splitCsvLine(ln)
    return parts.length >= 3 && /^(단기|중기|장기|\d+$)/i.test(parts[0] ?? "")
  })
  if (looksLikeTable) return pasted

  const { data, hitCount } = parseMetricPasteText(raw)
  if (hitCount === 0) return pasted

  const rows = METRIC_PASTE_RULES.filter((r) => data[r.key] != null).map((r) => {
    const label = r.key.toUpperCase()
    return `${label},${data[r.key]}`
  })
  return rows.join("\n")
}
