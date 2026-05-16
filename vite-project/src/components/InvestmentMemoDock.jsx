import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { parseInvestmentMemo, suggestHashTags, suggestStocksByPrefix } from "../utils/investmentMemoParser.js"
import { emitDebugEvent } from "../utils/debugLogger.js"

const STORAGE_KEY = "yds-investment-memos-v1"
const RECENT_KEY = "yds-investment-recent-inputs-v1"
/** 로딩/에러 전환 등 Dock 언마운트 시에도 입력·미리보기가 끊기지 않도록 */
const MEMO_DRAFT_SESSION_KEY = "yds-investment-memo-draft-v1"

function readJson(key, fallback) {
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

/** 입력창 비움 후에도 AI 카드가 직전 저장 메모 해석을 유지하도록, 최근 저장 원문 참조용 */
function readLatestMemoRawForPreview() {
  const list = readJson(STORAGE_KEY, [])
  const row = Array.isArray(list) ? list[0] : null
  const raw = String(row?.rawText ?? row?.raw ?? "").trim()
  return raw || null
}

/** 새로고침 후에도 직전 저장분의 파싱 스냅샷을 카드에 그대로 싣기 */
function readPinnedParseFromLatestMemo() {
  const list = readJson(STORAGE_KEY, [])
  const row = Array.isArray(list) ? list[0] : null
  const raw = String(row?.rawText ?? row?.raw ?? "").trim()
  const p = row?.parsed
  if (!p || !raw) return null
  if (String(p.rawText ?? "").trim() !== raw) return null
  return p
}

function readMemoDraftInitial() {
  if (typeof window === "undefined") return ""
  try {
    return String(window.sessionStorage.getItem(MEMO_DRAFT_SESSION_KEY) ?? "")
  } catch {
    return ""
  }
}

function persistMemoDraft(value) {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(MEMO_DRAFT_SESSION_KEY, value)
  } catch {
    // ignore
  }
}

function buildInsight(parsed, panicData) {
  const lines = []
  const sig = parsed.signal ?? []
  if (parsed.warningTags?.length) {
    lines.push(`입력 기반 주의: ${parsed.warningTags.join(", ")}`)
  }
  if (parsed.macroCategories?.length) {
    lines.push(`거시 맥락 반영: ${parsed.macroCategories.slice(0, 2).join(", ")}`)
  }
  if (sig.includes("VIX급등") || Number(panicData?.vix) >= 30) {
    lines.push("리스크 경고: 변동성 구간 진입 가능성")
  }
  if ((parsed.sectors ?? []).includes("원전")) {
    lines.push("섹터 순환 감지: 원전 키워드 증가")
  }
  if (sig.includes("거래량증가") && (sig.includes("눌림목") || sig.includes("20일선지지"))) {
    lines.push("기술적 후보: 눌림 + 거래량 조합")
  }
  if (!lines.length) lines.push("패턴: 메모를 이어 쓰면 규칙 기반 해석이 누적됩니다.")
  return lines.slice(0, 2)
}

