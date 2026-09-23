import { useEffect, useMemo, useState } from "react"
import { fetchDailyBottomBuySnapshot } from "../utils/dailyBottomBuyApi.js"
import {
  formatDailyBottomDataBasis,
  pickDailyBottomAsOfDate,
} from "../utils/dailyBottomBuyDataBasis.js"
import {
  acknowledgeEpisodeTranche,
  syncDailyBottomEpisodes,
} from "../content/ydsDailyBottomBuyEpisodes.js"
import { listTradeRecords } from "../content/ydsTradeRecords.js"
import { buildDbbTradeStatusView } from "../content/ydsTradeRecordsStatus.js"
import TradeRecordEditor from "../components/trade-records/TradeRecordEditor.jsx"
import TradeRecordStatusBlock from "../components/trade-records/TradeRecordStatusBlock.jsx"

function fmtNum(v, digits = 1) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  return Number(v).toFixed(digits)
}

function MetricRow({ label, value, ok, suffix = "" }) {
  return (
    <div className="yds-dbb-metric">
      <span className="yds-dbb-metric__label">{label}</span>
      <span className={`yds-dbb-metric__value${ok ? " is-ok" : ""}`}>
        {value}
        {suffix}
        {ok ? " ✓" : ""}
      </span>
    </div>
  )
}

function EtfCard({ card, episodeNote, compact, recordsVersion, onRecordsChange }) {
  const [openTrade, setOpenTrade] = useState(false)
  const records = useMemo(() => {
    void recordsVersion
    if (!card?.symbol) return []
    return listTradeRecords("dbb", card.symbol)
  }, [card?.symbol, recordsVersion])

  const statusView = useMemo(() => {
    if (!card?.ok) return null
    return buildDbbTradeStatusView(card, records, card.asOfDate)
  }, [card, records])

  if (!card?.ok) {
    return (
      <article className="yds-dbb-card yds-dbb-card--error">
        <header className="yds-dbb-card__head">
          <div>
            <h3 className="yds-dbb-card__ticker">{card?.symbol || "—"}</h3>
            <p className="yds-dbb-card__theme">
              {card?.themeShort || card?.theme || ""}
              {card?.role ? ` · ${card.role}` : ""}
            </p>
          </div>
          <p className="yds-dbb-card__stage">데이터 없음</p>
        </header>
      </article>
    )
  }

  const stageId = card.stage?.id || "wait"

  return (
    <article className={`yds-dbb-card yds-dbb-card--${stageId}${compact ? " yds-dbb-card--compact" : ""}`}>
      <header className="yds-dbb-card__head">
        <div className="min-w-0">
          <h3 className="yds-dbb-card__ticker">
            {card.symbol}
            <span className="yds-dbb-card__theme-inline">
              {" "}
              · {card.themeShort || card.theme}
              {card.role ? ` · ${card.role}` : ""}
            </span>
          </h3>
        </div>
        <div className="yds-dbb-card__badge" aria-label={`${card.count} of 4`}>
          <span className="yds-dbb-card__count">{card.count} / 4</span>
          <span className="yds-dbb-card__stage">{card.stage?.label}</span>
        </div>
      </header>

      {!compact && (
        <div className="yds-dbb-card__metrics">
          <MetricRow label="RSI" value={fmtNum(card.rsi14)} ok={card.flags?.rsi} />
          <MetricRow label="Stoch" value={fmtNum(card.stochK)} ok={card.flags?.stoch} />
          <MetricRow label="BB %B" value={fmtNum(card.bbPctB, 2)} ok={card.flags?.bb} />
          <MetricRow label="MA20" value={fmtNum(card.ma20DevPct)} ok={card.flags?.ma20} suffix="%" />
        </div>
      )}

      {card.count >= 3 && (
        <p className="yds-dbb-card__hint">{card.stage?.splitHint}</p>
      )}
      {card.count === 2 ? (
        <p className="yds-dbb-card__watch-hint">아직 매수 단계 아님</p>
      ) : null}
      {episodeNote ? <p className="yds-dbb-card__episode">{episodeNote}</p> : null}

      {statusView?.hasRecords ? <TradeRecordStatusBlock view={statusView} /> : null}

      <div className="yds-dbb-trade">
        <button
          type="button"
          className="yds-dbb-trade__toggle"
          aria-expanded={openTrade}
          onClick={() => setOpenTrade((v) => !v)}
        >
          {openTrade ? "매수 기록 닫기" : "매수 기록"}
        </button>
        {openTrade ? (
          <TradeRecordEditor
            system="dbb"
            symbol={card.symbol}
            defaultWeightPct={50}
            onChange={onRecordsChange}
          />
        ) : null}
      </div>
    </article>
  )
}

