# YDS V1 Release Candidate — 배포 전 최종 점검 보고서

**기준 커밋:** (배포 시 `git log -1` 확인)  
**범위:** 기능 추가 없음 · 정리 · 통합 · 신뢰도 UI

---

## 1. 메뉴 (P0) ✅

| # | 메뉴 | 경로 |
|---|------|------|
| 1 | 시장분석 | `/market-analysis` |
| 2 | Watchlist | `/watchlist` |
| 3 | 알림 | `/alert-center` |
| 4 | AI 리포트 | `/ai-daily-report` |
| 5 | 성과 | `/performance-center` |
| 6 | Research | `/lab` |

**2차 라우트 (네비 없음, URL 유지):** `/cycle`, `/value-chain`, `/trading-log`, `/recommendation-history`, `/glossary`

---

## 2. 시장분석 Hub (P1) ✅

**Hub 단일 화면 (`MarketAnalysisHubTop`):**

- 현재 단계
- 시장 위치 (구 YDS 점수)
- 시장 해석 (한줄 + 근거 3개)
- 추천 행동 (+ 왜?)
- 권장 비중
- 추천 섹터 Top3
- 추천 종목 Top5

**이동 완료:**

| 기능 | 위치 |
|------|------|
| Paper Trading · Trading Journal | 성과센터 → 트레이딩 도구 |
| Conviction · Portfolio Builder | Research → 포트폴리오 분석 |

---

## 3. Research (P2) ✅

| 카테고리 | 내용 |
|----------|------|
| 백테스트 | 상단 KPI·차트 (Phase 번호 미노출) |
| 포트폴리오 분석 | Conviction · Portfolio |
| 전조 엔진 | Phase 1~4, 15~18 (섹션명만, Phase N UI 제거) |
| 패턴 분석 | Phase 5~10 |
| 타임머신 | Phase 11, 20 |
| 검증 리포트 | Phase 13, 21, 22 + 확장 검증 패널 |
| 검증 리포트 (확장) | 민감도 · 이벤트 데이터셋 |

---

## 4. 용어 통일 (P4) — 부분 완료

| 구 용어 | V1 표기 |
|--------|---------|
| YDS | 시장 위치 |
| PRI-A | 조기경보 |
| PRI-B | 충격감지 |
| Regime | 시장 국면 |
| Pattern | 위험 패턴 |

**적용:** Hub · Research 섹션 제목 · 용어 페이지 `/glossary` · `utils/ydsTerminology.js`  
**잔여:** Lab 내부 일부 차트 라벨 · 레거시 컴포넌트 — RC 이후 2차 스윕 권장

---

## 5. Polish & Trust ✅

| 항목 | 상태 |
|------|------|
| 5초 이해 Hub 레이아웃 | ✅ 카드 스택 |
| 용어 사전 페이지 | ✅ `/glossary` |
| Why? 버튼 | ✅ 시장 위치 · 추천 행동 |
| 신뢰도 배지 | ✅ Hub 카드 |
| 근거 3개 | ✅ 시장 해석 |
| V1 RC 배지 | ✅ 사이드바 · Hub · 성과 |

---

## 6. V1 체크리스트

| 항목 | 수동 확인 |
|------|-----------|
| 시장분석 Hub | ☐ |
| Watchlist | ☐ |
| 알림 | ☐ |
| AI 리포트 | ☐ |
| 성과 (+ 트레이딩 도구) | ☐ |
| Research 카테고리 | ☐ |
| 모바일 320~430px | ☐ |
| 데스크탑 | ☐ |
| PWA / 다크모드 | ☐ |
| 콘솔 에러 0 | ☐ |

**빌드:** `npm run build` 통과 필요 (배포 파이프라인)

---

## 7. 성능 · dead route (P6)

| 항목 | 조치 |
|------|------|
| 시장분석 중복 패널 | Hub로 제거 → 렌더 감소 |
| 성과센터 market report | 1회 `useMemo` |
| `/performance-dashboard` | → `/performance-center` 리다이렉트 유지 |
| `PerformanceDashboardPage.jsx` | 미라우트 orphan (삭제 후보, RC 이후) |
| `/cycle` 등 2차 | 네비 제외, URL 유지 |

---

## 8. 중복 정리 (D01~D15)

| ID | RC 조치 |
|----|---------|
| D01 | 시장 사이클 → Hub 탭 |
| D02~D03 | Lab Radar/Trading UI 제거 → CORE/성과/Research |
| D04~D05 | Watchlist/Alert 전용 페이지 유지 |
| D07 | Lab Performance Dashboard 제거 |
| D10 | Trading Log 메인 제외 (URL 유지) |

---

## 9. 배포 권장 순서

1. `npm run build` 로컬 확인  
2. `main` 푸시 → Vercel 프로덕션  
3. 모바일 4 breakpoint 스모크  
4. 체크리스트 ☐ → ✅ 기록 후 **V1.0.0** 태그 검토

---

*엔진(Precursor/YDS core) 로직 미변경 · presentation·routing·Lab IA only.*
