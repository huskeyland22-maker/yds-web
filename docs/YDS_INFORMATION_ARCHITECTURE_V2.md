# YDS Information Architecture V2

> V1 출시 전 정보구조(IA) 재정리 — **시장판단**과 **종목추천** 분리  
> 범위: UI · 메뉴 · 라우팅 · 문서 (엔진·산식·API 변경 없음)

---

## 1. 현재 구조 (Before)

### 1.1 라우트·메뉴 (개편 직전)

| 순서 | 메뉴 라벨 | 경로 | 실제 콘텐츠 |
|------|-----------|------|-------------|
| 1 | 📊 시장분석 | `/market-analysis` | Hub 요약 + 5초 요약 + **추천 종목/섹터** + 해석 |
| 2 | ⭐ 관심종목 | `/watchlist` | Top10 관심종목 카드 |
| 3 | 🔔 알림 | `/alert-center` | 알림 센터 |
| 4 | 🤖 AI 리포트 | `/ai-daily-report` | 일일 리포트 |
| 5 | 📈 성과 | `/performance-center` | 성과·추천 기록 |
| 6 | 🧪 연구실 | `/lab` | 패닉지수 검증·Phase 실험 |

**숨은 핵심 페이지:** `/cycle` — 패닉 데스크 + 전략 LAB + **실전매매존**이 한 화면에 혼합. 시장분석 탭에서 “시장 사이클 (상세)”로 진입.

### 1.2 `/cycle` (PanicDeskDashboard) 블록 구성

```
CycleDataBasisBar
YdsCompositeHero          ← YDS 점수·단계·최근 흐름
YdsActionSignalCenter     ← 오늘 행동
YdsAllocationCenter       ← 주식/현금 비중
HomeV5DeskLead            ← 핵심지수 (VIX, CNN, BofA, Put/Call, HY 등)
PanicIndexHistorySection  ← 패닉지수 히스토리 차트
HomeV5StrategyValidationPanel  ← 전략 연구 LAB
CycleBondLiquiditySection ← 채권·유동성
TacticalTradingZoneSection     ← 실전매매존
```

### 1.3 문제의 본질

- **한 URL에 4가지 제품**이 겹침: 패닉지수 플랫폼 · 종목추천 · 연구실 · 성과(간접)
- 시장분석 Hub에 **종목 카드·Watchlist CTA**가 상단 노출 → “시장 판단”보다 “종목”이 먼저 보임
- `/cycle`이 사실상 홈 역할을 하지만 메뉴에 없고, `/market-analysis`와 **중복·분산**

---

## 2. 문제점

| # | 문제 | 사용자 영향 |
|---|------|-------------|
| P1 | 시장판단 vs 종목선택 경계 없음 | “지금 사야 하나?” 전에 “무슨 종목?”이 보임 |
| P2 | `/cycle`과 `/market-analysis` 이중 구조 | 어디가 ‘정답’인지 불명확 |
| P3 | 실전매매존이 패닉 데스크 하단 | 시장 미판단 상태에서 매매 UI 노출 |
| P4 | Hub 5초 요약 + Cycle Hero **이중 요약** | 스크롤·인지 부하 |
| P5 | 관심종목 단독 메뉴 | 섹터→종목→관심→매매 **여정**이 끊김 |
| P6 | 연구실(LAB)이 `/cycle`에 묶임 | 프로덕션 사용자에게 노이즈 |

---

## 3. 권장 메뉴 구조 (After)

| 순서 | 메뉴 | 경로 | 한 줄 정의 |
|------|------|------|------------|
| 1 | 📊 **시장분석** | `/market-analysis` | 지금 시장이 어디인가 · 무엇을 해야 하는가 |
| 2 | ⭐ **종목추천** | `/stock-picks` | 섹터 → 종목 → 관심종목 → 실전매매 |
| 3 | 🔔 알림 | `/alert-center` | 단계·신호 알림 |
| 4 | 🤖 AI 리포트 | `/ai-daily-report` | 일일 시장 해설 |
| 5 | 📈 성과 | `/performance-center` | 추천·매매 성과 |
| 6 | 🧪 연구실 | `/lab` | 백테스트·Phase 검증 |

**리다이렉트 (호환)**

| 구 경로 | 신 경로 |
|---------|---------|
| `/` | `/market-analysis` |
| `/cycle` | `/market-analysis#market-desk` |
| `/watchlist` | `/stock-picks` (hash 유지) |
| `/macro-risk` | `/market-analysis#bond-liquidity` |
| `/market-dashboard` | `/market-analysis` |

---

## 4. 페이지별 구성

### 4.1 시장분석 `/market-analysis` (최우선)

**포함**

