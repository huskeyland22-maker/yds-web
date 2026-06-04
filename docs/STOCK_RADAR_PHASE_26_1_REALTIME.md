# Stock Radar Phase 26.1 — 실시간 데이터 연동 계획

> **V1 범위 외.** 신규 점수 엔진 없이 기존 4항목에 **실데이터 피드**만 교체·보강.

## 목표

| 현재 (V1) | 26.1 |
|-----------|------|
| 거래량 = PRI-B·stage 추정 | 실거래량·거래대금 z-score |
| 추세 = Trading Zone 정적 stage | MA(20/50/200) + 추세 slope |
| RSI/MACD 미사용 | 14일 RSI, MACD histogram 보조 |
| 신뢰도 「전략 기반」만 | 시세 연동 시 「실시간 데이터 기반」 배지 |

## API 후보 비교

| 제공자 | 장점 | 단점 | YDS 적합 |
|--------|------|------|----------|
| **Yahoo** | 미국·ETF 무료 tier, 기존 `yahooChartPick` 인프라 | 한국 종목·지연, Rate limit | **US 유니버스 1순위** |
| **Finnhub** | REST 단순, 기술지표 API | 유료 quota, KR 커버리지 제한 | US 보조·백업 |
| **KIS (한국투자)** | KR 종목·실시간, 이미 `kisClient` | 토큰·계좌·운영 복잡 | **KR 유니버스 1순위** |

### 권장 조합

1. **US:** Yahoo (기존 Vercel API) — 일봉·거래량·RSI 클라이언트 계산  
2. **KR:** KIS — `257720` 등 `STOCK_RADAR_UNIVERSE` code 기준  
3. **Finnhub:** Yahoo/KIS 장애 시 fallback (선택)

## 구현 단계 (엔진 수정 없음)

### Step 1 — 시세 스냅샷 레이어

- `stockRadarMarketSnapshot.js` (신규 **어댑터**, 엔진 아님)
- 입력: symbol, market
- 출력: `{ close, volume, ma20, ma50, rsi14, macdHist }`
- 캐시: 15분 TTL (PWA·API 부하 방지)

### Step 2 — 하위 점수 치환

`ydsPrecursorEnginePhase26.js` 내부 **숫자만** 교체:

- `technicalTrend`: stage 점수 50% + MA/RSI 합성 50%
- `volume`: 실거래량 백분위 (20일)
- `marketFit` / `sectorStrength`: 유지 (거시·섹터)

### Step 3 — 설명 레이어

- `ydsStockRadarExplain.js`에 실데이터 근거 문장 추가
- `confidence.id = 'live_market'` when snapshot.ready

### Step 4 — 검증

- Research Stock Radar vs 수동 차트 5종목
- Hub·Watchlist 회귀

## 비용·리스크

- API quota 모니터링 (빌드 ID·서버 로그)
- 지연 시 「전략 기반」 fallback (V1 동작 유지)
- **YDS/PRI/패닉 엔진 파일 touch 금지** (워크스페이스 규칙)

## 일정 제안

| 주차 | 산출 |
|------|------|
| W1 | Yahoo US POC + 스냅샷 타입 |
| W2 | KIS KR POC |
| W3 | Phase 26 하위점수 치환 + Explain V2.1 |
| W4 | RC 테스트 · 문서 갱신 |
