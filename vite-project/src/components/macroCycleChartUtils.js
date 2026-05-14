/** 기관 터미널 팔레트 — 현재값 강조용 (과한 레인보우 지양) */
export const MACRO_SERIES_COLORS = {
  vix: "#fb923c",
  vxn: "#2dd4bf",
  putCall: "#60a5fa",
  fearGreed: "#fb7185",
  move: "#fbbf24",
  bofa: "#a78bfa",
  skew: "#22d3ee",
  highYield: "#eab308",
  gsBullBear: "#c084fc",
}

function hexToRgb(hex) {
  if (!hex || typeof hex !== "string") return { r: 148, g: 163, b: 184 }
  let h = hex.trim().replace("#", "")
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("")
  }
  const n = parseInt(h, 16)
  if (!Number.isFinite(n) || h.length !== 6) return { r: 148, g: 163, b: 184 }
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** 메인 숫자용 소프트 네온 (overflow 클리핑 완화를 위해 강도 보수적) */
export function metricValueDisplayStyle(hex) {
  const { r, g, b } = hexToRgb(hex)
  return {
    color: hex,
    textShadow: `0 0 20px rgba(${r},${g},${b},0.42), 0 0 42px rgba(${r},${g},${b},0.15), 0 1px 0 rgba(0,0,0,0.82)`,
  }
}

export function resolveSeriesColor(series) {
  return MACRO_SERIES_COLORS[series.key] ?? series.color ?? "#94a3b8"
}

export function pctDelta(rows, key) {
  if (!Array.isArray(rows) || rows.length < 2) return null
  const a = Number(rows[rows.length - 1]?.[key])
  const b = Number(rows[rows.length - 2]?.[key])
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null
  return ((a - b) / Math.abs(b)) * 100
}

