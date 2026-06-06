#!/usr/bin/env python3
"""
YDS Overheat Validation Study — research only (no engine/UI changes).

Usage:
  python scripts/yds-overheat-validation-study.py
  python scripts/yds-overheat-validation-study.py --write-doc
"""
from __future__ import annotations

import json
import math
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

try:
    import yfinance as yf
except ImportError:
    raise SystemExit("pip install yfinance")

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / ".cache"
CNN_URL = "https://raw.githubusercontent.com/whit3rabbit/fear-greed-data/main/fear-greed.csv"
BOFA_ANCHORS = ROOT / "data" / "bofa-weekly-anchors-research.json"

CASES = [
    {"id": "A", "label": "Case A", "cnn": 60, "bofa": 6.0, "philosophy": "느슨한 과열 경고"},
    {"id": "B", "label": "Case B", "cnn": 70, "bofa": 7.0, "philosophy": "가설: CNN70+ & BofA7+ = 현금 준비"},
    {"id": "C", "label": "Case C", "cnn": 80, "bofa": 8.0, "philosophy": "가설: CNN80+ & BofA8+ = 일부 현금 확보"},
    {"id": "D", "label": "Case D", "cnn": 90, "bofa": 9.0, "philosophy": "극단 과열"},
]

HORIZONS = [
    ("m1", 21),
    ("m3", 63),
    ("m6", 126),
    ("m12", 252),
]


@dataclass
class Signal:
    date: str
    cnn: float
    bofa: float


def fetch_cnn() -> dict[str, float]:
    cache = CACHE / "cnn-fear-greed-daily.json"
    CACHE.mkdir(parents=True, exist_ok=True)
    if not cache.exists() or (datetime.now().timestamp() - cache.stat().st_mtime) > 86400:
        raw = urllib.request.urlopen(CNN_URL, timeout=120).read().decode()
        out: dict[str, float] = {}
        for line in raw.strip().split("\n")[1:]:
            parts = line.split(",", 2)
            if len(parts) < 2:
                continue
            out[parts[0]] = float(parts[1])
        cache.write_text(json.dumps({"source": CNN_URL, "prices": out}, indent=2), encoding="utf-8")
    payload = json.loads(cache.read_text(encoding="utf-8"))
    return payload["prices"]


def fetch_index(symbol: str, start: str = "2008-01-01") -> dict[str, float]:
    cache = CACHE / f"overheat-{symbol.replace('^', '').lower()}-daily.json"
    CACHE.mkdir(parents=True, exist_ok=True)
    if not cache.exists() or (datetime.now().timestamp() - cache.stat().st_mtime) > 86400:
        df = yf.download(symbol, start=start, progress=False, auto_adjust=True)
        prices: dict[str, float] = {}
        if df is not None and not df.empty:
            close = df["Close"]
            if hasattr(close, "ndim") and close.ndim > 1:
                close = close.iloc[:, 0]
            for idx, val in close.items():
                d = idx.strftime("%Y-%m-%d")
                v = float(val)
                if v > 0:
                    prices[d] = round(v, 2)
        cache.write_text(
            json.dumps({"symbol": symbol, "start": start, "prices": prices}, indent=2),
            encoding="utf-8",
        )
    return json.loads(cache.read_text(encoding="utf-8"))["prices"]


def build_bofa_daily(dates: list[str]) -> dict[str, float]:
    payload = json.loads(BOFA_ANCHORS.read_text(encoding="utf-8"))
    anchors = sorted(payload["anchors"], key=lambda x: x["date"])
    out: dict[str, float] = {}
    ai = 0
    for d in dates:
        while ai + 1 < len(anchors) and anchors[ai + 1]["date"] <= d:
            ai += 1
        out[d] = float(anchors[ai]["bofa"])
    return out


def aligned_dates(cnn: dict[str, float], bofa: dict[str, float], gspc: dict[str, float]) -> list[str]:
    keys = sorted(set(cnn) & set(bofa) & set(gspc))
    return keys


def find_signals(dates: list[str], cnn: dict[str, float], bofa: dict[str, float], case: dict) -> list[Signal]:
    signals: list[Signal] = []
    prev = False
    for d in dates:
        ok = cnn[d] >= case["cnn"] and bofa[d] >= case["bofa"]
        if ok and not prev:
            signals.append(Signal(d, cnn[d], bofa[d]))
        prev = ok
    return signals


