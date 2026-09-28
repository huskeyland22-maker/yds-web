# 개별 종목 Daily Bottom Buy — 전략 명세

상태: 설계 문서. 구현 지시가 아니다.
작성 기준일: 2026-09-28.
이 문서는 production 코드, UI, API, DB, threshold를 바꾸지 않는다.
기존 ETF Daily Bottom Buy도 바꾸지 않는다.

연구 구간은 2016-01-04 ~ 2026-09-25이다.
Train/Test는 종목별 시간순 앞 70% / 뒤 30%이다.
분할일은 종목마다 다르며 2023-07-06 ~ 2025-05-01에 있다.

## 1. 목적

개별 종목 Daily Bottom Buy는 바닥 시각을 맞히는 시스템이 아니다.

좋은 개별 종목이 의미 있는 조정을 받았을 때, 과매도·조정 상태를 포착해서 분할매수를 검토할 후보를 만드는 것이 목적이다.

신호의 역할은 다음 둘뿐이다.

- 3/4: 핵심 조정 진입 후보
- ATR: 그 후보의 변동성과 추가 하락 위험을 보여주는 보조 정보

나머지 연구 지표는 신호 계산에 넣지 않는다.

## 2. 핵심 철학

이 시스템은 저점을 예측하는 시스템이 아니다.

3/4는 조정이 충분히 진행된 후보 구간을 탐지한다.
3/4는 저점 확정이 아니다.
신호 발생 후 추가 하락은 정상적으로 발생할 수 있다.
Test에서 3/4 당일 이후 MAE median은 7.59%이고, 저점까지 걸린 기간의 median은 18거래일이다.

ATR은 해당 신호의 위험도를 보조적으로 보여준다.
ATR이 높다는 표시는 매수 금지가 아니다.

따라서 3/4 발생 직후에도 추가 하락 가능성을 전제로 사용한다.
수익률이 높았다는 이유만으로 조건을 더하지 않는다.
자동 주문은 없다.

## 3. 3/4 계산법

네 조건은 연구에 고정된 값을 그대로 쓴다. 재탐색하지 않는다.

| 조건 | 기준 |
|---|---|
| RSI(14) | `<= 36` |
| Stochastic %K | `<= 15.4` |
| Bollinger %B | `<= 0.01` |
| MA20 gap | `<= -4.2%` |

점수는 위 네 조건 중 그날 충족된 개수다. 0~4.

연구 결과의 Day 0은, 전일 점수가 3 미만이었다가 당일 점수가 3 이상이 된 첫날이다.
같은 종목에서 구간이 겹치는 재진입은 연구 episode 정의에서 제외했다.
화면이 보여줄 상태는 당일 점수다. 20거래일 창이나 점수 2 미만 해제는 연구용 episode 경계이며, 이번 명세의 매수 규칙이 아니다.

MA20은 20일 단순이동평균이다.
MA20 gap은 종가의 그 평균 대비 괴리율이다.

## 4. ATR 역할

ATR은 신호 점수에 더하지 않는다.
값은 Wilder ATR(14)을 당일 종가로 나눈 백분율이다.
구간 경계는 고정이다. 3%는 중간, 4%는 높음에 넣는다.

| ATR% | 표시 |
|---|---|
| `< 3` | 낮은 변동성 |
| `3` 이상 `4` 미만 | 중간 변동성 |
| `>= 4` | 높은 변동성 |

의미는 한 문장이다.
3/4 발생 이후 추가 하락 변동성이 상대적으로 클 가능성이 있는 상태인지를 알려 준다.

ATR `>= 4`를 매수 거부로 정의하지 않는다.
ATR로 2차 매수, 비중 조절, 진입 지연, 자동 주문을 만들지 않는다.

## 5. Signal 정의

