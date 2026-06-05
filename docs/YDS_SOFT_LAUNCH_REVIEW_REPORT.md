# YDS Soft Launch Review Report

> 점검일: 2026-06-03 · 관점: **첫 방문 사용자** · 범위: V1 6코어 (신규 기능·엔진·실시간 연동 없음)

## 요약

7단계 사용자 시나리오를 따라 Hub → Watchlist → Alert → AI → 성과 → Research 흐름을 검증했습니다.  
V1 Polish + Journey UX + Final Launch 정리 이후 **이해도·다음 행동**은 RC2 수준, **데이터 신뢰(실시간)** 는 문서·배지로 명시 완료.

| 검증 축 | 평가 |
|---------|------|
| 이해도 | △→○ (Summary V2 · Why · Journey Strip) |
| 혼란도 | △ (Hub vs `/cycle` — 배너·탭명으로 완화) |
| 클릭 수 (Hub→행동) | 2~4클릭 (목표 ≤5) |
| 스크롤 (모바일 Hub) | △ 320px — metrics 2열, Summary 접기 가능 |

---

## 시나리오별 결과

### 1. 처음 방문

- **경로:** `/` → 온보딩/intro 또는 Drawer → 시장분석
- **관찰:** Launch pages(intro/start/faq) 존재, 404 처리됨
- **질문 답:** “YDS가 무엇인지” — intro/faq로 가능

### 2. 현재 시장 상태 이해

- **경로:** `/market-analysis` → Dashboard Summary V2
- **관찰:** 국면·시장위치·PRI·추천 행동 5초 요약, Why 버튼
- **질문 답:** “현재 시장 상태를 이해했는가” — **예 (조건부)** — 전략 기반 데이터임을 `YdsV1DataScopeNotice`로 명시

### 3. 추천 종목 확인

- **경로:** Hub Top3 → Watchlist Top10 / Stock Radar 카드
- **관찰:** 점수·등급·Why(Phase 26 explain) 표시
- **질문 답:** “추천 행동·왜 추천” — **예** — glossary `#stock-radar` 링크

### 4. Watchlist 이동

- **경로:** Hub CTA / Journey Strip → `/watchlist#watchlist-{id}`
- **관찰:** 상태 설명·Alert·추천 기록(`?q=`) 링크
- **질문 답:** “다음 행동” — **예** — Journey Strip 4단계

### 5. Alert 확인

- **경로:** `/alert-center`
- **관찰:** causes·기간 필터·Watchlist CTA, boot alert에 stockId
- **질문 답:** 알림 맥락 이해 — **예**

### 6. AI 리포트 확인

- **경로:** `/ai-daily-report`
- **관찰:** 섹션 A~F, E종목 → Watchlist 딥링크, Journey Strip
- **질문 답:** 일일 내러티브 이해 — **예**

### 7. 성과센터 확인

- **경로:** `/performance-center` → 추천 이력 `?q=`
- **관찰:** Paper Trading 기준, 종목명 클릭 시 필터된 추천 기록
- **질문 답:** 추천 대비 성과 추적 — **예 (Paper 기준)**

---

## 사용자 관점 문제 Top 20

| # | 문제 | 심각도 | 우선순위 |
|---|------|--------|----------|
| 1 | 실시간 시세 기대 vs 전략 기반 점수 | 혼란 | **상** → MJ-01 배지로 완화 |
| 2 | Hub vs `/cycle` Panic Desk 중복 인지 | 혼란 | **상** → MJ-02 배너·탭명 |
| 3 | 추천 기록에서 특정 종목 찾기 어려움 | UX | **상** → MJ-03 `?q=` 필터 |
| 4 | 320px Summary metrics 가독성 | UX | **중** |
| 5 | AI 리포트 E섹션 종목 클릭 불가 | UX | **중** → MN-01 해결 |
| 6 | Research Phase 번호 내부 노출 | 신뢰 | **하** |
| 7 | Supabase 미연결 시 빈 cycle 히스토리 | 데이터 | **중** (Critical 아님) |
| 8 | Stock Radar 점수와 사용자 체감 괴리 | 설명 | **중** → glossary |
| 9 | Watchlist 10종목 스크롤 길이 | UX | **하** |
| 10 | Alert boot 시 causes 빈 경우 | 신뢰 | **중** → MN-05 해결 |
| 11 | 성과 vs 추천 기록 페이지 이중성 | 혼란 | **중** → Journey·링크 |
| 12 | 다크모드 외 라이트 미지원 | UX | **하** (V1 out) |
| 13 | PWA 업데이트 토스트 첫 인지 | UX | **하** |
| 14 | Glossary stock-radar 앵커 | UX | **하** → MN-06 해결 |
| 15 | `/performance-dashboard` 레거시 URL | 라우팅 | **하** → redirect |
| 16 | Hub Top3 vs Watchlist Top10 차이 설명 | 이해 | **중** → 의도적 요약 |
| 17 | Entry Radar vs Stock Radar 용어 | 혼란 | **중** → glossary |
| 18 | 모바일 Drawer 6코어 진입 깊이 | 클릭 | **하** |
| 19 | AI 리포트 “GPT 미사용” 톤 | 신뢰 | **하** (명시적) |
| 20 | Research ↔ Hub Stock Radar 중복 | 혼란 | **하** (역할 분리 OK) |

---

## 개선 우선순위

### 상 (출시 전 처리 — Final Launch Sprint)

| 항목 | 조치 | 상태 |
|------|------|------|
| MJ-01 실시간 기대 | `YdsV1DataScopeNotice` on Summary | ✅ |
| MJ-02 Hub/cycle 중복 | 탭명 + `YdsCycleScopeBanner` | ✅ |
| MJ-03 추천 기록 필터 | `?q=` + Watchlist/성과 링크 | ✅ |

### 중 (V1.1 또는 출시 직후)

- 320px 실기기 smoke · metrics 타이포
- Supabase cycle 동기화 가이드 (운영)
- Entry/Stock Radar glossary 통합 문단

### 하 (백로그)

- Research Phase 표기 정리
- 라이트 테마
- E2E 자동화

---

## 4대 질문 종합

| 질문 | 답 |
|------|-----|
| 현재 시장 상태를 이해했는가 | ✅ Summary + Why (전략 기반 명시) |
| 추천 행동을 이해했는가 | ✅ 추천 행동 블록 + Journey |
| 왜 추천되었는지 이해했는가 | ✅ Stock Radar explain + glossary |
| 다음 행동을 알 수 있는가 | ✅ Strip + Watchlist/Alert/성과 CTA |

---

## 관련 문서

- [YDS_V1_RELEASE_REPORT.md](./YDS_V1_RELEASE_REPORT.md)
- [YDS_V1_LAUNCH_REPORT.md](./YDS_V1_LAUNCH_REPORT.md)
- [YDS_RECOMMENDATION_JOURNEY_AUDIT.md](./YDS_RECOMMENDATION_JOURNEY_AUDIT.md)
