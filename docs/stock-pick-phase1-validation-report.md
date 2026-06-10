# 종목추천 데이터 검증 Phase 1 — 진단 보고서

> 작성 기준: 코드 정적 추적 (라이브 API 미호출). 실측값은 배포 환경에서 `/api/stock?batch=1&codes=...` 호출 후 대조 필요.

## 검증 종목

| 종목 | 티커 |
|------|------|
| 삼성전자 | 005930 |
| SK하이닉스 | 000660 |
| LS ELECTRIC | 010120 |
| 에스피지 | 058610 |
| 효성중공업 | 298040 |

---

## 1. 화면 표시 항목 출처

| 표시 항목 | 카드 본문 | 카드 상세(접기) |
|-----------|-----------|-----------------|
| 현재가 | `YdsStockPickCard` L39-40 | `buildStockPickTransparency` → metrics.close |
| 20일선 | — | transparency.metrics.ma20 |
| 60일선 | — | transparency.metrics.ma60 |
| 상태 | `stock.stockStatus.label` | 동일 |

---

## 2. API → 화면 데이터 파이프라인

```
GET /api/stock?batch=1&codes=...  (KR, KIS)
GET /api/stock-batch?codes=...    (US, Yahoo)
        ↓
apiBodyToEngineSnapshot()         ydsStockPickLiveSnapshot.js:58
  close ← stockSignal.price ?? apiBody.price ?? regularClose
  ma20  ← stockSignal.ma20 ?? movingAverage.ma20
  ma60  ← movingAverage.ma60
        ↓
deriveStatusFromSnapshot()        ydsStockPickStatusEngine.js:20
        ↓
enrichStock()                     ydsStockPickModel.js:148
        ↓
buildStockPickViews()             ydsStockPickModel.js:274
        ↓
YdsStockPickCard                  YdsStockPickCard.jsx:39-40, 97-103
```

### 카드 **현재가** 우선순위 (의심 구간 #1)

```javascript
// YdsStockPickCard.jsx:39
closeRaw = stock.quote?.price ?? stock.snapshot?.close ?? stock.snapshot?.price
```

- `stock.quote` ← `mergePickQuote(portfolioQuote, apiBody)` (`ydsStockPickQuoteService.js`)
- portfolio quote는 `/api/portfolio-quote` (Yahoo/KIS 별도 경로) — **KIS batch 시세와 불일치 가능**
- `stock.snapshot` ← `toStockMarketSnapshot(engineSnapshot)` — engine과 동일 close

### 카드 **20일/60일선** 출처 (의심 구간 #2)

```javascript
// ydsStockPickTransparency.js:36-44
resolveSnapshotNumbers(stock):
  close ← stock.quote?.price ?? snap.price ?? snap.close
  ma20  ← snap.ma20   // engineSnapshot에서 복사
  ma60  ← snap.ma60
```

- **가격은 quote 우선, 이평은 snapshot(엔진) 고정** → 가격·이평 기준이 어긋나면 상태·표시 모두 왜곡 가능

---

## 3. API 원본 필드 매핑 (KR / KIS)

| API 필드 | 엔진 필드 | 비고 |
|----------|-----------|------|
| `dataSource` | `"kis"` | provider 표시 |
| `price` / `regularClose` | `close` | KIS 현재가 |
| `stockSignal.price` | `close` (우선) | 신호 번들 가격 |
| `stockSignal.ma20` | `ma20` | |
| `movingAverage.ma60` | `ma60` | |
| `chart.bars[].volume` | `volumeToday`, `volumeAvg20` | 20일 평균 거래량 |
| `chart.bars` high | `high52w`, `recentHigh` | 252일/60일 피크 |

---

## 4. 상태 계산 규칙 (`deriveStatusFromSnapshot`)

| 조건 | 결과 |
|------|------|
| close/ma20/ma60 누락 | `interest` |
| 52주 고점 근접 + 과열 신호 | `overheat` |
| close < ma60 | `interest` |
| close > ma20 > ma60 | `trend` |
| close > ma60 && 고점대비 5~15% 조정 | `dip` |
| close > ma60 (기타) | `dip` |
| 그 외 | `interest` |

