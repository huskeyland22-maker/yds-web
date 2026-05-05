"""
패닉 지수 API — 실시간 시장 데이터 + 10분 백그라운드 갱신 + 메모리 캐시.

환경 변수
----------
FRED_API_KEY       St. Louis Fed API 키 (High Yield 스프레드 필수)
BOFA_MANUAL        BofA 수동 값 (기본 2.1)
PUTCALL_MANUAL     Put/Call 비율 수동 값 (소수, 예: 0.85)
PUTCALL_FRED_SERIES  Put/Call을 FRED 시리즈로 받을 때 (FRED_API_KEY와 함께)
PRO_API_KEY        유료 응답용 — 요청 헤더 X-Api-Key 와 일치하면 전체 필드(pro 메타 포함)
TELEGRAM_BOT_TOKEN 텔레그램 봇 토큰 (없으면 전송 안 함)
TELEGRAM_CHAT_ID   알림 받을 chat_id

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
import random
import os
import re
import sqlite3
import threading
import time
from datetime import date, datetime, timedelta
from typing import Any, Optional

import requests
import yfinance as yf
from flask import Flask, jsonify, request
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

FREE_PANIC_KEYS = ("vix", "putCall", "fearGreed", "bofa", "highYield", "updatedAt")

# 프론트 panicMarketSignal.js 와 동일한 MVP 합산 규칙
def _score_component(kind: str, value: Any) -> int:
    if value is None:
        return 0
    try:
        n = float(value)
    except (TypeError, ValueError):
        return 0
    if math.isnan(n):
        return 0
    if kind == "vix":
        if n < 20:
            return 1
        if n < 30:
            return 0
        return -1
    if kind == "fearGreed":
        if n < 20:
            return 1
        if n < 40:
            return 0
        if n < 60:
            return 0
        if n < 80:
            return -1
        return -1
    if kind == "putCall":
        if n > 1.0:
            return 1
        if n > 0.7:
            return 0
        return -1
    if kind == "bofa":
        if n < 2:
            return 1
        if n < 5:
            return 0
        return -1
    if kind == "highYield":
        if n < 4:
            return 1
        if n < 6:
            return 0
        return -1
    return 0


def total_signal_score(row: dict) -> int:
    return (
        _score_component("vix", row.get("vix"))
        + _score_component("fearGreed", row.get("fearGreed"))
        + _score_component("putCall", row.get("putCall"))
        + _score_component("bofa", row.get("bofa"))
        + _score_component("highYield", row.get("highYield"))
    )


def send_telegram(msg: str) -> None:
    token = (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()
    chat_id = (os.environ.get("TELEGRAM_CHAT_ID") or "").strip()
    if not token or not chat_id:
        return
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        r = requests.post(url, data={"chat_id": chat_id, "text": msg}, timeout=20)
        r.raise_for_status()
    except Exception:
        log.exception("send_telegram failed")


_tg_edge_buy = False
_tg_edge_sell = False


def check_telegram_signals() -> None:
    """5분 스케줄 — 합산 점수 구간 진입 시에만 텔레그램 (중복 방지)."""
    global _tg_edge_buy, _tg_edge_sell
    with CACHE_LOCK:
        snap = dict(CACHE)
    ts = total_signal_score(snap)
    if ts >= 3:
        if not _tg_edge_buy:
            send_telegram("🟢 강한 매수 신호 발생!")
            _tg_edge_buy = True
    else:
        _tg_edge_buy = False
    if ts <= -3:
        if not _tg_edge_sell:
            send_telegram("🔴 강한 매도 신호 발생!")
            _tg_edge_sell = True
    else:
        _tg_edge_sell = False


def _telegram_schedule_loop() -> None:
    import schedule

    schedule.every(5).minutes.do(check_telegram_signals)
    log.info("Telegram signal scheduler every 300s started")
    while True:
        try:
            schedule.run_pending()
        except Exception:
            log.exception("telegram schedule.run_pending")
        time.sleep(1)


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
    "vxn": None,
    "move": None,
    "skew": None,
    "gs": None,
    "updatedAt": None,
}
CACHE_LOCK = threading.Lock()
_background_started = False
_telegram_scheduler_started = False
# STEP 19: 트레이더 수동 입력값 저장소 (메모리)
panic_data: dict = {}


def init_db() -> None:
    conn = sqlite3.connect("panic.db")
    c = conn.cursor()
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS panic (
            date TEXT PRIMARY KEY,
            vix REAL,
            fearGreed REAL,
            putCall REAL,
            bofa REAL,
            highYield REAL
        )
        """
    )
    conn.commit()
    conn.close()


