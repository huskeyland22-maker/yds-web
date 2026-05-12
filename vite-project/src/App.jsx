import { useEffect, useMemo, useRef, useState } from "react"
import { LogIn } from "lucide-react"
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom"
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth"
import { doc, serverTimestamp, setDoc } from "firebase/firestore"
import { fetchHistorySample, submitManualPanicData } from "./config/api.js"
import GlobalMarketBar from "./components/GlobalMarketBar.jsx"
import ValueChainPage from "./components/ValueChainPage.jsx"
import { auth, db, hasFirebaseConfig } from "./firebase.js"
import { usePanicStore } from "./store/panicStore.js"
import { panicMetricNumber } from "./utils/panicMetricValue.js"

const MENU = [
  { label: "시장 사이클", path: "/cycle", active: true },
  { label: "코리아 밸류체인 맵", path: "/value-chain", active: true },
  { label: "매매 타점", path: "/timing", active: true },
  { label: "AI 인사이트", path: "/insights", active: true },
]

const METRIC_DEFS = [
  { key: "vix", label: "VIX" },
  { key: "vxn", label: "VXN" },
  { key: "fearGreed", label: "Fear & Greed" },
  { key: "bofa", label: "BofA" },
  { key: "move", label: "MOVE" },
  { key: "skew", label: "SKEW" },
  { key: "putCall", label: "Put/Call" },
  { key: "highYield", label: "High Yield" },
  { key: "gsBullBear", label: "GS B/B" },
]
const METRIC_KEYS = ["vix", "vxn", "fearGreed", "bofa", "move", "skew", "putCall", "highYield", "gsBullBear"]
const APP_BUILD_ID = import.meta.env.VITE_APP_BUILD_ID ?? "dev"
const PWA_RESUME_RELOAD_COOLDOWN_MS = 10_000
const PANIC_TEXT_DRAFT_KEY = "yds-panic-text-draft-v1"
const AUTO_DATA_ENGINE_ENABLED = false
const PANIC_TEXT_PLACEHOLDER = `분류,지수 명칭,최종 확정 수치,전일 대비 (Δ),상태 등급
단기,1. VIX Index,17.38,📉 -0.63,🟢 안정
단기,2. VXN Index,22.45,📉 -0.43,🟢 안정
단기,3. 풋/콜 비율,0.62,📉 -0.01,🟢 안정
중기,4. CNN F&G,66,-,🟡 탐욕
중기,5. MOVE Index,77.92,📉 -0.19,🟢 안정
중기,6. BofA B&B,6.5,-,🟡 주의
장기,7. SKEW Index,141.65,📉 -0.47,🟡 주의
장기,8. 하이일드 스프레드,1.68%,-,🟢 안정
장기,9. GS B/B 지수,68.0%,-,🟡 주의`
const REQUIRED_KEYS = ["vix", "fearGreed", "bofa", "putCall", "highYield"]
const CYCLE_HISTORY_KEY = "yds-cycle-metric-history-v1"
const CYCLE_HISTORY_MAX = 120
const TACTICAL_SERIES = [
  { key: "vix", name: "VIX", color: "#ef4444" },
  { key: "vxn", name: "VXN", color: "#22c55e" },
  { key: "putCall", name: "Put/Call", color: "#3b82f6" },
]
const STRATEGIC_SERIES = [
  { key: "fearGreed", name: "Fear&Greed", color: "#f43f5e" },
  { key: "move", name: "MOVE", color: "#eab308" },
  { key: "bofa", name: "BofA", color: "#8b5cf6" },
]
const MACRO_SERIES = [
  { key: "skew", name: "SKEW", color: "#14b8a6" },
  { key: "highYield", name: "하이일드", color: "#f97316" },
  { key: "gsBullBear", name: "GS B/B", color: "#a855f7" },
]

const FIELD_LABELS = {
  vix: "VIX",
  vxn: "VXN",
  fearGreed: "Fear & Greed",
  bofa: "BofA",
  move: "MOVE",
  skew: "SKEW",
  putCall: "Put/Call",
  highYield: "High Yield",
  gsBullBear: "GS B/B",
}

function isIosStandalonePwa() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false
  const ua = navigator.userAgent || ""
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true
  return ios && standalone
}

function forceResumeReloadWithCooldown() {
  if (!isIosStandalonePwa() || typeof window === "undefined") return
  if (!AUTO_DATA_ENGINE_ENABLED) return
  try {
    const key = "yds-pwa-resume-reload-at"
    const now = Date.now()
    const last = Number(window.sessionStorage.getItem(key) || "0")
    if (Number.isFinite(last) && now - last < PWA_RESUME_RELOAD_COOLDOWN_MS) return
    window.sessionStorage.setItem(key, String(now))
    window.location.reload()
  } catch {
    window.location.reload()
  }
}

