# UI 리뉴얼 1단계 — 기존 기능 전수 조사 인벤토리

**작성일:** 2026-10-20  
**범위:** 조사·계획만. 소스/스타일/계산/데이터/배포 미변경.  
**근거:** `App.jsx` 라우트, `ydsUiLabels.js` 내비, `pages/*`, `api/*`, `vercel.json`  
**Git:** `HEAD`/`origin/main` = `9365f71` (조사 시점). 기존 dirty 트리 보존.

식별자 규칙: `P-xxx` = 라우트된 페이지, `R-xxx` = 리다이렉트, `U-xxx` = 페이지 파일 존재·미라우트, `C-xxx` = 계산/데이터 계층, `N-xxx` = 내비 그룹.

---

## 1. 내비 구조 (실제 코드)

### N-CORE — 사이드바 핵심 (`getCoreNavItems`)
| 표시 | path | 하위 |
|------|------|------|
| 일상 조정 매수 | `/daily-bottom-buy` | ETF `/daily-bottom-buy`, 개별 `/equity-daily-bottom-buy`, 레버리지 `/leverage-adjustment` |
| 공포·패닉 매수 | `/market-analysis` | — |

### N-OTHER — 기타 기능 (`getOtherNavItems`)
종목추천, 포트폴리오, 성과검증, 관심종목, 알림, 투자 원칙, 투자 캘린더, 패닉 연구실, 연구실, DBB 전향적 검증, 시작하기, About, 용어 설명

### N-FOOTER — 하단 (`getSidebarFooterLinks`)
YDS 소개 `/intro`, FAQ `/faq`, 피드백 `/feedback`

### N-MOBILE — 하단 탭 (`MobileBottomNav`)
2탭만: 일상 조정 매수 그룹, 공포·패닉 매수. 기타 페이지는 사이드/드로어로 진입.

---

## 2. 라우트 전체 목록 (`App.jsx`)

### 2.1 활성 페이지 (P-*)

| ID | URL | 페이지 컴포넌트 | 내비 |
|----|-----|-----------------|------|
| P-DBB-ETF | `/daily-bottom-buy` | `DailyBottomBuyPage` | N-CORE |
| P-DBB-EQ | `/equity-daily-bottom-buy` | `EquityDailyBottomBuyPage` | N-CORE child |
| P-DBB-LEV | `/leverage-adjustment` | `LeverageAdjustmentPage` | N-CORE child |
| P-DBB-V12 | `/dbb-prospective-v12` | `DbbProspectiveV12Page` | N-OTHER |
| P-PANIC | `/market-analysis` | `CurrentMarketAnalysisPage` | N-CORE |
| P-PERF-CTR | `/performance-center` | `PerformanceCenterPage` | (직접 URL; 기타 메뉴 미등재) |
| P-PERF-VAL | `/performance-validation` | `PerformanceValidationPage` | N-OTHER |
| P-PERF-AI | `/performance-validation/dashboard` | `AiPerformanceDashboardPage` | 하위 |
| P-PERF-TR | `/performance-validation/track-record` | `AiTrackRecordPage` | 하위 |
| P-PERF-PICKS | `/performance-validation/picks` | `StockPickValidationPicksPage` | 하위 |
| P-PERF-PICK | `/performance-validation/pick/:pickId` | `StockPickValidationDetailPage` | 하위 |
| P-PERF-BT | `/performance-validation/backtest` | `StockPickBacktestPage` | 하위 |
| P-PORT | `/portfolio` | `YdsPortfolioPage` | N-OTHER |
| P-AI-RPT | `/ai-daily-report` | `AiDailyReportPage` | (기타·레거시 insights) |
| P-STOCK | `/stock-picks` | `StockRecommendationPage` | N-OTHER |
| P-STOCK-D | `/stock-picks/:ticker` | `StockPickDetailPage` | 하위 |
| P-STOCK-C | `/stock-picks/compare` | `StockPickComparePage` | 하위 |
| P-STOCK-R | `/stock-picks/ranking` | `StockPickRankingPage` | 하위 |
| P-WATCH | `/watchlist` | `UserWatchlistPage` | N-OTHER |
| P-ALERT | `/alert-center` | `AlertCenterPage` | N-OTHER |
| P-GLOSS | `/glossary` | `GlossaryPage` | N-OTHER |
| P-INTRO | `/intro` | `YdsIntroPage` | N-FOOTER |
| P-START | `/start` | `StartGuidePage` | N-OTHER |
| P-FAQ | `/faq` | `FaqPage` | N-FOOTER |
| P-ABOUT | `/about` | `AboutPage` | N-OTHER |
| P-FEED | `/feedback` | `FeedbackPage` | N-FOOTER |
| P-VC | `/value-chain` | `ValueChainPage` | (기타·직접 URL) |
| P-TLOG | `/trading-log` | `TradingLogPage` | (직접 URL) |
| P-RHIST | `/recommendation-history` | `RecommendationHistoryPage` | (직접 URL) |
| P-PLAB | `/panic-lab` | `PanicLabPage` | N-OTHER |
| P-ICAL | `/investment-calendar` | `InvestmentCalendarPage` | N-OTHER |
| P-PLAY | `/investment-playbook` | `InvestmentPlaybookPage` | N-OTHER |
| P-LAB | `/lab` | `PanicIndexValidationPage` | N-OTHER |
| P-ADMIN | `/admin` | `AdminDashboardPage` | (운영) |
| P-ADMIN-D | `/admin/debug` | `AdminStockPickDebugPage` | **DEV만** |
| P-DEBUG | `/debug-data` | `DebugDataPage` | **DEV만** |
| P-PREV5 | `/preview/home-v5` | `HomeV5PreviewPage` | **DEV만** |
| P-PREV5V | `/preview/home-v5-validation` | `HomeV5StrategyValidationPage` | **DEV만** |
| P-404 | `*` | `NotFoundPage` | — |

