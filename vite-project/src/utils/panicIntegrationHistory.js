const STORAGE_KEY = "yds-panic-integration-history-v1"
const DAILY_STORAGE_KEY = "yds-panic-history-v1"
const MAX_ENTRIES = 720

function readRaw() {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRaw(rows) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  } catch {
    // 저장 실패(프라이빗 모드/용량 초과) 시 앱 동작은 계속 유지
  }
}

export function getIntegrationHistory() {
  return readRaw().filter(
    (row) =>
      row &&
      typeof row.date === "string" &&
      Number.isFinite(Number(row.sentimentScore)) &&
      typeof row.currentState === "string",
  )
}

export function saveIntegrationHistory(integration, sourceData = null) {
  if (!integration) return getIntegrationHistory()
  const entry = {
    date: new Date().toISOString(),
    sentimentScore: Number(integration.sentimentScore ?? 50),
    currentState: String(integration.currentState ?? "중립"),
    riskLevel: String(integration.riskLevel ?? "보통"),
    stateFlow: String(integration.stateFlow ?? integration.currentState ?? "중립"),
    vix: Number(sourceData?.vix ?? NaN),
    fearGreed: Number(sourceData?.fearGreed ?? NaN),
    highYield: Number(sourceData?.highYield ?? NaN),
  }
  const prev = getIntegrationHistory()
  const last = prev[prev.length - 1]
  if (
    last &&
    last.sentimentScore === entry.sentimentScore &&
    last.currentState === entry.currentState &&
    last.riskLevel === entry.riskLevel
  ) {
    return prev
  }
  const next = [...prev, entry]
  while (next.length > MAX_ENTRIES) next.shift()
  writeRaw(next)
  return next
}

export function summarizeIntegrationFlow(history) {
  const rows = Array.isArray(history) ? history : []
  if (rows.length < 2) return "히스토리 수집 중"
  const last = rows[rows.length - 1]
  const prev = rows[rows.length - 2]
  if (last.currentState === prev.currentState) return `${last.currentState} 유지`
  return `${prev.currentState} → ${last.currentState}`
}

function ymd(isoOrDate) {
  const d = new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function readDailyRaw() {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(DAILY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeDailyRaw(rows) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(rows))
  } catch {
    // noop
  }
}

export function getDailyPanicHistory() {
  return readDailyRaw()
    .filter(
      (row) =>
        row &&
        typeof row.date === "string" &&
        Number.isFinite(Number(row.totalScore)) &&
        typeof row.marketState === "string",
    )
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

export function saveDailyPanicHistory(integration, sourceData = null) {
  if (!integration) return getDailyPanicHistory()
  const today = ymd(new Date()) ?? "unknown"
  const nextEntry = {
    date: today,
    vix: Number(sourceData?.vix ?? NaN),
    fearGreed: Number(sourceData?.fearGreed ?? NaN),
    bofa: Number(sourceData?.bofa ?? NaN),
    putCall: Number(sourceData?.putCall ?? NaN),
    highYield: Number(sourceData?.highYield ?? NaN),
    totalScore: Number(integration.sentimentScore ?? 50),
    marketState: String(integration.currentState ?? "중립"),
    riskLevel: String(integration.riskLevel ?? "보통"),
  }
  const prev = getDailyPanicHistory()
  const withoutToday = prev.filter((row) => row.date !== today)
  const merged = [...withoutToday, nextEntry].sort((a, b) => String(a.date).localeCompare(String(b.date)))
  writeDailyRaw(merged)
  return merged
}

export function buildCycleAnalysis(rows) {
  const list = Array.isArray(rows) ? rows : []
  if (list.length < 2) return ["히스토리 누적 중", "데이터가 쌓이면 사이클 전환을 해석합니다."]
  const last = list[list.length - 1]
  const prev = list[list.length - 2]
  const diff = Number(last.totalScore) - Number(prev.totalScore)
  const lines = []
  if (diff >= 8) lines.push("심리 급반등 진행")
  else if (diff <= -8) lines.push("심리 급냉각 진행")
  else lines.push("심리 완만한 전이 구간")
  if (String(last.marketState) !== String(prev.marketState)) {
    lines.push(`${prev.marketState} → ${last.marketState} 전환`)
  } else {
    lines.push(`${last.marketState} 상태 유지`)
  }
  lines.push(Number(last.highYield) >= 5 ? "신용위험 경계 지속" : "신용스프레드 안정권")
  lines.push(Number(last.vix) >= 28 ? "변동성 상단 구간 주의" : "변동성 정상 범위")
  return lines.slice(0, 4)
}