function normalizeNumberToken(raw) {
  if (!raw) return null
  const cleaned = String(raw).replace(/%/g, "").replace(/,/g, "").trim()
  const parsed = parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function splitCsvLine(line) {
  return String(line)
    .split(",")
    .map((p) => p.trim())
}

function readCycleMetricHistory() {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(CYCLE_HISTORY_KEY)
    const arr = JSON.parse(raw || "[]")
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveCycleMetricHistory(panicData) {
  if (typeof window === "undefined" || !panicData) return readCycleMetricHistory()
  const row = {
    ts: new Date().toISOString(),
    vix: panicMetricNumber(panicData?.vix),
    vxn: panicMetricNumber(panicData?.vxn),
    putCall: panicMetricNumber(panicData?.putCall),
    fearGreed: panicMetricNumber(panicData?.fearGreed),
    move: panicMetricNumber(panicData?.move),
    bofa: panicMetricNumber(panicData?.bofa),
    skew: panicMetricNumber(panicData?.skew),
    highYield: panicMetricNumber(panicData?.highYield),
    gsBullBear: panicMetricNumber(panicData?.gsBullBear ?? panicData?.gs),
  }
  const validKeys = ["vix", "fearGreed", "putCall", "highYield"]
  if (!validKeys.every((k) => Number.isFinite(row[k]))) return readCycleMetricHistory()
  const prev = readCycleMetricHistory()
  const last = prev[prev.length - 1]
  if (
    last &&
    last.vix === row.vix &&
    last.fearGreed === row.fearGreed &&
    last.putCall === row.putCall &&
    last.highYield === row.highYield
  ) {
    return prev
  }
  const next = [...prev, row].slice(-CYCLE_HISTORY_MAX)
  window.localStorage.setItem(CYCLE_HISTORY_KEY, JSON.stringify(next))
  return next
}

function mergeCycleRows(rowsA, rowsB) {
  const out = new Map()
  for (const row of [...(rowsA || []), ...(rowsB || [])]) {
    if (!row?.ts) continue
    out.set(row.ts, { ...(out.get(row.ts) || {}), ...row })
  }
  return [...out.values()].sort((a, b) => String(a.ts).localeCompare(String(b.ts))).slice(-CYCLE_HISTORY_MAX)
}

function toCycleHistoryFromSample(sampleRows = [], fallbackCurrent = {}) {
  return sampleRows
    .map((r) => {
      const vix = Number(r?.vix)
      const fearGreed = Number(r?.fearGreed)
      const putCall = Number(r?.putCall)
      const bofa = Number(r?.bofa)
      const ts = String(r?.date || "").trim()
      if (!ts || !Number.isFinite(vix) || !Number.isFinite(fearGreed)) return null
      const inferredVxn = Number.isFinite(vix) ? Number((vix * 1.25).toFixed(2)) : Number(fallbackCurrent?.vxn)
      const inferredMove = Number((90 + (vix - 20) * 1.4).toFixed(2))
      const inferredSkew = Number((130 + (fearGreed - 50) * 0.28).toFixed(2))
      const inferredHy = Number((3 + (100 - fearGreed) * 0.03).toFixed(2))
      const inferredGs = Number(fearGreed.toFixed(2))
      return {
        ts: ts.includes("T") ? ts : `${ts}T00:00:00.000Z`,
        vix,
        vxn: Number.isFinite(inferredVxn) ? inferredVxn : null,
        putCall: Number.isFinite(putCall) ? putCall : null,
        fearGreed,
        move: Number.isFinite(inferredMove) ? inferredMove : Number(fallbackCurrent?.move),
        bofa: Number.isFinite(bofa) ? bofa : Number(fallbackCurrent?.bofa),
        skew: Number.isFinite(inferredSkew) ? inferredSkew : Number(fallbackCurrent?.skew),
        highYield: Number.isFinite(inferredHy) ? inferredHy : Number(fallbackCurrent?.highYield),
        gsBullBear: Number.isFinite(inferredGs) ? inferredGs : Number(fallbackCurrent?.gsBullBear),
      }
    })
    .filter(Boolean)
}

function MiniTrendChart({ rows, series }) {
  const svgRef = useRef(null)
  const [hoverIndex, setHoverIndex] = useState(null)
  const validRows = (Array.isArray(rows) ? rows : [])
    .filter((r) => series.some((s) => Number.isFinite(Number(r?.[s.key]))))
    .slice(-120)
  if (validRows.length < 2) {
    return <p className="m-0 text-xs text-gray-500">흐름 데이터 수집중</p>
  }
  const chartRows = validRows.map((row) => {
    const d = new Date(row.ts)
    return { ...row, monthLabel: `${d.getMonth() + 1}월` }
  })
  const width = 720
  const laneHeight = 34
  const laneGap = 10
  const padY = 5
  const chartHeight = series.length * laneHeight + (series.length - 1) * laneGap
  const monthMarks = Array.from({ length: 4 })
    .map((_, i) => {
      const idx = Math.round(((chartRows.length - 1) * i) / 3)
      const row = chartRows[idx]
      if (!row) return null
      const x = (idx / Math.max(1, chartRows.length - 1)) * width
      return { x, label: row.monthLabel }
    })
    .filter(Boolean)

  const lanePath = (key, laneTop) => {
    const vals = chartRows.map((r) => Number(r?.[key]))
    const finite = vals.filter(Number.isFinite)
    if (finite.length < 2) return ""
    const points = vals
      .map((v, i) => {
        if (!Number.isFinite(v)) return null
        const x = (i / Math.max(1, chartRows.length - 1)) * width
        return { x, v }
      })
      .filter(Boolean)
    if (points.length < 2) return ""
    const min = Math.min(...finite)
    const max = Math.max(...finite)
    const span = Math.max(1e-6, max - min)
    const laneUsable = laneHeight - padY * 2
    const toY = (v) => laneTop + (laneHeight - padY) - ((v - min) / span) * laneUsable
    const pts = points.map((p) => ({ x: p.x, y: toY(p.v) }))
    let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`
    for (let i = 1; i < pts.length; i += 1) {
      const prev = pts[i - 1]
      const curr = pts[i]
      const cp1x = prev.x + (curr.x - prev.x) * 0.35
      const cp2x = prev.x + (curr.x - prev.x) * 0.65
      d += ` C${cp1x.toFixed(2)},${prev.y.toFixed(2)} ${cp2x.toFixed(2)},${curr.y.toFixed(2)} ${curr.x.toFixed(2)},${curr.y.toFixed(2)}`
    }
    return d
  }
  const hoverX = hoverIndex == null ? null : (hoverIndex / Math.max(1, chartRows.length - 1)) * width
  const hoverDate = hoverIndex == null ? "" : String(chartRows[hoverIndex]?.ts ?? "").slice(0, 10)
  const onMove = (e) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = e.clientX - rect.left
    const ratio = Math.max(0, Math.min(1, px / rect.width))
    const idx = Math.round(ratio * Math.max(0, chartRows.length - 1))
    setHoverIndex(idx)
  }

  return (
    <div className="flex h-32 w-full gap-3 rounded-lg bg-[#0f172a]/75 px-2 py-2">
      <div className="flex w-[92px] shrink-0 flex-col justify-center gap-1.5 border-r border-slate-700/60 pr-2">
        {series.map((s) => (
          <div key={`label-${s.key}`} className="text-[10px] font-semibold tracking-wide" style={{ color: s.color }}>
            {s.name ?? s.key}
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${chartHeight + 22}`}
          className="h-28 w-full"
          onMouseMove={onMove}
          onMouseEnter={onMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {series.map((s, idx) => {
            const laneTop = idx * (laneHeight + laneGap)
            const d = lanePath(s.key, laneTop)
            return (
              <g key={s.key}>
                {[0.25, 0.5, 0.75].map((r) => (
                  <line
                    key={`${s.key}-g-${r}`}
                    x1="0"
                    y1={laneTop + laneHeight * r}
                    x2={width}
                    y2={laneTop + laneHeight * r}
                    stroke="rgba(71,85,105,0.16)"
                    strokeWidth="0.9"
                  />
                ))}
                <line
                  x1="0"
                  y1={laneTop + laneHeight}
                  x2={width}
                  y2={laneTop + laneHeight}
                  stroke="rgba(71,85,105,0.35)"
                  strokeWidth="1"
                />
                {d ? (
                  <path
                    d={d}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#lineGlow)"
                  />
                ) : null}
              </g>
            )
          })}
          {hoverX != null ? (
            <line
              x1={hoverX}
              y1={0}
              x2={hoverX}
              y2={chartHeight}
              stroke="rgba(148,163,184,0.45)"
              strokeWidth="1"
            />
          ) : null}
          {monthMarks.map((m, i) => (
            <g key={`m-${i}`}>
              <line
                x1={m.x}
                y1={chartHeight - 2}
                x2={m.x}
                y2={chartHeight + 2}
                stroke="rgba(148,163,184,0.45)"
                strokeWidth="1"
              />
              <text x={m.x} y={chartHeight + 15} fill="#94a3b8" fontSize="10" textAnchor="middle">
                {m.label}
              </text>
            </g>
          ))}
          <g
            style={{
              opacity: hoverIndex == null ? 0 : 1,
              transition: "opacity 180ms ease, transform 180ms ease",
            }}
          >
            {(() => {
              const tipW = 340
              const rowGap = 30
              const headerH = 38
              const padBottom = 22
              const tipH = headerH + series.length * rowGap + padBottom
              const tipX = Math.max(10, Math.min(width - tipW - 10, (hoverX ?? 0) - tipW / 2))
              const tipY = 8
              const rowStartY = tipY + headerH
              const labelX = tipX + 18
              const valueX = tipX + tipW - 18
              return (
                <>
                  <rect
                    x={tipX}
                    y={tipY}
                    width={tipW}
                    height={tipH}
                    rx={14}
                    fill="rgba(2,6,23,0.86)"
                    stroke="rgba(103,232,249,0.28)"
                  />
                  <rect
                    x={tipX + 1}
                    y={tipY + 1}
                    width={tipW - 2}
                    height={tipH - 2}
                    rx={13}
                    fill="none"
                    stroke="rgba(168,85,247,0.18)"
                  />
                  <text
                    x={labelX}
                    y={tipY + 26}
                    fill="#93c5fd"
                    fontSize="14"
                    fontWeight="600"
                    letterSpacing="0.2px"
                  >
                    {hoverDate}
                  </text>
                  {series.map((s, i) => {
                    const raw = Number(chartRows[hoverIndex ?? 0]?.[s.key])
                    const val = Number.isFinite(raw) ? raw.toFixed(2) : "-"
                    return (
                      <g key={`tip-row-${s.key}`}>
                        <text
                          x={labelX}
                          y={rowStartY + i * rowGap}
                          fill={s.color}
                          fontSize="15"
                          fontWeight="600"
                        >
                          {s.name}
                        </text>
                        <text
                          x={valueX}
                          y={rowStartY + i * rowGap}
                          fill="#e2e8f0"
                          fontSize="20"
                          fontWeight="700"
                          textAnchor="end"
                        >
                          {val}
                        </text>
                      </g>
                    )
                  })}
                </>
              )
            })()}
          </g>
        </svg>
      </div>
    </div>
  )
}

function extractMetricValueFromLine(line) {
  const parts = splitCsvLine(line)
  // Expected format: 분류,지수 명칭,최종 확정 수치,전일 대비,상태
  if (parts.length >= 3) return normalizeNumberToken(parts[2])
  if (parts.length >= 2) return normalizeNumberToken(parts[1])
  return null
}

function parseTextPanicData(text) {
  const source = String(text || "")
  const lines = source.split(/\r?\n/).map((ln) => ln.trim()).filter(Boolean)
  const out = Object.fromEntries(METRIC_KEYS.map((k) => [k, null]))
  const hit = new Set()

  const applyByPattern = (pattern, key) => {
    const line = lines.find((ln) => {
      const parts = splitCsvLine(ln)
      const metricName = parts[1] ?? parts[0] ?? ""
      return pattern.test(metricName)
    })
    if (!line) return
    const n = extractMetricValueFromLine(line)
    if (n == null) return
    out[key] = n
    hit.add(key)
  }

  applyByPattern(/\bVIX\b/i, "vix")
  applyByPattern(/\bVXN\b/i, "vxn")
  applyByPattern(/(?:풋\/콜|Put\/Call|PutCall|풋콜)/i, "putCall")
  applyByPattern(/(?:CNN\s*F&G|Fear\s*&\s*Greed|공포탐욕|탐욕지수)/i, "fearGreed")
  applyByPattern(/\bMOVE\b/i, "move")
  applyByPattern(/BofA(?:\s*B&B)?/i, "bofa")
  applyByPattern(/\bSKEW\b/i, "skew")
  applyByPattern(/(?:하이일드|HY\s*스프레드|High\s*Yield)/i, "highYield")
  applyByPattern(/(?:GS\s*B\/B|GS\s*Bull\s*Bear)/i, "gsBullBear")

  const result = {
    data: out,
    missingRequired: REQUIRED_KEYS.filter((key) => out[key] == null),
    hitCount: hit.size,
  }
  console.log("PARSED PANIC DATA:", result.data)
  return result
}

function readRecentMemos(limit = 80) {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem("yds-investment-memos-v1")
    const list = JSON.parse(raw || "[]")
    if (!Array.isArray(list)) return []
    return list.slice(0, limit)
  } catch {
    return []
  }
}

function getMarketCycleStage(panicData) {
  const vix = panicMetricNumber(panicData?.vix)
  const fearGreed = panicMetricNumber(panicData?.fearGreed)
  if (Number.isFinite(vix) && vix >= 32) return "패닉"
  if (Number.isFinite(vix) && vix >= 24) return "공포"
  if (Number.isFinite(fearGreed) && fearGreed >= 75) return "과열"
  if (Number.isFinite(fearGreed) && fearGreed >= 60) return "탐욕"
  return "중립"
}

function getLongPositionLabel(score) {
  const n = Number(score)
  if (!Number.isFinite(n)) return "중립"
  if (n <= 15) return "패닉"
  if (n <= 30) return "공포"
  if (n <= 45) return "반등초기"
  if (n <= 60) return "중립"
  if (n <= 75) return "순환매"
  if (n <= 90) return "과열"
  return "버블"
}

function rawPanicField(panicData, key) {
  if (!panicData || typeof panicData !== "object") return null
  if (key === "gsBullBear") return panicData.gsBullBear ?? panicData.gs
  return panicData[key]
}

function formatPanicMetricDisplay(key, raw) {
  const n = panicMetricNumber(raw)
  if (!Number.isFinite(n)) return "-"
  if (key === "putCall") return n.toFixed(2)
  if (key === "fearGreed" || key === "gsBullBear") return String(Math.round(n))
  return String(Math.round(n * 100) / 100)
}

function interpretMetricState(key, rawValue) {
  const v = panicMetricNumber(rawValue)
  if (!Number.isFinite(v)) return "데이터 대기"
  switch (key) {
    case "vix":
      if (v >= 30) return "변동성 급등 · 공포 구간"
      if (v >= 24) return "경계 구간 · 변동성 확대"
      if (v <= 16) return "안정 구간 · 리스크 온"
      return "중립 구간"
    case "fearGreed":
      if (v >= 75) return "탐욕 과열 · 조정 경계"
      if (v >= 60) return "위험 선호 우세"
      if (v <= 30) return "공포 심리 우세"
      return "중립 심리"
    case "bofa":
      if (v >= 7) return "낙관 과열 · 리스크 경계"
      if (v <= 3) return "비관 우세 · 방어 선호"
      return "중립"
    case "putCall":
      if (v >= 1.05) return "헤지 수요 증가 · 방어 우세"
      if (v <= 0.7) return "추격 심리 확대 · 과열 주의"
      return "균형 구간"
    case "highYield":
      if (v >= 5.5) return "신용 리스크 확대"
      if (v <= 4.2) return "신용 안정 · 리스크 온"
      return "보통"
    case "vxn":
      return v >= 30 ? "나스닥 변동성 확대" : "나스닥 변동성 안정"
    case "move":
      return v >= 110 ? "채권 변동성 경고" : "채권 변동성 완화"
    case "skew":
      return v >= 145 ? "꼬리위험 헤지 수요 증가" : "꼬리위험 수요 안정"
    case "gsBullBear":
      return v >= 75 ? "강한 낙관 · 과열 주의" : v <= 35 ? "비관 우세" : "중립"
    default:
      return "중립"
  }
}

function getCycleStepSequence() {
  return ["공포", "회복", "낙관", "과열", "흔들림", "패닉"]
}

function buildMemoInsightRows(memos) {
  if (!memos.length) return ["메모 누적 후 AI 인사이트가 강화됩니다."]
  const sectorCounts = {}
  let bullish = 0
  let bearish = 0
  let riskWords = 0
  for (const memo of memos) {
    const sentiment = memo?.sentiment ?? memo?.parsed?.sentiment
    if (sentiment === "bullish") bullish += 1
    if (sentiment === "bearish") bearish += 1
    const sectors = memo?.sectorTags ?? memo?.parsed?.sectors ?? []
    for (const sector of sectors) sectorCounts[sector] = (sectorCounts[sector] ?? 0) + 1
    const text = String(memo?.rawText ?? memo?.raw ?? "")
    if (/위험|리스크|패닉|vix|과열/i.test(text)) riskWords += 1
  }
  const topSectors = Object.entries(sectorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name, n]) => `${name}(${n})`)
  const rows = []
  if (topSectors.length) rows.push(`최근 섹터 흐름: ${topSectors.join(" → ")}`)
  rows.push(
    bullish >= bearish
      ? "bullish 표현이 우세하며 risk-on 심리가 유지되는 구간"
      : "bearish 표현이 증가하며 방어 심리 전환 가능성",
  )
  if (riskWords >= 3) rows.push("위험 표현 증가: 변동성 확대 구간 경계 필요")
  return rows.slice(0, 4)
}