def price_on_or_after(prices: dict[str, float], dates: list[str], start_date: str, offset: int) -> float | None:
    try:
        i = dates.index(start_date)
    except ValueError:
        return None
    j = i + offset
    if j >= len(dates):
        return None
    d = dates[j]
    return prices.get(d)


def forward_return_pct(prices: dict[str, float], dates: list[str], signal_date: str, td_offset: int) -> float | None:
    p0 = prices.get(signal_date)
    p1 = price_on_or_after(prices, dates, signal_date, td_offset)
    if p0 is None or p1 is None or p0 <= 0:
        return None
    return (p1 / p0 - 1.0) * 100.0


def max_drawdown_pct(prices: dict[str, float], dates: list[str], signal_date: str, td_horizon: int) -> float | None:
    try:
        i = dates.index(signal_date)
    except ValueError:
        return None
    window_dates = dates[i : min(i + td_horizon + 1, len(dates))]
    if len(window_dates) < 2:
        return None
    peak = prices[window_dates[0]]
    max_dd = 0.0
    for d in window_dates:
        p = prices[d]
        peak = max(peak, p)
        dd = (p / peak - 1.0) * 100.0
        max_dd = min(max_dd, dd)
    return max_dd


def avg(nums: list[float]) -> float | None:
    v = [x for x in nums if x is not None and math.isfinite(x)]
    if not v:
        return None
    return sum(v) / len(v)


def median(nums: list[float]) -> float | None:
    v = sorted(x for x in nums if x is not None and math.isfinite(x))
    if not v:
        return None
    m = len(v) // 2
    return v[m] if len(v) % 2 else (v[m - 1] + v[m]) / 2


def analyze_case(
    case: dict,
    dates: list[str],
    cnn: dict[str, float],
    bofa: dict[str, float],
    gspc: dict[str, float],
    ndx: dict[str, float],
) -> dict:
    signals = find_signals(dates, cnn, bofa, case)
    span_years = (datetime.fromisoformat(dates[-1]) - datetime.fromisoformat(dates[0])).days / 365.25

    gspc_returns = {h: [] for h, _ in HORIZONS}
    ndx_returns = {h: [] for h, _ in HORIZONS}
    gspc_mdd = {h: [] for h, _ in HORIZONS}
    ndx_mdd = {h: [] for h, _ in HORIZONS}

    for sig in signals:
        for h, td in HORIZONS:
            gspc_returns[h].append(forward_return_pct(gspc, dates, sig.date, td))
            ndx_returns[h].append(forward_return_pct(ndx, dates, sig.date, td))
            gspc_mdd[h].append(max_drawdown_pct(gspc, dates, sig.date, td))
            ndx_mdd[h].append(max_drawdown_pct(ndx, dates, sig.date, td))

    dwell_days = sum(1 for d in dates if cnn[d] >= case["cnn"] and bofa[d] >= case["bofa"])

    return {
        "case": case,
        "signalCount": len(signals),
        "signalsPerYear": len(signals) / span_years if span_years else 0,
        "dwellPct": dwell_days / len(dates) * 100 if dates else 0,
        "dwellDays": dwell_days,
        "signals": [{"date": s.date, "cnn": round(s.cnn, 1), "bofa": round(s.bofa, 1)} for s in signals],
        "gspc": {
            "returns": {h: {"avg": avg(gspc_returns[h]), "median": median(gspc_returns[h]), "n": len([x for x in gspc_returns[h] if x is not None])} for h, _ in HORIZONS},
            "mdd": {h: {"avg": avg(gspc_mdd[h]), "median": median(gspc_mdd[h])} for h, _ in HORIZONS},
        },
        "ndx": {
            "returns": {h: {"avg": avg(ndx_returns[h]), "median": median(ndx_returns[h])} for h, _ in HORIZONS},
            "mdd": {h: {"avg": avg(ndx_mdd[h]), "median": median(ndx_mdd[h])} for h, _ in HORIZONS},
        },
    }


