# 시장 기회 분석 × 신용위험 분석 — 설계 문서

> 상태: **설계만** (코드·DB·API·Production 미변경)  
> 조사일: 2026-11-06 · 브랜치 기준 `integration/yds-windows-mac`  
> 제약: 기존 Panic Index 계산식·매수/매도 엔진·DB 스키마·API **변경 금지**. 신규 투자 신호 적용 금지.

---

## 1. 기존 시스템 조사 결과

### 1.1 Panic Index (공식 UI = V2)

| 항목 | 현재 상태 |
|------|-----------|
| 공식 점수 | `getPanicScoreV2` = **0.45·VIX + 0.35·CNN + 0.20·Cboe Total P/C** |
| 핵심 필수 | `vix`, `fearGreed`, `putCall` (+ 저장 시 `tradeDate`) |
| 보조·선택 | `bofa`, `highYield`/`hy_oas`, `vxn`, `move`, `skew` |
| BofA / HY | **V2 가중치 0** — 저장·Legacy·유동성·사이클에만 사용 |
| UI 5단계 | 0–19 평온 · 20–39 경계 · 40–59 공포 · 60–79 강한 공포 · 80–100 극심한 패닉 |
| 매수 언어 밴드 | Macro V1 (`panicMacroV1Status`) — UI 공포 라벨과 **별개** (의도적 이중 체계) |

핵심 파일:

- `vite-project/src/utils/tradingScores.js` — `getPanicScoreV2`, Legacy short/mid
- `api/_lib/panicScores.js` — 서버 동일식
- `vite-project/src/utils/panicSaveValidate.js` / `api/_lib/panicSaveValidate.js`
- `vite-project/src/components/market-analysis/YdsPanicIndexCenter.jsx`

**사용자 질문의 “5개 지표”와의 관계**

| 지표 | 수집/저장 | Official V2 점수 |
|------|-----------|------------------|
| VIX | 예 | 예 (0.45) |
| CNN Fear & Greed | 예 | 예 (0.35) |
| Put/Call | 예 | 예 (0.20) |
| BofA Bull & Bear | 예 (수동/환경/DB 보존) | **아니오** |
| HY Spread (HY OAS) | 예 (FRED) | **아니오** |

→ 설계상 Opportunity 축은 **기존 5지표+가격을 해석 입력으로 재사용**하되, **공식 Panic Index 공식을 바꾸지 않는다.** Opportunity 점수는 **별도 레이어**로 둔다.

### 1.2 Legacy short / mid (비공식)

- Short: VIX 0.60 + Put/Call 0.40  
- Mid: CNN 0.40 + BofA 0.35 + HY 0.25  
- 동적 가중: VIX>25 → short 비중↑ / HY>6 → mid 비중↑ (“신용 국면”)  
- `getFinalScore` = Official 가능 시 Official, 아니면 Legacy  

### 1.3 시장 컨디션 / 사이클

| 모듈 | 역할 | 사용자 `/market-analysis` 노출 |
|------|------|--------------------------------|
| `ydsMarketPositionEngine` + `ydsMarketTrendSeries` | CNN/VIX/BofA 기반 시장 위치·120일 추세 | History/차트 일부 (PRO) |
| `api/_lib/marketCycleCompute.js` `computeMarketState` | VIX·CNN·HY 델타로 `fear_dominant` / `defensive` 등 | **현재 UI 비노출** |
| `liquidityDualEngine` / `liquidityEnvironment` | VIX·HY·MOVE·금리·DXY 등 유동성 | **현재 UI 비노출** (desk 내부) |

HY 상승 ≥ 0.2 → `defensive` (“신용 스프레드 확대”) — **신용위험 전용 점수 체계는 아님.**

### 1.4 매수·매도 · 분할 매수 (기존 — 변경 금지)

| 기능 | 요약 | 파일 |
|------|------|------|
| Panic 분할매수(DCA) | 점수 구간별 40% / +27% / +33% | `panicBottomDcaSignal.js` |
| Daily Bottom Buy | RSI·Stoch·BB·MA20 4조건, Panic **비연동** | `dailyBottomBuyEngine.js` |
| SignalDashboard | short/mid/final + action | `SignalDashboard.jsx` |
| Trading zone | VIX/HY/CNN 임계 리스크·스케일인 | `tradingZoneStrategyEngine.js` |
| `getAction` | ≥80 강한 매수 … ≤35 위험 회피 | `tradingScores.js` |