function buildMemoFlowStats(memos) {
  const rows = Array.isArray(memos) ? memos : []
  const recent = rows.slice(0, 40)
  let bullish = 0
  let bearish = 0
  let risk = 0
  const sectorCounts = {}
  for (const memo of recent) {
    const sentiment = memo?.sentiment ?? memo?.parsed?.sentiment
    if (sentiment === "bullish") bullish += 1
    if (sentiment === "bearish") bearish += 1
    const text = String(memo?.rawText ?? memo?.raw ?? "")
    if (/위험|리스크|패닉|과열|vix/i.test(text)) risk += 1
    for (const sector of memo?.sectorTags ?? memo?.parsed?.sectors ?? []) {
      sectorCounts[sector] = (sectorCounts[sector] ?? 0) + 1
    }
  }
  const rotation = Object.entries(sectorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name]) => name)
  return { bullish, bearish, risk, rotation }
}

function buildKeywordFrequency(memos) {
  const rows = Array.isArray(memos) ? memos : []
  const recent = rows.slice(0, 60)
  const keywords = ["원전", "전력", "눌림목", "과열", "거래량증가", "반도체", "리스크경고", "VIX급등"]
  const counts = Object.fromEntries(keywords.map((k) => [k, 0]))
  for (const memo of recent) {
    const text = String(memo?.rawText ?? memo?.raw ?? "")
    const signals = memo?.parsedSignals ?? memo?.parsed?.signal ?? []
    const sectors = memo?.sectorTags ?? memo?.parsed?.sectors ?? []
    for (const k of keywords) {
      if (text.includes(k) || signals.includes(k) || sectors.includes(k)) counts[k] += 1
    }
  }
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
}