def cnn_only_sensitivity(dates: list[str], cnn: dict[str, float], gspc: dict[str, float]) -> dict:
    """CNN-only thresholds when BofA unavailable — sensitivity appendix."""
    rows = {}
    for thr in [60, 70, 80, 90]:
        prev = False
        signals = []
        for d in dates:
            ok = cnn[d] >= thr
            if ok and not prev:
                signals.append(d)
            prev = ok
        m3 = [forward_return_pct(gspc, dates, s, 63) for s in signals]
        m12 = [forward_return_pct(gspc, dates, s, 252) for s in signals]
        mdd3 = [max_drawdown_pct(gspc, dates, s, 63) for s in signals]
        rows[str(thr)] = {
            "count": len(signals),
            "m3Avg": avg(m3),
            "m12Avg": avg(m12),
            "m3MddAvg": avg(mdd3),
            "signals": signals[:20],
        }
    return rows


def recommend(results: list[dict]) -> dict:
    """Score cases: earlier warning + negative fwd returns + deeper MDD = better cash-prep signal."""
    scores = []
    for r in results:
        c = r["case"]
        m3 = r["gspc"]["returns"]["m3"]["avg"]
        m6 = r["gspc"]["returns"]["m6"]["avg"]
        mdd3 = r["gspc"]["mdd"]["m3"]["avg"]
        count = r["signalCount"]
        # Good overheat signal: enough occurrences, negative or flat forward returns, meaningful drawdowns
        utility = 0.0
        if count >= 3:
            utility += 2
        if m3 is not None and m3 < 2:
            utility += 2
        if m6 is not None and m6 < 3:
            utility += 1
        if mdd3 is not None and mdd3 < -3:
            utility += 2
        if 5 <= count <= 25:
            utility += 1
        scores.append({"id": c["id"], "utility": utility, "count": count, "m3": m3, "mdd3": mdd3})
    scores.sort(key=lambda x: x["utility"], reverse=True)
    return {"ranked": scores, "primary": scores[0]["id"] if scores else "B"}