`/` → `Navigate` → `/daily-bottom-buy`.

### 2.2 호환 리다이렉트 (R-*) — URL 보존 필수

| ID | from | to |
|----|------|-----|
| R-MD | `/market-dashboard` | `/market-analysis` |
| R-PD | `/performance-dashboard` | `/performance-center` |
| R-AL | `/action-log` | `/portfolio#portfolio-trades` |
| R-YC | `/yds-compare` | `/portfolio#portfolio-trades` |
| R-OPS | `/ops-dashboard` | `/portfolio` |
| R-CY | `/cycle` | `/market-analysis#market-desk` |
| R-MR | `/macro-risk` | `/market-analysis#bond-liquidity` |
| R-TM | `/timing` | `/value-chain#industry-signal-board` |
| R-PV | `/panic-validation` | `/lab` |
| R-IN | `/insights` | `/ai-daily-report` |

### 2.3 미라우트 페이지 파일 (U-*) — 기능 삭제 금지(파일·연구 자산)

| ID | 파일 | 비고 |
|----|------|------|
| U-DBB-CQ1..11 | `DbbChartQualityPage` … `V11` | 연구 UI 셸; 라우트는 V12만 |
| U-ETF-SIG* | `EtfSignalCompare/Track/Stability/Regime/Validation` | 미마운트 |
| U-PREC | `PrecursorDashboardBetaPage` | `/lab` accordion에 유사 UI |
| U-MACRO | `MacroRiskPage` | 리다이렉트만 |
| U-STRAT | `StrategyPage` | 미마운트 |
| U-IHOME | `InvestmentHomePage` | 미마운트 |
| U-WCTR | `WatchlistCenterPage` | 실사용은 `UserWatchlistPage` |
| U-PDASH | `PerformanceDashboardPage` | 실사용은 `PerformanceCenterPage` |

---

## 3. 페이지별 기능 보존 체크리스트 (핵심)

### P-DBB-ETF `/daily-bottom-buy`
| 항목 | 내용 |
|------|------|
| 콘텐츠 | 매수 현황, 과거 연구 note, 안내, 후보 카드, 종목 선택, SCORE/조건/기록, 매수 기록 폼, 전체 ETF 목록 |
| 기능 | 선택·검색·에피소드 ack·TradeRecord CRUD·목록 접기 |
| 데이터 | `GET /api/daily-bottom-buy`, LS `yds.tradeRecords.v1`, `yds.dailyBottomBuy.episodes.v1` |
| 계산 | `api/_lib/dailyBottomBuyEngine.js`, `ydsDailyBottomBuyEpisodes`, `ydsDbbBuyProgress`, `buyConditionOrder` |
| UI | `DailyBottomBuyPage`, `DbbBuyProgressSection`, `TradeRecordEditor`, `DbbReturnHorizonNote` |
| 테스트 | `scripts/daily-bottom-buy-*.mjs`, `equity-buy-amount-and-quote` (ETF deriveAmount **기존 fail**) |
| 리뉴얼 | **보존:** 신호·임계값·기록. **변경:** 카드/타이포/색/간격만 |
| 검증 | 후보 수·count·threshold 문구 스냅샷; 기록 저장 round-trip |

