# Stock Radar 점수 산식 (V1 · Phase 26)

> **V1:** 전략 기반 · 실시간 시세 미연동 · YDS 패닉 엔진 미수정  
> **구현:** `vite-project/src/trading-zone/ydsPrecursorEnginePhase26.js`  
> **설명 레이어:** `vite-project/src/trading-zone/ydsStockRadarExplain.js`

## 종합 점수

```
total = clamp(
  0.40 × marketFit +
  0.25 × sectorStrength +
  0.20 × technicalTrend +
  0.15 × volume
, 42, 98)
```

## 하위 점수 (각 42~98 clamp)

| 항목 | 산식 요약 |
|------|-----------|
| **시장 적합도** | `52 + YDS단계 + 국면 + Radar경보 + YDS≥60 보너스 + PRI-A/B 조정 + tier×2 + noise(id)` |
| **섹터 강도** | `섹터점수×0.65 + (6−순위)×5 + tier×2` |
| **기술적 추세** | `Trading Zone stage 점수표 + 패턴유사도≥60시 +4 + noise` |
| **거래량 점수** | `62 + PRI-B 구간 + stage(trend/pullback) + noise` (실거래량 아님) |

## 데이터 소스

- Phase 12 Dashboard: YDS, PRI-A/B, 국면
- Phase 6: Radar 경보, 패턴 유사도
- Phase 25 Sector Radar: 섹터 점수·순위, 활성 섹터 필터
- `STOCK_RADAR_UNIVERSE`: 정적 종목 목록 (동적 필터만)
- `tacticalTradingZoneData`: 종목별 `trend` / `pullback` 등

## 신뢰도 (V1)

- UI 표기: **전략 기반** — 보유 지표·정적 유니버스만 사용
- **실시간 데이터 기반** — Phase 26.1 예정 (`docs/STOCK_RADAR_PHASE_26_1_REALTIME.md`)

## UI

- 종목 카드: Breakdown 4항목, 추천 이유, 강점 2·약점 1, 경고, 산식 요약
- Hub: Top 3 카드 + 「상세」 접기
- Research → Stock Radar: Top 10 전체 카드

## 예시 (검증 데이터셋 기준)

**브로드컴** — 종합 81 · marketFit 82 · sector 90 · tech 72 · volume 74 · 눌림목  
**실리콘투** — 종합 86 · marketFit 79 · sector 90 · tech 98 · volume 84 · 추세

실제 운영 스냅샷에 따라 수치는 변합니다.
