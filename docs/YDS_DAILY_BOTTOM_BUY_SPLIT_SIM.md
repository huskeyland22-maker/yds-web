# YDS Daily Bottom Buy — Split-Buy Simulation (Test)

Generated: 2026-09-21T11:51:41.882Z

> Research only. Frozen Train thresholds. Schemes compared as-is (not optimized). Not financial advice. Panic untouched.

## Method

- Thresholds: Train/Test freeze (RSI≤36, Stoch≤15.4, BB%B≤0.01, MA20≤-4.2)
- Episode: Rising-edge count≥3 opens episode; optional single count=4 add-on within 20d or until count<2; no overlap
- Evaluation window: Test segment only (~30% chronological)
- NAV return from episode open (cash + shares); WAIT4 measured from 4-fill

## Episode totals (Test, all ETFs)

- Entry episodes: **144**
- Reached 4 (add-on): **62** (43.1%)
- 3-only / no 4 before cool-down: **82** (56.9%)

## Scheme comparison (pooled Test)

| Scheme | nPerf | d5 med | d10 med | d20 med | d20 mean | MAE20 med | deeper≥5% after 4 |
|--------|-------|--------|---------|---------|----------|-----------|-------------------|
| A 50/50 | 139 | 0.6 | 1.6 | 2.5 | 2.9 | 2.0 | 18.8% |
| B 40/60 | 139 | 0.5 | 1.4 | 2.1 | 2.8 | 1.8 | 18.8% |
| C 30/70 | 139 | 0.4 | 1.2 | 1.8 | 2.5 | 1.7 | 18.8% |
| 100% at 3-signal | 139 | 0.9 | 2.1 | 3.9 | 3.9 | 2.6 | 18.8% |
| 100% wait for 4 only | 62 | 2.9 | 4.0 | 6.4 | 6.0 | 1.4 | 21.0% |

### Path splits (scheme A, illustrative)

- 3-only path n≈77, d20 med≈2.1%
- 3→4 path n≈62, d20 med≈4.7%
- WAIT4 skipped (never reached 4): **77** episodes

## ETF detail (scheme A 50/50)

| ETF | Episodes | →4 | no4 | d20 A | MAE20 A | d20 ALL3 | d20 WAIT4 |
|-----|----------|----|----|-------|---------|----------|-----------|
| SMH * | 16 | 4 | 12 | 3.1 | 2.3 | 6.3 | 16.6 |
| XLK | 17 | 6 | 11 | 1.6 | 2.0 | 2.6 | 7.0 |
| GRID * | 12 | 8 | 4 | 4.0 | 2.4 | 4.3 | 5.6 |
| URA * | 21 | 7 | 14 | 0.8 | 2.6 | 1.5 | 1.2 |
| BOTZ * | 18 | 11 | 7 | 2.7 | 3.7 | 4.4 | 7.1 |
| CIBR | 10 | 7 | 3 | 3.1 | 0.4 | 4.6 | 9.3 |
| ITA | 11 | 3 | 8 | 3.8 | 0.1 | 7.6 | 6.1 |
| XLF | 12 | 4 | 8 | 1.8 | 1.1 | 3.3 | 5.6 |
| XLY | 14 | 9 | 5 | 5.4 | 2.0 | 7.3 | 4.3 |
| XLV * | 13 | 3 | 10 | -0.2 | 1.3 | -0.4 | 3.8 |

\* focus names from prior weak common-rule set

## Focus ETF notes

### SMH
- Episodes 16: reached4 4, no4 12 (75.0%)
- A d20 med 3.1% / MAE 2.3% vs ALL3 6.3% / WAIT4 16.6%
- After-4 MAE≥5%: 0.0% of 4-fills

### GRID
- Episodes 12: reached4 8, no4 4 (33.3%)
- A d20 med 4.0% / MAE 2.4% vs ALL3 4.3% / WAIT4 5.6%
- After-4 MAE≥5%: 25.0% of 4-fills

