"""
패닉 지수 API — 실시간 시장 데이터 + 10분 백그라운드 갱신 + 메모리 캐시.

환경 변수
----------
FRED_API_KEY       St. Louis Fed API 키 (High Yield 스프레드 필수)
BOFA_MANUAL        BofA 수동 값 (기본 2.1)
PUTCALL_MANUAL     Put/Call 비율 수동 값 (소수, 예: 0.85)
PUTCALL_FRED_SERIES  Put/Call을 FRED 시리즈로 받을 때 (FRED_API_KEY와 함께)

데이터 소스
-----------
- VIX: Yahoo Finance (^VIX), yfinance
- Put/Call: PUTCALL_MANUAL 또는 PUTCALL_FRED_SERIES(+FRED_API_KEY), 미설정 시 null(이전 캐시 유지)
- Fear & Greed: CNN JSON (브라우저 UA) → 실패 시 alternative.me 백업
- High Yield: FRED BAMLH0A0HYM2 (ICE BofA US HY OAS)
- BofA: BOFA_MANUAL
"""
import logging
import math
import os
import threading
import time
from datetime import datetime
from typing import Any, Optional

import requests
import yfinance as yf
from flask import Flask, jsonify
from flask_cors import CORS

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("panic")

CNN_FG_URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"
ALT_FG_URL = "https://api.alternative.me/fng/?limit=1"
FRED_OBS_URL = "https://api.stlouisfed.org/fred/series/observations"
FRED_SERIES_HY = "BAMLH0A0HYM2"

HTTP_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9",
}


def manual_bofa() -> float:
    return float(os.environ.get("BOFA_MANUAL", "2.1"))


def get_vix() -> Optional[float]:
    hist = yf.Ticker("^VIX").history(period="5d")
    if hist is None or hist.empty:
        return None
    return round(float(hist["Close"].iloc[-1]), 2)


def fred_latest_observation(series_id: str) -> Optional[float]:
    key = os.environ.get("FRED_API_KEY")
    if not key:
        return None
    params: dict[str, Any] = {
        "series_id": series_id,
        "api_key": key,
        "file_type": "json",
        "sort_order": "desc",
        "limit": 1,
    }
    r = requests.get(FRED_OBS_URL, params=params, timeout=30)
    r.raise_for_status()
    obs = r.json().get("observations") or []
    if not obs:
        return None
    raw = obs[0].get("value")
    if raw in (None, "."):
        return None
    return float(raw)


def get_high_yield() -> Optional[float]:
    if not os.environ.get("FRED_API_KEY"):
        log.warning("FRED_API_KEY not set; cannot fetch high yield spread")
        return None
    try:
        v = fred_latest_observation(FRED_SERIES_HY)
        if v is None:
            return None
        return round(v, 3)
    except Exception:
        log.exception("get_high_yield FRED %s", FRED_SERIES_HY)
        return None


def get_put_call() -> Optional[float]:
    manual = os.environ.get("PUTCALL_MANUAL", "").strip()
    if manual:
        v = float(manual)
        if 0.2 <= v <= 3.0:
            return round(v, 4)
        log.warning("PUTCALL_MANUAL out of range (0.2~3), ignored")
        return None

    series = os.environ.get("PUTCALL_FRED_SERIES", "").strip()
    if series and os.environ.get("FRED_API_KEY"):
        try:
            v = fred_latest_observation(series)
            if v is None:
                return None
            if 0.35 <= v <= 2.2:
                return round(v, 4)
            log.warning("PUTCALL_FRED value %s out of expected band; skip", v)
        except Exception:
            log.exception("get_put_call FRED %s", series)

    log.info(
        "Put/Call not configured: set PUTCALL_MANUAL or PUTCALL_FRED_SERIES (+ FRED_API_KEY)"
    )
    return None


def get_fear_greed() -> Optional[float]:
    try:
        r = requests.get(CNN_FG_URL, timeout=25, headers=HTTP_BROWSER_HEADERS)
        r.raise_for_status()
        data = r.json()
        fg = data.get("fear_and_greed") or {}
        score = fg.get("score")
        if score is None:
            raise ValueError("CNN JSON missing fear_and_greed.score")
        return round(float(score), 2)
    except Exception:
        log.warning("CNN Fear&Greed failed, trying alternative.me", exc_info=True)

    try:
        r = requests.get(ALT_FG_URL, timeout=20, headers=HTTP_BROWSER_HEADERS)
        r.raise_for_status()
        arr = (r.json().get("data") or [])
        if not arr:
            return None
        return round(float(arr[0]["value"]), 2)
    except Exception:
        log.exception("alternative.me Fear&Greed failed")
        return None


CACHE: dict = {
    "vix": None,
    "putCall": None,
    "fearGreed": None,
    "bofa": manual_bofa(),
    "highYield": None,
    "updatedAt": None,
}
CACHE_LOCK = threading.Lock()
_background_started = False


def refresh_all() -> None:
    updates: dict = {}

    def run(name: str, fn):
        try:
            val = fn()
            if val is not None and not (isinstance(val, float) and math.isnan(val)):
                updates[name] = val
        except Exception:
            log.exception("refresh: %s failed", name)

    run("vix", get_vix)
    run("putCall", get_put_call)
    run("fearGreed", get_fear_greed)
    run("highYield", get_high_yield)

    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    with CACHE_LOCK:
        for k, v in updates.items():
            CACHE[k] = v
        CACHE["bofa"] = manual_bofa()
        CACHE["updatedAt"] = now


def _background_loop() -> None:
    while True:
        time.sleep(600)
        try:
            refresh_all()
        except Exception:
            log.exception("background refresh_all")


def bootstrap() -> None:
    global _background_started
    try:
        refresh_all()
    except Exception:
        log.exception("initial refresh_all")
    with CACHE_LOCK:
        if _background_started:
            return
        _background_started = True
    threading.Thread(target=_background_loop, daemon=True).start()
    log.info("Background refresh every 600s started")


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})


@app.route("/panic-data")
def panic_data():
    with CACHE_LOCK:
        payload = dict(CACHE)
    return jsonify(payload)


bootstrap()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)