| 영역 | 컴포넌트 | 설명 |
|------|----------|------|
| 시장 위치 | `YdsCompositeHero` | YDS 점수, 현재 단계(과열~패닉매수), 최근 흐름 |
| 행동 가이드 | `YdsActionSignalCenter` | 오늘 행동 (추격 금지·관망·분할매수 등) |
| 비중 | `YdsAllocationCenter` | 주식/현금 비중 |
| 핵심지수 | `HomeV5DeskLead` | VIX, CNN, BofA, Put/Call, HY |
| 패닉지수 히스토리 | `PanicIndexHistorySection` | 1M·3M·6M·1Y·3Y 차트 |
| 채권·유동성 | `CycleBondLiquiditySection` | 매크로 리스크 보조 |
| 시장 해설 | `MarketAnalysisHubTop` (marketOnly) | 해석·국면·패턴·신뢰도 |

**제외 (명시적 금지)**

- 종목 카드 · Sector/Stock Radar 그리드
- Watchlist Top10
- 실전매매존 (`TacticalTradingZoneSection`)
- 전략 LAB (`HomeV5StrategyValidationPanel`)

**다음 단계 CTA:** → 종목추천 `/stock-picks`

### 4.2 종목추천 `/stock-picks`

**흐름 (위 → 아래)**

```
1. 추천 섹터 (Sector Radar Top5)
2. 종목 추천 (Stock Radar 카드)
3. 관심종목 (WatchlistCenterPage embedded)
4. 실전매매존 (TacticalTradingZoneSection)
```

**헤더:** “시장 판단은 시장분석” 링크로 1단계 복귀

### 4.3 알림 · AI 리포트 · 성과

- 기존 역할 유지
- 종목 딥링크: `/stock-picks#watchlist-{id}`

### 4.4 연구실 `/lab`

- 패닉지수 검증·Phase 섹션
- `/cycle`에 있던 `HomeV5StrategyValidationPanel` → **연구실 소속** (향후 `/lab` 내 배치 권장; 엔진 묶음은 `/lab` 유지)

---

## 5. `/cycle` 이동 대상 목록

| 현재 위치 (블록) | 권장 위치 | 중복 | 삭제 | 이유 |
|------------------|-----------|------|------|------|
| `YdsCompositeHero` | **시장분석** | Hub 요약과 부분 중복 | UI 통합 | YDS·단계는 1순위 정보 |
| `YdsActionSignalCenter` | **시장분석** | Hub “추천 행동” | — | 행동은 시장 판단 직후 |
| `YdsAllocationCenter` | **시장분석** | Hub “권장 비중” | — | 비중은 시장 단계 산출물 |
| `HomeV5DeskLead` (핵심지수) | **시장분석** | — | — | “왜 이 구간인가” 근거 |
| `PanicIndexHistorySection` | **시장분석** | — | — | 패닉지수 히스토리 전용 |
| `CycleBondLiquiditySection` | **시장분석** | — | — | 매크로 보조 (시장판단) |
| `CycleDataBasisBar` | **시장분석** | — | — | 데이터 기준 표시 |
| `MarketDashboardSummary` (5초·종목) | **시장분석** (종목 제외) / **종목추천** | Desk Hero와 중복 | marketOnly 시 요약 생략 | 시장분석은 Desk 우선 |
| Hub 추천 종목 카드 | **종목추천** | Stock Radar | 시장분석에서 **제거** | 종목은 2단계 |
| Hub 추천 섹터 Top3 | **종목추천** | Sector Radar | 시장분석에서 **제거** | 섹터는 종목 전 단계 |
| `WatchlistCenterPage` | **종목추천** (embedded) | — | 단독 `/watchlist` 메뉴 | 여정의 3단계 |
| `TacticalTradingZoneSection` | **종목추천** | — | `/cycle`에서 **제거** | 매매는 종목 선택 후 |
| `HomeV5StrategyValidationPanel` | **연구실** | `/lab` Phase 패널 | `/cycle`에서 **제거** | 프로덕션 노이즈 |
| `RecommendationJourneyStrip` | **양쪽** (문맥별) | — | — | 시장→종목 / 종목→알림 |
| Phase 25~36 검증 섹션 | **연구실** | — | — | 실험·검증 전용 |
| AI Daily Report | **AI 리포트** | — | — | 이미 분리됨 |
| Performance Center | **성과** | — | — | 이미 분리됨 |

---

## 6. 삭제 후보

| 항목 | 권장 | 비고 |
|------|------|------|
| `/cycle` 프로덕션 라우트 (본문) | **리다이렉트 유지** | `#market-desk`로 대체 |
| 시장분석 Hub 내 종목·섹터 섹션 | **삭제** | `marketOnly` 모드 |
| 시장분석 ↔ Cycle 탭 UI | **삭제** | 단일 시장분석 페이지 |
| 메뉴 “관심종목” 단독 1순위 | **종목추천으로 통합** | `/watchlist`는 redirect |
| `YdsCycleScopeBanner` on `/cycle` | **미사용** | redirect 후 불필요 |
| Hub + Desk **동시** 5초 요약 | **Desk 우선, Hub 요약 생략** | marketOnly |

**유지 (삭제 금지)**

