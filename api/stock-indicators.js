/**
 * GET /api/stock-indicators?code=005930&name=삼성전자
 *
 * 우선순위:
 * 1) KIS Open API (환경변수 KIS_APP_KEY + KIS_APP_SECRET 설정 시)
 * 2) Yahoo Finance (폴백)
 *
 * 환경변수:
 * - KIS_APP_KEY, KIS_APP_SECRET (필수, 서버에만)
 * - KIS_BASE_URL (선택, 예: https://openapi.koreainvestment.com:9443)
 * - KIS_USE_VIRTUAL=1 이면 모의투자 도메인(openapivts...:29443) 및 TR_ID VFHKST03010100
 * - KIS_TR_ID_DAILY (선택) 일봉 TR_ID 직접 지정 시 위 자동 선택 무시
 */

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
}

const TR_INQUIRE_DAILY_REAL = "FHKST03010100"
const TR_INQUIRE_DAILY_VIRTUAL = "VFHKST03010100"

function getKisDailyTrId() {
  const v = process.env.KIS_USE_VIRTUAL === "1" || process.env.KIS_USE_VIRTUAL === "true"
  return v ? TR_INQUIRE_DAILY_VIRTUAL : TR_INQUIRE_DAILY_REAL
}

/** 프로세스 단위 토큰 캐시 (서버리스 웜 스타트에서 재사용) */
let kisTokenCache = { accessToken: null, expiresAtMs: 0 }

function padCode(raw) {
  const s = String(raw || "").replace(/\D/g, "")
  if (!s) return null
  return s.padStart(6, "0")
}

function getKisBaseUrl() {
  const custom = process.env.KIS_BASE_URL?.trim()
  if (custom) return custom.replace(/\/$/, "")
  const v = process.env.KIS_USE_VIRTUAL === "1" || process.env.KIS_USE_VIRTUAL === "true"
  return v ? "https://openapivts.koreainvestment.com:29443" : "https://openapi.koreainvestment.com:9443"
}

function formatYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}${m}${day}`
}

function parseKisExpiryMs(raw) {
  if (raw == null) return null
  const s = String(raw).trim()
  if (/^\d{14}$/.test(s)) {
    return new Date(
      +s.slice(0, 4),
      +s.slice(4, 6) - 1,
      +s.slice(6, 8),
      +s.slice(8, 10),
      +s.slice(10, 12),
      +s.slice(12, 14),
    ).getTime()
  }
  const t = Date.parse(s)
  return Number.isFinite(t) ? t : null
}

async function getKisAccessToken(baseUrl, appKey, appSecret) {
  const now = Date.now()
  if (kisTokenCache.accessToken && now < kisTokenCache.expiresAtMs - 45_000) {
    return kisTokenCache.accessToken
  }
  const url = `${baseUrl}/oauth2/tokenP`
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json; charset=UTF-8" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: appKey,
      appsecret: appSecret,
    }),
  })
  const text = await res.text()
  let j = {}
  try {
    j = JSON.parse(text)
  } catch {
    throw new Error(`kis token parse ${res.status}`)
  }
  if (!res.ok) throw new Error(j.message || j.error_description || `kis token http ${res.status}`)
  const tok = j.access_token
  if (!tok) throw new Error("kis token missing access_token")
  let expMs = now + (Number(j.expires_in) || 23 * 3600) * 1000
  const parsed = parseKisExpiryMs(j.access_token_token_expired)
  if (parsed != null) expMs = Math.min(expMs, parsed - 60_000)
  kisTokenCache = { accessToken: tok, expiresAtMs: expMs }
  return tok
}

function kisDomesticHeaders(accessToken, appKey, appSecret) {
  return {
    "content-type": "application/json; charset=UTF-8",
    authorization: `Bearer ${accessToken}`,
    appkey: appKey,
    appsecret: appSecret,
    tr_id: process.env.KIS_TR_ID_DAILY?.trim() || getKisDailyTrId(),
    custtype: "P",
  }
}

function rowsFromKisOutput2(rawList) {
  const asc = [...(Array.isArray(rawList) ? rawList : [])].reverse()
  const rows = []
  for (const row of asc) {
    const close = parseFloat(String(row.stck_clpr ?? "").replace(/,/g, ""))
    const vol = parseFloat(String(row.acml_vol ?? "").replace(/,/g, ""))
    if (!Number.isFinite(close)) continue
    rows.push({
      close,
      volume: Number.isFinite(vol) ? vol : 0,
      date: row.stck_bsop_date ? String(row.stck_bsop_date) : null,
    })
  }
  return rows
}

/**
 * 국내주식 기간별시세(일) → output2 최신순 → 시간순 rows
 * KOSPI(J) 우선, 데이터 부족·API 오류 시 KOSDAQ(Q) 재시도.
 */
async function fetchKisDailyRows(baseUrl, accessToken, appKey, appSecret, code) {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 420)
  let lastErr = null
  for (const mrkt of ["J", "Q"]) {
    const params = new URLSearchParams({
      fid_cond_mrkt_div_code: mrkt,
      fid_input_iscd: code,
      fid_input_date_1: formatYmd(start),
      fid_input_date_2: formatYmd(end),
      fid_period_div_code: "D",
      fid_org_adj_prc: "0",
    })
    const url = `${baseUrl}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?${params.toString()}`
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: kisDomesticHeaders(accessToken, appKey, appSecret),
        cache: "no-store",
      })
      const text = await res.text()
      let data = {}
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error(`kis daily parse ${res.status}`)
      }
      if (!res.ok) throw new Error(data.msg1 || data.message || `kis daily http ${res.status}`)
      const rt = String(data.rt_cd ?? "")
      if (rt && rt !== "0") throw new Error(data.msg1 || data.msg_cd || `kis rt_cd ${data.rt_cd}`)
      const rows = rowsFromKisOutput2(data.output2)
      if (rows.length >= 70) return rows
      lastErr = new Error(`kis short history (${mrkt}, ${rows.length} bars)`)
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("kis daily failed")
}

function unixSecToYmdKst(sec) {
  if (sec == null || !Number.isFinite(sec)) return null
  const d = new Date(sec * 1000)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d)
  const y = parts.find((p) => p.type === "year")?.value
  const m = parts.find((p) => p.type === "month")?.value
  const day = parts.find((p) => p.type === "day")?.value
  if (!y || !m || !day) return null
  return `${y}${m}${day}`
}

function zipBars(result) {
  const quote = result?.indicators?.quote?.[0]
  const ts = result?.timestamp
  if (!quote || !Array.isArray(ts)) return []
  const { close, volume } = quote
  const rows = []
  for (let i = 0; i < ts.length; i++) {
    const c = close[i]
    if (!Number.isFinite(c)) continue
    const v = Number.isFinite(volume[i]) ? volume[i] : 0
    rows.push({ close: c, volume: v, date: unixSecToYmdKst(ts[i]) })
  }
  return rows
}

function rsiWilder14(closes) {
  if (closes.length < 15) return null
  const changes = []
  for (let i = 1; i < closes.length; i++) changes.push(closes[i] - closes[i - 1])
  let avgGain = 0
  let avgLoss = 0
  for (let i = 0; i < 14; i++) {
    const d = changes[i]
    if (d >= 0) avgGain += d
    else avgLoss -= d
  }
  avgGain /= 14
  avgLoss /= 14
  for (let i = 14; i < changes.length; i++) {
    const d = changes[i]
    const g = d > 0 ? d : 0
    const l = d < 0 ? -d : 0
    avgGain = (avgGain * 13 + g) / 14
    avgLoss = (avgLoss * 13 + l) / 14
  }
  if (avgLoss === 0) return 100
  return 100 - 100 / (1 + avgGain / avgLoss)
}

function emaSeries(values, period) {
  const out = new Array(values.length).fill(null)
  if (values.length < period) return out
  const k = 2 / (period + 1)
  let sum = 0
  for (let i = 0; i < period; i++) sum += values[i]
  let e = sum / period
  out[period - 1] = e
  for (let i = period; i < values.length; i++) {
    e = values[i] * k + e * (1 - k)
    out[i] = e
  }
  return out
}

function smaLast(values, period) {
  if (values.length < period) return null
  let s = 0
  for (let i = values.length - period; i < values.length; i++) s += values[i]
  return s / period
}

/** i번째 봉까지의 단순이동평균 (차트용 시계열) */
function smaAtIndex(values, i, period) {
  if (i < period - 1) return null
  let s = 0
  for (let j = i - period + 1; j <= i; j++) s += values[j]
  return s / period
}

/** 최근 약 3~6개월(거래일 기준) 미니 차트용 — 전체 rows 기준으로 이평 계산 후 슬라이스 */
function buildChartBars(rows, maxBars = 130) {
  const n = rows.length
  if (n < 2) return []
  const closes = rows.map((r) => r.close)
  const sliceStart = Math.max(0, n - maxBars)
  const bars = []
  for (let i = sliceStart; i < n; i++) {
    bars.push({
      date: rows[i].date,
      close: closes[i],
      volume: rows[i].volume,
      ma20: smaAtIndex(closes, i, 20),
      ma60: smaAtIndex(closes, i, 60),
    })
  }
  return bars
}

function volumeChangePct(volumes) {
  if (volumes.length < 22) return null
  const last = volumes[volumes.length - 1]
  let sum = 0
  for (let i = volumes.length - 21; i < volumes.length - 1; i++) sum += volumes[i]
  const avg = sum / 20
  if (!avg) return null
  return ((last - avg) / avg) * 100
}

function macdBundle(closes) {
  const ema12 = emaSeries(closes, 12)
  const ema26 = emaSeries(closes, 26)
  const n = closes.length
  const macdVals = []
  for (let i = 0; i < n; i++) {
    const a = ema12[i]
    const b = ema26[i]
    if (Number.isFinite(a) && Number.isFinite(b)) macdVals.push(a - b)
  }
  if (macdVals.length < 12) return { macdLine: null, signalLine: null, histogram: null, prevHistogram: null }
  const sigSeries = emaSeries(macdVals, 9)
  const histSeries = []
  for (let i = 0; i < macdVals.length; i++) {
    const s = sigSeries[i]
    histSeries.push(Number.isFinite(macdVals[i]) && Number.isFinite(s) ? macdVals[i] - s : null)
  }
  let hist = null
  let prevHist = null
  let m = null
  let sig = null
  for (let i = histSeries.length - 1; i >= 0; i--) {
    if (histSeries[i] == null || !Number.isFinite(macdVals[i]) || !Number.isFinite(sigSeries[i])) continue
    if (hist == null) {
      hist = histSeries[i]
      m = macdVals[i]
      sig = sigSeries[i]
      continue
    }
    if (prevHist == null) {
      prevHist = histSeries[i]
      break
    }
  }
  if (m == null || sig == null) return { macdLine: null, signalLine: null, histogram: null, prevHistogram: null }
  return { macdLine: m, signalLine: sig, histogram: hist, prevHistogram: prevHist }
}

function interpretRsi(rsi) {
  if (rsi == null) return "산출 불가"
  if (rsi < 30) return "과매도권 접근"
  if (rsi < 40) return "약세·반등 대기"
  if (rsi <= 55) return "중립"
  if (rsi <= 70) return "강세권"
  return "과열 구간 근접"
}

function interpretMacd({ histogram, prevHistogram, macdLine, signalLine }) {
  if (histogram == null) return "산출 불가"
  if (prevHistogram != null && prevHistogram <= 0 && histogram > 0) return "양전환 시도"
  if (prevHistogram != null && prevHistogram >= 0 && histogram < 0) return "음전환"
  if (macdLine != null && signalLine != null && macdLine > signalLine) return "시그널 상방"
  if (macdLine != null && signalLine != null && macdLine < signalLine) return "시그널 하방"
  return "방향성 대기"
}

function interpretMa(ma20, ma60) {
  if (ma20 == null || ma60 == null) return "산출 불가"
  if (ma20 > ma60) return "20MA > 60MA 유지"
  if (ma20 < ma60 * 0.995) return "20MA < 60MA"
  return "이평 혼합"
}

function buildNarrative({ rsi, volPct, ma20, ma60, macdText }) {
  const rsiN = rsi ?? null
  const volN = volPct ?? null
  let status = "데이터 부족"
  if (rsiN != null && volN != null) {
    if (rsiN < 38 && volN < -10) status = "과매도·거래 감소 (반등 확인)"
    else if (rsiN > 65 && volN > 25) status = "강세·거래 동반 (과열 주의)"
    else if (volN > 30) status = "거래량 동반 움직임"
    else if (rsiN < 42) status = "눌림·지지 확인 구간"
    else if (rsiN > 58) status = "상방 에너지 유지"
    else status = "박스 내 밸런스"
  }
  let position = "산출 불가"
  if (ma20 != null && ma60 != null) {
    if (ma20 > ma60) position = "중기 상승 추세 유지"
    else if (ma20 < ma60) position = "중기 역배열·조정 국면"
    else position = "중기 추세 전환 구간"
  }
  let flow = "산출 불가"
  if (macdText && macdText !== "산출 불가") {
    flow = volPct != null && volPct > 15 ? `${macdText} · 거래 동반` : macdText
  }
  return { status, position, flow }
}

function buildPayload({
  code,
  name,
  rows,
  dataSource,
  yahooSymbol,
  asOfIso,
  metaName,
}) {
  const closes = rows.map((r) => r.close)
  const volumes = rows.map((r) => r.volume)
  const rsi14 = rsiWilder14(closes)
  const volPct = volumeChangePct(volumes)
  const ma20 = smaLast(closes, 20)
  const ma60 = smaLast(closes, 60)
  const macd = macdBundle(closes)
  const macdText = interpretMacd(macd)
  const narrative = buildNarrative({ rsi: rsi14, volPct, ma20, ma60, macdText })
  const volStr = volPct == null ? "—" : `${volPct >= 0 ? "+" : ""}${volPct.toFixed(1)}%`
  const lastClose = closes[closes.length - 1]
  const displayName = name || metaName || ""
  const chartBars = buildChartBars(rows, 130)

  return {
    symbol: code,
    name: displayName,
    dataSource,
    yahooSymbol: dataSource === "yahoo" ? yahooSymbol : undefined,
    kisBaseUrl: dataSource === "kis" ? getKisBaseUrl() : undefined,
    updatedAt: new Date().toISOString(),
    asOf: asOfIso,
    price: lastClose,
    volumeChangePct: volPct,
    rsi14,
    macd: {
      line: macd.macdLine,
      signal: macd.signalLine,
      histogram: macd.histogram,
      trend:
        macd.macdLine != null && macd.signalLine != null && macd.macdLine > macd.signalLine ? "bullish" : "bearish",
      label: macdText,
    },
    movingAverage: {
      ma20,
      ma60,
      trend: ma20 != null && ma60 != null && ma20 > ma60 ? "bullish" : ma20 != null && ma60 != null && ma20 < ma60 ? "bearish" : "mixed",
      label: interpretMa(ma20, ma60),
    },
    panel: {
      volumeLine: `${volStr} (최근일 vs 20일 평균 거래량)`,
      rsiLine: rsi14 == null ? "—" : `${rsi14.toFixed(1)} · ${interpretRsi(rsi14)}`,
      macdLine: macdText,
      maLine: interpretMa(ma20, ma60),
    },
    narrative,
    barsUsed: closes.length,
    chart: {
      bars: chartBars,
      barCount: chartBars.length,
    },
  }
}

async function fetchYahooChart(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2y`
  const res = await fetch(url, { headers: YAHOO_HEADERS, cache: "no-store" })
  if (!res.ok) throw new Error(`Yahoo ${res.status}`)
  const raw = await res.json()
  const result = raw?.chart?.result?.[0]
  if (!result) throw new Error("empty chart")
  const rows = zipBars(result)
  if (rows.length < 70) throw new Error("short history")
  const meta = result.meta ?? {}
  const lastClose = rows[rows.length - 1].close
  const lastPrice = Number.isFinite(lastClose) ? lastClose : null
  return { rows, lastPrice, meta, ticker }
}

