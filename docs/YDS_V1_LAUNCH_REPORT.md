# YDS V1 Launch Report

> 점검일: 2026-06-03 · 스프린트: **V1 Final Launch** · 제약: 신규 기능·엔진·실시간·YDS 엔진 수정 없음

## 최종 판정

### **Launch Candidate (LC)**

V1 정식 출시 후보. Critical **0**, Major **0** 달성.  
6코어 기능·라우팅·설명력·Journey UX 기준 **배포 권장**.

| 판정 옵션 | 결과 |
|-----------|------|
| Launch Candidate | ✅ **선정** |
| Release Candidate | — (Major 잔존 시) |
| Not Ready | — |

---

## 6코어 체크리스트

| 코어 | PASS | 검증 항목 |
|------|------|-----------|
| 시장분석 | ✅ | Summary V2 · Data scope · Journey · Why · 빌드 |
| Watchlist | ✅ | Top10 · explain · hash 딥링크 · 추천기록 `?q=` |
| Alert | ✅ | causes · 기간 · boot stockId · CTA |
| AI 리포트 | ✅ | A~F · E→Watchlist · Journey Strip |
| 성과센터 | ✅ | Paper metrics · D/E · reco history 링크 |
| Research | ✅ | Stock Radar 카테고리 · 라우팅 |

---

## 플랫폼 검증

| 항목 | 결과 | 비고 |
|------|------|------|
| 콘솔 에러 | ✅ | prod build 통과 · chunk warning only |
| 빈 데이터 | △ | Supabase optional — empty state UI |
| 깨진 링크 | ✅ | glossary `#stock-radar` · redirects |
| 라우팅 | ✅ | 404 · legacy redirects |
| 모바일 | △ | 320px 문서화 · PASS with notes |
| PWA | ✅ | SW · update toast |
| 다크모드 | ✅ | 기본 다크 · contrast RC2 |

---

## Major Cleanup (PART 2) 결과

| ID | 원인 | 영향 | 해결 | 재검증 |
|----|------|------|------|--------|
| MJ-01 | Phase 26 전략 점수, live API 없음 | 실시간 기대 혼란 | `YdsV1DataScopeNotice` + glossary | Summary에서 문구 확인 ✅ |
| MJ-02 | Hub와 `/cycle` 동일 cycle 소스 | 중복·운영자 UI 혼란 | 탭 「시장 사이클 (상세)」 + `YdsCycleScopeBanner` | `/cycle` 상단 Hub 안내 ✅ |
| MJ-03 | 추천 이력 전체 목록만 | 종목별 추적 불편 | `RecommendationHistoryPage` `?q=` + 역링크 | Watchlist·성과→필터 ✅ |

**Major count: 0**

---

## Minor 잔여 (Non-blocking)

| ID | 상태 |
|----|------|
| MN-01 AI→Watchlist | ✅ 해결 |
| MN-02 320px metrics | △ 문서 |
| MN-03 Research Phase | 잔존(내부) |
| MN-04 PerformanceDashboard | ✅ redirect |
| MN-05 Alert boot causes | ✅ withCauses |
| MN-06 Glossary anchor | ✅ |

---

## 배포 권장

| 항목 | 권장 |
|------|------|
| `main` 배포 | **권장** — LC 기준 충족 |
| Soft launch | **즉시 가능** — 실시간 미포함 명시 |
| Hard launch | Phase 26.1 POC 후 검토 |

---

## 출시 후 우선순위

1. **320px 실기기 smoke** (iPhone SE)
2. **Supabase cycle 운영 연동** (데이터 풍부화, 엔진 변경 없음)
3. **Phase 26.1 실시간 POC** (별도 스프린트 — V1 scope out)
4. E2E smoke 자동화 (Playwright 등)

---

## 산출물 목록

| 문서 | 경로 |
|------|------|
| Soft Launch Review | [YDS_SOFT_LAUNCH_REVIEW_REPORT.md](./YDS_SOFT_LAUNCH_REVIEW_REPORT.md) |
| Release Report (Major 0) | [YDS_V1_RELEASE_REPORT.md](./YDS_V1_RELEASE_REPORT.md) |
| Launch Report (본 문서) | YDS_V1_LAUNCH_REPORT.md |

---

## 코드 변경 요약 (Final Launch Sprint)

- `YdsV1DataScopeNotice.jsx` — V1 데이터 범위
- `YdsCycleScopeBanner.jsx` — cycle → Hub 안내
- `MarketDashboardSummary.jsx` — scope notice embed
- `CurrentMarketAnalysisPage.jsx` — 탭명
- `App.jsx` — cycle banner
- `RecommendationHistoryPage.jsx` — `?q=` 필터·Watchlist 링크
- `AiDailyReportPage.jsx` — E섹션 Watchlist 링크·Journey
- `WatchlistCenterPage.jsx` · `PerformanceCenterPage.jsx` — reco `?q=` 링크
- `ydsAlertCenterEngine.js` — boot causes/stockId
- `ydsAiDailyReportEngine.js` — sectionE id/score
- `index.css` — scope·cycle·reco·AI link styles