### URA
- Episodes 21: reached4 7, no4 14 (66.7%)
- A d20 med 0.8% / MAE 2.6% vs ALL3 1.5% / WAIT4 1.2%
- After-4 MAE≥5%: 42.9% of 4-fills

### BOTZ
- Episodes 18: reached4 11, no4 7 (38.9%)
- A d20 med 2.7% / MAE 3.7% vs ALL3 4.4% / WAIT4 7.1%
- After-4 MAE≥5%: 18.2% of 4-fills

### XLV
- Episodes 13: reached4 3, no4 10 (76.9%)
- A d20 med -0.2% / MAE 1.3% vs ALL3 -0.4% / WAIT4 3.8%
- After-4 MAE≥5%: 0.0% of 4-fills

## Conclusions

### 1. 3→4 분할매수 구조의 장점 / 한계

**장점**
- 동일 조정 에피소드로 묶어 일별 중복 매수를 막음 (Test 에피소드 144건).
- 4까지 가는 경우(43.1%)와 3에서 끝나는 경우(56.9%)를 분리 기록 가능.
- WAIT4는 4 미도달 77건을 통째로 건너뛰므로, 3에서 시작하는 구조가 “기회를 아예 놓치지 않는” 실용 축이 됨.
- A/B/C의 Test d20 중앙값은 ALL3(3.9%) 대비 2.5 / 2.1 / 1.8% — 최고수익 추적이 아니라 조기 올인 완화 관점의 비교.

**한계**
- 4 이후에도 추가 하락(MAE≥5%)이 pooled 약 18.8% — “4 = 바닥”이 아님.
- 3-only 경로도 상당수(82건). 잔여 현금을 안 쓰면 기회비용, 억지로 쓰면 규칙이 달라짐(이번 시뮬은 잔여 현금 유지).
- ETF별 편차 큼 (특히 focus 세트). 공통 비중을 만능으로 보기 어려움.

### 2. 각 비중안 결과 (Test pooled, 최적화 금지·비교만)

| 안 | 비중 | d20 med | d20 mean | MAE20 med |
|----|------|---------|----------|-----------|
| A | 50/50 | 2.5 | 2.9 | 2.0 |
| B | 40/60 | 2.1 | 2.8 | 1.8 |
| C | 30/70 | 1.8 | 2.5 | 1.7 |
| ALL3 | 100@3 | 3.9 | 3.9 | 2.6 |
| WAIT4 | 100@4 | 6.4 | 6.0 | 1.4 |

비중 차이는 존재하지만, 이번 Test에서 A/B/C 간 격차는 크지 않을 수 있음. **어느 하나도 최종 확정하지 않음.**

### 3. 3개에서 반등해 4개가 안 오는 경우

- Test 전체: **82 / 144** (56.9%).
- 이 경로의 scheme A d20 중앙값(3-only 행): ≈2.1%.
- WAIT4 기준이면 이 구간은 진입 자체가 없음(skipped 77).

### 4. 4개 이후 추가 하락

- 4-fill 이후 20일 MAE≥5%: pooled ≈**18.8%** (A 집계).
- 4-fill 이후 MAE 중앙값 ≈1.2%.
- 강한 후보여도 분할·여유 현금 관점이 필요함을 시사.

### 5. 제품으로 가져갈 수 있는 최소 구조 (비중 미확정)

1. 신호 계층: 2+=관심 / 3+=1차 후보 / 4=강한 후보 (기존 유지)
2. 실행: **에피소드 단위** 3→(선택)4 분할 — 일별 중복 매수 금지
3. 비중: A/B/C는 후보군으로만 유지, Test 재튜닝·수익 극대화 금지
4. 반드시 UI/문구에: 4 미도달 비율, 4 이후 추가 하락 비율 고지
5. Panic Index와 결합하지 않음 / UI 본체는 별도 단계