신규 Opportunity/Credit **점수나 해석은 위 신호에 직접 연결하지 않는다** (이번 설계 범위).

### 1.5 HY Spread vs BBB Spread

#### HY OAS — **이미 수집**

| 항목 | 값 |
|------|-----|
| FRED series | **`BAMLH0A0HYM2`** (ICE BofA US High Yield Index OAS) |
| 수집 | `api/_lib/panicCollectors.js` → `fetchFredHighYieldOas` |
| 갱신 | Cron `/api/cron/panic-collect` **매일 UTC 00:00**; serve stale **6h** |
| 클라이언트 필드 | `highYield` (alias `hyOas`, `hy_oas`, `high_yield`) |
| DB | `panic_index_history.hy_oas`, `latest_panic_metrics` |
| 의미 | **투기등급(HY) 신용위험·리스크온/오프** — 주식 공포와 동행·후행이 흔함 |

#### BBB Spread — **미수집 (갭)**

- 코드/DB에 `bbb_spread`, `BAMLC*`, ICE BofA BBB OAS **없음**  
- 백테스트 mock 티커 “BBB”만 존재  
- **IG(투자등급) 신용 스트레스와 HY를 구분할 데이터가 없음**

**후보 시리즈 (미확정 · 검증 필요, 이번 작업에서 API/DB 추가 금지)**

| 후보 | 설명 | 비고 |
|------|------|------|
| FRED `BAMLC0A4CBBB` | ICE BofA BBB US Corporate OAS | 업계 관행상 IG 벤치마크 후보 |
| 기타 BAMLC* | 만기·등급 변형 | 선정 전 가용성·라이선스·갱신 주기 확인 |

### 1.6 시장 분석 화면·차트

- 페이지: `CurrentMarketAnalysisPage.jsx` → `MarketAnalysisDeskCore.jsx`  
- 중심: Panic Index + FEAR SCALE + PRO Drivers(VIX/CNN/P-C) + History(`YdsPanicSpxValidationChart`) + 패닉 매수 기록  
- Market State / Dual Liquidity는 계산되나 **일반 UI에 숨김**

### 1.7 기회 vs 신용 — 현재 분리 수준

느슨한 분리만 존재:

- 카피: 사이클 = 시장 위치, 패닉 = 매수 기회 (`ydsLanguage.js`)  
- Legacy mid + HY>6 → “신용” 틸트  
- Liquidity/Market_state에 HY 스트레스  

**전용 Opportunity 점수 · Credit Risk 점수 · 4분면 해석 · BBB 축은 없음.**

---

## 2. 신규 분석 체계

두 축을 **병렬 레이어**로 두고, Panic Index / Daily Bottom Buy / Trading Zone과 **읽기 전용으로만 연결**한다.

```
┌─────────────────────────────────────────────────────────┐
│ 기존 (변경 금지)                                         │
│  Panic Index V2 · Legacy · DBB · DCA · Signals          │
└─────────────┬───────────────────────────┬───────────────┘
              │ 읽기(지표·점수·히스토리)     │
              ▼                           ▼
┌─────────────────────┐     ┌─────────────────────────────┐
│ A. Opportunity      │     │ B. Credit Risk              │
│ 저점·공포 기회 축    │◄───►│ IG(BBB)+HY 신용·속도 축     │
└──────────┬──────────┘     └──────────────┬──────────────┘
           │                               │
           └──────────► 종합 해석(4분면) ◄──┘
```

### A. 시장 기회 분석 (Opportunity)

**목적:** 하락·공포 심화 시 **분할 저점 매수 기회**의 강도·이유를 설명.

**입력 (기존 데이터 재사용, 식 변경 없음):**

- VIX, CNN, BofA, Put/Call, HY (수준)  
- Panic Index V2 점수 (참조만)  
- 가격/추세 (SPX 등 기존 history·trend 시리즈)