### P-DBB-EQ `/equity-daily-bottom-buy`
| 항목 | 내용 |
|------|------|
| 콘텐츠 | holdings progress, 후보, picker, SCORE→연구패널→CONDITIONS→ATR→해석, 매수 기록, 전체 목록(보유 NEE/RXRX 포함) |
| 기능 | picker/그룹/검색, 후보·목록 선택, research details, trade CRUD, `deriveAmount` |
| 데이터 | `GET /api/equity-daily-bottom-buy`, `portfolio-quote`, LS trade records |
| 계산 | `equityDailyBottomBuyHandler/Engine`, `equityResearchDisplay`, `equityResearchSummary` |
| UI | `EquityDailyBottomBuyPage`, `EquityResearchPanel`, trade components; CSS `--equity-dash` |
| 테스트 | `equity-daily-bottom-buy`, `equity-research-display`, `equity-research-panel-v43` (**pass**) |
| 리뉴얼 | 패널 순서·후보 데이터 보존; 라이트 테마 스코프 |
| 검증 | v43 순서 assert; API count≥3 후보 집합 |

### P-DBB-LEV `/leverage-adjustment`
| 항목 | 내용 |
|------|------|
| 콘텐츠 | 유니버스 카드(플레이스홀더 메트릭), 매수/매도 「기준 준비 중」 |
| 기능 | **정적 UI만** (신호 미구현) |
| 데이터 | `LEVERAGE_ADJUSTMENT_UNIVERSE` |
| 상태 | **플레이스홀더** — 리뉴얼 시에도 문구·섹션 유지 |
| 테스트 | `leverage-adjustment-ui.test.mjs` |

### P-PANIC `/market-analysis`
| 항목 | 내용 |
|------|------|
| 콘텐츠 | Panic Index, FEAR SCALE, HISTORY, DRIVERS, 패닉 매수 기록 패널, 시장 desk(유동성·사이클 등) |
| 데이터 | `appDataStore` / `panicStore`, `/api/panic*`, ETF 벤치마크 로더, LS 시장상태 이력 |
| 계산 | `panicPipeline`, `panicScores`, `ydsUnifiedMarketState`, `liquidityDualEngine`, … |
| 리뉴얼 | desk 카드 시각만; 점수·히스토리 파이프라인 동결 |
| 검증 | panic latest score·history length smoke |

### P-STOCK `/stock-picks` (+ detail/compare/ranking)
| 항목 | 내용 |
|------|------|
| 기능 | 필터·국가탭·★·알림·상세·비교·랭킹 |
| 데이터 | live pick model, LS favorites/alerts/validation |
| 계산 | `ydsStockPick*` · `ydsValidationEngine` |
| 검증 | TOP 목록 ticker 집합·즐겨찾기 토글 |

### P-PORT `/portfolio`
| 항목 | 내용 |
|------|------|
| 기능 | 보유 추가/삭제, 현금, 적합도/리스크 |
| 데이터 | LS portfolio keys, `/api/portfolio-quote`, `/api/portfolio-sync` (계정) |
| 검증 | add/remove holding; 로그인 시 sync (수동) |

### P-PERF-VAL 및 하위
| 항목 | 내용 |
|------|------|
| 기능 | 7/14/30 호라이즌 탭, KPI·MDD·패턴·백테스트·트랙레코드 |
| 계산 | `ydsPick*Engine` 다수 |
| 검증 | horizon 전환 후 KPI 숫자 동일성 |

### P-PLAB `/panic-lab`, P-LAB `/lab`
| 항목 | 내용 |
|------|------|
| PLAB | 히스토리 차트·이벤트·사후성과·구간·구성요소 (read-only) |
| LAB | 백테스트 KPI·VS·연도·Engine V3·accordion 연구 모듈·이벤트 데이터셋 |
| 검증 | 섹션 제목·탭 존재; LAB accordion 개수 |

### P-DBB-V12
관측 실행·갱신·JSON/CSV export; LS `yds.dbbProspective.v12`; API daily-bottom-buy + dbb-prospective-ohlcv

