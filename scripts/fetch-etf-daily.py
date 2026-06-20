#!/usr/bin/env python3
"""Fetch ETF daily closes for YDS Panic Lab (research only)."""
import json
import sys
from pathlib import Path

try:
    import yfinance as yf
except ImportError:
    print("yfinance not installed", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "vite-project" / "public" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

SYMBOLS = {
    "qqq-daily.json": "QQQ",
    "soxx-daily.json": "SOXX",
}

start = sys.argv[1] if len(sys.argv) > 1 else "2016-01-01"

for filename, ticker in SYMBOLS.items():
    df = yf.download(ticker, start=start, progress=False, auto_adjust=True)
    prices = {}
    if df is not None and not df.empty:
        if isinstance(df.columns, __import__("pandas").MultiIndex):
            close = df["Close"].iloc[:, 0] if df["Close"].ndim > 1 else df["Close"]
        else:
            close = df["Close"] if "Close" in df.columns else df.iloc[:, 0]
        for idx, val in close.items():
            d = idx.strftime("%Y-%m-%d") if hasattr(idx, "strftime") else str(idx)[:10]
            v = float(val)
            if v > 0:
                prices[d] = round(v, 2)

    payload = {
        "symbol": ticker,
        "start": start,
        "count": len(prices),
        "first": min(prices) if prices else None,
        "last": max(prices) if prices else None,
        "prices": prices,
    }
    out = OUT_DIR / filename
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {len(prices)} days ({ticker}) -> {out}")