**출력 초안:**

| 필드 | 설명 |
|------|------|
| `opportunityScore` 0–100 | 높을수록 “분할 매수 관심↑” (Panic과 **동일 숫자 아님**) |
| `condition` | 시장 컨디션 요약 |
| `fearLevel` | 과매도·공포 수준 |
| `dcaWindow` | 분할 매수 가능 구간 힌트 (기존 DCA 구간과 **병기·비연동**) |
| `strength` | 기회 강도 |
| `reasons[]` | 왜 이 점수인지 (지표별 기여·방향) |

### B. 신용위험 분석 (Credit Risk)

**목적:** 신용위험이 **빠르게** 상승하는지, IG vs HY를 구분해 경고.

**입력:**

- **BBB OAS** (신규 수집 전제 — 현재 갭)  
- **HY OAS** (기존)  
- 둘의 **변화 속도**(1일/5일/20일 Δ, % 또는 bp)  
- 스프레드 추세(확대/축소)  
- VIX 등 공포 지표와의 **괴리**(선행·동행·후행)

**BBB vs HY (동일시 금지):**

| | BBB (IG) | HY |
|--|----------|-----|
| 의미 | 투자등급 펀딩·신용 여건 | 투기등급·리스크선호 |
| 확대 시 | 금융여건 전반 긴축, 시스템 스트레스 신호에 가깝 | 위험자산 기피·리세션/디폴트 우려 |
| 해석 | HY만 확대·BBB 안정 → “위험선호 축소”일 수 있음 | BBB·HY 동시 급확대 → 신용 위기 성격 강화 |
| 기회 연결 | BBB 급등 시 단순 저점매수 **경계** | HY만의 완만한 확대는 기회 국면과 **공존 가능** |

**출력 초안:**

| 필드 | 설명 |
|------|------|
| `creditRiskScore` 0–100 | 높을수록 신용위험↑ |
| `level` | 현재 수준 |
| `velocity` | 상승/하락 속도 |
| `expanding` | 확대 여부 |
| `alertStage` | 경고 단계 |
| `reasons[]` | BBB/HY/속도/괴리 근거 |

---

## 3. Opportunity와 Credit Risk의 차이

| 차원 | Opportunity | Credit Risk |
|------|-------------|-------------|
| 질문 | “공포가 매수 기회인가?” | “신용이 깨지고 있는가?” |
| 주 입력 | 주식 변동성·심리·(보조) HY 수준 | BBB·HY **수준+속도** |
| 점수↑ 의미 | 분할매수 **관심↑** | **위험관리↑** |
| Panic Index | 참조·병기 | 참조만 (HY와 괴리 분석) |
| 잘못된 동일시 | Panic = Opportunity | HY = BBB |

핵심 철학:  
**과도한 시장 하락 ≠ 무조건 매수.**  
신용위험이 급확대되면 기회 점수와 무관하게 **위험 관리 우선** 해석을 낸다.

---

## 4. 지표별 역할과 데이터 출처

| 지표 | Opportunity | Credit Risk | 출처(현재) | 갱신 |
|------|:-----------:|:-----------:|------------|------|
| VIX | 핵심 | 괴리·보조 | Yahoo 등 (`panicCollectors`) | 일 배치+6h stale |
| CNN F&G | 핵심 | 보조 | CNN API (+ fallback) | 동일 |
| Put/Call | 핵심 | 보조 | Cboe/Yahoo 계열 | 동일 |
| BofA B/B | 보조(심리) | 낮음 | 수동/env/DB | 불규칙 |
| HY OAS | 보조(신용 공존) | **핵심** | FRED `BAMLH0A0HYM2` | 영업일 FRED |
| BBB OAS | — | **핵심(미수집)** | 후보 FRED `BAMLC0A4CBBB` 등 | TBD |
| 가격/추세 | 컨디션·이유 | 괴리 | 기존 SPX/history | 기존 |
| Panic V2 | 참조 배지 | 참조 | `getPanicScoreV2` | 실시간 계산 |

**갱신 주기 차이 처리 (설계):**