### 기타 P-*
- **P-WATCH / P-ALERT / P-PLAY / P-ICAL:** 관심·알림·원칙·캘린더  
- **P-VC / P-TLOG / P-RHIST / P-AI-RPT / P-PERF-CTR:** 밸류체인·트레이딩로그·추천이력·AI리포트·성과센터  
- **안내:** intro/start/faq/about/glossary/feedback  
- **ADMIN/DEV:** 운영·디버그·preview

---

## 4. 핵심 데이터·계산 위치 (C-*)

| ID | 영역 | 주요 경로 |
|----|------|-----------|
| C-DBB-ETF | ETF DBB 엔진 | `api/_lib/dailyBottomBuyEngine.js`, `dailyBottomBuyHandler.js` |
| C-DBB-EQ | 개별 DBB | `api/_lib/equityDailyBottomBuyHandler.js` (+ engine) |
| C-DBB-UI | 프론트 후보/정렬 | `utils/dailyBottomBuyApi.js`, `equityDailyBottomBuyApi.js`, `buyConditionOrder.js` |
| C-ATR | ATR/위험 표시 | equity view ATR fields (handler/engine); UI ATR RISK 섹션 |
| C-TR | 매수 기록 | `content/ydsTradeRecords.js`, `TradeRecordEditor` |
| C-TR-SYNC | 클라우드 동기화 | `ydsTradeRecordsCloudSync.js`, `/api/trade-records-sync` → `portfolio-sync?ydsMode=trade-records` |
| C-PANIC | 공포지수 | `api/panic.js`, `api/_lib/panicPipeline.js`, `panicCollectors.js`, `panicScores.js`, cron `panic-collect` |
| C-MKT | 시장상태 | `ydsUnifiedMarketState`, `marketCycleCompute`, `appDataStore` |
| C-PICK | 종목추천 | `content/ydsStockPick*.js`, `ydsValidationEngine.js` |
| C-PERF | 성과검증 | `ydsPickPerformanceEngine`, outcome/success/MDD/EV engines |
| C-PORT | 포트폴리오 | `ydsPortfolioCenterEngine`, portfolio storage, quote API |
| C-RES-EQ | 개별 연구 요약 | `equityResearchSummary.js` (정적 요약; 패널 UI) |
| C-LEV | 레버리지 | `leverageAdjustmentUniverse.js` only (규칙 미정) |
| C-BT-LAB | 연구실 백테스트 | `panicIndexValidationBacktest.js`, validation components |

**API 엔트리 (확인됨):** `panic`, `market-data`, `stock`, `stock-batch`, `stock-indicators`, `portfolio-quote`, `portfolio-sync`, `ai/reports`, `cron/panic-collect`, `market/status`, `supabase/health`, `macro-briefing-ai`  
**Rewrites:** daily-bottom-buy / equity-daily-bottom-buy / dbb-prospective-ohlcv / trade-records-sync / panic aliases (`vercel.json`)

---

## 5. 특별 영역 구현 상태

| 영역 | 상태 | 근거 |
|------|------|------|
| 주식·DBB | **운영 중** | P-DBB-ETF/EQ + API engines |
| 일반 ETF DBB | **운영 중** | P-DBB-ETF |
| 레버리지 ETF | **UI 플레이스홀더** | 매수·매도 기준 미정 문구 |
| 공포지수 | **운영 중** | panic API + cron + market-analysis/lab |
| 과거 연구 | **혼합** | ETF note + EquityResearchPanel 정적 요약; LAB/PLAB 연구 UI; U-DBB-CQ* 미라우트 |
| ATR | **개별 DBB UI에 표시** | equity ATR RISK; ETF OpportunityFacts에 ATR 표시 |
| 백테스트·매도 연구 | **다층** | P-PERF-BT, P-LAB, scripts equity-sell-backtest-* (연구 스크립트; 전부 UI 연동 여부는 미확인) |
| 매매 기록 | **운영 중** | LS + 로그인 시 cloud sync |
| 미라우트 연구 페이지 | **코드 존재, URL 없음** | U-* — 삭제하지 말 것 |

---

## 6. 테스트·빌드 상태