function buildSentimentTrend(memos) {
  const rows = Array.isArray(memos) ? memos : []
  const recent = rows.slice(0, 40)
  const older = rows.slice(40, 80)
  const count = (list, key) =>
    list.filter((memo) => (memo?.sentiment ?? memo?.parsed?.sentiment) === key).length
  const recentBull = count(recent, "bullish")
  const recentBear = count(recent, "bearish")
  const olderBull = count(older, "bullish")
  const olderBear = count(older, "bearish")
  return {
    bullishDelta: recentBull - olderBull,
    bearishDelta: recentBear - olderBear,
    recentBull,
    recentBear,
  }
}

function buildInsightWarnings({ flowStats, panicData, keywordTop }) {
  const warnings = []
  const vix = panicMetricNumber(panicData?.vix)
  const fearGreed = panicMetricNumber(panicData?.fearGreed)
  const top = keywordTop?.[0]?.[0] ?? null
  if ((Number.isFinite(vix) && vix >= 24) || flowStats.risk >= 4) {
    warnings.push("주의: 위험 표현 및 변동성 경계 구간 확대")
  }
  if (Number.isFinite(fearGreed) && fearGreed >= 75) {
    warnings.push("주의: 탐욕 과열 신호 유지")
  }
  if (flowStats.rotation.length >= 3 && top) {
    warnings.push(`주의: ${top} 중심 과집중 가능성 점검`)
  }
  return warnings.slice(0, 3)
}

function buildInsightCards({ marketCycleStage, flowStats, trend, keywordTop }) {
  const cards = []
  cards.push({
    title: "오늘의 시장 흐름",
    body:
      marketCycleStage === "과열"
        ? "과열 심리 일부 감지 · 추격보다 리스크 관리 우선"
        : marketCycleStage === "공포" || marketCycleStage === "패닉"
          ? "리스크 오프 가능성 확대 · 방어 비중 점검"
          : "중립~탐욕 사이클 · 선별 대응 구간",
    confidence: 0.74,
    tone: "중립",
    chips: flowStats.rotation.slice(0, 3),
  })
  cards.push({
    title: "순환매 흐름 변화",
    body: flowStats.rotation.length
      ? `${flowStats.rotation.slice(0, 4).join(" → ")} 중심으로 시장 관심 이동`
      : "순환매 흐름 데이터 축적중",
    confidence: 0.69,
    tone: "관찰",
    chips: flowStats.rotation.slice(0, 3),
  })
  cards.push({
    title: "감정 흐름",
    body:
      trend.bearishDelta > trend.bullishDelta
        ? "bearish 흐름 확대로 방어 심리 증가 가능성"
        : "bullish 흐름 유지, 다만 과열 표현 동반 여부 점검 필요",
    confidence: 0.66,
    tone: trend.bearishDelta > trend.bullishDelta ? "주의" : "완만",
    chips: keywordTop.slice(0, 2).map(([k]) => k),
  })
  return cards
}

