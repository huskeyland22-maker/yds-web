# YDS Daily Bottom Buy — Train/Test Validation

Generated: 2026-09-21T11:46:33.670Z

> Research only. Thresholds frozen from Train; Test never retuned. Not financial advice. Panic untouched.

## Method

- Split: chronological **70% Train / 30% Test** (no shuffle)
- Dip definition: Confirmed 10d swing low + ≥5% from 60d peak + rebound (≥50% of drop or +3%) within 20d
- Train troughs must finish rebound confirmation before split (no leakage)
- Frozen ceilings = median of Train trough indicators (pooled across 10 ETFs)
- V1 reference bands (not locked): {"rsi":{"lo":32,"hi":41},"stochK":{"lo":9,"hi":25},"bbPctB":{"lo":-0.1,"hi":0.12},"ma20DevPct":{"lo":-6.1,"hi":-3.2}}

## Frozen thresholds (Train only)

| Indicator | Frozen ceiling | V1 ref band |
|-----------|----------------|-------------|
| RSI | ≤ 36 | 32–41 |
| Stoch %K | ≤ 15.4 | 9–25 |
| BB %B | ≤ 0.01 | -0.1–0.12 |
| MA20 dev % | ≤ -4.2 | -6.1–-3.2 |

Source: TRAIN-only median of confirmed trough indicators (time-split; no test retune)

## Train pooled trough distribution

- RSI p25/med/p75: 31.9 / 36.0 / 40.5 (n=290)
- Stoch p25/med/p75: 9.0 / 15.4 / 25.6
- BB%B p25/med/p75: -0.10 / 0.01 / 0.10
- MA20dev p25/med/p75: -5.9 / -4.2 / -3.2

## 1. Train results (pooled)

- **RSI**: n=425 near=40.7% d5=0.9% d10=1.6% d20=2.6% MAE≥5%=35.8% ~5.7/yr
- **Stoch**: n=516 near=37.2% d5=0.7% d10=1.2% d20=2.0% MAE≥5%=33.3% ~6.9/yr
- **BB**: n=568 near=40.1% d5=0.7% d10=2.0% d20=3.0% MAE≥5%=28.2% ~7.6/yr
- **MA20**: n=428 near=38.3% d5=0.6% d10=1.8% d20=2.5% MAE≥5%=37.4% ~5.8/yr
- **2+**: n=539 near=41.0% d5=0.6% d10=1.7% d20=2.5% MAE≥5%=32.6% ~7.3/yr
- **3+**: n=400 near=41.0% d5=0.5% d10=1.7% d20=2.8% MAE≥5%=36.0% ~5.4/yr
- **4**: n=212 near=37.3% d5=1.1% d10=2.0% d20=3.5% MAE≥5%=36.3% ~2.9/yr

## 2. Test results (pooled, frozen thresholds)

- **RSI**: n=169 near=39.6% d5=0.7% d10=2.1% d20=2.4% MAE≥5%=37.3% ~5.3/yr
- **Stoch**: n=221 near=45.7% d5=1.0% d10=1.9% d20=2.6% MAE≥5%=29.9% ~6.9/yr
- **BB**: n=232 near=41.4% d5=1.0% d10=1.8% d20=3.3% MAE≥5%=26.7% ~7.3/yr
- **MA20**: n=186 near=47.3% d5=0.9% d10=2.1% d20=4.4% MAE≥5%=36.6% ~5.8/yr
- **2+**: n=219 near=41.1% d5=0.4% d10=1.6% d20=1.7% MAE≥5%=35.2% ~6.9/yr
- **3+**: n=163 near=44.2% d5=1.1% d10=2.0% d20=3.5% MAE≥5%=31.9% ~5.1/yr
- **4**: n=102 near=50.0% d5=2.3% d10=3.6% d20=5.2% MAE≥5%=25.5% ~3.2/yr

## 3. 3+ vs 4 conditions (Test focus)

| Metric | 3+ | 4 |
|--------|----|---|
| n | 163 | 102 |
| near±5d | 44.2% | 50.0% |
| d5 / d10 / d20 med | 1.1 / 2.0 / 3.5 | 2.3 / 3.6 / 5.2 |
| MAE≥5% | 31.9% | 25.5% |
| signals/yr | 5.1 | 3.2 |

