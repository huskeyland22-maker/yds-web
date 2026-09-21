# YDS Daily Bottom Buy — Past Data Validation (V1)

Generated: 2026-09-21T11:37:24.875Z

> Research only. Not a product rule. Not financial advice. Panic Index is untouched.

## 1. Data source

- **Source:** Yahoo Finance chart API v8 (daily OHLCV), cached under scripts/.cache/dbb-*-daily-ohlcv.json
- **Requested start:** 2016-01-01 (uses full available history if listing is shorter)
- **Indicators:** RSI(14 Wilder), Stochastic(14,3,3), Bollinger(20,2) %B, 20-day MA deviation %

## 2. 「일상 저점」 definition (fixed, not return-tuned)

```
Confirmed 10d swing low + ≥5% from 60d peak + rebound (≥50% of drop or +3%) within 20d
swingHalfWindow=10
lookbackPeakDays=60
minDrawdownPct=5
reboundWindow=20
reboundFracOfDrop=0.5
reboundMinAbsPct=3
```

## 3. ETF data periods

| ETF | Theme | Start | End | Bars | Adjustment events |
|-----|-------|-------|-----|------|-------------------|
| SMH | 반도체 / AI 칩 | 2016-01-04 | 2026-09-18 | 2693 | 53 |
| XLK | 기술 / 빅테크 / AI 플랫폼 | 2016-01-04 | 2026-09-18 | 2693 | 41 |
| GRID | 전력망 / 스마트그리드 / AI 인프라 | 2016-01-04 | 2026-09-18 | 2693 | 48 |
| URA | 우라늄 / 원전 | 2016-01-04 | 2026-09-18 | 2693 | 57 |
| BOTZ | 로봇 / 자동화 / Physical AI | 2016-09-13 | 2026-09-18 | 2518 | 35 |
| CIBR | 사이버보안 | 2016-01-04 | 2026-09-18 | 2693 | 43 |
| ITA | 방산 / 항공우주 | 2016-01-04 | 2026-09-18 | 2693 | 46 |
| XLF | 금융 | 2016-01-04 | 2026-09-18 | 2693 | 39 |
| XLY | 경기소비재 | 2016-01-04 | 2026-09-18 | 2693 | 38 |
| XLV | 헬스케어 | 2016-01-04 | 2026-09-18 | 2693 | 35 |

## 4. Shared exploratory thresholds (NOT final)

Derived as **median of confirmed trough-day indicator values** across all 10 ETFs.
Not optimized for forward returns.

| Indicator | Candidate ceiling (signal if ≤) |
|-----------|----------------------------------|
| RSI(14) | 36.2 |
| Stochastic %K | 14.7 |
| Bollinger %B | 0.01 |
| 20d MA deviation % | -4.3 |

Source: median of confirmed daily-bottom trough indicator values

## 5. Pooled trough indicator distributions

- **RSI:** p25=31.9 / med=36.2 / p75=40.7 (n=432)
- **Stoch %K:** p25=8.6 / med=14.7 / p75=24.6 (n=432)
- **BB %B:** p25=-0.10 / med=0.01 / p75=0.12 (n=432)
- **MA20 dev %:** p25=-6.1 / med=-4.3 / p75=-3.2 (n=432)
- **Drawdown at trough:** p25=6.8 / med=8.7 / p75=12.9 (n=435)

## 6. Per-ETF results (shared exploratory thresholds)

### SMH — 반도체 / AI 칩

- Period: 2016-01-04 → 2026-09-18
- Adjustment events: **53** (~5.0/yr)
- Trough RSI: p25=34.2 / med=36.4 / p75=41.0 (n=53)
- Trough StochK: p25=10.6 / med=15.8 / p75=22.6 (n=53)
- Trough BB%B: p25=-0.09 / med=0.02 / p75=0.11 (n=53)
- Trough MA20dev: p25=-8.2 / med=-5.2 / p75=-3.5 (n=53)
- Signal freq (rising-edge): RSI=57, Stoch=70, BB=81, MA20=75
- Combo rising-edge: 2+=80 (~7.5/yr), 3+=65 (~6.1/yr), 4=34 (~3.2/yr)
- Occupancy: days with 3+=5.05%, 4=1.68%
- After 3+ signal: d5 med=0.9%, d10 med=3.0%, d20 med=5.5%, MAE20 med=3.1%
- Near trough (±5d): 50.8% | Deeper drop MAE≥5%: 41.5% | MAE≥8%: 21.5%
- Usefulness: Exploratory usefulness (not optimized): near-trough%, median +20d, adverse drop. Best single≈stoch; 3+ combo n=65, near=50.77%, d20med=5.52%.

