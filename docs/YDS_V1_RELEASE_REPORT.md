# YDS V1 Release Report

> 점검일: 2026-06-03 · 커밋 기준 Final Launch Sprint · **Major 0**

## 출시 가능 여부

### 판정: **Launch Candidate**

V1 사용자-facing 6코어는 **기능·흐름·설명력·Major 이슈 제거** 기준 LC.  
실시간 시세는 V1 scope out — UI·문서로 명시 완료.

---

## 페이지별 상태

| 페이지 | 상태 | 비고 |
|--------|------|------|
| 시장분석 | ✅ LC | Summary V2 · Data scope · Journey · Why |
| Watchlist | ✅ LC | explain · 딥링크 · reco `?q=` |
| Alert | ✅ LC | causes · boot stockId · CTA |
| AI 리포트 | ✅ LC | E→Watchlist · Journey |
| 성과센터 | ✅ LC | reco history 필터 링크 |
| Research | ✅ RC1 | Stock Radar · Phase 내부명 |

---

## 이슈 분류

### Critical (0)

없음 — 빌드·라우팅·404·PWA 통과.

### Major (0) — Final Launch Sprint 해결

| ID | 이슈 | 원인 | 영향 | 해결 | 재검증 |
|----|------|------|------|------|--------|
| MJ-01 | 실시간 시세 미연동 Stock Radar | Phase 26 전략-only 설계 | 사용자 실시간 기대 | `YdsV1DataScopeNotice` + glossary | ✅ |
| MJ-02 | Hub vs `/cycle` 중복 | 동일 cycle 데이터, UI 이중 | 혼란·클릭 낭비 | 탭명 + `YdsCycleScopeBanner` | ✅ |
| MJ-03 | 추천 기록 종목 필터 없음 | 전체 테이블만 제공 | 종목별 추적 불가 | `?q=` + 역링크 | ✅ |

### Minor (6)

| ID | 이슈 | 상태 |
|----|------|------|
| MN-01 | AI 리포트 → Watchlist 직링크 | ✅ |
| MN-02 | 320px metrics 2열 only | △ 문서 |
| MN-03 | Research Phase 번호 잔존(내부) | 잔존 |
| MN-04 | PerformanceDashboard orphan | ✅ redirect |
| MN-05 | Alert boot CTA causes 빈 경우 | ✅ |
| MN-06 | Glossary stock-radar 앵커 | ✅ |

---

## Major 항목 상세 (종료 기록)

### MJ-01 — Stock Radar 실시간 미연동

- **원인:** V1 Launch Sprint에서 실시간 API·엔진 변경 금지; Phase 26은 sector/strategy 가중 점수.
- **영향:** Hub/Watchlist 점수가 “현재가 기반”으로 오인될 수 있음.
- **해결:** Summary 상단 `YdsV1DataScopeNotice` — “전략 기반, RSI/거래량 API 미연동” + `/glossary#stock-radar`.
- **재검증:** 시장분석 Hub 첫 스크롤에서 notice 노출 확인.

### MJ-02 — Hub vs `/cycle` 중복

- **원인:** Panic Desk(cycle)와 Hub가 동일 cycle 히스토리 소스 공유.
- **영향:** 일반 사용자가 cycle 탭에서 운영 UI와 Hub를 혼동.
- **해결:** 시장분석 탭 라벨 「시장 사이클 (상세)」; `/cycle` route에 Hub 복귀 배너.
- **재검증:** `/cycle` 진입 시 배너·Hub 링크 확인.

### MJ-03 — 추천 기록 종목 필터

- **원인:** `RecommendationHistoryPage` 전체 목록만, 종목별 쿼리 없음.
- **영향:** Watchlist·성과에서 “이 종목 추천 당시” 추적 불편.
- **해결:** URL `?q=` 검색·하이라이트; Watchlist/성과 D·E에서 `?q={symbol|name}` 링크; 행→Watchlist hash.
- **재검증:** Watchlist 카드 “추천 기록” → 필터된 이력 표시.

---

## 플랫폼 검증

| 항목 | 결과 |
|------|------|
| PWA | ✅ generateSW · update toast |
| 다크모드 | ✅ 기본 다크 · contrast RC2 CSS |
| 모바일 | △ 320px — [YDS_MOBILE_UX_IMPROVEMENTS.md](./YDS_MOBILE_UX_IMPROVEMENTS.md) |
| 데스크탑 | ✅ sidebar + hub |
| 404 | ✅ NotFoundPage |
| 로딩 | ✅ market-analysis loading state |

---

## 중복 점검

| 중복 | 판단 |
|------|------|
| Hub Top3 vs Watchlist Top10 | 의도적 요약/상세 |
| Hub vs `/cycle` | 배너·탭명으로 역할 구분 |
| Research Stock Radar vs Hub | OK |
| Launch pages vs Glossary | OK |

---

## 콘솔 에러

- 프로덕션 빌드: **chunk size warning only** (non-blocking)
- 런타임 0 목표: smoke test 권장

---

## V1 출시 체크 (요약)

- [x] 6코어 네비
- [x] 첫 방문 온보딩
- [x] Launch pages
- [x] Explainability
- [x] Journey CTA
- [x] Major 0
- [ ] 실시간 시세 (V1 scope out)
- [ ] E2E automated tests

---

## 관련 문서

- [YDS_SOFT_LAUNCH_REVIEW_REPORT.md](./YDS_SOFT_LAUNCH_REVIEW_REPORT.md)
- [YDS_V1_LAUNCH_REPORT.md](./YDS_V1_LAUNCH_REPORT.md)
- [YDS_RECOMMENDATION_JOURNEY_AUDIT.md](./YDS_RECOMMENDATION_JOURNEY_AUDIT.md)
- [STOCK_RADAR_SCORING.md](./STOCK_RADAR_SCORING.md)

---

## 권장 다음 단계

1. 320px 실기기 smoke
2. Supabase cycle 운영 데이터 (엔진 변경 없음)
3. Phase 26.1 실시간 POC (별도 스프린트)