### A. 관심 후보 (watch)
- **초안:** 조건 **2개 이상** 동시 충족 (탐색 천장: RSI≤36, Stoch%K≤15.4, BB%B≤0.01, MA20dev≤-4.2%)
- Test: n=219 near=41.1% d5=0.4% d10=1.6% d20=1.7% MAE≥5%=35.2% ~6.9/yr — 빈도 확보용. 단독 지표보다 낫지만 저점 적중은 제한적.

### B. 1차 매수 후보
- **초안:** 조건 **3개 이상** 동시 충족
- Test: n=163 near=44.2% d5=1.1% d10=2.0% d20=3.5% MAE≥5%=31.9% ~5.1/yr — 일상 저점 *검토* 후보로 Test에서도 동작 흔적이 있음 (바닥 예측 아님).

### C. 강한 일상 저점 후보
- **초안:** 조건 **4개 모두** 충족
- Test: n=102 near=50.0% d5=2.3% d10=3.6% d20=5.2% MAE≥5%=25.5% ~3.2/yr — 빈도 관점에서 검토 가능. 성과/적중은 3+ 대비 비슷하거나 소폭 우위.

**비중/분할매수 스케줄은 이번 단계에서 정하지 않는다.**
Train 참고 — 2+: n=539 near=41.0% d5=0.6% d10=1.7% d20=2.5% MAE≥5%=32.6% ~7.3/yr; 3+: n=400 near=41.0% d5=0.5% d10=1.7% d20=2.8% MAE≥5%=36.0% ~5.4/yr; 4: n=212 near=37.3% d5=1.1% d10=2.0% d20=3.5% MAE≥5%=36.3% ~2.9/yr

## 4. ETF differences (Test, 3+)

| ETF | Split date | Train/Test events | 3+ n | near% | d20 med | MAE≥5% | /yr |
|-----|------------|-------------------|------|-------|---------|--------|-----|
| SMH | 2023-06-30 | 35/18 | 19 | 57.9 | 6.8 | 47.4 | 5.9 |
| XLK | 2023-06-30 | 26/15 | 18 | 50.0 | 2.9 | 38.9 | 5.6 |
| GRID | 2023-06-30 | 33/15 | 14 | 35.7 | 1.6 | 28.6 | 4.4 |
| URA | 2023-06-30 | 37/20 | 25 | 28.0 | 1.3 | 40.0 | 7.8 |
| BOTZ | 2023-09-14 | 21/14 | 21 | 47.6 | 4.4 | 38.1 | 7.0 |
| CIBR | 2023-06-30 | 26/17 | 11 | 54.5 | 3.2 | 27.3 | 3.4 |
| ITA | 2023-06-30 | 30/16 | 10 | 60.0 | 5.9 | 30.0 | 3.1 |
| XLF | 2023-06-30 | 29/10 | 14 | 57.1 | 3.3 | 14.3 | 4.4 |
| XLY | 2023-06-30 | 25/13 | 16 | 50.0 | 6.3 | 31.3 | 5.0 |
| XLV | 2023-06-30 | 31/4 | 15 | 13.3 | 0.4 | 6.7 | 4.7 |

### Weaker Test names

- **SMH**: MAE≥5% 47.4%
- **URA**: near 28.0%
- **XLV**: near 13.3%; d20 med 0.4%

## Train→Test decay flags

- Train→Test 급격한 붕괴(near -10pp 또는 d20 -2pp)는 pooled 기준으로 두드러지지 않음.

## 5. Minimal rules worth carrying forward (not finalized)

임계값 숫자 자체는 아직 제품 확정 금지. Train 동결값과 V1 참조 밴드 범위만 유지.
관심=2+, 1차 검토=3+, 강한 후보=4 — 매수 비중 미정.
신호는 분할매수 *검토 구간*이지 바닥 확정이 아님. MAE≥5%가 Test에서도 상당수.
URA/BOTZ 등 변동성 테마는 공통 규칙 적용 시 별도 주의 라벨 후보.
Panic Index와 결합하지 않음.

## What NOT to finalize

- Exact numeric cutoffs as shipped product constants
- Position sizing / DCA schedule
- Daily Bottom Buy UI body
- Any claim that 3+/4 = the bottom