| 점수 | 상태 | 의미 |
|---|---|---|
| 0~1 | WAIT | 조정 후보가 아님 |
| 2 | INTEREST | 조건이 일부 겹친 관찰 상태 |
| 3 | FIRST BUY CANDIDATE | 조정이 충분히 진행되어 첫 매수 검토를 할 수 있는 상태. 저점 확정이 아님 |
| 4 | STRONG LOW CANDIDATE | 단기 과매도 조건이 더 강하게 겹친 상태. 저점 확정이 아님 |

화면용 짧은 이름은 8절을 따른다.
3점은 1차 매수 검토 후보이고, 4점은 강한 과매도 후보다.
둘 다 체결 지시가 아니다.

## 6. 사용하지 않는 지표와 이유

아래 항목은 연구에 사용했다. 최종 신호 계산에는 넣지 않는다.

| 지표 | 빼는 이유 |
|---|---|
| SPY 120일 상대강도 | 첫 −10% 대기 표본에서 D+60 방향이 Train과 Test에서 뒤집혔다. Train은 상대강도 0 미만의 D+60 median이 6.20으로 0 이상 4.29보다 높고, Test는 0 이상이 7.45로 0 미만 1.10보다 높다. 낙폭·MA200 gap과도 정보가 겹친다. |
| QQQ 120일 상대강도 | SPY 120일 상대강도와 Spearman 0.96으로 거의 같은 정보다. |
| MA200 추세 (이격, 기울기, MA50 배열) | MA200 gap과 SPY 상대강도의 Spearman은 −10% 단계에서 0.88이다. 3/4 표본의 UP/DOWN D+60은 Train 5.44 / 6.23, Test 6.66 / 7.32로 점수에 더할 독립 정보가 확인되지 않았다. |
| RSI 전일 대비 상승 | 3/4 이후 30일 안 발생률이 Train/Test 모두 100%라 미발생 비교군이 없다. |
| RSI 3일 개선 | Test 발생률 99.72%, 미발생 2건. 후행 확인에 가깝다. |
| Stochastic %K의 %D 상향 교차 | Test 발생률 99.86%, 미발생 1건. |
| Higher Low | Test 발생률 98.03%, 미발생 14건. 비교군이 작다. |
| 5일 가격 개선 | Test 발생률 98.87%, 미발생 8건. |
| MA20 상승 (`MA20(t) > MA20(t-3)`, Day +1~+30 최초) | 같은 episode에서 MA20 상승일 이후 MAE와 −10% tail이 Train/Test 모두 커졌다. Test MAE median 6.14 → 7.92, 추가 −10% 24.91% → 36.82%. 2020-02-20~2020-04-30에는 MAE가 17.41 → 7.34로 줄고, 2022-01-03~2022-10-14에는 10.79 → 14.93으로 커져 국면에 따라 방향이 바뀐다. 판정 D. 후행성이 있고 매수 신호로 쓰지 않는다. |
| 거래량 1.5배 확인 | Test 발생률 91.70%. 신호일 D+60 median 6.20은 같은 episode의 Day 0 D+60 6.13과 같다. 핵심 점수에 넣지 않는다. |
| RV20 | ATR%와 Spearman 0.92로 중복이다. ATR 구간을 유지하고 RV20은 점수에 넣지 않는다. |
| 252일 낙폭 | 120일 낙폭과 −10% 단계에서 Spearman 0.68이다. 3/4를 대체할 독립 진입 규칙으로 확인되지 않았다. |
| 추가 −10/−15/−20%까지 대기, ATR 기반 2차 분할 | 첫 −10% 종가 대기의 Test MAE median은 8.53, D+60은 4.41이다. 3/4 Day 0은 7.59 / 6.27이다. 3/4를 대체하지 않는다. 판정 B. 50/50으로 −10%에 나머지를 넣는 경우 Test MAE 개선 3.79%p는 미체결 현금 때문이고, D+60은 1.79%p 낮아지며 +10% 도달은 18.29%p 줄었다. 판정 C. |

점수에 남는 계산은 3절의 네 조건과, 점수 밖 표시인 4절의 ATR뿐이다.

## 7. 기존 ETF DBB와의 차이