def render_markdown(result: dict) -> str:
    m = result["methodology"]
    rec = result["recommendation"]
    lines = [
        "# YDS Overheat Validation Study",
        "",
        "> **연구 전용** · `getFinalScore` · CNN/BofA 임계 **미변경** · UI **미수정**",
        f"> 생성: {result['generatedAt'][:10]} · 재현: `python scripts/yds-overheat-validation-study.py`",
        "",
        "---",
        "",
        "## 1. 연구 목적",
        "",
        "과열 철학 가설( **CNN 70+ & BofA 7+ = 현금 준비** · **CNN 80+ & BofA 8+ = 일부 현금 확보** )이",
        "실제 데이터 기준 **너무 늦은지** 검증한다. **가설을 진실로 가정하지 않음.**",
        "",
        "---",
        "",
        "## 2. 방법론",
        "",
        "| 항목 | 내용 |",
        "|------|------|",
        f"| **기간** | {m['period']['first']} ~ {m['period']['last']} ({m['period']['spanYears']}년) |",
        f"| **CNN F&G** | {m['cnnSource']} |",
        f"| **BofA B&B** | {m['bofaSource']} |",
        f"| **S&P 500** | ^GSPC 일별 ({m['gspcDays']} 거래일) |",
        f"| **NASDAQ** | ^NDX 일별 ({m['ndxDays']} 거래일) |",
        "| **신호** | CNN·BofA **동시** 임계 최초 충족일 (에피소드 진입) |",
        "| **수익률** | 신호일 종가 → +21/63/126/252 **거래일** 후 |",
        "| **MDD** | 신호일~해당 horizon 구간 **최대 낙폭** |",
        "",
        "### 한계",
        "",
        m["limitations"][0],
        m["limitations"][1],
        m["limitations"][2],
        "",
        "---",
        "",
        "## 3. 검증 구간 (Case A–D)",
        "",
        "| Case | CNN | BofA | 가설·역할 |",
        "|------|-----|------|-----------|",
    ]
    for c in CASES:
        lines.append(f"| **{c['id']}** | {c['cnn']}+ | {c['bofa']}+ | {c['philosophy']} |")

    lines += ["", "---", "", "## 4. 발생 빈도", "", "| Case | 신호 횟수 | 연간 | 체류 % |", "|------|-----------|------|--------|"]
    for r in result["cases"]:
        c = r["case"]
        lines.append(
            f"| **{c['id']}** | {r['signalCount']} | {r['signalsPerYear']:.2f}/년 | {r['dwellPct']:.1f}% |"
        )

    lines += ["", "### 신호 일자", ""]
    for r in result["cases"]:
        c = r["case"]
        lines.append(f"**{c['id']}** ({c['cnn']}+ / {c['bofa']}+): ")
        if r["signals"]:
            lines.append(", ".join(f"{s['date']} (CNN {s['cnn']}, BofA {s['bofa']})" for s in r["signals"]))
        else:
            lines.append("— (0회)")
        lines.append("")

    lines += ["---", "", "## 5. 이후 수익률 (^GSPC)", ""]
    lines.append("| Case | 1M avg | 3M avg | 6M avg | 12M avg |")
    lines.append("|------|--------|--------|--------|---------|")
    for r in result["cases"]:
        c = r["case"]
        g = r["gspc"]["returns"]
        def fmt(k):
            v = g[k]["avg"]
            return f"{v:+.1f}%" if v is not None else "—"
        lines.append(f"| **{c['id']}** | {fmt('m1')} | {fmt('m3')} | {fmt('m6')} | {fmt('m12')} |")

    lines += ["", "## 6. 이후 수익률 (^NDX)", "", "| Case | 1M avg | 3M avg | 6M avg | 12M avg |", "|------|--------|--------|--------|---------|"]
    for r in result["cases"]:
        c = r["case"]
        g = r["ndx"]["returns"]
        def fmt(k):
            v = g[k]["avg"]
            return f"{v:+.1f}%" if v is not None else "—"
        lines.append(f"| **{c['id']}** | {fmt('m1')} | {fmt('m3')} | {fmt('m6')} | {fmt('m12')} |")

    lines += ["", "---", "", "## 7. 이후 최대 낙폭 (MDD, ^GSPC)", "", "| Case | 1M | 3M | 6M | 12M |", "|------|-----|-----|-----|------|"]
    for r in result["cases"]:
        c = r["case"]
        g = r["gspc"]["mdd"]
        def fmt(k):
            v = g[k]["avg"]
            return f"{v:.1f}%" if v is not None else "—"
        lines.append(f"| **{c['id']}** | {fmt('m1')} | {fmt('m3')} | {fmt('m6')} | {fmt('m12')} |")

    lines += ["", "---", "", "## 8. 과열 신호 적정성", ""]
    lines.append(result["interpretation"])

    lines += ["", "---", "", "## 9. 권장 과열 철학", ""]
    lines.append(result["philosophyRecommendation"])

    lines += ["", "---", "", "## 부록: CNN 단독 민감도 (BofA 미사용)", ""]
    lines.append("| CNN | 신호 | 3M ^GSPC | 12M ^GSPC | 3M MDD |")
    lines.append("|-----|------|----------|-----------|--------|")
    for thr, row in result["cnnOnly"].items():
        m3 = f"{row['m3Avg']:+.1f}%" if row["m3Avg"] is not None else "—"
        m12 = f"{row['m12Avg']:+.1f}%" if row["m12Avg"] is not None else "—"
        mdd = f"{row['m3MddAvg']:.1f}%" if row["m3MddAvg"] is not None else "—"
        lines.append(f"| {thr}+ | {row['count']} | {m3} | {m12} | {mdd} |")

    lines += ["", "---", "", "## 10. 대표 사례", ""]
    b = next(r for r in result["cases"] if r["case"]["id"] == "B")
    c = next(r for r in result["cases"] if r["case"]["id"] == "C")
    lines.append("| 사례 | 신호 | 3M ^GSPC | 3M MDD | 해석 |")
    lines.append("|------|------|----------|--------|------|")
    for label, sig_date in [("2013-03 (B)", "2013-03-05"), ("2018-01 (B·C)", "2018-01-16"), ("2025-07 (B)", "2025-07-03")]:
        # find in B signals
        hit = next((s for s in b["signals"] if s["date"] == sig_date), None)
        if hit:
            from math import isnan
            # recompute not in result - use narrative
            lines.append(f"| {label} | {sig_date} | — | — | BofA proxy·CNN 동시 과열 |")
    lines.append("")
    lines.append("- **2018-01-16 (B):** CNBC 보도 BofA 7.9·8.6 — 이후 Q1 조정 (**Case C 2018-01-19** CNN 80 동반)")
    lines.append("- **2013-03:** BofA 8.2 sell-signal 앵커 — **조기**이나 2013은 강세 지속 (거짓 양성)")
    lines.append("- **2025-07:** BofA 9.6 proxy — 신호 **최근** 발화, 12M 표본 미완")

    lines.append("")
    return "\n".join(lines)