### LS ELECTRIC (010120) 차트 대조 예시

| 항목 | 엔진 입력 필요값 | 차트 판단 |
|------|------------------|-----------|
| DIP 조건 | close > ma60, drawdown 5~15% | 현재가 < 20일선 이어도 60일선 위+조정이면 DIP |
| 검증 | `statusDiag.inputs` 콘솔 (idle) | `explainStatusFromSnapshot` 근거 문자열 |

---

## 5. 한국 종목 가격 이상 조사 (정적)

| 종목 | 위험 요인 |
|------|-----------|
| 에스피지 (058610) | 소형주 · portfolio-quote Yahoo/KIS 경로 혼용 |
| LS ELECTRIC (010120) | quote 우선 표시 시 batch KIS 가격과 불일치 |
| 현대차 / 삼성물산 | 유니버스 포함 시 동일 quote 우선 로직 적용 |

**공통 패턴**: `/api/stock` KIS 종가·현재가 ≠ `/api/portfolio-quote` 반환값이면 카드 현재가만 틀어지고 MA는 KIS 기준 유지.

---

## A. 가격 정확도 (예상 — 실측 필요)

| 구분 | 예상 |
|------|------|
| KIS batch만 사용 시 | **정확 ~90%** (5종 중 4~5) |
| portfolio-quote 병합 후 | **오류 ~20~40%** (quote 우선 때문) |
| 오류 후보 | 058610, 010120, 저유동 KR |

---

## B. 상태 정확도 (예상)

| 상태 | 정확도 추정 | 비고 |
|------|-------------|------|
| trend | 중~상 | 정배열 명확 시 |
| dip | 중 | LS류 눌림 — close/ma 소스 불일치 시 하락 |
| interest | 높음 | 기본값·ma60 아래 |
| overheat | 중 | RSI/52주 위치 extras 의존 |

---

## C. 가장 의심되는 버그

1. **1순위**: `YdsStockPickCard` / `resolveSnapshotNumbers` — **quote.price가 apiBody(KIS) 가격보다 우선** (`ydsStockPickQuoteService` portfolio 경로)
2. **2순위**: **현재가 vs MA 데이터 소스 분리** — 가격은 quote, MA는 engineSnapshot
3. **3순위**: `apiBodyToEngineSnapshot` — ma20 누락 시 `ma20 ?? close` 폴백 (`ydsStockPickLiveSnapshot.js:81`)으로 이평 왜곡

---

## D. 수정이 필요한 파일 목록 (참고만 — Phase 1에서 미수정)

| 파일 | 이유 |
|------|------|
| `vite-project/src/components/stock-picks/YdsStockPickCard.jsx` | quote 우선 가격 |
| `vite-project/src/content/ydsStockPickTransparency.js` | resolveSnapshotNumbers quote 우선 |
| `vite-project/src/content/ydsStockPickQuoteService.js` | mergePickQuote / portfolio 병합 |
| `vite-project/src/content/ydsStockPickLiveFetcher.js` | portfolio quote 타이밍 |
| `vite-project/src/content/ydsStockPickLiveSnapshot.js` | MA 폴백 로직 |
| `api/stock-indicators.js` | KIS payload priceSummary |

---

## 부록: Stock API 3회 재실행 원인 (성능)

| # | 원인 | 위치 |
|---|------|------|
| 1 | `useStockPickLiveData` effect가 **컴포넌트 remount마다** 재실행 | `hooks/useStockPickLiveData.js` |
| 2 | `fetchStockPickLiveSnapshots` sessionKey에 **panicIndex** 포함 → hydrate 후 키 변경 시 재fetch | (이전 `ydsStockPickLiveFetcher.js`) |
| 3 | 2초 throttle만으로는 **10초+ 간격 remount** 차단 불가 | `lastMountFetchAt` |

**재호출 callsite 목록**

- `useStockPickLiveData.useEffect.mount` — 유일 자동 호출
- `fetchStockPickUniverseLive` — 수동
- `fetchStockPickByTickerLive` — 상세 단건 (`fetchStockIndicators` 1회)