| 항목 | 상태 |
|------|------|
| 빌드 | `vite-project`: `npm run build` = verify:api + gen:build-meta + vite build (최근 배포 `9365f71` 성공) |
| lint | `npm run lint` (eslint) — **이번 조사에서 전체 lint 미실행** |
| 샘플 통과 | `equity-research-panel-v43`, `equity-daily-bottom-buy`, `equity-research-display`, `leverage-adjustment-ui` |
| **기존 실패** | `equity-buy-amount-and-quote`: ETF 페이지 `deriveAmount` 존재 vs `doesNotMatch` — **신규 아님** |
| 전체 scripts 스위트 | **미실행** (수백 개 연구/백테스트 테스트; 상태 미확인) |

---

## 7. 알려진 문제·미확인

### 확인된 문제
1. ETF `deriveAmount` 배선 vs 테스트 기대 불일치 (기존).  
2. 레버리지 페이지 신호/기준 미구현.  
3. 다수 연구 페이지 파일 미라우트 (의도적일 수 있음 — 확인 필요).  
4. 워킹트리 dirty: panicStore, vite.config, market-analysis fold, build-version 등 — **리뉴얼과 무관, 보존**.

### 미확인
- `PerformanceCenterPage` vs `PerformanceValidationPage` 사용자 노출 빈도·중복도.  
- equity-sell / soxl-crash 등 **스크립트 연구**가 어떤 UI에 연결되는지.  
- 전체 테스트 스위트 green 여부.  
- PWA 캐시가 UI 리뉴얼 시 구버전 고정 여부(배포 정책).  
- Firebase 로그인 없는 환경에서 trade sync UX 전 경로.

---

## 8. UI 리뉴얼 계획 (승인 후)

### 원칙
- UI 계층(색, 타이포, 카드, 간격, 내비 chrome)만.  
- C-* 엔진·API·LS 키·라우트·리다이렉트 동결.  
- 한국어 표시 개선 시 **식별자·필드명 불변**.  
- 라이트 프리미엄: off-white / navy / blue accent / thin border.

### 권장 적용 순서 (작·검증 단위)
1. **Design tokens** — CSS variables (신규 스코프), 기존 dark 토큰과 공존 → 회귀 최소.  
2. **Shell** — sidebar, mobile bottom nav, header, footer links.  
3. **P-DBB-ETF / P-DBB-EQ / P-DBB-LEV** — 핵심 매수 UX (동일 섹션·순서).  
4. **P-PANIC** — desk 카드 시각.  
5. **P-STOCK 계열** — 밀도 높은 표/카드.  
6. **P-PORT / P-WATCH / P-ALERT**.  
7. **P-PERF-* / P-PLAB / P-LAB / P-DBB-V12**.  
8. **안내·ADMIN·기타**.  
9. **미라우트 U-*** — 라우트 추가 여부 별도 승인 후; 파일 삭제 금지.

### 예상 위험
- 전역 Tailwind/`index.css` 변경 시 DBB·panic 동시 회귀.  
- 컴포넌트에 계산+UI 혼재 시 리팩터 유혹 → **승인 전 분리 금지**, 필요 시 계획만.  
- 라이트 테마에서 차트 색 대비 부족.  
- dirty 트리와 토큰 작업 충돌.

---

## 9. 기능 회귀 테스트 계획

| 단계 | 방법 |
|------|------|
| 자동화 | 페이지별 기존 `scripts/*` 관련 테스트; DBB v43·display·daily-bottom; trade records unit; stock-pick 핵심 |
| 스모크 수동 | 각 P-* URL 로드, 주요 섹션 제목, 1회 CRUD(기록/포트/★) |
| 데이터 동등성 | 동일 심볼 API JSON 필드 스냅샷(before/after UI) |
| 리다이렉트 | R-* 전부 대상 path 확인 |
| 모바일 | 2탭 활성 + 드로어로 N-OTHER 진입 |
| 실패 분류 | 기존 fail(ETF deriveAmount) vs 신규 fail 분리 기록 |
| 금지 | 테스트 기대값 완화로 통과 처리 |

---

## 10. 이번 조사에서 생성한 문서

| 파일 | 내용 |
|------|------|
| `docs/UI_RENEWAL_PHASE1_INVENTORY.md` | 본 인벤토리 (신규) |

**코드·스타일·설정·배포 변경 없음.** 기존 문서 덮어쓰기 없음.

---

## 승인 게이트

사용자가 본 조사·계획을 검토·승인하기 전까지 **실제 UI 리뉴얼 작업 시작하지 않음.**