기존 ETF Daily Bottom Buy는 현재 production 그대로 둔다.
경로 `/daily-bottom-buy`, 화면 `DailyBottomBuyPage`, 기존 snapshot API와 episode 저장을 이 명세로 수정하지 않는다.
ETF에 고정된 threshold도 수정하지 않는다.

개별 종목 시스템은 이번 연구 결과를 기준으로 따로 설계한다.
대상은 6절 이전의 48개 종목이다. ETF와 벤치마크(SPY, QQQ 및 연구 제외 ETF)는 대상이 아니다.

코드가 나중에 생길 경우, 기존 production 이름과 겹치지 않는 namespace만 제안한다. 이번 문서에서 파일은 만들지 않는다.

- 경로 예: `/equity-daily-bottom-buy`
- 모듈 예: `equityDailyBottomBuy`
- API 예: `/api/equity-daily-bottom-buy`
- 저장 키 예: `equity_dbb_`

기존 `/daily-bottom-buy`와 `dailyBottomBuy` 계열 이름에 개별 종목 로직을 붙이지 않는다.

## 8. UI에 표시할 정보

화면은 이번 작업에서 만들지 않는다.
나중에 READ-ONLY 화면을 만든다면 아래만 보여 주는 것을 기준으로 한다.

- 종목명
- 현재 가격
- 3/4 Score (0~4)
- 조건별 상태: RSI, Stoch, BB, MA20. 충족 여부와 값
- ATR%
- ATR Risk: 낮은 변동성 / 중간 변동성 / 높은 변동성
- Signal 상태: WAIT / INTEREST / FIRST BUY / STRONG LOW

상태 옆 설명은 다음 세 문장으로 고정한다.

- 3/4 = 조정 매수 후보
- 저점 확정 신호 아님
- ATR = 추가 변동성 위험 참고

FIRST BUY는 점수 3, STRONG LOW는 점수 4의 화면 이름이다.
5절의 FIRST BUY CANDIDATE, STRONG LOW CANDIDATE와 같은 상태다.

상대강도, MA200, 회복 플래그, 거래량 배율, 낙폭 대기 가격은 이 화면에 신호처럼 보여 주지 않는다.

## 9. 매수 단계 정의

자금 비중은 확정하지 않는다.

| 항목 | 명세 |
|---|---|
| 점수 3 | 1차 매수 검토 후보 |
| 점수 4 | 강한 과매도 후보 |
| 자동매수 | 없음 |
| 자동주문 | 없음 |
| 2차 진입 | 정의하지 않음 |
| ATR 기반 비중 조절 | 정의하지 않음 |

ETF 연구에서 비교했던 50/50, 40/60, 30/70 비중은 개별 종목 규칙으로 가져오지 않는다.

## 10. 검증 결과 요약

숫자의 출처는 12절의 연구 결과 파일이다.
비교 기준은 3/4가 처음 된 날의 종가이고, 이후 최대 60거래일이다.
MAE는 그 종가 대비 이후 저가의 하락률이다.
+10%는 이후 종가가 그 종가 대비 +10%에 닿은 비율이다.

3/4 표본은 Train 1431, Test 711이다.

| | Train | Test |
|---|---:|---:|
| n | 1431 | 711 |
| MAE median | 8.08% | 7.59% |
| D+20 median | 2.38% | 2.56% |
| D+60 median | 5.71% | 6.27% |
| +5% 도달 | 80.64% | 76.65% |
| +10% 도달 | 59.82% | 57.95% |
| 종가 −10% 도달 | 41.86% | 38.26% |
| 저점까지 median | 15일 | 18일 |
| D+60이 있는 건수 | 1431 | 659 |

ATR은 Day 0 값으로 나누었고, 3/4 이후 MAE 순서가 Train과 Test에서 같다.
높은 ATR은 MAE도 크고 D+60도 크다. 위험 표시로는 일관되고, 매수 조건으로는 쓰지 않는다.

Test, 3/4:

| ATR | n | MAE median | D+60 median | +10% | 종가 −10% |
|---|---:|---:|---:|---:|---:|
| `< 3` | 390 | 6.80% | 3.43% | 44.36% | 31.03% |
| `3~4` | 154 | 8.32% | 8.80% | 68.18% | 41.56% |
| `>= 4` | 167 | 10.47% | 13.46% | 80.24% | 52.10% |

Train MAE median은 같은 순서로 6.40%, 8.55%, 12.92%이다.

점수 4가 된 날의 별도 표본은 Train 619, Test 294이다.
Test MAE median 7.15%, D+60 median 8.01%, +10% 도달 62.24%이다.
4점은 과매도가 더 겹친 상태의 기록이지, 비중을 늘리는 규칙이 아니다.

채택하지 않은 축의 판정은 다음과 같다.

- 깊은 낙폭으로 3/4를 대체: 판정 B
- ATR 구간을 전제로 한 −10% 2차 분할: 판정 C
- MA20 상승을 위험 감소 표시로 쓰는 검증: 판정 D

## 11. 향후 개발 원칙

실제 개발에 들어갈 때의 순서다. 이번 문서는 그 개발을 시작하지 않는다.

1. 연구용 계산과 production 계산을 분리한다.
2. 기존 ETF Daily Bottom Buy production에는 영향을 주지 않는다.
3. 개별 종목은 별도 route, component, data model을 검토한다. 7절 namespace를 기준으로 한다.
4. 먼저 READ-ONLY 화면을 만든다.
5. 매매 기록과 매수 기능은 그 다음 검토다.
6. 자동 주문은 만들지 않는다.

## 12. 주의사항 / 한계

- 3/4 직후 MAE median 7.59%는, 신호 당일이 저점인 경우가 적다는 측정이다. 추가 하락을 예외로 두면 안 된다.
- Test에서 60일 안에 +10%에 닿은 비율은 57.95%이고, 종가가 −10%까지 닿은 비율은 38.26%이다.
- D+60은 Test 711건 중 659건만 창이 닫혀 있다. 표본 끝(2026-09-25)에 붙은 신호는 60일 수익률이 비어 있다.
- 검증 대상은 아래 48개 종목뿐이다. 새 종목 선정 규칙은 없다.
- 그룹 이름은 연구 목록 `EQUITY_CANDIDATES`의 `group`을 그대로 썼다. 문서 묶음은 그 그룹을 사용자 구분에 맞춘 것이다.

### 적용 범위

Technology / AI / Semiconductor

- AI / Big Tech: MSFT, GOOGL, AMZN, META, AAPL, ORCL
- Semiconductor: NVDA, AVGO, TSM, AMD, ASML, MU, AMAT, LRCX
- Cybersecurity: CRWD, PANW, ZS, FTNT
- Software: PLTR, CRM, ADBE

Financial

- JPM, V, MA, BRK.B

Healthcare

- LLY, JNJ, ABBV

Industrial

- GE, CAT, RTX, HON

Consumer

- TSLA, HD, COST, WMT

Energy / Power

- 연구 그룹명 Energy: XOM, CVX, COP, NEE, CEG, VST

Materials

- LIN, FCX, SHW

Real Estate / Infrastructure

- 연구 그룹명 REIT: PLD, EQIX, AMT

### 연구 결과 파일

- `scripts/.cache/yds-daily-bottom-buy-individual-stock-train-test-result.json`
- `scripts/.cache/yds-daily-bottom-buy-atr-split-entry-result.json`
- `scripts/.cache/yds-daily-bottom-buy-recovery-signals-result.json`
- `scripts/.cache/yds-daily-bottom-buy-ma20-recovery-risk-result.json`
- `scripts/.cache/yds-daily-bottom-buy-information-overlap-result.json`

조건과 ATR 구간의 코드 기준은 `scripts/lib/daily-bottom-split-buy-sim.mjs`의 `FROZEN_THRESHOLDS`, `scripts/lib/daily-bottom-buy-cross-asset-validation.mjs`의 `EQUITY_CANDIDATES`이다.
이 명세를 쓰면서 그 파일을 수정하지 않았다.
