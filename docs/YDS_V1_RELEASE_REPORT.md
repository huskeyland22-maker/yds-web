# YDS V1 Release Report

> 점검일: 2026-06-04 · 커밋 기준 `8ae23d6` + Journey/Summary 스프린트

## 출시 가능 여부

### 판정: **조건부 출시 가능 (Soft Launch RC2)**

V1 사용자-facing 6코어(시장분석·Watchlist·알림·AI·성과·Research)는 **기능·흐름·설명력** 기준 RC2.  
운영 데이터(Supabase/Firebase) 미연결 환경에서는 **시장 데이터 동기화**가 빈약할 수 있음 — Critical 아님(로딩 UI 있음).

---

## 페이지별 상태

| 페이지 | 상태 | 비고 |
|--------|------|------|
| 시장분석 | ✅ RC2 | Summary V2 · Journey · Why |
| Watchlist | ✅ RC2 | 상태 설명 · 딥링크 |
| Alert | ✅ RC2 | causes · 7/30/90일 · CTA |
| AI 리포트 | ✅ RC1 | 섹션명 개선 · 종목→Watchlist 링크 잔여 |
| 성과센터 | ✅ RC1 | 추천 기록 링크 추가 |
| Research | ✅ RC1 | Stock Radar 카테고리 · Phase 내부명 |

---

## 이슈 분류

### Critical (0)

없음 — 빌드·라우팅·404·PWA 빌드 통과.

### Major (3)

| ID | 이슈 | 완화 |
|----|------|------|
| MJ-01 | 실시간 시세 미연동 Stock Radar | 「전략 기반」 배지 · 26.1 계획서 |
| MJ-02 | `/cycle` Panic Desk vs Hub 데이터 중복 | Hub 단순화 · cycle 탭 2nd |
| MJ-03 | 추천 기록 ↔ 종목 필터 없음 | Watchlist hash로 부분 대체 |

### Minor (6)

| ID | 이슈 |
|----|------|
| MN-01 | AI 리포트 → Watchlist 직링크 |
| MN-02 | 320px metrics 2열 only |
| MN-03 | Research Phase 번호 잔존(내부) |
| MN-04 | PerformanceDashboard orphan page |
| MN-05 | Alert boot CTA causes 빈 경우 |
| MN-06 | Glossary stock-radar 앵커 id 미부여 |

---

## 플랫폼 검증

| 항목 | 결과 |
|------|------|
| PWA | ✅ generateSW · update toast |
| 다크모드 | ✅ 기본 다크 · contrast RC2 CSS |
| 모바일 | △ 320px Summary △ — docs 참고 |
| 데스크탑 | ✅ sidebar + hub |
| 404 | ✅ NotFoundPage |
| 로딩 | ✅ market-analysis loading state |

---

## 중복 점검

| 중복 | 판단 |
|------|------|
| Hub Top3 vs Watchlist Top10 | 의도적 요약/상세 |
| Hub vs `/cycle` | 사용자/운영자 분리 필요 |
| Research Stock Radar vs Hub 상세 | OK |
| Launch pages vs Glossary | OK |

---

## 콘솔 에러

- 프로덕션 빌드: **chunk size warning only** (non-blocking)
- 런타임 0 목표: **수동 smoke test** 권장 (로그인·Supabase optional)

---

## V1 출시 체크 (요약)

- [x] 6코어 네비
- [x] 첫 방문 온보딩
- [x] Launch pages (intro/start/faq/about/feedback)
- [x] Explainability (Stock·Watchlist·Alert·Pattern·Regime)
- [x] Journey CTA (이번 스프린트)
- [ ] 실시간 시세 (V1 scope out)
- [ ] E2E automated tests (없음)

---

## 관련 문서

- [YDS_RECOMMENDATION_JOURNEY_AUDIT.md](./YDS_RECOMMENDATION_JOURNEY_AUDIT.md)
- [YDS_MOBILE_UX_IMPROVEMENTS.md](./YDS_MOBILE_UX_IMPROVEMENTS.md)
- [YDS_V1_LAUNCH_CHECKLIST.md](./YDS_V1_LAUNCH_CHECKLIST.md)
- [STOCK_RADAR_SCORING.md](./STOCK_RADAR_SCORING.md)

---

## 권장 다음 단계

1. 320px 실기기 smoke (iPhone SE)
2. `MN-01` AI 리포트 종목 링크
3. Phase 26.1 실시간 POC (별도 스프린트)
