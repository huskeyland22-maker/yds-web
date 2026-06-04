# YDS V1 Polish Sprint — 출시 전 점검

## 완료 (코드)

| Part | 내용 |
|------|------|
| 1 Stock Radar V2 | Breakdown·추천 이유·경고·강약점·전략 기반 신뢰도 · `ydsStockRadarExplain.js` |
| 2 Watchlist V2 | 상태별 「왜」·우선순위 힌트 · `ydsWatchlistExplain.js` |
| 3 Alert V2 | 알림 `causes[]` · 히스토리 7/30/90일 필터 |
| 4 Pattern | Top1 패턴 「왜」·지표 기여 · `ydsPatternExplain.js` |
| 5 Regime | Hub 상세 접기 내 국면 설명 · `ydsRegimeExplain.js` |
| 6 AI Report | 섹션 제목 사용자 친화 (현재 시장·위험·기회·행동) |
| 7 Dashboard | Hub 5초 뷰 유지 · 상세 `details` 접기 |
| 8 Confidence | `ConfidenceExplainPanel` · 4요소 비중 |
| 9 Research | Stock Radar 카테고리 · Phase 번호 UI 최소화(카테고리명) |
| 문서 | `STOCK_RADAR_SCORING.md` · `STOCK_RADAR_PHASE_26_1_REALTIME.md` |

## 수동 점검 (PART 10)

### 플랫폼

- [ ] 모바일: 시장분석 첫 방문 · Watchlist 카드 스크롤
- [ ] 데스크탑: Hub 상세 접기 · 사이드바 출시 안내
- [ ] PWA: 오프라인 Hub 로딩 문구
- [ ] 다크모드: Stock 카드·Alert causes 대비

### 중복

- [ ] 시장분석 Hub vs `/cycle` Panic Desk 데이터 중복 인지
- [ ] Research Stock Radar vs Hub Top3 중복 (의도된 상세/요약)
- [ ] 성과·Paper vs Watchlist paperLinked

### 콘솔

- [ ] 프로덕션 빌드 후 주요 경로 콘솔 error 0 목표

### 금지 사항 준수

- [x] 신규 점수 엔진 없음 (Explain 레이어만)
- [x] 실시간 API 연동 없음
- [x] YDS 패닉 엔진 미수정

## 관련

- `docs/YDS_V1_LAUNCH_CHECKLIST.md`
- `docs/YDS_V1_RC_REPORT.md`