- 일별 FRED vs 장중 VIX → Credit는 **일별 확정 + 장중 “예비”** 표기  
- 결측 시 점수 `null` + 이유에 “데이터 부족” (임의 50점 채우기 금지 — Panic V2와 동일한 철학)

---

## 5. 초기 점수 산정 제안

> **아래 가중치는 초기 제안값이다. 확정값이 아니다.**  
> 백테스트·구간 민감도 검증 후 조정. 기존 Panic/DBB 가중치와 **공유·변경하지 않음.**

### 5.1 Opportunity Score (제안 · 미검증)

방향: 각 지표를 0–100 “기회 기여”로 정규화 후 가중합.  
(Panic V2와 숫자 스케일은 비슷해도 **식·가중치는 독립**.)

| 구성 | 초기 제안 가중 | 방향 | 중복 주의 |
|------|----------------|------|-----------|
| Panic Index V2 (참조 입력) | 0.30 | 높을수록 기회↑ | VIX/CNN/PC와 중복 → **직접 원시 3지표와 동시 고가중 금지** |
| *또는* VIX+CNN+PC 분해 | (대안) 0.20+0.15+0.10 | 위와 택일 | Panic과 **이중 계산 금지** — 둘 중 하나 |
| BofA (약세=기회) | 0.10 | 낮을수록 기회↑ | CNN과 심리 중복 → 낮게 |
| HY 수준 (완만 확대) | 0.10 | 중간 구간만 가산 | Credit와 중복 → **수준만**, 속도는 Credit |
| 가격 과매도/추세 | 0.15 | 과매도·하락 가속 시↑ | DBB와 개념 유사 → **신호 연동 금지**, 설명용 |
| 안정화 항(평활) | — | EWMA/3일 평균 | 과도 변동 방지 |

**권장 초기안:** Panic V2 0.35 + BofA 0.10 + HY수준 0.10 + 가격/추세 0.20 + CNN원시 보조 0.10 + Put/Call 보조 0.15 — 합 1.0.  
→ **검증 전 “표시용 베타”만**, Official 배지에 쓰지 않음.

### 5.2 Credit Risk Score (제안 · 미검증)

| 구성 | 초기 제안 가중 | 방향 | 비고 |
|------|----------------|------|------|
| BBB 수준 (퍼센타일/정규화) | 0.30 | 높을수록 위험↑ | 데이터 없으면 점수 비활성 |
| HY 수준 | 0.25 | 높을수록 위험↑ | 기존 FRED |
| BBB 속도 (5d/20d Δ) | 0.20 | 급등↑ | IG 선행 포착 |
| HY 속도 | 0.15 | 급등↑ | |
| BBB–HY 동시 확대 보너스 | 0.10 | 동시↑ | “시스템성” |
| VIX만 급등·스프레드 안정 | 감점/캡 | 괴리 | 기회와 분리 |

**BBB 없으면:** Credit 점수는 `insufficient` — HY-only “부분 신용 스트레스” 배지만 허용 (정식 Credit Risk 아님).

### 5.3 위험 방향 vs 기회 방향

- 같은 HY라도: Opportunity는 **수준이 공포 매수와 공존 가능한지**, Credit는 **확대 속도·IG 동반**  
- VIX↑: Opportunity↑ 가능, Credit는 VIX만으로 올리지 않음 (스프레드 확인)

### 5.4 과도 변동 방지 (제안)

- 3~5일 EWMA  
- 일일 Δ 점수 클램프 (예: ±8점 — **검증 후 확정**)  
- 장중은 “잠정”, 일봉 확정 시 “확정”

### 5.5 검증 필요 항목 (가중치 확정 전)

1. 2018·2020·2022 구간에 Opportunity 고점 vs 전고점 회복  
2. Credit 고점이 주식 급락 **선행**했는지 (특히 BBB)  
3. Panic V2와의 상관 — 0.9 이상이면 Opportunity 입력을 줄여 중복 제거  
4. HY-only vs HY+BBB 경고 정확도  
5. 점수 노이즈(일간 std) vs 해석 문구 과민감

---

## 6. 상황별 해석 매트릭스

축: Opportunity 높음/낮음 × Credit Risk 높음/낮음 (임계는 검증 후).