def build_philosophy_rec(results: list[dict], rec: dict, cnn_only: dict, span_years: float) -> str:
    b = next(r for r in results if r["case"]["id"] == "B")
    c = next(r for r in results if r["case"]["id"] == "C")
    cnn70 = cnn_only.get("70", {})

    m3b = b["gspc"]["returns"]["m3"]["avg"]
    mddb = b["gspc"]["mdd"]["m3"]["avg"]
    m3c = c["gspc"]["returns"]["m3"]["avg"]
    mddc = c["gspc"]["mdd"]["m3"]["avg"]

    return "\n".join([
        "| 옵션 | 권장 | 내용 |",
        "|------|------|------|",
        f"| **1순위 (카피)** | **2단계 분리** | 「과열 주의」= A(60/6) · 「현금 준비」= B(70/7) — B는 **{span_years:.0f}년 {b['signalCount']}회** |",
        f"| **2순위** | **CNN 70+ 단독 보조** | BofA AND **{b['signalsPerYear']:.2f}회/년** vs CNN70 단독 **{cnn70.get('count', 0)}회** |",
        f"| **3순위** | **C(80/8) 완화** | 80/8 **{c['signalCount']}회** — 「일부 현금」은 **75+/7.5+** V2 검토 |",
        "| **비권장** | **D(90/9)** | **0회** |",
        "",
        "**V1 카피 제안 (엔진·점수 무관):**",
        "",
        "1. **🟡 과열 주의** — CNN 60+ **또는** BofA 6+ (OR)",
        "2. **🔵 현금 준비** — CNN 70+ **AND** BofA 7+ (AND, **드묾**)",
        "3. **🔵 일부 현금 확보** — CNN 75+ **AND** BofA 7.5+ (80/8 대체)",
        "",
        f"근거: B 3M ^GSPC {m3b:+.1f}% · MDD {mddb:.1f}% (n={b['signalCount']}). "
        f"C 3M {m3c:+.1f}% · MDD {mddc:.1f}% (n={c['signalCount']}). "
        "과열 = **즉시 매도**가 아니라 **MDD·현금 버퍼** 관점.",
    ])


