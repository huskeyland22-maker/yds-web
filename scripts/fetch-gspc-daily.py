#!/usr/bin/env python3
"""Fetch ^GSPC daily closes for YDS cycle validation (research only)."""
import json
import sys
from pathlib import Path

try:
    import yfinance as yf
except ImportError:
    print("yfinance not installed", file=sys.stderr)
    sys.exit(1)

out = Path(__file__).resolve().parent / ".cache" / "gspc-daily.json"
out.parent.mkdir(parents=True, exist_ok=True)

start = sys.argv[1] if len(sys.argv) > 1 else "2016-01-01"
df = yf.download("^GSPC", start=start, progress=False, auto_adjust=True)

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
    "symbol": "^GSPC",
    "start": start,
    "count": len(prices),
    "first": min(prices) if prices else None,
    "last": max(prices) if prices else None,
    "prices": prices,
}
out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
print(f"Wrote {len(prices)} days to {out}")