| ID | 상황 | Opportunity | Credit | YDS 해석 (초안 카피) | 행동 힌트 (신호 아님) |
|----|------|-------------|--------|---------------------|----------------------|
| Q1 | 공포↑ · 신용 안정 | 높음 | 낮음 | 시장 공포는 크지만 IG/HY 급확대는 없음. **분할 매수 관심**을 검토할 수 있는 전형적인 심리 패닉 국면. | 기존 Panic/DCA UI 참고; 신규 신호 없음 |
| Q2 | 공포↑ · 신용↑ | 높음 | 높음 | 공포와 신용이 함께 악화. 저점매수 유혹과 **위험관리가 충돌**. 단순 저점 매수보다 현금·비중·분할 속도 조절이 중요. | “기회 점수 높아도 신용 경고 우선” |
| Q3 | 공포↓ · 신용 선행↑ | 낮음 | 높음 | 주가 심리는 아직 평온하나 **신용이 먼저 악화**. 방심하기 쉬운 국면. 기회 추구보다 리스크 모니터. | 신규 매수 확대 자제 해석 |
| Q4 | 공포↓ · 신용 완화 | 낮음 | 낮음 | 심리·신용 모두 완화. 저점 기회는 약하고, 과열·추격 매수 경계. | 기회 배지 낮음 |

교차 문장 템플릿:

- Q1: “지금은 **심리 충격형 기회**에 가깝고, 신용 여건은 상대적으로 버티고 있습니다.”  
- Q2: “기회와 위기가 동시에 보입니다. **신용 확대 속도**를 먼저 보세요.”  
- Q3: “주가 공포 지수만 보면 놓치기 쉬운 **신용 선행 경고**입니다.”  
- Q4: “저점 매수 명분은 약합니다. 기회 대기·추격 자제.”

---

## 7. UI 구성안

기존 `/market-analysis` 프리미엄 톤(Panic Index 카드·FEAR SCALE·Drivers)과 맞춘 **병기 섹션** (신규 라우트는 로드맵에서 결정).

```
┌──────────────────────────────────────────────┐
│ 시장 국면 한줄 해석 (4분면 라벨 + 짧은 문장)   │
├────────────────────┬─────────────────────────┤
│ Opportunity 점수    │ Credit Risk 점수         │
│ 0–100 · 강도 · 이유 │ 0–100 · 단계 · 속도      │
├────────────────────┴─────────────────────────┤
│ 이중 축 추이 차트 (Opportunity vs Credit, 120d)│
├──────────────────────────────────────────────┤
│ 근거 테이블                                   │
│  · Opportunity: VIX/CNN/… 기여                │
│  · Credit: BBB/HY 수준·Δ · VIX 괴리           │
├──────────────────────────────────────────────┤
│ 기존 Panic Index (변경 없음, 접기/병기)        │
└──────────────────────────────────────────────┘
```

원칙:

- 숫자+색만 금지 → **reasons[]** 필수  
- Panic Index 카드 **치환 금지** (병기)  
- BBB 미수집 시 Credit 카드: “데이터 준비 중 / HY 부분 지표만”  
- Preview 빌드 칩·개발자 패널과 무관  
- **실제 매수/매도 버튼·신호 배지 신규 적용 금지**

---

## 8. 과거 데이터 검증 계획

| 단계 | 내용 | 데이터 | 성공 기준(초안) |
|------|------|--------|-----------------|
| V0 | HY·Panic·가격 정렬 시계열 export (읽기 전용) | 기존 DB/history | 결측률·캘린더 정리 |
| V1 | Opportunity 베타 vs 전고점 회복·MDD | SPX + Panic history | 고점 이후 1~3개월 성과 분포 |
| V2 | Credit HY-only 속도 vs 급락 | HY OAS | 급락 전 N일 hit rate |
| V3 | BBB 시리즈 파일럿 (별도 연구 파이프라인, 프로덕션 API 전) | FRED 후보 | IG 선행 기여도 |
| V4 | 4분면 구간 빈도와 해석 타당성 | 라벨 수동 샘플 | Q2/Q3 오분류율 |
| V5 | 가중치 민감도 | 그리드 서치 | 상관·노이즈 트레이드오프 |

