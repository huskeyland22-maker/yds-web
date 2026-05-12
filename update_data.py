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
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import pandas as pd
import requests
import yfinance as yf
from pandas_datareader import data as pdr
import pytz


DATA_FILE = Path(__file__).resolve().parent / "vite-project" / "public" / "data.json"
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


def main() -> None:
    existing = load_existing_data(DATA_FILE)
    try:
        payload = build_payload(existing)
        save_payload(DATA_FILE, payload)
        print(f"updated: {DATA_FILE}")
    except Exception as e:
        # 전체 실패 시 기존 data.json 유지
        print(f"update failed, keep existing file: {e}")


if __name__ == "__main__":
    main()