function buildFinderCandidates(memos, marketCycleStage) {
  const rows = Array.isArray(memos) ? memos : []
  const bag = new Map()
  for (const memo of rows.slice(0, 80)) {
    const stock = memo?.parsedStocks?.[0] ?? memo?.parsed?.stock
    if (!stock) continue
    if (!bag.has(stock)) {
      bag.set(stock, {
        name: stock,
        mentions: 0,
        bullish: 0,
        bearish: 0,
        sectors: new Set(),
        signals: new Set(),
      })
    }
    const row = bag.get(stock)
    row.mentions += 1
    const sentiment = memo?.sentiment ?? memo?.parsed?.sentiment
    if (sentiment === "bullish") row.bullish += 1
    if (sentiment === "bearish") row.bearish += 1
    for (const sector of memo?.sectorTags ?? memo?.parsed?.sectors ?? []) row.sectors.add(sector)
    for (const signal of memo?.parsedSignals ?? memo?.parsed?.signal ?? []) row.signals.add(signal)
  }
  const cycleBias =
    marketCycleStage === "공포" || marketCycleStage === "패닉"
      ? "패닉 후 회복 후보 관찰"
      : marketCycleStage === "과열"
        ? "추격 금지 · 눌림 대기"
        : "순환매 초기 흐름 탐색"
  return [...bag.values()]
    .map((row) => {
      const signalArr = [...row.signals]
      const hasPullback = signalArr.includes("눌림목")
      const hasVolume = signalArr.includes("거래량증가")
      const hasRotation = signalArr.includes("순환매")
      const confidence = Math.max(
        45,
        Math.min(92, 48 + row.mentions * 8 + row.bullish * 5 + (hasVolume ? 8 : 0) + (hasPullback ? 7 : 0)),
      )
      const risk =
        row.bearish > row.bullish
          ? "주의"
          : marketCycleStage === "과열"
            ? "중간"
            : "낮음"
      const flow = hasRotation
        ? "순환매 초기 진입"
        : hasPullback && hasVolume
          ? "눌림 + 거래량 증가"
          : hasPullback
            ? "눌림목 후보"
            : hasVolume
              ? "거래량 증가 초기"
              : "관찰 후보"
      return {
        ...row,
        sectors: [...row.sectors],
        signals: signalArr,
        confidence,
        risk,
        flow,
        cycleBias,
      }
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8)
}

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const panicData = usePanicStore((s) => s.panicData)
  const manualMode = usePanicStore((s) => s.manualMode)
  const panicInitialized = usePanicStore((s) => s.initialized)
  const initializePanicData = usePanicStore((s) => s.initializePanicData)
  const applyManualPanicData = usePanicStore((s) => s.applyManualPanicData)
  const releaseManualMode = usePanicStore((s) => s.releaseManualMode)
  const startAutoRefresh = usePanicStore((s) => s.startAutoRefresh)
  const stopAutoRefresh = usePanicStore((s) => s.stopAutoRefresh)
  const syncOnAppResume = usePanicStore((s) => s.syncOnAppResume)
  const [openInput, setOpenInput] = useState(false)
  const [inputText, setInputText] = useState("")
  const [user, setUser] = useState(null)
  const [saveToast, setSaveToast] = useState("")
  const [saveDone, setSaveDone] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [inputError, setInputError] = useState("")
  const [buildVersion, setBuildVersion] = useState(`v1.0.${String(APP_BUILD_ID).slice(-6)}`)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  )
  const [recentMemos, setRecentMemos] = useState(() => readRecentMemos())
  const [cycleMetricHistory, setCycleMetricHistory] = useState(() => readCycleMetricHistory())

  const parseResult = useMemo(() => parseTextPanicData(inputText), [inputText])
  const parsedData = parseResult.data
  const missingFields = useMemo(() => METRIC_DEFS.filter(({ key }) => parsedData[key] === null).map(({ key }) => key), [parsedData])
  const previewTone = useMemo(() => {
    const { vix, fearGreed } = parsedData
    if (!Number.isFinite(vix) || !Number.isFinite(fearGreed)) return "분석 대기"
    if (fearGreed <= 25 || vix >= 30) return "패닉"
    if (fearGreed <= 45 || vix >= 22) return "관망"
    if (fearGreed <= 70 || vix >= 16) return "중립"
    return "공격"
  }, [parsedData])

  const submitInput = () => {
    const { vix, vxn, fearGreed, bofa, move, skew, putCall, highYield, gsBullBear } = parsedData
    if (
      vix === null ||
      fearGreed === null ||
      bofa === null ||
      putCall === null ||
      highYield === null
    ) {
      const requiredMissingLabels = parseResult.missingRequired.map((key) => FIELD_LABELS[key] ?? key)
      setInputError(`${requiredMissingLabels.join(", ")} 값을 찾을 수 없습니다. 입력 텍스트를 확인해 주세요.`)
      return
    }
    setInputError("")

    const normalizedParsedData = {
      vix,
      vxn,
      fearGreed,
      bofa,
      move,
      skew,
      putCall,
      highYield,
      gsBullBear,
    }

    try {
      setIsSaving(true)
      console.log("manualData:", normalizedParsedData)

      // 1) 중앙 store를 통한 단일 업데이트 경로
      applyManualPanicData(normalizedParsedData)
      const current = usePanicStore.getState?.().panicData ?? null
      console.log("renderData:", current)

      // 2) UI 즉시 종료
      setSaveDone(true)
      setSaveToast("✅ 패닉지수 저장 완료")
      setIsSaving(false)
      setOpenInput(false)
      window.setTimeout(() => {
        setOpenInput(false)
      }, 100)

      // 3) 서버 저장은 백그라운드 처리 (UI 블로킹 금지)
      void (async () => {
        try {
          // 서버 동기화는 수행하되, 로컬 스냅샷 우선 정책을 위해
          // 응답으로 클라이언트 상태를 덮어쓰지 않습니다.
          await submitManualPanicData(normalizedParsedData)
        } catch (err) {
          console.error("AI 리포트 저장 실패", err)
        }
      })()

      if (db) {
        void (async () => {
          try {
            const reportId = String(Date.now())
            await setDoc(doc(db, "panic_reports", reportId), {
              ...normalizedParsedData,
              source: "ai_report",
              createdAt: serverTimestamp(),
            })
          } catch (fireErr) {
            console.error("panic_reports 저장 실패", fireErr)
          }
        })()
      }
    } catch (err) {
      console.error(err)
      setIsSaving(false)
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const savedDraft = window.localStorage.getItem(PANIC_TEXT_DRAFT_KEY)
      if (savedDraft) setInputText(savedDraft)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      if (inputText.trim()) {
        window.localStorage.setItem(PANIC_TEXT_DRAFT_KEY, inputText)
      } else {
        window.localStorage.removeItem(PANIC_TEXT_DRAFT_KEY)
      }
    } catch {
      // ignore
    }
  }, [inputText])

  useEffect(() => {
    if (!panicData) return
    setCycleMetricHistory(saveCycleMetricHistory(panicData))
  }, [panicData])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const sample = await fetchHistorySample({ debugLog: false })
        if (cancelled) return
        const mapped = toCycleHistoryFromSample(sample, panicData ?? {})
        setCycleMetricHistory((prev) => {
          const merged = mergeCycleRows(mapped, prev)
          try {
            window.localStorage.setItem(CYCLE_HISTORY_KEY, JSON.stringify(merged))
          } catch {
            // ignore
          }
          return merged
        })
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [panicData])

  useEffect(() => {
    if (typeof window === "undefined") return
    const refreshMemos = () => setRecentMemos(readRecentMemos())
    refreshMemos()
    window.addEventListener("yds:memo-saved", refreshMemos)
    window.addEventListener("storage", refreshMemos)
    return () => {
      window.removeEventListener("yds:memo-saved", refreshMemos)
      window.removeEventListener("storage", refreshMemos)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await initializePanicData()
      if (cancelled) return
      startAutoRefresh()
    })()
    return () => {
      cancelled = true
      stopAutoRefresh()
    }
  }, [initializePanicData, startAutoRefresh, stopAutoRefresh])

  useEffect(() => {
    if (!auth) return
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser || null)
    })
    return () => unsubscribe()
  }, [auth])

  useEffect(() => {
    let cancelled = false
    async function loadBuildVersion() {
      try {
        const res = await fetch(`/build-version.json?t=${Date.now()}`, { cache: "no-store" })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled && typeof json?.version === "string" && json.version) {
          setBuildVersion(json.version)
        }
      } catch {
        // ignore
      }
    }
    void loadBuildVersion()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return
    let lastRun = 0
    const MIN_INTERVAL_MS = 10_000
    const runResumeSync = () => {
      const now = Date.now()
      if (now - lastRun < MIN_INTERVAL_MS) return
      lastRun = now
      void syncOnAppResume()
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        runResumeSync()
        if (!manualMode) forceResumeReloadWithCooldown()
      }
    }
    const onFocus = () => {
      runResumeSync()
      if (!manualMode) forceResumeReloadWithCooldown()
    }
    const onPageShow = () => {
      runResumeSync()
      if (!manualMode) forceResumeReloadWithCooldown()
    }

    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onFocus)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [syncOnAppResume, manualMode])


  useEffect(() => {
    if (!saveDone) return
    const timer = window.setTimeout(() => {
      setOpenInput(false)
      setInputText("")
      setSaveDone(false)
      setSaveToast("")
      setIsSaving(false)
    }, 600)
    return () => window.clearTimeout(timer)
  }, [saveDone])


  const login = async () => {
    if (!hasFirebaseConfig()) {
      window.alert("Firebase 환경변수 설정이 필요합니다 (.env.local 확인)")
      return
    }
    if (!auth) return
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
    } catch (err) {
      console.error("로그인 실패", err)
      window.alert("로그인에 실패했습니다")
    }
  }

  const logout = async () => {
    if (!auth) return
    try {
      await signOut(auth)
    } catch (err) {
      console.error("로그아웃 실패", err)
      window.alert("로그아웃에 실패했습니다")
    }
  }

  const saveMyData = async () => {
    if (!user) {
      window.alert("로그인 후 저장할 수 있습니다")
      return
    }
    if (!panicData) {
      window.alert("저장할 데이터가 아직 없습니다")
      return
    }
    if (!db) return
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          email: user.email ?? null,
          displayName: user.displayName ?? null,
          lastData: panicData,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
      window.alert("💾 내 데이터 저장 완료")
    } catch (err) {
      console.error("Firestore 저장 실패", err)
      window.alert("저장에 실패했습니다")
    }
  }
  const marketCycleStage = useMemo(() => getMarketCycleStage(panicData), [panicData])
  const insightRows = useMemo(() => buildMemoInsightRows(recentMemos), [recentMemos])
  const flowStats = useMemo(() => buildMemoFlowStats(recentMemos), [recentMemos])
  const cycleSteps = useMemo(() => getCycleStepSequence(), [])
  const keywordTop = useMemo(() => buildKeywordFrequency(recentMemos), [recentMemos])
  const sentimentTrend = useMemo(() => buildSentimentTrend(recentMemos), [recentMemos])
  const insightWarnings = useMemo(
    () => buildInsightWarnings({ flowStats, panicData, keywordTop }),
    [flowStats, panicData, keywordTop],
  )
  const insightCards = useMemo(
    () => buildInsightCards({ marketCycleStage, flowStats, trend: sentimentTrend, keywordTop }),
    [marketCycleStage, flowStats, sentimentTrend, keywordTop],
  )
  const finderCandidates = useMemo(() => buildFinderCandidates(recentMemos, marketCycleStage), [recentMemos, marketCycleStage])
  const metricCards = useMemo(
    () =>
      METRIC_DEFS.map(({ key, label }) => {
        const raw = rawPanicField(panicData, key)
        return {
          key,
          label,
          value: formatPanicMetricDisplay(key, raw),
          state: interpretMetricState(key, raw),
        }
      }),
    [panicData],
  )
  const tacticalView = useMemo(() => {
    const vix = panicMetricNumber(panicData?.vix)
    const vxn = panicMetricNumber(panicData?.vxn)
    const putCall = panicMetricNumber(panicData?.putCall)
    const state =
      (Number.isFinite(vix) && vix >= 24) || (Number.isFinite(vxn) && vxn >= 30)
        ? "단기 변동성 확대"
        : "단기 공포 완화"
    const action =
      (Number.isFinite(vix) && vix >= 24) || (Number.isFinite(putCall) && putCall >= 1.05)
        ? "변동성 주의 · 추격 금지"
        : "선별 눌림 매수 가능"
    return { state, action, metrics: [{ k: "VIX", v: panicData?.vix }, { k: "VXN", v: panicData?.vxn }, { k: "Put/Call", v: panicData?.putCall }] }
  }, [panicData])
  const strategicView = useMemo(() => {
    const fg = panicMetricNumber(panicData?.fearGreed)
    const move = panicMetricNumber(panicData?.move)
    const bofa = panicMetricNumber(panicData?.bofa)
    const state =
      Number.isFinite(fg) && fg >= 75
        ? "탐욕 단계 진입"
        : Number.isFinite(fg) && fg <= 35
          ? "공포 우세 구간"
          : "중립~탐욕 구간"
    const action =
      Number.isFinite(fg) && fg >= 75
        ? "주식 60~70% · 일부 현금화 고려"
        : Number.isFinite(fg) && fg <= 35
          ? "분할 진입 · 현금 탄력 운용"
          : "선택적 risk-on 가능"
    return { state, action, metrics: [{ k: "Fear&Greed", v: panicData?.fearGreed }, { k: "MOVE", v: panicData?.move }, { k: "BofA B/B", v: panicData?.bofa }], move, bofa }
  }, [panicData])
  const macroView = useMemo(() => {
    const skew = panicMetricNumber(panicData?.skew)
    const hy = panicMetricNumber(panicData?.highYield)
    const gs = panicMetricNumber(panicData?.gsBullBear ?? panicData?.gs)
    const highRisk =
      (Number.isFinite(skew) && skew >= 145) || (Number.isFinite(hy) && hy >= 5.5) || (Number.isFinite(gs) && gs >= 75)
    const state = highRisk ? "구조적 리스크 경계" : "시스템 리스크 낮음"
    const action = highRisk ? "방어 비중 확대 필요" : "장기 과열 경고 없음"
    return { state, action, metrics: [{ k: "SKEW", v: panicData?.skew }, { k: "하이일드", v: panicData?.highYield }, { k: "GS B/B", v: panicData?.gsBullBear }] }
  }, [panicData])
  const heroSummary = useMemo(
    () => ({
      stage: marketCycleStage,
      mid: strategicView.action,
      short: tacticalView.action,
      long: macroView.state,
    }),
    [marketCycleStage, strategicView.action, tacticalView.action, macroView.state],
  )
  return (
    <div className="flex min-h-[100dvh] min-h-screen flex-col overflow-x-hidden bg-[#0b0f1a] text-gray-200 lg:flex-row">
      <aside className="flex w-full shrink-0 flex-row gap-1 overflow-x-auto border-b border-gray-800/80 bg-[#0f172a] px-2 py-3 lg:h-[100dvh] lg:w-60 lg:flex-col lg:border-b-0 lg:border-r lg:px-2 lg:py-4">
        <div className="mb-0 shrink-0 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 lg:mb-4">
          <p className="m-0 mt-1 whitespace-nowrap text-sm font-semibold text-cyan-100">
            Y&apos;ds 투자 인사이트
          </p>
        </div>
        <nav className="flex min-h-[48px] flex-1 flex-row items-stretch gap-1 lg:flex-col lg:items-stretch lg:px-2">
          {MENU.map((item) => (
            <div
              key={item.label}
              role="presentation"
              onClick={() => {
                if (item.active) {
                  navigate(item.path)
                } else {
                  alert("준비 중입니다")
                }
              }}
              className={
                item.active && location.pathname === item.path
                  ? "flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg bg-purple-600 font-medium text-white lg:min-w-0 lg:justify-start"
                  : item.active
                    ? "flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-gray-800/60 lg:min-w-0 lg:justify-start"
                    : "flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-gray-500 lg:min-w-0 lg:justify-start"
              }
              style={{
                fontSize: isMobile ? "14px" : "18px",
                padding: isMobile ? "10px 14px" : "14px 24px",
              }}
            >
              <span className="whitespace-nowrap">{item.label}</span>
              {!item.active ? <span className="ml-2 text-[10px] text-gray-600">준비중</span> : null}
            </div>
          ))}
        </nav>
        <div className="hidden lg:block lg:mt-auto lg:px-2 lg:pt-5">
          <button
            type="button"
            onClick={() => setOpenInput(true)}
            className="w-full rounded-lg border border-violet-500/40 bg-violet-500/20 px-2 py-2 text-xs text-violet-300 transition-colors hover:bg-violet-500/30"
          >
            🤖 AI 리포트 입력
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex min-h-[52px] shrink-0 gap-3 border-b border-gray-800/80 bg-[#0b0f1a] px-4 py-3 sm:px-6"
          style={{
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "flex-start",
            justifyContent: "space-between",
            overflowX: "hidden",
          }}
        >
          <div className="min-w-0 flex-1">
            <GlobalMarketBar isMobile={isMobile} />
          </div>
          <div className="flex items-start justify-between" style={{ marginTop: "12px", width: isMobile ? "100%" : "auto" }}>
            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: "8px",
                width: "100%",
                alignItems: isMobile ? "stretch" : "center",
                justifyContent: isMobile ? "center" : "flex-start",
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="
                  flex items-center gap-3
                  rounded-2xl
                  border border-cyan-400/20
                  bg-white/5
                  px-4 py-2
                  shadow-[0_0_20px_rgba(0,255,255,0.08)]
                  backdrop-blur-md
                  transition-all duration-300
                  hover:border-cyan-300/40
                "
                >
                  {user ? (
                    <>
                      <img
                        src={user.photoURL || "https://placehold.co/72x72/0f172a/e2e8f0?text=U"}
                        alt="사용자 프로필"
                        className="h-9 w-9 rounded-full border border-cyan-400/30 object-cover"
                      />
                      <div className="leading-tight">
                        <span className="max-w-[140px] truncate text-sm font-semibold text-white">
                          {user.displayName || user.email || "로그인 유저"}
                        </span>
                        <div className="text-[11px] text-cyan-300/70">Premium Access</div>
                      </div>
                      <button
                        type="button"
                        onClick={logout}
                        className="rounded-lg bg-red-500/10 px-2 py-1 text-xs text-red-300 transition hover:bg-red-500/20"
                      >
                        로그아웃
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={login}
                      className="flex items-center gap-2 text-sm font-medium text-cyan-100 transition hover:text-white"
                      style={{ width: isMobile ? "100%" : "auto" }}
                    >
                      <LogIn size={16} />
                      로그인
                    </button>
                  )}
                </div>
              </div>
              <span className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-200">
                Web First 안정화
              </span>
              <span className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-200">
                {buildVersion}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <Routes>
            <Route path="/" element={<Navigate to="/cycle" replace />} />
            <Route
              path="/cycle"
              element={
                <div className="space-y-4">
                  <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-4">
                    <p className="m-0 text-xs uppercase tracking-[0.14em] text-cyan-300">시장 사이클 관제</p>
                    <p className="m-0 mt-1 text-lg font-semibold text-cyan-100">현재 시장 단계: {heroSummary.stage}</p>
                    <div className="mt-2 space-y-1 text-sm text-gray-200">
                      <p className="m-0">단기 판단: {heroSummary.short}</p>
                      <p className="m-0">중기 기준: {heroSummary.mid}</p>
                      <p className="m-0">장기 판단: {heroSummary.long}</p>
                    </div>
                  </section>
                  <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                    <article className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-4">
                      <p className="m-0 text-xs uppercase tracking-[0.14em] text-cyan-300">Tactical · 단기</p>
                      <p className="m-0 mt-1 text-base font-semibold text-cyan-100">{tacticalView.state}</p>
                      <p className="m-0 mt-1 text-sm text-cyan-50">{tacticalView.action}</p>
                      <p className="m-0 mt-2 text-[11px] text-cyan-200/80">단기 지표는 진입 방아쇠(Trigger)입니다.</p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                        {TACTICAL_SERIES.map((s) => (
                          <span key={s.key} className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-gray-200">
                            {s.name}: {formatPanicMetricDisplay(s.key, rawPanicField(panicData, s.key))}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3">
                        <MiniTrendChart rows={cycleMetricHistory.slice(-120)} series={TACTICAL_SERIES} />
                      </div>
                      <p className="m-0 mt-2 text-xs text-gray-300">
                        {panicMetricNumber(panicData?.vix) >= 24 ? "최근 변동성 스파이크 구간" : "최근 공포 완화 흐름"}
                      </p>
                    </article>
                    <article className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-4">
                      <p className="m-0 text-xs uppercase tracking-[0.14em] text-indigo-300">Strategic · 중기</p>
                      <p className="m-0 mt-1 text-base font-semibold text-indigo-100">{strategicView.state}</p>
                      <p className="m-0 mt-1 text-sm text-indigo-50">{strategicView.action}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                        {STRATEGIC_SERIES.map((s) => (
                          <span key={s.key} className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-gray-200">
                            {s.name}: {formatPanicMetricDisplay(s.key, rawPanicField(panicData, s.key))}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3">
                        <MiniTrendChart rows={cycleMetricHistory.slice(-120)} series={STRATEGIC_SERIES} />
                      </div>
                      <p className="m-0 mt-2 text-xs text-gray-300">
                        {panicMetricNumber(panicData?.fearGreed) >= 75 ? "탐욕 강화 흐름" : "중립 회귀 흐름"}
                      </p>
                    </article>
                    <article className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4">
                      <p className="m-0 text-xs uppercase tracking-[0.14em] text-emerald-300">Macro · 장기</p>
                      <p className="m-0 mt-1 text-base font-semibold text-emerald-100">{macroView.state}</p>
                      <p className="m-0 mt-1 text-sm text-emerald-50">{macroView.action}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                        {MACRO_SERIES.map((s) => (
                          <span key={s.key} className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-gray-200">
                            {s.name}: {formatPanicMetricDisplay(s.key, rawPanicField(panicData, s.key))}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3">
                        <MiniTrendChart rows={cycleMetricHistory.slice(-120)} series={MACRO_SERIES} />
                      </div>
                      <p className="m-0 mt-2 text-xs text-gray-300">
                        {macroView.state.includes("낮음") ? "장기 리스크 안정 유지" : "장기 구조적 스트레스 확대"}
                      </p>
                    </article>
                  </section>
                  <section className="rounded-xl border border-slate-700 bg-[#0b1220] px-4 py-4">
                    <p className="m-0 text-sm font-semibold text-slate-200">시간축 행동 가이드</p>
                    <div className="mt-2 space-y-1 text-sm text-gray-200">
                      <p className="m-0">- 단기: {tacticalView.action}</p>
                      <p className="m-0">- 중기: {strategicView.action}</p>
                      <p className="m-0">- 장기: {macroView.action}</p>
                    </div>
                  </section>
                </div>
              }
            />
            <Route path="/value-chain" element={<ValueChainPage panicData={panicData} />} />
            <Route
              path="/timing"
              element={
                <div className="space-y-4">
                  <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-4">
                    <p className="m-0 text-xs uppercase tracking-[0.14em] text-cyan-300">매매 타점</p>
                    <p className="m-0 mt-1 text-lg font-semibold text-cyan-100">사이클 → 섹터 → 종목 → 진입 확인</p>
                    <p className="m-0 mt-1 text-sm text-gray-300">보조지표는 확인용, 핵심은 시장 흐름과 돈의 이동입니다.</p>
                  </section>
                  <section className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-4">
                    <p className="m-0 text-sm font-semibold text-violet-200">체크리스트</p>
                    <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-gray-300 md:grid-cols-2">
                      {["눌림목", "거래량 증가", "단기 시그널", "중기 흐름", "보조지표 확인"].map((item) => (
                        <p key={item} className="m-0 rounded-lg border border-slate-700 bg-slate-900/70 px-2.5 py-2">{item}</p>
                      ))}
                    </div>
                  </section>
                  <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {(finderCandidates.length ? finderCandidates : []).slice(0, 6).map((candidate) => (
                        <article key={candidate.name} className="rounded-xl border border-gray-800 bg-[#0b1220] px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="m-0 text-base font-semibold text-gray-100">{candidate.name}</p>
                            <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">
                              conf {candidate.confidence}
                            </span>
                          </div>
                          <p className="m-0 mt-1 text-xs text-cyan-300">{candidate.flow}</p>
                          <p className="m-0 mt-1 text-xs text-gray-300">
                            위험도 {candidate.risk}
                          </p>
                          <p className="m-0 mt-1 text-xs text-gray-400">
                            시그널: {candidate.signals.slice(0, 3).join(", ") || "관찰중"}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {candidate.sectors.slice(0, 3).map((sector) => (
                              <span key={sector} className="rounded-full border border-indigo-400/25 bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-200">
                                {sector}
                              </span>
                            ))}
                          </div>
                          <p className="m-0 mt-2 text-[11px] text-gray-500">{candidate.cycleBias}</p>
                        </article>
                    ))}
                    {!finderCandidates.length ? <p className="m-0 text-sm text-gray-400">후보 데이터 축적 중입니다.</p> : null}
                  </section>
                </div>
              }
            />
            <Route
              path="/insights"
              element={
                <div className="space-y-4">
                  <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4">
                    <p className="m-0 text-xs uppercase tracking-[0.14em] text-emerald-300">AI 인사이트</p>
                    <p className="m-0 mt-1 text-lg font-semibold text-emerald-100">짧고 강한 시장 해석</p>
                    <p className="m-0 mt-1 text-sm text-gray-300">오늘 시장의 방향만 한눈에 보여줍니다.</p>
                  </section>
                  <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {insightCards.slice(0, 4).map((card) => (
                      <article key={card.title} className="rounded-xl border border-gray-800 bg-[#0b1220] px-4 py-3">
                        <p className="m-0 text-sm font-semibold text-gray-100">{card.title}</p>
                        <p className="m-0 mt-1 text-xs text-gray-300">{card.body}</p>
                      </article>
                    ))}
                  </section>
                  <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                    <p className="m-0 text-sm font-semibold text-amber-200">핵심 경고</p>
                    <div className="mt-2 space-y-1 text-xs text-amber-100">
                      {(insightWarnings.length ? insightWarnings : ["지금은 과도한 경고 신호가 보이지 않습니다."]).map((line) => (
                        <p key={line} className="m-0">- {line}</p>
                      ))}
                    </div>
                  </section>
                  <section className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3">
                    <p className="m-0 text-sm font-semibold text-indigo-200">반복 흐름 키워드</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {keywordTop.slice(0, 6).map(([k, n]) => (
                        <span key={k} className="rounded-full border border-indigo-400/25 bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-100">
                          {k} {n}
                        </span>
                      ))}
                      {!keywordTop.length ? <p className="m-0 text-xs text-gray-400">키워드 누적 대기중</p> : null}
                    </div>
                  </section>
                </div>
              }
            />
            <Route path="*" element={<Navigate to="/cycle" replace />} />
          </Routes>
        </main>
      </div>
      {openInput ? (
      <div
        className="fixed right-0 top-0 z-[9999] h-full w-[300px] bg-[#111827] p-5 shadow-[-4px_0_10px_rgba(0,0,0,0.3)] transition-transform duration-300 translate-x-0"
        style={{
          width: "360px",
          background: "linear-gradient(180deg, #0f172a, #020617)",
          boxShadow: "-6px 0 20px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          pointerEvents: "auto",
        }}
      >
        <div className="mb-4 rounded-2xl border border-cyan-500/10 bg-[#0b1220] p-3">
          <h3 style={{ color: "#c4b5fd", marginBottom: "5px" }}>패닉지수 텍스트 붙여넣기</h3>
          <p style={{ fontSize: "12px", color: "#64748b" }}>표 형태 텍스트를 그대로 붙여넣으면 자동으로 수치를 추출합니다.</p>
        </div>
        <textarea
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value)
            if (inputError) setInputError("")
          }}
          placeholder={PANIC_TEXT_PLACEHOLDER}
          style={{
            flex: 1,
            background: "#020617",
            color: "#e2e8f0",
            border: "1px solid #1e293b",
            borderRadius: "10px",
            padding: "14px",
            fontFamily: "Inter, Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
            fontSize: "13px",
            lineHeight: "1.5",
            outline: "none",
            boxShadow: "inset 0 0 10px rgba(0,0,0,0.4)",
          }}
        />
        {inputError ? (
          <div className="mt-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {inputError}
          </div>
        ) : null}
        <div className="mt-3 rounded-2xl border border-cyan-500/10 bg-[#0b1220] p-3 text-xs text-gray-300">
          <p className="mb-2 text-cyan-200">자동 분석 미리보기: {previewTone}</p>
          <div className="space-y-1">
            {METRIC_DEFS.map(({ key, label }) => (
              <div key={key}>
                {label}: {parsedData[key] ?? "-"}
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1 text-[11px]">
            {METRIC_DEFS.map(({ key, label }) => (
              <p key={`debug-${key}`}>
                {parsedData[key] !== null ? `✅ ${label}: ${parsedData[key]}` : `❌ ${label} not found`}
              </p>
            ))}
          </div>
          {missingFields.length > 0 ? (
            <div className="mt-2 space-y-1 text-amber-300">
              {missingFields.map((name) => (
                <p key={name}>⚠️ {name} 값을 찾지 못했습니다</p>
              ))}
            </div>
          ) : null}
        </div>
        <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
          <button
            type="button"
            onClick={submitInput}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              background: "#7c3aed",
              color: "white",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
              pointerEvents: "auto",
            }}
            className="cursor-pointer pointer-events-auto"
          >
            저장
          </button>
          {manualMode ? (
            <button
              type="button"
              onClick={() => {
                void releaseManualMode()
                setSaveToast("✅ 자동 데이터 모드로 전환")
              }}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "8px",
                background: "#0f172a",
                color: "#93c5fd",
                border: "1px solid #1d4ed8",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              자동 데이터 다시 사용
            </button>
          ) : null}
        </div>
      </div>
      ) : null}
      {saveToast ? (
        <div className="fixed bottom-6 left-1/2 z-[10000] -translate-x-1/2 rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-200 shadow-lg">
          {saveToast}
        </div>
      ) : null}
    </div>
  )
}

export default App