- `PanicDeskDashboard.jsx` — dev·참조용 (엔진 묶음)
- 모든 YDS / Phase / 패닉 산식 모듈
- `/lab` Phase 섹션 전체

---

## 7. 출시 전 권장안

### 7.1 구현 상태 (V2 스프린트)

- [x] `MarketAnalysisDeskCore` — 시장 전용 슬라이스
- [x] `StockRecommendationPage` + `/stock-picks`
- [x] `/watchlist` → `/stock-picks` redirect
- [x] `/cycle` → `/market-analysis#market-desk`
- [x] 네비: **종목추천** (`ydsUiLabels.js`)
- [x] 시장분석 `marketOnly` Hub (해설만)
- [ ] 연구실에 Strategy LAB 패널 **명시적 배치** (선택, P1 아님)

### 7.2 출시 체크리스트

1. 첫 진입 `/market-analysis` — YDS·단계·행동이 **fold 위**
2. 종목·Watchlist·실전매매 **시장분석에 없음** 확인
3. 모바일 하단 nav 6탭 순서 일치
4. 알림·AI리포트·성과의 종목 링크 → `/stock-picks#…`
5. 시작 가이드·FAQ “종목추천” 용어 통일

---

## 8. 첫 화면 우선순위 TOP 10

> 질문: *사용자가 처음 진입했을 때 무엇이 가장 먼저 보여야 하는가?*

| 순위 | 정보 | 근거 |
|------|------|------|
| 1 | **YDS 점수 / 시장 위치** | 모든 행동의 전제 |
| 2 | **현재 단계** (과열→패닉매수) | 직관적 구간 라벨 |
| 3 | **오늘 행동** (추격 금지·관망·분할매수) | 2단계: 행동 결정 |
| 4 | **주식/현금 비중** | 실행 가능한 가이드 |
| 5 | **최근 흐름** (25→26→25) | 방향성·모멘텀 |
| 6 | **핵심지수** (VIX, CNN, BofA, P/C, HY) | “왜 이 구간?” 근거 |
| 7 | **시장 해설** (한 줄 + Why) | 맥락 이해 |
| 8 | **패닉지수 히스토리** | 장기 관점 |
| 9 | **다음 단계 CTA → 종목추천** | 3단계 진입 |
| 10 | **신뢰도/패턴** (보조) | 확신 보조 |

**의도적으로 10위 밖:** 추천 종목, Watchlist, 실전매매존, Phase LAB

---

## 9. 현재 순서 vs 권장 순서

### 9.1 시장분석 `/market-analysis`

| 순위 | **개편 전 (실제 스크롤)** | **권장 (V2)** |
|------|---------------------------|---------------|
| 1 | Hub 5초 요약 (시장+행동+**종목**) | **YdsCompositeHero** (YDS·단계·흐름) |
| 2 | 추천 섹터/종목 Top3 | **YdsActionSignalCenter** (오늘 행동) |
| 3 | (탭) Cycle Hero | **YdsAllocationCenter** (비중) |
| 4 | Cycle 행동·비중 | **HomeV5DeskLead** (핵심지수) |
| 5 | 핵심지수 | **PanicIndexHistorySection** |
| 6 | 히스토리 | **CycleBondLiquiditySection** |
| 7 | 전략 LAB | **시장 해설** (Hub marketOnly) |
| 8 | 실전매매존 | **→ 종목추천 CTA** |
| — | — | *(종목·Watchlist·매매존 없음)* |

### 9.2 종목추천 `/stock-picks`

| 순위 | **개편 전** | **권장 (V2)** |
|------|-------------|---------------|
| 1 | (메뉴) Watchlist만 | **Sector Radar** |
| 2 | `/cycle` 하단 실전매매 | **Stock Radar 카드** |
| 3 | Hub 종목 카드 | **관심종목 (Watchlist)** |
| 4 | — | **실전매매존** |

### 9.3 사용자 여정 (3단계)

```
[1] 시장분석     →  YDS · 단계 · 행동 · 비중 · 지수 · 해설
        ↓
[2] 행동 결정    →  (시장분석 내에서 완료)
        ↓
[3] 종목추천     →  섹터 → 종목 → 관심 → 실전매매
```

---

## 10. 코드 매핑 (참고)

| 파일 | 역할 |
|------|------|
| `pages/CurrentMarketAnalysisPage.jsx` | 시장분석 페이지 조립 |
| `components/market-analysis/MarketAnalysisDeskCore.jsx` | 시장 전용 데스크 |
| `components/market-analysis/MarketAnalysisHubTop.jsx` | `marketOnly` 시 해설 |
| `pages/StockRecommendationPage.jsx` | 종목추천 페이지 |
| `components/stock-picks/StockRecommendationRadarPanels.jsx` | 섹터·종목 Radar |
| `utils/ydsUiLabels.js` | 메뉴·페이지 한글 라벨 |
| `App.jsx` | 라우트·redirect |

---

*문서 버전: V2 · 2026-06-03 · IA/UX only — 엔진·산식·API 미변경*