function Section({ title, eyebrow, children, empty }) {
  return (
    <section className="yds-dbb-section">
      <header className="yds-dbb-section__head">
        {eyebrow ? <p className="yds-dbb-section__eyebrow">{eyebrow}</p> : null}
        <h2 className="yds-dbb-section__title">{title}</h2>
      </header>
      {empty ? <p className="yds-dbb-section__empty">{empty}</p> : children}
    </section>
  )
}

/**
 * 일상 저점매수 V1 — Panic과 분리된 보조 신호 화면
 */
export default function DailyBottomBuyPage() {
  const [payload, setPayload] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [episodes, setEpisodes] = useState({})
  const [recordsVersion, setRecordsVersion] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    fetchDailyBottomBuySnapshot({ signal: ctrl.signal })
      .then((data) => {
        setPayload(data)
        setEpisodes(syncDailyBottomEpisodes(data.all || []))
      })
      .catch((err) => {
        if (err?.name === "AbortError") return
        setError(err?.message || "불러오기 실패")
      })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [])

  const strong = useMemo(
    () => (payload?.opportunities || []).filter((c) => c.count >= 4),
    [payload],
  )
  const primary = useMemo(
    () => (payload?.opportunities || []).filter((c) => c.count === 3),
    [payload],
  )
  const watch = payload?.watch || []
  const waiting = payload?.waiting || []

  const dataBasis = useMemo(() => {
    const asOfDate = pickDailyBottomAsOfDate(payload?.all)
    return formatDailyBottomDataBasis({ asOfDate, source: payload?.source })
  }, [payload])

  function onAck(symbol, kind) {
    acknowledgeEpisodeTranche(symbol, kind)
    if (payload?.all) setEpisodes(syncDailyBottomEpisodes(payload.all))
  }

  function onRecordsChange() {
    setRecordsVersion((n) => n + 1)
  }

  const cardProps = {
    recordsVersion,
    onRecordsChange,
  }

  return (
    <div className="yds-dbb min-w-0 w-full">
      <header className="yds-dbb__hero">
        <p className="yds-dbb__kicker">DAILY BOTTOM BUY</p>
        <h1 className="yds-dbb__title">일상 조정 매수</h1>
        <p className="yds-dbb__lead">
          미국 주요 섹터 ETF의 일상적인 조정 구간을 4개 보조지표로 확인합니다.
        </p>
      </header>

      <aside className="yds-dbb__notice" aria-label="안내">
        <p>3개 충족 → 1차 매수 후보 · 4개 충족 → 추가 매수 후보</p>
        <p>신호 발생 후 추가 하락할 수 있습니다.</p>
        <p className="yds-dbb__notice-muted">
          분할매수 검토용 보조 신호입니다. 대형 시장 패닉은 Panic Index를 참고합니다.
        </p>
        <p className="yds-dbb__notice-muted">
          미국 거래일 종가가 갱신되면 같은 한국 날짜 안에서도 신호가 바뀔 수 있습니다.
        </p>
      </aside>

      {loading && <p className="yds-dbb__status">불러오는 중…</p>}
      {error && !payload && <p className="yds-dbb__status yds-dbb__status--err">{error}</p>}

      {payload && (
        <>
          <div className="yds-dbb__meta-block">
            <p className="yds-dbb__meta">{dataBasis.line}</p>
            {dataBasis.warn ? (
              <p className="yds-dbb__meta-warn" role="status">
                {dataBasis.warn}
              </p>
            ) : null}
            <p className="yds-dbb__meta yds-dbb__meta--thresholds">
              RSI≤36 · Stoch≤15.4 · BB%B≤0.01 · MA20≤-4.2%
            </p>
          </div>

          <Section
            eyebrow="현재 매수 기회"
            title="3개 이상 조건"
            empty={
              !strong.length && !primary.length
                ? "지금 3개 이상 충족 ETF가 없습니다."
                : null
            }
          >
            {strong.map((card) => (
              <div key={card.symbol} className="yds-dbb-opp">
                <p className="yds-dbb-opp__tag yds-dbb-opp__tag--strong">강한 저점</p>
                <EtfCard
                  card={card}
                  episodeNote={episodes[card.symbol]?.uiNote}
                  {...cardProps}
                />
                <button
                  type="button"
                  className="yds-dbb-ack"
                  onClick={() => onAck(card.symbol, "add")}
                >
                  추가 50% 검토 표시
                </button>
              </div>
            ))}
            {primary.map((card) => (
              <div key={card.symbol} className="yds-dbb-opp">
                <p className="yds-dbb-opp__tag yds-dbb-opp__tag--primary">1차 매수</p>
                <EtfCard
                  card={card}
                  episodeNote={episodes[card.symbol]?.uiNote}
                  {...cardProps}
                />
                <button
                  type="button"
                  className="yds-dbb-ack"
                  onClick={() => onAck(card.symbol, "primary")}
                >
                  1차 50% 검토 표시
                </button>
              </div>
            ))}
          </Section>

          <Section
            title="관심"
            eyebrow="2 / 4"
            empty={!watch.length ? "관심 단계 ETF가 없습니다." : null}
          >
            <div className="yds-dbb-grid">
              {watch.map((card) => (
                <EtfCard key={card.symbol} card={card} compact {...cardProps} />
              ))}
            </div>
          </Section>

          <Section title="대기" eyebrow="0~1 / 4">
            <div className="yds-dbb-grid yds-dbb-grid--wait">
              {waiting.map((card) => (
                <EtfCard key={card.symbol} card={card} compact {...cardProps} />
              ))}
            </div>
          </Section>

          <section className="yds-dbb-section">
            <header className="yds-dbb-section__head">
              <h2 className="yds-dbb-section__title">전체 9개 ETF</h2>
            </header>
            <div className="yds-dbb-all">
              {(payload.all || []).map((card) => (
                <div key={`all-${card.symbol}`} className="yds-dbb-all__row">
                  <span className="yds-dbb-all__sym">{card.symbol}</span>
                  <span className="yds-dbb-all__theme">
                    {card.themeShort || card.theme}
                    {card.role ? ` · ${card.role}` : ""}
                  </span>
                  <span className="yds-dbb-all__count">
                    {card.ok ? `${card.count}/4` : "—"}
                  </span>
                  <span className={`yds-dbb-all__stage is-${card.stage?.id || "wait"}`}>
                    {card.stage?.label || "대기"}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <footer className="yds-dbb__footer">
            <p>분할: 3개 → 1차 50%, 4개 → 추가 50%. 4개 없이 반등 시 잔여 50% 자동 미사용.</p>
            <p>자동매매 없음 · 일별 반복 매수 없음 · 동일 조정은 3→4 한 에피소드.</p>
            <p className="yds-dbb__notice-muted">Panic Index와 완전히 별개의 시스템입니다.</p>
          </footer>
        </>
      )}
    </div>
  )
}