검증 스크립트는 `scripts/` 연구용으로만 — **엔진 Official 경로에 넣지 않음.**

---

## 9. 구현 단계별 로드맵

| Phase | 내용 | 허용 | 금지 |
|-------|------|------|------|
| **P0 설계** (본 문서) | 조사·설계 | 문서 | 코드/DB/API |
| **P1 읽기 전용 UI 스케치** | Preview 전용 mock 카드 (하드코드/피처플래그) | UI 카피 | 점수 Official화, 신호 연동 |
| **P2 연구 파이프라인** | FRED BBB 파일럿 fetch (cron/DB **전** staging 연구) | Staging 실험 | Production 스키마, Official Panic 변경 |
| **P3 Credit 정식** | BBB+HY 점수·속도·4분면 | 신규 모듈 | Panic V2 가중치 변경 |
| **P4 Opportunity 정식** | Panic 비파괴 가중합 + 이유 UI | 병기 | DBB/DCA 임계 변경 |
| **P5 연결** | 4분면 해석만 노출 | 해석 | 자동 주문·신호 강제 |

각 Phase 전: Preview 검증 → 사용자 승인 → Production은 별도 배포 게이트.

---

## 10. 아직 결정하지 않은 사항

1. BBB FRED 시리즈 최종 ID·라이선스·갱신 SLA  
2. Opportunity에 Panic V2를 직접 넣을지, 원시 3지표만 쓸지  
3. 4분면 임계값 (예: Opp≥60, Credit≥55)  
4. 신규 라우트 vs `/market-analysis` 내 섹션  
5. PRO 게이트 여부  
6. BofA 결측이 잦을 때 Opportunity 대체 규칙  
7. Credit `insufficient`(BBB 없음) UX 카피  
8. 점수 브랜드명 (한글/영문) — Panic Index와 혼동 방지  
9. 히스토리 저장 테이블 필요 여부 (현재 **DB 변경 금지** → 결정 보류)  
10. i18n·모바일 접힘 정보량

---

## 11. 기존 코드와의 충돌 검토

| 영역 | 충돌? | 대응 |
|------|-------|------|
| `getPanicScoreV2` | 없음 (미변경) | Opportunity는 별 모듈 |
| Legacy short/mid | 낮음 | 재사용만, 가중치 수정 금지 |
| `panicBottomDcaSignal` / DBB | 없음 | 신호 미연동 |
| `hy_oas` 컬럼 | 없음 | Credit가 읽기만 |
| BBB | **데이터 공백** | P2 전까지 Credit 정식 금지 |
| Market State UI 숨김 | 기회 | 새 섹션이 State를 대체하지 않음 |
| 유동성 엔진 HY | 개념 중복 | Credit와 라벨·목적 분리, 수식 공유 신중 |
| Production | 없음 | Preview·문서만 |

**결론:** 현 코드베이스에 **파괴적 충돌 없이** 병기 설계 가능. 단, **BBB 미수집**이 Credit Risk 정식 구현의 블로커이며, 그 전에는 HY 부분 지표 + 해석 매트릭스 교육용 UI만 가능.

---

## 부록 A — 조사 시 주요 경로

```
vite-project/src/utils/tradingScores.js
api/_lib/panicScores.js
api/_lib/panicCollectors.js          # FRED_HY_SERIES = BAMLH0A0HYM2
api/_lib/panicPipeline.js
api/_lib/marketCycleCompute.js
vite-project/src/utils/panicBottomDcaSignal.js
api/_lib/dailyBottomBuyEngine.js
vite-project/src/pages/CurrentMarketAnalysisPage.jsx
vite-project/src/components/market-analysis/MarketAnalysisDeskCore.jsx
vite-project/src/market-os/liquidityDualEngine.js
```

## 부록 B — 용어

- **Official Panic Index**: V2 3지표 점수 (제품 공식)  
- **Opportunity Score**: 설계상 신규, 미구현  
- **Credit Risk Score**: 설계상 신규, BBB 의존, 미구현  
- **신호**: DBB/DCA/`getAction` 등 — 본 설계에서 **신규 적용 금지**