### XLK — 기술 / 빅테크 / AI 플랫폼

- Period: 2016-01-04 → 2026-09-18
- Adjustment events: **41** (~3.9/yr)
- Trough RSI: p25=32.3 / med=35.8 / p75=40.7 (n=40)
- Trough StochK: p25=11.2 / med=15.0 / p75=26.0 (n=40)
- Trough BB%B: p25=-0.13 / med=0.02 / p75=0.15 (n=40)
- Trough MA20dev: p25=-6.2 / med=-4.8 / p75=-3.0 (n=40)
- Signal freq (rising-edge): RSI=65, Stoch=57, BB=69, MA20=65
- Combo rising-edge: 2+=74 (~7.0/yr), 3+=58 (~5.5/yr), 4=28 (~2.6/yr)
- Occupancy: days with 3+=3.96%, 4=1.46%
- After 3+ signal: d5 med=0.9%, d10 med=2.1%, d20 med=4.4%, MAE20 med=1.8%
- Near trough (±5d): 48.3% | Deeper drop MAE≥5%: 31.0% | MAE≥8%: 13.8%
- Usefulness: Exploratory usefulness (not optimized): near-trough%, median +20d, adverse drop. Best single≈rsi; 3+ combo n=58, near=48.28%, d20med=4.37%.

### GRID — 전력망 / 스마트그리드 / AI 인프라

- Period: 2016-01-04 → 2026-09-18
- Adjustment events: **48** (~4.5/yr)
- Trough RSI: p25=34.2 / med=38.3 / p75=41.5 (n=48)
- Trough StochK: p25=8.0 / med=14.6 / p75=25.5 (n=48)
- Trough BB%B: p25=-0.10 / med=0.01 / p75=0.11 (n=48)
- Trough MA20dev: p25=-4.9 / med=-3.9 / p75=-2.8 (n=48)
- Signal freq (rising-edge): RSI=51, Stoch=78, BB=82, MA20=51
- Combo rising-edge: 2+=67 (~6.3/yr), 3+=47 (~4.4/yr), 4=28 (~2.6/yr)
- Occupancy: days with 3+=4.71%, 4=1.98%
- After 3+ signal: d5 med=1.1%, d10 med=2.2%, d20 med=3.0%, MAE20 med=2.5%
- Near trough (±5d): 40.4% | Deeper drop MAE≥5%: 29.8% | MAE≥8%: 10.6%
- Usefulness: Exploratory usefulness (not optimized): near-trough%, median +20d, adverse drop. Best single≈ma20; 3+ combo n=47, near=40.43%, d20med=2.95%.

### URA — 우라늄 / 원전

- Period: 2016-01-04 → 2026-09-18
- Adjustment events: **57** (~5.4/yr)
- Trough RSI: p25=32.5 / med=37.9 / p75=45.3 (n=56)
- Trough StochK: p25=7.8 / med=15.6 / p75=25.0 (n=56)
- Trough BB%B: p25=-0.05 / med=0.10 / p75=0.20 (n=56)
- Trough MA20dev: p25=-7.3 / med=-5.2 / p75=-3.5 (n=56)
- Signal freq (rising-edge): RSI=75, Stoch=92, BB=86, MA20=104
- Combo rising-edge: 2+=101 (~9.5/yr), 3+=76 (~7.2/yr), 4=49 (~4.6/yr)
- Occupancy: days with 3+=8.08%, 4=2.88%
- After 3+ signal: d5 med=0.2%, d10 med=1.0%, d20 med=1.0%, MAE20 med=4.8%
- Near trough (±5d): 27.6% | Deeper drop MAE≥5%: 47.4% | MAE≥8%: 25.0%
- Usefulness: Exploratory usefulness (not optimized): near-trough%, median +20d, adverse drop. Best single≈bb; 3+ combo n=76, near=27.63%, d20med=0.96%.