function readCode(req) {
  const q = req.query
  if (q?.code) return padCode(q.code)
  if (q?.symbol) return padCode(q.symbol)
  try {
    const raw = req.url || "/"
    const u = new URL(raw, "http://localhost")
    return padCode(u.searchParams.get("code") || u.searchParams.get("symbol"))
  } catch {
    return null
  }
}

function readName(req) {
  if (typeof req.query?.name === "string") return req.query.name
  try {
    const raw = req.url || "/"
    const u = new URL(raw, "http://localhost")
    return u.searchParams.get("name") || ""
  } catch {
    return ""
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "method not allowed" })
  }

  const code = readCode(req)
  if (!code) {
    return res.status(400).json({ error: "missing code" })
  }

  const name = readName(req)
  const appKey = process.env.KIS_APP_KEY?.trim()
  const appSecret = process.env.KIS_APP_SECRET?.trim()

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")

  if (appKey && appSecret) {
    try {
      const baseUrl = getKisBaseUrl()
      const token = await getKisAccessToken(baseUrl, appKey, appSecret)
      const rows = await fetchKisDailyRows(baseUrl, token, appKey, appSecret, code)
      if (rows.length < 70) throw new Error("kis short history")
      const lastDate = rows[rows.length - 1]?.date
      const asOfIso = lastDate && /^\d{8}$/.test(lastDate)
        ? `${lastDate.slice(0, 4)}-${lastDate.slice(4, 6)}-${lastDate.slice(6, 8)}T15:30:00+09:00`
        : new Date().toISOString()
      const payload = buildPayload({
        code,
        name,
        rows,
        dataSource: "kis",
        yahooSymbol: undefined,
        asOfIso,
        metaName: "",
      })
      return res.status(200).json(payload)
    } catch (e) {
      return res.status(502).json({
        error: "kis_fetch_failed",
        message: e?.message || "unknown",
        symbol: code,
        dataSource: "kis",
      })
    }
  }

  const candidates = [`${code}.KS`, `${code}.KQ`]
  let lastErr = null
  for (const ticker of candidates) {
    try {
      const { rows, meta, ticker: yahooSymbol } = await fetchYahooChart(ticker)
      const asOfIso = meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null
      const payload = buildPayload({
        code,
        name,
        rows,
        dataSource: "yahoo",
        yahooSymbol,
        asOfIso,
        metaName: meta.shortName || meta.longName || "",
      })
      return res.status(200).json(payload)
    } catch (e) {
      lastErr = e
    }
  }

  return res.status(502).json({
    error: "chart_fetch_failed",
    message: lastErr?.message || "unknown",
    symbol: code,
    hint: "KIS_APP_KEY / KIS_APP_SECRET 을 설정하면 한국투자증권 일봉으로 조회합니다.",
  })
}