export default function InvestmentMemoDock({ panicData }) {
  const inputRef = useRef(null)
  const [text, setText] = useState(() => readMemoDraftInitial())

  /** 항상 sessionStorage와 동기화되어, Dock 리마운트 후에도 입력·실시간 파싱 유지 */
  const patchText = useCallback((updater) => {
    setText((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater
      persistMemoDraft(next)
      return next
    })
  }, [])
  const [saveFeedback, setSaveFeedback] = useState("")
  const [lastSavedMeta, setLastSavedMeta] = useState(null)
  const [memos, setMemos] = useState(() => readJson(STORAGE_KEY, []))
  const [recentInputs, setRecentInputs] = useState(() => readJson(RECENT_KEY, []))
  const [stockFilter, setStockFilter] = useState("전체")
  const [sentimentFilter, setSentimentFilter] = useState("전체")
  const [signalFilter, setSignalFilter] = useState("전체")
  const [savedPreviewRaw, setSavedPreviewRaw] = useState(() =>
    typeof window !== "undefined" ? readLatestMemoRawForPreview() : null,
  )
  const [pinnedParsed, setPinnedParsed] = useState(() =>
    typeof window !== "undefined" ? readPinnedParseFromLatestMemo() : null,
  )

  const stockSuggestions = useMemo(() => suggestStocksByPrefix(text), [text])
  const hashTagSuggestions = useMemo(() => suggestHashTags(text), [text])
  const canSave = text.trim().length > 0
  const voiceAvailable =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  const evidenceBasisText = text.trim() || savedPreviewRaw || ""
  /** 입력 중 → 실시간 파싱 / 저장 직후·빈 입력 → 방금 저장한 스냅샷 우선 */
  const liveAnalysis = useMemo(() => {
    const t = text.trim()
    if (t.length) return parseInvestmentMemo(t, { panicData })
    if (pinnedParsed && String(pinnedParsed.rawText ?? "").trim()) return pinnedParsed
    const basis = evidenceBasisText
    return parseInvestmentMemo(basis, { panicData })
  }, [text, pinnedParsed, evidenceBasisText, panicData])
  const topMentionedSectors = useMemo(() => {
    const counts = {}
    for (const memo of memos) {
      for (const sector of memo?.sectorTags ?? memo?.parsed?.sectors ?? []) {
        counts[sector] = (counts[sector] ?? 0) + 1
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3)
  }, [memos])
  const repeatedSignals = useMemo(() => {
    const counts = {}
    for (const memo of memos) {
      for (const signal of memo?.parsedSignals ?? memo?.parsed?.signal ?? []) {
        counts[signal] = (counts[signal] ?? 0) + 1
      }
    }
    return Object.entries(counts).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3)
  }, [memos])
  const sentimentMix = useMemo(() => {
    const out = { bullish: 0, bearish: 0, neutral: 0 }
    for (const memo of memos) {
      const s = memo?.sentiment ?? memo?.parsed?.sentiment
      if (s in out) out[s] += 1
    }
    return out
  }, [memos])
  const filteredMemos = useMemo(() => {
    return memos.filter((memo) => {
      const stockOk = stockFilter === "전체" || memo?.parsedStocks?.[0] === stockFilter || memo?.parsed?.stock === stockFilter
      const sentimentOk = sentimentFilter === "전체" || (memo?.sentiment ?? memo?.parsed?.sentiment) === sentimentFilter
      const signalOk = signalFilter === "전체" || (memo?.parsedSignals ?? memo?.parsed?.signal ?? []).includes(signalFilter)
      return stockOk && sentimentOk && signalOk
    })
  }, [memos, stockFilter, sentimentFilter, signalFilter])
  const stockFilterOptions = useMemo(() => {
    const set = new Set(["전체"])
    for (const memo of memos) {
      if (memo?.parsedStocks?.[0]) set.add(memo.parsedStocks[0])
      else if (memo?.parsed?.stock) set.add(memo.parsed.stock)
    }
    return [...set]
  }, [memos])
  const signalFilterOptions = useMemo(() => {
    const set = new Set(["전체"])
    for (const memo of memos) {
      for (const signal of memo?.parsedSignals ?? memo?.parsed?.signal ?? []) set.add(signal)
    }
    return [...set]
  }, [memos])
  const sentimentBadgeClass =
    liveAnalysis.sentiment === "bullish"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
      : liveAnalysis.sentiment === "bearish"
        ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
        : "border-gray-600 bg-gray-700/40 text-gray-200"
  const marketTemperature = useMemo(() => {
    const vix = Number(panicData?.vix)
    const fearGreed = Number(panicData?.fearGreed)
    if (Number.isFinite(vix) && vix >= 32) return { label: "패닉", tone: "text-rose-300" }
    if (Number.isFinite(vix) && vix >= 24) return { label: "공포", tone: "text-amber-300" }
    if (Number.isFinite(fearGreed) && fearGreed >= 75) return { label: "과열", tone: "text-orange-300" }
    if (Number.isFinite(fearGreed) && fearGreed <= 30) return { label: "방어", tone: "text-sky-300" }
    return { label: "중립", tone: "text-emerald-300" }
  }, [panicData])
  const flowChips = useMemo(() => {
    const chips = []
    const sigShow = liveAnalysis.signalsNatural ?? liveAnalysis.parsedSignals ?? liveAnalysis.signal ?? []
    if (liveAnalysis.parsedStocks?.length) chips.push(...liveAnalysis.parsedStocks.slice(0, 1))
    if (sigShow.length) chips.push(...sigShow.slice(0, 2))
    if (liveAnalysis.sectorTags?.length) chips.push(...liveAnalysis.sectorTags.slice(0, 2))
    if (liveAnalysis.warningTags?.length) chips.push(...liveAnalysis.warningTags.slice(0, 2))
    if (liveAnalysis.macroCategories?.length) chips.push(liveAnalysis.macroCategories[0])
    return chips.slice(0, 5)
  }, [liveAnalysis])
  const compactFlowLines = useMemo(() => {
    const lines = []
    const natural = liveAnalysis.signalsNatural ?? []
    const rawSig = liveAnalysis.parsedSignals ?? liveAnalysis.signal ?? []
    const primarySig =
      natural.includes("눌림목") || rawSig.includes("눌림목")
        ? "눌림목"
        : liveAnalysis.primarySignalLabel && liveAnalysis.primarySignalLabel !== "—"
          ? liveAnalysis.primarySignalLabel
          : natural[0] ?? rawSig[0] ?? ""
    if (primarySig)
      lines.push(`시그널: ${primarySig}${rawSig.length > 1 ? ` 외 ${rawSig.length - 1}건` : ""}`)
    if (liveAnalysis.sectorTags?.length) lines.push(`${liveAnalysis.sectorTags.slice(0, 2).join(" · ")} 관심 증가`)
    if (liveAnalysis.warningTags?.length) lines.push(`경고 태그: ${liveAnalysis.warningTags.join(" · ")}`)
    if (liveAnalysis.macroCategories?.length) lines.push(`거시: ${liveAnalysis.macroCategories.slice(0, 2).join(" · ")}`)
    if (liveAnalysis.panicTags?.length) lines.push("리스크·패닉 키워드 감지")
    if (!lines.length) lines.push("메모 입력 시 규칙 기반 분석이 즉시 표시됩니다.")
    return lines.slice(0, 4)
  }, [liveAnalysis])
  const inputPlaceholder = useMemo(() => {
    if (marketTemperature.label === "패닉" || marketTemperature.label === "공포") {
      return "예: VIX 쎄함 · 방어 전환 고민"
    }
    if (marketTemperature.label === "과열") {
      return "예: 반도체 과열 느낌 · 추격 자제"
    }
    return "예: 원전 순환매 · 눌림목 관찰"
  }, [marketTemperature.label])
  const confidencePct = Math.round(liveAnalysis.confidence * 100)
  const confidenceLabel = confidencePct >= 80 ? "높음" : confidencePct >= 60 ? "중간" : "낮음"
  const ambiguityLine =
    confidencePct >= 80
      ? "해석 일관성 높음"
      : confidencePct >= 60
        ? "일부 애매한 표현 포함, 보조 관찰 필요"
        : "애매한 표현이 많아 추가 메모가 필요"
  const evidenceLines = useMemo(() => {
    const basis = evidenceBasisText
    const out = []
    const vixSpike = /VIX\s*급등|변동성\s*급등/i.test(basis)
    if (/눌림/.test(basis)) out.push(`시그널: "눌림" → 눌림목`)
    if (/거래량/.test(basis)) out.push(`시그널: "거래량" → 거래량증가`)
    if (/급등/.test(basis) && !vixSpike) out.push(`시그널: 급등 → momentum · 감성: bullish`)
    if (/돌파/.test(basis)) out.push(`감성·시그널: 돌파 (bullish + 돌파)`)
    if (/강함/.test(basis) && !/급등|돌파/.test(basis)) out.push(`감성: 강함 → bullish`)
    if (/(위험|과열|무겁다)/.test(basis)) out.push(`감성: 위험·과열·무겁다 → bearish (+경고 칩)`)
    if (liveAnalysis.warningTags?.length) out.push(`경고 규칙: ${liveAnalysis.warningTags.join(", ")} 태그`)
    if (liveAnalysis.macroCategories?.length) out.push(`거시 규칙: ${liveAnalysis.macroCategories.join(", ")}`)
    if (liveAnalysis.parsedStocks?.length) out.push(`종목 매칭: ${liveAnalysis.parsedStocks.join(", ")}`)
    if (!/눌림/.test(basis) && liveAnalysis.parsedSignals?.length) out.push(`시그널: ${liveAnalysis.parsedSignals.join(", ")}`)
    if (liveAnalysis.sectorTags?.length) out.push(`섹터: ${liveAnalysis.sectorTags.join(", ")}`)
    if (liveAnalysis.panicTags?.length) out.push(`리스크 키워드: ${liveAnalysis.panicTags.join(", ")}`)
    return out.slice(0, 5)
  }, [liveAnalysis, evidenceBasisText])

  const saveMemo = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    const startedAt = performance.now()
    setSaveFeedback("저장중...")
    emitDebugEvent("SAVE", { source: "memo-dock", stage: "INPUT", len: trimmed.length })
    emitDebugEvent("SAVE", { source: "memo-dock", stage: "VALIDATE", valid: trimmed.length > 0 })
    const memoId = Date.now()
    const createdAt = new Date().toISOString()
    const parsed = parseInvestmentMemo(trimmed, { panicData, id: memoId, createdAt })
    emitDebugEvent("SAVE", { source: "memo-dock", stage: "PARSE", stock: parsed.stock, sentiment: parsed.sentiment })
    const insights = buildInsight(parsed, panicData)
    try {
      const nextMemo = {
        id: memoId,
        createdAt,
        rawText: trimmed,
        parsedStocks: parsed.parsedStocks,
        parsedSignals: parsed.parsedSignals,
        sentiment: parsed.sentiment,
        confidence: parsed.confidence,
        sectorTags: parsed.sectorTags,
        panicTags: parsed.panicTags,
        warningTags: parsed.warningTags,
        macroCategories: parsed.macroCategories,
        marketPhase: parsed.marketPhase,
        aiSummary: parsed.aiSummary,
        riskLevel: parsed.riskLevel,
        intensity: parsed.intensity,
        strength: parsed.strength,
        parsed,
        insights,
      }
      const next = [nextMemo, ...memos].slice(0, 120)
      const nextRecent = [trimmed, ...recentInputs.filter((r) => r !== trimmed)].slice(0, 12)
      emitDebugEvent("SAVE", { source: "memo-dock", stage: "LOCAL_SAVE", target: "localStorage" })
      setMemos(next)
      setRecentInputs(nextRecent)
      writeJson(STORAGE_KEY, next)
      writeJson(RECENT_KEY, nextRecent)
      emitDebugEvent("SAVE", { source: "memo-dock", stage: "UI_UPDATE", memoId: next[0]?.id ?? null })
      flushSync(() => {
        setPinnedParsed(parsed)
        persistMemoDraft("")
        setSavedPreviewRaw(trimmed)
        setText("")
      })
      emitDebugEvent("SAVE", { source: "memo-dock", stage: "CACHE_UPDATE", key: STORAGE_KEY })
      emitDebugEvent("SAVE_SUCCESS", {
        source: "localStorage",
        elapsedMs: Math.round(performance.now() - startedAt),
        memoCount: next.length,
      })
      const elapsedMs = Math.round(performance.now() - startedAt)
      setSaveFeedback("저장됨")
      setLastSavedMeta({ at: createdAt, elapsedMs })
      if (typeof window !== "undefined") {
        window.setTimeout(() => setSaveFeedback(""), 500)
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("yds:memo-saved", { detail: { memoId: next[0]?.id ?? null } }))
      }
    } catch (err) {
      emitDebugEvent("SAVE_FAIL", { source: "memo-dock", error: err instanceof Error ? err.stack : String(err) }, "error")
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    const onFocusRequest = () => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      try {
        const len = String(el.value ?? "").length
        el.setSelectionRange(len, len)
      } catch {
        // ignore
      }
      window.setTimeout(() => {
        el.focus()
      }, 50)
      el.scrollIntoView({ block: "center", behavior: "smooth" })
    }
    window.addEventListener("yds:memo-focus", onFocusRequest)
    return () => window.removeEventListener("yds:memo-focus", onFocusRequest)
  }, [])

  return (
    <>
      <section
        className={`rounded-2xl border border-cyan-500/30 bg-[#060b14]/95 p-4 shadow-xl transition ${
          saveFeedback ? "shadow-cyan-500/20 ring-1 ring-cyan-400/40" : ""
        }`}
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="m-0 text-base font-semibold text-cyan-100">시장 생각 기록</p>
          <span className="text-[11px] text-cyan-300/80">{saveFeedback || "빠르게 기록 → 바로 분석"}</span>
        </div>
        <p className="m-0 text-xs text-cyan-200/80">한 줄 기록이 패닉 사이클 분석으로 연결됩니다.</p>
        {lastSavedMeta ? (
          <p className="m-0 mt-2 text-[11px] text-emerald-300/90">
            최근 저장 {new Date(lastSavedMeta.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ·{" "}
            {lastSavedMeta.elapsedMs}ms
          </p>
        ) : null}
        <div className="mt-3 flex items-end gap-2">
          <input
            ref={inputRef}
            id="investment-memo-input"
            type="text"
            inputMode="text"
            autoCapitalize="sentences"
            autoComplete="off"
            autoCorrect="on"
            spellCheck={false}
            value={text}
            onChange={(e) => patchText(e.currentTarget.value)}
            onInput={(e) => patchText(e.currentTarget.value)}
            onCompositionEnd={(e) => patchText(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                saveMemo()
              }
            }}
            placeholder={inputPlaceholder}
            className="h-14 w-full rounded-xl border border-gray-700 bg-[#0b1220] px-3 text-sm text-gray-100 outline-none ring-cyan-400/40 placeholder:text-gray-500 focus:ring"
          />
          <button
            type="button"
            onClick={saveMemo}
            disabled={!canSave}
            className="h-14 shrink-0 rounded-xl bg-cyan-500 px-4 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            저장
          </button>
        </div>
        <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
          <p className="m-0 text-[11px] text-cyan-200/90">메모 → AI 구조화 → 시그널 반영</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
            {flowChips.length ? (
              flowChips.map((chip) => (
                <span key={chip} className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-cyan-200">
                  {chip}
                </span>
              ))
            ) : (
              <span className="text-gray-500">키워드를 입력하면 자동 구조화됩니다.</span>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
          {stockSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => patchText((prev) => (prev ? `${prev} ${s}` : s))}
              className="rounded-full border border-gray-700 px-2 py-0.5 text-gray-300"
            >
              {s}
            </button>
          ))}
          {hashTagSuggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => patchText((prev) => `${prev} ${tag}`.trim())}
              className="rounded-full border border-indigo-500/40 px-2 py-0.5 text-indigo-300"
            >
              {tag}
            </button>
          ))}
          {!voiceAvailable ? null : <span className="text-gray-500">음성 입력 지원 브라우저</span>}
        </div>
        {!!recentInputs.length && !text.trim() ? (
          <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
            {recentInputs.slice(0, 5).map((r) => (
              <button
                key={r}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => patchText(r)}
                className="rounded-lg border border-gray-700 px-2 py-0.5 text-gray-400"
              >
                {r}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-violet-500/20 bg-violet-500/5 px-4 py-4">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="m-0 text-sm font-semibold text-violet-200">AI 분석 결과</p>
            <p className="m-0 mt-0.5 text-[10px] text-violet-300/70">규칙 기반 · 입력과 즉시 동기화 (debounce 없음)</p>
          </div>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] ${
              liveAnalysis.sentiment === "bullish"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : liveAnalysis.sentiment === "bearish"
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                  : "border-gray-500/40 bg-gray-500/10 text-gray-200"
            }`}
          >
            {liveAnalysis.sentiment === "bullish" ? "긍정" : liveAnalysis.sentiment === "bearish" ? "위험" : "중립"}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-800/80 bg-[#0b1220] px-3 py-2">
            <p className="m-0 text-[11px] text-gray-400">종목</p>
            <p className="m-0 mt-1 text-sm font-semibold text-gray-100">{liveAnalysis.stock ?? "미탐지"}</p>
            {liveAnalysis.stockConfidenceNote ? (
              <p className="m-0 mt-1 text-[10px] text-gray-500">{liveAnalysis.stockConfidenceNote}</p>
            ) : null}
          </div>
          <div className={`rounded-xl border px-3 py-2 ${sentimentBadgeClass}`}>
            <p className="m-0 text-[11px] opacity-80">감성 (규칙)</p>
            <p className="m-0 mt-1 text-sm font-semibold">{liveAnalysis.sentiment}</p>
          </div>
          <div className="rounded-xl border border-gray-800/80 bg-[#0b1220] px-3 py-2">
            <p className="m-0 text-[11px] text-gray-400">시그널 (규칙)</p>
            <p className="m-0 mt-1 text-sm text-cyan-200">
              {(liveAnalysis.signalsNatural ?? liveAnalysis.signal).join(", ") || "—"}
            </p>
          </div>
          <div className="rounded-xl border border-gray-800/80 bg-[#0b1220] px-3 py-2">
            <p className="m-0 text-[11px] text-gray-400">강도 (strength)</p>
            <p className="m-0 mt-1 text-sm font-semibold lowercase text-fuchsia-200">{liveAnalysis.strength ?? "low"}</p>
            <p className="m-0 mt-1 text-[11px] text-cyan-200/90">
              점수 {liveAnalysis.signalScore} · 신뢰도 {confidencePct}% ({confidenceLabel})
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-gray-700">
              <div
                className="h-1.5 rounded-full bg-cyan-400"
                style={{ width: `${confidencePct}%` }}
              />
            </div>
            <p className="m-0 mt-1 text-[11px] text-gray-400">애매함: {ambiguityLine}</p>
          </div>
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 sm:col-span-1">
            <p className="m-0 text-[11px] text-amber-200/90">경고 태그</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {liveAnalysis.warningTags?.length ? (
                liveAnalysis.warningTags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-100"
                  >
                    {t}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-gray-500">입력에 맞춰 표시 (과열·위험 등)</span>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 px-3 py-2 sm:col-span-1">
            <p className="m-0 text-[11px] text-sky-200/90">거시 카테고리</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {liveAnalysis.macroCategories?.length ? (
                liveAnalysis.macroCategories.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-sky-400/40 bg-sky-500/15 px-2 py-0.5 text-[11px] text-sky-100"
                  >
                    {t}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-gray-500">VIX·금리 등 키워드 시 표시</span>
              )}
            </div>
          </div>
        </div>
        <div className="mt-2 rounded-xl border border-violet-500/20 bg-[#0b1220] px-3 py-2">
          <p className="m-0 text-[11px] text-violet-200/90">핵심 흐름 해석</p>
          <div className="mt-1 space-y-1 text-[11px] text-gray-300">
            {compactFlowLines.map((line) => (
              <p key={line} className="m-0">
                - {line}
              </p>
            ))}
          </div>
        </div>
        <div className="mt-2 rounded-xl border border-violet-500/20 bg-[#0b1220] px-3 py-2">
          <p className="m-0 text-[11px] text-violet-200/90">분석 근거</p>
          <div className="mt-1 space-y-1 text-[11px] text-gray-300">
            {(evidenceLines.length ? evidenceLines : ["입력 대기: 키워드에 맞춰 규칙 근거가 여기에 쌓입니다."]).map((line) => (
              <p key={line} className="m-0">
                - {line}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4">
        <p className="m-0 text-sm font-semibold text-emerald-200">AI 인사이트</p>
        <div className="mt-2 space-y-1 text-xs text-emerald-100/90">
          <p>
            시장 온도: <span className={marketTemperature.tone}>{marketTemperature.label}</span>
          </p>
          <p>최근 상위 섹터: {topMentionedSectors.map(([s, n]) => `${s}(${n})`).join(", ") || "실제 데이터 없음"}</p>
          <p>반복 시그널: {repeatedSignals.map(([s, n]) => `${s}(${n})`).join(", ") || "반복 패턴 없음"}</p>
          <p>감정 분포: bullish {sentimentMix.bullish} / neutral {sentimentMix.neutral} / bearish {sentimentMix.bearish}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-4">
        <p className="m-0 mb-2 text-sm font-semibold text-indigo-200">메모 히스토리</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            className="rounded-lg border border-gray-700 bg-[#0b1220] px-2 py-1 text-xs text-gray-200"
          >
            {stockFilterOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <select
            value={sentimentFilter}
            onChange={(e) => setSentimentFilter(e.target.value)}
            className="rounded-lg border border-gray-700 bg-[#0b1220] px-2 py-1 text-xs text-gray-200"
          >
            <option value="전체">전체 감정</option>
            <option value="bullish">bullish</option>
            <option value="neutral">neutral</option>
            <option value="bearish">bearish</option>
          </select>
          <select
            value={signalFilter}
            onChange={(e) => setSignalFilter(e.target.value)}
            className="rounded-lg border border-gray-700 bg-[#0b1220] px-2 py-1 text-xs text-gray-200"
          >
            {signalFilterOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
        <div className="mt-3 space-y-2">
          {filteredMemos.slice(0, 20).map((memo) => (
            <article key={memo.id} className="rounded-xl border border-gray-800/80 bg-[#0b1220] px-3 py-2">
              <p className="m-0 text-[11px] text-gray-500">
                {new Date(memo.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="m-0 mt-1 text-sm text-gray-100">{memo.rawText ?? memo.raw}</p>
              <p className="m-0 mt-1 text-[11px] text-cyan-400/80">↓ AI 구조화</p>
              <p className="m-0 mt-1 text-[11px] text-gray-400">
                {memo.parsedStocks?.[0] ? `${memo.parsedStocks[0]} · ` : memo.parsed?.stock ? `${memo.parsed.stock} · ` : ""}
                {(memo.sentiment ?? memo.parsed?.sentiment) || "neutral"} ·{" "}
                {(memo.parsedSignals ?? memo.parsed?.signal ?? []).join(", ") || "시그널 없음"}
              </p>
              {(memo.warningTags ?? memo.parsed?.warningTags)?.length || (memo.macroCategories ?? memo.parsed?.macroCategories)?.length ? (
                <p className="m-0 mt-1 flex flex-wrap gap-1 text-[10px]">
                  {(memo.warningTags ?? memo.parsed?.warningTags ?? []).map((t) => (
                    <span key={`w-${t}`} className="rounded border border-amber-500/35 px-1 text-amber-200/90">
                      {t}
                    </span>
                  ))}
                  {(memo.macroCategories ?? memo.parsed?.macroCategories ?? []).map((t) => (
                    <span key={`m-${t}`} className="rounded border border-sky-500/35 px-1 text-sky-200/90">
                      {t}
                    </span>
                  ))}
                </p>
              ) : null}
              <p className="m-0 mt-1 text-[11px] text-cyan-300">
                {memo.marketPhase ?? memo.parsed?.marketPhase ?? "중립"} · {memo.aiSummary ?? memo.parsed?.aiSummary ?? "-"}
              </p>
            </article>
          ))}
          {!filteredMemos.length ? <p className="m-0 text-xs text-gray-500">조건에 맞는 메모가 없습니다.</p> : null}
        </div>
      </section>

    </>
  )
}