### BOTZ — 로봇 / 자동화 / Physical AI

- Period: 2016-09-13 → 2026-09-18
- Adjustment events: **35** (~3.5/yr)
- Trough RSI: p25=31.6 / med=36.8 / p75=42.9 (n=35)
- Trough StochK: p25=7.4 / med=12.8 / p75=23.9 (n=35)
- Trough BB%B: p25=-0.06 / med=0.01 / p75=0.15 (n=35)
- Trough MA20dev: p25=-6.0 / med=-4.3 / p75=-3.0 (n=35)
- Signal freq (rising-edge): RSI=66, Stoch=74, BB=82, MA20=66
- Combo rising-edge: 2+=76 (~7.7/yr), 3+=67 (~6.8/yr), 4=45 (~4.5/yr)
- Occupancy: days with 3+=8.04%, 4=2.92%
- After 3+ signal: d5 med=-1.0%, d10 med=0.4%, d20 med=1.9%, MAE20 med=3.8%
- Near trough (±5d): 31.3% | Deeper drop MAE≥5%: 41.8% | MAE≥8%: 31.3%
- Usefulness: Exploratory usefulness (not optimized): near-trough%, median +20d, adverse drop. Best single≈stoch; 3+ combo n=67, near=31.34%, d20med=1.95%.

### CIBR — 사이버보안

- Period: 2016-01-04 → 2026-09-18
- Adjustment events: **43** (~4.0/yr)
- Trough RSI: p25=32.1 / med=36.8 / p75=41.2 (n=43)
- Trough StochK: p25=7.7 / med=14.5 / p75=28.1 (n=43)
- Trough BB%B: p25=-0.07 / med=0.01 / p75=0.13 (n=43)
- Trough MA20dev: p25=-5.5 / med=-4.2 / p75=-3.5 (n=43)
- Signal freq (rising-edge): RSI=56, Stoch=73, BB=67, MA20=55
- Combo rising-edge: 2+=70 (~6.6/yr), 3+=53 (~5.0/yr), 4=27 (~2.5/yr)
- Occupancy: days with 3+=4.53%, 4=1.8%
- After 3+ signal: d5 med=2.6%, d10 med=3.1%, d20 med=3.1%, MAE20 med=3.1%
- Near trough (±5d): 43.4% | Deeper drop MAE≥5%: 32.1% | MAE≥8%: 22.6%
- Usefulness: Exploratory usefulness (not optimized): near-trough%, median +20d, adverse drop. Best single≈bb; 3+ combo n=53, near=43.4%, d20med=3.07%.

### ITA — 방산 / 항공우주

- Period: 2016-01-04 → 2026-09-18
- Adjustment events: **46** (~4.3/yr)
- Trough RSI: p25=31.9 / med=35.5 / p75=40.3 (n=46)
- Trough StochK: p25=8.5 / med=15.2 / p75=23.8 (n=46)
- Trough BB%B: p25=-0.11 / med=0.01 / p75=0.08 (n=46)
- Trough MA20dev: p25=-5.4 / med=-4.0 / p75=-3.0 (n=46)
- Signal freq (rising-edge): RSI=48, Stoch=62, BB=76, MA20=43
- Combo rising-edge: 2+=62 (~5.8/yr), 3+=38 (~3.6/yr), 4=24 (~2.3/yr)
- Occupancy: days with 3+=4.23%, 4=1.5%
- After 3+ signal: d5 med=1.4%, d10 med=2.8%, d20 med=3.1%, MAE20 med=1.1%
- Near trough (±5d): 57.9% | Deeper drop MAE≥5%: 26.3% | MAE≥8%: 15.8%
- Usefulness: Exploratory usefulness (not optimized): near-trough%, median +20d, adverse drop. Best single≈rsi; 3+ combo n=38, near=57.89%, d20med=3.1%.

