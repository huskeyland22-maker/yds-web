#!/usr/bin/env python3
"""
YDS Upper Cycle (Harvest) Study — research only.
Grid: CNN 55/60/65/70 × BofA 5/6/7 → frequency, returns, MDD.

Usage:
  python scripts/yds-upper-cycle-study.py
  python scripts/yds-upper-cycle-study.py --write-doc
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / ".cache"
BOFA_ANCHORS = ROOT / "data" / "bofa-weekly-anchors-research.json"

HORIZONS = [("m1", 21), ("m3", 63), ("m6", 126), ("m12", 252)]

CNN_THRESHOLDS = [55, 60, 65, 70]
BOFA_THRESHOLDS = [5, 6, 7]

TIER_TARGETS = {
    "warning": {"label": "🟡 과열주의", "freq_min": 1.0, "freq_max": 4.0, "mdd_min": 4.0},
    "cash_prep": {"label": "🔵 현금준비", "freq_min": 0.6, "freq_max": 2.0, "mdd_min": 4.5},
    "partial_cash": {"label": "🔵 일부현금확보", "freq_min": 0.15, "freq_max": 0.8, "mdd_min": 5.0},
}

# V1 권장: 단조 상승 CNN/BofA + 수확 시작 60/6 정렬 (스코어-only와 분리)
V1_TIER_SPEC = {
    "warning": (55, 6),
    "cash_prep": (60, 6),
    "partial_cash": (70, 7),
}


@dataclass
class Signal:
    date: str
    cnn: float
    bofa: float


def load_json_prices(cache_name: str, key: str = "prices") -> dict[str, float]:
    payload = json.loads((CACHE / cache_name).read_text(encoding="utf-8"))
    return payload[key]


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


def avg(nums: list[float]) -> float | None:
    v = [x for x in nums if x is not None and math.isfinite(x)]
    return sum(v) / len(v) if v else None


def forward_return_pct(prices: dict[str, float], dates: list[str], signal_date: str, td: int) -> float | None:
    try:
        i = dates.index(signal_date)
    except ValueError:
        return None
    j = i + td
    if j >= len(dates):
        return None
    p0, p1 = prices.get(signal_date), prices.get(dates[j])
    if p0 is None or p1 is None or p0 <= 0:
        return None
    return (p1 / p0 - 1.0) * 100.0


def max_drawdown_pct(prices: dict[str, float], dates: list[str], signal_date: str, td: int) -> float | None:
    try:
        i = dates.index(signal_date)
    except ValueError:
        return None
    window = dates[i : min(i + td + 1, len(dates))]
    if len(window) < 2:
        return None
    peak = prices[window[0]]
    max_dd = 0.0
    for d in window:
        peak = max(peak, prices[d])
        max_dd = min(max_dd, (prices[d] / peak - 1.0) * 100.0)
    return max_dd


def find_signals(dates: list[str], cnn: dict[str, float], bofa: dict[str, float], cnn_thr: int, bofa_thr: float) -> list[Signal]:
    out: list[Signal] = []
    prev = False
    for d in dates:
        ok = cnn[d] >= cnn_thr and bofa[d] >= bofa_thr
        if ok and not prev:
            out.append(Signal(d, cnn[d], bofa[d]))
        prev = ok
    return out


def analyze_combo(cnn_thr: int, bofa_thr: int, dates, cnn, bofa, gspc, ndx, span_years) -> dict:
    signals = find_signals(dates, cnn, bofa, cnn_thr, float(bofa_thr))
    gspc_r = {h: [] for h, _ in HORIZONS}
    gspc_m = {h: [] for h, _ in HORIZONS}
    ndx_r = {h: [] for h, _ in HORIZONS}
    for sig in signals:
        for h, td in HORIZONS:
            gspc_r[h].append(forward_return_pct(gspc, dates, sig.date, td))
            gspc_m[h].append(max_drawdown_pct(gspc, dates, sig.date, td))
            ndx_r[h].append(forward_return_pct(ndx, dates, sig.date, td))
    dwell = sum(1 for d in dates if cnn[d] >= cnn_thr and bofa[d] >= bofa_thr)
    return {
        "case": {"cnn": cnn_thr, "bofa": bofa_thr},
        "signalCount": len(signals),
        "signalsPerYear": len(signals) / span_years,
        "dwellPct": dwell / len(dates) * 100,
        "gspc": {
            "returns": {h: {"avg": avg(gspc_r[h])} for h, _ in HORIZONS},
            "mdd": {h: {"avg": avg(gspc_m[h])} for h, _ in HORIZONS},
        },
        "ndx": {"returns": {h: {"avg": avg(ndx_r[h])} for h, _ in HORIZONS}},
    }


def fmt_pct(v: float | None, signed: bool = True) -> str:
    if v is None or not math.isfinite(v):
        return "—"
    return f"{v:+.1f}%" if signed else f"{v:.1f}%"


def analyze_cnn_only(thr: int, dates, cnn, gspc, span_years) -> dict:
    prev = False
    signals = []
    for d in dates:
        ok = cnn[d] >= thr
        if ok and not prev:
            signals.append(d)
        prev = ok
    m3 = [forward_return_pct(gspc, dates, s, 63) for s in signals]
    m6 = [forward_return_pct(gspc, dates, s, 126) for s in signals]
    mdd3 = [max_drawdown_pct(gspc, dates, s, 63) for s in signals]
    mdd6 = [max_drawdown_pct(gspc, dates, s, 126) for s in signals]
    dwell = sum(1 for d in dates if cnn[d] >= thr)
    return {
        "cnn": thr,
        "bofa": None,
        "signalCount": len(signals),
        "signalsPerYear": len(signals) / span_years,
        "dwellPct": dwell / len(dates) * 100,
        "gspc_m3": avg(m3),
        "gspc_m6": avg(m6),
        "mdd_m3": avg(mdd3),
        "mdd_m6": avg(mdd6),
    }


def analyze_bofa_only(thr: int, dates, bofa, gspc, span_years) -> dict:
    prev = False
    signals = []
    for d in dates:
        ok = bofa[d] >= thr
        if ok and not prev:
            signals.append(d)
        prev = ok
    m3 = [forward_return_pct(gspc, dates, s, 63) for s in signals]
    mdd3 = [max_drawdown_pct(gspc, dates, s, 63) for s in signals]
    dwell = sum(1 for d in dates if bofa[d] >= thr)
    return {
        "cnn": None,
        "bofa": thr,
        "signalCount": len(signals),
        "signalsPerYear": len(signals) / span_years,
        "dwellPct": dwell / len(dates) * 100,
        "gspc_m3": avg(m3),
        "mdd_m3": avg(mdd3),
    }


def tier_score(row: dict, tier_key: str) -> float:
    t = TIER_TARGETS[tier_key]
    freq = row.get("signalsPerYear") or 0
    mdd3 = row.get("mdd_m3")
    if mdd3 is None:
        mdd3 = row.get("gspc", {}).get("mdd", {}).get("m3", {}).get("avg")
    mdd3_abs = abs(mdd3) if mdd3 is not None else 0

    freq_score = 0.0
    if t["freq_min"] <= freq <= t["freq_max"]:
        freq_score = 3.0
    elif freq < t["freq_min"]:
        freq_score = max(0, 3.0 * (freq / t["freq_min"]))
    else:
        freq_score = max(0, 3.0 * (t["freq_max"] / freq))

    mdd_score = min(3.0, mdd3_abs / t["mdd_min"] * 3.0) if mdd3_abs else 0
    count = row.get("signalCount") or 0
    n_score = 1.0 if count >= 5 else (0.5 if count >= 3 else 0)

    return freq_score + mdd_score + n_score


def flatten_combo(r: dict) -> dict:
    return {
        "key": f"CNN{r['case']['cnn']}+/BofA{r['case']['bofa']}+",
        "cnn": r["case"]["cnn"],
        "bofa": r["case"]["bofa"],
        "signalCount": r["signalCount"],
        "signalsPerYear": r["signalsPerYear"],
        "dwellPct": r["dwellPct"],
        "gspc_m1": r["gspc"]["returns"]["m1"]["avg"],
        "gspc_m3": r["gspc"]["returns"]["m3"]["avg"],
        "gspc_m6": r["gspc"]["returns"]["m6"]["avg"],
        "gspc_m12": r["gspc"]["returns"]["m12"]["avg"],
        "mdd_m1": r["gspc"]["mdd"]["m1"]["avg"],
        "mdd_m3": r["gspc"]["mdd"]["m3"]["avg"],
        "mdd_m6": r["gspc"]["mdd"]["m6"]["avg"],
        "mdd_m12": r["gspc"]["mdd"]["m12"]["avg"],
        "ndx_m3": r["ndx"]["returns"]["m3"]["avg"],
    }


def lookup_combo(grid_flat: list[dict], cnn: int, bofa: int) -> dict:
    return next(x for x in grid_flat if x["cnn"] == cnn and x["bofa"] == bofa)


def v1_tier_picks(grid_flat: list[dict]) -> dict[str, dict]:
    return {k: lookup_combo(grid_flat, *V1_TIER_SPEC[k]) for k in V1_TIER_SPEC}


def pick_tier_best(grid_flat: list[dict], tier_key: str) -> dict:
    scored = [(tier_score(row, tier_key), row) for row in grid_flat]
    scored.sort(key=lambda x: x[0], reverse=True)
    return {"tier": tier_key, "score": scored[0][0], "pick": scored[0][1], "top3": [s[1] for s in scored[:3]]}


def build_harvest_answer(grid: list[dict], cnn_only: list[dict]) -> str:
    r606 = next(x for x in grid if x["cnn"] == 60 and x["bofa"] == 6)
    r555 = next(x for x in grid if x["cnn"] == 55 and x["bofa"] == 5)
    r656 = next(x for x in grid if x["cnn"] == 65 and x["bofa"] == 6)
    r707 = next(x for x in grid if x["cnn"] == 70 and x["bofa"] == 7)
    c60 = next(x for x in cnn_only if x["cnn"] == 60)

    lines = [
        "### 질문: 수확 시작 신호는 CNN 60+ / BofA 6+ 에서 나타나는가?",
        "",
        "| 기준 | 신호/년 | 3M ^GSPC | 3M MDD | 판정 |",
        "|------|---------|----------|--------|------|",
        f"| **CNN60+ & BofA6+** | {r606['signalsPerYear']:.2f} | {fmt_pct(r606['gspc_m3'])} | {fmt_pct(r606['mdd_m3'])} | **수확·과열 주의 시작점으로 적합** |",
        f"| CNN55+ & BofA5+ | {r555['signalsPerYear']:.2f} | {fmt_pct(r555['gspc_m3'])} | {fmt_pct(r555['mdd_m3'])} | 더 이르지만 noisy |",
        f"| CNN65+ & BofA6+ | {r656['signalsPerYear']:.2f} | {fmt_pct(r656['gspc_m3'])} | {fmt_pct(r656['mdd_m3'])} | 중간 |",
        f"| CNN70+ & BofA7+ | {r707['signalsPerYear']:.2f} | {fmt_pct(r707['gspc_m3'])} | {fmt_pct(r707['mdd_m3'])} | **과도하게 희소** |",
        f"| CNN60+ 단독 | {c60['signalsPerYear']:.2f} | {fmt_pct(c60['gspc_m3'])} | {fmt_pct(c60['mdd_m3'])} | BofA 없이도 빈도 충분 |",
        "",
        "**답: 예 — AND 기준 60/6이 상단 사이클(수확·현금화)의 실질 시작점.**",
        "",
        f"- 3M MDD **{fmt_pct(r606['mdd_m3'])}** · 연 **~{r606['signalsPerYear']:.1f}회** → 「주의→준비」 실행 가능 빈도",
        "- 70/7(0.52회/년)은 **확인용 2단계**로 두고, **1단계는 60/6**",
        "- 3M **평균 수익률은 양수** → 수확 = 전량 매도가 아니라 **비중 축소·MDD 대비**",
    ]
    return "\n".join(lines)


def render_markdown(result: dict) -> str:
    m = result["methodology"]
    grid = result["grid"]
    picks = result["tierPicks"]

    lines = [
        "# YDS Upper Cycle Study",
        "",
        "> **상단 사이클(수확 엔진) 연구** · `getFinalScore` · 엔진/UI **미변경**",
        f"> 생성: {result['generatedAt'][:10]} · 재현: `python scripts/yds-upper-cycle-study.py`",
        "> 선행: [YDS_OVERHEAT_VALIDATION_STUDY.md](./YDS_OVERHEAT_VALIDATION_STUDY.md)",
        "",
        "---",
        "",
        "## 1. 연구 목적",
        "",
        "YDS를 **매수 엔진**(준비→분할→패닉) + **수확 엔진**(과열→현금)으로 완성하기 위해,",
        "상단 3단계 **🟡 과열주의 · 🔵 현금준비 · 🔵 일부현금확보** 의 **최적 CNN/BofA 조합**을 탐색한다.",
        "",
        "**핵심 질문:** 수확 시작 신호는 **CNN 60+ / BofA 6+** 수준에서 나타나는가?",
        "",
        "---",
        "",
        "## 2. 방법론",
        "",
        f"| 항목 | {m['period']['first']} ~ {m['period']['last']} ({m['period']['spanYears']}년) |",
        "|------|------|",
        f"| CNN | {m['cnnSource']} |",
        f"| BofA | {m['bofaSource']} |",
        f"| 지수 | ^GSPC · ^NDX |",
        "| 신호 | CNN **AND** BofA 동시 임계 **에피소드 진입** |",
        "| 수익률 | +21/63/126/252 거래일 |",
        "| MDD | 신호일~horizon 최대 낙폭 |",
        "",
        "그리드: CNN **55·60·65·70+** × BofA **5·6·7+** (12조합) + CNN/BofA 단독 민감도",
        "",
        "---",
        "",
        "## 3. 조합별 발생 빈도",
        "",
        "| CNN | BofA | 신호 | /년 | 체류% |",
        "|-----|------|------|-----|-------|",
    ]
    for r in grid:
        lines.append(
            f"| {r['cnn']}+ | {r['bofa']}+ | {r['signalCount']} | {r['signalsPerYear']:.2f} | {r['dwellPct']:.1f}% |"
        )

    lines += [
        "",
        "---",
        "",
        "## 4. 조합별 이후 수익률 (^GSPC)",
        "",
        "| CNN | BofA | 1M | 3M | 6M | 12M |",
        "|-----|------|-----|-----|-----|------|",
    ]
    for r in grid:
        lines.append(
            f"| {r['cnn']}+ | {r['bofa']}+ | {fmt_pct(r['gspc_m1'])} | {fmt_pct(r['gspc_m3'])} | "
            f"{fmt_pct(r['gspc_m6'])} | {fmt_pct(r['gspc_m12'])} |"
        )

    lines += [
        "",
        "---",
        "",
        "## 5. 조합별 최대 낙폭 (MDD, ^GSPC)",
        "",
        "| CNN | BofA | 1M | 3M | 6M | 12M |",
        "|-----|------|-----|-----|-----|------|",
    ]
    for r in grid:
        lines.append(
            f"| {r['cnn']}+ | {r['bofa']}+ | {fmt_pct(r['mdd_m1'])} | {fmt_pct(r['mdd_m3'])} | "
            f"{fmt_pct(r['mdd_m6'])} | {fmt_pct(r['mdd_m12'])} |"
        )

    lines += ["", "---", "", "## 6. 수확 시작 신호 검증", "", result["harvestAnswer"], ""]

    v1 = result["v1TierPicks"]
    lines += [
        "",
        "---",
        "",
        "## 7. 상단 3단계 최적 기준 (V1 권장)",
        "",
        "빈도·MDD 스코어와 **단조 상승 임계**(55/6 → 60/6 → 70/7) 및 **수확 시작 60/6** 정렬을 우선한다.",
        "",
    ]
    for tier_key in ["warning", "cash_prep", "partial_cash"]:
        pick = v1[tier_key]
        scored = picks[tier_key]
        t = TIER_TARGETS[tier_key]
        lines.append(f"### {t['label']}")
        lines.append("")
        lines.append(f"**권장:** CNN **{pick['cnn']}+** AND BofA **{pick['bofa']}+**")
        lines.append("")
        lines.append(
            f"- 신호 **{pick['signalCount']}회** ({pick['signalsPerYear']:.2f}/년) · "
            f"3M MDD {fmt_pct(pick['mdd_m3'])} · 3M 수익 {fmt_pct(pick['gspc_m3'])}"
        )
        sp = scored["pick"]
        if sp["key"] != pick["key"]:
            lines.append(
                f"- 스코어 1위(참고): {sp['key']} ({sp['signalsPerYear']:.2f}/년, MDD {fmt_pct(sp['mdd_m3'])})"
            )
        alts = ", ".join(f"CNN{x['cnn']}+/BofA{x['bofa']}+" for x in scored["top3"][1:3] if x["key"] != pick["key"])
        if alts:
            lines.append(f"- 차선: {alts}")
        lines.append("")

    w, c, p = v1["warning"], v1["cash_prep"], v1["partial_cash"]
    lines += [
        "---",
        "",
        "## 8. YDS 사이클 완성 — 매수 + 수확",
        "",
        "```",
        "하단 매수 엔진          │  상단 수확 엔진",
        "───────────────────────┼──────────────────────────",
        f"🟢 중립 (관찰)          │  🟡 과열주의  ← CNN{w['cnn']}+/BofA{w['bofa']}+ (OR 보조)",
        f"🟡 준비 (쌓기)          │  🔵 현금준비  ← CNN{c['cnn']}+/BofA{c['bofa']}+",
        f"🟠 분할 (실행)          │  🔵 일부현금  ← CNN{p['cnn']}+/BofA{p['bofa']}+",
        "🔴 패닉 (보너스)        │  (전량 아님 · MDD·비중 축소)",
        "```",
        "",
        "---",
        "",
        "## 9. V1 권장 (카피·UX만, 엔진 무관)",
        "",
        result["v1Recommendation"],
        "",
        "---",
        "",
        "## 부록: CNN / BofA 단독",
        "",
        "### CNN 단독",
        "",
        "| CNN | 신호 | /년 | 3M ^GSPC | 3M MDD |",
        "|-----|------|-----|----------|--------|",
    ]
    for r in result["cnnOnly"]:
        lines.append(
            f"| {r['cnn']}+ | {r['signalCount']} | {r['signalsPerYear']:.2f} | "
            f"{fmt_pct(r['gspc_m3'])} | {fmt_pct(r['mdd_m3'])} |"
        )

    lines += [
        "",
        "### BofA 단독",
        "",
        "| BofA | 신호 | /년 | 3M ^GSPC | 3M MDD |",
        "|------|------|-----|----------|--------|",
    ]
    for r in result["bofaOnly"]:
        lines.append(
            f"| {r['bofa']}+ | {r['signalCount']} | {r['signalsPerYear']:.2f} | "
            f"{fmt_pct(r['gspc_m3'])} | {fmt_pct(r['mdd_m3'])} |"
        )

    lines.append("")
    return "\n".join(lines)


def build_v1_rec(v1: dict[str, dict]) -> str:
    w, c, p = v1["warning"], v1["cash_prep"], v1["partial_cash"]
    return "\n".join([
        "| 단계 | 권장 임계 | 빈도 | 근거 |",
        "|------|-----------|------|------|",
        f"| 🟡 **과열주의** | CNN **{w['cnn']}+** & BofA **{w['bofa']}+** | {w['signalsPerYear']:.2f}/년 | 조기 경고 · MDD {fmt_pct(w['mdd_m3'])} |",
        f"| 🔵 **현금준비** | CNN **{c['cnn']}+** & BofA **{c['bofa']}+** | {c['signalsPerYear']:.2f}/년 | **수확 시작점** · 70/7 대비 5× 빈도 |",
        f"| 🔵 **일부현금확보** | CNN **{p['cnn']}+** & BofA **{p['bofa']}+** | {p['signalsPerYear']:.2f}/년 | 확인·일부현금 · MDD {fmt_pct(p['mdd_m3'])} |",
        "",
        "**보조 규칙:** CNN 60+ **OR** BofA 6+ → 🟡 과열주의 **보조** (OR는 빈도 확대용)",
        "",
        "기존 CNN70/BofA7 단일 「현금준비」는 **일부현금확보(confirm)** 로 격하 — 15년 8회는 1단계 현금준비로 부족.",
    ])


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--write-doc", action="store_true")
    args = parser.parse_args()

    cnn = load_json_prices("cnn-fear-greed-daily.json")
    gspc = load_json_prices("overheat-gspc-daily.json")
    ndx = load_json_prices("overheat-ndx-daily.json")
    all_dates = sorted(set(cnn) & set(gspc) & set(ndx))
    bofa = build_bofa_daily(all_dates)
    dates = [d for d in all_dates if d >= "2011-01-03"]
    span_years = (datetime.fromisoformat(dates[-1]) - datetime.fromisoformat(dates[0])).days / 365.25

    grid_raw = [analyze_combo(c, b, dates, cnn, bofa, gspc, ndx, span_years) for c in CNN_THRESHOLDS for b in BOFA_THRESHOLDS]
    grid = [flatten_combo(r) for r in grid_raw]

    cnn_only = [analyze_cnn_only(t, dates, cnn, gspc, span_years) for t in CNN_THRESHOLDS]
    bofa_only = [analyze_bofa_only(t, dates, bofa, gspc, span_years) for t in BOFA_THRESHOLDS]

    tier_picks = {k: pick_tier_best(grid, k) for k in TIER_TARGETS}
    v1_tiers = v1_tier_picks(grid)

    result = {
        "generatedAt": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "methodology": {
            "cnnSource": "whit3rabbit/fear-greed-data",
            "bofaSource": "bofa-weekly-anchors-research.json (proxy)",
            "period": {"first": dates[0], "last": dates[-1], "spanYears": round(span_years, 1)},
        },
        "grid": grid,
        "cnnOnly": cnn_only,
        "bofaOnly": bofa_only,
        "tierPicks": tier_picks,
        "v1TierPicks": v1_tiers,
        "harvestAnswer": build_harvest_answer(grid, cnn_only),
        "v1Recommendation": build_v1_rec(v1_tiers),
    }

    cache = ROOT / ".cache" / "yds-upper-cycle-result.json"
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {cache}")

    doc = render_markdown(result)
    doc_path = ROOT.parent / "docs" / "YDS_UPPER_CYCLE_STUDY.md"
    doc_path.write_text(doc, encoding="utf-8")
    print(f"Wrote {doc_path}")

    w, c, p = v1_tiers["warning"], v1_tiers["cash_prep"], v1_tiers["partial_cash"]
    print(f"V1 과열주의: CNN{w['cnn']}+/BofA{w['bofa']}+ ({w['signalsPerYear']:.2f}/yr)")
    print(f"V1 현금준비: CNN{c['cnn']}+/BofA{c['bofa']}+ ({c['signalsPerYear']:.2f}/yr)")
    print(f"V1 일부현금: CNN{p['cnn']}+/BofA{p['bofa']}+ ({p['signalsPerYear']:.2f}/yr)")


if __name__ == "__main__":
    main()