def persist_panic_row(data: dict) -> None:
    today = datetime.now().strftime("%Y-%m-%d")
    conn = sqlite3.connect("panic.db")
    c = conn.cursor()
    c.execute(
        """
        INSERT OR REPLACE INTO panic (date, vix, fearGreed, putCall, bofa, highYield)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            today,
            data.get("vix"),
            data.get("fearGreed"),
            data.get("putCall"),
            data.get("bofa"),
            data.get("highYield"),
        ),
    )
    conn.commit()
    conn.close()


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
    global _background_started, _telegram_scheduler_started
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

    if (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip() and (
        os.environ.get("TELEGRAM_CHAT_ID") or ""
    ).strip():
        with CACHE_LOCK:
            if _telegram_scheduler_started:
                return
            _telegram_scheduler_started = True
        threading.Thread(target=_telegram_schedule_loop, daemon=True).start()
    else:
        log.info("Telegram scheduler skipped (set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)")


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})


@app.route("/")
def home():
    return {"ok": True}


def _panic_json_response():
    """X-Api-Key 가 PRO_API_KEY(기본 PRO_USER)와 같으면 전체(pro 메타), 아니면 무료 최소 필드."""
    api_key = request.headers.get("X-Api-Key") or request.headers.get("x-api-key") or ""
    pro_key = os.environ.get("PRO_API_KEY", "PRO_USER")
    with CACHE_LOCK:
        base = dict(CACHE)

    if api_key == pro_key:
        out = dict(base)
        out["accessTier"] = "pro"
        out["proFeatures"] = {
            "advancedSignal": True,
            "charts": True,
            "alerts": True,
            "historyAnalysis": True,
        }
        return jsonify(out)

    limited = {k: base.get(k) for k in FREE_PANIC_KEYS}
    limited["accessTier"] = "free"
    return jsonify(limited)


@app.route("/panic-data")
def panic_data():
    return _panic_json_response()


@app.route("/panic")
def panic():
    """수동 입력값이 있으면 우선 반환, 없으면 기존 자동 응답."""
    if panic_data:
        return jsonify(panic_data)
    return _panic_json_response()


@app.route("/update", methods=["POST"])
def update_data():
    global panic_data
    incoming = request.get_json(silent=True)
    if not isinstance(incoming, dict):
        return jsonify({"status": "error", "message": "invalid json body"}), 400

    def _to_num_or_none(v):
        try:
            if v is None or v == "":
                return None
            return float(v)
        except Exception:
            return None

    panic_data = {
        "vix": _to_num_or_none(incoming.get("vix")),
        "fearGreed": _to_num_or_none(incoming.get("fearGreed")),
        "putCall": _to_num_or_none(incoming.get("putCall")),
        "bofa": _to_num_or_none(incoming.get("bofa")),
        "highYield": _to_num_or_none(incoming.get("highYield")),
        "updatedAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "accessTier": "pro",
    }
    persist_panic_row(panic_data)
    return jsonify({"status": "ok", "data": panic_data})


@app.route("/update-text", methods=["POST"])
def update_text():
    global panic_data
    incoming = request.get_json(silent=True) or {}
    raw_text = incoming.get("text", "")
    if not isinstance(raw_text, str):
        return jsonify({"status": "error", "message": "text must be string"}), 400

    lines = raw_text.splitlines()
    parsed: dict[str, float] = {}

    for line in lines:
        if not line or "지수 명칭" in line:
            continue

        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 2:
            continue

        name = parts[0]
        value = parts[1]
        num_str = re.sub(r"[^0-9.]", "", value)
        try:
            num = float(num_str)
        except Exception:
            continue

        if "VIX" in name:
            parsed["vix"] = num
        elif "CNN" in name:
            parsed["fearGreed"] = num
        elif "풋/콜" in name:
            parsed["putCall"] = num
        elif "BofA" in name:
            parsed["bofa"] = num
        elif "HY" in name:
            parsed["highYield"] = num
        elif "SKEW" in name:
            parsed["skew"] = num
        elif "GS" in name:
            parsed["gs"] = num
        elif "MOVE" in name:
            parsed["move"] = num
        elif "VXN" in name:
            parsed["vxn"] = num

    parsed["updatedAt"] = datetime.now().strftime("%Y-%m-%d %H:%M")
    parsed["accessTier"] = "pro"
    panic_data = parsed
    persist_panic_row(parsed)
    return jsonify({"status": "parsed", "data": parsed})


def build_history_sample(n: int = 50):
    """STEP 17: 백테스트용 합성 시계열 (실서비스에서는 DB·크롤링 데이터로 교체)."""
    out = []
    price = 100.0
    start = date(2024, 1, 1)
    for i in range(n):
        price += (i % 5) - 2
        d = start + timedelta(days=i)
        out.append(
            {
                "date": d.isoformat(),
                "vix": 15 + (i % 20),
                "fearGreed": 20 + (i % 60),
                "putCall": round(0.6 + (i % 10) * 0.1, 4),
                "bofa": 1 + (i % 7),
                "price": float(price),
            }
        )
    return out


@app.route("/history")
def history():
    return jsonify(build_history_sample(50))


def generate_strategy() -> dict[str, Any]:
    return {
        "vix_buy": random.randint(20, 40),
        "fear_buy": random.randint(10, 40),
        "putcall_buy": round(random.uniform(0.8, 1.2), 2),
    }


def get_signal(day: dict[str, Any], strategy: dict[str, Any]) -> str:
    if (
        float(day.get("vix", 0)) > float(strategy["vix_buy"])
        and float(day.get("fearGreed", 0)) < float(strategy["fear_buy"])
        and float(day.get("putCall", 0)) > float(strategy["putcall_buy"])
    ):
        return "buy"
    return "hold"


def run_backtest(history_rows: list[dict[str, Any]], strategy: dict[str, Any]) -> float:
    if not history_rows:
        return 100.0

    cash = 100.0
    position = 0.0

    for day in history_rows:
        price = float(day.get("price", 0))
        if price <= 0:
            continue

        signal = get_signal(day, strategy)
        if signal == "buy" and cash > 0:
            position = cash / price
            cash = 0.0
        elif signal == "sell" and position > 0:
            cash = position * price
            position = 0.0

    last_price = float(history_rows[-1].get("price", 0))
    final_value = cash + (position * last_price if last_price > 0 else 0.0)
    return round(final_value, 4)


@app.route("/optimize")
def optimize():
    history_rows = build_history_sample(50)
    best_score = 0.0
    best_strategy = None

    for _ in range(100):
        strategy = generate_strategy()
        score = run_backtest(history_rows, strategy)
        if score > best_score:
            best_score = score
            best_strategy = strategy

    return jsonify(
        {
            "best_score": best_score,
            "strategy": best_strategy,
        }
    )


init_db()
bootstrap()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