### XLF — 금융

- Period: 2016-01-04 → 2026-09-18
- Adjustment events: **39** (~3.7/yr)
- Trough RSI: p25=29.6 / med=33.7 / p75=36.4 (n=39)
- Trough StochK: p25=7.9 / med=12.5 / p75=24.2 (n=39)
- Trough BB%B: p25=-0.15 / med=-0.05 / p75=0.01 (n=39)
- Trough MA20dev: p25=-5.9 / med=-4.1 / p75=-3.5 (n=39)
- Signal freq (rising-edge): RSI=61, Stoch=71, BB=85, MA20=47
- Combo rising-edge: 2+=72 (~6.8/yr), 3+=52 (~4.9/yr), 4=26 (~2.5/yr)
- Occupancy: days with 3+=4.67%, 4=1.76%
- After 3+ signal: d5 med=1.3%, d10 med=2.0%, d20 med=3.9%, MAE20 med=2.3%
- Near trough (±5d): 53.9% | Deeper drop MAE≥5%: 23.1% | MAE≥8%: 9.6%
- Usefulness: Exploratory usefulness (not optimized): near-trough%, median +20d, adverse drop. Best single≈ma20; 3+ combo n=52, near=53.85%, d20med=3.86%.

### XLY — 경기소비재

- Period: 2016-01-04 → 2026-09-18
- Adjustment events: **38** (~3.6/yr)
- Trough RSI: p25=30.5 / med=35.9 / p75=40.3 (n=37)
- Trough StochK: p25=8.8 / med=14.4 / p75=30.1 (n=37)
- Trough BB%B: p25=-0.08 / med=0.01 / p75=0.08 (n=37)
- Trough MA20dev: p25=-5.8 / med=-4.8 / p75=-3.4 (n=37)
- Signal freq (rising-edge): RSI=62, Stoch=70, BB=83, MA20=58
- Combo rising-edge: 2+=73 (~6.9/yr), 3+=54 (~5.1/yr), 4=29 (~2.7/yr)
- Occupancy: days with 3+=4.9%, 4=1.94%
- After 3+ signal: d5 med=0.3%, d10 med=2.3%, d20 med=3.0%, MAE20 med=3.1%
- Near trough (±5d): 48.1% | Deeper drop MAE≥5%: 38.9% | MAE≥8%: 22.2%
- Usefulness: Exploratory usefulness (not optimized): near-trough%, median +20d, adverse drop. Best single≈ma20; 3+ combo n=54, near=48.15%, d20med=2.96%.

### XLV — 헬스케어

- Period: 2016-01-04 → 2026-09-18
- Adjustment events: **35** (~3.3/yr)
- Trough RSI: p25=29.9 / med=33.3 / p75=39.8 (n=35)
- Trough StochK: p25=8.6 / med=16.3 / p75=23.1 (n=35)
- Trough BB%B: p25=-0.12 / med=-0.01 / p75=0.12 (n=35)
- Trough MA20dev: p25=-4.3 / med=-3.4 / p75=-2.7 (n=35)
- Signal freq (rising-edge): RSI=68, Stoch=67, BB=89, MA20=29
- Combo rising-edge: 2+=75 (~7.1/yr), 3+=49 (~4.6/yr), 4=15 (~1.4/yr)
- Occupancy: days with 3+=3.63%, 4=1.01%
- After 3+ signal: d5 med=0.9%, d10 med=1.4%, d20 med=2.5%, MAE20 med=2.0%
- Near trough (±5d): 36.7% | Deeper drop MAE≥5%: 16.3% | MAE≥8%: 6.1%
- Usefulness: Exploratory usefulness (not optimized): near-trough%, median +20d, adverse drop. Best single≈rsi; 3+ combo n=49, near=36.73%, d20med=2.54%.

## 7. Indicator-level summary (shared thresholds, pooled across ETFs)