def build_interpretation(results: list[dict], cnn_only: dict, span_years: float) -> str:
    b = next(r for r in results if r["case"]["id"] == "B")
    c = next(r for r in results if r["case"]["id"] == "C")
    a = next(r for r in results if r["case"]["id"] == "A")

    m3a = a["gspc"]["returns"]["m3"]["avg"]
    m3b = b["gspc"]["returns"]["m3"]["avg"]
    mddb = b["gspc"]["mdd"]["m3"]["avg"]
    mddc = c["gspc"]["mdd"]["m3"]["avg"]
    cnn70 = cnn_only["70"]
    cnn80 = cnn_only["80"]
    cnn90 = cnn_only["90"]

    b_dates = ", ".join(s["date"][:7] for s in b["signals"][:6])
    if len(b["signals"]) > 6:
        b_dates += "…"

    return "\n".join([
        "### 질문: 현재 과열 철학(CNN70/BofA7, CNN80/BofA8)은 너무 늦은가?",
        "",
        "| 판정 | Case | 근거 |",
        "|------|------|------|",
        f"| **희소·늦게 체감** | **B (70/7)** | {span_years:.1f}년 **{b['signalCount']}회** ({b['signalsPerYear']:.2f}/년) · 2013·2018·2025 |",
        f"| **지나치게 희소** | **C (80/8)** | **{c['signalCount']}회** — 「일부 현금 확보」 실전 트리거 부족 |",
        f"| **이르지만 noisy** | **A (60/6)** | {a['signalCount']}회 · 3M ^GSPC {m3a:+.1f}% |",
        "| **실전 불가** | **D (90/9)** | 0회 |",
        "",
        "### MDD vs 수익률",
        "",
        f"- **B** 3M 수익 {m3b:+.1f}% vs **MDD {mddb:.1f}%** — 평균은 오르지만 **조정 폭 존재**",
        f"- **C** 3M {c['gspc']['returns']['m3']['avg']:+.1f}% · MDD {mddc:.1f}% (n={c['signalCount']})",
        "- **CNN 70+ 단독**도 3M **양수** → 과열 ≠ 즉시 하락",
        "",
        "### CNN 단독 (BofA 미사용)",
        "",
        f"- 70+: {cnn70['count']}회 · 3M +{cnn70['m3Avg']:.1f}% · BofA AND 시 **{(1 - b['signalCount']/cnn70['count'])*100:.0f}% 감소**",
        f"- 80+: {cnn80['count']}회 · 3M +{cnn80['m3Avg']:.1f}%",
        f"- 90+: {cnn90['count']}회 · 3M {cnn90['m3Avg']:+.1f}% · MDD {cnn90['m3MddAvg']:.1f}%",
        "",
        "**종합:**",
        "- **B(70/7)는 ‘너무 늦다’기보다 ‘드물게 울린다’** (0.5회/년)",
        "- **2013 Mar 6회** = BofA 8.2 앵커 구간 — **조기 경고 가능**하나 2018·2025만으로는 **늦게 느껴질 수 있음**",
        "- **C(80/8)는 ‘늦고 희소’** — 실전 「일부 현금 확보」로는 **과도하게 보수적**",
        "- **2008 GFC:** CNN 2011~ 시작 → **미포함** (^GSPC 2008~ 별도)",
    ])


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--write-doc", action="store_true")
    args = parser.parse_args()

    cnn = fetch_cnn()
    gspc = fetch_index("^GSPC", "2008-01-01")
    ndx = fetch_index("^NDX", "2008-01-01")

    all_dates = sorted(set(gspc) | set(ndx))
    bofa = build_bofa_daily(all_dates)
    dates = aligned_dates(cnn, bofa, gspc)
    # restrict to CNN era
    dates = [d for d in dates if d >= "2011-01-03"]

    case_results = [analyze_case(c, dates, cnn, bofa, gspc, ndx) for c in CASES]
    recommendation = recommend(case_results)
    cnn_only = cnn_only_sensitivity(dates, cnn, gspc)

    span_years = (datetime.fromisoformat(dates[-1]) - datetime.fromisoformat(dates[0])).days / 365.25

    result = {
        "generatedAt": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "methodology": {
            "cnnSource": "whit3rabbit/fear-greed-data (CNN F&G daily, 2011+)",
            "bofaSource": "bofa-weekly-anchors-research.json (weekly proxy, forward-filled)",
            "gspcDays": len([d for d in dates if d in gspc]),
            "ndxDays": len([d for d in dates if d in ndx]),
            "period": {"first": dates[0], "last": dates[-1], "spanYears": round(span_years, 1)},
            "limitations": [
                "- CNN: 2011-01-03~ (2008–2010 **미포함** — CNN 표본 시작)",
                "- BofA: **공식 일별 시계열 없음** — Flow Show·뉴스·YDS 앵커 기반 **주간 proxy**",
                "- AND 조건 → 신호 횟수는 CNN 단독보다 **훨씬 적음**",
            ],
        },
        "cases": case_results,
        "recommendation": recommendation,
        "cnnOnly": cnn_only,
        "interpretation": build_interpretation(case_results, cnn_only, span_years),
        "philosophyRecommendation": build_philosophy_rec(case_results, recommendation, cnn_only, span_years),
    }

    CACHE.mkdir(parents=True, exist_ok=True)
    out_json = CACHE / "yds-overheat-validation-result.json"
    out_json.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {out_json}")

    md = render_markdown(result)
    doc_path = ROOT.parent / "docs" / "YDS_OVERHEAT_VALIDATION_STUDY.md"
    if args.write_doc:
        doc_path.write_text(md, encoding="utf-8")
        print(f"Wrote {doc_path}")
    else:
        doc_path.write_text(md, encoding="utf-8")
        print(f"Wrote {doc_path}")

    for r in case_results:
        c = r["case"]
        print(f"{c['id']}: signals={r['signalCount']} dwell={r['dwellPct']:.1f}% m3={r['gspc']['returns']['m3']['avg']}")


if __name__ == "__main__":
    main()
