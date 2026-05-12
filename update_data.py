"""
9대 패닉지수 업데이트 스크립트.

요구사항:
- 미국 동부시간 기준 업데이트 시각 저장
- Yahoo Finance 지표는 Adj Close 기반 value/delta 계산
- CNN Fear & Greed score + delta 계산
- FRED(BAMLH0A0HYM2) value/delta 계산
- bofa / gs 는 기존 data.json 값 유지(덮어쓰기 금지)
- 실패 시 기존 data.json 유지
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import pandas as pd
import requests
import yfinance as yf
from pandas_datareader import data as pdr
import pytz


DATA_FILE = Path(__file__).resolve().parent / "vite-project" / "public" / "data.json"
CYCLE_HISTORY_FILE = Path(__file__).resolve().parent / "vite-project" / "public" / "cycle-metrics-history.json"
CYCLE_HISTORY_MAX_DAYS = 90
CNN_FG_URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"
FRED_SERIES_HIGH_YIELD = "BAMLH0A0HYM2"
NY_TZ = pytz.timezone("America/New_York")


def load_existing_data(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        with path.open("r", encoding="utf-8") as f:
            obj = json.load(f)
            return obj if isinstance(obj, dict) else {}
    except Exception:
        return {}


def to_float_or_none(v: Any) -> float | None:
    try:
        if v is None:
            return None
        if pd.isna(v):
            return None
        return float(v)
    except Exception:
        return None


def value_delta_from_series(series: pd.Series) -> dict[str, float | None]:
    if series is None:
        return {"value": None, "delta": None}

    cleaned = series.dropna()
    if cleaned.empty:
        return {"value": None, "delta": None}

    if len(cleaned) == 1:
        return {"value": to_float_or_none(cleaned.iloc[-1]), "delta": None}

    today = to_float_or_none(cleaned.iloc[-1])
    yesterday = to_float_or_none(cleaned.iloc[-2])
    delta = None if today is None or yesterday is None else (today - yesterday)
    return {"value": today, "delta": delta}


def fetch_yahoo_adj_close(symbol: str) -> dict[str, float | None]:
    """
    Yahoo Finance 지표 조회.
    - Adj Close 기준
    - 최근 2개 종가로 delta 계산
    """
    try:
        df = yf.download(
            symbol,
            period="10d",
            interval="1d",
            auto_adjust=False,
            progress=False,
            threads=False,
        )
        if df is None or df.empty or "Adj Close" not in df.columns:
            return {"value": None, "delta": None}
        return value_delta_from_series(df["Adj Close"])
    except Exception:
        return {"value": None, "delta": None}


def _collect_scores(node: Any, out: list[float]) -> None:
    if isinstance(node, dict):
        if "score" in node:
            s = to_float_or_none(node.get("score"))
            if s is not None:
                out.append(s)
        for v in node.values():
            _collect_scores(v, out)
    elif isinstance(node, list):
        for x in node:
            _collect_scores(x, out)


def fetch_cnn_fear_greed() -> dict[str, float | None]:
    try:
        r = requests.get(CNN_FG_URL, timeout=30)
        r.raise_for_status()
        payload = r.json()
    except Exception:
        return {"value": None, "delta": None}

    current = to_float_or_none((payload.get("fear_and_greed") or {}).get("score"))

    scores: list[float] = []
    _collect_scores(payload, scores)
    # 중복 제거 + 순서 보존
    uniq_scores: list[float] = []
    seen: set[float] = set()
    for s in scores:
        if s not in seen:
            seen.add(s)
            uniq_scores.append(s)

    previous = None
    if current is not None:
        for s in uniq_scores:
            if s != current:
                previous = s
                break

    delta = None if current is None or previous is None else (current - previous)
    return {"value": current, "delta": delta}


def fetch_fred_high_yield() -> dict[str, float | None]:
    try:
        end = datetime.now(NY_TZ)
        start = end - timedelta(days=60)
        series_df = pdr.DataReader(FRED_SERIES_HIGH_YIELD, "fred", start, end)
        if series_df is None or series_df.empty or FRED_SERIES_HIGH_YIELD not in series_df.columns:
            return {"value": None, "delta": None}
        return value_delta_from_series(series_df[FRED_SERIES_HIGH_YIELD])
    except Exception:
        return {"value": None, "delta": None}


def build_payload(existing: dict[str, Any]) -> dict[str, Any]:
    now_ny = datetime.now(NY_TZ)

    payload = {
        "updated_at": now_ny.strftime("%Y-%m-%d %H:%M"),
        "vix": fetch_yahoo_adj_close("^VIX"),
        "vxn": fetch_yahoo_adj_close("^VXN"),
        "skew": fetch_yahoo_adj_close("^SKEW"),
        "putCall": fetch_yahoo_adj_close("^PCC"),
        "move": fetch_yahoo_adj_close("^MOVE"),
        "fearGreed": fetch_cnn_fear_greed(),
        "highYield": fetch_fred_high_yield(),
        # 수동값 보호: 기존 값 유지
        "bofa": existing.get("bofa"),
        "gs": existing.get("gs"),
    }
    return payload


def save_payload(path: Path, payload: dict[str, Any]) -> None:
    tmp = path.with_suffix(".json.tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    tmp.replace(path)


def extract_metric_scalar(node: Any) -> float | None:
    """data.json 과 동일하게 {value, delta} 또는 숫자 스칼라를 수치로 변환."""
    if node is None:
        return None
    if isinstance(node, (int, float)):
        if isinstance(node, float) and pd.isna(node):
            return None
        return float(node)
    if isinstance(node, dict) and "value" in node:
        return to_float_or_none(node.get("value"))
    return to_float_or_none(node)


def build_cycle_history_row(trade_date: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    """프론트 Macro 차트와 동일 키( gsBullBear )로 일별 스냅샷 생성."""
    row: dict[str, Any] = {
        "date": trade_date,
        "vix": extract_metric_scalar(payload.get("vix")),
        "vxn": extract_metric_scalar(payload.get("vxn")),
        "putCall": extract_metric_scalar(payload.get("putCall")),
        "fearGreed": extract_metric_scalar(payload.get("fearGreed")),
        "move": extract_metric_scalar(payload.get("move")),
        "skew": extract_metric_scalar(payload.get("skew")),
        "highYield": extract_metric_scalar(payload.get("highYield")),
        "bofa": extract_metric_scalar(payload.get("bofa")),
        "gsBullBear": extract_metric_scalar(payload.get("gs")),
    }
    core = ("vix", "vxn", "putCall", "fearGreed", "move", "skew", "highYield")
    if not all(row[k] is not None for k in core):
        return None
    return row


def cycle_history_row_is_valid(row: dict[str, Any]) -> bool:
    def finite(name: str, lo: float, hi: float) -> bool:
        v = row.get(name)
        if v is None or not isinstance(v, (int, float)):
            return False
        if math.isnan(v) or math.isinf(v):
            return False
        return lo <= v <= hi

    if not finite("vix", 4.0, 95.0):
        return False
    if not finite("vxn", 4.0, 120.0):
        return False
    if not finite("fearGreed", 0.0, 100.0):
        return False
    if not finite("putCall", 0.15, 3.0):
        return False
    if not finite("move", 15.0, 250.0):
        return False
    if not finite("skew", 50.0, 250.0):
        return False
    if not finite("highYield", 0.3, 30.0):
        return False
    b = row.get("bofa")
    if b is not None:
        if not isinstance(b, (int, float)) or math.isnan(b) or math.isinf(b) or not (0.0 <= b <= 20.0):
            return False
    g = row.get("gsBullBear")
    if g is not None:
        if not isinstance(g, (int, float)) or math.isnan(g) or math.isinf(g) or not (0.0 <= g <= 100.0):
            return False
    return True


def load_cycle_history() -> list[dict[str, Any]]:
    if not CYCLE_HISTORY_FILE.exists():
        return []
    try:
        with CYCLE_HISTORY_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def save_cycle_history(rows: list[dict[str, Any]]) -> None:
    tmp = CYCLE_HISTORY_FILE.with_suffix(".json.tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    tmp.replace(CYCLE_HISTORY_FILE)


def append_cycle_metrics_history(payload: dict[str, Any]) -> None:
    """
    일별 스냅샷을 cycle-metrics-history.json 에 누적.
    - 동일 캘린더 날짜는 덮어쓰기(중복 방지)
    - 최근 CYCLE_HISTORY_MAX_DAYS 일만 유지
    - Yahoo/FRED 등 핵심 필드가 비어 있거나 범위 밖이면 저장하지 않음
    """
    now_ny = datetime.now(NY_TZ)
    trade_date = now_ny.strftime("%Y-%m-%d")
    row = build_cycle_history_row(trade_date, payload)
    if row is None:
        print("cycle history: skip (incomplete core metrics)")
        return
    if not cycle_history_row_is_valid(row):
        print("cycle history: skip (failed bounds check)")
        return

    prev = load_cycle_history()
    by_date: dict[str, dict[str, Any]] = {}
    for r in prev:
        d = str(r.get("date", ""))[:10]
        if len(d) == 10:
            by_date[d] = r
    by_date[trade_date] = row
    out = sorted(by_date.values(), key=lambda r: str(r.get("date", "")))[-CYCLE_HISTORY_MAX_DAYS:]
    save_cycle_history(out)
    print(f"updated: {CYCLE_HISTORY_FILE} ({len(out)} rows)")


def main() -> None:
    existing = load_existing_data(DATA_FILE)
    try:
        payload = build_payload(existing)
        save_payload(DATA_FILE, payload)
        print(f"updated: {DATA_FILE}")
        try:
            append_cycle_metrics_history(payload)
        except Exception as eh:
            print(f"cycle history append error (data.json already saved): {eh}")
    except Exception as e:
        # 전체 실패 시 기존 data.json 유지
        print(f"update failed, keep existing file: {e}")


if __name__ == "__main__":
    main()