### RSI
- Rising-edge signals (all ETFs, complete +20d): **609**
- Near trough ±5d: 41.7% | False (not near): 58.3%
- Forward med: d5=0.9% / d10=1.9% / d20=2.6%
- MAE20 med=3.0% | MAE≥5% rate=35.6%

### Stochastic
- Rising-edge signals (all ETFs, complete +20d): **714**
- Near trough ±5d: 39.5% | False (not near): 60.5%
- Forward med: d5=0.7% / d10=1.5% / d20=2.3%
- MAE20 med=2.9% | MAE≥5% rate=32.6%

### Bollinger %B
- Rising-edge signals (all ETFs, complete +20d): **800**
- Near trough ±5d: 40.5% | False (not near): 59.5%
- Forward med: d5=0.7% / d10=1.9% / d20=2.9%
- MAE20 med=2.6% | MAE≥5% rate=27.8%

### MA20 deviation
- Rising-edge signals (all ETFs, complete +20d): **593**
- Near trough ±5d: 41.0% | False (not near): 59.0%
- Forward med: d5=0.7% / d10=2.0% / d20=2.9%
- MAE20 med=3.5% | MAE≥5% rate=37.6%

## 8. Combo summary

- **2+ conditions**: n=750, near=40.7%, d20med=2.3%, MAE20med=3.2%, MAE≥5%=33.7%
- **3+ conditions**: n=559, near=42.8%, d20med=3.1%, MAE20med=2.9%, MAE≥5%=34.2%
- **4 conditions**: n=305, near=42.0%, d20med=3.7%, MAE20med=2.5%, MAE≥5%=33.4%

## 9. Common threshold candidates

**Exploratory common ranges (from trough distributions — NOT locked):**
- RSI(14): trough p25–p75 ≈ **31.9–40.7**; exploratory ceiling (median) **≤ 36.2**. Note: classic RSI&lt;30 is near p25 — many confirmed dips trough near mid-30s.
- Stochastic %K: p25–p75 ≈ **8.6–24.6**; exploratory ceiling **≤ 14.7**.
- Bollinger %B: p25–p75 ≈ **-0.10–0.12**; median ≈ **0.01** ⇒ troughs typically sit **at/below the lower band**. Product rule may use %B≤0 ~ ≤0.15 band rather than a single 0.01 cut.
- 20d MA deviation: p25–p75 ≈ **-6.1%–-3.2%**; exploratory ceiling **≤ -4.3%**.

**Combo probe (shared exploratory ceilings):** 3+ n=559, near-trough 42.8%, d20 median 3.1%, MAE≥5% 34.2%.
4-condition: n=305, near-trough 42.0%, d20 median 3.7%.
Single indicators alone are noisy (~40% near-trough); 3+/4 conditions improve median +20d slightly but do **not** make signals equal bottoms.

## 10. ETFs where common rules look weak / different

- **URA**: low near-trough 27.6%; weak d20 med 1.0%; high MAE≥5% 47.4%
- **BOTZ**: low near-trough 31.3%; high MAE≥5% 41.8%

## 11. What to finalize next / what NOT to finalize

**Can finalize now:**
- V1 ETF universe (10 names)
- Indicator set (RSI/Stoch/BB/MA20dev) for further validation
- Documented 「일상 저점」 event definition used in this study
- Separation from Panic Index

**Must NOT finalize yet:**
- Exact RSI / Stoch / BB / MA20 numeric cutoffs as product rules
- 0–1 / 2 / 3 / 4 combo → wait/watch/buy1/buy2 mapping
- Position sizing / split-buy schedule
- Daily Bottom Buy UI body
- Any claim that signals equal the exact bottom or guarantee forward profit

## 12. Data gaps

- Intraday timing not modeled (signals use daily close).
- No volume / breadth / sector relative strength yet.
- Survivorship: ETF list fixed ex-ante for V1; listing start dates differ (esp. newer theme ETFs).
- Rebound requirement in dip definition selects successful recoveries — indicator ranges at troughs are conditional on rebound occurring (documented selection effect).
- Yahoo OHLCV quality / splits assumed correct via chart API.