export function formatMetricValue(key, v) {
  if (!Number.isFinite(v)) return "—"
  if (key === "putCall") return v.toFixed(2)
  if (key === "fearGreed" || key === "gsBullBear") return String(Math.round(v))
  if (key === "highYield") return v.toFixed(2)
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

/**
 * @param {number} padX 좌우 패딩 (viewBox 좌표)
 */
export function buildLaneGeometry(chartRows, series, laneHeight, laneGap, padY, width, padX = 32) {
  const innerW = Math.max(1, width - 2 * padX)
  const toX = (i) => padX + (i / Math.max(1, chartRows.length - 1)) * innerW

  const laneCount = series.length
  const chartHeight = laneCount * laneHeight + (laneCount - 1) * laneGap
  const lanes = []

  for (let idx = 0; idx < series.length; idx += 1) {
    const s = series[idx]
    const laneTop = idx * (laneHeight + laneGap)
    const vals = chartRows.map((r) => Number(r?.[s.key]))
    const finite = vals.filter(Number.isFinite)
    if (finite.length < 2) {
      lanes.push({ key: s.key, lineD: "", areaD: "", lastPt: null, min: null, max: null })
      continue
    }
    const min = Math.min(...finite)
    const max = Math.max(...finite)
    const span = Math.max(1e-6, max - min)
    const laneUsable = laneHeight - padY * 2
    const baseY = laneTop + laneHeight - padY
    const toY = (v) => laneTop + (laneHeight - padY) - ((v - min) / span) * laneUsable

    const points = vals
      .map((v, i) => {
        if (!Number.isFinite(v)) return null
        const x = toX(i)
        return { x, y: toY(v), v }
      })
      .filter(Boolean)

    if (points.length < 2) {
      lanes.push({ key: s.key, lineD: "", areaD: "", lastPt: null, min, max })
      continue
    }

    let lineD = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`
    for (let i = 1; i < points.length; i += 1) {
      const prev = points[i - 1]
      const curr = points[i]
      const cp1x = prev.x + (curr.x - prev.x) * 0.35
      const cp2x = prev.x + (curr.x - prev.x) * 0.65
      lineD += ` C${cp1x.toFixed(2)},${prev.y.toFixed(2)} ${cp2x.toFixed(2)},${curr.y.toFixed(2)} ${curr.x.toFixed(2)},${curr.y.toFixed(2)}`
    }

    const last = points[points.length - 1]
    const first = points[0]
    const areaD = `${lineD} L${last.x.toFixed(2)},${baseY.toFixed(2)} L${first.x.toFixed(2)},${baseY.toFixed(2)} Z`

    lanes.push({
      key: s.key,
      lineD,
      areaD,
      lastPt: { x: last.x, y: last.y },
      min,
      max,
      laneTop,
      baseY,
    })
  }

  return { lanes, chartHeight, padX, innerW }
}

export function buildTierMacroComments(tier, panicData) {
  const vix = pickPanicNumber(panicData, "vix")
  const vxn = pickPanicNumber(panicData, "vxn")
  const pc = pickPanicNumber(panicData, "putCall")
  const fg = pickPanicNumber(panicData, "fearGreed")
  const move = pickPanicNumber(panicData, "move")
  const bofa = pickPanicNumber(panicData, "bofa")
  const skew = pickPanicNumber(panicData, "skew")
  const hy = pickPanicNumber(panicData, "highYield")
  const gs = pickPanicNumber(panicData, "gsBullBear")

  if (tier === "tactical") {
    const a = []
    if (Number.isFinite(vix)) {
      a.push(vix >= 26 ? "단기 변동성 레짐 확대 · 진입 타이밍은 분할·확인 우선" : "단기 변동성 완화 진행 · 추세 확인 후 비중 가감")
    }
    if (Number.isFinite(vxn)) {
      a.push(vxn >= 28 ? "기술주 변동성 프리미엄 상대적으로 높음" : "나스닥 변동성 온도는 중립 내 완화")
    }
    if (Number.isFinite(pc)) {
      a.push(pc >= 1 ? "옵션 시장 헤지 수요 존재 · 방어 쏠림 완화 여부 추적" : "풋/콜 비율은 과열 추격 리스크 완화 쪽")
    }
    return a.slice(0, 3).length ? a.slice(0, 3) : ["단기 레짐 데이터 보강 중 · 샘플 히스토리와 병행 확인"]
  }

  if (tier === "strategic") {
    const a = []
    if (Number.isFinite(fg)) {
      a.push(fg >= 70 ? "중기 심리 온도 상단 · 익절·리밸런싱 우선순위 점검" : fg <= 35 ? "중기 심리 위축 구간 · 분할·선별 접근 유효" : "중기 심리는 박스권 · 섹터 로테이션 관찰")
    }
    if (Number.isFinite(move)) {
      a.push(move >= 100 ? "채권 변동성(MOVE) 경계 · 금리 민감 자산 비중 조절" : "채권시장 스트레스 완화 쪽 · 금리 리스크 완충")
    }
    if (Number.isFinite(bofa)) {
      a.push(bofa >= 6 ? "기관 리스크 선호 회복 국면 · 밸류에이션 디스플린 유지" : "기관 포지션은 중립~방어 쪽 · 중기 리스크 안정 유지")
    }
    return a.slice(0, 3).length ? a.slice(0, 3) : ["중기 매크로 코멘트 생성을 위해 입력 데이터를 보강하세요."]
  }

  const a = []
  if (Number.isFinite(skew)) {
    a.push(skew >= 140 ? "꼬리 리스크 프리미엄 상존 · 이벤트·헤지 시나리오 점검" : "꼬리 리스크 지표는 완만 · 극단 시나리오 할인 유지")
  }
  if (Number.isFinite(hy)) {
    a.push(hy >= 5 ? "하이일드 스프레드 확대 · 신용 스트레스 모니터링 강화" : "크레딧 스프레드는 압축 국면 · 리스크 온 가정 유지")
  }
  if (Number.isFinite(gs)) {
    a.push(gs >= 70 ? "장기 심리 과열 쪽 · 포지션 크기 점검" : gs <= 35 ? "장기 심리 비관 쪽 · 역발상 분할 검토" : "장기 Bull/Bear 밸런스는 중립")
  }
  return a.slice(0, 3).length ? a.slice(0, 3) : ["장기 매크로 지표 보강 중 · 리스크 예산 유지"]
}

export function pickXAxisLabels(chartRows, count = 4, width = 720, padX = 32) {
  if (!chartRows.length) return []
  const innerW = Math.max(1, width - 2 * padX)
  const n = chartRows.length
  return Array.from({ length: count })
    .map((_, i) => {
      const idx = Math.round(((n - 1) * i) / Math.max(1, count - 1))
      const row = chartRows[idx]
      if (!row?.ts) return null
      const d = new Date(row.ts)
      if (Number.isNaN(d.getTime())) return null
      const label = `${d.getMonth() + 1}/${d.getDate()}`
      const x = padX + (idx / Math.max(1, n - 1)) * innerW
      return { idx, x, label, iso: String(row.ts).slice(0, 10) }
    })
    .filter(Boolean)
}

/** panicData 메타 (flat 또는 { value } ) */
export function pickPanicRaw(panicData, key) {
  if (!panicData || typeof panicData !== "object") return null
  const v = panicData[key]
  if (v != null && typeof v === "object" && "value" in v) return v
  return v
}

export function pickPanicNumber(panicData, key) {
  const raw = pickPanicRaw(panicData, key)
  if (raw == null || raw === "") return NaN
  if (typeof raw === "object" && "value" in raw) {
    const n = Number(raw.value)
    return Number.isFinite(n) ? n : NaN
  }
  const n = Number(raw)
  return Number.isFinite(n) ? n : NaN
}

/** panicData 우선, 없으면 히스토리 행에서 최신 유효값 (카드 '-' 방지) */
export function pickMetricDisplayValue(panicData, rows, key) {
  const live = pickPanicNumber(panicData, key)
  if (Number.isFinite(live)) return live
  if (!Array.isArray(rows) || rows.length === 0) return NaN
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i]
    if (!row || typeof row !== "object") continue
    let n = Number(row[key])
    if (!Number.isFinite(n) && key === "gsBullBear") {
      n = Number(row.gsBullBear ?? row.gs)
    }
    if (Number.isFinite(n)) return n
  }
  return NaN
}
